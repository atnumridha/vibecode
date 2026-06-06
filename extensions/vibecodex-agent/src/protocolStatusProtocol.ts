/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createAgentInitializeParams, vibeCodexHandshakeCapabilityGroups, vibeCodexSupportedTransports, type VibeCodexSupportedTransport } from './bridgeHandshakeContract';
import type { ExternalBridgeStatus, JsonRpcFraming, JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexProtocolDirection, VibeCodexProtocolEvent } from './protocolDiagnostics';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexProtocolStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeEvents: boolean;
	readonly maxEvents: number;
	readonly direction?: VibeCodexProtocolDirection;
	readonly requestedAt: number;
}

export interface VibeCodexProtocolStatusEvent {
	readonly id: string;
	readonly timestamp: number;
	readonly direction: VibeCodexProtocolDirection;
	readonly label: string;
	readonly method?: string;
	readonly payloadPreview?: unknown;
}

export interface VibeCodexProtocolTransportConfig {
	readonly selectedTransport: VibeCodexSupportedTransport;
	readonly framing: JsonRpcFraming;
	readonly command?: string;
	readonly args?: readonly string[];
	readonly cwd?: string;
	readonly pipePath?: string;
	readonly websocketUrl?: string;
}

export interface VibeCodexProtocolTransportRoute {
	readonly transport: VibeCodexSupportedTransport;
	readonly selected: boolean;
	readonly ready: boolean;
	readonly endpoint: string;
	readonly detail: string;
	readonly blockers: readonly string[];
}

export interface VibeCodexProtocolTransportReadiness {
	readonly selectedTransport: VibeCodexSupportedTransport;
	readonly framing: JsonRpcFraming;
	readonly ready: boolean;
	readonly supportedTransports: readonly VibeCodexSupportedTransport[];
	readonly blockers: readonly string[];
	readonly routes: readonly VibeCodexProtocolTransportRoute[];
	readonly guardrails: readonly string[];
}

export interface VibeCodexProtocolHandshakeGroup {
	readonly id: string;
	readonly title: string;
	readonly critical: boolean;
	readonly available: boolean;
	readonly advertisedCapabilities: number;
	readonly methods: readonly string[];
}

export interface VibeCodexProtocolHandshakeCoverage {
	readonly complete: boolean;
	readonly totalCapabilities: number;
	readonly groupedCapabilities: number;
	readonly ungroupedCapabilities: readonly string[];
	readonly duplicateCapabilities: readonly string[];
	readonly unknownGroupedCapabilities: readonly string[];
	readonly criticalGroupCount: number;
	readonly optionalGroupCount: number;
	readonly methodCount: number;
}

export interface VibeCodexProtocolHandshakeReadiness {
	readonly client: 'vibecodex.agent';
	readonly version: 1;
	readonly backendHandshake: 'unknown' | 'ok' | 'unsupported' | 'failed';
	readonly backendAccepted: boolean;
	readonly ready: boolean;
	readonly supportedTransports: readonly VibeCodexSupportedTransport[];
	readonly advertisedCapabilities: number;
	readonly requiredCapabilities: readonly string[];
	readonly missingRequired: readonly string[];
	readonly groups: readonly VibeCodexProtocolHandshakeGroup[];
	readonly coverage: VibeCodexProtocolHandshakeCoverage;
	readonly guardrails: readonly string[];
}

export interface VibeCodexProtocolStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly method: string;
	readonly generatedAt: number;
	readonly bridgeAvailable: boolean;
	readonly bridge?: ExternalBridgeStatus;
	readonly requestedDirection?: VibeCodexProtocolDirection;
	readonly counts: {
		readonly totalEvents: number;
		readonly returnedEvents: number;
		readonly in: number;
		readonly out: number;
		readonly status: number;
		readonly error: number;
		readonly pendingRequests: number;
	};
	readonly methods: readonly string[];
	readonly events: readonly VibeCodexProtocolStatusEvent[];
	readonly health: {
		readonly state: string;
		readonly handshake: string;
		readonly transport: string;
		readonly framing: string;
		readonly pendingRequests: number;
		readonly stale: boolean;
		readonly oldestPendingMs?: number;
		readonly lastMessageAt?: number;
		readonly lastSendAt?: number;
	};
	readonly handshakeCapabilities: VibeCodexProtocolHandshakeReadiness;
	readonly transportReadiness?: VibeCodexProtocolTransportReadiness;
	readonly guardrails: readonly string[];
	readonly message: string;
	readonly promptBlock: string;
}

