/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';
import { collectWorkspaceIgnorePolicy, ignoredByWorkspacePolicy } from './workspaceIgnore';
import { resolveWorkspaceFileUri } from './workspacePatch';

declare const require: (module: string) => unknown;

const pathModule = require('path') as {
	readonly relative: (from: string, to: string) => string;
	readonly sep: string;
};

export type VibeCodexDiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint';

export interface VibeCodexDiagnosticsToolRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly path?: string;
	readonly severities: readonly VibeCodexDiagnosticSeverity[];
	readonly maxResults: number;
	readonly requestedAt: number;
}

export interface VibeCodexDiagnosticsToolResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly kind: 'get_diagnostics';
	readonly path?: string;
	readonly severities?: readonly VibeCodexDiagnosticSeverity[];
	readonly counts?: Record<VibeCodexDiagnosticSeverity, number>;
	readonly diagnostics?: readonly VibeCodexDiagnosticToolItem[];
	readonly truncated?: boolean;
	readonly error?: string;
}

export interface VibeCodexDiagnosticToolItem {
	readonly path: string;
	readonly severity: VibeCodexDiagnosticSeverity;
	readonly message: string;
	readonly range: string;
	readonly source?: string;
	readonly code?: string;
}

const defaultMaxResults = 120;
const hardMaxResults = 300;
const maxDiagnosticMessageLength = 700;

const diagnosticsMethods = new Set([
	'workspace/getDiagnostics',
	'workspace/diagnostics',
	'agent/getDiagnostics',
	'agent/diagnostics',
	'diagnostics/get',
	'diagnostics/list',
	'problems/list',
]);

export function normalizeDiagnosticsRequest(message: JsonRpcMessage): VibeCodexDiagnosticsToolRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	if (!isDiagnosticsRequest(message.method, toolName)) {
		return undefined;
	}
	const path = stringValue(payload.path)
		?? stringValue(args.path)
		?? stringValue(payload.file)
		?? stringValue(args.file)
		?? stringValue(payload.filePath)
		?? stringValue(args.filePath)
		?? stringValue(payload.directory)
		?? stringValue(args.directory);
	const severities = normalizeSeverities([
		...arrayOfStrings(payload.severities),
		...arrayOfStrings(args.severities),
		stringValue(payload.severity),
		stringValue(args.severity),
		stringValue(payload.level),
		stringValue(args.level),
	]);
	const maxResults = Math.max(1, Math.min(hardMaxResults, numberValue(payload.maxResults) ?? numberValue(args.maxResults) ?? defaultMaxResults));
	return {
		id: message.id,
		method: message.method,
		...(path ? { path } : {}),
		severities,
		maxResults,
		requestedAt: Date.now(),
	};
}

export async function performDiagnosticsRequest(request: VibeCodexDiagnosticsToolRequest): Promise<VibeCodexDiagnosticsToolResponse> {
	try {
		const scope = await diagnosticsScope(request.path);
		const ignorePolicy = await collectWorkspaceIgnorePolicy();
		if (scope.relativePath && ignoredByWorkspacePolicy(scope.relativePath, ignorePolicy)) {
			throw new Error(`Blocked diagnostics for ignored workspace path ${scope.relativePath}.`);
		}
		const counts: Record<VibeCodexDiagnosticSeverity, number> = { error: 0, warning: 0, information: 0, hint: 0 };
		const diagnostics: VibeCodexDiagnosticToolItem[] = [];
		let truncated = false;
		const selectedSeverities = new Set(request.severities);
		for (const [uri, items] of vscode.languages.getDiagnostics()) {
			const relativePath = workspaceRelativePath(uri);
			if (!relativePath || ignoredByWorkspacePolicy(relativePath, ignorePolicy) || !diagnosticInScope(relativePath, scope)) {
				continue;
			}
			for (const diagnostic of items) {
				const severity = diagnosticSeverity(diagnostic.severity);
				counts[severity]++;
				if (selectedSeverities.size && !selectedSeverities.has(severity)) {
					continue;
				}
				if (diagnostics.length >= request.maxResults) {
					truncated = true;
					continue;
				}
				diagnostics.push({
					path: relativePath,
					severity,
					message: capMessage(redactSensitiveText(diagnostic.message)),
					range: diagnosticRange(diagnostic.range),
					...(diagnostic.source ? { source: redactSensitiveText(diagnostic.source).slice(0, 180) } : {}),
					...(diagnostic.code !== undefined ? { code: diagnosticCode(diagnostic.code) } : {}),
				});
			}
		}
		return {
			ok: true,
			source: 'externalExtension',
			kind: 'get_diagnostics',
			...(request.path ? { path: request.path } : {}),
			...(request.severities.length ? { severities: request.severities } : {}),
			counts,
			diagnostics,
			truncated,
		};
	} catch (error) {
		return {
			ok: false,
			source: 'externalExtension',
			kind: 'get_diagnostics',
			...(request.path ? { path: request.path } : {}),
			...(request.severities.length ? { severities: request.severities } : {}),
			error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error)),
		};
	}
}

