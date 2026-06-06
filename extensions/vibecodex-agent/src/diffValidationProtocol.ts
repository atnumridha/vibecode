/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexSearchReplaceBlock, applySearchReplaceBlocksToText, parseSearchReplaceBlocks } from './searchReplaceEdits';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexDiffValidationKind = 'whole_file' | 'unified_diff' | 'search_replace' | 'unknown';
export type VibeCodexDiffPathSafety = 'safe_relative' | 'needs_workspace_check' | 'blocked';

export interface VibeCodexDiffValidationRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly candidate: unknown;
	readonly candidatePresent: boolean;
	readonly includeCandidate: boolean;
	readonly includePatchPreviews: boolean;
	readonly includeRepairHints: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexDiffValidationFile {
	readonly path: string;
	readonly kind: VibeCodexDiffValidationKind;
	readonly valid: boolean;
	readonly pathSafety: VibeCodexDiffPathSafety;
	readonly hasPreviousText: boolean;
	readonly hasProposedText: boolean;
	readonly replacementCount: number;
	readonly requiresWorkspaceRead: boolean;
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
	readonly patchPreview?: string;
}

export interface VibeCodexDiffValidationResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly candidatePresent: boolean;
	readonly valid: boolean;
	readonly reviewReady: boolean;
	readonly reviewId?: string;
	readonly counts: {
		readonly files: number;
		readonly validFiles: number;
		readonly invalidFiles: number;
		readonly wholeFile: number;
		readonly unifiedDiff: number;
		readonly searchReplace: number;
		readonly duplicatePaths: number;
		readonly warnings: number;
	};
	readonly files: readonly VibeCodexDiffValidationFile[];
	readonly validationErrors: readonly string[];
	readonly warnings: readonly string[];
	readonly repairHints?: readonly string[];
	readonly candidate?: unknown;
	readonly promptBlock: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

interface CandidateDiffFile {
	readonly path?: string;
	readonly patch?: string;
	readonly previousText?: string;
	readonly proposedText?: string;
	readonly replacements?: readonly VibeCodexSearchReplaceBlock[];
}

const diffValidationMethods = new Set([
	'agent/validateDiff',
	'agent/diffValidation',
	'diff/validate',
	'diff/validation',
	'patch/validate',
	'vibecodex/validateDiff',
]);

const diffValidationToolNames = new Set([
	'diff_validate',
	'validate_diff',
	'patch_validate',
	'validate_patch',
	'edit_validate',
]);

const maxPatchPreview = 2000;
const maxCandidateBytes = 400000;
const maxFiles = 80;

export function normalizeDiffValidationRequest(message: JsonRpcMessage): VibeCodexDiffValidationRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const directParams = parseMaybeJson(message.params);
	const payload = isRecord(directParams) ? directParams : {};
	const args = argumentRecord(payload);
	if (!diffValidationMethods.has(message.method) && !isDiffValidationToolCall(message.method, payload, args)) {
		return undefined;
	}
	const candidate = extractCandidateDiff(directParams, payload, args);
	return {
		id: message.id,
		method: message.method,
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
		requestedAt: Date.now(),
	};
}

