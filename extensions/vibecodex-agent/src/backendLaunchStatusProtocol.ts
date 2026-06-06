/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExternalBridgeStatus, JsonRpcFraming, JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexBackendLaunchTransport = 'stdio' | 'pipe' | 'websocket';

export interface VibeCodexBackendLaunchStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeRoutes: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexBackendLaunchConfig {
	readonly selectedTransport: VibeCodexBackendLaunchTransport;
	readonly framing: JsonRpcFraming;
	readonly command?: string;
	readonly args?: readonly string[];
	readonly cwd?: string;
	readonly pipePath?: string;
	readonly websocketUrl?: string;
}

export interface VibeCodexBackendLaunchRoute {
	readonly transport: VibeCodexBackendLaunchTransport;
	readonly selected: boolean;
	readonly ready: boolean;
	readonly mode: 'managed-process' | 'attach-pipe' | 'attach-websocket';
	readonly endpoint: string;
	readonly detail: string;
	readonly blockers: readonly string[];
	readonly warnings: readonly string[];
}

export interface VibeCodexBackendLaunchStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly method: string;
	readonly generatedAt: number;
	readonly connected: boolean;
	readonly bridgeState: ExternalBridgeStatus['state'] | 'unavailable';
	readonly handshake: NonNullable<ExternalBridgeStatus['handshake']> | 'unknown';
	readonly selectedTransport: VibeCodexBackendLaunchTransport;
	readonly framing: JsonRpcFraming;
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly selectedRoute: VibeCodexBackendLaunchRoute;
	readonly routes?: readonly VibeCodexBackendLaunchRoute[];
	readonly blockers: readonly string[];
	readonly warnings: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

const backendLaunchStatusMethods = new Set([
	'agent/getBackendLaunchStatus',
	'agent/backendLaunchStatus',
	'backend/launchStatus',
	'bridge/launchStatus',
	'codex/launchStatus',
	'vibecodex/backendLaunchStatus',
]);

const backendLaunchStatusToolNames = new Set([
	'backend_launch_status',
	'launch_status',
	'app_server_status',
	'codex_app_server_status',
	'bridge_launch_status',
]);

export function normalizeBackendLaunchStatusRequest(message: JsonRpcMessage): VibeCodexBackendLaunchStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!backendLaunchStatusMethods.has(message.method) && !isBackendLaunchStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeRoutes: booleanValue(payload.includeRoutes)
			?? booleanValue(payload.include_routes)
			?? booleanValue(args.includeRoutes)
			?? booleanValue(args.include_routes)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createBackendLaunchStatusResponse(request: VibeCodexBackendLaunchStatusRequest, input: {
	readonly config: VibeCodexBackendLaunchConfig;
	readonly bridgeStatus?: ExternalBridgeStatus;
}): VibeCodexBackendLaunchStatusResponse {
	const config = sanitizeConfig(input.config);
	const routes = createBackendLaunchRoutes(config);
	const selectedRoute = routes.find(route => route.selected) ?? routes[0];
	const blockers = selectedRoute.blockers;
	const warnings = selectedRoute.warnings;
	const connected = input.bridgeStatus?.state === 'connected';
	const bridgeState: VibeCodexBackendLaunchStatusResponse['bridgeState'] = input.bridgeStatus?.state ?? 'unavailable';
	const handshake = input.bridgeStatus?.handshake ?? 'unknown';
	const ready = selectedRoute.ready;
	const responseWithoutMessage = {
		ok: true,
		source: 'externalExtension' as const,
		method: request.method,
		generatedAt: Date.now(),
		connected,
		bridgeState,
		handshake,
		selectedTransport: config.selectedTransport,
		framing: config.framing,
		ready,
		blocked: !ready,
		selectedRoute,
		...(request.includeRoutes ? { routes } : {}),
		blockers,
		warnings,
		nextAction: connected
			? 'Backend bridge is connected. Continue with protocol_status for live JSON-RPC health or send agent requests through the active bridge.'
			: ready
				? 'Use Connect App Server to start or attach to this configured Codex app-server route.'
				: 'Fix the selected backend launch configuration before connecting the Codex app-server bridge.',
		guardrails: backendLaunchStatusGuardrails,
	};
	const response = {
		...responseWithoutMessage,
		message: backendLaunchStatusSummary(responseWithoutMessage),
	} satisfies Omit<VibeCodexBackendLaunchStatusResponse, 'promptBlock'>;
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: backendLaunchStatusPromptBlock(response) } : {}),
	};
}

export function backendLaunchStatusSummary(response: Pick<VibeCodexBackendLaunchStatusResponse, 'selectedTransport' | 'framing' | 'ready' | 'connected' | 'bridgeState' | 'blockers'>): string {
	const state = response.connected ? 'connected' : response.ready ? 'ready' : 'blocked';
	const blockers = response.blockers.length ? `; blockers=${response.blockers.length}` : '';
	return `Backend launch readiness: ${response.selectedTransport}/${response.framing} ${state}; bridge=${response.bridgeState}${blockers}.`;
}

const backendLaunchStatusGuardrails = [
	'Backend launch status is read-only and never starts processes, opens sockets, connects WebSockets, sends JSON-RPC requests, approves plans, runs tools, or mutates files.',
	'Command, args, cwd, pipe path, WebSocket URL, and bridge details are redacted before being returned to the backend.',
	'Readiness is configuration-only; use Connect App Server, Disconnect App Server, or Restart App Server for runtime state changes.',
	'stdio starts the configured Codex app-server process only after an explicit connect action; pipe and websocket attach only after explicit connect.',
	'Use protocol_status after connection for live handshake, pending request, framing, and event diagnostics.',
];

