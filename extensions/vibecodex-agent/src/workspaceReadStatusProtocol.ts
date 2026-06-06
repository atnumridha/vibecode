/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexWorkspaceReadToolKind, VibeCodexWorkspaceReadToolRequest, VibeCodexWorkspaceReadToolResponse } from './workspaceReadTools';

export interface VibeCodexWorkspaceReadStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind?: VibeCodexWorkspaceReadToolKind;
	readonly includeEvents: boolean;
	readonly includeSamples: boolean;
	readonly includePromptBlock: boolean;
	readonly maxEvents: number;
	readonly maxSamples: number;
	readonly requestedAt: number;
}

export interface VibeCodexWorkspaceReadEvidenceEvent {
	readonly id: string;
	readonly method: string;
	readonly kind: VibeCodexWorkspaceReadToolKind;
	readonly requestedAt: number;
	readonly completedAt: number;
	readonly ok: boolean;
	readonly path?: string;
	readonly paths: readonly string[];
	readonly query?: string;
	readonly isRegex: boolean;
	readonly caseSensitive: boolean;
	readonly recursive: boolean;
	readonly maxResults: number;
	readonly counts: {
		readonly files: number;
		readonly entries: number;
		readonly hits: number;
	};
	readonly truncated: boolean;
	readonly summary: string;
	readonly error?: string;
	readonly samples?: {
		readonly files?: readonly VibeCodexWorkspaceReadFileEvidence[];
		readonly entries?: readonly VibeCodexWorkspaceReadEntryEvidence[];
		readonly hits?: readonly VibeCodexWorkspaceReadHitEvidence[];
	};
}

export interface VibeCodexWorkspaceReadFileEvidence {
	readonly path: string;
	readonly truncated: boolean;
	readonly startLine?: number;
	readonly endLine?: number;
	readonly totalLines?: number;
	readonly textLength: number;
}

export interface VibeCodexWorkspaceReadEntryEvidence {
	readonly path: string;
	readonly type: string;
}

export interface VibeCodexWorkspaceReadHitEvidence {
	readonly path: string;
	readonly line: number;
	readonly preview: string;
	readonly strategy?: string;
	readonly score?: number;
	readonly matchedTerms?: readonly string[];
}

export interface VibeCodexWorkspaceReadStatusCounts {
	readonly total: number;
	readonly successful: number;
	readonly failed: number;
	readonly truncated: number;
	readonly readFile: number;
	readonly listDir: number;
	readonly searchFiles: number;
	readonly semanticSearch: number;
	readonly files: number;
	readonly entries: number;
	readonly hits: number;
}

export interface VibeCodexWorkspaceReadStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly method: string;
	readonly generatedAt: number;
	readonly state: 'empty' | 'ready';
	readonly hasEvidence: boolean;
	readonly filterKind?: VibeCodexWorkspaceReadToolKind;
	readonly totalEvents: number;
	readonly filteredEvents: number;
	readonly counts: VibeCodexWorkspaceReadStatusCounts;
	readonly latest?: VibeCodexWorkspaceReadEvidenceEvent;
	readonly events?: readonly VibeCodexWorkspaceReadEvidenceEvent[];
	readonly readiness: {
		readonly hasReadEvidence: boolean;
		readonly hasSearchEvidence: boolean;
		readonly hasSemanticEvidence: boolean;
		readonly latestFailure?: string;
	};
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

const workspaceReadStatusMethods = new Set([
	'agent/getWorkspaceReadStatus',
	'agent/workspaceReadStatus',
	'agent/getWorkspaceSearchStatus',
	'agent/workspaceSearchStatus',
	'workspace/readStatus',
	'workspace/searchStatus',
	'context/workspaceReadStatus',
	'context/searchStatus',
	'vibecodex/workspaceReadStatus',
]);

const workspaceReadStatusToolNames = new Set([
	'workspace_read_status',
	'workspace_search_status',
	'codebase_search_status',
	'read_tool_status',
	'context_evidence_status',
]);

