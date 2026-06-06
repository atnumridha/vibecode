/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DiffFileStatus, ExternalDiffReview } from './executionProtocol';
import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexDiffReviewStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includePatches: boolean;
	readonly includeReviewModel: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexDiffReviewFileStatus {
	readonly path: string;
	readonly status: DiffFileStatus;
	readonly hasCheckpoint: boolean;
	readonly checkpointId?: string;
	readonly patchPreview?: string;
	readonly proposedTextPreview?: string;
}

export interface VibeCodexDiffReviewCheckpointStatus {
	readonly taskCheckpointId?: string;
	readonly fileCheckpointCount: number;
	readonly paths: readonly string[];
	readonly gitCheckpoint?: unknown;
}

export interface VibeCodexDiffReviewModel {
	readonly reviewId: string;
	readonly threadId?: string;
	readonly atomicApply: true;
	readonly totals: {
		readonly files: number;
		readonly pending: number;
		readonly accepted: number;
		readonly rejected: number;
		readonly additions: number;
		readonly deletions: number;
		readonly hunks: number;
		readonly replacements: number;
		readonly wholeFile: number;
		readonly unifiedDiff: number;
		readonly searchReplace: number;
		readonly unknown: number;
	};
	readonly paths: {
		readonly pending: readonly string[];
		readonly accepted: readonly string[];
		readonly rejected: readonly string[];
	};
	readonly checkpointCoverage: {
		readonly taskCheckpointId?: string;
		readonly acceptedWithCheckpoint: number;
		readonly acceptedWithoutCheckpoint: number;
		readonly restoreReady: boolean;
		readonly fileCheckpointCount: number;
	};
	readonly actions: {
		readonly canAcceptAll: boolean;
		readonly canRejectAll: boolean;
		readonly canRestoreTaskCheckpoint: boolean;
		readonly requiresPlanApprovalForAccept: true;
		readonly rejectsCanRestoreAcceptedCheckpoints: true;
	};
	readonly files: readonly VibeCodexDiffReviewFileModel[];
}

export interface VibeCodexDiffAtomicReviewReadiness {
	readonly state: 'no_review' | 'awaiting_decisions' | 'rollback_incomplete' | 'accepted_ready' | 'rejected_only';
	readonly mergeReady: boolean;
	readonly completionReady: boolean;
	readonly rollbackReady: boolean;
	readonly totalFiles: number;
	readonly pendingFiles: number;
	readonly acceptedFiles: number;
	readonly rejectedFiles: number;
	readonly checkpointCoverage: {
		readonly taskCheckpointId?: string;
		readonly acceptedWithCheckpoint: number;
		readonly acceptedWithoutCheckpoint: number;
		readonly missingCheckpointPaths: readonly string[];
		readonly fileCheckpointCount: number;
		readonly taskCheckpointAvailable: boolean;
	};
	readonly blockers: readonly string[];
	readonly nextAction: string;
}

export interface VibeCodexDiffReviewFileModel {
	readonly path: string;
	readonly status: DiffFileStatus;
	readonly kind: 'whole_file' | 'unified_diff' | 'search_replace' | 'unknown';
	readonly hasCheckpoint: boolean;
	readonly checkpointId?: string;
	readonly additions: number;
	readonly deletions: number;
	readonly hunks: number;
	readonly replacementCount: number;
	readonly actions: {
		readonly canOpenDiff: true;
		readonly canAccept: boolean;
		readonly canReject: boolean;
		readonly canRestoreCheckpoint: boolean;
	};
}

export interface VibeCodexDiffReviewStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly reviewId?: string;
	readonly threadId?: string;
	readonly createdAt?: number;
	readonly counts?: Record<DiffFileStatus, number>;
	readonly files?: readonly VibeCodexDiffReviewFileStatus[];
	readonly checkpoint?: VibeCodexDiffReviewCheckpointStatus;
	readonly reviewModel?: VibeCodexDiffReviewModel;
	readonly atomicReview?: VibeCodexDiffAtomicReviewReadiness;
	readonly guardrails: readonly string[];
	readonly promptBlock: string;
	readonly message: string;
}

export interface VibeCodexDiffReviewStatusInput {
	readonly review?: ExternalDiffReview;
	readonly taskCheckpointId?: string;
	readonly fileCheckpoints?: readonly { readonly path: string; readonly id: string }[];
	readonly gitCheckpoint?: unknown;
}

const diffReviewStatusMethods = new Set([
	'agent/getDiffReview',
	'agent/getDiffReviewStatus',
	'agent/diffReviewStatus',
	'diff/status',
	'diff/review/status',
	'diff_review_status',
]);

const diffReviewStatusToolNames = new Set([
	'diff_review_status',
	'get_diff_review',
	'get_diff_status',
]);

const previewLimit = 2000;

