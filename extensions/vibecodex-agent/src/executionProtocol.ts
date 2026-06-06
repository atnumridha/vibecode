/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VibeCodexCommandPermissionPolicy, evaluateCommandPermission, isDangerousCommand as builtInDangerousCommand } from './commandPermissions';
import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexSearchReplaceBlock, parseSearchReplaceBlocks } from './searchReplaceEdits';

export type ApprovalKind = 'terminal' | 'file' | 'tool' | 'generic';
export type ApprovalDecision = 'accept' | 'decline';
export type DiffFileStatus = 'pending' | 'accepted' | 'rejected';

export interface ExternalApprovalCard {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: ApprovalKind;
	readonly title: string;
	readonly description: string;
	readonly detail?: string;
	readonly toolName?: string;
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly previewTargetId?: string;
	readonly previewUrl?: string;
	readonly previewLabel?: string;
	readonly parallelWorktreeOperation?: 'prepare' | 'cleanup';
	readonly parallelTaskId?: string;
	readonly parallelDispatchTaskId?: string;
	readonly parallelDispatchThreadId?: string;
	readonly parallelDispatchBranchName?: string;
	readonly parallelDispatchWorktreePath?: string;
	readonly parallelDispatchPromptFocus?: string;
	readonly paths: readonly string[];
	readonly risk: 'low' | 'medium' | 'high' | 'blocked';
	readonly blocked: boolean;
	readonly requestedAt: number;
}

export interface ExternalDiffFile {
	readonly path: string;
	readonly patch: string;
	readonly previousText?: string;
	readonly proposedText?: string;
	readonly replacements?: readonly ExternalSearchReplaceBlock[];
	readonly status: DiffFileStatus;
}

export type ExternalSearchReplaceBlock = VibeCodexSearchReplaceBlock;
export { parseSearchReplaceBlocks };

export interface ExternalDiffReview {
	readonly reviewId: string;
	readonly threadId?: string;
	readonly createdAt: number;
	readonly files: readonly ExternalDiffFile[];
}

export interface ExternalTerminalRunRequest {
	readonly id?: JsonRpcId;
	readonly method: string;
	readonly commandLine: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly verificationCheckId?: string;
}

export interface ExternalEditToolDiffResponse {
	readonly acceptedForReview: boolean;
	readonly applied: false;
	readonly source: 'externalExtension';
	readonly reviewId: string;
	readonly files: readonly string[];
	readonly message: string;
}

const approvalMethods = new Set([
	'agent/requestToolApproval',
	'item/commandExecution/requestApproval',
	'item/fileChange/requestApproval',
	'applyPatchApproval',
	'apply_patch_approval_request',
	'execCommandApproval',
	'exec_approval_request',
]);

const terminalRunMethods = new Set([
	'agent/runTerminal',
	'agent/terminal/run',
	'terminal/run',
	'command/exec/run',
]);

const diffMethods = new Set([
	'diff/submit',
	'agent/submitDiff',
	'agent/diffReview',
	'turn/diff/updated',
	'item/fileChange/patchUpdated',
	'codex/event/turn_diff',
	'codex/event/patch_apply_end',
]);

const editToolNames = new Set([
	'write_file',
	'write_to_file',
	'edit_file',
	'replace_in_file',
	'apply_patch',
	'patch_file',
	'remove_file',
]);

const editorReadActions = new Set(['read', 'read_file', 'read_files', 'view', 'view_file', 'open', 'open_file', 'inspect', 'show']);
const editorWriteActions = new Set(['edit', 'edit_file', 'write', 'write_file', 'replace', 'replace_in_file', 'create', 'create_file', 'append', 'insert', 'update', 'modify', 'patch', 'apply_patch', 'delete', 'delete_file', 'remove', 'remove_file', 'save']);

const terminalToolNames = new Set([
	'execute_command',
	'terminal',
	'bash',
	'shell',
	'run_command',
	'run_commands',
	'run_in_terminal',
]);