const protocolStatusMethods = new Set([
	'agent/getProtocolStatus',
	'agent/protocolStatus',
	'protocol/status',
	'bridge/status',
	'jsonrpc/status',
	'vibecodex/protocolStatus',
]);

const protocolStatusToolNames = new Set([
	'protocol_status',
	'get_protocol_status',
	'bridge_status',
	'jsonrpc_status',
	'rpc_status',
]);

const defaultMaxEvents = 20;
const maxEventLimit = 80;
const maxPayloadPreviewLength = 1200;

export function normalizeProtocolStatusRequest(message: JsonRpcMessage): VibeCodexProtocolStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!protocolStatusMethods.has(message.method) && !isProtocolStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const direction = normalizeDirection(stringValue(payload.direction) ?? stringValue(args.direction));
	return {
		id: message.id,
		method: message.method,
		includeEvents: booleanValue(payload.includeEvents)
			?? booleanValue(payload.include_events)
			?? booleanValue(args.includeEvents)
			?? booleanValue(args.include_events)
			?? true,
		maxEvents: clampNumber(
			numberValue(payload.maxEvents)
				?? numberValue(payload.max_events)
				?? numberValue(args.maxEvents)
				?? numberValue(args.max_events)
				?? defaultMaxEvents,
			0,
			maxEventLimit,
		),
		...(direction ? { direction } : {}),
		requestedAt: Date.now(),
	};
}

export function createProtocolStatusResponse(request: VibeCodexProtocolStatusRequest, input: {
	readonly bridgeStatus?: ExternalBridgeStatus;
	readonly protocolEvents?: readonly VibeCodexProtocolEvent[];
	readonly transportConfig?: VibeCodexProtocolTransportConfig;
}): VibeCodexProtocolStatusResponse {
	const events = input.protocolEvents ?? [];
	const matchingEvents = request.direction ? events.filter(event => event.direction === request.direction) : events;
	const visibleEvents = request.includeEvents ? matchingEvents.slice(0, request.maxEvents).map(sanitizeEvent) : [];
	const counts = countEvents(events);
	const bridge = input.bridgeStatus ? sanitizeBridgeStatus(input.bridgeStatus) : undefined;
	const pendingRequests = bridge?.pendingRequests ?? bridge?.health?.pendingRequests ?? 0;
	const health = {
		state: bridge?.health?.state ?? bridge?.state ?? 'unknown',
		handshake: bridge?.handshake ?? 'unknown',
		transport: bridge?.transport ?? 'unknown',
		framing: bridge?.framing ?? 'unknown',
		pendingRequests,
		stale: bridge?.health?.state === 'stale',
		...(bridge?.health?.oldestPendingMs !== undefined ? { oldestPendingMs: bridge.health.oldestPendingMs } : {}),
		...(bridge?.health?.lastMessageAt !== undefined ? { lastMessageAt: bridge.health.lastMessageAt } : {}),
		...(bridge?.health?.lastSendAt !== undefined ? { lastSendAt: bridge.health.lastSendAt } : {}),
	};
	const handshakeCapabilities = createHandshakeCapabilities(health.handshake as VibeCodexProtocolHandshakeReadiness['backendHandshake']);
	const transportReadiness = input.transportConfig ? createTransportReadiness(input.transportConfig) : undefined;
	const responseWithoutMessage = {
		ok: true,
		source: 'externalExtension' as const,
		method: request.method,
		generatedAt: Date.now(),
		bridgeAvailable: !!bridge,
		...(bridge ? { bridge } : {}),
		...(request.direction ? { requestedDirection: request.direction } : {}),
		counts: {
			totalEvents: events.length,
			returnedEvents: visibleEvents.length,
			in: counts.in,
			out: counts.out,
			status: counts.status,
			error: counts.error,
			pendingRequests,
		},
		methods: [...new Set(events.map(event => event.method).filter((value): value is string => !!value).map(method => redactSensitiveText(method)))].slice(0, 40),
		events: visibleEvents,
		health,
		handshakeCapabilities,
		...(transportReadiness ? { transportReadiness } : {}),
		guardrails: [
			'Protocol status is read-only and never sends JSON-RPC requests, retries pending requests, reconnects transports, approves plans, or executes tools.',
			'Recent events are bounded and redacted; approval tokens, API keys, credentials, and raw secrets are never returned.',
			'Payloads are returned only as capped previews for debugging routing and lifecycle state.',
			'Handshake capability readiness is a local advertised-contract snapshot and never replays agent/initialize or changes backend state.',
			'Transport readiness is configuration-only and never opens sockets, starts processes, resolves paths, or probes network endpoints.',
			'Use client_state only when broader sidebar/task state is required; protocol_status is limited to bridge health and JSON-RPC diagnostics.',
		],
	};
	return {
		...responseWithoutMessage,
		message: protocolStatusSummary(responseWithoutMessage),
		promptBlock: protocolStatusPromptBlock(responseWithoutMessage),
	};
}

