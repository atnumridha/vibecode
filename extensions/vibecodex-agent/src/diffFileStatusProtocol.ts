/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DiffFileStatus, ExternalDiffFile, ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexDiffFileStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly path?: string;
	readonly includePatchPreview: boolean;
	readonly includeSiblings: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexDiffFileStats {
	readonly additions: number;
	readonly deletions: number;
	readonly hunks: number;
	readonly replacements: number;
}

export interface VibeCodexDiffFileStatusFile {
	readonly path: string;
	readonly status: DiffFileStatus;
	readonly kind: 'whole_file' | 'unified_diff' | 'search_replace' | 'unknown';
	readonly stats: VibeCodexDiffFileStats;
	readonly hasCheckpoint: boolean;
	readonly checkpointId?: string;
	readonly patchPreview?: string;
	readonly proposedTextPreview?: string;
	readonly actions: {
		readonly canOpenDiff: boolean;
		readonly canAccept: boolean;
		readonly canReject: boolean;
		readonly canRestoreCheckpoint: boolean;
		readonly canAcceptAll: boolean;
		readonly canRejectAll: boolean;
		readonly requiresPlanApprovalForAccept: true;
	};
}

export interface VibeCodexDiffFileStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly reviewId?: string;
	readonly requestedPath?: string;
	readonly found: boolean;
	readonly file?: VibeCodexDiffFileStatusFile;
	readonly counts: Record<DiffFileStatus, number>;
	readonly siblings?: readonly string[];
	readonly checkpoint: {
		readonly taskCheckpointId?: string;
		readonly fileCheckpointCount: number;
		readonly restoreReady: boolean;
	};
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexDiffFileStatusInput {
	readonly review?: ExternalDiffReview;
	readonly path?: string;
	readonly taskCheckpointId?: string;
	readonly fileCheckpoints?: readonly { readonly path: string; readonly id: string }[];
}

const diffFileStatusMethods = new Set([
	'agent/getDiffFileStatus',
	'agent/diffFileStatus',
	'agent/getDiffFocusStatus',
	'diff/fileStatus',
	'diff/focusStatus',
	'diffReview/fileStatus',
	'vibecodex/diffFileStatus',
]);

const diffFileStatusToolNames = new Set([
	'diff_file_status',
	'diff_focus_status',
	'diff_review_file_status',
	'file_diff_status',
]);

const previewLimit = 1800;