export function normalizeApprovalRequest(message: JsonRpcMessage, commandPolicy?: VibeCodexCommandPermissionPolicy): ExternalApprovalCard | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	if (!approvalMethods.has(message.method) && !(message.method === 'item/tool/call' && isMutatingToolCall(message.params))) {
		return undefined;
	}

	const payload = isRecord(message.params) ? message.params : {};
	const commandLine = extractCommandLine(payload);
	const paths = extractPaths(payload);
	const kind = classifyApproval(message.method, payload, commandLine, paths);
	const commandDecision = kind === 'terminal' && commandLine ? evaluateCommandPermission(commandLine, commandPolicy) : undefined;
	const blocked = commandDecision?.blocked ?? false;
	const risk = blocked ? 'blocked' : kind === 'file' ? 'high' : kind === 'terminal' ? 'medium' : 'low';
	const toolName = stringValue(payload.tool) ?? stringValue(payload.name);
	const args = argumentRecord(payload);
	const cwd = stringValue(payload.cwd) ?? stringValue(args.cwd) ?? stringValue(payload.workingDirectory) ?? stringValue(args.workingDirectory);
	const reason = stringValue(payload.reason) ?? stringValue(payload.description) ?? stringValue(args.reason) ?? stringValue(args.description);

	return {
		id: message.id,
		method: message.method,
		kind,
		title: kind === 'terminal' ? 'Terminal approval' : kind === 'file' ? 'File change approval' : 'Tool approval',
		description: reason ?? commandLine ?? paths.join(', ') ?? toolName ?? message.method,
		detail: [
			toolName ? `Tool: ${toolName}` : undefined,
			commandLine ? `Command: ${commandLine}` : undefined,
			paths.length ? `Paths: ${paths.join(', ')}` : undefined,
			commandDecision ? commandDecision.reason : undefined,
		].filter((value): value is string => !!value).join('\n') || undefined,
		...(toolName ? { toolName } : {}),
		commandLine,
		...(cwd ? { cwd } : {}),
		...(reason ? { reason } : {}),
		paths,
		risk,
		blocked,
		requestedAt: Date.now(),
	};
}

export function createApprovalResponse(card: ExternalApprovalCard, decision: ApprovalDecision): unknown {
	const approved = decision === 'accept' && !card.blocked;
	if (card.method === 'applyPatchApproval' || card.method === 'apply_patch_approval_request' || card.method === 'execCommandApproval' || card.method === 'exec_approval_request') {
		return { decision: approved ? 'approved' : 'denied' };
	}
	return {
		decision: approved ? 'accept' : 'decline',
		approved,
		source: 'externalExtension',
	};
}

export function isLocalDeleteFileApproval(card: ExternalApprovalCard): boolean {
	const tool = card.toolName?.toLowerCase();
	return card.method === 'item/tool/call' && (tool === 'delete_file' || tool === 'remove_file') && card.paths.length > 0;
}

export function isLocalTerminalToolApproval(card: ExternalApprovalCard): boolean {
	return card.method === 'item/tool/call'
		&& card.kind === 'terminal'
		&& !!card.commandLine
		&& terminalToolNames.has(card.toolName?.toLowerCase() ?? '');
}

export function isLocalParallelWorktreeApproval(card: ExternalApprovalCard): boolean {
	return card.kind === 'tool'
		&& (card.parallelWorktreeOperation === 'prepare' || card.parallelWorktreeOperation === 'cleanup')
		&& (card.toolName === 'prepare_parallel_worktrees' || card.toolName === 'cleanup_parallel_worktrees');
}

export function isLocalParallelLaneDispatchApproval(card: ExternalApprovalCard): boolean {
	return card.kind === 'terminal'
		&& card.toolName === 'dispatch_parallel_lane'
		&& !!card.parallelDispatchTaskId
		&& !!card.parallelDispatchThreadId
		&& !!card.commandLine
		&& !!card.cwd;
}

