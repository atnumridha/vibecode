/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export interface VibeCodexWorkspaceGuidance {
	readonly version: 1;
	readonly collectedAt: number;
	readonly rules: readonly VibeCodexGuidanceDocument[];
	readonly skills: readonly VibeCodexSkillDocument[];
	readonly hooks: readonly VibeCodexHookManifest[];
}

export interface VibeCodexGuidanceDocument {
	readonly path: string;
	readonly kind: 'agent' | 'cline' | 'cursor' | 'codex' | 'copilot' | 'vibecodex' | 'generic';
	readonly text: string;
}

export interface VibeCodexSkillDocument {
	readonly path: string;
	readonly name: string;
	readonly description?: string;
	readonly text: string;
}

export interface VibeCodexHookManifest {
	readonly path: string;
	readonly kind: 'cline' | 'codex' | 'vibecodex' | 'generic';
	readonly entries: readonly string[];
	readonly text: string;
}

const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const maxRules = 18;
const maxSkills = 12;
const maxHooks = 8;
const maxDocumentBytes = 18000;

const rulePatterns = [
	'AGENTS.md',
	'CLAUDE.md',
	'.clinerules',
	'.cursorrules',
	'.github/copilot-instructions.md',
	'.cursor/rules/**/*',
	'.clinerules/**/*',
	'.codex/**/*.md',
	'.vibecodex/rules/**/*',
] as const;

const skillPatterns = [
	'.codex/skills/**/SKILL.md',
	'.vibecodex/skills/**/SKILL.md',
	'.cline/skills/**/SKILL.md',
] as const;

const hookPatterns = [
	'.cline/hooks.json',
	'.cline/hooks/*.json',
	'.codex/hooks.json',
	'.codex/hooks/*.json',
	'.vibecodex/hooks.json',
	'.vibecodex/hooks/*.json',
] as const;

export async function collectWorkspaceGuidance(): Promise<VibeCodexWorkspaceGuidance> {
	const [rules, skills, hooks] = await Promise.all([
		collectRules(),
		collectSkills(),
		collectHooks(),
	]);
	return {
		version: 1,
		collectedAt: Date.now(),
		rules,
		skills,
		hooks,
	};
}

export function workspaceGuidanceSummary(guidance: VibeCodexWorkspaceGuidance): string {
	return [
		`${guidance.rules.length} rule/instruction file${guidance.rules.length === 1 ? '' : 's'}.`,
		`${guidance.skills.length} skill document${guidance.skills.length === 1 ? '' : 's'}.`,
		`${guidance.hooks.length} hook manifest${guidance.hooks.length === 1 ? '' : 's'} indexed as read-only context.`,
	].join('\n');
}

export function workspaceGuidancePromptBlock(guidance: VibeCodexWorkspaceGuidance): string {
	return JSON.stringify(redactSensitiveValue({
		version: guidance.version,
		rules: guidance.rules.map(rule => ({ path: rule.path, kind: rule.kind, text: rule.text })),
		skills: guidance.skills.map(skill => ({ path: skill.path, name: skill.name, description: skill.description, text: skill.text })),
		hooks: guidance.hooks.map(hook => ({ path: hook.path, kind: hook.kind, entries: hook.entries, text: hook.text })),
		note: 'Hook manifests are context only. Do not execute hooks unless the backend requests explicit user approval.',
	}), null, 2);
}

async function collectRules(): Promise<readonly VibeCodexGuidanceDocument[]> {
	const documents: VibeCodexGuidanceDocument[] = [];
	for (const uri of await findUniqueFiles(rulePatterns, maxRules)) {
		const path = workspaceRelativePath(uri);
		const text = await readWorkspaceText(uri);
		if (!path || !text || isLikelyBinary(path)) {
			continue;
		}
		documents.push({
			path,
			kind: ruleKind(path),
			text,
		});
		if (documents.length >= maxRules) {
			break;
		}
	}
	return documents;
}

async function collectSkills(): Promise<readonly VibeCodexSkillDocument[]> {
	const documents: VibeCodexSkillDocument[] = [];
	for (const uri of await findUniqueFiles(skillPatterns, maxSkills)) {
		const path = workspaceRelativePath(uri);
		const text = await readWorkspaceText(uri);
		if (!path || !text) {
			continue;
		}
		documents.push({
			path,
			name: skillName(path, text),
			...(skillDescription(text) ? { description: skillDescription(text) } : {}),
			text,
		});
		if (documents.length >= maxSkills) {
			break;
		}
	}
	return documents;
}

