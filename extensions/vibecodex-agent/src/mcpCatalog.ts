/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export interface VibeCodexMcpCatalog {
	readonly version: 1;
	readonly collectedAt: number;
	readonly sources: readonly string[];
	readonly servers: readonly VibeCodexMcpServer[];
}

export interface VibeCodexMcpServer {
	readonly name: string;
	readonly source: string;
	readonly transport: 'stdio' | 'http' | 'sse' | 'unknown';
	readonly disabled: boolean;
	readonly command?: string;
	readonly args?: readonly string[];
	readonly url?: string;
	readonly envKeys?: readonly string[];
	readonly headerKeys?: readonly string[];
	readonly autoApprove?: readonly string[];
	readonly timeoutMs?: number;
}

const mcpConfigPatterns = [
	'.cline/mcp.json',
	'.cursor/mcp.json',
	'.vscode/mcp.json',
	'.codex/mcp.json',
	'.vibecodex/mcp.json',
	'.mcp.json',
	'mcp.json',
] as const;

const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const maxConfigFiles = 8;
const maxServers = 32;

export async function collectMcpCatalog(): Promise<VibeCodexMcpCatalog> {
	const servers = new Map<string, VibeCodexMcpServer>();
	const sources: string[] = [];
	for (const uri of await findUniqueFiles(mcpConfigPatterns, maxConfigFiles)) {
		const path = workspaceRelativePath(uri);
		const parsed = parseJson(await readWorkspaceText(uri));
		if (!path || !parsed) {
			continue;
		}
		sources.push(path);
		for (const server of mcpServersFromConfig(path, parsed)) {
			const key = `${server.source}:${server.name}`;
			if (!servers.has(key) && servers.size < maxServers) {
				servers.set(key, server);
			}
		}
	}
	return {
		version: 1,
		collectedAt: Date.now(),
		sources,
		servers: [...servers.values()],
	};
}

export function mcpCatalogSummary(catalog: VibeCodexMcpCatalog): string {
	if (!catalog.servers.length) {
		return 'No workspace MCP servers detected.';
	}
	const active = catalog.servers.filter(server => !server.disabled);
	const transports = countBy(catalog.servers, server => server.transport);
	return [
		`${catalog.servers.length} MCP server${catalog.servers.length === 1 ? '' : 's'} detected (${active.length} enabled).`,
		`Transports: ${Object.entries(transports).map(([transport, count]) => `${transport}=${count}`).join(', ')}.`,
		`Sources: ${catalog.sources.join(', ') || 'none'}.`,
	].join('\n');
}

export function mcpCatalogPromptBlock(catalog: VibeCodexMcpCatalog): string {
	return JSON.stringify({
		version: catalog.version,
		sources: catalog.sources,
		servers: catalog.servers.map(server => ({
			name: server.name,
			source: server.source,
			transport: server.transport,
			disabled: server.disabled,
			command: server.command,
			args: server.args,
			url: server.url,
			envKeys: server.envKeys,
			headerKeys: server.headerKeys,
			autoApprove: server.autoApprove,
			timeoutMs: server.timeoutMs,
		})),
		note: 'This catalog is read-only context. MCP tool calls still require the normal backend approval and transport path.',
	}, null, 2);
}

function mcpServersFromConfig(source: string, config: Record<string, unknown>): readonly VibeCodexMcpServer[] {
	const container = isRecord(config.mcpServers) ? config.mcpServers
		: isRecord(config.servers) ? config.servers
			: looksLikeServerConfigMap(config) ? config
				: undefined;
	if (!container) {
		return [];
	}
	return Object.entries(container)
		.map(([name, value]) => isRecord(value) ? mcpServerFromValue(name, source, value) : undefined)
		.filter((server): server is VibeCodexMcpServer => !!server);
}