const workspaceReadKinds: readonly VibeCodexWorkspaceReadToolKind[] = ['read_file', 'list_dir', 'search_files', 'semantic_search'];
const defaultMaxEvents = 8;
const hardMaxEvents = 40;
const defaultMaxSamples = 6;
const hardMaxSamples = 20;
const maxPromptEvents = 8;

export function normalizeWorkspaceReadStatusRequest(message: JsonRpcMessage): VibeCodexWorkspaceReadStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!workspaceReadStatusMethods.has(message.method) && !isWorkspaceReadStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const kind = workspaceReadKindValue(payload.kind)
		?? workspaceReadKindValue(args.kind)
		?? workspaceReadKindValue(payload.toolKind)
		?? workspaceReadKindValue(args.toolKind)
		?? workspaceReadKindValue(payload.tool_kind)
		?? workspaceReadKindValue(args.tool_kind);
	return {
		id: message.id,
		method: message.method,
		...(kind ? { kind } : {}),
		includeEvents: booleanValue(payload.includeEvents)
			?? booleanValue(payload.include_events)
			?? booleanValue(args.includeEvents)
			?? booleanValue(args.include_events)
			?? true,
		includeSamples: booleanValue(payload.includeSamples)
			?? booleanValue(payload.include_samples)
			?? booleanValue(args.includeSamples)
			?? booleanValue(args.include_samples)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		maxEvents: boundedInteger(payload.maxEvents ?? payload.max_events ?? args.maxEvents ?? args.max_events, defaultMaxEvents, hardMaxEvents),
		maxSamples: boundedInteger(payload.maxSamples ?? payload.max_samples ?? args.maxSamples ?? args.max_samples, defaultMaxSamples, hardMaxSamples),
		requestedAt: Date.now(),
	};
}

export function createWorkspaceReadEvidenceEvent(
	request: VibeCodexWorkspaceReadToolRequest,
	response: VibeCodexWorkspaceReadToolResponse,
	summary: string,
	maxSamples = defaultMaxSamples
): VibeCodexWorkspaceReadEvidenceEvent {
	const sampleLimit = Math.max(0, Math.min(hardMaxSamples, Math.floor(maxSamples)));
	const files = response.files ?? [];
	const entries = response.entries ?? [];
	const hits = response.hits ?? [];
	return {
		id: redactSensitiveText(String(request.id)),
		method: redactSensitiveText(request.method),
		kind: request.kind,
		requestedAt: request.requestedAt,
		completedAt: Date.now(),
		ok: response.ok,
		...(request.path ? { path: redactSensitiveText(request.path) } : {}),
		paths: request.paths.map(path => redactSensitiveText(path)).slice(0, 12),
		...(request.query ? { query: redactSensitiveText(request.query) } : {}),
		isRegex: request.isRegex,
		caseSensitive: request.caseSensitive,
		recursive: request.recursive,
		maxResults: request.maxResults,
		counts: {
			files: files.length,
			entries: entries.length,
			hits: hits.length,
		},
		truncated: Boolean(response.truncated),
		summary: redactSensitiveText(summary),
		...(response.error ? { error: redactSensitiveText(response.error) } : {}),
		samples: sampleLimit > 0 ? {
			...(files.length ? { files: files.slice(0, sampleLimit).map(file => ({
				path: redactSensitiveText(file.path),
				truncated: file.truncated,
				...(file.startLine ? { startLine: file.startLine } : {}),
				...(file.endLine ? { endLine: file.endLine } : {}),
				...(file.totalLines ? { totalLines: file.totalLines } : {}),
				textLength: file.text.length,
			})) } : {}),
			...(entries.length ? { entries: entries.slice(0, sampleLimit).map(entry => ({
				path: redactSensitiveText(entry.path),
				type: entry.type,
			})) } : {}),
			...(hits.length ? { hits: hits.slice(0, sampleLimit).map(hit => ({
				path: redactSensitiveText(hit.path),
				line: hit.line,
				preview: redactSensitiveText(hit.preview).slice(0, 500),
				...(hit.strategy ? { strategy: hit.strategy } : {}),
				...(typeof hit.score === 'number' ? { score: Math.round(hit.score * 1000) / 1000 } : {}),
				...(hit.matchedTerms?.length ? { matchedTerms: hit.matchedTerms.map(term => redactSensitiveText(term)).slice(0, 12) } : {}),
			})) } : {}),
		} : {},
	};
}

