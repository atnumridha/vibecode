/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DiffFileStatus, ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { ExternalPatchCheckpoint } from './workspacePatch';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexRollbackRestoreTargetKind = 'task' | 'file' | 'all';
export type VibeCodexRollbackRestoreRoute = 'restore_task_checkpoint' | 'restore_file_checkpoint' | 'repair_checkpoint_coverage' | 'choose_file_checkpoint' | 'no_checkpoint_available';

export interface VibeCodexRollbackRestoreStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly target: VibeCodexRollbackRestoreTargetKind;
	readonly path?: string;
	readonly includeFiles: boolean;
	readonly includePromptBlock: boolean;
	readonly maxFiles: number;
	readonly requestedAt: number;
}

export interface VibeCodexRollbackRestoreFileReadiness {
	readonly path: string;
	readonly hasCheckpoint: boolean;
	readonly checkpointId?: string;
	readonly existed?: boolean;
	readonly createdAt?: number;
	readonly activeReviewStatus?: DiffFileStatus;
	readonly canRestore: boolean;
	readonly blockers: readonly string[];
}

export interface VibeCodexRollbackRestoreCoverage {
	readonly activeReview: boolean;
	readonly reviewId?: string;
	readonly counts?: Record<DiffFileStatus, number>;
	readonly acceptedFiles: number;
	readonly acceptedWithCheckpoint: number;
	readonly missingCheckpointPaths: readonly string[];
	readonly complete: boolean;
}

export interface VibeCodexRollbackRestoreStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly target: {
		readonly kind: VibeCodexRollbackRestoreTargetKind;
		readonly path?: string;
	};
	readonly readiness: {
		readonly canRestore: boolean;
		readonly route: VibeCodexRollbackRestoreRoute;
		readonly blockers: readonly string[];
		readonly nextAction: string;
		readonly mutationLocked: true;
		readonly requiresDeveloperAction: true;
	};
	readonly taskCheckpoint?: {
		readonly id: string;
		readonly fileCheckpointCount: number;
		readonly restoreAvailable: boolean;
	};
	readonly file?: VibeCodexRollbackRestoreFileReadiness;
	readonly files?: readonly VibeCodexRollbackRestoreFileReadiness[];
	readonly coverage: VibeCodexRollbackRestoreCoverage;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexRollbackRestoreStatusInput {
	readonly taskCheckpointId?: string;
	readonly fileCheckpoints?: readonly ExternalPatchCheckpoint[];
	readonly activeReview?: ExternalDiffReview;
}

const rollbackRestoreStatusMethods = new Set([
	'agent/getRollbackRestoreStatus',
	'agent/rollbackRestoreStatus',
	'agent/getCheckpointRestoreStatus',
	'agent/checkpointRestoreStatus',
	'rollback/restoreStatus',
	'checkpoint/restoreStatus',
	'diff/restoreStatus',
	'vibecodex/rollbackRestoreStatus',
]);

const rollbackRestoreStatusToolNames = new Set([
	'rollback_restore_status',
	'checkpoint_restore_status',
	'restore_checkpoint_status',
	'task_rollback_status',
	'task_restore_status',
	'diff_restore_status',
	'file_restore_status',
]);

export function normalizeRollbackRestoreStatusRequest(message: JsonRpcMessage): VibeCodexRollbackRestoreStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!rollbackRestoreStatusMethods.has(message.method) && !isRollbackRestoreStatusToolCall(message.method, payload, args)) {
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
		target: targetValue(stringValue(payload.target) ?? stringValue(args.target), path),
		...(path ? { path: redactSensitiveText(path) } : {}),
		includeFiles: booleanValue(payload.includeFiles)
			?? booleanValue(payload.include_files)
			?? booleanValue(args.includeFiles)
			?? booleanValue(args.include_files)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		maxFiles: clampNumber(numberValue(payload.maxFiles)
			?? numberValue(payload.max_files)
			?? numberValue(args.maxFiles)
			?? numberValue(args.max_files)
			?? 20, 0, 80),
		requestedAt: Date.now(),
	};
}