export function normalizeDiffFileStatusRequest(message: JsonRpcMessage): VibeCodexDiffFileStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!diffFileStatusMethods.has(message.method) && !isDiffFileStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const path = stringValue(payload.path)
		?? stringValue(payload.file)
		?? stringValue(payload.filePath)
		?? stringValue(payload.file_path)
		?? stringValue(args.path)
		?? stringValue(args.file)
		?? stringValue(args.filePath)
		?? stringValue(args.file_path);
	return {
		id: message.id,
		method: message.method,
		...(path ? { path: normalizePath(path) } : {}),
		includePatchPreview: booleanValue(payload.includePatchPreview)
			?? booleanValue(payload.include_patch_preview)
			?? booleanValue(args.includePatchPreview)
			?? booleanValue(args.include_patch_preview)
			?? false,
		includeSiblings: booleanValue(payload.includeSiblings)
			?? booleanValue(payload.include_siblings)
			?? booleanValue(args.includeSiblings)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createDiffFileStatusResponse(request: VibeCodexDiffFileStatusRequest, input: VibeCodexDiffFileStatusInput): VibeCodexDiffFileStatusResponse {
	const review = input.review;
	const requestedPath = request.path ?? input.path;
	const checkpoints = new Map((input.fileCheckpoints ?? []).map(checkpoint => [normalizePath(checkpoint.path), checkpoint.id]));
	const counts = reviewCounts(review);
	const checkpoint = {
		...(input.taskCheckpointId ? { taskCheckpointId: redactSensitiveText(input.taskCheckpointId) } : {}),
		fileCheckpointCount: checkpoints.size,
		restoreReady: checkpoints.size > 0,
	};
	if (!review) {
		const response = {
			ok: false,
			source: 'externalExtension' as const,
			version: 1 as const,
			...(requestedPath ? { requestedPath: redactSensitiveText(requestedPath) } : {}),
			found: false,
			counts,
			checkpoint,
			nextAction: 'Wait for a backend diff review or call diff_status to inspect active review availability.',
			guardrails: diffFileStatusGuardrails,
			message: 'No active diff review is available.',
		};
		return { ...response, promptBlock: diffFileStatusPromptBlock(response) };
	}
	const file = findFile(review, requestedPath);
	const model = file ? fileStatus(file, checkpoints, request.includePatchPreview, counts) : undefined;
	const response = {
		ok: !!model,
		source: 'externalExtension' as const,
		version: 1 as const,
		reviewId: redactSensitiveText(review.reviewId),
		...(requestedPath ? { requestedPath: redactSensitiveText(requestedPath) } : {}),
		found: !!model,
		...(model ? { file: model } : {}),
		counts,
		...(request.includeSiblings ? { siblings: review.files.map(candidate => redactSensitiveText(candidate.path)).slice(0, 80) } : {}),
		checkpoint,
		nextAction: model ? nextAction(model) : 'Choose one of the active diff review paths from siblings, or call diff_status with includeReviewModel=true.',
		guardrails: diffFileStatusGuardrails,
		message: model
			? `Diff file ${model.path}: ${model.status}; ${model.hasCheckpoint ? 'checkpoint available' : 'no checkpoint yet'}.`
			: requestedPath
				? `No active diff file matches ${redactSensitiveText(requestedPath)}.`
				: 'No diff file path was provided and the active review contains multiple files.',
	};
	return { ...response, promptBlock: diffFileStatusPromptBlock(response) };
}

export function diffFileStatusSummary(response: VibeCodexDiffFileStatusResponse): string {
	return response.ok && response.file
		? `${response.message} Next: ${response.nextAction}`
		: response.message;
}

const diffFileStatusGuardrails = [
	'Diff file status is read-only and never accepts, rejects, restores, writes, deletes, stages, commits, or unlocks execution.',
	'Accept/reject/restore actions must still flow through the visible Diff Review UI, exact visual-plan authorization, checkpoint coverage, and workspace sandbox checks.',
	'Patch previews, proposed text previews, paths, checkpoint ids, and prompt blocks are redacted before they are returned to the backend.',
];

function findFile(review: ExternalDiffReview, requestedPath: string | undefined): ExternalDiffFile | undefined {
	if (!requestedPath && review.files.length === 1) {
		return review.files[0];
	}
	if (!requestedPath) {
		return undefined;
	}
	const target = normalizePath(requestedPath).toLowerCase();
	return review.files.find(file => normalizePath(file.path).toLowerCase() === target);
}

function fileStatus(file: ExternalDiffFile, checkpoints: ReadonlyMap<string, string>, includePatchPreview: boolean, counts: Record<DiffFileStatus, number>): VibeCodexDiffFileStatusFile {
	const checkpointId = checkpoints.get(normalizePath(file.path));
	const stats = patchStats(file.patch);
	return {
		path: redactSensitiveText(file.path),
		status: file.status,
		kind: diffKind(file),
		stats: {
			additions: stats.additions,
			deletions: stats.deletions,
			hunks: stats.hunks,
			replacements: file.replacements?.length ?? 0,
		},
		hasCheckpoint: !!checkpointId,
		...(checkpointId ? { checkpointId: redactSensitiveText(checkpointId) } : {}),
		...(includePatchPreview ? { patchPreview: preview(file.patch) } : {}),
		...(includePatchPreview && file.proposedText !== undefined ? { proposedTextPreview: preview(file.proposedText) } : {}),
		actions: {
			canOpenDiff: true,
			canAccept: file.status !== 'accepted',
			canReject: file.status !== 'rejected',
			canRestoreCheckpoint: file.status === 'accepted' && !!checkpointId,
			canAcceptAll: counts.pending > 0,
			canRejectAll: counts.pending + counts.accepted > 0,
			requiresPlanApprovalForAccept: true,
		},
	};
}

function reviewCounts(review: ExternalDiffReview | undefined): Record<DiffFileStatus, number> {
	return (review?.files ?? []).reduce<Record<DiffFileStatus, number>>((result, file) => {
		result[file.status]++;
		return result;
	}, { pending: 0, accepted: 0, rejected: 0 });
}

function patchStats(patch: string): { readonly additions: number; readonly deletions: number; readonly hunks: number } {
	const lines = patch.split(/\r?\n/);
	return {
		additions: lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length,
		deletions: lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length,
		hunks: lines.filter(line => line.startsWith('@@')).length,
	};
}

function diffKind(file: ExternalDiffFile): VibeCodexDiffFileStatusFile['kind'] {
	if (file.proposedText !== undefined) {
		return 'whole_file';
	}
	if (file.replacements?.length) {
		return 'search_replace';
	}
	return file.patch.includes('@@') ? 'unified_diff' : 'unknown';
}

function nextAction(file: VibeCodexDiffFileStatusFile): string {
	if (file.status === 'pending') {
		return 'Review the file in the Diff Review UI, then accept or reject it after exact plan authorization.';
	}
	if (file.status === 'accepted' && file.hasCheckpoint) {
		return 'Accepted file can be restored from its checkpoint or kept for Final Review rollback coverage.';
	}
	if (file.status === 'accepted') {
		return 'Accepted file is missing checkpoint coverage; restore readiness must be repaired before Final Review.';
	}
	return 'Rejected file needs no workspace action unless the backend submits a revised diff review.';
}

function preview(value: string): string {
	const redacted = redactSensitiveText(value);
	return redacted.length > previewLimit ? `${redacted.slice(0, previewLimit)}\n...[truncated]` : redacted;
}

function diffFileStatusPromptBlock(response: Omit<VibeCodexDiffFileStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'diff_file_status',
		reviewId: response.reviewId,
		requestedPath: response.requestedPath,
		found: response.found,
		file: response.file,
		counts: response.counts,
		checkpoint: response.checkpoint,
		nextAction: response.nextAction,
		note: 'Diff file status is read-only. Do not accept, reject, restore, or claim file changes from this status response.',
	}), null, 2);
}

function isDiffFileStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return diffFileStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function normalizePath(value: string): string {
	return value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
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
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
