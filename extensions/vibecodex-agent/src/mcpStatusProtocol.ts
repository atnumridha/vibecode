/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexMcpCatalog, VibeCodexMcpServer } from './mcpCatalog';
import { redactSensitiveText } from './secretFilters';

export interface VibeCodexMcpStatusRequest {
	readonly id?: JsonRpcId;
	readonly method: string;
	readonly includeServers: boolean;
	readonly includeTools: boolean;
	readonly serverName?: string;
	readonly requestedAt: number;
}

export interface VibeCodexMcpStatusServer {
	readonly name: string;
	readonly source: string;
	readonly transport: VibeCodexMcpServer['transport'];
	readonly disabled: boolean;
	readonly command?: string;
	readonly args?: readonly string[];
	readonly url?: string;
	readonly envKeys?: readonly string[];
	readonly headerKeys?: readonly string[];
	readonly autoApprove?: readonly string[];
	readonly timeoutMs?: number;
}

export interface VibeCodexMcpStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly method: string;
	readonly available: boolean;
	readonly generatedAt: number;
	readonly catalogCollectedAt?: number;
	readonly sources: readonly string[];
	readonly requestedServer?: {
		readonly name: string;
		readonly found: boolean;
		readonly scope: 'workspace' | 'unknown_or_global';
		readonly disabled?: boolean;
		readonly guidance: string;
	};
	readonly counts: {
		readonly servers: number;
		readonly returnedServers: number;
		readonly requestedUnknownServers: number;
		readonly enabled: number;
		readonly disabled: number;
		readonly commandTransports: number;
		readonly urlTransports: number;
		readonly envKeys: number;
		readonly headerKeys: number;
		readonly autoApproveHints: number;
		readonly pendingActions: number;
	};
	readonly transports: Record<VibeCodexMcpServer['transport'], number>;
	readonly enabledServers: readonly string[];
	readonly disabledServers: readonly string[];
	readonly servers: readonly VibeCodexMcpStatusServer[];
	readonly approval: {
		readonly requiredForToolCalls: true;
		readonly hasExecutionAuthorization: boolean;
		readonly pendingActions: number;
	};
	readonly guardrails: readonly string[];
	readonly message: string;
	readonly promptBlock: string;
}

const mcpStatusMethods = new Set([
	'agent/getMcpStatus',
	'agent/mcpStatus',
	'mcp/status',
	'mcp/serverStatus',
	'mcp/catalogStatus',
	'vibecodex/mcpStatus',
]);

const mcpStatusToolNames = new Set([
	'mcp_status',
	'get_mcp_status',
	'mcp_server_status',
	'mcp_catalog_status',
	'mcp_servers_status',
]);

const maxReturnedServers = 32;

