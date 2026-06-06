/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type VibeCodexProtocolDirection = 'in' | 'out' | 'status' | 'error';

export interface VibeCodexProtocolEvent {
	readonly id: string;
	readonly timestamp: number;
	readonly direction: VibeCodexProtocolDirection;
	readonly label: string;
	readonly method?: string;
	readonly payload?: unknown;
}

const maxProtocolEvents = 120;
const maxDepth = 8;
const maxArrayItems = 40;
const maxStringLength = 3000;
const sensitiveKeyPattern = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|approval[-_]?token|authorization|password|secret|credential|bearer)/i;

export function createProtocolEvent(direction: VibeCodexProtocolDirection, label: string, payload?: unknown): VibeCodexProtocolEvent {
	const timestamp = Date.now();
	const redactedPayload = payload === undefined ? undefined : redactProtocolValue(payload);
	return {
		id: `protocol-${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		timestamp,
		direction,
		label,
		...(methodFromPayload(payload) ? { method: methodFromPayload(payload) } : {}),
		...(redactedPayload !== undefined ? { payload: redactedPayload } : {}),
	};
}

export function appendProtocolEvent(events: readonly VibeCodexProtocolEvent[], event: VibeCodexProtocolEvent): readonly VibeCodexProtocolEvent[] {
	return [event, ...events].slice(0, maxProtocolEvents);
}

export function redactProtocolValue(value: unknown, depth = 0): unknown {
	if (depth > maxDepth) {
		return '[truncated]';
	}
	if (typeof value === 'string') {
		return redactString(value);
	}
	if (typeof value !== 'object' || value === null) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.slice(0, maxArrayItems).map(item => redactProtocolValue(item, depth + 1));
	}
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		if (sensitiveKeyPattern.test(key)) {
			result[key] = '[redacted]';
			continue;
		}
		result[key] = redactProtocolValue(item, depth + 1);
	}
	return result;
}

function methodFromPayload(payload: unknown): string | undefined {
	if (typeof payload !== 'object' || payload === null) {
		return undefined;
	}
	const method = (payload as { readonly method?: unknown }).method;
	return typeof method === 'string' ? method : undefined;
}

function redactString(value: string): string {
	const redacted = value
		.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
		.replace(/vibecodex-plan:[^\s"',}]+/g, '[redacted:approval-token]')
		.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
		.replace(/((?:api[-_]?key|access[-_]?token|refresh[-_]?token|approval[-_]?token|authorization|password|secret)=)[^\s&]+/gi, '$1[redacted]');
	return redacted.length > maxStringLength ? `${redacted.slice(0, maxStringLength)}\n[truncated]` : redacted;
}
