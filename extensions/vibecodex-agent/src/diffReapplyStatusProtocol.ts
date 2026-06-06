/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDiffValidationResponse, type VibeCodexDiffValidationResponse } from './diffValidationProtocol';
import type { DiffFileStatus, ExternalDiffFile, ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexDiffReapplyRoute =
	| 'provide_candidate'
	| 'repair_candidate'
	| 'choose_active_path'
	| 'submit_new_review'
	| 'replace_pending_review_file'
	| 'submit_revised_review_file'
	| 'restore_or_resubmit'
	| 'blocked';

export interface VibeCodexDiffReapplyStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly path?: string;
	readonly candidate: unknown;
	readonly candidatePresent: boolean;
	readonly includeCandidate: boolean;
	readonly includePatchPreviews: boolean;
	readonly includeRepairHints: boolean;
	readonly includeActiveFile: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexDiffReapplyActiveFile {
	readonly path: string;
	readonly status: DiffFileStatus;
	readonly kind: 'whole_file' | 'unified_diff' | 'search_replace' | 'unknown';
	readonly hasCheckpoint: boolean;
	readonly checkpointId?: string;
}

export interface VibeCodexDiffReapplyStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly targetPath?: string;
	readonly activeReview: {
		readonly available: boolean;
		readonly reviewId?: string;
		readonly files: number;
		readonly pending: number;
		readonly accepted: number;
		readonly rejected: number;
		readonly matched: boolean;
		readonly siblings?: readonly string[];
	};
	readonly activeFile?: VibeCodexDiffReapplyActiveFile;
	readonly candidate: {
		readonly present: boolean;
		readonly valid: boolean;
		readonly reviewReady: boolean;
		readonly paths: readonly string[];
		readonly counts: VibeCodexDiffValidationResponse['counts'];
		readonly validationErrors: readonly string[];
		readonly warnings: readonly string[];
		readonly repairHints?: readonly string[];
		readonly files?: VibeCodexDiffValidationResponse['files'];
		readonly payload?: unknown;
	};
	readonly reapplyReady: boolean;
	readonly route: VibeCodexDiffReapplyRoute;
	readonly blockers: readonly string[];
	readonly nextAction: string;
	readonly promptBlock: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexDiffReapplyStatusInput {
	readonly review?: ExternalDiffReview;
	readonly path?: string;
	readonly taskCheckpointId?: string;
	readonly fileCheckpoints?: readonly { readonly path: string; readonly id: string }[];
}

const diffReapplyStatusMethods = new Set([
	'agent/getDiffReapplyStatus',
	'agent/diffReapplyStatus',
	'agent/getDiffRepairStatus',
	'diff/reapplyStatus',
	'diff/reapply/status',
	'diff/repairStatus',
	'diff/repair/status',
	'vibecodex/diffReapplyStatus',
]);

const diffReapplyStatusToolNames = new Set([
	'diff_reapply_status',
	'reapply_diff_status',
	'diff_repair_status',
	'patch_reapply_status',
	'edit_reapply_status',
]);

export function normalizeDiffReapplyStatusRequest(message: JsonRpcMessage): VibeCodexDiffReapplyStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const directParams = parseMaybeJson(message.params);
	const payload = isRecord(directParams) ? directParams : {};
	const args = argumentRecord(payload);
	if (!diffReapplyStatusMethods.has(message.method) && !isDiffReapplyStatusToolCall(message.method, payload, args)) {
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
	const candidate = extractCandidateDiff(directParams, payload, args);
	return {
		id: message.id,
		method: message.method,
		...(path ? { path: normalizePath(path) } : {}),
		candidate,
		candidatePresent: candidate !== undefined,
		includeCandidate: booleanValue(payload.includeCandidate)
			?? booleanValue(payload.include_candidate)
			?? booleanValue(args.includeCandidate)
			?? booleanValue(args.include_candidate)
			?? false,
		includePatchPreviews: booleanValue(payload.includePatchPreviews)
			?? booleanValue(payload.include_patch_previews)
			?? booleanValue(args.includePatchPreviews)
			?? booleanValue(args.include_patch_previews)
			?? false,
		includeRepairHints: booleanValue(payload.includeRepairHints)
			?? booleanValue(payload.include_repair_hints)
			?? booleanValue(args.includeRepairHints)
			?? booleanValue(args.include_repair_hints)
			?? true,
		includeActiveFile: booleanValue(payload.includeActiveFile)
			?? booleanValue(payload.include_active_file)
			?? booleanValue(args.includeActiveFile)
			?? booleanValue(args.include_active_file)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createDiffReapplyStatusResponse(request: VibeCodexDiffReapplyStatusRequest, input: VibeCodexDiffReapplyStatusInput): VibeCodexDiffReapplyStatusResponse {
	const validation = createDiffValidationResponse({
		id: request.id,
		method: request.method,
		candidate: request.candidate,
		candidatePresent: request.candidatePresent,
		includeCandidate: request.includeCandidate,
		includePatchPreviews: request.includePatchPreviews,
		includeRepairHints: request.includeRepairHints,
		requestedAt: request.requestedAt,
	});
	const candidatePaths = uniqueNormalizedPaths(candidatePathsFrom(request.candidate));
	const targetPath = request.path ?? input.path ?? (candidatePaths.length === 1 ? candidatePaths[0] : undefined);
	const checkpoints = new Map((input.fileCheckpoints ?? []).map(checkpoint => [normalizePath(checkpoint.path), checkpoint.id]));
	const activeFile = findActiveFile(input.review, targetPath);
	const activeReview = activeReviewState(input.review, activeFile, targetPath);
	const activeFileModel = activeFile ? activeFileStatus(activeFile, checkpoints) : undefined;
	const blockers = createBlockers(request, validation, candidatePaths, targetPath, input.review, activeFileModel);
	const route = createRoute(request, validation, blockers, input.review, activeFileModel, targetPath);
	const reapplyReady = request.candidatePresent && validation.valid && blockers.length === 0;
	const responseWithoutPrompt = {
		ok: request.candidatePresent,
		source: 'externalExtension' as const,
		version: 1 as const,
		...(targetPath ? { targetPath: redactSensitiveText(targetPath) } : {}),
		activeReview,
		...(request.includeActiveFile && activeFileModel ? { activeFile: activeFileModel } : {}),
		candidate: {
			present: request.candidatePresent,
			valid: validation.valid,
			reviewReady: validation.reviewReady,
			paths: candidatePaths.map(redactSensitiveText),
			counts: validation.counts,
			validationErrors: validation.validationErrors,
			warnings: validation.warnings,
			...(request.includeRepairHints ? { repairHints: validation.repairHints ?? [] } : {}),
			...(request.includePatchPreviews ? { files: validation.files } : {}),
			...(request.includeCandidate && validation.candidate !== undefined ? { payload: validation.candidate } : {}),
		},
		reapplyReady,
		route,
		blockers: blockers.map(redactSensitiveText),
		nextAction: nextAction(route, reapplyReady),
		guardrails: diffReapplyStatusGuardrails,
		message: diffReapplyMessage(reapplyReady, route, blockers, validation),
	};
	return {
		...responseWithoutPrompt,
		promptBlock: diffReapplyStatusPromptBlock(responseWithoutPrompt),
	};
}

export function diffReapplyStatusSummary(response: VibeCodexDiffReapplyStatusResponse): string {
	return `${response.message} Next: ${response.nextAction}`;
}

const diffReapplyStatusGuardrails = [
	'Diff reapply status is read-only and never creates review cards, replaces active review files, writes files, accepts/rejects diffs, restores checkpoints, stages, commits, or unlocks execution.',
	'Reapply readiness only means a revised candidate can be submitted through the normal review-first edit/diff path; the visible Diff Review UI, exact visual-plan authorization, workspace sandbox, and checkpoints still gate mutation.',
	'Candidate payloads, patch previews, active paths, checkpoint ids, blockers, and prompt blocks are redacted before they are returned to the backend.',
];

function createBlockers(
	request: VibeCodexDiffReapplyStatusRequest,
	validation: VibeCodexDiffValidationResponse,
	candidatePaths: readonly string[],
	targetPath: string | undefined,
	review: ExternalDiffReview | undefined,
	activeFile: VibeCodexDiffReapplyActiveFile | undefined,
): readonly string[] {
	const blockers: string[] = [];
	if (!request.candidatePresent) {
		blockers.push('No candidate diff payload was provided.');
	}
	if (candidatePaths.length > 1) {
		blockers.push('Focused diff reapply status expects exactly one candidate file path; use diff_validate or submit a new multi-file diff review instead.');
	}
	if (!targetPath && review && review.files.length > 1) {
		blockers.push('Target path is ambiguous because the active diff review contains multiple files and no candidate/request path resolved to one file.');
	}
	if (!validation.valid) {
		blockers.push(...validation.validationErrors.slice(0, 5));
	}
	if (activeFile?.status === 'accepted' && !activeFile.hasCheckpoint) {
		blockers.push('Accepted active file is missing checkpoint coverage; repair rollback readiness before replacing or re-reviewing it.');
	}
	return blockers;
}

function createRoute(
	request: VibeCodexDiffReapplyStatusRequest,
	validation: VibeCodexDiffValidationResponse,
	blockers: readonly string[],
	review: ExternalDiffReview | undefined,
	activeFile: VibeCodexDiffReapplyActiveFile | undefined,
	targetPath: string | undefined,
): VibeCodexDiffReapplyRoute {
	if (!request.candidatePresent) {
		return 'provide_candidate';
	}
	if (!validation.valid) {
		return 'repair_candidate';
	}
	if (!targetPath && review && review.files.length > 1) {
		return 'choose_active_path';
	}
	if (blockers.length) {
		return activeFile?.status === 'accepted' ? 'restore_or_resubmit' : 'blocked';
	}
	if (!review || !activeFile) {
		return 'submit_new_review';
	}
	if (activeFile.status === 'pending') {
		return 'replace_pending_review_file';
	}
	return 'submit_revised_review_file';
}

function nextAction(route: VibeCodexDiffReapplyRoute, reapplyReady: boolean): string {
	if (!reapplyReady) {
		if (route === 'provide_candidate') {
			return 'Send one candidate file diff with path plus proposedText/content, unified patch, or SEARCH/REPLACE blocks.';
		}
		if (route === 'choose_active_path') {
			return 'Choose an active diff file path or include a single candidate file path, then request diff_reapply_status again.';
		}
		if (route === 'repair_candidate') {
			return 'Repair the candidate diff using validationErrors and repairHints before submitting it to the review-first edit path.';
		}
		return 'Resolve blockers, then re-run diff_reapply_status before sending a replacement edit/diff tool call.';
	}
	if (route === 'replace_pending_review_file') {
		return 'Submit the revised edit through the normal edit/diff tool path so Vibe Codex replaces it with a new review card for user approval.';
	}
	if (route === 'submit_revised_review_file') {
		return 'Submit the revised edit through the normal review-first path; accepted/rejected state still requires visible user review.';
	}
	return 'Submit the candidate as a new review-first diff; no workspace mutation happens until the user accepts the rendered diff.';
}

function diffReapplyMessage(
	reapplyReady: boolean,
	route: VibeCodexDiffReapplyRoute,
	blockers: readonly string[],
	validation: VibeCodexDiffValidationResponse,
): string {
	if (reapplyReady) {
		return `Candidate diff is reapply-ready through route ${route}.`;
	}
	if (!validation.candidatePresent) {
		return 'No candidate diff payload was provided for reapply status.';
	}
	return `Candidate diff is not reapply-ready: ${blockers[0] ?? validation.message}`;
}

function activeReviewState(review: ExternalDiffReview | undefined, activeFile: ExternalDiffFile | undefined, targetPath: string | undefined): VibeCodexDiffReapplyStatusResponse['activeReview'] {
	if (!review) {
		return {
			available: false,
			files: 0,
			pending: 0,
			accepted: 0,
			rejected: 0,
			matched: false,
		};
	}
	return {
		available: true,
		reviewId: redactSensitiveText(review.reviewId),
		files: review.files.length,
		pending: review.files.filter(file => file.status === 'pending').length,
		accepted: review.files.filter(file => file.status === 'accepted').length,
		rejected: review.files.filter(file => file.status === 'rejected').length,
		matched: !!activeFile,
		...(!activeFile || !targetPath ? { siblings: review.files.map(file => redactSensitiveText(file.path)).slice(0, 80) } : {}),
	};
}

function activeFileStatus(file: ExternalDiffFile, checkpoints: ReadonlyMap<string, string>): VibeCodexDiffReapplyActiveFile {
	const checkpointId = checkpoints.get(normalizePath(file.path));
	return {
		path: redactSensitiveText(file.path),
		status: file.status,
		kind: diffKind(file),
		hasCheckpoint: !!checkpointId,
		...(checkpointId ? { checkpointId: redactSensitiveText(checkpointId) } : {}),
	};
}

function findActiveFile(review: ExternalDiffReview | undefined, targetPath: string | undefined): ExternalDiffFile | undefined {
	if (!review) {
		return undefined;
	}
	if (!targetPath && review.files.length === 1) {
		return review.files[0];
	}
	if (!targetPath) {
		return undefined;
	}
	const normalized = normalizePath(targetPath).toLowerCase();
	return review.files.find(file => normalizePath(file.path).toLowerCase() === normalized);
}

function diffKind(file: ExternalDiffFile): VibeCodexDiffReapplyActiveFile['kind'] {
	if (file.proposedText !== undefined) {
		return 'whole_file';
	}
	if (file.replacements?.length) {
		return 'search_replace';
	}
	return file.patch.includes('@@') ? 'unified_diff' : 'unknown';
}

function diffReapplyStatusPromptBlock(response: Omit<VibeCodexDiffReapplyStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'diff_reapply_status',
		targetPath: response.targetPath,
		route: response.route,
		reapplyReady: response.reapplyReady,
		activeReview: response.activeReview,
		activeFile: response.activeFile,
		candidate: response.candidate,
		blockers: response.blockers,
		nextAction: response.nextAction,
		note: 'Diff reapply status is read-only. Do not replace review cards, accept, reject, restore, write, or claim workspace changes from this status response.',
	}), null, 2);
}

