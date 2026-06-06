/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexMcpCatalog } from './mcpCatalog';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexMcpActionKind = 'tool' | 'resource';
export type VibeCodexMcpDecision = 'accept' | 'decline';
export type VibeCodexMcpServerScope = 'workspace' | 'unknown_or_global' | 'unspecified';

export interface VibeCodexMcpActionRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: VibeCodexMcpActionKind;
	readonly title: string;
	readonly serverName?: string;
	readonly toolName?: string;
	readonly resourceUri?: string;
	readonly arguments?: unknown;
	readonly serverScope: VibeCodexMcpServerScope;
	readonly blockedReason?: string;
	readonly detail?: string;
	readonly risk: 'low' | 'medium' | 'high' | 'blocked';
	readonly blocked: boolean;
	readonly requestedAt: number;
}

const mcpRequestMethods = new Set([
	'agent/requestMcpApproval',
	'agent/requestMcpToolApproval',
	'agent/requestMcpResourceApproval',
	'agent/mcp/requestApproval',
	'mcp/requestApproval',
	'mcp/requestToolApproval',
	'mcp/requestResourceApproval',
	'mcp/callTool',
	'mcp/readResource',
]);

export function normalizeMcpActionRequest(message: JsonRpcMessage, catalog?: VibeCodexMcpCatalog): VibeCodexMcpActionRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const nested = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = stringValue(payload.toolName)
		?? stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(nested.toolName)
		?? stringValue(nested.tool);
	const resourceUri = stringValue(payload.resourceUri)
		?? stringValue(payload.uri)
		?? stringValue(payload.resource)
		?? stringValue(nested.resourceUri)
		?? stringValue(nested.uri);
	const isClineMcpTool = toolName === 'use_mcp_tool' || toolName === 'access_mcp_resource';
	if (!mcpRequestMethods.has(message.method) && !isClineMcpTool) {
		return undefined;
	}

	const kind: VibeCodexMcpActionKind = message.method.toLowerCase().includes('resource') || toolName === 'access_mcp_resource' || !!resourceUri && !toolName ? 'resource' : 'tool';
	const serverName = stringValue(payload.serverName)
		?? stringValue(payload.server_name)
		?? stringValue(payload.server)
		?? stringValue(nested.serverName)
		?? stringValue(nested.server_name)
		?? stringValue(nested.server);
	const resolvedToolName = kind === 'tool'
		? stringValue(payload.toolName)
			?? stringValue(payload.mcpToolName)
			?? stringValue(nested.toolName)
			?? stringValue(nested.tool_name)
			?? (toolName !== 'use_mcp_tool' && toolName !== 'access_mcp_resource' ? toolName : undefined)
		: undefined;
	const resolvedResourceUri = kind === 'resource'
		? resourceUri
		: undefined;
	const args = argumentPayload(payload, nested, kind);
	const server = serverName ? catalog?.servers.find(candidate => candidate.name === serverName) : undefined;
	const disabled = !!server?.disabled;
	const unknownServer = !!serverName && !!catalog && !server;
	const serverScope: VibeCodexMcpServerScope = server ? 'workspace' : serverName ? 'unknown_or_global' : 'unspecified';
	const blockedReason = disabled
		? 'workspace_server_disabled'
		: unknownServer
			? 'unknown_or_global_server'
			: undefined;
	const autoApprove = !!resolvedToolName && !!server?.autoApprove?.includes(resolvedToolName);
	const detail = [
		serverName ? `Server: ${serverName}` : undefined,
		`Server scope: ${serverScope}`,
		resolvedToolName ? `Tool: ${resolvedToolName}` : undefined,
		resolvedResourceUri ? `Resource: ${resolvedResourceUri}` : undefined,
		autoApprove ? 'Workspace MCP config lists this tool as auto-approve, but Vibe Codex still requires explicit UI approval.' : undefined,
		disabled ? 'Blocked because the workspace MCP server is disabled.' : undefined,
		unknownServer ? 'Blocked because this server was not found in the current workspace MCP catalog; backend may be using a global MCP registry and should expose that server through a workspace MCP config first.' : undefined,
		args !== undefined ? `Arguments:\n${safeJson(args)}` : undefined,
	].filter((line): line is string => !!line).join('\n');
	return {
		id: message.id,
		method: message.method,
		kind,
		title: kind === 'resource' ? 'MCP resource approval' : 'MCP tool approval',
		...(serverName ? { serverName } : {}),
		...(resolvedToolName ? { toolName: resolvedToolName } : {}),
		...(resolvedResourceUri ? { resourceUri: redactSensitiveText(resolvedResourceUri) } : {}),
		...(args !== undefined ? { arguments: redactSensitiveValue(args) } : {}),
		serverScope,
		...(blockedReason ? { blockedReason } : {}),
		...(detail ? { detail: redactSensitiveText(detail) } : {}),
		risk: blockedReason ? 'blocked' : kind === 'resource' ? 'medium' : 'high',
		blocked: !!blockedReason,
		requestedAt: Date.now(),
	};
}

export function createMcpActionResponse(request: VibeCodexMcpActionRequest, decision: VibeCodexMcpDecision): unknown {
	const approved = decision === 'accept' && !request.blocked;
	return {
		approved,
		decision: approved ? 'accept' : 'decline',
		source: 'externalExtension',
		kind: request.kind,
		serverName: request.serverName,
		serverScope: request.serverScope,
		blockedReason: request.blockedReason,
		toolName: request.toolName,
		resourceUri: request.resourceUri,
		message: approved
			? 'MCP request approved for the backend transport.'
			: request.blockedReason === 'unknown_or_global_server'
				? 'MCP request declined because the server is unknown to the workspace catalog. Add the server to a workspace MCP config or reconnect with an updated catalog.'
				: request.blockedReason === 'workspace_server_disabled'
					? 'MCP request declined because the workspace MCP server is disabled.'
					: 'MCP request declined.',
	};
}

function argumentPayload(payload: Record<string, unknown>, nested: Record<string, unknown>, kind: VibeCodexMcpActionKind): unknown {
	const direct = payload.arguments ?? payload.args ?? payload.input;
	const nestedArgs = nested.arguments ?? nested.args ?? nested.input;
	if (kind === 'tool' && nestedArgs !== undefined) {
		return nestedArgs;
	}
	if (kind === 'tool' && direct !== undefined && !isToolEnvelope(direct)) {
		return direct;
	}
	if (kind === 'resource') {
		return payload.params ?? nested.params;
	}
	return undefined;
}

function isToolEnvelope(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}
	return typeof value.serverName === 'string'
		|| typeof value.server_name === 'string'
		|| typeof value.toolName === 'string'
		|| typeof value.tool_name === 'string'
		|| typeof value.resourceUri === 'string'
		|| typeof value.uri === 'string';
}

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(redactSensitiveValue(value), null, 2).slice(0, 3000);
	} catch {
		return '[unserializable arguments]';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