export function createRollbackRestoreStatusResponse(request: VibeCodexRollbackRestoreStatusRequest, input: VibeCodexRollbackRestoreStatusInput = {}): VibeCodexRollbackRestoreStatusResponse {
	const checkpoints = input.fileCheckpoints ?? [];
	const activeReviewFiles = new Map((input.activeReview?.files ?? []).map(file => [file.path, file.status]));
	const files = checkpoints.map(checkpoint => fileReadiness(checkpoint, activeReviewFiles.get(checkpoint.path)));
	const selectedFile = request.path ? files.find(file => normalizePath(file.path) === normalizePath(request.path!)) : undefined;
	const coverage = reviewCoverage(input.activeReview, new Set(files.map(file => normalizePath(file.path))));
	const readiness = readinessFor(request, input.taskCheckpointId, files, selectedFile, coverage);
	const response: VibeCodexRollbackRestoreStatusResponse = {
		ok: true,
		source: 'externalExtension',
		version: 1,
		target: {
			kind: request.target,
			...(request.path ? { path: redactSensitiveText(request.path) } : {}),
		},
		readiness,
		...(input.taskCheckpointId ? {
			taskCheckpoint: {
				id: redactSensitiveText(input.taskCheckpointId),
				fileCheckpointCount: checkpoints.length,
				restoreAvailable: checkpoints.length > 0,
			},
		} : {}),
		...(selectedFile ? { file: selectedFile } : {}),
		...(request.includeFiles ? { files: files.slice(0, request.maxFiles) } : {}),
		coverage,
		guardrails: [
			'Rollback restore status is read-only and never restores checkpoints, writes files, deletes files, stages, commits, branches, merges, accepts diffs, rejects diffs, or unlocks execution.',
			'The response only describes the existing visible Restore checkpoint controls; the developer must trigger restore actions in the Diff Review UI.',
			'Checkpoint contents and previous file text are never returned to the backend.',
			'Task restore readiness requires at least one file checkpoint; file restore readiness requires the exact requested path to have a checkpoint.',
			'Accepted diff files missing checkpoint coverage must be repaired before Delivery Bar rollback readiness can pass.',
		],
		message: rollbackRestoreMessage(readiness, request, checkpoints.length, coverage),
	};
	return redactSensitiveValue({
		...response,
		...(request.includePromptBlock ? { promptBlock: rollbackRestorePromptBlock(response) } : {}),
	}) as VibeCodexRollbackRestoreStatusResponse;
}

export function rollbackRestoreStatusSummary(response: VibeCodexRollbackRestoreStatusResponse): string {
	return `${response.message} Route: ${response.readiness.route}. Restore ready: ${response.readiness.canRestore ? 'yes' : 'no'}.`;
}

function readinessFor(request: VibeCodexRollbackRestoreStatusRequest, taskCheckpointId: string | undefined, files: readonly VibeCodexRollbackRestoreFileReadiness[], selectedFile: VibeCodexRollbackRestoreFileReadiness | undefined, coverage: VibeCodexRollbackRestoreCoverage): VibeCodexRollbackRestoreStatusResponse['readiness'] {
	const blockers: string[] = [];
	if (request.target === 'file') {
		if (!request.path) {
			blockers.push('A file path is required for file checkpoint restore readiness.');
		}
		if (request.path && !selectedFile) {
			blockers.push(`No checkpoint exists for ${redactSensitiveText(request.path)}.`);
		}
		const canRestore = !!selectedFile && selectedFile.canRestore;
		return {
			canRestore,
			route: canRestore ? 'restore_file_checkpoint' : blockers.length ? 'no_checkpoint_available' : 'choose_file_checkpoint',
			blockers: redactSensitiveValue(blockers) as readonly string[],
			nextAction: canRestore ? 'Developer can use the focused file Restore checkpoint control in Diff Review.' : 'Request checkpoint_status or diff_file_status to repair rollback coverage before restore.',
			mutationLocked: true,
			requiresDeveloperAction: true,
		};
	}
	if (request.target === 'task' || request.target === 'all') {
		if (coverage.activeReview && !coverage.complete) {
			blockers.push(`Accepted files missing checkpoints: ${coverage.missingCheckpointPaths.join(', ')}`);
		}
		if (!taskCheckpointId) {
			blockers.push('No task checkpoint id exists yet.');
		}
		if (!files.length) {
			blockers.push('No file checkpoints are available for task rollback.');
		}
		const canRestore = !!taskCheckpointId && files.length > 0 && coverage.complete;
		return {
			canRestore,
			route: canRestore ? 'restore_task_checkpoint' : coverage.activeReview && !coverage.complete ? 'repair_checkpoint_coverage' : 'no_checkpoint_available',
			blockers: redactSensitiveValue(blockers) as readonly string[],
			nextAction: canRestore ? 'Developer can use Restore task checkpoint in Diff Review.' : 'Repair checkpoint coverage before treating rollback as ready.',
			mutationLocked: true,
			requiresDeveloperAction: true,
		};
	}
	return {
		canRestore: false,
		route: 'choose_file_checkpoint',
		blockers: ['Choose task or file restore readiness.'],
		nextAction: 'Request rollback_restore_status with target=task or target=file.',
		mutationLocked: true,
		requiresDeveloperAction: true,
	};
}

