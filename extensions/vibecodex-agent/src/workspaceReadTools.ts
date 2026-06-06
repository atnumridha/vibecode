/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VibeCodexSearchCandidate, rankSemanticSearchCandidates } from './contextSearch';
import { redactSensitiveText } from './secretFilters';
import { VibeCodexWorkspaceIgnorePolicy, collectWorkspaceIgnorePolicy, ignoredByWorkspacePolicy } from './workspaceIgnore';
import type { VibeCodexDirectoryEntry, VibeCodexReadFileResult, VibeCodexSearchResult, VibeCodexWorkspaceReadToolRequest, VibeCodexWorkspaceReadToolResponse } from './workspaceReadToolProtocol';
export { normalizeWorkspaceReadToolRequest } from './workspaceReadToolProtocol';
export type { VibeCodexDirectoryEntry, VibeCodexReadFileResult, VibeCodexSearchResult, VibeCodexWorkspaceReadToolKind, VibeCodexWorkspaceReadToolRequest, VibeCodexWorkspaceReadToolResponse } from './workspaceReadToolProtocol';
import { assertWorkspaceUriHasNoSymlinkTraversal, resolveWorkspaceFileUri } from './workspacePatch';

declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

const maxReadBytes = 60000;
const maxSearchFileBytes = 120000;
const hardMaxResults = 200;
const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';

