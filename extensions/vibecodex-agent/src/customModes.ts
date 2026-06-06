/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

declare function require(name: string): unknown;
declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export interface VibeCodexCustomModeCatalog {
	readonly version: 1;
	readonly collectedAt: number;
	readonly modes: readonly VibeCodexCustomMode[];
	readonly sources: readonly string[];
	readonly warnings: readonly string[];
}

export interface VibeCodexCustomMode {
	readonly slug: string;
	readonly name: string;
	readonly source: string;
	readonly roleDefinition: string;
	readonly whenToUse?: string;
	readonly customInstructions?: string;
	readonly groups: readonly string[];
	readonly readOnly: boolean;
	readonly requiresPlanApproval: boolean;
}

const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const customModePatterns = [
	'.roomodes',
	'.roomodes.json',
	'.roomodes.yaml',
	'.roomodes.yml',
	'.cline/modes.json',
	'.cline/modes.yaml',
	'.cline/modes.yml',
	'.vibecodex/modes.json',
	'.vibecodex/modes.yaml',
	'.vibecodex/modes.yml',
] as const;
const maxModeFiles = 12;
const maxModes = 40;
const maxModeFileBytes = 40000;
const mutatingGroups = new Set(['edit', 'command', 'terminal', 'browser', 'mcp', 'tools', 'write']);

export async function collectCustomModeCatalog(): Promise<VibeCodexCustomModeCatalog> {
	const sources: string[] = [];
	const warnings: string[] = [];
	const modes = new Map<string, VibeCodexCustomMode>();
	for (const uri of await findModeFiles()) {
		const source = workspaceRelativePath(uri);
		const text = await readWorkspaceText(uri);
		if (!source || !text) {
			continue;
		}
		sources.push(source);
		const parsed = parseCustomModesDocument(text, source);
		for (const warning of parsed.warnings) {
			warnings.push(warning);
		}
		for (const mode of parsed.modes) {
			// Project-local files are traversed in deterministic path order; the first slug wins.
			if (!modes.has(mode.slug)) {
				modes.set(mode.slug, mode);
			}
		}
		if (modes.size >= maxModes) {
			break;
		}
	}
	return {
		version: 1,
		collectedAt: Date.now(),
		modes: [...modes.values()].slice(0, maxModes),
		sources,
		warnings: warnings.slice(0, 20),
	};
}

export function parseCustomModesDocument(text: string, source = '.roomodes'): { readonly modes: readonly VibeCodexCustomMode[]; readonly warnings: readonly string[] } {
	const json = parseJsonModes(text, source);
	if (json.modes.length || json.warnings.length) {
		return json;
	}
	return parseYamlModes(text, source);
}

export function customModeCatalogSummary(catalog: VibeCodexCustomModeCatalog): string {
	const executable = catalog.modes.filter(mode => !mode.readOnly).length;
	return `${catalog.modes.length} custom mode${catalog.modes.length === 1 ? '' : 's'} indexed; ${executable} execution-capable after visual plan approval. ${catalog.sources.length} source file${catalog.sources.length === 1 ? '' : 's'}.`;
}

export function customModeCatalogPromptBlock(catalog: VibeCodexCustomModeCatalog): string {
	return JSON.stringify(redactSensitiveValue({
		version: catalog.version,
		sources: catalog.sources,
		modes: catalog.modes.map(mode => ({
			slug: mode.slug,
			name: mode.name,
			source: mode.source,
			roleDefinition: mode.roleDefinition,
			whenToUse: mode.whenToUse,
			customInstructions: mode.customInstructions,
			groups: mode.groups,
			readOnly: mode.readOnly,
			requiresPlanApproval: mode.requiresPlanApproval,
		})),
		warnings: catalog.warnings,
		note: 'Workspace custom modes are planning instructions only. Mutating groups still require the exact Vibe Codex visual plan revision to be approved before tools run.',
	}), null, 2);
}

function parseJsonModes(text: string, source: string): { readonly modes: readonly VibeCodexCustomMode[]; readonly warnings: readonly string[] } {
	const parsed = parseJson(text);
	if (parsed === undefined) {
		return { modes: [], warnings: [] };
	}
	const rawModes = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.customModes) ? parsed.customModes : isRecord(parsed) && Array.isArray(parsed.modes) ? parsed.modes : undefined;
	if (!rawModes) {
		return { modes: [], warnings: [`${source}: no customModes array found.`] };
	}
	return normalizeModes(rawModes, source);
}

function parseYamlModes(text: string, source: string): { readonly modes: readonly VibeCodexCustomMode[]; readonly warnings: readonly string[] } {
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	const start = lines.findIndex(line => /^\s*(customModes|modes)\s*:\s*$/.test(line));
	if (start < 0) {
		return { modes: [], warnings: [`${source}: could not parse custom mode YAML.`] };
	}
	const entries: Record<string, unknown>[] = [];
	let current: Record<string, unknown> | undefined;
	for (let index = start + 1; index < lines.length; index++) {
		const line = lines[index];
		const listStart = line.match(/^\s*-\s+([A-Za-z][\w-]*)\s*:\s*(.*)$/);
		if (listStart) {
			current = {};
			entries.push(current);
			assignYamlValue(current, listStart[1], listStart[2], lines, index);
			continue;
		}
		if (!current) {
			continue;
		}
		const property = line.match(/^\s{2,}([A-Za-z][\w-]*)\s*:\s*(.*)$/);
		if (property) {
			const consumed = assignYamlValue(current, property[1], property[2], lines, index);
			index += consumed;
		}
	}
	return normalizeModes(entries, source);
}