export function normalizeDiffReview(message: JsonRpcMessage): ExternalDiffReview | undefined {
	if (!message.method || !diffMethods.has(message.method)) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const files = extractDiffFiles(payload);
	if (!files.length) {
		return undefined;
	}
	const threadId = stringValue(payload.threadId) ?? stringValue(payload.thread_id) ?? stringValue(payload.conversationId) ?? stringValue(payload.conversation_id);
	const turnId = stringValue(payload.turnId) ?? stringValue(payload.turn_id) ?? stringValue(payload.callId) ?? stringValue(payload.call_id) ?? String(Date.now());
	return {
		reviewId: stringValue(payload.reviewId) ?? `${message.method}:${threadId ?? 'thread'}:${turnId}`,
		...(threadId ? { threadId } : {}),
		createdAt: Date.now(),
		files,
	};
}

export function normalizeEditToolDiffReview(message: JsonRpcMessage): ExternalDiffReview | undefined {
	if (!message.method || message.method !== 'item/tool/call') {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const toolName = (stringValue(payload.tool) ?? stringValue(payload.name) ?? '').toLowerCase();
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	if (!isEditToolCall(toolName, payload, args)) {
		return undefined;
	}
	const files = dedupeFiles([
		...extractDiffFiles(payload),
		...extractDiffFiles(args),
		...extractWholeTextFiles(payload),
		...extractWholeTextFiles(args),
		...extractSearchReplaceFiles(payload),
		...extractSearchReplaceFiles(args),
	]);
	if (!files.length) {
		return undefined;
	}
	const callId = message.id !== undefined ? String(message.id) : String(Date.now());
	return {
		reviewId: `tool:${toolName}:${callId}`,
		createdAt: Date.now(),
		files,
	};
}

export function createDiffReviewResponse(review: ExternalDiffReview): ExternalEditToolDiffResponse {
	return {
		acceptedForReview: true,
		applied: false,
		source: 'externalExtension',
		reviewId: review.reviewId,
		files: review.files.map(file => file.path),
		message: 'Diff review was accepted into the Vibe Codex review UI. No workspace files were modified until the user accepts the reviewed diff.',
	};
}

export function createEditToolDiffResponse(review: ExternalDiffReview): ExternalEditToolDiffResponse {
	return {
		...createDiffReviewResponse(review),
		message: 'File changes were converted into a Vibe Codex diff review. No workspace files were modified until the user accepts the reviewed diff.',
	};
}

export function normalizeTerminalRunRequest(message: JsonRpcMessage): ExternalTerminalRunRequest | undefined {
	if (!message.method || (!terminalRunMethods.has(message.method) && !(message.method === 'item/tool/call' && isTerminalToolCall(message.params)))) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	const commandLine = extractCommandLine(payload);
	if (!commandLine) {
		return undefined;
	}
	return {
		...(message.id !== undefined ? { id: message.id } : {}),
		method: message.method,
		commandLine,
		...(stringValue(payload.cwd) ?? stringValue(args.cwd) ? { cwd: stringValue(payload.cwd) ?? stringValue(args.cwd) } : {}),
		...(stringValue(payload.reason) ?? stringValue(args.reason) ?? stringValue(payload.description) ?? stringValue(args.description) ? { reason: stringValue(payload.reason) ?? stringValue(args.reason) ?? stringValue(payload.description) ?? stringValue(args.description) } : {}),
		...(stringValue(payload.verificationCheckId) ?? stringValue(payload.verification_check_id) ?? stringValue(args.verificationCheckId) ?? stringValue(args.verification_check_id) ? { verificationCheckId: stringValue(payload.verificationCheckId) ?? stringValue(payload.verification_check_id) ?? stringValue(args.verificationCheckId) ?? stringValue(args.verification_check_id) } : {}),
	};
}

export function withDiffFileDecision(review: ExternalDiffReview, path: string, status: DiffFileStatus): ExternalDiffReview {
	return {
		...review,
		files: review.files.map(file => file.path === path ? { ...file, status } : file),
	};
}

export function isDangerousCommand(commandLine: string): boolean {
	return builtInDangerousCommand(commandLine);
}

function classifyApproval(method: string, payload: Record<string, unknown>, commandLine: string | undefined, paths: readonly string[]): ApprovalKind {
	if (method.includes('command') || method.includes('exec') || commandLine) {
		return 'terminal';
	}
	if (method.includes('file') || method.includes('patch') || paths.length || extractDiffFiles(payload).length) {
		return 'file';
	}
	if (method === 'item/tool/call' || method === 'agent/requestToolApproval') {
		return 'tool';
	}
	return 'generic';
}

function isMutatingToolCall(params: unknown): boolean {
	const payload = isRecord(params) ? params : {};
	const args = argumentRecord(payload);
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? '').toLowerCase();
	return terminalToolNames.has(tool) || ['write_file', 'write_to_file', 'edit_file', 'replace_in_file', 'delete_file', 'remove_file', 'apply_patch', 'patch_file'].includes(tool) || isEditorWriteToolCall(tool, payload, args);
}