function fileReadiness(checkpoint: ExternalPatchCheckpoint, activeReviewStatus: DiffFileStatus | undefined): VibeCodexRollbackRestoreFileReadiness {
	return {
		path: redactSensitiveText(checkpoint.path),
		hasCheckpoint: true,
		checkpointId: redactSensitiveText(checkpoint.id),
		existed: checkpoint.existed,
		createdAt: checkpoint.createdAt,
		...(activeReviewStatus ? { activeReviewStatus } : {}),
		canRestore: true,
		blockers: [],
	};
}

function reviewCoverage(review: ExternalDiffReview | undefined, checkpointPaths: ReadonlySet<string>): VibeCodexRollbackRestoreCoverage {
	if (!review) {
		return {
			activeReview: false,
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
		.filter(file => !checkpointPaths.has(normalizePath(file.path)))
		.map(file => redactSensitiveText(file.path));
	return {
		activeReview: true,
		reviewId: redactSensitiveText(review.reviewId),
		counts,
		acceptedFiles: accepted.length,
		acceptedWithCheckpoint: accepted.length - missing.length,
		missingCheckpointPaths: missing,
		complete: missing.length === 0,
	};
}

function rollbackRestoreMessage(readiness: VibeCodexRollbackRestoreStatusResponse['readiness'], request: VibeCodexRollbackRestoreStatusRequest, fileCheckpointCount: number, coverage: VibeCodexRollbackRestoreCoverage): string {
	const target = request.target === 'file' && request.path ? `file ${redactSensitiveText(request.path)}` : `${request.target} rollback`;
	return `${target} restore readiness: ${readiness.canRestore ? 'ready' : 'blocked'} with ${fileCheckpointCount} file checkpoint${fileCheckpointCount === 1 ? '' : 's'} and coverage ${coverage.acceptedWithCheckpoint}/${coverage.acceptedFiles} accepted file${coverage.acceptedFiles === 1 ? '' : 's'}.`;
}

function rollbackRestorePromptBlock(response: VibeCodexRollbackRestoreStatusResponse): string {
	return JSON.stringify({
		tool: 'rollback_restore_status',
		target: response.target,
		readiness: response.readiness,
		taskCheckpoint: response.taskCheckpoint,
		file: response.file,
		coverage: response.coverage,
		guardrails: response.guardrails,
	}, null, 2);
}

function targetValue(value: string | undefined, path: string | undefined): VibeCodexRollbackRestoreTargetKind {
	const normalized = (value ?? '').trim().toLowerCase().replace(/[_\s-]+/g, '_');
	if (normalized === 'file' || normalized === 'path' || path) {
		return 'file';
	}
	if (normalized === 'all') {
		return 'all';
	}
	return 'task';
}

function isRollbackRestoreStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return rollbackRestoreStatusToolNames.has(tool);
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
	return value.replace(/\\/g, '/').replace(/^\.\/+/, '').toLowerCase();
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim().length) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
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