function extractCandidateDiff(directParams: unknown, payload: Record<string, unknown>, args: Record<string, unknown>): unknown {
	const named = firstDefined(
		args.diff,
		args.review,
		args.candidate,
		args.candidateDiff,
		args.candidate_diff,
		payload.diff,
		payload.review,
		payload.candidate,
		payload.candidateDiff,
		payload.candidate_diff,
	);
	if (named !== undefined) {
		return parseMaybeJson(named);
	}
	if (isLikelyDiffRecord(args)) {
		return args;
	}
	if (isLikelyDiffRecord(payload)) {
		return payload;
	}
	const parsed = parseMaybeJson(directParams);
	return isRecord(parsed) && isLikelyDiffRecord(parsed) ? parsed : undefined;
}

function candidatePathsFrom(candidate: unknown): readonly string[] {
	const parsed = parseMaybeJson(candidate);
	if (!isRecord(parsed)) {
		return [];
	}
	const paths = new Set<string>();
	const directPath = recordPath(parsed);
	if (directPath) {
		paths.add(directPath);
	}
	for (const key of ['files', 'changes']) {
		const records = arrayRecords(parsed[key]) ?? [];
		for (const record of records) {
			const path = recordPath(record);
			if (path) {
				paths.add(path);
			}
		}
	}
	const fileChanges = isRecord(parsed.fileChanges) ? parsed.fileChanges : isRecord(parsed.file_changes) ? parsed.file_changes : undefined;
	if (fileChanges) {
		for (const path of Object.keys(fileChanges)) {
			if (path.trim()) {
				paths.add(path);
			}
		}
	}
	return [...paths];
}

