/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexBrowserActionRequest } from './browserActionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexBrowserActionEvidenceState = 'pending' | 'started' | 'declined' | 'blocked' | 'native_required';

export interface VibeCodexBrowserActionEvidenceEvent {
	readonly id: string;
	readonly action: string;
	readonly supported: boolean;
	readonly nativeControllerRequired: boolean;
	readonly requestedAt: number;
	readonly recordedAt: number;
	readonly state: VibeCodexBrowserActionEvidenceState;
	readonly decision?: 'accept' | 'decline';
	readonly url?: string;
	readonly selector?: string;
	readonly coordinate?: { readonly x: number; readonly y: number };
	readonly textPreview?: string;
	readonly reason?: string;
	readonly detail?: string;
	readonly responseMessage?: string;
}

export interface VibeCodexBrowserActionStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeEvents: boolean;
	readonly includePendingActions: boolean;
	readonly includePromptBlock: boolean;
	readonly maxEvents: number;
	readonly maxPendingActions: number;
	readonly requestedAt: number;
}

export interface VibeCodexBrowserActionStatusCounts {
	readonly events: number;
	readonly pendingActions: number;
	readonly supportedPendingActions: number;
	readonly nativeRequiredPendingActions: number;
	readonly started: number;
	readonly declined: number;
	readonly blocked: number;
	readonly nativeRequired: number;
	readonly openNavigateStarted: number;
}

export interface VibeCodexBrowserActionStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly method: string;
	readonly generatedAt: number;
	readonly controller: {
		readonly externalExtension: true;
		readonly nativeControllerAvailable: false;
		readonly nativeControllerRequiredFor: readonly string[];
	};
	readonly capabilities: {
		readonly supportedActions: readonly string[];
		readonly nativeRequiredActions: readonly string[];
		readonly supportedUrlSchemes: readonly string[];
		readonly safeUrlRequired: true;
	};
	readonly counts: VibeCodexBrowserActionStatusCounts;
	readonly latest?: VibeCodexBrowserActionEvidenceEvent;
	readonly events?: readonly VibeCodexBrowserActionEvidenceEvent[];
	readonly pendingActions?: readonly VibeCodexBrowserActionEvidenceEvent[];
	readonly nextAction: string;
	readonly guardrails: readonly string[];
	readonly promptBlock?: string;
	readonly message: string;
}

const browserActionStatusMethods = new Set([
	'agent/getBrowserActionStatus',
	'agent/browserActionStatus',
	'browser/actionStatus',
	'browser/action/status',
	'browser/controllerStatus',
	'browser/controller/status',
	'vibecodex/browserActionStatus',
]);

const browserActionStatusToolNames = new Set([
	'browser_action_status',
	'browser_controller_status',
	'browser_handoff_status',
	'browser_action_history',
	'browser_tool_status',
]);

const supportedActions = ['open', 'navigate'];
const nativeRequiredActions = ['click', 'type', 'scroll_down', 'scroll_up', 'screenshot', 'close'];
const defaultMaxEvents = 12;
const defaultMaxPendingActions = 12;
const hardMaxEvents = 50;
const hardMaxPendingActions = 50;

export function normalizeBrowserActionStatusRequest(message: JsonRpcMessage): VibeCodexBrowserActionStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!browserActionStatusMethods.has(message.method) && !isBrowserActionStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeEvents: booleanValue(payload.includeEvents)
			?? booleanValue(payload.include_events)
			?? booleanValue(args.includeEvents)
			?? booleanValue(args.include_events)
			?? true,
		includePendingActions: booleanValue(payload.includePendingActions)
			?? booleanValue(payload.include_pending_actions)
			?? booleanValue(args.includePendingActions)
			?? booleanValue(args.include_pending_actions)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		maxEvents: boundedInteger(payload.maxEvents ?? payload.max_events ?? args.maxEvents ?? args.max_events, defaultMaxEvents, hardMaxEvents),
		maxPendingActions: boundedInteger(payload.maxPendingActions ?? payload.max_pending_actions ?? args.maxPendingActions ?? args.max_pending_actions, defaultMaxPendingActions, hardMaxPendingActions),
		requestedAt: Date.now(),
	};
}

export function createBrowserActionEvidenceEvent(
	action: VibeCodexBrowserActionRequest,
	state: VibeCodexBrowserActionEvidenceState,
	input: {
		readonly decision?: 'accept' | 'decline';
		readonly responseMessage?: string;
		readonly reason?: string;
		readonly recordedAt?: number;
	} = {}
): VibeCodexBrowserActionEvidenceEvent {
	return {
		id: redactSensitiveText(String(action.id)),
		action: redactSensitiveText(action.action),
		supported: action.supported,
		nativeControllerRequired: !action.supported,
		requestedAt: action.requestedAt,
		recordedAt: input.recordedAt ?? Date.now(),
		state,
		...(input.decision ? { decision: input.decision } : {}),
		...(action.url ? { url: redactSensitiveText(action.url) } : {}),
		...(action.selector ? { selector: redactSensitiveText(action.selector).slice(0, 240) } : {}),
		...(action.coordinate ? { coordinate: action.coordinate } : {}),
		...(action.text ? { textPreview: redactSensitiveText(action.text).slice(0, 240) } : {}),
		...(input.reason ?? action.reason ? { reason: redactSensitiveText(input.reason ?? action.reason ?? '') } : {}),
		...(action.detail ? { detail: redactSensitiveText(action.detail) } : {}),
		...(input.responseMessage ? { responseMessage: redactSensitiveText(input.responseMessage) } : {}),
	};
}

