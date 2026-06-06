/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { VibeCodexCodeDefinitionRequest } from './codeDefinitionToolProtocol';
export { normalizeCodeDefinitionRequest } from './codeDefinitionToolProtocol';
export type { VibeCodexCodeDefinitionRequest } from './codeDefinitionToolProtocol';
import { redactSensitiveText } from './secretFilters';
import { VibeCodexSymbolEntry } from './symbolIndex';
import { collectWorkspaceIgnorePolicy, ignoredByWorkspacePolicy } from './workspaceIgnore';
import { resolveWorkspaceFileUri } from './workspacePatch';

export interface VibeCodexCodeDefinitionResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly kind: 'list_code_definition_names';
	readonly path: string;
	readonly entries?: readonly VibeCodexSymbolEntry[];
	readonly truncated?: boolean;
	readonly error?: string;
}

const maxCandidateFiles = 80;
const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const symbolCandidateExtensions = new Set([
	'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
	'py', 'go', 'rs', 'java', 'kt', 'kts', 'cs',
	'cpp', 'cc', 'cxx', 'c', 'h', 'hpp',
	'rb', 'php', 'swift', 'scala', 'vue', 'svelte',
]);

export async function performCodeDefinitionRequest(request: VibeCodexCodeDefinitionRequest): Promise<VibeCodexCodeDefinitionResponse> {
	try {
		const ignorePolicy = await collectWorkspaceIgnorePolicy();
		const uris = await codeDefinitionCandidateUris(request);
		const entries: VibeCodexSymbolEntry[] = [];
		let truncated = false;
		for (const uri of uris) {
			const path = workspaceRelativePath(uri);
			if (!path || ignoredByWorkspacePolicy(path, ignorePolicy)) {
				continue;
			}
			for (const entry of await documentSymbols(uri, path, request.maxResults - entries.length)) {
				entries.push(entry);
				if (entries.length >= request.maxResults) {
					truncated = true;
					break;
				}
			}
			if (entries.length >= request.maxResults) {
				break;
			}
		}
		return {
			ok: true,
			source: 'externalExtension',
			kind: 'list_code_definition_names',
			path: request.path,
			entries,
			truncated: truncated || uris.length >= maxCandidateFiles,
		};
	} catch (error) {
		return {
			ok: false,
			source: 'externalExtension',
			kind: 'list_code_definition_names',
			path: request.path,
			error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error)),
		};
	}
}

export function codeDefinitionSummary(response: VibeCodexCodeDefinitionResponse): string {
	if (!response.ok) {
		return response.error ?? 'Code definition listing failed.';
	}
	return `Listed ${response.entries?.length ?? 0} code definition${response.entries?.length === 1 ? '' : 's'} under ${response.path}${response.truncated ? ' with truncation' : ''}.`;
}

async function codeDefinitionCandidateUris(request: VibeCodexCodeDefinitionRequest): Promise<readonly vscode.Uri[]> {
	const root = request.path === '.' ? vscode.workspace.workspaceFolders?.[0]?.uri : resolveWorkspaceFileUri(request.path);
	if (!root) {
		throw new Error('Open a workspace before listing code definitions.');
	}
	const stat = await vscode.workspace.fs.stat(root);
	if (stat.type === vscode.FileType.File) {
		return isSymbolCandidatePath(workspaceRelativePath(root) ?? root.fsPath) ? [root] : [];
	}
	if (stat.type !== vscode.FileType.Directory) {
		return [];
	}
	if (!request.recursive) {
		const uris: vscode.Uri[] = [];
		for (const [name, type] of await vscode.workspace.fs.readDirectory(root)) {
			if (type !== vscode.FileType.File) {
				continue;
			}
			const child = vscode.Uri.joinPath(root, name);
			const path = workspaceRelativePath(child);
			if (path && isSymbolCandidatePath(path)) {
				uris.push(child);
			}
			if (uris.length >= maxCandidateFiles) {
				break;
			}
		}
		return uris;
	}
	const relative = workspaceRelativePath(root);
	const include = !relative || relative === '.' ? '**/*' : `${relative}/**/*`;
	const files = await vscode.workspace.findFiles(include, workspaceExclude, maxCandidateFiles);
	return files.filter(uri => isSymbolCandidatePath(workspaceRelativePath(uri) ?? uri.fsPath));
}

async function documentSymbols(uri: vscode.Uri, path: string, limit: number): Promise<readonly VibeCodexSymbolEntry[]> {
	if (limit <= 0) {
		return [];
	}
	try {
		const symbols = await vscode.commands.executeCommand<readonly unknown[] | undefined>('vscode.executeDocumentSymbolProvider', uri);
		if (!symbols?.length) {
			return [];
		}
		const entries: VibeCodexSymbolEntry[] = [];
		for (const symbol of symbols) {
			collectSymbolEntry(symbol, path, undefined, entries, limit);
			if (entries.length >= limit) {
				break;
			}
		}
		return entries;
	} catch {
		return [];
	}
}

function collectSymbolEntry(symbol: unknown, path: string, parentName: string | undefined, entries: VibeCodexSymbolEntry[], limit: number): void {
	if (entries.length >= limit || !isRecord(symbol)) {
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
		collectSymbolEntry(child, path, name ?? parentName, entries, limit);
		if (entries.length >= limit) {
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

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	const candidate = normalizePath(uri.fsPath);
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const root = normalizePath(folder.uri.fsPath);
		if (candidate === root) {
			return '.';
		}
		if (candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			return candidate.slice((root.endsWith('/') ? root : `${root}/`).length);
		}
	}
	return undefined;
}

function isSymbolCandidatePath(path: string): boolean {
	const extension = path.split('.').pop()?.toLowerCase();
	return !!extension && symbolCandidateExtensions.has(extension);
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