export function createDiffValidationResponse(request: VibeCodexDiffValidationRequest): VibeCodexDiffValidationResponse {
	const candidateSize = safeJsonLength(request.candidate);
	const candidateFiles = request.candidatePresent ? extractCandidateFiles(request.candidate) : [];
	const duplicatePaths = duplicatePathCount(candidateFiles);
	const files = candidateFiles.slice(0, maxFiles).map(file => validateCandidateFile(file, request.includePatchPreviews));
	const validationErrors = [
		...(!request.candidatePresent ? ['No candidate diff payload was provided.'] : []),
		...(candidateSize > maxCandidateBytes ? [`Candidate diff payload exceeds ${maxCandidateBytes} JSON characters.`] : []),
		...(candidateFiles.length === 0 && request.candidatePresent ? ['Candidate diff payload must include at least one file change.'] : []),
		...(candidateFiles.length > maxFiles ? [`Candidate diff payload includes ${candidateFiles.length} files; maximum is ${maxFiles}.`] : []),
		...(duplicatePaths ? [`Candidate diff payload contains ${duplicatePaths} duplicate path${duplicatePaths === 1 ? '' : 's'}.`] : []),
		...files.flatMap(file => file.errors.map(error => `${file.path || '<missing path>'}: ${error}`)),
	];
	const warnings = files.flatMap(file => file.warnings.map(warning => `${file.path || '<missing path>'}: ${warning}`));
	const counts = {
		files: candidateFiles.length,
		validFiles: files.filter(file => file.valid).length,
		invalidFiles: files.filter(file => !file.valid).length,
		wholeFile: files.filter(file => file.kind === 'whole_file').length,
		unifiedDiff: files.filter(file => file.kind === 'unified_diff').length,
		searchReplace: files.filter(file => file.kind === 'search_replace').length,
		duplicatePaths,
		warnings: warnings.length,
	};
	const valid = request.candidatePresent && validationErrors.length === 0 && files.length > 0;
	const repairHints = request.includeRepairHints ? createRepairHints(validationErrors, warnings, files, request.candidatePresent) : undefined;
	const reviewId = recordString(request.candidate, 'reviewId') ?? recordString(request.candidate, 'review_id');
	const responseWithoutPrompt = {
		ok: request.candidatePresent,
		source: 'externalExtension' as const,
		candidatePresent: request.candidatePresent,
		valid,
		reviewReady: valid,
		...(reviewId ? { reviewId: redactSensitiveText(reviewId) } : {}),
		counts,
		files,
		validationErrors,
		warnings,
		...(repairHints ? { repairHints } : {}),
		...(request.includeCandidate ? { candidate: redactSensitiveValue(request.candidate) } : {}),
		guardrails: diffValidationGuardrails,
		message: diffValidationMessage(valid, request.candidatePresent, counts, validationErrors, warnings),
	};
	return {
		...responseWithoutPrompt,
		promptBlock: JSON.stringify(redactSensitiveValue({
			type: 'vibecodex.diffValidation',
			valid: responseWithoutPrompt.valid,
			reviewReady: responseWithoutPrompt.reviewReady,
			counts: responseWithoutPrompt.counts,
			files: responseWithoutPrompt.files,
			validationErrors: responseWithoutPrompt.validationErrors,
			warnings: responseWithoutPrompt.warnings,
			repairHints: responseWithoutPrompt.repairHints,
			note: 'Repair invalid patches, then submit edits through the normal diff review tool path. This validation result is not a diff acceptance, checkpoint restore, or execution approval.',
		}), null, 2),
	};
}

export function diffValidationSummary(response: VibeCodexDiffValidationResponse): string {
	return response.message;
}

const diffValidationGuardrails = [
	'Diff validation is read-only and never creates diff cards, writes files, accepts/rejects diffs, restores checkpoints, runs commands, or unlocks execution.',
	'Review readiness only means the candidate payload is structurally valid; accepted workspace writes still require exact visual-plan authorization, user diff acceptance, workspace sandbox checks, and checkpoints.',
	'Patch previews, candidate payloads, paths, and diagnostics are redacted before they are returned to the backend or shown in protocol diagnostics.',
];

function validateCandidateFile(file: CandidateDiffFile, includePatchPreview: boolean): VibeCodexDiffValidationFile {
	const errors: string[] = [];
	const warnings: string[] = [];
	const path = file.path?.trim() ?? '';
	const pathSafety = validatePath(path, errors, warnings);
	const hasPreviousText = typeof file.previousText === 'string';
	const hasProposedText = typeof file.proposedText === 'string';
	const replacements = file.replacements ?? [];
	const kind = diffKind(file);
	if (kind === 'unknown') {
		errors.push('File change must include proposedText/content, a unified diff patch, or SEARCH/REPLACE replacements.');
	}
	if (hasProposedText && !hasPreviousText) {
		warnings.push('Whole-file replacement omits previousText; apply-time baseline will be read from the workspace before checkpointing.');
	}
	if (file.patch && kind === 'unified_diff') {
		errors.push(...validateUnifiedPatch(file.patch));
	}
	if (replacements.length) {
		errors.push(...validateReplacements(replacements));
		if (hasPreviousText) {
			try {
				applySearchReplaceBlocksToText(replacements, file.previousText ?? '');
			} catch (error) {
				errors.push(error instanceof Error ? error.message : String(error));
			}
		} else {
			warnings.push('SEARCH/REPLACE exact-match validation requires previousText or a workspace read at review/apply time.');
		}
	}
	const requiresWorkspaceRead = !hasPreviousText && (kind === 'whole_file' || kind === 'search_replace' || kind === 'unified_diff');
	return {
		path: redactSensitiveText(path),
		kind,
		valid: errors.length === 0,
		pathSafety,
		hasPreviousText,
		hasProposedText,
		replacementCount: replacements.length,
		requiresWorkspaceRead,
		errors: errors.map(redactSensitiveText),
		warnings: warnings.map(redactSensitiveText),
		...(includePatchPreview && file.patch ? { patchPreview: preview(file.patch) } : {}),
	};
}

