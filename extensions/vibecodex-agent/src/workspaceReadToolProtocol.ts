/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';

export type VibeCodexWorkspaceReadToolKind = 'read_file' | 'list_dir' | 'search_files' | 'semantic_search';

export interface VibeCodexWorkspaceReadToolRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: VibeCodexWorkspaceReadToolKind;
	readonly path?: string;
	readonly paths: readonly string[];
	readonly query?: string;
	readonly filePattern?: string;
	readonly isRegex: boolean;
	readonly caseSensitive: boolean;
	readonly startLine?: number;
	readonly endLine?: number;
	readonly recursive: boolean;
	readonly maxResults: number;
	readonly requestedAt: number;
}

export interface VibeCodexWorkspaceReadToolResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly kind: VibeCodexWorkspaceReadToolKind;
	readonly path?: string;
	readonly query?: string;
	readonly files?: readonly VibeCodexReadFileResult[];
	readonly entries?: readonly VibeCodexDirectoryEntry[];
	readonly hits?: readonly VibeCodexSearchResult[];
	readonly truncated?: boolean;
	readonly error?: string;
}

export interface VibeCodexReadFileResult {
	readonly path: string;
	readonly text: string;
	readonly truncated: boolean;
	readonly startLine?: number;
	readonly endLine?: number;
	readonly totalLines?: number;
}

export interface VibeCodexDirectoryEntry {
	readonly path: string;
	readonly type: 'file' | 'directory' | 'symbolicLink' | 'unknown';
}

export interface VibeCodexSearchResult {
	readonly path: string;
	readonly line: number;
	readonly preview: string;
	readonly score?: number;
	readonly matchedTerms?: readonly string[];
	readonly strategy?: 'grep' | 'regex' | 'semantic';
}

const defaultMaxResults = 80;
const hardMaxResults = 200;

const readToolMethods = new Set([
	'workspace/readFile',
	'workspace/read_file',
	'agent/readFile',
	'file/read',
]);

const listToolMethods = new Set([
	'workspace/list',
	'workspace/listDir',
	'workspace/list_dir',
	'agent/listFiles',
	'file/list',
]);

const searchToolMethods = new Set([
	'workspace/search',
	'workspace/grep',
	'agent/searchFiles',
	'agent/grep',
	'search/files',
]);

const semanticSearchToolMethods = new Set([
	'workspace/semanticSearch',
	'workspace/codebaseSearch',
	'agent/semanticSearch',
	'agent/codebaseSearch',
	'codebase/search',
	'search/codebase',
]);

const editorReadActions = new Set(['read', 'read_file', 'read_files', 'view', 'view_file', 'open', 'open_file', 'inspect', 'show']);