export function createWorkspaceReadStatusResponse(
	request: VibeCodexWorkspaceReadStatusRequest,
	events: readonly VibeCodexWorkspaceReadEvidenceEvent[]
): VibeCodexWorkspaceReadStatusResponse {
	const sanitizedEvents = events.map(event => sanitizeEvidenceEvent(event));
	const filtered = request.kind ? sanitizedEvents.filter(event => event.kind === request.kind) : sanitizedEvents;
	const limitedEvents = filtered.slice(-request.maxEvents).reverse().map(event => request.includeSamples ? limitEventSamples(event, request.maxSamples) : { ...event, samples: undefined });
	const latest = limitedEvents[0];
	const counts = countEvents(filtered);
	const response = {
		ok: true,
		source: 'externalExtension' as const,
		version: 1 as const,
		method: request.method,
		generatedAt: Date.now(),
		state: filtered.length ? 'ready' as const : 'empty' as const,
		hasEvidence: filtered.length > 0,
		...(request.kind ? { filterKind: request.kind } : {}),
		totalEvents: sanitizedEvents.length,
		filteredEvents: filtered.length,
		counts,
		...(latest ? { latest } : {}),
		...(request.includeEvents ? { events: limitedEvents } : {}),
		readiness: {
			hasReadEvidence: filtered.some(event => event.kind === 'read_file'),
			hasSearchEvidence: filtered.some(event => event.kind === 'search_files' || event.kind === 'semantic_search'),
			hasSemanticEvidence: filtered.some(event => event.kind === 'semantic_search'),
			...(latestFailure(filtered) ? { latestFailure: latestFailure(filtered) } : {}),
		},
		nextAction: filtered.length
			? 'Use the cached evidence to cite inspected files/search hits before planning or editing; request fresh read/search tools only when more context is needed.'
			: 'Ask the extension for read_file, search_files, or semantic_search context before claiming workspace evidence.',
		guardrails: workspaceReadStatusGuardrails,
		message: filtered.length
			? `Workspace read evidence has ${filtered.length} cached event${filtered.length === 1 ? '' : 's'} (${counts.successful} successful, ${counts.failed} failed).`
			: 'No cached workspace read/search evidence is available yet.',
	};
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: workspaceReadStatusPromptBlock(response, limitedEvents) } : {}),
	};
}

export function workspaceReadStatusSummary(response: Pick<VibeCodexWorkspaceReadStatusResponse, 'hasEvidence' | 'filteredEvents' | 'counts' | 'filterKind'>): string {
	const scope = response.filterKind ? ` for ${response.filterKind}` : '';
	return response.hasEvidence
		? `Workspace read evidence${scope}: ${response.filteredEvents} cached event${response.filteredEvents === 1 ? '' : 's'}; ${response.counts.hits} search hit${response.counts.hits === 1 ? '' : 's'}; ${response.counts.files} file read result${response.counts.files === 1 ? '' : 's'}.`
		: `Workspace read evidence${scope}: none cached.`;
}

const workspaceReadStatusGuardrails = [
	'Workspace read status is cached-only and never reads files, lists directories, searches the workspace, invokes VS Code providers, approves plans, runs commands, accepts diffs, or mutates files.',
	'Only bounded summaries, counts, paths, line numbers, hit previews, and file text lengths are returned; full file text is never exposed through this status request.',
	'All paths, queries, previews, errors, summaries, and prompt blocks are redacted before they are returned to the backend.',
	'Use read_file, search_files, or semantic_search separately when fresh context is required; this status endpoint only reports what those tools already returned.',
];

function workspaceReadStatusPromptBlock(response: Omit<VibeCodexWorkspaceReadStatusResponse, 'promptBlock'>, events: readonly VibeCodexWorkspaceReadEvidenceEvent[]): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'workspace_read_status',
		state: response.state,
		filterKind: response.filterKind,
		totalEvents: response.totalEvents,
		filteredEvents: response.filteredEvents,
		counts: response.counts,
		readiness: response.readiness,
		latest: response.latest,
		events: events.slice(0, maxPromptEvents),
		nextAction: response.nextAction,
		note: 'Cached workspace read/search evidence only; request fresh read_file/search_files/semantic_search tools for new context.',
	}), null, 2);
}