export function normalizeDiffReviewStatusRequest(message: JsonRpcMessage): VibeCodexDiffReviewStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!diffReviewStatusMethods.has(message.method) && !isDiffReviewStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includePatches: booleanValue(payload.includePatches)
			?? booleanValue(payload.include_patches)
			?? booleanValue(args.includePatches)
			?? booleanValue(args.include_patches)
			?? false,
		includeReviewModel: booleanValue(payload.includeReviewModel)
			?? booleanValue(payload.include_review_model)
			?? booleanValue(args.includeReviewModel)
			?? booleanValue(args.include_review_model)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createDiffReviewStatusResponse(request: VibeCodexDiffReviewStatusRequest, input: VibeCodexDiffReviewStatusInput): VibeCodexDiffReviewStatusResponse {
	const checkpoints = new Map((input.fileCheckpoints ?? []).map(checkpoint => [checkpoint.path, checkpoint.id]));
	const checkpoint: VibeCodexDiffReviewCheckpointStatus = {
		...(input.taskCheckpointId ? { taskCheckpointId: input.taskCheckpointId } : {}),
		fileCheckpointCount: checkpoints.size,
		paths: [...checkpoints.keys()].map(path => redactSensitiveText(path)),
		...(input.gitCheckpoint !== undefined ? { gitCheckpoint: redactSensitiveValue(input.gitCheckpoint) } : {}),
	};
	if (!input.review) {
		const atomicReview = createAtomicReviewReadiness(undefined, checkpoint, checkpoints);
		return {
			ok: false,
			source: 'externalExtension',
			checkpoint,
			atomicReview,
			guardrails: diffReviewStatusGuardrails,
			promptBlock: diffReviewStatusPromptBlock(undefined, checkpoint, undefined, atomicReview),
			message: 'No active diff review is available.',
		};
	}
	const files = input.review.files.map(file => {
		const checkpointId = checkpoints.get(file.path);
		return {
			path: redactSensitiveText(file.path),
			status: file.status,
			hasCheckpoint: !!checkpointId,
			...(checkpointId ? { checkpointId } : {}),
			...(request.includePatches ? { patchPreview: preview(file.patch) } : {}),
			...(request.includePatches && file.proposedText !== undefined ? { proposedTextPreview: preview(file.proposedText) } : {}),
		};
	});
	const counts = files.reduce<Record<DiffFileStatus, number>>((result, file) => {
		result[file.status]++;
		return result;
	}, { pending: 0, accepted: 0, rejected: 0 });
	const reviewModel = request.includeReviewModel ? createDiffReviewModel(input.review, checkpoint, checkpoints) : undefined;
	const atomicReview = createAtomicReviewReadiness(input.review, checkpoint, checkpoints);
	return {
		ok: true,
		source: 'externalExtension',
		reviewId: input.review.reviewId,
		...(input.review.threadId ? { threadId: input.review.threadId } : {}),
		createdAt: input.review.createdAt,
		counts,
		files,
		checkpoint,
		...(reviewModel ? { reviewModel } : {}),
		atomicReview,
		guardrails: diffReviewStatusGuardrails,
		promptBlock: diffReviewStatusPromptBlock(input.review, checkpoint, reviewModel, atomicReview),
		message: `Diff review ${input.review.reviewId}: ${counts.pending} pending, ${counts.accepted} accepted, ${counts.rejected} rejected.`,
	};
}

export function diffReviewStatusSummary(response: VibeCodexDiffReviewStatusResponse): string {
	if (!response.ok || !response.counts) {
		return response.message;
	}
	return `${response.message} ${response.checkpoint?.fileCheckpointCount ?? 0} file checkpoint${response.checkpoint?.fileCheckpointCount === 1 ? '' : 's'} available.`;
}

const diffReviewStatusGuardrails = [
	'Diff review status is read-only and never accepts, rejects, restores, writes, deletes, stages, commits, or unlocks execution.',
	'Accept actions still require exact visual-plan authorization, workspace sandbox checks, and user approval in the visible Diff Review UI.',
	'Rejecting an accepted file restores its checkpoint when available; full task restore remains a separate explicit rollback action.',
	'Patch previews, proposed text, paths, checkpoint metadata, and review diagnostics are redacted before returning status.',
];