export async function performWorkspaceReadTool(request: VibeCodexWorkspaceReadToolRequest): Promise<VibeCodexWorkspaceReadToolResponse> {
	try {
		const ignorePolicy = await collectWorkspaceIgnorePolicy();
		if (request.kind === 'read_file') {
			return await performReadFiles(request, ignorePolicy);
		}
		if (request.kind === 'list_dir') {
			return await performListDir(request, ignorePolicy);
		}
		return request.kind === 'semantic_search'
			? await performSemanticSearch(request, ignorePolicy)
			: await performSearchFiles(request, ignorePolicy);
	} catch (error) {
		return {
			ok: false,
			source: 'externalExtension',
			kind: request.kind,
			...(request.path ? { path: request.path } : {}),
			...(request.query ? { query: request.query } : {}),
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export function workspaceReadToolSummary(response: VibeCodexWorkspaceReadToolResponse): string {
	if (!response.ok) {
		return response.error ?? 'Workspace read tool failed.';
	}
	if (response.files) {
		return `Read ${response.files.length} file${response.files.length === 1 ? '' : 's'}${response.truncated ? ' with truncation' : ''}.`;
	}
	if (response.entries) {
		return `Listed ${response.entries.length} workspace entr${response.entries.length === 1 ? 'y' : 'ies'}${response.truncated ? ' with truncation' : ''}.`;
	}
	return `Found ${response.hits?.length ?? 0} ${response.kind === 'semantic_search' ? 'semantic ' : ''}search hit${response.hits?.length === 1 ? '' : 's'}${response.truncated ? ' with truncation' : ''}.`;
}

async function performReadFiles(request: VibeCodexWorkspaceReadToolRequest, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): Promise<VibeCodexWorkspaceReadToolResponse> {
	const files: VibeCodexReadFileResult[] = [];
	for (const rawPath of request.paths.slice(0, request.maxResults)) {
		assertNotIgnored(rawPath, ignorePolicy);
		const uri = resolveWorkspaceFileUri(rawPath);
		await assertWorkspaceUriHasNoSymlinkTraversal(uri, rawPath);
		const bytes = await vscode.workspace.fs.readFile(uri);
		const result = readFileResultText(bytes, request.startLine, request.endLine);
		files.push({
			path: workspaceRelativePath(uri) ?? rawPath,
			text: redactSensitiveText(result.text) + (result.truncated ? '\n[truncated]' : ''),
			truncated: result.truncated,
			...(result.startLine ? { startLine: result.startLine } : {}),
			...(result.endLine ? { endLine: result.endLine } : {}),
			...(result.totalLines ? { totalLines: result.totalLines } : {}),
		});
	}
	return {
		ok: true,
		source: 'externalExtension',
		kind: request.kind,
		files,
		truncated: files.some(file => file.truncated) || request.paths.length > request.maxResults,
	};
}

function readFileResultText(bytes: Uint8Array, startLine: number | undefined, endLine: number | undefined): { readonly text: string; readonly truncated: boolean; readonly startLine?: number; readonly endLine?: number; readonly totalLines?: number } {
	if (!startLine && !endLine) {
		const truncated = bytes.byteLength > maxReadBytes;
		return {
			text: new TextDecoder('utf-8').decode(truncated ? bytes.slice(0, maxReadBytes) : bytes),
			truncated,
		};
	}
	const rawText = new TextDecoder('utf-8').decode(bytes);
	const lines = rawText.split(/\r?\n/);
	const totalLines = lines.length;
	const start = Math.max(1, startLine ?? 1);
	const end = Math.max(start, Math.min(endLine ?? totalLines, totalLines));
	const selected = lines.slice(start - 1, end).join('\n');
	const truncated = selected.length > maxReadBytes;
	return {
		text: truncated ? selected.slice(0, maxReadBytes) : selected,
		truncated,
		startLine: start,
		endLine: end,
		totalLines,
	};
}

async function performListDir(request: VibeCodexWorkspaceReadToolRequest, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): Promise<VibeCodexWorkspaceReadToolResponse> {
	const rawPath = request.path ?? '.';
	const uri = rawPath === '.' ? vscode.workspace.workspaceFolders?.[0]?.uri : resolveWorkspaceFileUri(rawPath);
	if (!uri) {
		throw new Error('Open a workspace before listing files.');
	}
	assertNotIgnored(rawPath, ignorePolicy);
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, rawPath);
	const entries = request.recursive
		? await recursiveEntries(uri, ignorePolicy, request.maxResults)
		: await directEntries(uri, ignorePolicy, request.maxResults);
	return {
		ok: true,
		source: 'externalExtension',
		kind: request.kind,
		path: rawPath,
		entries: entries.items,
		truncated: entries.truncated,
	};
}

async function performSearchFiles(request: VibeCodexWorkspaceReadToolRequest, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): Promise<VibeCodexWorkspaceReadToolResponse> {
	const query = request.query ?? '';
	const hits: VibeCodexSearchResult[] = [];
	const matcher = createSearchMatcher(query, request.isRegex, request.caseSensitive);
	const files = await searchCandidateFiles(request, ignorePolicy);
	for (const uri of files) {
		if (hits.length >= request.maxResults) {
			break;
		}
		const path = workspaceRelativePath(uri);
		if (!path || ignoredByWorkspacePolicy(path, ignorePolicy)) {
			continue;
		}
		await assertWorkspaceUriHasNoSymlinkTraversal(uri, path);
		const fileHits = await searchFile(uri, path, matcher, request.maxResults - hits.length);
		hits.push(...fileHits);
	}
	return {
		ok: true,
		source: 'externalExtension',
		kind: request.kind,
		query,
		hits: hits.map(hit => ({ ...hit, preview: redactSensitiveText(hit.preview), strategy: request.isRegex ? 'regex' : 'grep' })),
		truncated: hits.length >= request.maxResults,
	};
}

async function performSemanticSearch(request: VibeCodexWorkspaceReadToolRequest, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): Promise<VibeCodexWorkspaceReadToolResponse> {
	const query = request.query ?? '';
	const candidates: VibeCodexSearchCandidate[] = [];
	const files = await vscode.workspace.findFiles('**/*', workspaceExclude, Math.max(request.maxResults * 10, request.maxResults));
	for (const uri of files) {
		const path = workspaceRelativePath(uri);
		if (!path || ignoredByWorkspacePolicy(path, ignorePolicy)) {
			continue;
		}
		await assertWorkspaceUriHasNoSymlinkTraversal(uri, path);
		const text = await readSearchCandidateText(uri);
		if (text === undefined) {
			continue;
		}
		candidates.push({
			path,
			text,
			languageId: languageIdForPath(path),
		});
	}
	const ranked = rankSemanticSearchCandidates(query, candidates, request.maxResults);
	return {
		ok: true,
		source: 'externalExtension',
		kind: request.kind,
		query,
		hits: ranked.map(hit => ({
			path: hit.path,
			line: hit.snippet ? lineNumberForSnippet(candidates.find(candidate => candidate.path === hit.path)?.text ?? '', hit.snippet) : 1,
			preview: redactSensitiveText(hit.snippet ?? hit.path),
			score: hit.score,
			matchedTerms: hit.matchedTerms,
			strategy: 'semantic',
		})),
		truncated: candidates.length > ranked.length && ranked.length >= request.maxResults,
	};
}

async function directEntries(uri: vscode.Uri, ignorePolicy: VibeCodexWorkspaceIgnorePolicy, limit: number): Promise<{ readonly items: readonly VibeCodexDirectoryEntry[]; readonly truncated: boolean }> {
	const items: VibeCodexDirectoryEntry[] = [];
	for (const [name, type] of await vscode.workspace.fs.readDirectory(uri)) {
		const child = vscode.Uri.joinPath(uri, name);
		const path = workspaceRelativePath(child);
		if (!path || ignoredByWorkspacePolicy(path, ignorePolicy)) {
			continue;
		}
		items.push({ path, type: fileTypeName(type) });
		if (items.length >= limit) {
			return { items, truncated: true };
		}
	}
	return { items, truncated: false };
}

async function recursiveEntries(root: vscode.Uri, ignorePolicy: VibeCodexWorkspaceIgnorePolicy, limit: number): Promise<{ readonly items: readonly VibeCodexDirectoryEntry[]; readonly truncated: boolean }> {
	const items: VibeCodexDirectoryEntry[] = [];
	const queue = [root];
	while (queue.length && items.length < limit) {
		const current = queue.shift()!;
		for (const [name, type] of await vscode.workspace.fs.readDirectory(current)) {
			const child = vscode.Uri.joinPath(current, name);
			const path = workspaceRelativePath(child);
			if (!path || ignoredByWorkspacePolicy(path, ignorePolicy)) {
				continue;
			}
			items.push({ path, type: fileTypeName(type) });
			if (type === vscode.FileType.Directory) {
				queue.push(child);
			}
			if (items.length >= limit) {
				return { items, truncated: true };
			}
		}
	}
	return { items, truncated: queue.length > 0 };
}

async function searchCandidateFiles(request: VibeCodexWorkspaceReadToolRequest, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): Promise<readonly vscode.Uri[]> {
	if (!request.path) {
		const include = request.filePattern ? scopedFilePatternInclude(undefined, request.filePattern, true) : '**/*';
		return vscode.workspace.findFiles(include, workspaceExclude, Math.max(request.maxResults * 8, request.maxResults));
	}
	assertNotIgnored(request.path, ignorePolicy);
	const uri = resolveWorkspaceFileUri(request.path);
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, request.path);
	const stat = await vscode.workspace.fs.stat(uri);
	if (stat.type === vscode.FileType.File) {
		return [uri];
	}
	if (stat.type !== vscode.FileType.Directory) {
		return [];
	}
	if (request.filePattern) {
		const include = scopedFilePatternInclude(workspaceRelativePath(uri), request.filePattern, request.recursive);
		return vscode.workspace.findFiles(include, workspaceExclude, Math.max(request.maxResults * 8, request.maxResults));
	}
	if (!request.recursive) {
		const uris: vscode.Uri[] = [];
		for (const [name, type] of await vscode.workspace.fs.readDirectory(uri)) {
			if (type !== vscode.FileType.File) {
				continue;
			}
			const child = vscode.Uri.joinPath(uri, name);
			const path = workspaceRelativePath(child);
			if (path) {
				await assertWorkspaceUriHasNoSymlinkTraversal(child, path);
			}
			uris.push(child);
			if (uris.length >= Math.max(request.maxResults * 8, request.maxResults)) {
				break;
			}
		}
		return uris;
	}
	const relative = workspaceRelativePath(uri);
	const include = !relative || relative === '.' ? '**/*' : `${relative}/**/*`;
	return vscode.workspace.findFiles(include, workspaceExclude, Math.max(request.maxResults * 8, request.maxResults));
}

function scopedFilePatternInclude(relativeRoot: string | undefined, filePattern: string, recursive: boolean): string {
	const normalizedPattern = normalizeGlobPattern(filePattern);
	const root = !relativeRoot || relativeRoot === '.' ? '' : `${relativeRoot.replace(/^\/+|\/+$/g, '')}/`;
	if (normalizedPattern.includes('/')) {
		return `${root}${normalizedPattern}`;
	}
	return `${root}${recursive ? '**/' : ''}${normalizedPattern}`;
}

function normalizeGlobPattern(value: string): string {
	const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').trim();
	return normalized && normalized !== '.' ? normalized : '*';
}

async function searchFile(uri: vscode.Uri, path: string, matcher: SearchMatcher, limit: number): Promise<readonly VibeCodexSearchResult[]> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		const text = new TextDecoder('utf-8').decode(bytes.byteLength > maxSearchFileBytes ? bytes.slice(0, maxSearchFileBytes) : bytes);
		const hits: VibeCodexSearchResult[] = [];
		for (const offset of matcher.matchOffsets(text)) {
			const line = lineNumberAt(text, offset);
			hits.push({ path, line, preview: previewLine(text, offset) });
			if (hits.length >= limit) {
				break;
			}
		}
		return hits;
	} catch {
		return [];
	}
}

