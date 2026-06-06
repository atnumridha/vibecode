/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexContextPack } from './contextEngine';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSymbolEntry, VibeCodexSymbolIndex } from './symbolIndexProtocol';
import { symbolIndexPromptBlock, symbolIndexSummary } from './symbolIndexProtocol';

export interface VibeCodexSymbolIndexStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly path?: string;
	readonly query?: string;
	readonly kind?: string;
	readonly includeEntries: boolean;
	readonly includePromptBlock: boolean;
	readonly maxItems: number;
	readonly requestedAt: number;
}

export interface VibeCodexSymbolIndexKindCount {
	readonly kind: string;
	readonly count: number;
}

export interface VibeCodexSymbolIndexStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly available: boolean;
	readonly generatedAt: number;
	readonly gatheredAt?: number;
	readonly mode?: string;
	readonly path?: string;
	readonly query?: string;
	readonly kind?: string;
	readonly counts: {
		readonly total: number;
		readonly matched: number;
		readonly returned: number;
		readonly files: number;
		readonly kinds: number;
	};
	readonly truncated: boolean;
	readonly kindCounts: readonly VibeCodexSymbolIndexKindCount[];
	readonly entries?: readonly VibeCodexSymbolEntry[];
	readonly summary: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

const symbolIndexStatusMethods = new Set([
	'agent/getSymbolIndexStatus',
	'agent/symbolIndexStatus',
	'context/symbolIndexStatus',
	'context/symbols/status',
	'symbol/indexStatus',
	'symbol/status',
	'symbols/status',
	'codebase/symbolStatus',
	'vibecodex/symbolIndexStatus',
]);

const symbolIndexStatusToolNames = new Set([
	'symbol_index_status',
	'get_symbol_index_status',
	'symbol_status',
	'symbols_status',
	'code_symbols_status',
	'codebase_symbol_status',
]);

const defaultMaxItems = 24;
const maxItemsLimit = 120;

export function normalizeSymbolIndexStatusRequest(message: JsonRpcMessage): VibeCodexSymbolIndexStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!symbolIndexStatusMethods.has(message.method) && !isSymbolIndexStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const path = stringValue(payload.path)
		?? stringValue(payload.file)
		?? stringValue(payload.folder)
		?? stringValue(args.path)
		?? stringValue(args.file)
		?? stringValue(args.folder);
	const query = stringValue(payload.query)
		?? stringValue(payload.search)
		?? stringValue(payload.name)
		?? stringValue(args.query)
		?? stringValue(args.search)
		?? stringValue(args.name);
	const kind = stringValue(payload.kind)
		?? stringValue(payload.symbolKind)
		?? stringValue(payload.symbol_kind)
		?? stringValue(args.kind)
		?? stringValue(args.symbolKind)
		?? stringValue(args.symbol_kind);
	return {
		id: message.id,
		method: message.method,
		...(path ? { path: redactSensitiveText(path) } : {}),
		...(query ? { query: redactSensitiveText(query) } : {}),
		...(kind ? { kind: redactSensitiveText(kind) } : {}),
		includeEntries: booleanValue(payload.includeEntries)
			?? booleanValue(payload.include_entries)
			?? booleanValue(args.includeEntries)
			?? booleanValue(args.include_entries)
			?? false,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? false,
		maxItems: boundedInteger(payload.maxItems ?? payload.max_items ?? args.maxItems ?? args.max_items, defaultMaxItems, 0, maxItemsLimit),
		requestedAt: Date.now(),
	};
}

export function createSymbolIndexStatusResponse(request: VibeCodexSymbolIndexStatusRequest, context: VibeCodexContextPack | undefined): VibeCodexSymbolIndexStatusResponse {
	const generatedAt = Date.now();
	const index = context?.symbolIndex;
	const matched = filterSymbols(index?.entries ?? [], request);
	const returned = matched.slice(0, request.maxItems);
	const kindCounts = symbolKindCounts(matched);
	const response = {
		ok: !!index,
		source: 'externalExtension' as const,
		available: !!index,
		generatedAt,
		...(context ? { gatheredAt: context.gatheredAt, mode: context.mode } : {}),
		...(request.path ? { path: request.path } : {}),
		...(request.query ? { query: request.query } : {}),
		...(request.kind ? { kind: request.kind } : {}),
		counts: {
			total: index?.entries.length ?? 0,
			matched: matched.length,
			returned: returned.length,
			files: new Set(matched.map(entry => entry.path)).size,
			kinds: kindCounts.length,
		},
		truncated: !!index?.truncated || matched.length > returned.length,
		kindCounts,
		...(request.includeEntries ? { entries: returned } : {}),
		summary: index ? symbolIndexSummary(index) : 'No symbol index has been gathered for the active task.',
		...(request.includePromptBlock ? { promptBlock: symbolIndexPromptBlock(scopedSymbolIndex(index, matched, returned)) } : {}),
		guardrails: symbolIndexStatusGuardrails(),
		message: symbolIndexStatusMessage(index, matched.length, returned.length),
	};
	return redactSensitiveValue(response) as VibeCodexSymbolIndexStatusResponse;
}

export function symbolIndexStatusSummary(response: VibeCodexSymbolIndexStatusResponse): string {
	return response.message;
}

function filterSymbols(entries: readonly VibeCodexSymbolEntry[], request: VibeCodexSymbolIndexStatusRequest): readonly VibeCodexSymbolEntry[] {
	const path = request.path?.toLowerCase();
	const kind = request.kind?.toLowerCase();
	const terms = request.query?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
	return entries.filter(entry => {
		if (path && !entry.path.toLowerCase().includes(path)) {
			return false;
		}
		if (kind && entry.kind.toLowerCase() !== kind) {
			return false;
		}
		if (!terms.length) {
			return true;
		}
		const haystack = `${entry.name} ${entry.kind} ${entry.containerName ?? ''} ${entry.path}`.toLowerCase();
		return terms.every(term => haystack.includes(term));
	});
}

function symbolKindCounts(entries: readonly VibeCodexSymbolEntry[]): readonly VibeCodexSymbolIndexKindCount[] {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([kind, count]) => ({ kind, count }));
}

function scopedSymbolIndex(index: VibeCodexSymbolIndex | undefined, matched: readonly VibeCodexSymbolEntry[], returned: readonly VibeCodexSymbolEntry[]): VibeCodexSymbolIndex | undefined {
	if (!index) {
		return undefined;
	}
	return {
		version: 1,
		collectedAt: index.collectedAt,
		entries: returned,
		truncated: !!index.truncated || matched.length > returned.length,
	};
}

function symbolIndexStatusMessage(index: VibeCodexSymbolIndex | undefined, matched: number, returned: number): string {
	if (!index) {
		return 'No symbol index status is available; gather context before requesting structural symbols.';
	}
	return `Symbol index status: ${matched}/${index.entries.length} symbol${index.entries.length === 1 ? '' : 's'} matched, ${returned} returned.`;
}

function symbolIndexStatusGuardrails(): readonly string[] {
	return [
		'Symbol index status is read-only and never gathers fresh files, invokes VS Code symbol providers, reads file text, or changes workspace state.',
		'Returned entries are capped, filtered from the last gathered context pack, and redacted before returning to the backend.',
		'Use list_code_definition_names for an explicit bounded symbol read after inspecting this cached index status.',
	];
}

function isSymbolIndexStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return symbolIndexStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
	const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	if (!Number.isFinite(parsed)) {
		return fallback;
	}
	return Math.max(min, Math.min(max, Math.floor(parsed)));
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