export function protocolStatusSummary(response: Pick<VibeCodexProtocolStatusResponse, 'bridgeAvailable' | 'counts' | 'health'>): string {
	if (!response.bridgeAvailable) {
		return `Protocol status: bridge unavailable; ${response.counts.totalEvents} recorded event${response.counts.totalEvents === 1 ? '' : 's'}.`;
	}
	const pending = response.counts.pendingRequests ? ` ${response.counts.pendingRequests} pending request${response.counts.pendingRequests === 1 ? '' : 's'}.` : '';
	return `Protocol status: health=${response.health.state}, handshake=${response.health.handshake}, transport=${response.health.transport}/${response.health.framing}; ${response.counts.totalEvents} event${response.counts.totalEvents === 1 ? '' : 's'}, ${response.counts.error} error${response.counts.error === 1 ? '' : 's'}.${pending}`;
}

function protocolStatusPromptBlock(response: Omit<VibeCodexProtocolStatusResponse, 'message' | 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		bridgeAvailable: response.bridgeAvailable,
		counts: response.counts,
		health: response.health,
		handshakeCapabilities: response.handshakeCapabilities,
		transportReadiness: response.transportReadiness,
		methods: response.methods,
		events: response.events,
		guardrails: response.guardrails,
		note: 'Protocol status is observability-only. Backend must not treat it as plan approval, tool approval, transport reconnect permission, or task-completion evidence.',
	}), null, 2);
}

function createHandshakeCapabilities(backendHandshake: VibeCodexProtocolHandshakeReadiness['backendHandshake']): VibeCodexProtocolHandshakeReadiness {
	const contract = createAgentInitializeParams();
	const groups = vibeCodexHandshakeCapabilityGroups.map(group => {
		const advertisedCapabilities = group.capabilities.filter(key => capabilityPresent(contract.capabilities[key])).length;
		return {
			id: group.id,
			title: group.title,
			critical: group.critical,
			available: advertisedCapabilities === group.capabilities.length,
			advertisedCapabilities,
			methods: group.methods.map(method => redactSensitiveText(method)),
		};
	});
	const missingRequired = groups
		.filter(group => group.critical && !group.available)
		.map(group => group.id);
	const coverage = createHandshakeContractCoverage(contract);
	const backendAccepted = backendHandshake === 'ok';
	return {
		client: contract.client,
		version: contract.version,
		backendHandshake,
		backendAccepted,
		ready: backendAccepted && missingRequired.length === 0 && coverage.complete,
		supportedTransports: contract.transports,
		advertisedCapabilities: Object.keys(contract.capabilities).length,
		requiredCapabilities: groups.filter(group => group.critical).map(group => group.id),
		missingRequired,
		groups,
		coverage,
		guardrails: [
			'Handshake capability readiness is read-only and never sends agent/initialize, reconnects transports, approves plans, or executes tools.',
			'The snapshot mirrors the local client capability contract advertised during bridge startup so backend incompatibilities are visible in Protocol Health.',
			'Handshake contract coverage is computed locally from bridgeHandshakeContract.ts and flags ungrouped, duplicate, or unknown advertised capabilities before runtime drift reaches a backend.',
			'Backend acceptance is derived only from the latest bridge health handshake field; unsupported or failed handshakes remain visible without changing connection state.',
			'Capability method names are redacted and capped to stable route names only; no request payloads, approval tokens, provider secrets, or terminal output are included.',
		],
	};
}

