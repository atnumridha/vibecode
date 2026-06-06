/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexBackendLaunchStatusResponse } from './backendLaunchStatusProtocol';
import type { VibeCodexProtocolStatusResponse } from './protocolStatusProtocol';
import type { VibeCodexProviderStatusResponse } from './providerStatusProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexRuntimeReadinessRoute =
	| 'inspect_provider'
	| 'configure_provider'
	| 'inspect_backend'
	| 'configure_backend'
	| 'connect_backend'
	| 'inspect_protocol'
	| 'repair_transport'
	| 'repair_handshake'
	| 'repair_protocol'
	| 'ready_for_plan';

export type VibeCodexRuntimeReadinessGateStatus = 'passed' | 'pending' | 'failed' | 'missing';

export interface VibeCodexRuntimeReadinessStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeGates: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexRuntimeReadinessGate {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexRuntimeReadinessGateStatus;
	readonly detail: string;
}

export interface VibeCodexRuntimeReadinessStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly method: string;
	readonly generatedAt: number;
	readonly ready: boolean;
	readonly route: VibeCodexRuntimeReadinessRoute;
	readonly mutationLocked: true;
	readonly provider?: {
		readonly provider?: string;
		readonly label?: string;
		readonly model?: string;
		readonly ready: boolean;
		readonly local?: boolean;
		readonly openAiCompatible?: boolean;
		readonly apiKeyConfigured: boolean;
		readonly apiKeyStorage?: string;
	};
	readonly backend?: {
		readonly selectedTransport?: string;
		readonly framing?: string;
		readonly launchReady: boolean;
		readonly connected: boolean;
		readonly bridgeState?: string;
	};
	readonly protocol?: {
		readonly available: boolean;
		readonly health?: string;
		readonly handshake?: string;
		readonly transportReady?: boolean;
		readonly handshakeReady?: boolean;
		readonly backendAccepted?: boolean;
		readonly errors?: number;
		readonly pendingRequests?: number;
	};
	readonly counts: {
		readonly gates: number;
		readonly passed: number;
		readonly pending: number;
		readonly failed: number;
		readonly missing: number;
		readonly blockers: number;
		readonly warnings: number;
	};
	readonly gates?: readonly VibeCodexRuntimeReadinessGate[];
	readonly blockers: readonly string[];
	readonly warnings: readonly string[];
	readonly nextAction: string;
	readonly guardrails: readonly string[];
	readonly promptBlock?: string;
	readonly message: string;
}

export interface VibeCodexRuntimeReadinessStatusInput {
	readonly providerStatus?: VibeCodexProviderStatusResponse;
	readonly backendLaunchStatus?: VibeCodexBackendLaunchStatusResponse;
	readonly protocolStatus?: VibeCodexProtocolStatusResponse;
}

const runtimeReadinessStatusMethods = new Set([
	'agent/getRuntimeReadinessStatus',
	'agent/runtimeReadinessStatus',
	'runtime/readinessStatus',
	'runtime/status',
	'startup/status',
	'vibecodex/runtimeReadinessStatus',
]);

const runtimeReadinessStatusToolNames = new Set([
	'runtime_readiness_status',
	'runtime_status',
	'agent_runtime_status',
	'codex_runtime_status',
	'startup_status',
]);