function mcpServerFromValue(name: string, source: string, value: Record<string, unknown>): VibeCodexMcpServer {
	const command = stringValue(value.command);
	const url = redactUrl(stringValue(value.url) ?? stringValue(value.serverUrl));
	const transport = transportFromConfig(value, command, url);
	const env = isRecord(value.env) ? value.env : undefined;
	const headers = isRecord(value.headers) ? value.headers : undefined;
	const args = arrayOfStrings(value.args);
	const autoApprove = arrayOfStrings(value.autoApprove ?? value.auto_approve);
	return {
		name,
		source,
		transport,
		disabled: Boolean(value.disabled),
		...(command ? { command } : {}),
		...(args.length ? { args } : {}),
		...(url ? { url } : {}),
		...(env ? { envKeys: Object.keys(env).sort() } : {}),
		...(headers ? { headerKeys: Object.keys(headers).sort() } : {}),
		...(autoApprove.length ? { autoApprove } : {}),
		...(typeof value.timeout === 'number' ? { timeoutMs: value.timeout } : {}),
		...(typeof value.timeoutMs === 'number' ? { timeoutMs: value.timeoutMs } : {}),
	};
}

function transportFromConfig(value: Record<string, unknown>, command: string | undefined, url: string | undefined): VibeCodexMcpServer['transport'] {
	const transport = stringValue(value.transport)?.toLowerCase();
	if (transport === 'stdio' || transport === 'sse') {
		return transport;
	}
	if (transport === 'http' || transport === 'streamable-http' || transport === 'streamable_http') {
		return 'http';
	}
	if (command) {
		return 'stdio';
	}
	if (url?.includes('/sse') || transport === 'server-sent-events') {
		return 'sse';
	}
	if (url) {
		return 'http';
	}
	return 'unknown';
}

async function findUniqueFiles(patterns: readonly string[], limit: number): Promise<readonly vscode.Uri[]> {
	const seen = new Set<string>();
	const files: vscode.Uri[] = [];
	for (const pattern of patterns) {
		for (const uri of await vscode.workspace.findFiles(pattern, workspaceExclude, limit)) {
			const key = uri.toString();
			if (!seen.has(key)) {
				seen.add(key);
				files.push(uri);
			}
		}
	}
	return sortUrisByPathDepth(files).slice(0, limit);
}

async function readWorkspaceText(uri: vscode.Uri): Promise<string | undefined> {
	try {
		return new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
	} catch {
		return undefined;
	}
}

function parseJson(text: string | undefined): Record<string, unknown> | undefined {
	if (!text) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(text);
		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function looksLikeServerConfigMap(value: Record<string, unknown>): boolean {
	return Object.values(value).some(item => isRecord(item) && (typeof item.command === 'string' || typeof item.url === 'string' || typeof item.serverUrl === 'string'));
}

function redactUrl(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	const noCredentials = value.replace(/^(https?:\/\/)([^/@]+)@/i, '$1[redacted]@');
	const [base, query] = noCredentials.split('?', 2);
	if (!query) {
		return noCredentials;
	}
	const redactedQuery = query.split('&').map(part => {
		const separator = part.indexOf('=');
		const key = separator >= 0 ? part.slice(0, separator) : part;
		return /token|key|secret|password|auth/i.test(key) ? `${key}=[redacted]` : part;
	}).join('&');
	return `${base}?${redactedQuery}`;
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	const folders = vscode.workspace.workspaceFolders ?? [];
	for (const folder of folders) {
		const root = normalizePath(folder.uri.fsPath);
		const candidate = normalizePath(uri.fsPath);
		if (candidate === root) {
			return '.';
		}
		if (candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			return candidate.slice((root.endsWith('/') ? root : `${root}/`).length) || '.';
		}
	}
	return undefined;
}

function sortUrisByPathDepth(uris: readonly vscode.Uri[]): readonly vscode.Uri[] {
	return [...uris].sort((first, second) => {
		const firstPath = workspaceRelativePath(first) ?? first.fsPath;
		const secondPath = workspaceRelativePath(second) ?? second.fsPath;
		return pathDepth(firstPath) - pathDepth(secondPath) || firstPath.localeCompare(secondPath);
	});
}

function pathDepth(value: string): number {
	return value.split('/').filter(Boolean).length;
}

function arrayOfStrings(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
	return values.reduce((counts, value) => {
		const label = key(value);
		counts[label] = (counts[label] ?? 0) + 1;
		return counts;
	}, {} as Record<string, number>);
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