export function createHandshakeContractCoverage(contract = createAgentInitializeParams()): VibeCodexProtocolHandshakeCoverage {
	const capabilityKeys = Object.keys(contract.capabilities).sort();
	const capabilityKeySet = new Set(capabilityKeys);
	const groupedCounts = new Map<string, number>();
	const methods = new Set<string>();
	let criticalGroupCount = 0;
	let optionalGroupCount = 0;
	for (const group of vibeCodexHandshakeCapabilityGroups) {
		if (group.critical) {
			criticalGroupCount++;
		} else {
			optionalGroupCount++;
		}
		for (const capability of group.capabilities) {
			const key = String(capability);
			groupedCounts.set(key, (groupedCounts.get(key) ?? 0) + 1);
		}
		for (const method of group.methods) {
			methods.add(redactSensitiveText(method));
		}
	}
	const groupedCapabilities = capabilityKeys.filter(key => groupedCounts.has(key)).length;
	const ungroupedCapabilities = capabilityKeys
		.filter(key => !groupedCounts.has(key))
		.map(key => redactSensitiveText(key));
	const duplicateCapabilities = [...groupedCounts.entries()]
		.filter(([key, count]) => capabilityKeySet.has(key) && count > 1)
		.map(([key]) => redactSensitiveText(key))
		.sort();
	const unknownGroupedCapabilities = [...groupedCounts.keys()]
		.filter(key => !capabilityKeySet.has(key))
		.map(key => redactSensitiveText(key))
		.sort();
	return {
		complete: ungroupedCapabilities.length === 0 && duplicateCapabilities.length === 0 && unknownGroupedCapabilities.length === 0,
		totalCapabilities: capabilityKeys.length,
		groupedCapabilities,
		ungroupedCapabilities,
		duplicateCapabilities,
		unknownGroupedCapabilities,
		criticalGroupCount,
		optionalGroupCount,
		methodCount: methods.size,
	};
}

function capabilityPresent(value: unknown): boolean {
	if (value === undefined || value === null) {
		return false;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		return value.trim().length > 0;
	}
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (typeof value === 'object') {
		return Object.keys(value).length > 0;
	}
	return true;
}

function createTransportReadiness(config: VibeCodexProtocolTransportConfig): VibeCodexProtocolTransportReadiness {
	const selectedTransport = config.selectedTransport;
	const routes = vibeCodexSupportedTransports.map(transport => transportRoute(transport, config));
	const selected = routes.find(route => route.selected) ?? routes[0];
	return {
		selectedTransport,
		framing: config.framing,
		ready: selected.ready,
		supportedTransports: vibeCodexSupportedTransports,
		blockers: selected.blockers,
		routes,
		guardrails: [
			'Transport readiness is read-only and never starts Codex, opens sockets, connects WebSockets, reconnects transports, or sends JSON-RPC frames.',
			'Command, pipe path, WebSocket URL, cwd, and args are redacted before they are returned.',
			'Use explicit Connect, Disconnect, or Restart controls to change runtime bridge state.',
			'The selected transport must be ready before a backend connection attempt is expected to succeed.',
		],
	};
}

function transportRoute(transport: VibeCodexProtocolTransportRoute['transport'], config: VibeCodexProtocolTransportConfig): VibeCodexProtocolTransportRoute {
	const blockers = transportBlockers(transport, config).map(redactSensitiveText);
	return {
		transport,
		selected: config.selectedTransport === transport,
		ready: blockers.length === 0,
		endpoint: transportEndpoint(transport, config),
		detail: transportDetail(transport, config),
		blockers,
	};
}

