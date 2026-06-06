/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexContextPack } from './contextEngine';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexContextIndexStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeSources: boolean;
	readonly includeSamples: boolean;
	readonly maxItems: number;
	readonly requestedAt: number;
}

export interface VibeCodexContextIndexStatusSource {
	readonly id: 'workspaceRoots' | 'activeEditor' | 'mentions' | 'lexicalSearch' | 'symbolIndex' | 'diagnostics' | 'git' | 'terminal' | 'ignorePolicy';
	readonly title: string;
	readonly ready: boolean;
	readonly count: number;
	readonly stale: boolean;
	readonly detail: string;
	readonly blockedReason?: string;
}

export interface VibeCodexContextIndexStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly available: boolean;
	readonly generatedAt: number;
	readonly gatheredAt?: number;
	readonly ageMs?: number;
	readonly mode?: string;
	readonly workspaceTrusted: boolean;
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
		readonly gitRepositories: number;
		readonly gitChanges: number;
		readonly terminalKnown: boolean;
		readonly ignoreRules: number;
	};
	readonly readiness: {
		readonly readyForPlanning: boolean;
		readonly needsFreshGather: boolean;
		readonly stale: boolean;
		readonly hasWorkspace: boolean;
		readonly blockingReasons: readonly string[];
		readonly missingSources: readonly string[];
	};
	readonly sources?: readonly VibeCodexContextIndexStatusSource[];
	readonly samples?: {
		readonly files?: readonly { readonly path: string; readonly kind: string; readonly languageId?: string; readonly hasText: boolean }[];
		readonly searchHits?: readonly { readonly path: string; readonly score: number; readonly matchedTerms: readonly string[]; readonly strategy?: string; readonly languageId?: string; readonly hasSnippet: boolean }[];
		readonly symbols?: readonly { readonly path: string; readonly name: string; readonly kind: string; readonly range: string; readonly containerName?: string }[];
		readonly diagnostics?: readonly { readonly path: string; readonly severity: string; readonly range: string; readonly source?: string }[];
		readonly gitRepositories?: readonly { readonly root: string; readonly branch?: string; readonly head?: string; readonly changes: number; readonly recentCommits: number }[];
		readonly ignoreSources?: readonly string[];
	};
	readonly guardrails: readonly string[];
	readonly message: string;
	readonly promptBlock: string;
}

export interface VibeCodexContextIndexStatusInput {
	readonly context?: VibeCodexContextPack;
	readonly workspaceRoots?: readonly string[];
	readonly workspaceTrusted?: boolean;
	readonly generatedAt?: number;
}

const contextIndexStatusMethods = new Set([
	'agent/getContextIndexStatus',
	'agent/contextIndexStatus',
	'context/indexStatus',
	'context/index/status',
	'index/status',
	'workspace/indexStatus',
	'workspace/index/status',
	'vibecodex/contextIndexStatus',
]);

const contextIndexStatusToolNames = new Set([
	'context_index_status',
	'get_context_index_status',
	'workspace_index_status',
	'codebase_index_status',
	'search_index_status',
	'index_status',
]);

const maxDetailItems = 40;
const defaultMaxItems = 12;
const contextStaleAfterMs = 5 * 60 * 1000;

export function normalizeContextIndexStatusRequest(message: JsonRpcMessage): VibeCodexContextIndexStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!contextIndexStatusMethods.has(message.method) && !isContextIndexStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeSources: booleanValue(payload.includeSources)
			?? booleanValue(payload.include_sources)
			?? booleanValue(args.includeSources)
			?? booleanValue(args.include_sources)
			?? true,
		includeSamples: booleanValue(payload.includeSamples)
			?? booleanValue(payload.include_samples)
			?? booleanValue(args.includeSamples)
			?? booleanValue(args.include_samples)
			?? false,
		maxItems: boundedInteger(payload.maxItems ?? payload.max_items ?? args.maxItems ?? args.max_items, defaultMaxItems, 0, maxDetailItems),
		requestedAt: Date.now(),
	};
}