function isTerminalToolCall(params: unknown): boolean {
	const payload = isRecord(params) ? params : {};
	const args = argumentRecord(payload);
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return terminalToolNames.has(tool);
}

function extractCommandLine(payload: Record<string, unknown>): string | undefined {
	const args = argumentRecord(payload);
	const direct = stringValue(payload.commandLine)
		?? stringValue(payload.command)
		?? stringValue(payload.cmd)
		?? stringValue(payload.shellCommand)
		?? stringValue(payload.command_line)
		?? stringValue(args?.commandLine)
		?? stringValue(args?.command)
		?? stringValue(args?.cmd)
		?? stringValue(args?.shellCommand)
		?? stringValue(args?.command_line);
	if (direct) {
		return direct;
	}
	const commands = arrayOfStrings(payload.commands) ?? arrayOfStrings(args?.commands);
	if (commands?.length) {
		return commands.join(' && ');
	}
	const command = stringValue(payload.executable) ?? stringValue(args?.executable);
	const argv = arrayOfStrings(payload.argv) ?? arrayOfStrings(payload.args) ?? arrayOfStrings(args?.argv);
	return command ? [command, ...(argv ?? [])].join(' ') : undefined;
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function extractPaths(payload: Record<string, unknown>): readonly string[] {
	const paths = new Set<string>();
	for (const key of ['path', 'file', 'filePath', 'file_path', 'targetFile', 'target_file', 'targetPath', 'target_path']) {
		const value = stringValue(payload[key]);
		if (value) {
			paths.add(value);
		}
	}
	for (const key of ['paths', 'files']) {
		for (const value of arrayOfStrings(payload[key]) ?? []) {
			paths.add(value);
		}
	}
	const args = isRecord(payload.arguments) ? payload.arguments : undefined;
	if (args) {
		for (const value of extractPaths(args)) {
			paths.add(value);
		}
	}
	for (const file of extractDiffFiles(payload)) {
		paths.add(file.path);
	}
	return [...paths];
}

function extractDiffFiles(payload: Record<string, unknown>): readonly ExternalDiffFile[] {
	const files: ExternalDiffFile[] = [];
	const changes = Array.isArray(payload.changes) ? payload.changes : Array.isArray(payload.files) ? payload.files : [];
	for (const change of changes) {
		if (!isRecord(change)) {
			continue;
		}
		const path = extractSinglePath(change);
		const patch = stringValue(change.patch) ?? stringValue(change.diff) ?? stringValue(change.unified_diff);
		if (path && patch) {
			files.push({
				path,
				patch,
				...extractTextPayload(change),
				status: 'pending',
			});
		}
	}

	const fileChanges = isRecord(payload.fileChanges) ? payload.fileChanges : isRecord(payload.file_changes) ? payload.file_changes : undefined;
	if (fileChanges) {
		for (const [path, change] of Object.entries(fileChanges)) {
			const patch = typeof change === 'string'
				? change
				: isRecord(change)
					? stringValue(change.patch) ?? stringValue(change.diff) ?? stringValue(change.unified_diff)
					: undefined;
			if (patch) {
				files.push({
					path,
					patch,
					...(isRecord(change) ? extractTextPayload(change) : {}),
					status: 'pending',
				});
			}
		}
	}

	const path = extractSinglePath(payload);
	const patch = stringValue(payload.patch) ?? stringValue(payload.diff);
	if (path && patch) {
		files.push({
			path,
			patch,
			...extractTextPayload(payload),
			status: 'pending',
		});
	}
	const unified = stringValue(payload.diff);
	if (!path && unified?.includes('diff --git ')) {
		files.push(...splitUnifiedDiff(unified));
	}
	return dedupeFiles(files);
}

function extractWholeTextFiles(payload: Record<string, unknown>): readonly ExternalDiffFile[] {
	const files: ExternalDiffFile[] = [];
	for (const change of arrayOfRecords(payload.files) ?? []) {
		const file = wholeTextFile(change);
		if (file) {
			files.push(file);
		}
	}
	for (const change of arrayOfRecords(payload.changes) ?? []) {
		const file = wholeTextFile(change);
		if (file) {
			files.push(file);
		}
	}
	const fileChanges = isRecord(payload.fileChanges) ? payload.fileChanges : isRecord(payload.file_changes) ? payload.file_changes : undefined;
	if (fileChanges) {
		for (const [path, change] of Object.entries(fileChanges)) {
			if (!isRecord(change)) {
				continue;
			}
			const file = wholeTextFile({ ...change, path });
			if (file) {
				files.push(file);
			}
		}
	}
	const direct = wholeTextFile(payload);
	if (direct) {
		files.push(direct);
	}
	return dedupeFiles(files);
}

function extractSearchReplaceFiles(payload: Record<string, unknown>): readonly ExternalDiffFile[] {
	const files: ExternalDiffFile[] = [];
	for (const change of arrayOfRecords(payload.files) ?? []) {
		const file = searchReplaceFile(change);
		if (file) {
			files.push(file);
		}
	}
	for (const change of arrayOfRecords(payload.changes) ?? []) {
		const file = searchReplaceFile(change);
		if (file) {
			files.push(file);
		}
	}
	const fileChanges = isRecord(payload.fileChanges) ? payload.fileChanges : isRecord(payload.file_changes) ? payload.file_changes : undefined;
	if (fileChanges) {
		for (const [path, change] of Object.entries(fileChanges)) {
			if (!isRecord(change)) {
				continue;
			}
			const file = searchReplaceFile({ ...change, path });
			if (file) {
				files.push(file);
			}
		}
	}
	const direct = searchReplaceFile(payload);
	if (direct) {
		files.push(direct);
	}
	return dedupeFiles(files);
}

function wholeTextFile(payload: Record<string, unknown>): ExternalDiffFile | undefined {
	const path = extractSinglePath(payload);
	const text = extractTextPayload(payload);
	if (!path || text.proposedText === undefined) {
		return undefined;
	}
	return {
		path,
		patch: `Whole-file replacement proposed for ${path}.`,
		...text,
		status: 'pending',
	};
}

function searchReplaceFile(payload: Record<string, unknown>): ExternalDiffFile | undefined {
	const path = extractSinglePath(payload);
	const diff = textValue(payload.diff)
		?? textValue(payload.patch)
		?? textValue(payload.replacements)
		?? textValue(payload.searchReplace)
		?? textValue(payload.search_replace);
	if (!path || !diff) {
		return undefined;
	}
	const replacements = parseSearchReplaceBlocks(diff);
	if (!replacements.length) {
		return undefined;
	}
	return {
		path,
		patch: `SEARCH/REPLACE edit proposed for ${path} with ${replacements.length} block${replacements.length === 1 ? '' : 's'}.`,
		replacements,
		status: 'pending',
	};
}


function extractTextPayload(payload: Record<string, unknown>): Pick<ExternalDiffFile, 'previousText' | 'proposedText'> {
	const previousText = textValue(payload.previousText)
		?? textValue(payload.previous_text)
		?? textValue(payload.oldText)
		?? textValue(payload.old_text)
		?? textValue(payload.originalText)
		?? textValue(payload.original_text)
		?? textValue(payload.before);
	const proposedText = textValue(payload.proposedText)
		?? textValue(payload.proposed_text)
		?? textValue(payload.newText)
		?? textValue(payload.new_text)
		?? textValue(payload.content)
		?? textValue(payload.contents)
		?? textValue(payload.after);
	return {
		...(previousText !== undefined ? { previousText } : {}),
		...(proposedText !== undefined ? { proposedText } : {}),
	};
}

function isEditToolCall(toolName: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	return editToolNames.has(toolName) || isEditorWriteToolCall(toolName, payload, args);
}

function isEditorWriteToolCall(toolName: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (toolName !== 'editor') {
		return false;
	}
	const action = normalizeActionName(stringValue(payload.action) ?? stringValue(args.action) ?? stringValue(payload.operation) ?? stringValue(args.operation) ?? stringValue(payload.mode) ?? stringValue(args.mode));
	if (editorWriteActions.has(action ?? '')) {
		return true;
	}
	if (editorReadActions.has(action ?? '')) {
		return false;
	}
	return !action && hasFileMutationPayload(payload, args);
}

function hasFileMutationPayload(payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	const records = [
		payload,
		args,
		...(arrayOfRecords(payload.files) ?? []),
		...(arrayOfRecords(args.files) ?? []),
		...(arrayOfRecords(payload.changes) ?? []),
		...(arrayOfRecords(args.changes) ?? []),
	];
	return records.some(record => {
		const text = extractTextPayload(record);
		if (text.proposedText !== undefined) {
			return true;
		}
		for (const key of ['patch', 'diff', 'unified_diff', 'searchReplace', 'search_replace', 'replacements']) {
			if (textValue(record[key]) !== undefined) {
				return true;
			}
		}
		return isRecord(record.fileChanges) || isRecord(record.file_changes);
	});
}

function extractSinglePath(payload: Record<string, unknown>): string | undefined {
	return stringValue(payload.path)
		?? stringValue(payload.file)
		?? stringValue(payload.filePath)
		?? stringValue(payload.file_path)
		?? stringValue(payload.targetFile)
		?? stringValue(payload.target_file)
		?? stringValue(payload.targetPath)
		?? stringValue(payload.target_path);
}

function normalizeActionName(value: string | undefined): string | undefined {
	return value?.toLowerCase().replace(/[\s-]+/g, '_');
}

function splitUnifiedDiff(diff: string): readonly ExternalDiffFile[] {
	const files: ExternalDiffFile[] = [];
	const lines = diff.split(/\r?\n/);
	let currentPath: string | undefined;
	let current: string[] = [];
	for (const line of lines) {
		const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
		if (match) {
			if (currentPath && current.length) {
				files.push({ path: currentPath, patch: current.join('\n'), status: 'pending' });
			}
			currentPath = match[2];
			current = [line];
			continue;
		}
		if (currentPath) {
			current.push(line);
		}
	}
	if (currentPath && current.length) {
		files.push({ path: currentPath, patch: current.join('\n'), status: 'pending' });
	}
	return files;
}

function dedupeFiles(files: readonly ExternalDiffFile[]): readonly ExternalDiffFile[] {
	const byPath = new Map<string, ExternalDiffFile>();
	for (const file of files) {
		if (!file.path.includes('..') && !/[\u0000\r\n]/.test(file.path)) {
			byPath.set(file.path, file);
		}
	}
	return [...byPath.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function textValue(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] | undefined {
	return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] | undefined {
	return Array.isArray(value) && value.every(isRecord) ? value : undefined;
}
