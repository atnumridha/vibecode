/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexUserInputKind = 'question' | 'plan_feedback';
export type VibeCodexUserInputSuggestionSource = 'suggestions' | 'options' | 'choices' | 'follow_up' | 'followUp';

export interface VibeCodexUserInputSuggestion {
	readonly index: number;
	readonly source: VibeCodexUserInputSuggestionSource;
	readonly label: string;
	readonly value: string;
	readonly id?: string;
	readonly description?: string;
}

export interface VibeCodexUserInputRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: VibeCodexUserInputKind;
	readonly title: string;
	readonly prompt: string;
	readonly detail?: string;
	readonly suggestions: readonly string[];
	readonly suggestionChoices: readonly VibeCodexUserInputSuggestion[];
	readonly placeholder?: string;
	readonly requestedAt: number;
}

export interface VibeCodexUserInputResponse {
	readonly answered: boolean;
	readonly decision: 'respond' | 'cancel';
	readonly source: 'externalExtension';
	readonly kind: VibeCodexUserInputKind;
	readonly answer?: string;
	readonly selectedSuggestion?: string;
	readonly selectedSuggestionIndex?: number;
	readonly selectedSuggestionValue?: string;
	readonly selectedSuggestionId?: string;
	readonly message?: string;
}

type RawSuggestionChoice = Omit<VibeCodexUserInputSuggestion, 'index'>;

const userInputMethods = new Set([
	'agent/requestUserInput',
	'agent/requestClarification',
	'agent/askUser',
	'agent/userInput',
	'user/input',
	'user/ask',
	'ask/followup',
]);

export function normalizeUserInputRequest(message: JsonRpcMessage): VibeCodexUserInputRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	const kind = classifyUserInputRequest(message.method, toolName);
	if (!kind) {
		return undefined;
	}
	const prompt = stringValue(payload.question)
		?? stringValue(args.question)
		?? stringValue(payload.response)
		?? stringValue(args.response)
		?? stringValue(payload.prompt)
		?? stringValue(args.prompt)
		?? stringValue(payload.message)
		?? stringValue(args.message)
		?? stringValue(payload.text)
		?? stringValue(args.text)
		?? stringValue(payload.content)
		?? stringValue(args.content);
	if (!prompt) {
		return undefined;
	}
	const detail = stringValue(payload.detail)
		?? stringValue(args.detail)
		?? stringValue(payload.details)
		?? stringValue(args.details)
		?? stringValue(payload.reason)
		?? stringValue(args.reason)
		?? stringValue(payload.context)
		?? stringValue(args.context);
	const suggestionChoices = uniqueSuggestionChoices([
		...suggestionChoicesFrom(payload.suggestions, 'suggestions'),
		...suggestionChoicesFrom(args.suggestions, 'suggestions'),
		...suggestionChoicesFrom(payload.options, 'options'),
		...suggestionChoicesFrom(args.options, 'options'),
		...suggestionChoicesFrom(payload.choices, 'choices'),
		...suggestionChoicesFrom(args.choices, 'choices'),
		...suggestionChoicesFrom(payload.follow_up, 'follow_up'),
		...suggestionChoicesFrom(args.follow_up, 'follow_up'),
		...suggestionChoicesFrom(payload.followUp, 'followUp'),
		...suggestionChoicesFrom(args.followUp, 'followUp'),
	]).slice(0, 6);
	const placeholder = stringValue(payload.placeholder)
		?? stringValue(args.placeholder)
		?? stringValue(payload.inputPlaceholder)
		?? stringValue(args.inputPlaceholder);
	return {
		id: message.id,
		method: message.method,
		kind,
		title: kind === 'plan_feedback' ? 'Plan Mode response requested' : 'User input requested',
		prompt: redactSensitiveText(prompt).slice(0, 4000),
		...(detail ? { detail: redactSensitiveText(detail).slice(0, 6000) } : {}),
		suggestions: suggestionChoices.map(suggestion => suggestion.label),
		suggestionChoices,
		...(placeholder ? { placeholder: redactSensitiveText(placeholder).slice(0, 200) } : {}),
		requestedAt: Date.now(),
	};
}

export function createUserInputResponse(request: VibeCodexUserInputRequest, answer: string, cancelled = false, selectedSuggestionIndex?: number): VibeCodexUserInputResponse {
	const redactedAnswer = redactSensitiveText(answer).trim().slice(0, 12000);
	const selectedChoice = !cancelled ? selectedSuggestionChoice(request, redactedAnswer, selectedSuggestionIndex) : undefined;
	const responseAnswer = selectedChoice?.value ?? redactedAnswer;
	const answered = !cancelled && responseAnswer.length > 0;
	return {
		answered,
		decision: answered ? 'respond' : 'cancel',
		source: 'externalExtension',
		kind: request.kind,
		...(answered ? { answer: responseAnswer } : {}),
		...(selectedChoice ? {
			selectedSuggestion: selectedChoice.label,
			selectedSuggestionIndex: selectedChoice.index,
			selectedSuggestionValue: selectedChoice.value,
			...(selectedChoice.id ? { selectedSuggestionId: selectedChoice.id } : {}),
		} : {}),
		...(!answered ? { message: 'User input request cancelled or answered with empty text.' } : {}),
	};
}

