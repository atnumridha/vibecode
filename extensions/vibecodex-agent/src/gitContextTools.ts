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

type ExecFileFunction = (file: string, args: readonly string[], options: { readonly cwd?: string; readonly timeout?: number; readonly maxBuffer?: number }, callback: (error: Error | null, stdout: string, stderr: string) => void) => void;

export type VibeCodexGitContextToolKind = 'status' | 'diff' | 'log';

export interface VibeCodexGitContextToolRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: VibeCodexGitContextToolKind;
	readonly path?: string;
	readonly root?: string;
	readonly staged: boolean;
	readonly limit: number;
	readonly requestedAt: number;
}

export interface VibeCodexGitContextToolResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly kind: VibeCodexGitContextToolKind;
	readonly root?: string;
	readonly path?: string;
	readonly staged?: boolean;
	readonly command: readonly string[];
	readonly output?: string;
	readonly truncated?: boolean;
	readonly error?: string;
}

const { execFile } = require('child_process') as { readonly execFile: ExecFileFunction };
const pathModule = require('path') as {
	readonly relative: (from: string, to: string) => string;
	readonly sep: string;
};

const defaultLogLimit = 12;
const maxLogLimit = 50;
const maxGitOutputChars = 60000;
const gitTimeoutMs = 5000;

const gitStatusMethods = new Set([
	'workspace/gitStatus',
	'workspace/git/status',
	'agent/gitStatus',
	'agent/git/status',
	'git/status',
]);

const gitDiffMethods = new Set([
	'workspace/gitDiff',
	'workspace/git/diff',
	'agent/gitDiff',
	'agent/git/diff',
	'git/diff',
]);

const gitLogMethods = new Set([
	'workspace/gitLog',
	'workspace/git/log',
	'agent/gitLog',
	'agent/git/log',
	'git/log',
]);

export function normalizeGitContextRequest(message: JsonRpcMessage): VibeCodexGitContextToolRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	const operation = (stringValue(payload.operation) ?? stringValue(args.operation) ?? '').toLowerCase();
	const kind = classifyGitContextTool(message.method, toolName, operation);
	if (!kind) {
		return undefined;
	}
	const path = stringValue(payload.path)
		?? stringValue(args.path)
		?? stringValue(payload.file)
		?? stringValue(args.file)
		?? stringValue(payload.filePath)
		?? stringValue(args.filePath);
	const root = stringValue(payload.root)
		?? stringValue(args.root)
		?? stringValue(payload.workspaceRoot)
		?? stringValue(args.workspaceRoot)
		?? stringValue(payload.cwd)
		?? stringValue(args.cwd);
	const limit = Math.max(1, Math.min(maxLogLimit, numberValue(payload.limit) ?? numberValue(args.limit) ?? numberValue(payload.maxResults) ?? numberValue(args.maxResults) ?? defaultLogLimit));
	return {
		id: message.id,
		method: message.method,
		kind,
		...(path ? { path } : {}),
		...(root ? { root } : {}),
		staged: booleanValue(payload.staged) ?? booleanValue(args.staged) ?? booleanValue(payload.cached) ?? booleanValue(args.cached) ?? false,
		limit,
		requestedAt: Date.now(),
	};
}

export async function performGitContextTool(request: VibeCodexGitContextToolRequest): Promise<VibeCodexGitContextToolResponse> {
	try {
		if (!vscode.workspace.isTrusted) {
			throw new Error('Trust the workspace before serving backend Git context requests.');
		}
		const target = await resolveGitTarget(request);
		const command = gitCommandForRequest(request, target.relativePath);
		const run = await runGitCommand(target.root, command);
		return {
			ok: run.ok,
			source: 'externalExtension',
			kind: request.kind,
			root: target.root,
			...(target.relativePath ? { path: target.relativePath } : {}),
			...(request.kind === 'diff' ? { staged: request.staged } : {}),
			command: ['git', ...command],
			...(run.output ? { output: run.output } : {}),
			...(run.truncated ? { truncated: true } : {}),
			...(run.error ? { error: run.error } : {}),
		};
	} catch (error) {
		return {
			ok: false,
			source: 'externalExtension',
			kind: request.kind,
			...(request.path ? { path: request.path } : {}),
			...(request.kind === 'diff' ? { staged: request.staged } : {}),
			command: ['git'],
			error: error instanceof Error ? redactSensitiveText(error.message) : redactSensitiveText(String(error)),
		};
	}
}

export function gitContextToolSummary(response: VibeCodexGitContextToolResponse): string {
	if (!response.ok) {
		return response.error ?? `Git ${response.kind} failed.`;
	}
	const target = response.path ? ` for ${response.path}` : '';
	const staged = response.kind === 'diff' && response.staged ? ' staged' : '';
	return `Read Git${staged} ${response.kind}${target}${response.truncated ? ' with truncation' : ''}.`;
}

