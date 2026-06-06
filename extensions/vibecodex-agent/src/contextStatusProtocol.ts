/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexContextPack } from './contextEngine';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexContextStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeMentions: boolean;
	readonly includeFiles: boolean;
	readonly includeSearchHits: boolean;
	readonly includeSymbols: boolean;
	readonly includeDiagnostics: boolean;
	readonly includeGit: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexContextStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly state: 'empty' | 'ready';
	readonly gatheredAt?: number;
	readonly mode?: string;
	readonly workspaceRoots: readonly string[];
	readonly counts: {
		readonly workspaceRoots: number;
		readonly mentions: number;
		readonly files: number;
		readonly filesWithText: number;
		readonly searchHits: number;
		readonly symbols: number;
		readonly diagnostics: number;
		readonly diagnosticErrors: number;
		readonly diagnosticWarnings: number;
		readonly ignoreRules: number;
		readonly gitRepositories: number;
		readonly gitChanges: number;
		readonly recentCommits: number;
		readonly terminalKnown: boolean;
	};
	readonly mentions?: readonly { readonly raw: string; readonly kind: string; readonly value: string }[];
	readonly files?: readonly { readonly path: string; readonly kind: string; readonly languageId?: string; readonly hasText: boolean }[];
	readonly searchHits?: readonly { readonly path: string; readonly score: number; readonly matchedTerms: readonly string[]; readonly strategy?: string; readonly languageId?: string; readonly hasSnippet: boolean }[];
	readonly symbolSamples?: readonly { readonly path: string; readonly name: string; readonly kind: string; readonly range: string; readonly containerName?: string }[];
	readonly diagnostics?: readonly { readonly path: string; readonly severity: string; readonly message: string; readonly range: string; readonly source?: string }[];
	readonly git?: readonly { readonly root: string; readonly branch?: string; readonly head?: string; readonly changes: number; readonly recentCommits: number }[];
	readonly summary: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

const contextStatusMethods = new Set([
	'agent/getContextStatus',
	'agent/contextStatus',
	'context/status',
	'workspace/context/status',
	'vibecodex/contextStatus',
]);

const contextStatusToolNames = new Set([
	'context_status',
	'get_context_status',
	'workspace_context_status',
]);

const maxDetailItems = 40;

export function normalizeContextStatusRequest(message: JsonRpcMessage): VibeCodexContextStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!contextStatusMethods.has(message.method) && !isContextStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const includeDetails = booleanValue(payload.includeDetails)
		?? booleanValue(payload.include_details)
		?? booleanValue(args.includeDetails)
		?? booleanValue(args.include_details)
		?? false;
	return {
		id: message.id,
		method: message.method,
		includeMentions: booleanValue(payload.includeMentions)
			?? booleanValue(payload.include_mentions)
			?? booleanValue(args.includeMentions)
			?? booleanValue(args.include_mentions)
			?? includeDetails,
		includeFiles: booleanValue(payload.includeFiles)
			?? booleanValue(payload.include_files)
			?? booleanValue(args.includeFiles)
			?? booleanValue(args.include_files)
			?? includeDetails,
		includeSearchHits: booleanValue(payload.includeSearchHits)
			?? booleanValue(payload.include_search_hits)
			?? booleanValue(args.includeSearchHits)
			?? booleanValue(args.include_search_hits)
			?? includeDetails,
		includeSymbols: booleanValue(payload.includeSymbols)
			?? booleanValue(payload.include_symbols)
			?? booleanValue(args.includeSymbols)
			?? booleanValue(args.include_symbols)
			?? includeDetails,
		includeDiagnostics: booleanValue(payload.includeDiagnostics)
			?? booleanValue(payload.include_diagnostics)
			?? booleanValue(args.includeDiagnostics)
			?? booleanValue(args.include_diagnostics)
			?? includeDetails,
		includeGit: booleanValue(payload.includeGit)
			?? booleanValue(payload.include_git)
			?? booleanValue(args.includeGit)
			?? booleanValue(args.include_git)
			?? includeDetails,
		requestedAt: Date.now(),
	};
}