function validatePath(path: string, errors: string[], warnings: string[]): VibeCodexDiffPathSafety {
	if (!path) {
		errors.push('Path is required.');
		return 'blocked';
	}
	if (/[\u0000\r\n]/.test(path)) {
		errors.push('Path contains a forbidden control character or newline.');
		return 'blocked';
	}
	if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path) && !path.toLowerCase().startsWith('file:')) {
		errors.push('Path uses an unsupported URI scheme.');
		return 'blocked';
	}
	if (path.split(/[\\/]+/).some(segment => segment === '..')) {
		errors.push('Path must not contain parent-directory traversal segments.');
		return 'blocked';
	}
	if (path.startsWith('~')) {
		errors.push('Path must be workspace-relative or a file URI/absolute path inside an open workspace.');
		return 'blocked';
	}
	if (path.toLowerCase().startsWith('file:') || path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
		warnings.push('Absolute/file URI paths still require workspace-root and symlink traversal checks before review/apply.');
		return 'needs_workspace_check';
	}
	return 'safe_relative';
}

function validateUnifiedPatch(patch: string): readonly string[] {
	const errors: string[] = [];
	if (!patch.trim()) {
		return ['Unified diff patch is empty.'];
	}
	if (!/^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(patch)) {
		errors.push('Unified diff patch must include at least one @@ hunk header.');
	}
	const hunkLines = patch.split(/\r?\n/).filter(line => /^[ +\-\\]/.test(line));
	if (!hunkLines.some(line => line.startsWith('+')) && !hunkLines.some(line => line.startsWith('-'))) {
		errors.push('Unified diff patch must include at least one added or removed line.');
	}
	if (patch.length > maxCandidateBytes) {
		errors.push(`Unified diff patch exceeds ${maxCandidateBytes} characters.`);
	}
	return errors;
}

function validateReplacements(replacements: readonly VibeCodexSearchReplaceBlock[]): readonly string[] {
	const errors: string[] = [];
	for (const [index, replacement] of replacements.entries()) {
		if (!replacement.search.length) {
			errors.push(`SEARCH/REPLACE block ${index + 1} has an empty SEARCH section.`);
		}
		if (replacement.startLine !== undefined && (!Number.isInteger(replacement.startLine) || replacement.startLine < 1)) {
			errors.push(`SEARCH/REPLACE block ${index + 1} startLine must be a positive integer.`);
		}
	}
	return errors;
}

