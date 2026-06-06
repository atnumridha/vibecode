/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { authorizationMatchesPlan, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexInlinePromptSession } from './inlinePromptSession';
import type { VibeCodexPlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexInlinePromptStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includePrompt: boolean;
	readonly includeContext: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexInlinePromptStatusSession {
	readonly id: string;
	readonly source: 'inlinePrompt';
	readonly createdAt: number;
	readonly instruction: string;
	readonly file?: string;
	readonly languageId?: string;
	readonly range?: string;
	readonly selectionKind: VibeCodexInlinePromptSession['selectionKind'];
	readonly selectedTextTruncated: boolean;
	readonly contextBeforeRange?: string;
	readonly contextAfterRange?: string;
	readonly requiredPlanSteps: readonly string[];
	readonly acceptanceCriteria: readonly string[];
	readonly prompt?: string;
	readonly selectedText?: string;
	readonly contextBefore?: string;
	readonly contextAfter?: string;
}

export interface VibeCodexInlinePromptStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly active: boolean;
	readonly session?: VibeCodexInlinePromptStatusSession;
	readonly activePlan?: {
		readonly taskId: string;
		readonly revision: number;
		readonly summary: string;
	};
	readonly executionAuthorization: {
		readonly approved: boolean;
		readonly taskId?: string;
		readonly revision?: number;
		readonly planHash?: string;
		readonly activePlanMatches: boolean;
	};
	readonly counts: {
		readonly requiredPlanSteps: number;
		readonly acceptanceCriteria: number;
		readonly selectedTextChars: number;
		readonly contextBeforeChars: number;
		readonly contextAfterChars: number;
	};
	readonly guardrails: readonly string[];
	readonly message: string;
}

const inlinePromptStatusMethods = new Set([
	'agent/getInlinePromptStatus',
	'agent/inlinePromptStatus',
	'inlinePrompt/status',
	'inline/status',
	'ctrlK/status',
	'vibecodex/inlinePromptStatus',
]);

const inlinePromptStatusToolNames = new Set([
	'inline_prompt_status',
	'get_inline_prompt_status',
	'ctrl_k_status',
	'inline_context_status',
]);

export function normalizeInlinePromptStatusRequest(message: JsonRpcMessage): VibeCodexInlinePromptStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!inlinePromptStatusMethods.has(message.method) && !isInlinePromptStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includePrompt: booleanValue(payload.includePrompt)
			?? booleanValue(payload.include_prompt)
			?? booleanValue(args.includePrompt)
			?? booleanValue(args.include_prompt)
			?? false,
		includeContext: booleanValue(payload.includeContext)
			?? booleanValue(payload.include_context)
			?? booleanValue(args.includeContext)
			?? booleanValue(args.include_context)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createInlinePromptStatusResponse(request: VibeCodexInlinePromptStatusRequest, input: {
	readonly session?: VibeCodexInlinePromptSession;
	readonly activePlan?: VibeCodexPlan;
	readonly authorization?: VibeCodexExecutionAuthorization;
}): VibeCodexInlinePromptStatusResponse {
	const session = input.session ? inlinePromptSessionStatus(input.session, request) : undefined;
	const counts = {
		requiredPlanSteps: input.session?.requiredPlanSteps.length ?? 0,
		acceptanceCriteria: input.session?.acceptanceCriteria.length ?? 0,
		selectedTextChars: input.session?.selectedText?.length ?? 0,
		contextBeforeChars: input.session?.contextBefore?.length ?? 0,
		contextAfterChars: input.session?.contextAfter?.length ?? 0,
	};
	const activePlan = input.activePlan ? {
		taskId: redactSensitiveText(input.activePlan.taskId),
		revision: input.activePlan.revision,
		summary: redactSensitiveText(input.activePlan.summary),
	} : undefined;
	const executionAuthorization = input.authorization ? {
		approved: true,
		taskId: redactSensitiveText(input.authorization.taskId),
		revision: input.authorization.revision,
		planHash: input.authorization.planHash,
		activePlanMatches: authorizationMatchesPlan(input.authorization, input.activePlan),
	} : { approved: false, activePlanMatches: false };
	return {
		ok: true,
		source: 'externalExtension',
		active: !!session,
		...(session ? { session } : {}),
		...(activePlan ? { activePlan } : {}),
		executionAuthorization,
		counts,
		guardrails: [
			'Inline prompt status is read-only and never opens editors, gathers fresh context, approves plans, runs tools, writes files, or executes terminal commands.',
			'Selected text and surrounding context are returned only when includeContext=true and are redacted before they leave the extension.',
			'The inline prompt still requires the normal visual plan, exact-revision approval, diff review, verification, and rollback gates before mutation.',
			'Execution authorization is summarized without approval tokens.',
		],
		message: session
			? `Inline prompt ${session.id} targets ${session.file ?? 'workspace'} (${session.selectionKind}); ${counts.requiredPlanSteps} required plan steps.`
			: 'No inline prompt session is active.',
	};
}

export function inlinePromptStatusSummary(response: VibeCodexInlinePromptStatusResponse): string {
	return response.active
		? `${response.message} Plan approved: ${response.executionAuthorization.approved && response.executionAuthorization.activePlanMatches ? 'yes' : 'no'}.`
		: response.message;
}

function inlinePromptSessionStatus(session: VibeCodexInlinePromptSession, request: VibeCodexInlinePromptStatusRequest): VibeCodexInlinePromptStatusSession {
	return {
		id: redactSensitiveText(session.id),
		source: session.source,
		createdAt: session.createdAt,
		instruction: redactSensitiveText(session.instruction),
		...(session.file ? { file: redactSensitiveText(session.file) } : {}),
		...(session.languageId ? { languageId: redactSensitiveText(session.languageId) } : {}),
		...(session.range ? { range: redactSensitiveText(session.range) } : {}),
		selectionKind: session.selectionKind,
		selectedTextTruncated: !!session.selectedTextTruncated,
		...(session.contextBeforeRange ? { contextBeforeRange: redactSensitiveText(session.contextBeforeRange) } : {}),
		...(session.contextAfterRange ? { contextAfterRange: redactSensitiveText(session.contextAfterRange) } : {}),
		requiredPlanSteps: redactSensitiveValue(session.requiredPlanSteps) as readonly string[],
		acceptanceCriteria: redactSensitiveValue(session.acceptanceCriteria) as readonly string[],
		...(request.includePrompt ? { prompt: redactSensitiveText(session.prompt) } : {}),
		...(request.includeContext && session.selectedText ? { selectedText: redactSensitiveText(session.selectedText) } : {}),
		...(request.includeContext && session.contextBefore ? { contextBefore: redactSensitiveText(session.contextBefore) } : {}),
		...(request.includeContext && session.contextAfter ? { contextAfter: redactSensitiveText(session.contextAfter) } : {}),
	};
}

function isInlinePromptStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return inlinePromptStatusToolNames.has(tool);
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