export function createBrowserActionStatusResponse(request: VibeCodexBrowserActionStatusRequest, input: {
	readonly events?: readonly VibeCodexBrowserActionEvidenceEvent[];
	readonly pendingActions?: readonly VibeCodexBrowserActionRequest[];
}): VibeCodexBrowserActionStatusResponse {
	const events = (input.events ?? []).map(sanitizeEvent);
	const pending = (input.pendingActions ?? []).map(action => createBrowserActionEvidenceEvent(action, 'pending'));
	const limitedEvents = events.slice(-request.maxEvents).reverse();
	const limitedPending = pending.slice(0, request.maxPendingActions);
	const counts = countEvents(events, pending);
	const response = {
		ok: true as const,
		source: 'externalExtension' as const,
		version: 1 as const,
		method: request.method,
		generatedAt: Date.now(),
		controller: {
			externalExtension: true as const,
			nativeControllerAvailable: false as const,
			nativeControllerRequiredFor: nativeRequiredActions,
		},
		capabilities: {
			supportedActions,
			nativeRequiredActions,
			supportedUrlSchemes: ['http', 'https'],
			safeUrlRequired: true as const,
		},
		counts,
		...(limitedEvents[0] ? { latest: limitedEvents[0] } : {}),
		...(request.includeEvents ? { events: limitedEvents } : {}),
		...(request.includePendingActions ? { pendingActions: limitedPending } : {}),
		nextAction: counts.pendingActions
			? 'Resolve pending supported browser actions from the visible Browser Actions cards; native-required actions need bundled VibeCode browser-controller support.'
			: counts.nativeRequired
				? 'Use browser_status/browser_action_status to inspect native-controller-required handoffs before retrying click/type/scroll/screenshot actions.'
				: 'Request browser_action only for safe open/navigate URLs in the external VSIX, or use the bundled native browser controller for page interaction.',
		guardrails: browserActionStatusGuardrails,
		message: browserActionStatusMessage(counts),
	};
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: browserActionStatusPromptBlock(response) } : {}),
	};
}

export function browserActionStatusSummary(response: Pick<VibeCodexBrowserActionStatusResponse, 'counts' | 'message'>): string {
	return `${response.message} ${response.counts.started} started, ${response.counts.nativeRequired} native-required, ${response.counts.pendingActions} pending.`;
}

const browserActionStatusGuardrails = [
	'Browser action status is read-only and never opens browsers, navigates URLs, clicks, types, scrolls, screenshots, closes tabs, approves actions, or mutates files.',
	'External VS Code installs can execute only approval-gated open/navigate actions with safe http(s) URLs.',
	'Click, type, scroll_down, scroll_up, screenshot, and close actions are recorded as native-controller-required handoffs for bundled VibeCode support.',
	'URLs, selectors, typed text, reasons, response messages, and prompt blocks are redacted before they are returned to the backend.',
];

function countEvents(events: readonly VibeCodexBrowserActionEvidenceEvent[], pending: readonly VibeCodexBrowserActionEvidenceEvent[]): VibeCodexBrowserActionStatusCounts {
	return {
		events: events.length,
		pendingActions: pending.length,
		supportedPendingActions: pending.filter(event => event.supported).length,
		nativeRequiredPendingActions: pending.filter(event => event.nativeControllerRequired).length,
		started: events.filter(event => event.state === 'started').length,
		declined: events.filter(event => event.state === 'declined').length,
		blocked: events.filter(event => event.state === 'blocked').length,
		nativeRequired: events.filter(event => event.state === 'native_required').length,
		openNavigateStarted: events.filter(event => event.state === 'started' && (event.action === 'open' || event.action === 'navigate')).length,
	};
}

function browserActionStatusMessage(counts: VibeCodexBrowserActionStatusCounts): string {
	return `${counts.events} browser action event${counts.events === 1 ? '' : 's'} cached; ${counts.pendingActions} pending; ${counts.nativeRequired} native-controller handoff${counts.nativeRequired === 1 ? '' : 's'}.`;
}

function browserActionStatusPromptBlock(response: Omit<VibeCodexBrowserActionStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'browser_action_status',
		controller: response.controller,
		capabilities: response.capabilities,
		counts: response.counts,
		latest: response.latest,
		events: response.events,
		pendingActions: response.pendingActions,
		nextAction: response.nextAction,
		note: 'External VSIX browser actions support safe open/navigate only. Native-controller-required actions must be retried in bundled VibeCode with controller support.',
	}), null, 2);
}

function sanitizeEvent(event: VibeCodexBrowserActionEvidenceEvent): VibeCodexBrowserActionEvidenceEvent {
	return {
		...event,
		id: redactSensitiveText(event.id),
		action: redactSensitiveText(event.action),
		...(event.url ? { url: redactSensitiveText(event.url) } : {}),
		...(event.selector ? { selector: redactSensitiveText(event.selector).slice(0, 240) } : {}),
		...(event.textPreview ? { textPreview: redactSensitiveText(event.textPreview).slice(0, 240) } : {}),
		...(event.reason ? { reason: redactSensitiveText(event.reason) } : {}),
		...(event.detail ? { detail: redactSensitiveText(event.detail) } : {}),
		...(event.responseMessage ? { responseMessage: redactSensitiveText(event.responseMessage) } : {}),
	};
}

function isBrowserActionStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return browserActionStatusToolNames.has(tool);
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
	return Number.isFinite(numeric) ? Math.max(0, Math.min(max, Math.floor(numeric))) : fallback;
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