function transportBlockers(transport: VibeCodexProtocolTransportRoute['transport'], config: VibeCodexProtocolTransportConfig): readonly string[] {
	if (transport === 'stdio') {
		const command = config.command?.trim() ?? '';
		const args = config.args ?? [];
		return [
			command ? undefined : 'Codex command is required for stdio transport.',
			/[;&|`$<>]/.test(command) ? 'Codex command must be an executable path, not a shell expression.' : undefined,
			args.length ? undefined : 'Codex app-server args are required for stdio transport.',
			args.some(arg => !arg.trim()) ? 'Codex app-server args must not be empty.' : undefined,
			args.some(arg => /[\r\n\u0000]/.test(arg)) ? 'Codex app-server args must not contain control characters.' : undefined,
		].filter((value): value is string => !!value);
	}
	if (transport === 'pipe') {
		const pipePath = config.pipePath?.trim() ?? '';
		return [
			pipePath ? undefined : 'Pipe path is required for pipe transport.',
			/[\r\n\u0000]/.test(pipePath) ? 'Pipe path must not contain control characters.' : undefined,
		].filter((value): value is string => !!value);
	}
	const websocketUrl = config.websocketUrl?.trim() ?? '';
	return [
		websocketUrl ? undefined : 'WebSocket URL is required for websocket transport.',
		/[\r\n\u0000]/.test(websocketUrl) ? 'WebSocket URL must not contain control characters.' : undefined,
		websocketUrl && !/^wss?:\/\/[^/]+(?:\/|$)/i.test(websocketUrl) ? 'WebSocket URL must start with ws:// or wss://.' : undefined,
	].filter((value): value is string => !!value);
}

function transportEndpoint(transport: VibeCodexProtocolTransportRoute['transport'], config: VibeCodexProtocolTransportConfig): string {
	if (transport === 'stdio') {
		return redactSensitiveText([config.command, ...(config.args ?? [])].filter(Boolean).join(' ') || 'not configured');
	}
	if (transport === 'pipe') {
		return redactSensitiveText(config.pipePath?.trim() || 'not configured');
	}
	return redactSensitiveText(config.websocketUrl?.trim() || 'not configured');
}

function transportDetail(transport: VibeCodexProtocolTransportRoute['transport'], config: VibeCodexProtocolTransportConfig): string {
	if (transport === 'stdio') {
		return [
			'Starts the configured Codex app-server process over stdio.',
			`Command: ${transportEndpoint(transport, config)}`,
			config.cwd ? `cwd: ${redactSensitiveText(config.cwd)}` : undefined,
			`Framing: ${config.framing}`,
		].filter(Boolean).join('\n');
	}
	if (transport === 'pipe') {
		return [
			'Connects to an already-running Unix socket or Windows named pipe.',
			`Pipe: ${transportEndpoint(transport, config)}`,
			`Framing: ${config.framing}`,
		].join('\n');
	}
	return [
		'Connects to an already-running Codex app-server WebSocket endpoint.',
		`URL: ${transportEndpoint(transport, config)}`,
		`Framing: ${config.framing}`,
	].join('\n');
}

function sanitizeBridgeStatus(status: ExternalBridgeStatus): ExternalBridgeStatus {
	return redactSensitiveValue(status) as ExternalBridgeStatus;
}

function sanitizeEvent(event: VibeCodexProtocolEvent): VibeCodexProtocolStatusEvent {
	return {
		id: redactSensitiveText(event.id),
		timestamp: event.timestamp,
		direction: event.direction,
		label: redactSensitiveText(event.label),
		...(event.method ? { method: redactSensitiveText(event.method) } : {}),
		...(event.payload !== undefined ? { payloadPreview: previewPayload(event.payload) } : {}),
	};
}

function previewPayload(payload: unknown): unknown {
	const redacted = redactSensitiveValue(payload);
	const text = typeof redacted === 'string' ? redacted : JSON.stringify(redacted);
	if (!text || text.length <= maxPayloadPreviewLength) {
		return redacted;
	}
	return `${text.slice(0, maxPayloadPreviewLength)}\n[truncated]`;
}

function countEvents(events: readonly VibeCodexProtocolEvent[]): Record<VibeCodexProtocolDirection, number> {
	return events.reduce<Record<VibeCodexProtocolDirection, number>>((counts, event) => {
		counts[event.direction]++;
		return counts;
	}, { in: 0, out: 0, status: 0, error: 0 });
}

function isProtocolStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return protocolStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function normalizeDirection(value: string | undefined): VibeCodexProtocolDirection | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'in' || normalized === 'out' || normalized === 'status' || normalized === 'error') {
		return normalized;
	}
	return undefined;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function numberValue(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(number) ? number : undefined;
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