function uniqueNormalizedPaths(paths: readonly string[]): readonly string[] {
	const result = new Map<string, string>();
	for (const path of paths) {
		const normalized = normalizePath(path);
		if (normalized) {
			result.set(normalized.toLowerCase(), normalized);
		}
	}
	return [...result.values()];
}

function isDiffReapplyStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return diffReapplyStatusToolNames.has(tool);
}

function isLikelyDiffRecord(value: Record<string, unknown>): boolean {
	return Array.isArray(value.files)
		|| Array.isArray(value.changes)
		|| isRecord(value.fileChanges)
		|| isRecord(value.file_changes)
		|| (!!recordPath(value) && (typeof value.patch === 'string' || typeof value.diff === 'string' || typeof value.proposedText === 'string' || typeof value.proposed_text === 'string' || typeof value.content === 'string' || typeof value.contents === 'string'));
}

function recordPath(value: Record<string, unknown>): string | undefined {
	return stringValue(value.path)
		?? stringValue(value.file)
		?? stringValue(value.filePath)
		?? stringValue(value.file_path)
		?? stringValue(value.targetFile)
		?? stringValue(value.target_file)
		?? stringValue(value.targetPath)
		?? stringValue(value.target_path);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const text = value.trim();
	if (!text || !/^[\[{"]/.test(text)) {
		return value;
	}
	try {
		return JSON.parse(text);
	} catch {
		return value;
	}
}

function firstDefined(...values: readonly unknown[]): unknown {
	return values.find(value => value !== undefined);
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

function arrayRecords(value: unknown): readonly Record<string, unknown>[] | undefined {
	return Array.isArray(value) ? value.filter(isRecord) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