export function normalizeRuntimeReadinessStatusRequest(message: JsonRpcMessage): VibeCodexRuntimeReadinessStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!runtimeReadinessStatusMethods.has(message.method) && !isRuntimeReadinessStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeGates: booleanValue(payload.includeGates)
			?? booleanValue(payload.include_gates)
			?? booleanValue(args.includeGates)
			?? booleanValue(args.include_gates)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createRuntimeReadinessStatusResponse(request: VibeCodexRuntimeReadinessStatusRequest, input: VibeCodexRuntimeReadinessStatusInput): VibeCodexRuntimeReadinessStatusResponse {
	const gates = runtimeGates(input);
	const blockers = runtimeBlockers(input, gates);
	const warnings = runtimeWarnings(input);
	const route = runtimeRoute(input, gates);
	const ready = route === 'ready_for_plan';
	const counts = countGates(gates, blockers, warnings);
	const responseWithoutPromptBlock = {
		ok: true,
		source: 'externalExtension' as const,
		version: 1 as const,
		method: request.method,
		generatedAt: Date.now(),
		ready,
		route,
		mutationLocked: true as const,
		...(input.providerStatus ? { provider: providerSnapshot(input.providerStatus) } : {}),
		...(input.backendLaunchStatus ? { backend: backendSnapshot(input.backendLaunchStatus) } : {}),
		...(input.protocolStatus ? { protocol: protocolSnapshot(input.protocolStatus) } : {}),
		counts,
		...(request.includeGates ? { gates } : {}),
		blockers,
		warnings,
		nextAction: nextActionFor(route, blockers),
		guardrails: runtimeReadinessGuardrails,
	};
	return {
		...responseWithoutPromptBlock,
		...(request.includePromptBlock ? { promptBlock: runtimeReadinessPromptBlock(responseWithoutPromptBlock) } : {}),
		message: runtimeReadinessSummary(responseWithoutPromptBlock),
	};
}

export function runtimeReadinessSummary(response: Pick<VibeCodexRuntimeReadinessStatusResponse, 'ready' | 'route' | 'counts'>): string {
	return response.ready
		? `Runtime readiness: ready for visual planning with ${response.counts.passed}/${response.counts.gates} gates passed.`
		: `Runtime readiness: route=${response.route}; ${response.counts.passed}/${response.counts.gates} gates passed, ${response.counts.blockers} blocker${response.counts.blockers === 1 ? '' : 's'}.`;
}

const runtimeReadinessGuardrails = [
	'Runtime readiness is read-only and never changes provider settings, reads raw credentials, starts processes, opens sockets, sends JSON-RPC requests, approves plans, executes tools, accepts diffs, or mutates files.',
	'Ready for plan means provider/model routing, launch configuration, bridge connection, transport health, and backend handshake are ready to start or continue Plan Mode; it never unlocks file, terminal, browser, MCP, or diff mutation.',
	'Execution still requires agent/submitPlan, exact user approval of the rendered planHash, mode policy, tool approval, workspace sandbox, and checkpoint gates.',
	'Returned provider, backend, protocol, blocker, warning, and prompt data are redacted before being returned to the backend or rendered in the sidebar.',
];

function runtimeGates(input: VibeCodexRuntimeReadinessStatusInput): readonly VibeCodexRuntimeReadinessGate[] {
	const provider = input.providerStatus;
	const backend = input.backendLaunchStatus;
	const protocol = input.protocolStatus;
	return [
		gate('provider-route', 'Provider and model route', provider ? provider.ready ? 'passed' : 'failed' : 'missing', provider ? provider.blockers?.[0] ?? provider.message : 'Request provider_status before runtime readiness can be proven.'),
		gate('backend-launch', 'Backend launch route', backend ? backend.ready ? 'passed' : 'failed' : 'missing', backend ? backend.blockers[0] ?? backend.message : 'Request backend_launch_status before runtime readiness can be proven.'),
		gate('backend-connection', 'Backend bridge connection', backend ? backend.connected ? 'passed' : backend.ready ? 'pending' : 'failed' : 'missing', backend ? backend.connected ? 'Codex app-server bridge is connected.' : backend.nextAction : 'No backend launch status is available.'),
		gate('protocol-transport', 'Protocol transport health', protocol ? protocol.transportReadiness?.ready === false ? 'failed' : protocol.bridgeAvailable ? 'passed' : 'pending' : 'missing', protocol ? protocol.transportReadiness?.blockers[0] ?? protocol.message : 'Request protocol_status after connecting the bridge.'),
		gate('protocol-handshake', 'Backend handshake', protocol ? protocol.handshakeCapabilities.ready && protocol.handshakeCapabilities.backendAccepted ? 'passed' : 'failed' : 'missing', protocol ? protocol.handshakeCapabilities.backendAccepted ? protocol.message : `Backend handshake is ${protocol.health.handshake}.` : 'No protocol status is available.'),
		gate('protocol-health', 'Protocol health', protocol ? protocolHealthy(protocol) ? 'passed' : 'failed' : 'missing', protocol ? protocol.counts.error ? `Protocol has ${protocol.counts.error} recorded error${protocol.counts.error === 1 ? '' : 's'}.` : protocol.health.stale ? 'Protocol health is stale.' : protocol.message : 'No protocol health evidence is available.'),
	];
}