function countEvents(events: readonly VibeCodexWorkspaceReadEvidenceEvent[]): VibeCodexWorkspaceReadStatusCounts {
	return {
		total: events.length,
		successful: events.filter(event => event.ok).length,
		failed: events.filter(event => !event.ok).length,
		truncated: events.filter(event => event.truncated).length,
		readFile: events.filter(event => event.kind === 'read_file').length,
		listDir: events.filter(event => event.kind === 'list_dir').length,
		searchFiles: events.filter(event => event.kind === 'search_files').length,
		semanticSearch: events.filter(event => event.kind === 'semantic_search').length,
		files: events.reduce((sum, event) => sum + event.counts.files, 0),
		entries: events.reduce((sum, event) => sum + event.counts.entries, 0),
		hits: events.reduce((sum, event) => sum + event.counts.hits, 0),
	};
}

function sanitizeEvidenceEvent(event: VibeCodexWorkspaceReadEvidenceEvent): VibeCodexWorkspaceReadEvidenceEvent {
	return {
		...event,
		id: redactSensitiveText(event.id),
		method: redactSensitiveText(event.method),
		...(event.path ? { path: redactSensitiveText(event.path) } : {}),
		paths: event.paths.map(path => redactSensitiveText(path)).slice(0, 12),
		...(event.query ? { query: redactSensitiveText(event.query) } : {}),
		summary: redactSensitiveText(event.summary),
		...(event.error ? { error: redactSensitiveText(event.error) } : {}),
		...(event.samples ? { samples: sanitizeSamples(event.samples, hardMaxSamples) } : {}),
	};
}

function sanitizeSamples(samples: NonNullable<VibeCodexWorkspaceReadEvidenceEvent['samples']>, limit: number): NonNullable<VibeCodexWorkspaceReadEvidenceEvent['samples']> {
	return {
		...(samples.files?.length ? { files: samples.files.slice(0, limit).map(file => ({ ...file, path: redactSensitiveText(file.path) })) } : {}),
		...(samples.entries?.length ? { entries: samples.entries.slice(0, limit).map(entry => ({ ...entry, path: redactSensitiveText(entry.path), type: redactSensitiveText(entry.type) })) } : {}),
		...(samples.hits?.length ? { hits: samples.hits.slice(0, limit).map(hit => ({
			...hit,
			path: redactSensitiveText(hit.path),
			preview: redactSensitiveText(hit.preview).slice(0, 500),
			...(hit.matchedTerms?.length ? { matchedTerms: hit.matchedTerms.map(term => redactSensitiveText(term)).slice(0, 12) } : {}),
		})) } : {}),
	};
}

function limitEventSamples(event: VibeCodexWorkspaceReadEvidenceEvent, maxSamples: number): VibeCodexWorkspaceReadEvidenceEvent {
	return event.samples
		? { ...event, samples: sanitizeSamples(event.samples, Math.max(0, Math.min(hardMaxSamples, Math.floor(maxSamples)))) }
		: event;
}

function latestFailure(events: readonly VibeCodexWorkspaceReadEvidenceEvent[]): string | undefined {
	const failed = [...events].reverse().find(event => !event.ok);
	if (!failed) {
		return undefined;
	}
	return failed.error ?? `${failed.kind} failed`;
}

function isWorkspaceReadStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return workspaceReadStatusToolNames.has(tool);
}

function workspaceReadKindValue(value: unknown): VibeCodexWorkspaceReadToolKind | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
	return workspaceReadKinds.includes(normalized as VibeCodexWorkspaceReadToolKind) ? normalized as VibeCodexWorkspaceReadToolKind : undefined;
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function boundedInteger(value: unknown, fallback: number, max: number): number {
	const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : fallback;
	if (!Number.isFinite(numeric)) {
		return fallback;
	}
	return Math.max(0, Math.min(max, Math.floor(numeric)));
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