interface SearchMatcher {
	readonly matchOffsets: (text: string) => readonly number[];
}

function createSearchMatcher(query: string, isRegex: boolean, caseSensitive: boolean): SearchMatcher {
	if (!query) {
		return { matchOffsets: () => [] };
	}
	if (isRegex) {
		const flags = caseSensitive ? 'g' : 'gi';
		let expression: RegExp;
		try {
			expression = new RegExp(query, flags);
		} catch (error) {
			throw new Error(`Invalid search_files regex: ${error instanceof Error ? error.message : String(error)}`);
		}
		return {
			matchOffsets: text => {
				const hits: number[] = [];
				expression.lastIndex = 0;
				let match: RegExpExecArray | null;
				while ((match = expression.exec(text)) && hits.length < hardMaxResults) {
					hits.push(match.index);
					if (match[0].length === 0) {
						expression.lastIndex++;
					}
				}
				return hits;
			},
		};
	}
	return {
		matchOffsets: text => {
			const haystack = caseSensitive ? text : text.toLowerCase();
			const needle = caseSensitive ? query : query.toLowerCase();
			const hits: number[] = [];
			let offset = haystack.indexOf(needle);
			while (offset >= 0 && hits.length < hardMaxResults) {
				hits.push(offset);
				offset = haystack.indexOf(needle, offset + Math.max(1, needle.length));
			}
			return hits;
		},
	};
}

