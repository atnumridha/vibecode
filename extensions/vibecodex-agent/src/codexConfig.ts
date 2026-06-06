/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare function require(name: string): unknown;
declare const process: { readonly env: Record<string, string | undefined> };

const fs = require('fs') as { readonly existsSync: (path: string) => boolean; readonly readFileSync: (path: string, encoding: 'utf8') => string };
const os = require('os') as { readonly homedir: () => string };
const path = require('path') as { readonly join: (...parts: string[]) => string; readonly normalize: (value: string) => string };

export interface CodexModelProviderSummary {
	readonly id: string;
	readonly baseUrl?: string;
	readonly envKey?: string;
	readonly envKeyConfigured: boolean;
}

export interface CodexConfigSummary {
	readonly found: boolean;
	readonly configPath: string;
	readonly authJsonPresent: boolean;
	readonly defaultModel?: string;
	readonly modelProvider?: string;
	readonly approvalPolicy?: string;
	readonly sandboxMode?: string;
	readonly networkAccess?: boolean;
	readonly modelProviders: readonly CodexModelProviderSummary[];
	readonly mcpServers: readonly string[];
	readonly projectTrust?: string;
	readonly warnings: readonly string[];
}

export function readCodexConfigSummary(workspaceRoot?: string): CodexConfigSummary {
	const home = codexHome();
	const configPath = path.join(home, 'config.toml');
	const authJsonPresent = fs.existsSync(path.join(home, 'auth.json'));
	if (!fs.existsSync(configPath)) {
		return {
			found: false,
			configPath,
			authJsonPresent,
			modelProviders: [],
			mcpServers: [],
			warnings: ['Codex config.toml was not found.'],
		};
	}
	try {
		return parseCodexConfigToml(fs.readFileSync(configPath, 'utf8'), configPath, workspaceRoot, process.env, authJsonPresent);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			found: false,
			configPath,
			authJsonPresent,
			modelProviders: [],
			mcpServers: [],
			warnings: [`Could not read Codex config.toml: ${message}`],
		};
	}
}