function assignYamlValue(target: Record<string, unknown>, key: string, rawValue: string, lines: readonly string[], index: number): number {
	const trimmed = rawValue.trim();
	if (trimmed === '|' || trimmed === '|-' || trimmed === '>' || trimmed === '>-') {
		const block: string[] = [];
		for (let cursor = index + 1; cursor < lines.length; cursor++) {
			const candidate = lines[cursor];
			if (/^\s*-\s+[A-Za-z][\w-]*\s*:/.test(candidate) || /^\s{2,}[A-Za-z][\w-]*\s*:/.test(candidate)) {
				break;
			}
			block.push(candidate.replace(/^\s{4}/, ''));
		}
		target[key] = block.join('\n').trim();
		return block.length;
	}
	target[key] = parseInlineYamlValue(trimmed);
	return 0;
}

function parseInlineYamlValue(value: string): unknown {
	if (!value) {
		return '';
	}
	if (value.startsWith('[') && value.endsWith(']')) {
		return value.slice(1, -1).split(',').map(item => stripQuotes(item.trim())).filter(Boolean);
	}
	return stripQuotes(value);
}

function normalizeModes(rawModes: readonly unknown[], source: string): { readonly modes: readonly VibeCodexCustomMode[]; readonly warnings: readonly string[] } {
	const modes: VibeCodexCustomMode[] = [];
	const warnings: string[] = [];
	for (const rawMode of rawModes) {
		if (!isRecord(rawMode)) {
			continue;
		}
		const slug = slugify(stringValue(rawMode.slug) ?? stringValue(rawMode.id) ?? stringValue(rawMode.name));
		if (!slug) {
			warnings.push(`${source}: skipped custom mode without slug or name.`);
			continue;
		}
		const groups = normalizeGroups(rawMode.groups);
		const readOnly = !groups.some(group => mutatingGroups.has(group));
		modes.push({
			slug,
			name: stringValue(rawMode.name) ?? titleFromSlug(slug),
			source,
			roleDefinition: capText(redactSensitiveText(stringValue(rawMode.roleDefinition) ?? stringValue(rawMode.role) ?? stringValue(rawMode.description) ?? 'Follow this workspace custom mode while preserving Vibe Codex visual planning and approval gates.')),
			...(stringValue(rawMode.whenToUse) ? { whenToUse: capText(redactSensitiveText(stringValue(rawMode.whenToUse)!)) } : {}),
			...(stringValue(rawMode.customInstructions) ? { customInstructions: capText(redactSensitiveText(stringValue(rawMode.customInstructions)!)) } : {}),
			groups,
			readOnly,
			requiresPlanApproval: !readOnly,
		});
	}
	return { modes, warnings };
}

function normalizeGroups(value: unknown): readonly string[] {
	const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
	const groups = raw.map(item => Array.isArray(item) ? item[0] : item).filter((item): item is string => typeof item === 'string').map(item => slugify(item)).filter((item): item is string => !!item);
	return groups.length ? [...new Set(groups)] : ['read'];
}

async function findModeFiles(): Promise<readonly vscode.Uri[]> {
	const vscode = vscodeApi();
	const seen = new Set<string>();
	const files: vscode.Uri[] = [];
	for (const pattern of customModePatterns) {
		for (const uri of await vscode.workspace.findFiles(pattern, workspaceExclude, maxModeFiles)) {
			const key = uri.toString();
			if (!seen.has(key)) {
				seen.add(key);
				files.push(uri);
			}
		}
	}
	return files.sort((a, b) => workspaceRelativePath(a).localeCompare(workspaceRelativePath(b))).slice(0, maxModeFiles);
}

async function readWorkspaceText(uri: vscode.Uri): Promise<string | undefined> {
	const vscode = vscodeApi();
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		const suffix = bytes.byteLength > maxModeFileBytes ? '\n[truncated]' : '';
		const slice = bytes.byteLength > maxModeFileBytes ? bytes.slice(0, maxModeFileBytes) : bytes;
		return redactSensitiveText(new TextDecoder('utf-8').decode(slice) + suffix);
	} catch {
		return undefined;
	}
}

function workspaceRelativePath(uri: vscode.Uri): string {
	const vscode = vscodeApi();
	const folder = vscode.workspace.getWorkspaceFolder(uri);
	return folder ? uri.path.slice(folder.uri.path.length).replace(/^\/+/, '') : uri.path.replace(/^\/+/, '');
}

function vscodeApi(): typeof import('vscode') {
	return require('vscode') as typeof import('vscode');
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stripQuotes(value: string): string {
	return value.replace(/^['"]|['"]$/g, '');
}

function slugify(value: unknown): string | undefined {
	const slug = typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') : '';
	return slug || undefined;
}

function titleFromSlug(slug: string): string {
	return slug.split(/[-_]+/).map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
}

function capText(value: string): string {
	return value.length <= 4000 ? value : `${value.slice(0, 3988)}\n[truncated]`;
}