async function collectHooks(): Promise<readonly VibeCodexHookManifest[]> {
	const manifests: VibeCodexHookManifest[] = [];
	for (const uri of await findUniqueFiles(hookPatterns, maxHooks)) {
		const path = workspaceRelativePath(uri);
		const text = await readWorkspaceText(uri);
		if (!path || !text) {
			continue;
		}
		manifests.push({
			path,
			kind: hookKind(path),
			entries: hookEntries(text),
			text,
		});
		if (manifests.length >= maxHooks) {
			break;
		}
	}
	return manifests;
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
		const bytes = await vscode.workspace.fs.readFile(uri);
		if (bytes.byteLength > maxDocumentBytes) {
			return redactSensitiveText(new TextDecoder('utf-8').decode(bytes.slice(0, maxDocumentBytes)) + '\n[truncated]');
		}
		return redactSensitiveText(new TextDecoder('utf-8').decode(bytes));
	} catch {
		return undefined;
	}
}

function ruleKind(path: string): VibeCodexGuidanceDocument['kind'] {
	const lower = path.toLowerCase();
	if (lower.endsWith('agents.md')) {
		return 'agent';
	}
	if (lower.includes('.clinerules')) {
		return 'cline';
	}
	if (lower.includes('.cursor/') || lower.endsWith('.cursorrules')) {
		return 'cursor';
	}
	if (lower.includes('.codex/')) {
		return 'codex';
	}
	if (lower.includes('.vibecodex/')) {
		return 'vibecodex';
	}
	if (lower.includes('copilot-instructions')) {
		return 'copilot';
	}
	return 'generic';
}

function hookKind(path: string): VibeCodexHookManifest['kind'] {
	const lower = path.toLowerCase();
	if (lower.includes('.cline/')) {
		return 'cline';
	}
	if (lower.includes('.codex/')) {
		return 'codex';
	}
	if (lower.includes('.vibecodex/')) {
		return 'vibecodex';
	}
	return 'generic';
}

function hookEntries(text: string): readonly string[] {
	const parsed = parseJson(text);
	if (Array.isArray(parsed)) {
		return parsed.map(entryLabel).filter((value): value is string => !!value).slice(0, 20);
	}
	if (isRecord(parsed)) {
		return Object.entries(parsed).map(([key, value]) => {
			if (Array.isArray(value)) {
				return `${key}: ${value.length} item${value.length === 1 ? '' : 's'}`;
			}
			if (isRecord(value)) {
				return `${key}: ${Object.keys(value).join(', ')}`;
			}
			return key;
		}).slice(0, 20);
	}
	return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 12);
}

function entryLabel(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value;
	}
	if (!isRecord(value)) {
		return undefined;
	}
	for (const key of ['name', 'id', 'event', 'matcher', 'command']) {
		if (typeof value[key] === 'string') {
			return `${key}: ${value[key]}`;
		}
	}
	return Object.keys(value).slice(0, 4).join(', ');
}

function skillName(path: string, text: string): string {
	const frontmatterName = frontmatterValue(text, 'name');
	if (frontmatterName) {
		return frontmatterName;
	}
	const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
	if (heading) {
		return heading;
	}
	const parts = path.split('/').filter(Boolean);
	return parts.length > 1 ? parts[parts.length - 2] : path;
}

function skillDescription(text: string): string | undefined {
	return frontmatterValue(text, 'description') ?? text.match(/^##\s+Description\s*\n+([\s\S]*?)(?:\n##\s+|\n#\s+|$)/im)?.[1]?.trim().slice(0, 600);
}

function frontmatterValue(text: string, key: string): string | undefined {
	const match = text.match(new RegExp(`^---\\s*\\n([\\s\\S]*?)\\n---`, 'm'));
	if (!match) {
		return undefined;
	}
	for (const line of match[1].split(/\r?\n/)) {
		const separator = line.indexOf(':');
		if (separator < 0) {
			continue;
		}
		const name = line.slice(0, separator).trim();
		if (name === key) {
			return line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
		}
	}
	return undefined;
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
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

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isLikelyBinary(path: string): boolean {
	return /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|tgz|woff2?|ttf)$/i.test(path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