function runtimeBlockers(input: VibeCodexRuntimeReadinessStatusInput, gates: readonly VibeCodexRuntimeReadinessGate[]): readonly string[] {
	const blockers = [
		...gates.filter(item => item.status === 'failed' || item.status === 'missing').map(item => item.detail),
		...(input.providerStatus?.blockers ?? []),
		...(input.backendLaunchStatus?.blockers ?? []),
		...(input.protocolStatus?.transportReadiness?.blockers ?? []),
	].map(redactSensitiveText);
	return uniqueStrings(blockers).slice(0, 12);
}

function runtimeWarnings(input: VibeCodexRuntimeReadinessStatusInput): readonly string[] {
	const warnings = [
		...(input.providerStatus?.warnings ?? []),
		...(input.backendLaunchStatus?.warnings ?? []),
		input.protocolStatus && input.protocolStatus.counts.pendingRequests > 0 ? `${input.protocolStatus.counts.pendingRequests} JSON-RPC request${input.protocolStatus.counts.pendingRequests === 1 ? '' : 's'} still pending.` : undefined,
	].filter((item): item is string => !!item).map(redactSensitiveText);
	return uniqueStrings(warnings).slice(0, 12);
}

function runtimeRoute(input: VibeCodexRuntimeReadinessStatusInput, gates: readonly VibeCodexRuntimeReadinessGate[]): VibeCodexRuntimeReadinessRoute {
	const gateStatus = (id: string) => gates.find(gate => gate.id === id)?.status;
	if (!input.providerStatus) {
		return 'inspect_provider';
	}
	if (gateStatus('provider-route') !== 'passed') {
		return 'configure_provider';
	}
	if (!input.backendLaunchStatus) {
		return 'inspect_backend';
	}
	if (gateStatus('backend-launch') !== 'passed') {
		return 'configure_backend';
	}
	if (gateStatus('backend-connection') !== 'passed') {
		return 'connect_backend';
	}
	if (!input.protocolStatus) {
		return 'inspect_protocol';
	}
	if (gateStatus('protocol-transport') !== 'passed') {
		return 'repair_transport';
	}
	if (gateStatus('protocol-handshake') !== 'passed') {
		return 'repair_handshake';
	}
	if (gateStatus('protocol-health') !== 'passed') {
		return 'repair_protocol';
	}
	return 'ready_for_plan';
}

function nextActionFor(route: VibeCodexRuntimeReadinessRoute, blockers: readonly string[]): string {
	switch (route) {
		case 'inspect_provider':
			return 'Request provider_status so provider/model/base URL/credential readiness can be proven.';
		case 'configure_provider':
			return blockers[0] ?? 'Configure provider, model, base URL, or credentials.';
		case 'inspect_backend':
			return 'Request backend_launch_status so the selected Codex app-server route can be proven.';
		case 'configure_backend':
			return blockers[0] ?? 'Fix Codex app-server launch configuration.';
		case 'connect_backend':
			return 'Use Connect App Server to start or attach the configured bridge route.';
		case 'inspect_protocol':
			return 'Request protocol_status after the bridge connects so transport and handshake health can be proven.';
		case 'repair_transport':
			return blockers[0] ?? 'Repair selected JSON-RPC transport configuration.';
		case 'repair_handshake':
			return blockers[0] ?? 'Use a Vibecodex/Codex backend that accepts the advertised agent/initialize contract.';
		case 'repair_protocol':
			return blockers[0] ?? 'Repair stale or errored protocol health before planning.';
		case 'ready_for_plan':
			return 'Runtime is ready to start Plan Mode. Submit a structured visual plan and keep mutation locked until exact approval.';
	}
}