async function resolveGitTarget(request: VibeCodexGitContextToolRequest): Promise<{ readonly root: string; readonly relativePath?: string }> {
	const folder = workspaceFolderForRoot(request.root);
	if (request.kind !== 'diff' || !request.path || request.path === '.') {
		return { root: folder.uri.fsPath };
	}
	const uri = resolveWorkspaceFileUri(request.path);
	const pathFolder = vscode.workspace.getWorkspaceFolder(uri);
	if (!pathFolder) {
		throw new Error(`Git diff path is outside the open workspace: ${request.path}`);
	}
	const nativeRelativePath = pathModule.relative(pathFolder.uri.fsPath, uri.fsPath);
	const relativePath = nativeRelativePath.replace(/\\/g, '/');
	if (!relativePath || relativePath === '.' || relativePath === '..' || relativePath.startsWith('../') || nativeRelativePath.startsWith(`..${pathModule.sep}`)) {
		throw new Error(`Git diff path is outside the selected workspace root: ${request.path}`);
	}
	const ignoredBy = ignoredByWorkspacePolicy(relativePath, await collectWorkspaceIgnorePolicy());
	if (ignoredBy) {
		throw new Error(`Blocked Git diff for ignored workspace path ${relativePath} by ${ignoredBy}.`);
	}
	return {
		root: pathFolder.uri.fsPath,
		relativePath,
	};
}

function workspaceFolderForRoot(rootHint: string | undefined): vscode.WorkspaceFolder {
	const folders = vscode.workspace.workspaceFolders ?? [];
	if (!folders.length) {
		throw new Error('Open a workspace before serving Git context requests.');
	}
	if (!rootHint || rootHint === '.') {
		return folders[0];
	}
	const uri = resolveWorkspaceFileUri(rootHint);
	const folder = vscode.workspace.getWorkspaceFolder(uri);
	if (!folder) {
		throw new Error(`Git root is outside the open workspace: ${rootHint}`);
	}
	return folder;
}

function gitCommandForRequest(request: VibeCodexGitContextToolRequest, relativePath: string | undefined): readonly string[] {
	if (request.kind === 'status') {
		return ['status', '--short', '--branch'];
	}
	if (request.kind === 'log') {
		return ['log', '--oneline', '--decorate', `-${request.limit}`];
	}
	const args = request.staged ? ['diff', '--cached', '--unified=3'] : ['diff', '--unified=3'];
	return relativePath ? [...args, '--', relativePath] : args;
}

async function runGitCommand(root: string, args: readonly string[]): Promise<{ readonly ok: boolean; readonly output?: string; readonly truncated?: boolean; readonly error?: string }> {
	return new Promise(resolve => {
		execFile('git', args, { cwd: root, timeout: gitTimeoutMs, maxBuffer: maxGitOutputChars + 4096 }, (error, stdout, stderr) => {
			const output = truncateGitOutput(redactSensitiveText((stdout || '').trim()));
			const errorText = redactSensitiveText(((stderr || '') || (error?.message ?? '')).trim());
			if (error && !output.text) {
				resolve({
					ok: false,
					...(errorText ? { error: errorText } : { error: `Git command failed: git ${args.join(' ')}` }),
				});
				return;
			}
			resolve({
				ok: !error || !!output.text,
				...(output.text ? { output: output.text } : {}),
				...(output.truncated || /maxBuffer/i.test(error?.message ?? '') ? { truncated: true } : {}),
				...(error && errorText ? { error: errorText } : {}),
			});
		});
	});
}

function truncateGitOutput(text: string): { readonly text: string; readonly truncated: boolean } {
	if (text.length <= maxGitOutputChars) {
		return { text, truncated: false };
	}
	return {
		text: `${text.slice(0, maxGitOutputChars)}\n[truncated]`,
		truncated: true,
	};
}

function classifyGitContextTool(method: string, toolName: string, operation: string): VibeCodexGitContextToolKind | undefined {
	if (gitStatusMethods.has(method) || toolName === 'git_status' || toolName === 'git.status' || operation === 'git_status' || operation === 'status') {
		return 'status';
	}
	if (gitDiffMethods.has(method) || toolName === 'git_diff' || toolName === 'git.diff' || operation === 'git_diff' || operation === 'diff') {
		return 'diff';
	}
	if (gitLogMethods.has(method) || toolName === 'git_log' || toolName === 'git.log' || operation === 'git_log' || operation === 'log') {
		return 'log';
	}
	if (method !== 'item/tool/call') {
		return undefined;
	}
	if (toolName === 'git' || toolName === 'git_context' || toolName === 'context.git') {
		if (operation === 'status' || operation === 'diff' || operation === 'log') {
			return operation;
		}
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
	const valueAsNumber = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(valueAsNumber) ? valueAsNumber : undefined;
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