export function createContextStatusResponse(request: VibeCodexContextStatusRequest, context: VibeCodexContextPack | undefined): VibeCodexContextStatusResponse {
	if (!context) {
		return {
			ok: false,
			source: 'externalExtension',
			state: 'empty',
			workspaceRoots: [],
			counts: emptyCounts(),
			summary: 'No context pack has been gathered for the active task.',
			guardrails: contextGuardrails(),
			message: 'No active Vibe Codex context pack is available yet.',
		};
	}
	const counts = contextCounts(context);
	const response: VibeCodexContextStatusResponse = {
		ok: true,
		source: 'externalExtension',
		state: 'ready',
		gatheredAt: context.gatheredAt,
		mode: context.mode,
		workspaceRoots: context.workspaceRoots.map(root => redactSensitiveText(root)),
		counts,
		...(request.includeMentions ? { mentions: context.promptMentions.slice(0, maxDetailItems).map(mention => redactSensitiveValue(mention)) as VibeCodexContextStatusResponse['mentions'] } : {}),
		...(request.includeFiles ? { files: context.files.slice(0, maxDetailItems).map(file => ({ path: redactSensitiveText(file.path), kind: file.kind, ...(file.languageId ? { languageId: redactSensitiveText(file.languageId) } : {}), hasText: !!file.text })) } : {}),
		...(request.includeSearchHits ? { searchHits: context.searchHits.slice(0, maxDetailItems).map(hit => ({ path: redactSensitiveText(hit.path), score: hit.score, matchedTerms: hit.matchedTerms.map(term => redactSensitiveText(term)), ...(hit.strategy ? { strategy: hit.strategy } : {}), ...(hit.languageId ? { languageId: redactSensitiveText(hit.languageId) } : {}), hasSnippet: !!hit.snippet })) } : {}),
		...(request.includeSymbols ? { symbolSamples: (context.symbolIndex?.entries ?? []).slice(0, maxDetailItems).map(symbol => redactSensitiveValue(symbol)) as VibeCodexContextStatusResponse['symbolSamples'] } : {}),
		...(request.includeDiagnostics ? { diagnostics: context.diagnostics.slice(0, maxDetailItems).map(diagnostic => redactSensitiveValue(diagnostic)) as VibeCodexContextStatusResponse['diagnostics'] } : {}),
		...(request.includeGit ? { git: (context.git?.repositories ?? []).slice(0, maxDetailItems).map(repository => ({ root: redactSensitiveText(repository.root), ...(repository.branch ? { branch: redactSensitiveText(repository.branch) } : {}), ...(repository.head ? { head: redactSensitiveText(repository.head) } : {}), changes: repository.changes.length, recentCommits: repository.recentCommits.length })) } : {}),
		summary: contextStatusSummaryFromCounts(counts),
		guardrails: contextGuardrails(),
		message: `Context status: ${counts.files} file reference${counts.files === 1 ? '' : 's'}, ${counts.searchHits} search hit${counts.searchHits === 1 ? '' : 's'}, ${counts.symbols} symbol${counts.symbols === 1 ? '' : 's'}, ${counts.diagnostics} diagnostic${counts.diagnostics === 1 ? '' : 's'}.`,
	};
	return redactSensitiveValue(response) as VibeCodexContextStatusResponse;
}

export function contextStatusSummary(response: VibeCodexContextStatusResponse): string {
	return response.summary;
}

function contextCounts(context: VibeCodexContextPack): VibeCodexContextStatusResponse['counts'] {
	const diagnostics = context.diagnostics;
	const gitRepositories = context.git?.repositories ?? [];
	return {
		workspaceRoots: context.workspaceRoots.length,
		mentions: context.promptMentions.length,
		files: context.files.length,
		filesWithText: context.files.filter(file => !!file.text).length,
		searchHits: context.searchHits.length,
		symbols: context.symbolIndex?.entries.length ?? 0,
		diagnostics: diagnostics.length,
		diagnosticErrors: diagnostics.filter(item => item.severity === 'error').length,
		diagnosticWarnings: diagnostics.filter(item => item.severity === 'warning').length,
		ignoreRules: context.ignorePolicy?.rules.length ?? 0,
		gitRepositories: gitRepositories.length,
		gitChanges: gitRepositories.reduce((sum, repository) => sum + repository.changes.length, 0),
		recentCommits: gitRepositories.reduce((sum, repository) => sum + repository.recentCommits.length, 0),
		terminalKnown: !!context.terminal,
	};
}

function emptyCounts(): VibeCodexContextStatusResponse['counts'] {
	return {
		workspaceRoots: 0,
		mentions: 0,
		files: 0,
		filesWithText: 0,
		searchHits: 0,
		symbols: 0,
		diagnostics: 0,
		diagnosticErrors: 0,
		diagnosticWarnings: 0,
		ignoreRules: 0,
		gitRepositories: 0,
		gitChanges: 0,
		recentCommits: 0,
		terminalKnown: false,
	};
}

function contextStatusSummaryFromCounts(counts: VibeCodexContextStatusResponse['counts']): string {
	return [
		`${counts.files} file reference${counts.files === 1 ? '' : 's'}`,
		`${counts.searchHits} ranked search hit${counts.searchHits === 1 ? '' : 's'}`,
		`${counts.symbols} symbol${counts.symbols === 1 ? '' : 's'}`,
		`${counts.diagnostics} diagnostic${counts.diagnostics === 1 ? '' : 's'} (${counts.diagnosticErrors} error${counts.diagnosticErrors === 1 ? '' : 's'})`,
		`${counts.gitRepositories} git repositor${counts.gitRepositories === 1 ? 'y' : 'ies'}`,
		counts.terminalKnown ? 'terminal metadata present' : 'no terminal metadata',
	].join('; ');
}

function contextGuardrails(): readonly string[] {
	return [
		'Context status is read-only and never gathers fresh files, executes symbol providers, runs Git, reads terminal output, or changes workspace state.',
		'File text, selected text, search snippets, terminal output, and raw Git diffs are intentionally omitted from this status response.',
		'Use read_file, grep_search, codebase_search, get_diagnostics, git_status, or other explicit read-only tools for bounded exact context after inspecting this status.',
	];
}

function isContextStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return contextStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
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