function providerSnapshot(status: VibeCodexProviderStatusResponse): NonNullable<VibeCodexRuntimeReadinessStatusResponse['provider']> {
	return {
		...(status.provider ? { provider: redactSensitiveText(status.provider) } : {}),
		...(status.label ? { label: redactSensitiveText(status.label) } : {}),
		...(status.model ? { model: redactSensitiveText(status.model) } : {}),
		ready: !!status.ready,
		...(status.readiness ? { local: status.readiness.local, openAiCompatible: status.readiness.openAiCompatible } : {}),
		apiKeyConfigured: status.apiKeyConfigured,
		...(status.apiKeyStorage ? { apiKeyStorage: status.apiKeyStorage } : {}),
	};
}

function backendSnapshot(status: VibeCodexBackendLaunchStatusResponse): NonNullable<VibeCodexRuntimeReadinessStatusResponse['backend']> {
	return {
		selectedTransport: status.selectedTransport,
		framing: status.framing,
		launchReady: status.ready,
		connected: status.connected,
		bridgeState: status.bridgeState,
	};
}

function protocolSnapshot(status: VibeCodexProtocolStatusResponse): NonNullable<VibeCodexRuntimeReadinessStatusResponse['protocol']> {
	return {
		available: status.bridgeAvailable,
		health: status.health.state,
		handshake: status.health.handshake,
		transportReady: status.transportReadiness?.ready,
		handshakeReady: status.handshakeCapabilities.ready,
		backendAccepted: status.handshakeCapabilities.backendAccepted,
		errors: status.counts.error,
		pendingRequests: status.counts.pendingRequests,
	};
}

function protocolHealthy(status: VibeCodexProtocolStatusResponse): boolean {
	return status.bridgeAvailable
		&& !status.health.stale
		&& status.health.state !== 'unknown'
		&& status.counts.error === 0;
}

function gate(id: string, title: string, status: VibeCodexRuntimeReadinessGateStatus, detail: string): VibeCodexRuntimeReadinessGate {
	return {
		id,
		title,
		status,
		detail: redactSensitiveText(detail),
	};
}

function countGates(gates: readonly VibeCodexRuntimeReadinessGate[], blockers: readonly string[], warnings: readonly string[]): VibeCodexRuntimeReadinessStatusResponse['counts'] {
	return {
		gates: gates.length,
		passed: gates.filter(gate => gate.status === 'passed').length,
		pending: gates.filter(gate => gate.status === 'pending').length,
		failed: gates.filter(gate => gate.status === 'failed').length,
		missing: gates.filter(gate => gate.status === 'missing').length,
		blockers: blockers.length,
		warnings: warnings.length,
	};
}

function runtimeReadinessPromptBlock(response: Omit<VibeCodexRuntimeReadinessStatusResponse, 'promptBlock' | 'message'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'runtime_readiness_status',
		ready: response.ready,
		route: response.route,
		mutationLocked: response.mutationLocked,
		provider: response.provider,
		backend: response.backend,
		protocol: response.protocol,
		counts: response.counts,
		gates: response.gates,
		blockers: response.blockers,
		warnings: response.warnings,
		nextAction: response.nextAction,
		guardrails: response.guardrails,
		note: 'Runtime readiness is startup/plan-readiness only. It never approves visual plans or unlocks mutating tools.',
	}), null, 2);
}

function isRuntimeReadinessStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return runtimeReadinessStatusToolNames.has(tool);
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

function uniqueStrings(values: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (trimmed && !seen.has(trimmed)) {
			seen.add(trimmed);
			result.push(trimmed);
		}
	}
	return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
