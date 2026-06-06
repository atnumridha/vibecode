/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexContextPack } from './contextEngine';
import type { VibeCodexContextIndexStatusResponse } from './contextIndexStatusProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexContextRefreshRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly prompt?: string;
	readonly mode?: string;
	readonly includeContext: boolean;
	readonly includePromptBlock: boolean;
	readonly includeIndexStatus: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexContextRefreshResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly refreshedAt: number;
	readonly gatheredAt: number;
	readonly mode: string;
	readonly promptPreview?: string;
	readonly promptLength: number;
	readonly contextSummary: string;
	readonly counts: {
		readonly workspaceRoots: number;
		readonly mentions: number;
		readonly files: number;
		readonly filesWithText: number;
		readonly searchHits: number;
		readonly symbols: number;
		readonly diagnostics: number;
		readonly diagnosticErrors: number;
		readonly gitRepositories: number;
		readonly gitChanges: number;
		readonly terminalKnown: boolean;
		readonly ignoreRules: number;
	};
	readonly readiness?: VibeCodexContextIndexStatusResponse['readiness'];
	readonly indexStatus?: VibeCodexContextIndexStatusResponse;
	readonly context?: VibeCodexContextPack;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexContextRefreshResponseInput {
	readonly context: VibeCodexContextPack;
	readonly prompt: string;
	readonly mode: string;
	readonly contextSummary: string;
	readonly indexStatus?: VibeCodexContextIndexStatusResponse;
	readonly promptBlock?: string;
	readonly refreshedAt?: number;
}

const contextRefreshMethods = new Set([
	'agent/refreshContext',
	'agent/gatherContext',
	'context/refresh',
	'context/gather',
	'workspace/refreshContext',
	'workspace/gatherContext',
	'vibecodex/refreshContext',
]);

const contextRefreshToolNames = new Set([
	'context_refresh',
	'refresh_context',
	'gather_context',
	'workspace_context_refresh',
	'workspace_context_gather',
	'refresh_workspace_context',
]);

export function normalizeContextRefreshRequest(message: JsonRpcMessage): VibeCodexContextRefreshRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!contextRefreshMethods.has(message.method) && !isContextRefreshToolCall(message.method, payload, args)) {
		return undefined;
	}
	const prompt = stringValue(payload.prompt) ?? stringValue(args.prompt) ?? stringValue(payload.task) ?? stringValue(args.task);
	const mode = normalizeMode(stringValue(payload.mode) ?? stringValue(args.mode));
	return {
		id: message.id,
		method: message.method,
		...(prompt ? { prompt } : {}),
		...(mode ? { mode } : {}),
		includeContext: booleanValue(payload.includeContext)
			?? booleanValue(payload.include_context)
			?? booleanValue(args.includeContext)
			?? booleanValue(args.include_context)
			?? false,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? false,
		includeIndexStatus: booleanValue(payload.includeIndexStatus)
			?? booleanValue(payload.include_index_status)
			?? booleanValue(args.includeIndexStatus)
			?? booleanValue(args.include_index_status)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createContextRefreshResponse(request: VibeCodexContextRefreshRequest, input: VibeCodexContextRefreshResponseInput): VibeCodexContextRefreshResponse {
	const counts = contextRefreshCounts(input.context);
	const response: VibeCodexContextRefreshResponse = {
		ok: true,
		source: 'externalExtension',
		refreshedAt: input.refreshedAt ?? Date.now(),
		gatheredAt: input.context.gatheredAt,
		mode: input.mode,
		...(input.prompt.trim() ? { promptPreview: redactSensitiveText(input.prompt.trim()).slice(0, 240) } : {}),
		promptLength: input.prompt.length,
		contextSummary: redactSensitiveText(input.contextSummary),
		counts,
		...(input.indexStatus ? { readiness: input.indexStatus.readiness } : {}),
		...(request.includeIndexStatus && input.indexStatus ? { indexStatus: input.indexStatus } : {}),
		...(request.includeContext ? { context: input.context } : {}),
		...(request.includePromptBlock && input.promptBlock ? { promptBlock: input.promptBlock } : {}),
		guardrails: contextRefreshGuardrails(),
		message: contextRefreshSummaryFromCounts(counts, input.indexStatus?.readiness?.readyForPlanning),
	};
	return redactSensitiveValue(response) as VibeCodexContextRefreshResponse;
}

export function contextRefreshSummary(response: VibeCodexContextRefreshResponse): string {
	return response.message;
}

function contextRefreshCounts(context: VibeCodexContextPack): VibeCodexContextRefreshResponse['counts'] {
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
		gitRepositories: repositories.length,
		gitChanges: repositories.reduce((sum, repository) => sum + repository.changes.length, 0),
		terminalKnown: !!context.terminal,
		ignoreRules: context.ignorePolicy?.rules.length ?? 0,
	};
}

function contextRefreshSummaryFromCounts(counts: VibeCodexContextRefreshResponse['counts'], readyForPlanning: boolean | undefined): string {
	const ready = readyForPlanning === undefined ? 'refreshed' : readyForPlanning ? 'ready for visual planning' : 'refreshed but needs review';
	return `Context ${ready}: ${counts.files} file reference${counts.files === 1 ? '' : 's'}, ${counts.searchHits} search hit${counts.searchHits === 1 ? '' : 's'}, ${counts.symbols} symbol${counts.symbols === 1 ? '' : 's'}, ${counts.diagnostics} diagnostic${counts.diagnostics === 1 ? '' : 's'}.`;
}

function contextRefreshGuardrails(): readonly string[] {
	return [
		'Context refresh is read-only and never writes files, deletes files, starts terminal commands, approves plans, accepts diffs, or changes provider credentials.',
		'The default response returns summary, counts, and readiness only; full redacted context or prompt blocks are returned only when explicitly requested.',
		'Fresh context still does not authorize mutation. Backends must submit a valid visual plan and wait for exact revision approval before requesting tools.',
	];
}

function isContextRefreshToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return contextRefreshToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function normalizeMode(value: string | undefined): string | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'plan'
		|| normalized === 'ask'
		|| normalized === 'manual'
		|| normalized === 'act'
		|| normalized === 'agent'
		|| normalized === 'debug'
		|| normalized === 'review'
		|| normalized === 'custom') {
		return normalized;
	}
	return undefined;
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

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
