/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

declare const require: (module: string) => unknown;
declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export interface VibeCodexWorkspaceIgnorePolicy {
	readonly version: 1;
	readonly sources: readonly string[];
	readonly rules: readonly VibeCodexWorkspaceIgnoreRule[];
}

export interface VibeCodexWorkspaceIgnoreRule {
	readonly source: string;
	readonly pattern: string;
	readonly negated: boolean;
}

const ignoreFileNames = ['.vibecodexignore', '.clineignore', '.codexignore', '.cursorignore'] as const;
const maxIgnoreBytes = 100000;

export async function collectWorkspaceIgnorePolicy(): Promise<VibeCodexWorkspaceIgnorePolicy> {
	const vscodeModule = require('vscode') as typeof vscode;
	const rules: VibeCodexWorkspaceIgnoreRule[] = [];
	const sources: string[] = [];
	for (const folder of vscodeModule.workspace.workspaceFolders ?? []) {
		for (const fileName of ignoreFileNames) {
			const uri = vscodeModule.Uri.joinPath(folder.uri, fileName);
			const text = await readIgnoreFile(uri);
			if (text === undefined) {
				continue;
			}
			const source = vscodeModule.workspace.asRelativePath(uri, false);
			sources.push(source);
			rules.push(...parseWorkspaceIgnoreRules(text, source));
		}
	}
	return {
		version: 1,
		sources,
		rules,
	};
}

export function parseWorkspaceIgnoreRules(text: string, source = '.clineignore'): readonly VibeCodexWorkspaceIgnoreRule[] {
	const rules: VibeCodexWorkspaceIgnoreRule[] = [];
	for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
		const trimmed = rawLine.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const negated = trimmed.startsWith('!');
		const pattern = (negated ? trimmed.slice(1) : trimmed).trim().replace(/^\/+/, '');
		if (!pattern) {
			continue;
		}
		rules.push({ source, pattern, negated });
	}
	return rules;
}

export function ignoredByWorkspacePolicy(path: string, policy: VibeCodexWorkspaceIgnorePolicy | undefined): string | undefined {
	if (!policy?.rules.length) {
		return undefined;
	}
	const normalized = normalizeRelative(path);
	let ignored = false;
	let source: string | undefined;
	for (const rule of policy.rules) {
		if (!matchesIgnorePattern(normalized, rule.pattern)) {
			continue;
		}
		ignored = !rule.negated;
		source = `${rule.source}:${rule.negated ? '!' : ''}${rule.pattern}`;
	}
	return ignored ? source : undefined;
}

export function isWorkspacePathIgnored(path: string, policy: VibeCodexWorkspaceIgnorePolicy | undefined): boolean {
	return !!ignoredByWorkspacePolicy(path, policy);
}

export function workspaceIgnoreSummary(policy: VibeCodexWorkspaceIgnorePolicy | undefined): string | undefined {
	if (!policy?.rules.length) {
		return undefined;
	}
	return `${policy.rules.length} ignore rule${policy.rules.length === 1 ? '' : 's'} from ${policy.sources.join(', ')}`;
}

function matchesIgnorePattern(path: string, pattern: string): boolean {
	const normalizedPattern = normalizeRelative(pattern);
	if (!normalizedPattern) {
		return false;
	}
	const directoryPattern = pattern.endsWith('/');
	const body = directoryPattern ? normalizedPattern.replace(/\/+$/, '') : normalizedPattern;
	if (!/[?*]/.test(body)) {
		if (body.includes('/')) {
			return path === body || path.startsWith(`${body}/`);
		}
		return path.split('/').includes(body);
	}
	const anchored = pattern.startsWith('/') || body.includes('/');
	const expression = globExpression(body);
	const regex = anchored
		? new RegExp(`^${expression}${directoryPattern ? '(?:/.*)?' : '$'}`)
		: new RegExp(`(?:^|/)${expression}${directoryPattern ? '(?:/.*)?' : '(?:$|/)'}`);
	return regex.test(path);
}

function globExpression(pattern: string): string {
	let expression = '';
	for (let index = 0; index < pattern.length; index++) {
		const ch = pattern[index];
		const next = pattern[index + 1];
		if (ch === '*' && next === '*') {
			expression += '.*';
			index++;
			continue;
		}
		if (ch === '*') {
			expression += '[^/]*';
			continue;
		}
		if (ch === '?') {
			expression += '[^/]';
			continue;
		}
		expression += escapeRegExp(ch);
	}
	return expression;
}

async function readIgnoreFile(uri: vscode.Uri): Promise<string | undefined> {
	const vscodeModule = require('vscode') as typeof vscode;
	try {
		const bytes = await vscodeModule.workspace.fs.readFile(uri);
		if (bytes.byteLength > maxIgnoreBytes) {
			return undefined;
		}
		return new TextDecoder('utf-8').decode(bytes);
	} catch {
		return undefined;
	}
}

function normalizeRelative(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/+$/, '');
}

function escapeRegExp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