export function diagnosticsToolSummary(response: VibeCodexDiagnosticsToolResponse): string {
	if (!response.ok) {
		return response.error ?? 'Diagnostics request failed.';
	}
	const counts = response.counts ?? { error: 0, warning: 0, information: 0, hint: 0 };
	return `Returned ${response.diagnostics?.length ?? 0} diagnostic${response.diagnostics?.length === 1 ? '' : 's'}${response.path ? ` for ${response.path}` : ''}: ${counts.error} error(s), ${counts.warning} warning(s), ${counts.information} information, ${counts.hint} hint(s)${response.truncated ? ' with truncation' : ''}.`;
}

async function diagnosticsScope(path: string | undefined): Promise<{ readonly relativePath?: string; readonly isDirectory: boolean }> {
	if (!path || path === '.') {
		return { isDirectory: true };
	}
	const uri = resolveWorkspaceFileUri(path);
	const stat = await vscode.workspace.fs.stat(uri);
	const relativePath = workspaceRelativePath(uri);
	if (!relativePath) {
		throw new Error(`Diagnostics path is outside the open workspace: ${path}`);
	}
	return {
		relativePath,
		isDirectory: stat.type === vscode.FileType.Directory,
	};
}

function diagnosticInScope(relativePath: string, scope: { readonly relativePath?: string; readonly isDirectory: boolean }): boolean {
	if (!scope.relativePath) {
		return true;
	}
	return scope.isDirectory
		? relativePath === scope.relativePath || relativePath.startsWith(`${scope.relativePath}/`)
		: relativePath === scope.relativePath;
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const relative = pathModule.relative(folder.uri.fsPath, uri.fsPath);
		if (relative && !relative.startsWith('..') && !isAbsoluteLike(relative)) {
			return relative.replace(/\\/g, '/');
		}
		if (!relative) {
			return '.';
		}
	}
	return undefined;
}

function diagnosticSeverity(severity: vscode.DiagnosticSeverity): VibeCodexDiagnosticSeverity {
	switch (severity) {
		case vscode.DiagnosticSeverity.Error:
			return 'error';
		case vscode.DiagnosticSeverity.Warning:
			return 'warning';
		case vscode.DiagnosticSeverity.Information:
			return 'information';
		default:
			return 'hint';
	}
}

function diagnosticRange(range: vscode.Range): string {
	return `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}`;
}

function diagnosticCode(code: vscode.Diagnostic['code']): string {
	if (typeof code === 'object' && code && 'value' in code) {
		return redactSensitiveText(String(code.value)).slice(0, 180);
	}
	return redactSensitiveText(String(code)).slice(0, 180);
}

function normalizeSeverities(values: readonly (string | undefined)[]): readonly VibeCodexDiagnosticSeverity[] {
	const severities = new Set<VibeCodexDiagnosticSeverity>();
	for (const value of values) {
		const normalized = value?.toLowerCase().replace(/s$/, '');
		if (normalized === 'error' || normalized === 'warning' || normalized === 'information' || normalized === 'hint') {
			severities.add(normalized);
		}
		if (normalized === 'info') {
			severities.add('information');
		}
	}
	return [...severities];
}

function capMessage(message: string): string {
	return message.length > maxDiagnosticMessageLength ? `${message.slice(0, maxDiagnosticMessageLength)}\n[truncated]` : message;
}

function isDiagnosticsRequest(method: string, toolName: string): boolean {
	return diagnosticsMethods.has(method)
		|| toolName === 'get_diagnostics'
		|| toolName === 'list_diagnostics'
		|| toolName === 'workspace_diagnostics'
		|| toolName === 'problems';
}

function isAbsoluteLike(value: string): boolean {
	return value.startsWith('/') || value.startsWith(`..${pathModule.sep}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function arrayOfStrings(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function numberValue(value: unknown): number | undefined {
	const valueAsNumber = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(valueAsNumber) ? valueAsNumber : undefined;
}