function createRepairHints(errors: readonly string[], warnings: readonly string[], files: readonly VibeCodexDiffValidationFile[], candidatePresent: boolean): readonly string[] {
	const hints = new Set<string>();
	if (!candidatePresent) {
		hints.add('Send the candidate diff in params.diff, params.review, params.files, tool arguments.diff, or as a direct file-change object.');
	}
	for (const error of errors) {
		if (/at least one file change|No candidate/.test(error)) {
			hints.add('Include at least one file object with path plus content/proposedText, patch/diff, or SEARCH/REPLACE blocks.');
		}
		if (/duplicate path/.test(error)) {
			hints.add('Merge duplicate edits for the same path into one file change before submitting a diff review.');
		}
		if (/Path/.test(error)) {
			hints.add('Use workspace-relative paths without parent-directory traversal, control characters, or unsupported URI schemes.');
		}
		if (/hunk header|Unified diff/.test(error)) {
			hints.add('For patch edits, send a standard unified diff with @@ hunk headers and added/removed lines.');
		}
		if (/SEARCH|ambiguous|does not match/.test(error)) {
			hints.add('For SEARCH/REPLACE edits, include a unique SEARCH block, optional :start_line: metadata, and previousText when possible.');
		}
	}
	if (warnings.some(warning => /workspace read|baseline|previousText/.test(warning))) {
		hints.add('Include previousText/originalText to let Vibe Codex validate baseline matches before creating a review card.');
	}
	if (files.some(file => file.pathSafety === 'needs_workspace_check')) {
		hints.add('Prefer workspace-relative paths; absolute/file URI paths will still be checked against workspace roots and symlinks later.');
	}
	return [...hints];
}

function diffValidationMessage(valid: boolean, candidatePresent: boolean, counts: VibeCodexDiffValidationResponse['counts'], errors: readonly string[], warnings: readonly string[]): string {
	if (!candidatePresent) {
		return 'No candidate diff payload was provided for validation.';
	}
	if (valid) {
		return `Candidate diff is ready for review with ${counts.files} file change${counts.files === 1 ? '' : 's'}${warnings.length ? ` and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.` : '.'}`;
	}
	return `Candidate diff is not review-ready: ${errors[0] ?? 'validation failed'}`;
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

function extractCandidateFiles(candidate: unknown): readonly CandidateDiffFile[] {
	const parsed = parseMaybeJson(candidate);
	if (!isRecord(parsed)) {
		return [];
	}
	const files: CandidateDiffFile[] = [];
	for (const item of arrayRecords(parsed.files) ?? []) {
		files.push(...fileFromRecord(item));
	}
	for (const item of arrayRecords(parsed.changes) ?? []) {
		files.push(...fileFromRecord(item));
	}
	const fileChanges = isRecord(parsed.fileChanges) ? parsed.fileChanges : isRecord(parsed.file_changes) ? parsed.file_changes : undefined;
	if (fileChanges) {
		for (const [path, change] of Object.entries(fileChanges)) {
			if (typeof change === 'string') {
				files.push({ path, patch: change });
				continue;
			}
			if (isRecord(change)) {
				files.push(...fileFromRecord({ ...change, path }));
			}
		}
	}
	files.push(...fileFromRecord(parsed));
	return files.filter(file => file.path || file.patch || file.proposedText !== undefined || file.replacements?.length);
}

function fileFromRecord(record: Record<string, unknown>): readonly CandidateDiffFile[] {
	if (isRecord(record.review)) {
		return extractCandidateFiles(record.review);
	}
	const path = extractPath(record);
	const patch = textValue(record.patch) ?? textValue(record.diff) ?? textValue(record.unified_diff);
	const text = extractTextPayload(record);
	const replacements = extractReplacements(record);
	if (!path && !patch && text.proposedText === undefined && !replacements.length) {
		return [];
	}
	return [{
		...(path ? { path } : {}),
		...(patch ? { patch } : {}),
		...text,
		...(replacements.length ? { replacements } : {}),
	}];
}

function extractReplacements(record: Record<string, unknown>): readonly VibeCodexSearchReplaceBlock[] {
	const direct = record.replacements ?? record.searchReplace ?? record.search_replace;
	if (typeof direct === 'string') {
		return parseSearchReplaceBlocks(direct);
	}
	if (Array.isArray(direct)) {
		return direct
			.filter(isRecord)
			.map((item): VibeCodexSearchReplaceBlock | undefined => {
				const search = textValue(item.search) ?? textValue(item.oldText) ?? textValue(item.old_text);
				if (search === undefined) {
					return undefined;
				}
				const replace = textValue(item.replace) ?? textValue(item.replacement) ?? textValue(item.newText) ?? textValue(item.new_text) ?? '';
				const startLine = numberValue(item.startLine) ?? numberValue(item.start_line);
				return {
					search,
					replace,
					...(startLine !== undefined ? { startLine } : {}),
				};
			})
			.filter((item): item is VibeCodexSearchReplaceBlock => !!item);
	}
	const search = textValue(record.search);
	if (search !== undefined) {
		const replace = textValue(record.replace) ?? textValue(record.replacement) ?? '';
		const startLine = numberValue(record.startLine) ?? numberValue(record.start_line);
		return [{
			search,
			replace,
			...(startLine !== undefined ? { startLine } : {}),
		}];
	}
	if (typeof record.patch === 'string' || typeof record.diff === 'string') {
		return parseSearchReplaceBlocks(String(record.patch ?? record.diff));
	}
	return [];
}

function extractTextPayload(record: Record<string, unknown>): Pick<CandidateDiffFile, 'previousText' | 'proposedText'> {
	const previousText = textValue(record.previousText)
		?? textValue(record.previous_text)
		?? textValue(record.oldText)
		?? textValue(record.old_text)
		?? textValue(record.originalText)
		?? textValue(record.original_text)
		?? textValue(record.before);
	const proposedText = textValue(record.proposedText)
		?? textValue(record.proposed_text)
		?? textValue(record.newText)
		?? textValue(record.new_text)
		?? textValue(record.content)
		?? textValue(record.contents)
		?? textValue(record.after);
	return {
		...(previousText !== undefined ? { previousText } : {}),
		...(proposedText !== undefined ? { proposedText } : {}),
	};
}

function diffKind(file: CandidateDiffFile): VibeCodexDiffValidationKind {
	if (file.replacements?.length) {
		return 'search_replace';
	}
	if (typeof file.proposedText === 'string') {
		return 'whole_file';
	}
	if (file.patch) {
		return 'unified_diff';
	}
	return 'unknown';
}

function duplicatePathCount(files: readonly CandidateDiffFile[]): number {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const file of files) {
		const normalized = file.path?.trim();
		if (!normalized) {
			continue;
		}
		if (seen.has(normalized)) {
			duplicates.add(normalized);
		}
		seen.add(normalized);
	}
	return duplicates.size;
}

function isDiffValidationToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name)
		?? '').toLowerCase();
	return diffValidationToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = parseMaybeJson(payload.arguments ?? payload.args ?? payload.input ?? payload.params);
	if (!isRecord(args)) {
		return payload;
	}
	const nested = parseMaybeJson(args.arguments ?? args.args ?? args.input);
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function extractPath(record: Record<string, unknown>): string | undefined {
	return stringValue(record.path)
		?? stringValue(record.file)
		?? stringValue(record.filePath)
		?? stringValue(record.file_path)
		?? stringValue(record.targetFile)
		?? stringValue(record.target_file)
		?? stringValue(record.targetPath)
		?? stringValue(record.target_path);
}

function arrayRecords(value: unknown): readonly Record<string, unknown>[] | undefined {
	return Array.isArray(value) ? value.filter(isRecord) : undefined;
}

function preview(value: string): string {
	const redacted = redactSensitiveText(value);
	return redacted.length > maxPatchPreview ? `${redacted.slice(0, maxPatchPreview)}\n[truncated]` : redacted;
}

function recordString(value: unknown, key: string): string | undefined {
	return isRecord(value) ? stringValue(value[key]) : undefined;
}

function firstDefined(...values: readonly unknown[]): unknown {
	return values.find(value => value !== undefined);
}

function isLikelyDiffRecord(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && (
		'files' in value
		|| 'changes' in value
		|| 'fileChanges' in value
		|| 'file_changes' in value
		|| 'path' in value
		|| 'file' in value
		|| 'patch' in value
		|| 'diff' in value
		|| 'content' in value
		|| 'replacements' in value
		|| 'searchReplace' in value
		|| 'search_replace' in value
	);
}

function safeJsonLength(value: unknown): number {
	try {
		return JSON.stringify(value)?.length ?? 0;
	} catch {
		return maxCandidateBytes + 1;
	}
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const trimmed = value.trim();
	if (!trimmed || !/^[{[]/.test(trimmed)) {
		return value;
	}
	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return value;
	}
}

function textValue(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
		return Number(value.trim());
	}
	return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
			return true;
		}
		if (normalized === 'false' || normalized === '0' || normalized === 'no') {
			return false;
		}
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
