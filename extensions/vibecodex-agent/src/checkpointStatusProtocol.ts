/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DiffFileStatus, ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexGitCheckpoint } from './workspaceGitCheckpoint';
import type { ExternalPatchCheckpoint } from './workspacePatch';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexCheckpointStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeFiles: boolean;
	readonly includeGit: boolean;
	readonly includeActiveReview: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexCheckpointFileStatus {
	readonly id: string;
	readonly path: string;
	readonly existed: boolean;
	readonly createdAt: number;
}

export interface VibeCodexCheckpointReviewCoverage {
	readonly active: boolean;
	readonly reviewId?: string;
	readonly counts?: Record<DiffFileStatus, number>;
	readonly acceptedFiles: number;
	readonly acceptedWithCheckpoint: number;
	readonly missingCheckpointPaths: readonly string[];
	readonly complete: boolean;
}

export interface VibeCodexCheckpointStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly state: 'none' | 'partial' | 'ready';
	readonly taskCheckpointId?: string;
	readonly restoreAvailable: boolean;
	readonly fileCheckpointCount: number;
	readonly paths: readonly string[];
	readonly files?: readonly VibeCodexCheckpointFileStatus[];
	readonly gitCheckpoint?: unknown;
	readonly reviewCoverage: VibeCodexCheckpointReviewCoverage;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexCheckpointStatusInput {
	readonly taskCheckpointId?: string;
	readonly fileCheckpoints?: readonly ExternalPatchCheckpoint[];
	readonly gitCheckpoint?: VibeCodexGitCheckpoint;
	readonly activeReview?: ExternalDiffReview;
}

const checkpointStatusMethods = new Set([
	'agent/getCheckpointStatus',
	'agent/checkpointStatus',
	'agent/getRollbackStatus',
	'agent/rollbackStatus',
	'checkpoint/status',
	'rollback/status',
	'vibecodex/checkpointStatus',
]);

const checkpointStatusToolNames = new Set([
	'checkpoint_status',
	'get_checkpoint_status',
	'rollback_status',
	'get_rollback_status',
	'task_checkpoint_status',
	'get_task_checkpoint_status',
	'restore_status',
]);

export function normalizeCheckpointStatusRequest(message: JsonRpcMessage): VibeCodexCheckpointStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!checkpointStatusMethods.has(message.method) && !isCheckpointStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeFiles: booleanValue(payload.includeFiles)
			?? booleanValue(payload.include_files)
			?? booleanValue(args.includeFiles)
			?? booleanValue(args.include_files)
			?? false,
		includeGit: booleanValue(payload.includeGit)
			?? booleanValue(payload.include_git)
			?? booleanValue(args.includeGit)
			?? booleanValue(args.include_git)
			?? true,
		includeActiveReview: booleanValue(payload.includeActiveReview)
			?? booleanValue(payload.include_active_review)
			?? booleanValue(args.includeActiveReview)
			?? booleanValue(args.include_active_review)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createCheckpointStatusResponse(request: VibeCodexCheckpointStatusRequest, input: VibeCodexCheckpointStatusInput): VibeCodexCheckpointStatusResponse {
	const checkpoints = input.fileCheckpoints ?? [];
	const checkpointPaths = checkpoints.map(checkpoint => checkpoint.path);
	const coverage = reviewCoverage(input.activeReview, new Set(checkpointPaths), request.includeActiveReview);
	const restoreAvailable = checkpoints.length > 0;
	const state = !restoreAvailable
		? 'none'
		: coverage.active && !coverage.complete
			? 'partial'
		: 'ready';
	return {
		ok: true,
		source: 'externalExtension',
		state,
		...(input.taskCheckpointId ? { taskCheckpointId: redactSensitiveText(input.taskCheckpointId) } : {}),
		restoreAvailable,
		fileCheckpointCount: checkpoints.length,
		paths: checkpointPaths.map(path => redactSensitiveText(path)),
		...(request.includeFiles ? { files: checkpoints.map(fileCheckpointStatus) } : {}),
		...(request.includeGit && input.gitCheckpoint ? { gitCheckpoint: redactSensitiveValue(input.gitCheckpoint) } : {}),
		reviewCoverage: coverage,
		guardrails: [
			'Checkpoint status is read-only and never restores, deletes, writes, stages, commits, branches, or merges files.',
			'File checkpoint contents are intentionally omitted; only ids, paths, creation time, and existed-before flags may be returned.',
			'Restore operations remain developer-triggered through the Diff Review UI and workspace sandbox.',
			'Accepted diff files should have checkpoint coverage before final review can pass rollback readiness.',
		],
		message: checkpointMessage(input.taskCheckpointId, checkpoints.length, coverage),
	};
}

export function checkpointStatusSummary(response: VibeCodexCheckpointStatusResponse): string {
	return `${response.message} State: ${response.state}. Restore available: ${response.restoreAvailable ? 'yes' : 'no'}.`;
}

function reviewCoverage(review: ExternalDiffReview | undefined, checkpointPaths: ReadonlySet<string>, includeActiveReview: boolean): VibeCodexCheckpointReviewCoverage {
	if (!includeActiveReview || !review) {
		return {
			active: false,
			acceptedFiles: 0,
			acceptedWithCheckpoint: 0,
			missingCheckpointPaths: [],
			complete: checkpointPaths.size > 0,
		};
	}
	const counts = review.files.reduce<Record<DiffFileStatus, number>>((result, file) => {
		result[file.status]++;
		return result;
	}, { pending: 0, accepted: 0, rejected: 0 });
	const accepted = review.files.filter(file => file.status === 'accepted');
	const missing = accepted
		.filter(file => !checkpointPaths.has(file.path))
		.map(file => redactSensitiveText(file.path));
	return {
		active: true,
		reviewId: redactSensitiveText(review.reviewId),
		counts,
		acceptedFiles: accepted.length,
		acceptedWithCheckpoint: accepted.length - missing.length,
		missingCheckpointPaths: missing,
		complete: missing.length === 0,
	};
}

function fileCheckpointStatus(checkpoint: ExternalPatchCheckpoint): VibeCodexCheckpointFileStatus {
	return {
		id: redactSensitiveText(checkpoint.id),
		path: redactSensitiveText(checkpoint.path),
		existed: checkpoint.existed,
		createdAt: checkpoint.createdAt,
	};
}

function checkpointMessage(taskCheckpointId: string | undefined, fileCheckpointCount: number, coverage: VibeCodexCheckpointReviewCoverage): string {
	const task = taskCheckpointId ? `Task checkpoint ${redactSensitiveText(taskCheckpointId)}` : 'No task checkpoint';
	const files = `${fileCheckpointCount} file checkpoint${fileCheckpointCount === 1 ? '' : 's'}`;
	if (coverage.active) {
		return `${task}; ${files}; rollback coverage ${coverage.acceptedWithCheckpoint}/${coverage.acceptedFiles} accepted file${coverage.acceptedFiles === 1 ? '' : 's'}.`;
	}
	return `${task}; ${files}; no active diff review coverage required.`;
}

function isCheckpointStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return checkpointStatusToolNames.has(tool);
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