export function normalizeMcpStatusRequest(message: JsonRpcMessage): VibeCodexMcpStatusRequest | undefined {
	if (!message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!mcpStatusMethods.has(message.method) && !isMcpStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const serverName = stringValue(payload.serverName)
		?? stringValue(payload.server_name)
		?? stringValue(args.serverName)
		?? stringValue(args.server_name)
		?? stringValue(payload.server)
		?? stringValue(args.server);
	return {
		...(message.id !== undefined ? { id: message.id } : {}),
		method: message.method,
		includeServers: booleanValue(payload.includeServers)
			?? booleanValue(payload.include_servers)
			?? booleanValue(args.includeServers)
			?? booleanValue(args.include_servers)
			?? true,
		includeTools: booleanValue(payload.includeTools)
			?? booleanValue(payload.include_tools)
			?? booleanValue(args.includeTools)
			?? booleanValue(args.include_tools)
			?? false,
		...(serverName ? { serverName: redactSensitiveText(serverName) } : {}),
		requestedAt: Date.now(),
	};
}

export function createMcpStatusResponse(request: VibeCodexMcpStatusRequest, input: {
	readonly catalog?: VibeCodexMcpCatalog;
	readonly pendingActions?: number;
	readonly hasExecutionAuthorization?: boolean;
}): VibeCodexMcpStatusResponse {
	const catalog = input.catalog;
	const allServers = catalog?.servers ?? [];
	const matchingServers = request.serverName
		? allServers.filter(server => server.name === request.serverName)
		: allServers;
	const requestedServer = request.serverName ? createRequestedServerStatus(request.serverName, matchingServers[0], !!catalog) : undefined;
	const returnedServers = request.includeServers ? matchingServers.slice(0, maxReturnedServers).map(server => sanitizeServer(server, request.includeTools)) : [];
	const enabledServers = matchingServers.filter(server => !server.disabled).map(server => redactSensitiveText(server.name));
	const disabledServers = matchingServers.filter(server => server.disabled).map(server => redactSensitiveText(server.name));
	const responseWithoutMessage = {
		ok: true,
		source: 'externalExtension' as const,
		method: request.method,
		available: !!catalog,
		generatedAt: Date.now(),
		...(catalog ? { catalogCollectedAt: catalog.collectedAt } : {}),
		sources: (catalog?.sources ?? []).map(source => redactSensitiveText(source)),
		...(requestedServer ? { requestedServer } : {}),
		counts: {
			servers: matchingServers.length,
			returnedServers: returnedServers.length,
			requestedUnknownServers: requestedServer && !requestedServer.found ? 1 : 0,
			enabled: enabledServers.length,
			disabled: disabledServers.length,
			commandTransports: matchingServers.filter(server => !!server.command).length,
			urlTransports: matchingServers.filter(server => !!server.url).length,
			envKeys: matchingServers.reduce((count, server) => count + (server.envKeys?.length ?? 0), 0),
			headerKeys: matchingServers.reduce((count, server) => count + (server.headerKeys?.length ?? 0), 0),
			autoApproveHints: matchingServers.reduce((count, server) => count + (server.autoApprove?.length ?? 0), 0),
			pendingActions: input.pendingActions ?? 0,
		},
		transports: countTransports(matchingServers),
		enabledServers,
		disabledServers,
		servers: returnedServers,
		approval: {
			requiredForToolCalls: true as const,
			hasExecutionAuthorization: !!input.hasExecutionAuthorization,
			pendingActions: input.pendingActions ?? 0,
		},
		guardrails: [
			'Read-only MCP status never calls MCP tools/resources, starts MCP servers, edits MCP config, or approves requests.',
			'Disabled workspace MCP servers remain blocked even when a backend requests them.',
			'Workspace auto-approve hints do not bypass Vibe Codex UI approval or exact visual-plan authorization.',
			'Unknown/global MCP servers are reported explicitly and remain blocked until represented in a workspace MCP config.',
			'Env/header values and sensitive command, argument, URL, and server text are redacted before returning status.',
		],
	};
	const response = {
		...responseWithoutMessage,
		message: mcpStatusSummary(responseWithoutMessage),
		promptBlock: mcpStatusPromptBlock(responseWithoutMessage),
	};
	return response;
}

export function mcpStatusSummary(response: Pick<VibeCodexMcpStatusResponse, 'available' | 'counts' | 'approval' | 'sources'>): string {
	if (!response.available) {
		return 'MCP status unavailable: no workspace MCP catalog has been collected yet.';
	}
	const serverWord = response.counts.servers === 1 ? 'server' : 'servers';
	const pending = response.approval.pendingActions ? ` ${response.approval.pendingActions} pending MCP approval${response.approval.pendingActions === 1 ? '' : 's'}.` : '';
	return `${response.counts.servers} MCP ${serverWord}: ${response.counts.enabled} enabled, ${response.counts.disabled} disabled. ${response.counts.returnedServers} returned from ${response.sources.length || 0} source${response.sources.length === 1 ? '' : 's'}.${pending}`;
}

function mcpStatusPromptBlock(response: Omit<VibeCodexMcpStatusResponse, 'message' | 'promptBlock'>): string {
	return JSON.stringify({
		available: response.available,
		sources: response.sources,
		requestedServer: response.requestedServer,
		counts: response.counts,
		transports: response.transports,
		enabledServers: response.enabledServers,
		disabledServers: response.disabledServers,
		servers: response.servers,
		approval: response.approval,
		guardrails: response.guardrails,
		note: 'MCP status is read-only planning context. Backend must still request use_mcp_tool/access_mcp_resource through explicit Vibe Codex approval.',
	}, null, 2);
}

function createRequestedServerStatus(name: string, server: VibeCodexMcpServer | undefined, catalogAvailable: boolean): VibeCodexMcpStatusResponse['requestedServer'] {
	const redactedName = redactSensitiveText(name);
	if (server) {
		return {
			name: redactedName,
			found: true,
			scope: 'workspace',
			disabled: server.disabled,
			guidance: server.disabled
				? 'Requested MCP server is present in workspace config but disabled; tool/resource requests remain blocked.'
				: 'Requested MCP server is present in the workspace catalog and still requires explicit approval before tool/resource use.',
		};
	}
	return {
		name: redactedName,
		found: false,
		scope: 'unknown_or_global',
		guidance: catalogAvailable
			? 'Requested MCP server is not in the workspace catalog. If this is a global Cline/Cursor MCP server, mirror it into a workspace MCP config before requesting tools.'
			: 'No workspace MCP catalog has been collected yet; reconnect or add a workspace MCP config before requesting tools.',
	};
}

function sanitizeServer(server: VibeCodexMcpServer, includeTools: boolean): VibeCodexMcpStatusServer {
	return {
		name: redactSensitiveText(server.name),
		source: redactSensitiveText(server.source),
		transport: server.transport,
		disabled: server.disabled,
		...(server.command ? { command: redactSensitiveText(server.command) } : {}),
		...(server.args?.length ? { args: server.args.map(arg => redactSensitiveText(arg)) } : {}),
		...(server.url ? { url: redactSensitiveText(server.url) } : {}),
		...(server.envKeys?.length ? { envKeys: server.envKeys.map(key => redactSensitiveText(key)).sort() } : {}),
		...(server.headerKeys?.length ? { headerKeys: server.headerKeys.map(key => redactSensitiveText(key)).sort() } : {}),
		...(includeTools && server.autoApprove?.length ? { autoApprove: server.autoApprove.map(tool => redactSensitiveText(tool)).sort() } : {}),
		...(typeof server.timeoutMs === 'number' ? { timeoutMs: server.timeoutMs } : {}),
	};
}

function countTransports(servers: readonly VibeCodexMcpServer[]): Record<VibeCodexMcpServer['transport'], number> {
	return servers.reduce((counts, server) => {
		counts[server.transport] = (counts[server.transport] ?? 0) + 1;
		return counts;
	}, { stdio: 0, http: 0, sse: 0, unknown: 0 });
}

function isMcpStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name);
	return !!tool && mcpStatusToolNames.has(tool);
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
	return typeof value === 'boolean' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
