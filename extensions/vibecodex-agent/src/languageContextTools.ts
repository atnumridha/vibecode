/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';
import { collectWorkspaceIgnorePolicy, ignoredByWorkspacePolicy } from './workspaceIgnore';
import type { VibeCodexWorkspaceIgnorePolicy } from './workspaceIgnore';
import { resolveWorkspaceFileUri } from './workspacePatch';

export interface VibeCodexReferenceToolRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: 'vscode_references';
	readonly path: string;
	readonly line: number;
	readonly column: number;
	readonly includeDeclaration: boolean;
	readonly maxResults: number;
	readonly requestedAt: number;
}

export interface VibeCodexWorkspaceSymbolsToolRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: 'workspace_symbols';
	readonly query: string;
	readonly maxResults: number;
	readonly requestedAt: number;
}

export type VibeCodexLanguageContextRequest = VibeCodexReferenceToolRequest | VibeCodexWorkspaceSymbolsToolRequest;

export interface VibeCodexLanguageLocation {
	readonly path: string;
	readonly range: string;
	readonly uri?: string;
}

export interface VibeCodexReferenceToolResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly kind: 'vscode_references';
	readonly path: string;
	readonly position: { readonly line: number; readonly column: number };
	readonly includeDeclaration: boolean;
	readonly references?: readonly VibeCodexLanguageLocation[];
	readonly returnedReferences?: number;
	readonly totalReferencesAfterFiltering?: number;
	readonly truncated?: boolean;
	readonly error?: string;
}

export interface VibeCodexWorkspaceSymbolItem {
	readonly name: string;
	readonly kind: string;
	readonly path: string;
	readonly range: string;
	readonly containerName?: string;
	readonly uri?: string;
}

export interface VibeCodexWorkspaceSymbolsToolResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly kind: 'workspace_symbols';
	readonly query: string;
	readonly symbols?: readonly VibeCodexWorkspaceSymbolItem[];
	readonly returnedSymbols?: number;
	readonly totalSymbolsAfterFiltering?: number;
	readonly truncated?: boolean;
	readonly error?: string;
}

export type VibeCodexLanguageContextResponse = VibeCodexReferenceToolResponse | VibeCodexWorkspaceSymbolsToolResponse;

const defaultMaxResults = 100;
const hardMaxResults = 500;

const referenceMethods = new Set([
	'agent/references',
	'agent/findReferences',
	'workspace/references',
	'workspace/findReferences',
	'vscode/references',
]);

const referenceToolNames = new Set([
	'vscode_references',
	'find_references',
	'references',
	'usages',
	'find_usages',
]);

const workspaceSymbolMethods = new Set([
	'agent/workspaceSymbols',
	'agent/symbolSearch',
	'workspace/symbols',
	'workspace/symbolSearch',
	'symbols/workspace',
	'symbols/search',
]);

const workspaceSymbolToolNames = new Set([
	'workspace_symbols',
	'workspace_symbol_search',
	'symbol_search',
	'symbols_search',
	'find_symbols',
]);

export function normalizeLanguageContextRequest(message: JsonRpcMessage): VibeCodexLanguageContextRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	const toolName = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name)
		?? '').toLowerCase();
	if (isReferenceRequest(message.method, toolName)) {
		const path = stringValue(payload.path)
			?? stringValue(args.path)
			?? stringValue(payload.file)
			?? stringValue(args.file)
			?? stringValue(payload.targetPath)
			?? stringValue(args.targetPath);
		const line = integerValue(payload.line)
			?? integerValue(args.line)
			?? integerValue(payload.lineNumber)
			?? integerValue(args.lineNumber);
		const column = integerValue(payload.column)
			?? integerValue(args.column)
			?? integerValue(payload.character)
			?? integerValue(args.character);
		if (!path || !line || !column) {
			return undefined;
		}
		return {
			id: message.id,
			method: message.method,
			kind: 'vscode_references',
			path,
			line,
			column,
			includeDeclaration: booleanValue(payload.includeDeclaration)
				?? booleanValue(payload.include_declaration)
				?? booleanValue(args.includeDeclaration)
				?? booleanValue(args.include_declaration)
				?? true,
			maxResults: clampMaxResults(integerValue(payload.maxResults) ?? integerValue(payload.limit) ?? integerValue(args.maxResults) ?? integerValue(args.limit)),
			requestedAt: Date.now(),
		};
	}
	if (isWorkspaceSymbolsRequest(message.method, toolName)) {
		const query = stringValue(payload.query)
			?? stringValue(args.query)
			?? stringValue(payload.symbol)
			?? stringValue(args.symbol)
			?? stringValue(payload.name)
			?? stringValue(args.name)
			?? stringValue(payload.search)
			?? stringValue(args.search);
		if (!query) {
			return undefined;
		}
		return {
			id: message.id,
			method: message.method,
			kind: 'workspace_symbols',
			query: redactSensitiveText(query).slice(0, 240),
			maxResults: clampMaxResults(integerValue(payload.maxResults) ?? integerValue(payload.limit) ?? integerValue(args.maxResults) ?? integerValue(args.limit)),
			requestedAt: Date.now(),
		};
	}
	return undefined;
}

export async function performLanguageContextRequest(request: VibeCodexLanguageContextRequest): Promise<VibeCodexLanguageContextResponse> {
	return request.kind === 'vscode_references'
		? performReferenceRequest(request)
		: performWorkspaceSymbolsRequest(request);
}