export function userInputRequestSummary(request: VibeCodexUserInputRequest): string {
	return `${request.title}: ${request.prompt.slice(0, 160)}${request.prompt.length > 160 ? '...' : ''}`;
}

function classifyUserInputRequest(method: string, toolName: string): VibeCodexUserInputKind | undefined {
	if (userInputMethods.has(method)) {
		return method.toLowerCase().includes('plan') ? 'plan_feedback' : 'question';
	}
	if (method !== 'item/tool/call') {
		return undefined;
	}
	if (toolName === 'ask_question' || toolName === 'ask_followup_question' || toolName === 'ask_user' || toolName === 'request_user_input') {
		return 'question';
	}
	if (toolName === 'plan_mode_respond' || toolName === 'plan_mode_response' || toolName === 'request_plan_feedback') {
		return 'plan_feedback';
	}
	return undefined;
}

function suggestionChoicesFrom(value: unknown, source: VibeCodexUserInputSuggestionSource): readonly RawSuggestionChoice[] {
	if (Array.isArray(value)) {
		return value.map(item => {
			if (typeof item === 'string') {
				return rawSuggestion(item, item, source);
			}
			if (isRecord(item)) {
				const label = stringValue(item.label) ?? stringValue(item.text) ?? stringValue(item.title) ?? stringValue(item.value);
				if (!label) {
					return undefined;
				}
				return rawSuggestion(label, stringValue(item.value) ?? stringValue(item.text) ?? label, source, stringValue(item.id) ?? stringValue(item.key), stringValue(item.description) ?? stringValue(item.detail));
			}
			return undefined;
		}).filter((choice): choice is RawSuggestionChoice => !!choice);
	}
	if (isRecord(value)) {
		return Object.entries(value).map(([key, item]) => {
			if (typeof item === 'string') {
				return rawSuggestion(item, item, source, key);
			}
			if (isRecord(item)) {
				const label = stringValue(item.label) ?? stringValue(item.text) ?? stringValue(item.title) ?? stringValue(item.value);
				if (!label) {
					return undefined;
				}
				return rawSuggestion(label, stringValue(item.value) ?? stringValue(item.text) ?? label, source, stringValue(item.id) ?? stringValue(item.key) ?? key, stringValue(item.description) ?? stringValue(item.detail));
			}
			return undefined;
		}).filter((choice): choice is RawSuggestionChoice => !!choice);
	}
	return [];
}

function rawSuggestion(label: string, value: string, source: VibeCodexUserInputSuggestionSource, id?: string, description?: string): RawSuggestionChoice {
	return {
		source,
		label: redactSensitiveText(label).trim().slice(0, 500),
		value: redactSensitiveText(value).trim().slice(0, 12000),
		...(id ? { id: redactSensitiveText(id).trim().slice(0, 120) } : {}),
		...(description ? { description: redactSensitiveText(description).trim().slice(0, 500) } : {}),
	};
}

function uniqueSuggestionChoices(values: readonly RawSuggestionChoice[]): readonly VibeCodexUserInputSuggestion[] {
	const choices: VibeCodexUserInputSuggestion[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (!value.label || !value.value) {
			continue;
		}
		const key = `${value.label}\u0000${value.value}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		choices.push({ ...value, index: choices.length });
	}
	return choices;
}

function selectedSuggestionChoice(request: VibeCodexUserInputRequest, answer: string, selectedSuggestionIndex: number | undefined): VibeCodexUserInputSuggestion | undefined {
	if (typeof selectedSuggestionIndex === 'number' && Number.isInteger(selectedSuggestionIndex)) {
		const byIndex = request.suggestionChoices.find(choice => choice.index === selectedSuggestionIndex);
		if (byIndex) {
			return byIndex;
		}
	}
	return request.suggestionChoices.find(choice => choice.label === answer || choice.value === answer);
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function userInputPromptBlock(requests: readonly VibeCodexUserInputRequest[]): string | undefined {
	if (!requests.length) {
		return undefined;
	}
	return JSON.stringify(redactSensitiveValue({
		pendingUserInputRequests: requests.map(request => ({
			id: request.id,
			kind: request.kind,
			title: request.title,
			prompt: request.prompt,
			suggestions: request.suggestions,
			suggestionChoices: request.suggestionChoices,
			requestedAt: request.requestedAt,
		})),
		note: 'The backend is paused waiting for explicit developer input through the Vibe Codex sidebar.',
	}), null, 2);
}