export function createContextIndexStatusResponse(request: VibeCodexContextIndexStatusRequest, input: VibeCodexContextIndexStatusInput): VibeCodexContextIndexStatusResponse {
	const generatedAt = input.generatedAt ?? Date.now();
	const context = input.context;
	const workspaceRoots = (context?.workspaceRoots.length ? context.workspaceRoots : input.workspaceRoots ?? []).map(root => redactSensitiveText(root));
	const counts = context ? contextIndexCounts(context) : emptyCounts(workspaceRoots.length);
	const ageMs = context ? Math.max(0, generatedAt - context.gatheredAt) : undefined;
	const stale = !context || (ageMs ?? 0) > contextStaleAfterMs;
	const rootMismatch = !!context && !!input.workspaceRoots?.length && !sameStringSet(context.workspaceRoots, input.workspaceRoots);
	const blockingReasons = readinessBlockers(context, workspaceRoots, stale, rootMismatch);
	const missingSources = missingSourceIds(context);
	const readiness = {
		readyForPlanning: !!context && workspaceRoots.length > 0 && blockingReasons.length === 0,
		needsFreshGather: !context || stale || rootMismatch,
		stale,
		hasWorkspace: workspaceRoots.length > 0,
		blockingReasons,
		missingSources,
	};
	const responseBase = {
		ok: !!context,
		source: 'externalExtension' as const,
		available: !!context,
		generatedAt,
		...(context ? { gatheredAt: context.gatheredAt } : {}),
		...(ageMs !== undefined ? { ageMs } : {}),
		...(context?.mode ? { mode: context.mode } : {}),
		workspaceTrusted: input.workspaceTrusted !== false,
		workspaceRoots,
		counts,
		readiness,
		...(request.includeSources ? { sources: contextIndexSources(context, counts, stale, workspaceRoots.length) } : {}),
		...(request.includeSamples && context ? { samples: contextIndexSamples(context, request.maxItems) } : {}),
		guardrails: contextIndexGuardrails(),
		message: contextIndexStatusMessage(counts, readiness),
	};
	const response = redactSensitiveValue({
		...responseBase,
		promptBlock: contextIndexStatusPromptBlock(responseBase),
	}) as VibeCodexContextIndexStatusResponse;
	return response;
}

export function contextIndexStatusSummary(response: VibeCodexContextIndexStatusResponse): string {
	return response.message;
}

function contextIndexCounts(context: VibeCodexContextPack): VibeCodexContextIndexStatusResponse['counts'] {
	const repositories = context.git?.repositories ?? [];
	return {
		workspaceRoots: context.workspaceRoots.length,
		mentions: context.promptMentions.length,
		files: context.files.length,
		filesWithText: context.files.filter(file => !!file.text).length,
		searchHits: context.searchHits.length,
		symbols: context.symbolIndex?.entries.length ?? 0,
		diagnostics: context.diagnostics.length,
		diagnosticErrors: context.diagnostics.filter(diagnostic => diagnostic.severity === 'error').length,
		diagnosticWarnings: context.diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length,
		gitRepositories: repositories.length,
		gitChanges: repositories.reduce((sum, repository) => sum + repository.changes.length, 0),
		terminalKnown: !!context.terminal,
		ignoreRules: context.ignorePolicy?.rules.length ?? 0,
	};
}

function emptyCounts(workspaceRoots: number): VibeCodexContextIndexStatusResponse['counts'] {
	return {
		workspaceRoots,
		mentions: 0,
		files: 0,
		filesWithText: 0,
		searchHits: 0,
		symbols: 0,
		diagnostics: 0,
		diagnosticErrors: 0,
		diagnosticWarnings: 0,
		gitRepositories: 0,
		gitChanges: 0,
		terminalKnown: false,
		ignoreRules: 0,
	};
}