async function readSearchCandidateText(uri: vscode.Uri): Promise<string | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		return new TextDecoder('utf-8').decode(bytes.byteLength > maxSearchFileBytes ? bytes.slice(0, maxSearchFileBytes) : bytes);
	} catch {
		return undefined;
	}
}

function assertNotIgnored(rawPath: string, policy: VibeCodexWorkspaceIgnorePolicy): void {
	const normalized = rawPath === '.' ? '' : rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
	if (!normalized) {
		return;
	}
	const ignoredBy = ignoredByWorkspacePolicy(normalized, policy);
	if (ignoredBy) {
		throw new Error(`Blocked read for ignored workspace path ${normalized} by ${ignoredBy}.`);
	}
}

function fileTypeName(type: vscode.FileType): VibeCodexDirectoryEntry['type'] {
	if ((type & vscode.FileType.SymbolicLink) !== 0) {
		return 'symbolicLink';
	}
	if (type === vscode.FileType.File) {
		return 'file';
	}
	if (type === vscode.FileType.Directory) {
		return 'directory';
	}
	return 'unknown';
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
}

function lineNumberAt(text: string, offset: number): number {
	return text.slice(0, offset).split(/\r?\n/).length;
}

function previewLine(text: string, offset: number): string {
	const start = Math.max(0, text.lastIndexOf('\n', offset - 1) + 1);
	const next = text.indexOf('\n', offset);
	const end = next === -1 ? text.length : next;
	return text.slice(start, end).trim().slice(0, 500);
}

function lineNumberForSnippet(text: string, snippet: string): number {
	const compactNeedle = snippet.replace(/^\.\.\.|\.\.\.$/g, '').slice(0, 80).trim();
	if (!compactNeedle) {
		return 1;
	}
	const index = text.replace(/\s+/g, ' ').indexOf(compactNeedle);
	return index >= 0 ? lineNumberAt(text, index) : 1;
}

function languageIdForPath(path: string): string | undefined {
	const extension = path.split('.').pop()?.toLowerCase();
	switch (extension) {
		case 'ts':
		case 'tsx':
			return 'typescript';
		case 'js':
		case 'jsx':
			return 'javascript';
		case 'py':
			return 'python';
		case 'rs':
			return 'rust';
		case 'go':
			return 'go';
		case 'java':
			return 'java';
		case 'md':
			return 'markdown';
		default:
			return extension;
	}
}