export function normalizeWorkspaceReadToolRequest(message: JsonRpcMessage): VibeCodexWorkspaceReadToolRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	const action = normalizeActionName(stringValue(payload.action) ?? stringValue(args.action) ?? stringValue(payload.operation) ?? stringValue(args.operation) ?? stringValue(payload.mode) ?? stringValue(args.mode));
	const kind = classifyReadTool(message.method, toolName, action, hasEditorMutationPayload(payload, args));
	if (!kind) {
		return undefined;
	}
	const path = stringValue(payload.path)
		?? stringValue(args.path)
		?? stringValue(payload.file)
		?? stringValue(args.file)
		?? stringValue(payload.filePath)
		?? stringValue(args.filePath)
		?? stringValue(payload.file_path)
		?? stringValue(args.file_path)
		?? stringValue(payload.relativePath)
		?? stringValue(args.relativePath)
		?? stringValue(payload.relative_path)
		?? stringValue(args.relative_path)
		?? stringValue(payload.targetFile)
		?? stringValue(args.targetFile)
		?? stringValue(payload.target_file)
		?? stringValue(args.target_file)
		?? stringValue(payload.targetPath)
		?? stringValue(args.targetPath)
		?? stringValue(payload.target_path)
		?? stringValue(args.target_path)
		?? stringValue(payload.directory)
		?? stringValue(args.directory)
		?? stringValue(payload.dir)
		?? stringValue(args.dir)
		?? stringValue(payload.folder)
		?? stringValue(args.folder)
		?? stringValue(payload.folderPath)
		?? stringValue(args.folderPath)
		?? stringValue(payload.folder_path)
		?? stringValue(args.folder_path)
		?? (kind === 'list_dir' ? '.' : undefined);
	const paths = uniqueStrings([
		...arrayOfStrings(payload.paths),
		...arrayOfStrings(args.paths),
		...arrayOfStrings(payload.filePaths),
		...arrayOfStrings(args.filePaths),
		...arrayOfStrings(payload.file_paths),
		...arrayOfStrings(args.file_paths),
		...arrayOfStrings(payload.relativePaths),
		...arrayOfStrings(args.relativePaths),
		...arrayOfStrings(payload.relative_paths),
		...arrayOfStrings(args.relative_paths),
		...(path ? [path] : []),
	]);
	const regexQuery = stringValue(payload.regex) ?? stringValue(args.regex);
	const query = stringValue(payload.query)
		?? stringValue(args.query)
		?? stringValue(payload.pattern)
		?? stringValue(args.pattern)
		?? regexQuery;
	const filePattern = stringValue(payload.filePattern)
		?? stringValue(args.filePattern)
		?? stringValue(payload.file_pattern)
		?? stringValue(args.file_pattern)
		?? stringValue(payload.includePattern)
		?? stringValue(args.includePattern)
		?? stringValue(payload.include_pattern)
		?? stringValue(args.include_pattern)
		?? stringValue(payload.glob)
		?? stringValue(args.glob)
		?? stringValue(payload.fileGlob)
		?? stringValue(args.fileGlob)
		?? stringValue(payload.file_glob)
		?? stringValue(args.file_glob);
	if (kind === 'read_file' && !paths.length) {
		return undefined;
	}
	if ((kind === 'search_files' || kind === 'semantic_search') && !query) {
		return undefined;
	}
	const maxResults = Math.max(1, Math.min(hardMaxResults,
		numberValue(payload.maxResults)
		?? numberValue(args.maxResults)
		?? numberValue(payload.max_results)
		?? numberValue(args.max_results)
		?? numberValue(payload.limit)
		?? numberValue(args.limit)
		?? defaultMaxResults));
	const startLine = positiveIntegerValue(payload.startLine)
		?? positiveIntegerValue(args.startLine)
		?? positiveIntegerValue(payload.start_line)
		?? positiveIntegerValue(args.start_line)
		?? positiveIntegerValue(payload.lineStart)
		?? positiveIntegerValue(args.lineStart)
		?? positiveIntegerValue(payload.fromLine)
		?? positiveIntegerValue(args.fromLine);
	const endLine = positiveIntegerValue(payload.endLine)
		?? positiveIntegerValue(args.endLine)
		?? positiveIntegerValue(payload.end_line)
		?? positiveIntegerValue(args.end_line)
		?? positiveIntegerValue(payload.lineEnd)
		?? positiveIntegerValue(args.lineEnd)
		?? positiveIntegerValue(payload.toLine)
		?? positiveIntegerValue(args.toLine);
	return {
		id: message.id,
		method: message.method,
		kind,
		...(path ? { path } : {}),
		paths,
		...(query ? { query } : {}),
		...(filePattern ? { filePattern } : {}),
		isRegex: booleanValue(payload.isRegex)
			?? booleanValue(args.isRegex)
			?? booleanValue(payload.useRegex)
			?? booleanValue(args.useRegex)
			?? Boolean(regexQuery),
		caseSensitive: booleanValue(payload.caseSensitive)
			?? booleanValue(args.caseSensitive)
			?? booleanValue(payload.matchCase)
			?? booleanValue(args.matchCase)
			?? false,
		...(startLine ? { startLine } : {}),
		...(endLine ? { endLine } : {}),
		recursive: booleanValue(payload.recursive) ?? booleanValue(args.recursive) ?? (kind === 'search_files' || kind === 'semantic_search'),
		maxResults,
		requestedAt: Date.now(),
	};
}

function classifyReadTool(method: string, toolName: string, action: string | undefined, hasMutationPayload: boolean): VibeCodexWorkspaceReadToolKind | undefined {
	if (readToolMethods.has(method) || toolName === 'read_file' || toolName === 'read_files' || toolName === 'readfile' || toolName === 'editor.read') {
		return 'read_file';
	}
	if (toolName === 'editor' && (editorReadActions.has(action ?? '') || (!action && !hasMutationPayload))) {
		return 'read_file';
	}
	if (listToolMethods.has(method) || toolName === 'list_files' || toolName === 'list_dir' || toolName === 'list_directory') {
		return 'list_dir';
	}
	if (searchToolMethods.has(method) || toolName === 'search' || toolName === 'search_files' || toolName === 'grep' || toolName === 'grep_search' || toolName === 'ripgrep') {
		return 'search_files';
	}
	if (semanticSearchToolMethods.has(method) || toolName === 'codebase_search' || toolName === 'search_codebase' || toolName === 'semantic_search' || toolName === 'semantic_codebase_search') {
		return 'semantic_search';
	}
	return undefined;
}

function hasEditorMutationPayload(payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	const records = [
		payload,
		args,
		...(arrayOfRecords(payload.files) ?? []),
		...(arrayOfRecords(args.files) ?? []),
		...(arrayOfRecords(payload.changes) ?? []),
		...(arrayOfRecords(args.changes) ?? []),
	];
	return records.some(record => {
		for (const key of ['content', 'contents', 'newText', 'new_text', 'proposedText', 'proposed_text', 'after', 'patch', 'diff', 'searchReplace', 'search_replace', 'replacements']) {
			if (stringValue(record[key])) {
				return true;
			}
		}
		return isRecord(record.fileChanges) || isRecord(record.file_changes);
	});
}

function normalizeActionName(value: string | undefined): string | undefined {
	return value?.toLowerCase().replace(/[\s-]+/g, '_');
}

function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
	return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map(value => value.trim()))];
}

function arrayOfStrings(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function arrayOfRecords(value: unknown): readonly Record<string, unknown>[] | undefined {
	return Array.isArray(value) && value.every(isRecord) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(number) ? number : undefined;
}

function positiveIntegerValue(value: unknown): number | undefined {
	const number = numberValue(value);
	if (number === undefined || number < 1) {
		return undefined;
	}
	return Math.floor(number);
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