function contextIndexSources(context: VibeCodexContextPack | undefined, counts: VibeCodexContextIndexStatusResponse['counts'], stale: boolean, workspaceRootCount: number): readonly VibeCodexContextIndexStatusSource[] {
	return [
		sourceStatus('workspaceRoots', 'Workspace roots', workspaceRootCount > 0, workspaceRootCount, stale, workspaceRootCount > 0 ? `${workspaceRootCount} workspace root${workspaceRootCount === 1 ? '' : 's'} visible to the extension.` : 'No workspace root is open.', workspaceRootCount > 0 ? undefined : 'Open a trusted workspace before planning code changes.'),
		sourceStatus('activeEditor', 'Active editor', !!context?.activeEditor, context?.activeEditor ? 1 : 0, stale, context?.activeEditor ? `Active ${context.activeEditor.languageId || 'text'} file captured.` : 'No active editor context was captured.'),
		sourceStatus('mentions', '@ mentions', counts.mentions > 0, counts.mentions, stale, counts.mentions ? `${counts.mentions} prompt mention${counts.mentions === 1 ? '' : 's'} parsed.` : 'No @ context mentions were parsed for the last prompt.'),
		sourceStatus('lexicalSearch', 'Lexical codebase search', counts.searchHits > 0, counts.searchHits, stale, counts.searchHits ? `${counts.searchHits} ranked lexical/codebase hit${counts.searchHits === 1 ? '' : 's'} available.` : 'No ranked lexical search hits were collected for the last prompt.'),
		sourceStatus('symbolIndex', 'Symbol index', counts.symbols > 0, counts.symbols, stale, counts.symbols ? `${counts.symbols} bounded VS Code symbol${counts.symbols === 1 ? '' : 's'} indexed.` : 'No symbol entries were collected; backend can call list_code_definition_names for exact symbol reads.'),
		sourceStatus('diagnostics', 'Diagnostics', !!context, counts.diagnostics, stale, `${counts.diagnostics} diagnostic${counts.diagnostics === 1 ? '' : 's'} captured, including ${counts.diagnosticErrors} error${counts.diagnosticErrors === 1 ? '' : 's'}.`),
		sourceStatus('git', 'Git state', counts.gitRepositories > 0, counts.gitRepositories, stale, counts.gitRepositories ? `${counts.gitRepositories} git repositor${counts.gitRepositories === 1 ? 'y' : 'ies'} with ${counts.gitChanges} changed path${counts.gitChanges === 1 ? '' : 's'}.` : 'No Git repository metadata was captured.'),
		sourceStatus('terminal', 'Terminal metadata', counts.terminalKnown, counts.terminalKnown ? 1 : 0, stale, counts.terminalKnown ? 'Active terminal metadata is known.' : 'No active terminal metadata was captured.'),
		sourceStatus('ignorePolicy', 'Workspace ignore policy', !!context, counts.ignoreRules, stale, counts.ignoreRules ? `${counts.ignoreRules} Cline/Cursor/Codex/VibeCodex ignore rule${counts.ignoreRules === 1 ? '' : 's'} loaded.` : 'No workspace ignore rules were loaded; default excludes still apply during gathering.'),
	];
}

function sourceStatus(id: VibeCodexContextIndexStatusSource['id'], title: string, ready: boolean, count: number, stale: boolean, detail: string, blockedReason?: string): VibeCodexContextIndexStatusSource {
	return {
		id,
		title,
		ready,
		count,
		stale,
		detail: redactSensitiveText(detail),
		...(blockedReason ? { blockedReason: redactSensitiveText(blockedReason) } : {}),
	};
}

function contextIndexSamples(context: VibeCodexContextPack, maxItems: number): VibeCodexContextIndexStatusResponse['samples'] {
	const limit = Math.max(0, Math.min(maxDetailItems, maxItems));
	return {
		files: context.files.slice(0, limit).map(file => ({
			path: redactSensitiveText(file.path),
			kind: file.kind,
			...(file.languageId ? { languageId: redactSensitiveText(file.languageId) } : {}),
			hasText: !!file.text,
		})),
		searchHits: context.searchHits.slice(0, limit).map(hit => ({
			path: redactSensitiveText(hit.path),
			score: hit.score,
			matchedTerms: hit.matchedTerms.map(term => redactSensitiveText(term)),
			...(hit.strategy ? { strategy: hit.strategy } : {}),
			...(hit.languageId ? { languageId: redactSensitiveText(hit.languageId) } : {}),
			hasSnippet: !!hit.snippet,
		})),
		symbols: (context.symbolIndex?.entries ?? []).slice(0, limit).map(symbol => redactSensitiveValue(symbol)) as NonNullable<VibeCodexContextIndexStatusResponse['samples']>['symbols'],
		diagnostics: context.diagnostics.slice(0, limit).map(diagnostic => ({
			path: redactSensitiveText(diagnostic.path),
			severity: diagnostic.severity,
			range: redactSensitiveText(diagnostic.range),
			...(diagnostic.source ? { source: redactSensitiveText(diagnostic.source) } : {}),
		})),
		gitRepositories: (context.git?.repositories ?? []).slice(0, limit).map(repository => ({
			root: redactSensitiveText(repository.root),
			...(repository.branch ? { branch: redactSensitiveText(repository.branch) } : {}),
			...(repository.head ? { head: redactSensitiveText(repository.head) } : {}),
			changes: repository.changes.length,
			recentCommits: repository.recentCommits.length,
		})),
		ignoreSources: (context.ignorePolicy?.sources ?? []).slice(0, limit).map(source => redactSensitiveText(source)),
	};
}