function createBackendLaunchRoutes(config: VibeCodexBackendLaunchConfig): readonly VibeCodexBackendLaunchRoute[] {
	return [
		stdioRoute(config),
		pipeRoute(config),
		websocketRoute(config),
	];
}

function stdioRoute(config: VibeCodexBackendLaunchConfig): VibeCodexBackendLaunchRoute {
	const command = config.command?.trim() ?? '';
	const args = config.args ?? [];
	const blockers = [
		command ? undefined : 'Codex command is required for stdio transport.',
		/[;&|`$<>]/.test(command) ? 'Codex command must be an executable path, not a shell expression.' : undefined,
		args.length ? undefined : 'Codex app-server args are required for stdio transport.',
		args.some(arg => !arg.trim()) ? 'Codex app-server args must not be empty.' : undefined,
		args.some(arg => /[\r\n\u0000]/.test(arg)) ? 'Codex app-server args must not contain control characters.' : undefined,
		config.cwd && /[\r\n\u0000]/.test(config.cwd) ? 'Workspace cwd must not contain control characters.' : undefined,
	].filter((item): item is string => !!item);
	return {
		transport: 'stdio',
		selected: config.selectedTransport === 'stdio',
		ready: blockers.length === 0,
		mode: 'managed-process',
		endpoint: redactSensitiveText([command || 'not configured', ...args].join(' ')),
		detail: 'Starts the configured Codex app-server process over stdio after an explicit Connect App Server action.',
		blockers,
		warnings: config.selectedTransport === 'stdio' && !config.cwd ? ['No workspace cwd is configured; Codex app-server will inherit the extension host cwd if started.'] : [],
	};
}

function pipeRoute(config: VibeCodexBackendLaunchConfig): VibeCodexBackendLaunchRoute {
	const pipePath = config.pipePath?.trim() ?? '';
	const blockers = [
		pipePath ? undefined : 'Pipe path is required for pipe transport.',
		/[\r\n\u0000]/.test(pipePath) ? 'Pipe path must not contain control characters.' : undefined,
	].filter((item): item is string => !!item);
	return {
		transport: 'pipe',
		selected: config.selectedTransport === 'pipe',
		ready: blockers.length === 0,
		mode: 'attach-pipe',
		endpoint: redactSensitiveText(pipePath || 'not configured'),
		detail: 'Attaches to an already-running Codex app-server Unix socket or Windows named pipe after an explicit Connect App Server action.',
		blockers,
		warnings: [],
	};
}

function websocketRoute(config: VibeCodexBackendLaunchConfig): VibeCodexBackendLaunchRoute {
	const websocketUrl = config.websocketUrl?.trim() ?? '';
	const blockers = [
		websocketUrl ? undefined : 'WebSocket URL is required for websocket transport.',
		/[\r\n\u0000]/.test(websocketUrl) ? 'WebSocket URL must not contain control characters.' : undefined,
		websocketUrl && !/^wss?:\/\/[^/]+(?:\/|$)/i.test(websocketUrl) ? 'WebSocket URL must start with ws:// or wss://.' : undefined,
	].filter((item): item is string => !!item);
	return {
		transport: 'websocket',
		selected: config.selectedTransport === 'websocket',
		ready: blockers.length === 0,
		mode: 'attach-websocket',
		endpoint: redactSensitiveText(websocketUrl || 'not configured'),
		detail: 'Attaches to an already-running Codex app-server WebSocket endpoint after an explicit Connect App Server action.',
		blockers,
		warnings: websocketUrl.startsWith('ws://') ? ['Plain ws:// transport is local/dev oriented; prefer wss:// for remote endpoints.'] : [],
	};
}

function backendLaunchStatusPromptBlock(response: Omit<VibeCodexBackendLaunchStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'backend_launch_status',
		selectedTransport: response.selectedTransport,
		framing: response.framing,
		ready: response.ready,
		connected: response.connected,
		bridgeState: response.bridgeState,
		handshake: response.handshake,
		selectedRoute: response.selectedRoute,
		blockers: response.blockers,
		warnings: response.warnings,
		nextAction: response.nextAction,
		guardrails: response.guardrails,
	}), null, 2);
}

function sanitizeConfig(config: VibeCodexBackendLaunchConfig): VibeCodexBackendLaunchConfig {
	return {
		selectedTransport: normalizeTransport(config.selectedTransport),
		framing: config.framing === 'content-length' ? 'content-length' : 'ndjson',
		command: redactSensitiveText(config.command ?? ''),
		args: (config.args ?? []).map(arg => redactSensitiveText(String(arg))),
		...(config.cwd ? { cwd: redactSensitiveText(config.cwd) } : {}),
		...(config.pipePath ? { pipePath: redactSensitiveText(config.pipePath) } : {}),
		...(config.websocketUrl ? { websocketUrl: redactSensitiveText(config.websocketUrl) } : {}),
	};
}

function normalizeTransport(value: unknown): VibeCodexBackendLaunchTransport {
	return value === 'pipe' || value === 'websocket' ? value : 'stdio';
}

function isBackendLaunchStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return backendLaunchStatusToolNames.has(tool);
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
		if (/^(true|1|yes)$/i.test(value.trim())) {
			return true;
		}
		if (/^(false|0|no)$/i.test(value.trim())) {
			return false;
		}
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
