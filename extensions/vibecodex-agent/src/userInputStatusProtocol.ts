/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexUserInputKind, VibeCodexUserInputRequest, VibeCodexUserInputSuggestion } from './userInputProtocol';
import { userInputPromptBlock } from './userInputProtocol';

export interface VibeCodexUserInputStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeRequests: boolean;
	readonly includePromptBlock: boolean;
	readonly maxRequests: number;
	readonly requestedAt: number;
}

export interface VibeCodexUserInputStatusItem {
	readonly id: string;
	readonly method: string;
	readonly kind: VibeCodexUserInputKind;
	readonly title: string;
	readonly prompt: string;
	readonly detail?: string;
	readonly suggestions: readonly string[];
	readonly suggestionChoices: readonly VibeCodexUserInputSuggestion[];
	readonly requestedAt: number;
}

export interface VibeCodexUserInputStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly counts: {
		readonly pending: number;
		readonly questions: number;
		readonly planFeedback: number;
		readonly suggestions: number;
		readonly returned: number;
		readonly truncated: boolean;
	};
	readonly requests?: readonly VibeCodexUserInputStatusItem[];
	readonly promptBlock?: string;
	readonly nextAction: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

const userInputStatusMethods = new Set([
	'agent/getUserInputStatus',
	'agent/userInputStatus',
	'userInput/status',
	'user/inputStatus',
	'input/status',
	'plan/userInputStatus',
	'vibecodex/userInputStatus',
]);

const userInputStatusToolNames = new Set([
	'user_input_status',
	'get_user_input_status',
	'input_status',
	'question_status',
	'pending_questions',
	'plan_input_status',
	'plan_feedback_status',
]);

export function normalizeUserInputStatusRequest(message: JsonRpcMessage): VibeCodexUserInputStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!userInputStatusMethods.has(message.method) && !isUserInputStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeRequests: booleanValue(payload.includeRequests)
			?? booleanValue(payload.include_requests)
			?? booleanValue(args.includeRequests)
			?? booleanValue(args.include_requests)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? false,
		maxRequests: clampInteger(
			numberValue(payload.maxRequests)
				?? numberValue(payload.max_requests)
				?? numberValue(args.maxRequests)
				?? numberValue(args.max_requests)
				?? 8,
			1,
			20
		),
		requestedAt: Date.now(),
	};
}

export function createUserInputStatusResponse(request: VibeCodexUserInputStatusRequest, pendingRequests: readonly VibeCodexUserInputRequest[]): VibeCodexUserInputStatusResponse {
	const ordered = [...pendingRequests].sort((a, b) => a.requestedAt - b.requestedAt);
	const visible = ordered.slice(0, request.maxRequests);
	const questions = ordered.filter(item => item.kind === 'question').length;
	const planFeedback = ordered.filter(item => item.kind === 'plan_feedback').length;
	const suggestions = ordered.reduce((total, item) => total + item.suggestions.length, 0);
	const requests = visible.map(userInputStatusItem);
	const truncated = ordered.length > visible.length;
	const pending = ordered.length;
	const promptBlock = request.includePromptBlock && pending ? userInputPromptBlock(visible) : undefined;
	const message = pending
		? `${pending} pending backend user input request${pending === 1 ? '' : 's'}; ${planFeedback} Plan Mode feedback request${planFeedback === 1 ? '' : 's'} waiting.`
		: 'No backend user input requests are pending.';
	return {
		ok: true,
		source: 'externalExtension',
		counts: {
			pending,
			questions,
			planFeedback,
			suggestions,
			returned: request.includeRequests ? requests.length : 0,
			truncated,
		},
		...(request.includeRequests ? { requests } : {}),
		...(promptBlock ? { promptBlock } : {}),
		nextAction: pending
			? 'Wait for the developer to answer or cancel the pending request in the Vibe Codex sidebar before continuing the paused backend turn.'
			: 'Continue the backend turn; no human-input wait state is active.',
		guardrails: [
			'User input status is read-only and never answers, cancels, approves plans, runs tools, edits files, or unlocks mutation.',
			'Only currently pending requests are returned; completed, cancelled, restored, or stale requests are intentionally excluded.',
			'Prompts, suggestions, details, and prompt blocks are redacted before being returned to the backend.',
			'Prompt blocks use the pendingUserInputRequests shape so backend wait loops can reason about paused questions without scraping the sidebar.',
			'Backends must still wait for the explicit user input response tied to the original request id.',
		],
		message,
	};
}

export function userInputStatusSummary(response: VibeCodexUserInputStatusResponse): string {
	return `${response.message} Questions: ${response.counts.questions}; plan feedback: ${response.counts.planFeedback}; suggestions: ${response.counts.suggestions}.`;
}

function userInputStatusItem(request: VibeCodexUserInputRequest): VibeCodexUserInputStatusItem {
	return {
		id: redactSensitiveText(String(request.id)),
		method: redactSensitiveText(request.method),
		kind: request.kind,
		title: redactSensitiveText(request.title),
		prompt: redactSensitiveText(request.prompt),
		...(request.detail ? { detail: redactSensitiveText(request.detail) } : {}),
		suggestions: redactSensitiveValue(request.suggestions) as readonly string[],
		suggestionChoices: redactSensitiveValue(request.suggestionChoices) as readonly VibeCodexUserInputSuggestion[],
		requestedAt: request.requestedAt,
	};
}

function isUserInputStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return userInputStatusToolNames.has(tool);
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

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim().length) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function clampInteger(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
