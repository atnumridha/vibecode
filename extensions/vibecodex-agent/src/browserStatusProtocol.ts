/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexBrowserActionRequest } from './browserActionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';

export interface VibeCodexBrowserStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includePendingActions: boolean;
	readonly maxActions: number;
	readonly requestedAt: number;
}

export interface VibeCodexBrowserStatusAction {
	readonly id: string;
	readonly action: string;
	readonly supported: boolean;
	readonly title: string;
	readonly detail: string;
	readonly requestedAt: number;
	readonly url?: string;
	readonly selector?: string;
	readonly textPreview?: string;
}

export interface VibeCodexBrowserStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
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
		readonly loopbackPreviewPanel: true;
	};
	readonly approval: {
		readonly exactPlanApprovalRequired: true;
		readonly explicitUserApprovalRequired: true;
		readonly hasExecutionAuthorization: boolean;
		readonly pendingActions: number;
	};
	readonly pendingActions?: readonly VibeCodexBrowserStatusAction[];
	readonly counts: {
		readonly pendingActions: number;
		readonly returnedActions: number;
		readonly supportedPendingActions: number;
		readonly nativeRequiredPendingActions: number;
	};
	readonly guardrails: readonly string[];
	readonly message: string;
	readonly promptBlock: string;
}

const browserStatusMethods = new Set([
	'agent/getBrowserStatus',
	'agent/browserStatus',
	'browser/status',
	'browser/capabilityStatus',
	'browser/support',
	'vibecodex/browserStatus',
]);

const browserStatusToolNames = new Set([
	'browser_status',
	'get_browser_status',
	'browser_capability_status',
	'browser_support_status',
	'browser_tool_status',
]);

const defaultMaxActions = 12;
const maxActionLimit = 50;
const supportedActions = ['open', 'navigate'] as const;
const nativeRequiredActions = ['click', 'type', 'scroll_down', 'scroll_up', 'screenshot', 'close'] as const;

export function normalizeBrowserStatusRequest(message: JsonRpcMessage): VibeCodexBrowserStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!browserStatusMethods.has(message.method) && !isBrowserStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includePendingActions: booleanValue(payload.includePendingActions)
			?? booleanValue(payload.include_pending_actions)
			?? booleanValue(args.includePendingActions)
			?? booleanValue(args.include_pending_actions)
			?? true,
		maxActions: clampNumber(numberValue(payload.maxActions)
			?? numberValue(payload.max_actions)
			?? numberValue(args.maxActions)
			?? numberValue(args.max_actions)
			?? defaultMaxActions, 0, maxActionLimit),
		requestedAt: Date.now(),
	};
}

export function createBrowserStatusResponse(request: VibeCodexBrowserStatusRequest, input: {
	readonly pendingActions?: readonly VibeCodexBrowserActionRequest[];
	readonly hasExecutionAuthorization?: boolean;
}): VibeCodexBrowserStatusResponse {
	const pendingActions = [...(input.pendingActions ?? [])];
	const returnedActions = request.includePendingActions ? pendingActions.slice(0, request.maxActions).map(sanitizeAction) : [];
	const responseWithoutText = {
		ok: true as const,
		source: 'externalExtension' as const,
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
			loopbackPreviewPanel: true as const,
		},
		approval: {
			exactPlanApprovalRequired: true as const,
			explicitUserApprovalRequired: true as const,
			hasExecutionAuthorization: !!input.hasExecutionAuthorization,
			pendingActions: pendingActions.length,
		},
		...(request.includePendingActions ? { pendingActions: returnedActions } : {}),
		counts: {
			pendingActions: pendingActions.length,
			returnedActions: returnedActions.length,
			supportedPendingActions: pendingActions.filter(action => action.supported).length,
			nativeRequiredPendingActions: pendingActions.filter(action => !action.supported).length,
		},
		guardrails: browserStatusGuardrails(),
	};
		const response = {
			...responseWithoutText,
			message: browserStatusSummary(responseWithoutText),
			promptBlock: browserStatusPromptBlock(responseWithoutText),
		};
		return response;
	}

export function browserStatusSummary(response: Pick<VibeCodexBrowserStatusResponse, 'counts' | 'approval' | 'controller'>): string {
	const pending = response.counts.pendingActions === 1 ? '1 pending browser action' : `${response.counts.pendingActions} pending browser actions`;
	const native = response.controller.nativeControllerAvailable ? 'native browser controller available' : 'native browser controller unavailable';
	const auth = response.approval.hasExecutionAuthorization ? 'plan authorized' : 'plan not authorized';
	return `Browser status: ${pending}; ${response.counts.supportedPendingActions} supported; ${response.counts.nativeRequiredPendingActions} native-required; ${native}; ${auth}.`;
}

function browserStatusPromptBlock(response: Omit<VibeCodexBrowserStatusResponse, 'message' | 'promptBlock'>): string {
	return JSON.stringify({
		controller: response.controller,
		capabilities: response.capabilities,
		approval: response.approval,
		counts: response.counts,
		pendingActions: response.pendingActions,
		guardrails: response.guardrails,
		note: 'Browser status is read-only. Request browser_action only for supported open/navigate safe URLs in the external VSIX; click/type/scroll_down/scroll_up/screenshot/close require the native VibeCode browser controller.',
	}, null, 2);
}

function browserStatusGuardrails(): readonly string[] {
	return [
		'Browser status is read-only and never opens browsers, navigates pages, clicks, types, screenshots, closes tabs, approves actions, or mutates files.',
		'External VS Code installs support only approval-gated open/navigate actions with safe http(s) URLs.',
		'Click, type, scroll_down, scroll_up, screenshot, and close actions require the bundled native VibeCode browser controller.',
		'All browser actions still require exact visual-plan authorization and explicit approval unless a supported auto-approve policy applies.',
	];
}

function sanitizeAction(action: VibeCodexBrowserActionRequest): VibeCodexBrowserStatusAction {
	return {
		id: redactSensitiveText(String(action.id)),
		action: action.action,
		supported: action.supported,
		title: redactSensitiveText(action.title),
		detail: redactSensitiveText(action.detail),
		requestedAt: action.requestedAt,
		...(action.url ? { url: redactSensitiveText(action.url) } : {}),
		...(action.selector ? { selector: redactSensitiveText(action.selector).slice(0, 240) } : {}),
		...(action.text ? { textPreview: redactSensitiveText(action.text).slice(0, 240) } : {}),
	};
}

function isBrowserStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return browserStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : defaultMaxActions)));
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) {
		return Number(value);
	}
	return undefined;
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