export function parseCodexConfigToml(text: string, configPath = 'config.toml', workspaceRoot?: string, env: Record<string, string | undefined> = {}, authJsonPresent = false): CodexConfigSummary {
	const root: Record<string, string | boolean | number> = {};
	const providerRecords = new Map<string, Record<string, string | boolean | number>>();
	const mcpServers = new Set<string>();
	const projectTrust = new Map<string, string>();
	let section = '';
	for (const rawLine of text.split(/\r?\n/)) {
		const line = stripTomlComment(rawLine).trim();
		if (!line) {
			continue;
		}
		const sectionMatch = line.match(/^\[([^\]]+)\]$/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			const mcp = section.match(/^mcp_servers\.("?[^"]+"?)$/);
			if (mcp) {
				mcpServers.add(unquote(mcp[1]));
			}
			continue;
		}
		const assignment = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
		if (!assignment) {
			continue;
		}
		const key = assignment[1];
		const value = parseTomlScalar(assignment[2]);
		const provider = section.match(/^(?:model_providers|model_provider|providers)\.("?[^"]+"?)$/);
		if (provider) {
			const id = unquote(provider[1]);
			const record = providerRecords.get(id) ?? {};
			record[key] = value;
			providerRecords.set(id, record);
			continue;
		}
		const project = section.match(/^projects\.(".*"|'.*'|[^.]+)$/);
		if (project && key === 'trust_level' && typeof value === 'string') {
			projectTrust.set(unquote(project[1]), value);
			continue;
		}
		if (section === 'sandbox_workspace_write' && key === 'network_access' && typeof value === 'boolean') {
			root.network_access = value;
			continue;
		}
		if (!section) {
			root[key] = value;
		}
	}
	return {
		found: true,
		configPath,
		authJsonPresent,
		...(stringValue(root.model) ? { defaultModel: stringValue(root.model) } : {}),
		...(stringValue(root.model_provider) ? { modelProvider: stringValue(root.model_provider) } : {}),
		...(stringValue(root.approval_policy) ? { approvalPolicy: stringValue(root.approval_policy) } : {}),
		...(stringValue(root.sandbox_mode) ? { sandboxMode: stringValue(root.sandbox_mode) } : {}),
		...(typeof root.network_access === 'boolean' ? { networkAccess: root.network_access } : {}),
		modelProviders: [...providerRecords.entries()].map(([id, record]) => providerSummary(id, record, env)),
		mcpServers: [...mcpServers].sort(),
		...(workspaceRoot ? { projectTrust: trustForWorkspace(workspaceRoot, projectTrust) } : {}),
		warnings: [],
	};
}

export function codexProviderBaseUrl(providerId: string, summary: CodexConfigSummary): string | undefined {
	const provider = findProvider(providerId, summary);
	return provider?.baseUrl;
}

export function codexProviderApiKeyConfigured(providerId: string, summary: CodexConfigSummary): boolean {
	const provider = findProvider(providerId, summary);
	return !!provider?.envKeyConfigured;
}

export function codexConfigPromptBlock(summary: CodexConfigSummary): string {
	return JSON.stringify({
		found: summary.found,
		configPath: summary.configPath,
		authJsonPresent: summary.authJsonPresent,
		defaultModel: summary.defaultModel,
		modelProvider: summary.modelProvider,
		approvalPolicy: summary.approvalPolicy,
		sandboxMode: summary.sandboxMode,
		networkAccess: summary.networkAccess,
		modelProviders: summary.modelProviders.map(provider => ({
			id: provider.id,
			baseUrl: provider.baseUrl,
			envKey: provider.envKey,
			envKeyConfigured: provider.envKeyConfigured,
		})),
		mcpServers: summary.mcpServers,
		projectTrust: summary.projectTrust,
		warnings: summary.warnings,
	}, null, 2);
}

function providerSummary(id: string, record: Record<string, string | boolean | number>, env: Record<string, string | undefined>): CodexModelProviderSummary {
	const envKey = stringValue(record.env_key)
		?? stringValue(record.api_key_env_var)
		?? stringValue(record.api_key_env)
		?? stringValue(record.key_env_var);
	const baseUrl = stringValue(record.base_url)
		?? stringValue(record.baseURL)
		?? stringValue(record.url);
	return {
		id,
		...(baseUrl ? { baseUrl } : {}),
		...(envKey ? { envKey } : {}),
		envKeyConfigured: !!envKey && !!env[envKey],
	};
}

function findProvider(providerId: string, summary: CodexConfigSummary): CodexModelProviderSummary | undefined {
	return summary.modelProviders.find(provider => provider.id === providerId)
		?? (providerId === 'openai' ? summary.modelProviders.find(provider => provider.id === 'openai-chat-completions') : undefined)
		?? (summary.modelProvider ? summary.modelProviders.find(provider => provider.id === summary.modelProvider) : undefined);
}

function trustForWorkspace(workspaceRoot: string, trustMap: Map<string, string>): string | undefined {
	const normalizedWorkspace = normalizePath(workspaceRoot);
	let best: { readonly path: string; readonly trust: string } | undefined;
	for (const [projectPath, trust] of trustMap) {
		const normalizedProject = normalizePath(projectPath);
		if (normalizedWorkspace === normalizedProject || normalizedWorkspace.startsWith(`${normalizedProject}/`)) {
			if (!best || normalizedProject.length > best.path.length) {
				best = { path: normalizedProject, trust };
			}
		}
	}
	return best?.trust;
}

function codexHome(): string {
	return process.env.CODEX_HOME?.trim() || path.join(os.homedir(), '.codex');
}

function stripTomlComment(line: string): string {
	let quote: '"' | '\'' | undefined;
	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		if ((char === '"' || char === '\'') && line[index - 1] !== '\\') {
			quote = quote === char ? undefined : quote ?? char;
		}
		if (char === '#' && !quote) {
			return line.slice(0, index);
		}
	}
	return line;
}

function parseTomlScalar(raw: string): string | boolean | number {
	const value = raw.trim();
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	if (/^-?[0-9]+(?:\.[0-9]+)?$/.test(value)) {
		return Number(value);
	}
	return unquote(value);
}

function unquote(value: string): string {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
		return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, '\'');
	}
	return trimmed;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function normalizePath(value: string): string {
	return path.normalize(value).replace(/\\/g, '/').replace(/\/+$/, '');
}