function createDiffReviewModel(review: ExternalDiffReview, checkpoint: VibeCodexDiffReviewCheckpointStatus, checkpoints: ReadonlyMap<string, string>): VibeCodexDiffReviewModel {
	const files = review.files.map(file => createFileModel(file, checkpoints.get(file.path)));
	const totals = files.reduce((result, file) => ({
		files: result.files + 1,
		pending: result.pending + (file.status === 'pending' ? 1 : 0),
		accepted: result.accepted + (file.status === 'accepted' ? 1 : 0),
		rejected: result.rejected + (file.status === 'rejected' ? 1 : 0),
		additions: result.additions + file.additions,
		deletions: result.deletions + file.deletions,
		hunks: result.hunks + file.hunks,
		replacements: result.replacements + file.replacementCount,
		wholeFile: result.wholeFile + (file.kind === 'whole_file' ? 1 : 0),
		unifiedDiff: result.unifiedDiff + (file.kind === 'unified_diff' ? 1 : 0),
		searchReplace: result.searchReplace + (file.kind === 'search_replace' ? 1 : 0),
		unknown: result.unknown + (file.kind === 'unknown' ? 1 : 0),
	}), {
		files: 0,
		pending: 0,
		accepted: 0,
		rejected: 0,
		additions: 0,
		deletions: 0,
		hunks: 0,
		replacements: 0,
		wholeFile: 0,
		unifiedDiff: 0,
		searchReplace: 0,
		unknown: 0,
	});
	const acceptedWithCheckpoint = files.filter(file => file.status === 'accepted' && file.hasCheckpoint).length;
	const acceptedWithoutCheckpoint = files.filter(file => file.status === 'accepted' && !file.hasCheckpoint).length;
	return {
		reviewId: redactSensitiveText(review.reviewId),
		...(review.threadId ? { threadId: redactSensitiveText(review.threadId) } : {}),
		atomicApply: true,
		totals,
		paths: {
			pending: files.filter(file => file.status === 'pending').map(file => file.path),
			accepted: files.filter(file => file.status === 'accepted').map(file => file.path),
			rejected: files.filter(file => file.status === 'rejected').map(file => file.path),
		},
		checkpointCoverage: {
			...(checkpoint.taskCheckpointId ? { taskCheckpointId: checkpoint.taskCheckpointId } : {}),
			acceptedWithCheckpoint,
			acceptedWithoutCheckpoint,
			restoreReady: checkpoint.fileCheckpointCount > 0,
			fileCheckpointCount: checkpoint.fileCheckpointCount,
		},
		actions: {
			canAcceptAll: totals.pending > 0,
			canRejectAll: totals.pending + totals.accepted > 0,
			canRestoreTaskCheckpoint: checkpoint.fileCheckpointCount > 0,
			requiresPlanApprovalForAccept: true,
			rejectsCanRestoreAcceptedCheckpoints: true,
		},
		files,
	};
}

function createFileModel(file: ExternalDiffReview['files'][number], checkpointId: string | undefined): VibeCodexDiffReviewFileModel {
	const stats = patchStats(file.patch);
	const kind = diffKind(file);
	return {
		path: redactSensitiveText(file.path),
		status: file.status,
		kind,
		hasCheckpoint: !!checkpointId,
		...(checkpointId ? { checkpointId } : {}),
		additions: stats.additions,
		deletions: stats.deletions,
		hunks: stats.hunks,
		replacementCount: file.replacements?.length ?? 0,
		actions: {
			canOpenDiff: true,
			canAccept: file.status !== 'accepted',
			canReject: file.status !== 'rejected',
			canRestoreCheckpoint: file.status === 'accepted' && !!checkpointId,
		},
	};
}

