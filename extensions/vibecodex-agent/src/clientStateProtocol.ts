/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';

export interface VibeCodexClientStateRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeProtocolDiagnostics: boolean;
	readonly requestedAt: number;
}

const clientStateMethods = new Set([
	'agent/getClientState',
	'agent/clientState',
	'client/getState',
	'client/state',
	'vibecodex/getState',
]);

export function normalizeClientStateRequest(message: JsonRpcMessage): VibeCodexClientStateRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	if (!isClientStateMethod(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeProtocolDiagnostics: booleanValue(payload.includeProtocolDiagnostics)
			?? booleanValue(args.includeProtocolDiagnostics)
			?? booleanValue(payload.includeProtocol)
			?? booleanValue(args.includeProtocol)
			?? false,
		requestedAt: Date.now(),
	};
}

export function clientStateRequestSummary(request: VibeCodexClientStateRequest): string {
	return `Client state requested through ${request.method}${request.includeProtocolDiagnostics ? ' with protocol diagnostics' : ''}.`;
}

function isClientStateMethod(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (clientStateMethods.has(method)) {
		return true;
	}
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return tool === 'get_client_state' || tool === 'vibecodex.getclientstate' || tool === 'agent.getclientstate';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}