function readinessBlockers(context: VibeCodexContextPack | undefined, workspaceRoots: readonly string[], stale: boolean, rootMismatch: boolean): readonly string[] {
	const blockers: string[] = [];
	if (!context) {
		blockers.push('No context pack has been gathered for the active task.');
	}
	if (!workspaceRoots.length) {
		blockers.push('No workspace root is open for code-aware planning.');
	}
	if (stale && context) {
		blockers.push('The gathered context is older than the freshness window; gather fresh context before acting on a new prompt.');
	}
	if (rootMismatch) {
		blockers.push('The gathered context workspace roots differ from the currently open workspace roots.');
	}
	return blockers.map(redactSensitiveText);
}

function missingSourceIds(context: VibeCodexContextPack | undefined): readonly string[] {
	if (!context) {
		return ['workspaceRoots', 'activeEditor', 'mentions', 'lexicalSearch', 'symbolIndex', 'diagnostics', 'git', 'terminal', 'ignorePolicy'];
	}
	const missing: string[] = [];
	if (!context.workspaceRoots.length) {
		missing.push('workspaceRoots');
	}
	if (!context.activeEditor) {
		missing.push('activeEditor');
	}
	if (!context.promptMentions.length) {
		missing.push('mentions');
	}
	if (!context.searchHits.length) {
		missing.push('lexicalSearch');
	}
	if (!context.symbolIndex?.entries.length) {
		missing.push('symbolIndex');
	}
	if (!context.git?.repositories.length) {
		missing.push('git');
	}
	if (!context.terminal) {
		missing.push('terminal');
	}
	if (!context.ignorePolicy?.rules.length) {
		missing.push('ignorePolicy');
	}
	return missing;
}

function contextIndexStatusMessage(counts: VibeCodexContextIndexStatusResponse['counts'], readiness: VibeCodexContextIndexStatusResponse['readiness']): string {
	if (!readiness.readyForPlanning) {
		return `Context index needs refresh: ${readiness.blockingReasons[0] ?? 'missing source context'}`;
	}
	return `Context index ready for planning: ${counts.files} file reference${counts.files === 1 ? '' : 's'}, ${counts.searchHits} search hit${counts.searchHits === 1 ? '' : 's'}, ${counts.symbols} symbol${counts.symbols === 1 ? '' : 's'}, ${counts.diagnostics} diagnostic${counts.diagnostics === 1 ? '' : 's'}, ${counts.gitRepositories} git repositor${counts.gitRepositories === 1 ? 'y' : 'ies'}.`;
}

function contextIndexGuardrails(): readonly string[] {
	return [
		'Context index status is read-only and never gathers fresh files, executes symbol providers, runs Git, reads terminal output, approves plans, or changes workspace state.',
		'File text, selected text, search snippets, diagnostic messages, terminal output, raw Git diffs, and approval tokens are intentionally omitted from this response.',
		'Use explicit read-only tools such as read_file, search_files, semantic_search, list_code_definition_names, get_diagnostics, or git_status for bounded exact context after inspecting readiness.',
	];
}

function contextIndexStatusPromptBlock(response: Omit<VibeCodexContextIndexStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		source: response.source,
		available: response.available,
		gatheredAt: response.gatheredAt,
		ageMs: response.ageMs,
		mode: response.mode,
		workspaceTrusted: response.workspaceTrusted,
		counts: response.counts,
		readiness: response.readiness,
		sources: response.sources,
		note: 'Read-only context-index readiness summary. It never contains file text or snippets and does not grant mutation approval.',
	}), null, 2);
}

function isContextIndexStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return contextIndexStatusToolNames.has(tool);
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

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
	const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
	if (!Number.isFinite(raw)) {
		return fallback;
	}
	return Math.max(min, Math.min(max, Math.floor(raw)));
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	const values = new Set(left);
	return right.every(value => values.has(value));
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