export function languageContextSummary(response: VibeCodexLanguageContextResponse): string {
	if (!response.ok) {
		return response.error ?? `${response.kind} request failed.`;
	}
	if (response.kind === 'vscode_references') {
		return `Returned ${response.returnedReferences ?? 0} reference${response.returnedReferences === 1 ? '' : 's'} for ${response.path}:${response.position.line}:${response.position.column}${response.truncated ? ' with truncation' : ''}.`;
	}
	return `Returned ${response.returnedSymbols ?? 0} workspace symbol${response.returnedSymbols === 1 ? '' : 's'} for "${response.query}"${response.truncated ? ' with truncation' : ''}.`;
}

async function performReferenceRequest(request: VibeCodexReferenceToolRequest): Promise<VibeCodexReferenceToolResponse> {
	try {
		const ignorePolicy = await collectWorkspaceIgnorePolicy();
		const uri = resolveWorkspaceFileUri(request.path);
		const relativePath = workspaceRelativePath(uri);
		if (!relativePath) {
			throw new Error(`Reference path is outside the open workspace: ${request.path}`);
		}
		if (ignoredByWorkspacePolicy(relativePath, ignorePolicy)) {
			throw new Error(`Blocked references for ignored workspace path ${relativePath}.`);
		}
		const document = await vscode.workspace.openTextDocument(uri);
		if (request.line < 1 || request.line > document.lineCount) {
			throw new Error(`Reference position line is outside ${relativePath}: ${request.line}.`);
		}
		const line = document.lineAt(request.line - 1);
		if (request.column < 1 || request.column > line.range.end.character + 1) {
			throw new Error(`Reference position column is outside ${relativePath}: ${request.line}:${request.column}.`);
		}
		const rawReferences = await vscode.commands.executeCommand<readonly vscode.Location[] | undefined>(
			'vscode.executeReferenceProvider',
			uri,
			new vscode.Position(request.line - 1, request.column - 1),
		);
		const references = (rawReferences ?? [])
			.map(location => languageLocation(location, ignorePolicy))
			.filter((location): location is VibeCodexLanguageLocation => !!location);
		const limited = references.slice(0, request.maxResults);
		return {
			ok: true,
			source: 'externalExtension',
			kind: 'vscode_references',
			path: relativePath,
			position: { line: request.line, column: request.column },
			includeDeclaration: request.includeDeclaration,
			references: limited,
			returnedReferences: limited.length,
			totalReferencesAfterFiltering: references.length,
			truncated: references.length > limited.length,
		};
	} catch (error) {
		return {
			ok: false,
			source: 'externalExtension',
			kind: 'vscode_references',
			path: request.path,
			position: { line: request.line, column: request.column },
			includeDeclaration: request.includeDeclaration,
			error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error)),
		};
	}
}

async function performWorkspaceSymbolsRequest(request: VibeCodexWorkspaceSymbolsToolRequest): Promise<VibeCodexWorkspaceSymbolsToolResponse> {
	try {
		const ignorePolicy = await collectWorkspaceIgnorePolicy();
		const rawSymbols = await vscode.commands.executeCommand<readonly vscode.SymbolInformation[] | undefined>(
			'vscode.executeWorkspaceSymbolProvider',
			request.query,
		);
		const symbols = (rawSymbols ?? [])
			.map(symbol => workspaceSymbolItem(symbol, ignorePolicy))
			.filter((symbol): symbol is VibeCodexWorkspaceSymbolItem => !!symbol);
		const limited = symbols.slice(0, request.maxResults);
		return {
			ok: true,
			source: 'externalExtension',
			kind: 'workspace_symbols',
			query: request.query,
			symbols: limited,
			returnedSymbols: limited.length,
			totalSymbolsAfterFiltering: symbols.length,
			truncated: symbols.length > limited.length,
		};
	} catch (error) {
		return {
			ok: false,
			source: 'externalExtension',
			kind: 'workspace_symbols',
			query: request.query,
			error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error)),
		};
	}
}

function languageLocation(location: vscode.Location, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): VibeCodexLanguageLocation | undefined {
	const relativePath = workspaceRelativePath(location.uri);
	if (!relativePath || ignoredByWorkspacePolicy(relativePath, ignorePolicy)) {
		return undefined;
	}
	return {
		path: relativePath,
		range: rangeString(location.range),
		uri: location.uri.toString(),
	};
}

function workspaceSymbolItem(symbol: vscode.SymbolInformation, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): VibeCodexWorkspaceSymbolItem | undefined {
	const location = symbol.location;
	const relativePath = workspaceRelativePath(location.uri);
	if (!relativePath || ignoredByWorkspacePolicy(relativePath, ignorePolicy)) {
		return undefined;
	}
	return {
		name: redactSensitiveText(symbol.name).slice(0, 180),
		kind: symbolKindLabel(symbol.kind),
		path: relativePath,
		range: rangeString(location.range),
		...(symbol.containerName ? { containerName: redactSensitiveText(symbol.containerName).slice(0, 180) } : {}),
		uri: location.uri.toString(),
	};
}

function rangeString(range: vscode.Range): string {
	return `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}`;
}

function symbolKindLabel(kind: vscode.SymbolKind): string {
	const label = vscode.SymbolKind[kind];
	return label ? label.charAt(0).toLowerCase() + label.slice(1) : 'symbol';
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

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isReferenceRequest(method: string, toolName: string): boolean {
	return referenceMethods.has(method) || referenceToolNames.has(toolName);
}

function isWorkspaceSymbolsRequest(method: string, toolName: string): boolean {
	return workspaceSymbolMethods.has(method) || workspaceSymbolToolNames.has(toolName);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function clampMaxResults(value: number | undefined): number {
	return Math.max(1, Math.min(hardMaxResults, value ?? defaultMaxResults));
}

function integerValue(value: unknown): number | undefined {
	const valueAsNumber = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isInteger(valueAsNumber) && valueAsNumber > 0 ? valueAsNumber : undefined;
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