function createAtomicReviewReadiness(review: ExternalDiffReview | undefined, checkpoint: VibeCodexDiffReviewCheckpointStatus, checkpoints: ReadonlyMap<string, string>): VibeCodexDiffAtomicReviewReadiness {
	if (!review) {
		return {
			state: 'no_review',
			mergeReady: false,
			completionReady: false,
			rollbackReady: false,
			totalFiles: 0,
			pendingFiles: 0,
			acceptedFiles: 0,
			rejectedFiles: 0,
			checkpointCoverage: {
				...(checkpoint.taskCheckpointId ? { taskCheckpointId: checkpoint.taskCheckpointId } : {}),
				acceptedWithCheckpoint: 0,
				acceptedWithoutCheckpoint: 0,
				missingCheckpointPaths: [],
				fileCheckpointCount: checkpoint.fileCheckpointCount,
				taskCheckpointAvailable: !!checkpoint.taskCheckpointId,
			},
			blockers: ['No active diff review is available.'],
			nextAction: 'Wait for the backend to submit a review-first diff before checking atomic merge readiness.',
		};
	}
	const pending = review.files.filter(file => file.status === 'pending');
	const accepted = review.files.filter(file => file.status === 'accepted');
	const rejected = review.files.filter(file => file.status === 'rejected');
	const missingCheckpointPaths = accepted
		.filter(file => !checkpoints.has(file.path))
		.map(file => redactSensitiveText(file.path));
	const acceptedWithoutCheckpoint = missingCheckpointPaths.length;
	const acceptedWithCheckpoint = accepted.length - acceptedWithoutCheckpoint;
	const taskCheckpointAvailable = !!checkpoint.taskCheckpointId;
	const rollbackReady = accepted.length === 0 || (taskCheckpointAvailable && acceptedWithoutCheckpoint === 0 && checkpoint.fileCheckpointCount >= accepted.length);
	const blockers = [
		...pending.map(file => `Pending diff decision for ${redactSensitiveText(file.path)}.`),
		accepted.length > 0 && !taskCheckpointAvailable ? 'Accepted diff files require a task checkpoint before completion.' : undefined,
		...missingCheckpointPaths.map(path => `Accepted file ${path} is missing checkpoint coverage.`),
		accepted.length > 0 && checkpoint.fileCheckpointCount < accepted.length ? `Expected at least ${accepted.length} file checkpoint${accepted.length === 1 ? '' : 's'} for accepted files; found ${checkpoint.fileCheckpointCount}.` : undefined,
	].filter((value): value is string => !!value);
	const completionReady = pending.length === 0 && rollbackReady;
	const mergeReady = completionReady && accepted.length > 0;
	const state: VibeCodexDiffAtomicReviewReadiness['state'] = pending.length
		? 'awaiting_decisions'
		: !rollbackReady
			? 'rollback_incomplete'
			: accepted.length > 0
				? 'accepted_ready'
				: 'rejected_only';
	return {
		state,
		mergeReady,
		completionReady,
		rollbackReady,
		totalFiles: review.files.length,
		pendingFiles: pending.length,
		acceptedFiles: accepted.length,
		rejectedFiles: rejected.length,
		checkpointCoverage: {
			...(checkpoint.taskCheckpointId ? { taskCheckpointId: checkpoint.taskCheckpointId } : {}),
			acceptedWithCheckpoint,
			acceptedWithoutCheckpoint,
			missingCheckpointPaths,
			fileCheckpointCount: checkpoint.fileCheckpointCount,
			taskCheckpointAvailable,
		},
		blockers: redactSensitiveValue(blockers) as readonly string[],
		nextAction: atomicReviewNextAction(state, accepted.length),
	};
}

function atomicReviewNextAction(state: VibeCodexDiffAtomicReviewReadiness['state'], acceptedFiles: number): string {
	switch (state) {
		case 'awaiting_decisions':
			return 'Wait for the developer to accept or reject every pending diff file in the visible Diff Review UI.';
		case 'rollback_incomplete':
			return 'Repair checkpoint coverage before treating accepted diffs as merge-ready or completion-ready.';
		case 'accepted_ready':
			return `Accepted diff review is atomic-merge ready with rollback coverage for ${acceptedFiles} file${acceptedFiles === 1 ? '' : 's'}. Continue to verification and Final Review gates.`;
		case 'rejected_only':
			return 'All diff files were rejected; there is no merge payload, but the diff confirmation gate is settled.';
		default:
			return 'Wait for a review-first diff before checking atomic merge readiness.';
	}
}

function diffReviewStatusPromptBlock(review: ExternalDiffReview | undefined, checkpoint: VibeCodexDiffReviewCheckpointStatus, reviewModel: VibeCodexDiffReviewModel | undefined, atomicReview: VibeCodexDiffAtomicReviewReadiness): string {
	return JSON.stringify(redactSensitiveValue({
		active: !!review,
		reviewId: review?.reviewId,
		threadId: review?.threadId,
		checkpoint,
		atomicReview,
		reviewModel,
		guardrails: diffReviewStatusGuardrails,
		note: 'Use diff review status as read-only coordination context. atomicReview.mergeReady only means all visible diff decisions are settled and rollback coverage exists; completion still requires verification and Final Review gates.',
	}), null, 2);
}

function diffKind(file: ExternalDiffReview['files'][number]): VibeCodexDiffReviewFileModel['kind'] {
	if (file.replacements?.length) {
		return 'search_replace';
	}
	if (/^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(file.patch)) {
		return 'unified_diff';
	}
	if (file.proposedText !== undefined) {
		return 'whole_file';
	}
	return 'unknown';
}

function patchStats(patch: string): { readonly additions: number; readonly deletions: number; readonly hunks: number } {
	let additions = 0;
	let deletions = 0;
	let hunks = 0;
	for (const line of patch.split(/\r?\n/)) {
		if (/^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/.test(line)) {
			hunks++;
			continue;
		}
		if (line.startsWith('+++') || line.startsWith('---')) {
			continue;
		}
		if (line.startsWith('+')) {
			additions++;
		} else if (line.startsWith('-')) {
			deletions++;
		}
	}
	return { additions, deletions, hunks };
}

function preview(value: string): string {
	const redacted = redactSensitiveText(value);
	return redacted.length > previewLimit ? `${redacted.slice(0, previewLimit)}\n[truncated]` : redacted;
}

function isDiffReviewStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return diffReviewStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		return /^(1|true|yes)$/i.test(value) ? true : /^(0|false|no)$/i.test(value) ? false : undefined;
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
