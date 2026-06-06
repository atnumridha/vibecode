/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VibeCodexSearchHit } from './contextSearch';
import { redactSensitiveText } from './secretFilters';
import { VibeCodexSymbolEntry, VibeCodexSymbolIndex, symbolIndexPromptBlock as protocolSymbolIndexPromptBlock, symbolIndexSummary as protocolSymbolIndexSummary } from './symbolIndexProtocol';
import { VibeCodexWorkspaceIgnorePolicy, isWorkspacePathIgnored } from './workspaceIgnore';

export type { VibeCodexSymbolEntry, VibeCodexSymbolIndex } from './symbolIndexProtocol';

interface SymbolIndexSeed {
	readonly mentions: readonly { readonly kind: string; readonly value: string }[];
	readonly files: readonly { readonly path: string }[];
	readonly searchHits: readonly VibeCodexSearchHit[];
	readonly ignorePolicy?: VibeCodexWorkspaceIgnorePolicy;
}

const symbolWorkspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const maxSymbolFiles = 18;
const maxSymbols = 140;
const symbolCandidateExtensions = new Set([
	'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
	'py', 'go', 'rs', 'java', 'kt', 'kts', 'cs',
	'cpp', 'cc', 'cxx', 'c', 'h', 'hpp',
	'rb', 'php', 'swift', 'scala', 'vue', 'svelte',
]);

export async function collectSymbolIndex(seed: SymbolIndexSeed): Promise<VibeCodexSymbolIndex | undefined> {
	const candidates = await symbolCandidateUris(seed);
	const entries: VibeCodexSymbolEntry[] = [];
	let truncated = false;
	for (const uri of candidates) {
		const path = workspaceRelativePath(uri);
		if (!path || isWorkspacePathIgnored(path, seed.ignorePolicy)) {
			continue;
		}
		const symbols = await documentSymbols(uri, path);
		for (const symbol of symbols) {
			entries.push(symbol);
			if (entries.length >= maxSymbols) {
				truncated = true;
				return {
					version: 1,
					collectedAt: Date.now(),
					entries,
					truncated,
				};
			}
		}
	}
	return entries.length ? {
		version: 1,
		collectedAt: Date.now(),
		entries,
		truncated,
	} : undefined;
}

export function symbolIndexSummary(index: VibeCodexSymbolIndex | undefined): string {
	return protocolSymbolIndexSummary(index);
}

export function symbolIndexPromptBlock(index: VibeCodexSymbolIndex | undefined): string {
	// Prompt block note: Symbols are read-only structural context from VS Code document symbol providers.
	return protocolSymbolIndexPromptBlock(index);
}

async function symbolCandidateUris(seed: SymbolIndexSeed): Promise<readonly vscode.Uri[]> {
	const seen = new Set<string>();
	const uris: vscode.Uri[] = [];
	for (const path of [
		...seed.files.map(file => file.path),
		...seed.searchHits.map(hit => hit.path),
	]) {
		const uri = workspaceUri(path);
		if (uri && isSymbolCandidatePath(path)) {
			addUri(uri, seen, uris);
		}
		if (uris.length >= maxSymbolFiles) {
			return uris;
		}
	}
	if (seed.mentions.some(mention => mention.kind === 'symbols')) {
		for (const uri of await vscode.workspace.findFiles('**/*', symbolWorkspaceExclude, maxSymbolFiles * 4)) {
			const path = workspaceRelativePath(uri);
			if (!path || !isSymbolCandidatePath(path) || isWorkspacePathIgnored(path, seed.ignorePolicy)) {
				continue;
			}
			addUri(uri, seen, uris);
			if (uris.length >= maxSymbolFiles) {
				break;
			}
		}
	}
	return uris.slice(0, maxSymbolFiles);
}

async function documentSymbols(uri: vscode.Uri, path: string): Promise<readonly VibeCodexSymbolEntry[]> {
	try {
		const symbols = await vscode.commands.executeCommand<readonly unknown[] | undefined>('vscode.executeDocumentSymbolProvider', uri);
		if (!symbols?.length) {
			return [];
		}
		const entries: VibeCodexSymbolEntry[] = [];
		for (const symbol of symbols) {
			collectSymbolEntry(symbol, path, undefined, entries);
			if (entries.length >= maxSymbols) {
				break;
			}
		}
		return entries;
	} catch {
		return [];
	}
}

function collectSymbolEntry(symbol: unknown, path: string, parentName: string | undefined, entries: VibeCodexSymbolEntry[]): void {
	if (!isRecord(symbol)) {
		return;
	}
	const name = typeof symbol.name === 'string' ? redactSensitiveText(symbol.name).slice(0, 180) : undefined;
	const range = symbolRange(symbol);
	if (name && range) {
		entries.push({
			path,
			name,
			kind: symbolKindLabel(symbol.kind),
			range,
			...(parentName ? { containerName: parentName } : typeof symbol.containerName === 'string' ? { containerName: redactSensitiveText(symbol.containerName).slice(0, 180) } : {}),
		});
	}
	const children = Array.isArray(symbol.children) ? symbol.children : [];
	for (const child of children) {
		collectSymbolEntry(child, path, name ?? parentName, entries);
		if (entries.length >= maxSymbols) {
			return;
		}
	}
}

function symbolRange(symbol: Record<string, unknown>): string | undefined {
	const range = isRangeLike(symbol.range) ? symbol.range : isRecord(symbol.location) && isRangeLike(symbol.location.range) ? symbol.location.range : undefined;
	return range ? `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}` : undefined;
}

function isRangeLike(value: unknown): value is vscode.Range {
	return isRecord(value)
		&& isRecord(value.start)
		&& isRecord(value.end)
		&& typeof value.start.line === 'number'
		&& typeof value.start.character === 'number'
		&& typeof value.end.line === 'number'
		&& typeof value.end.character === 'number';
}

function symbolKindLabel(kind: unknown): string {
	const key = typeof kind === 'number' ? vscode.SymbolKind[kind] : undefined;
	return key ? key.charAt(0).toLowerCase() + key.slice(1) : 'symbol';
}

function workspaceUri(relativePath: string): vscode.Uri | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder || !relativePath || relativePath === '.') {
		return undefined;
	}
	return vscode.Uri.joinPath(folder.uri, ...relativePath.split('/').filter(Boolean));
}

function addUri(uri: vscode.Uri, seen: Set<string>, uris: vscode.Uri[]): void {
	const key = uri.toString();
	if (!seen.has(key)) {
		seen.add(key);
		uris.push(uri);
	}
}

function isSymbolCandidatePath(path: string): boolean {
	const extension = path.split('.').pop()?.toLowerCase();
	return !!extension && symbolCandidateExtensions.has(extension);
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	const folders = vscode.workspace.workspaceFolders ?? [];
	for (const folder of folders) {
		const root = normalizePath(folder.uri.fsPath);
		const candidate = normalizePath(uri.fsPath);
		if (candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			return candidate.slice((root.endsWith('/') ? root : `${root}/`).length);
		}
	}
	return undefined;
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
