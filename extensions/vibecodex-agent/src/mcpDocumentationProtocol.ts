/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexMcpCatalog } from './mcpCatalog';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexMcpDocumentationRequest {
	readonly id?: JsonRpcId;
	readonly method: string;
	readonly requestedAt: number;
}

const mcpDocumentationMethods = new Set([
	'agent/loadMcpDocumentation',
	'agent/mcp/documentation',
	'mcp/documentation',
	'cline/load_mcp_documentation',
	'load_mcp_documentation',
]);

export function normalizeMcpDocumentationRequest(message: JsonRpcMessage): VibeCodexMcpDocumentationRequest | undefined {
	if (!message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!mcpDocumentationMethods.has(message.method) && !isMcpDocumentationToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		...(message.id !== undefined ? { id: message.id } : {}),
		method: message.method,
		requestedAt: Date.now(),
	};
}

export function createMcpDocumentationResponse(request: VibeCodexMcpDocumentationRequest, catalog: VibeCodexMcpCatalog | undefined): Record<string, unknown> {
	const effectiveCatalog = catalog ?? { version: 1, collectedAt: Date.now(), sources: [], servers: [] };
	const markdown = mcpDocumentationMarkdown(effectiveCatalog);
	return {
		ok: true,
		source: 'externalExtension',
		method: request.method,
		generatedAt: Date.now(),
		summary: mcpDocumentationCatalogSummary(effectiveCatalog),
		markdown,
		catalog: redactSensitiveValue(effectiveCatalog),
		promptBlock: mcpDocumentationPromptBlock(effectiveCatalog),
		note: 'MCP documentation is read-only context. MCP tool and resource calls still require explicit Vibe Codex approval.',
	};
}

export function mcpDocumentationRequestSummary(request: VibeCodexMcpDocumentationRequest, catalog: VibeCodexMcpCatalog | undefined): string {
	const count = catalog?.servers.length ?? 0;
	return `${request.method} requested read-only MCP documentation for ${count} indexed server${count === 1 ? '' : 's'}.`;
}

function mcpDocumentationMarkdown(catalog: VibeCodexMcpCatalog): string {
	const servers = catalog.servers.map(server => [
		`### ${server.name}`,
		'',
		`- Source: ${server.source}`,
		`- Transport: ${server.transport}`,
		`- Status: ${server.disabled ? 'disabled' : 'enabled'}`,
		server.command ? `- Command: \`${server.command}${server.args?.length ? ` ${server.args.join(' ')}` : ''}\`` : undefined,
		server.url ? `- URL: ${server.url}` : undefined,
		server.envKeys?.length ? `- Env keys: ${server.envKeys.join(', ')}` : undefined,
		server.headerKeys?.length ? `- Header keys: ${server.headerKeys.join(', ')}` : undefined,
		server.autoApprove?.length ? `- Workspace auto-approve hints: ${server.autoApprove.join(', ')} (still requires Vibe Codex UI approval)` : undefined,
	].filter((line): line is string => line !== undefined).join('\n')).join('\n\n');
	return redactSensitiveText([
		'# Vibe Codex MCP Documentation',
		'',
		mcpDocumentationCatalogSummary(catalog),
		'',
		'## How To Request MCP',
		'',
		'- Use `use_mcp_tool` for tools and include `server_name`, `tool_name`, and `arguments`.',
		'- Use `access_mcp_resource` for resources and include `server_name` and `uri`.',
		'- Vibe Codex shows each MCP request as an approval card before it is allowed.',
		'- Disabled workspace servers are blocked by the UI.',
		'- Server env/header values are never returned; only key names are shown.',
		'- MCP documentation is not a plan approval and does not unlock execution.',
		'',
		'## Indexed Servers',
		'',
		servers || 'No workspace MCP servers are currently indexed.',
	].join('\n'));
}

function mcpDocumentationCatalogSummary(catalog: VibeCodexMcpCatalog): string {
	if (!catalog.servers.length) {
		return 'No workspace MCP servers detected.';
	}
	const active = catalog.servers.filter(server => !server.disabled);
	const transports = catalog.servers.reduce((counts, server) => {
		counts[server.transport] = (counts[server.transport] ?? 0) + 1;
		return counts;
	}, {} as Record<string, number>);
	return [
		`${catalog.servers.length} MCP server${catalog.servers.length === 1 ? '' : 's'} detected (${active.length} enabled).`,
		`Transports: ${Object.entries(transports).map(([transport, count]) => `${transport}=${count}`).join(', ')}.`,
		`Sources: ${catalog.sources.join(', ') || 'none'}.`,
	].join('\n');
}

function mcpDocumentationPromptBlock(catalog: VibeCodexMcpCatalog): string {
	return JSON.stringify(redactSensitiveValue({
		version: catalog.version,
		sources: catalog.sources,
		servers: catalog.servers,
		note: 'This catalog is read-only context. MCP tool calls still require the normal backend approval and transport path.',
	}), null, 2);
}

function isMcpDocumentationToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return tool === 'load_mcp_documentation' || tool === 'mcp_documentation';
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
