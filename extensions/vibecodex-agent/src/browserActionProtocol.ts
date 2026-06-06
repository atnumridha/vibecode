/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';

export type VibeCodexBrowserActionKind = 'open' | 'navigate' | 'click' | 'type' | 'scroll_down' | 'scroll_up' | 'screenshot' | 'close' | 'unknown';

export interface VibeCodexBrowserActionRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly action: VibeCodexBrowserActionKind;
	readonly url?: string;
	readonly text?: string;
	readonly selector?: string;
	readonly coordinate?: { readonly x: number; readonly y: number };
	readonly reason?: string;
	readonly supported: boolean;
	readonly title: string;
	readonly detail: string;
	readonly requestedAt: number;
}

const browserActionMethods = new Set([
	'browser/action',
	'browser_action',
	'browser/action/request',
	'agent/browserAction',
	'agent/browser/action',
	'cline/browser_action',
	'item/browser/action',
]);

export function normalizeBrowserActionRequest(message: JsonRpcMessage): VibeCodexBrowserActionRequest | undefined {
	if (message.id === undefined || !message.method || !isBrowserActionMethod(message.method, message.params)) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = stringValue(payload.tool) ?? stringValue(args.tool);
	const action = normalizeAction(stringValue(payload.action) ?? stringValue(args.action) ?? stringValue(payload.name) ?? stringValue(args.name) ?? toolName);
	const url = stringValue(payload.url) ?? stringValue(args.url);
	const selector = stringValue(payload.selector) ?? stringValue(args.selector);
	const text = stringValue(payload.text) ?? stringValue(args.text) ?? stringValue(payload.input) ?? stringValue(args.input);
	const coordinate = coordinateFromValue(payload.coordinate) ?? coordinateFromXY(payload.x, payload.y) ?? coordinateFromXY(args.x, args.y);
	const reason = stringValue(payload.reason) ?? stringValue(args.reason) ?? stringValue(payload.description);
	const supported = (action === 'open' || action === 'navigate') && !!url && isSafeUrl(url);
	const nativeRequired = !supported && action !== 'unknown';
	return {
		id: message.id,
		method: message.method,
		action,
		...(url ? { url: redactUrl(url) } : {}),
		...(text ? { text: redactSensitiveText(text).slice(0, 500) } : {}),
		...(selector ? { selector: redactSensitiveText(selector).slice(0, 500) } : {}),
		...(coordinate ? { coordinate } : {}),
		...(reason ? { reason: redactSensitiveText(reason).slice(0, 500) } : {}),
		supported,
		title: action === 'unknown' ? 'Browser action' : `Browser ${action}`,
		detail: redactSensitiveText([
			reason,
			url ? `URL: ${redactUrl(url)}` : undefined,
			selector ? `Selector: ${selector}` : undefined,
			coordinate ? `Coordinate: ${coordinate.x},${coordinate.y}` : undefined,
			text ? `Text: ${text.slice(0, 160)}` : undefined,
			supported ? undefined : nativeRequired
				? `External extension supports open/navigate with explicit safe URLs only. ${browserActionLabel(action)} needs the native browser controller.`
				: 'External extension supports open/navigate with explicit safe URLs only. Unknown browser actions need the native browser controller.',
		].filter((value): value is string => !!value).join('\n') || message.method),
		requestedAt: Date.now(),
	};
}

export function createBrowserActionResponse(request: VibeCodexBrowserActionRequest, accepted: boolean, message?: string): unknown {
	return {
		decision: accepted && request.supported ? 'accept' : 'decline',
		approved: accepted && request.supported,
		action: request.action,
		source: 'externalExtension',
		supported: request.supported,
		nativeControllerRequired: !request.supported,
		...(request.url ? { url: request.url } : {}),
		...(message ? { message } : {}),
	};
}

export function isSafeUrl(url: string): boolean {
	return /^https?:\/\/[^\s]+$/i.test(url);
}

function isBrowserActionMethod(method: string, params: unknown): boolean {
	if (browserActionMethods.has(method)) {
		return true;
	}
	if (method !== 'item/tool/call') {
		return false;
	}
	const payload = isRecord(params) ? params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return tool === 'browser_action' || tool === 'browser' || tool === 'browser_action_tool' || tool === 'open_browser' || tool === 'browser_open' || tool === 'browser_navigate';
}

function normalizeAction(action: string | undefined): VibeCodexBrowserActionKind {
	const lower = action?.toLowerCase();
	if (lower === 'launch' || lower === 'open' || lower === 'open_url' || lower === 'open_browser' || lower === 'browser_open') {
		return 'open';
	}
	if (lower === 'navigate' || lower === 'goto' || lower === 'visit' || lower === 'browser_navigate') {
		return 'navigate';
	}
	if (lower === 'click') {
		return 'click';
	}
	if (lower === 'type' || lower === 'input') {
		return 'type';
	}
	if (lower === 'scroll_down' || lower === 'scroll-down' || lower === 'scrolldown' || lower === 'scroll down' || lower === 'pagedown' || lower === 'page_down') {
		return 'scroll_down';
	}
	if (lower === 'scroll_up' || lower === 'scroll-up' || lower === 'scrollup' || lower === 'scroll up' || lower === 'pageup' || lower === 'page_up') {
		return 'scroll_up';
	}
	if (lower === 'screenshot' || lower === 'capture') {
		return 'screenshot';
	}
	if (lower === 'close') {
		return 'close';
	}
	return 'unknown';
}

function browserActionLabel(action: VibeCodexBrowserActionKind): string {
	switch (action) {
		case 'scroll_down':
			return 'Scroll down';
		case 'scroll_up':
			return 'Scroll up';
		default:
			return action.charAt(0).toUpperCase() + action.slice(1);
	}
}

function coordinateFromValue(value: unknown): { readonly x: number; readonly y: number } | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	return coordinateFromXY(value.x, value.y);
}

function coordinateFromXY(x: unknown, y: unknown): { readonly x: number; readonly y: number } | undefined {
	const xNumber = numberValue(x);
	const yNumber = numberValue(y);
	return xNumber === undefined || yNumber === undefined ? undefined : { x: xNumber, y: yNumber };
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^-?[0-9]+(?:\.[0-9]+)?$/.test(value)) {
		return Number(value);
	}
	return undefined;
}

function redactUrl(url: string): string {
	const noCredentials = url.replace(/^(https?:\/\/)([^/@]+)@/i, '$1[redacted]@');
	const [base, query] = noCredentials.split('?', 2);
	if (!query) {
		return noCredentials;
	}
	return `${base}?${query.split('&').map(part => {
		const key = part.split('=', 1)[0];
		return /token|key|secret|password|auth/i.test(key) ? `${key}=[redacted]` : part;
	}).join('&')}`;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
