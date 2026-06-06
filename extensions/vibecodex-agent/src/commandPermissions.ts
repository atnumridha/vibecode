/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveValue } from './secretFilters';

export interface VibeCodexCommandPermissionPolicy {
	readonly version: 1;
	readonly defaultAllow: boolean;
	readonly allow: readonly string[];
	readonly deny: readonly string[];
	readonly sources: readonly string[];
}

export interface VibeCodexCommandPermissionDecision {
	readonly allowed: boolean;
	readonly blocked: boolean;
	readonly reason: string;
	readonly matchedRule?: string;
}

export interface VibeCodexCommandPermissionInput {
	readonly allow?: readonly string[];
	readonly deny?: readonly string[];
	readonly defaultAllow?: boolean;
	readonly clineCommandPermissions?: string;
}

export function normalizeCommandPermissionPolicy(input: VibeCodexCommandPermissionInput = {}): VibeCodexCommandPermissionPolicy {
	const fromCline = parseClineCommandPermissions(input.clineCommandPermissions);
	const allow = uniquePatterns([...(input.allow ?? []), ...fromCline.allow]);
	const deny = uniquePatterns([...(input.deny ?? []), ...fromCline.deny]);
	return {
		version: 1,
		defaultAllow: input.defaultAllow ?? (allow.length === 0),
		allow,
		deny,
		sources: [
			input.allow?.length || input.deny?.length ? 'vibeCodex.extension.commandPermissions' : undefined,
			input.clineCommandPermissions ? 'CLINE_COMMAND_PERMISSIONS' : undefined,
		].filter((value): value is string => !!value),
	};
}

export function evaluateCommandPermission(commandLine: string, policy: VibeCodexCommandPermissionPolicy = normalizeCommandPermissionPolicy()): VibeCodexCommandPermissionDecision {
	const normalizedCommand = normalizeCommandLine(commandLine);
	if (!normalizedCommand) {
		return { allowed: false, blocked: true, reason: 'Empty terminal command is blocked.' };
	}
	if (isDangerousCommand(normalizedCommand)) {
		return { allowed: false, blocked: true, reason: 'Command blocked by built-in dangerous command policy.' };
	}
	const denied = policy.deny.find(pattern => matchesCommandPattern(normalizedCommand, pattern));
	if (denied) {
		return { allowed: false, blocked: true, reason: `Command blocked by deny rule: ${denied}`, matchedRule: denied };
	}
	const allowed = policy.allow.find(pattern => matchesCommandPattern(normalizedCommand, pattern));
	if (allowed) {
		return { allowed: true, blocked: false, reason: `Command allowed by rule: ${allowed}`, matchedRule: allowed };
	}
	if (!policy.defaultAllow) {
		return { allowed: false, blocked: true, reason: 'Command blocked because command permission policy is default-deny and no allow rule matched.' };
	}
	return { allowed: true, blocked: false, reason: 'Command allowed by default command permission policy.' };
}

export function commandPermissionSummary(policy: VibeCodexCommandPermissionPolicy): string {
	return [
		`Terminal commands are ${policy.defaultAllow ? 'allowed by default' : 'blocked by default'}.`,
		`${policy.allow.length} allow rule${policy.allow.length === 1 ? '' : 's'}.`,
		`${policy.deny.length} deny rule${policy.deny.length === 1 ? '' : 's'}.`,
		policy.sources.length ? `Sources: ${policy.sources.join(', ')}.` : 'Sources: built-in defaults only.',
	].join(' ');
}

export function commandPermissionPromptBlock(policy: VibeCodexCommandPermissionPolicy): string {
	return JSON.stringify(redactSensitiveValue({
		version: policy.version,
		defaultAllow: policy.defaultAllow,
		allow: policy.allow,
		deny: policy.deny,
		sources: policy.sources,
		note: 'Terminal commands must satisfy this client command permission policy and the exact approved visual plan authorization before execution.',
	}), null, 2);
}

export function isDangerousCommand(commandLine: string): boolean {
	const command = normalizeCommandLine(commandLine);
	return /\brm\s+-rf\s+(?:\/|~|\$home|\.)/.test(command)
		|| /\bsudo\b/.test(command)
		|| /\bmkfs(?:\.|\s)/.test(command)
		|| /\bdd\s+if=/.test(command)
		|| /:\s*\(\)\s*\{/.test(command)
		|| /\bchmod\s+-r\s+777\s+(?:\/|~|\$home|\.)/.test(command)
		|| /\b(?:curl|wget)\b.+\|\s*(?:sh|bash|zsh)\b/.test(command);
}

function parseClineCommandPermissions(value: string | undefined): { readonly allow: readonly string[]; readonly deny: readonly string[] } {
	if (!value?.trim()) {
		return { allow: [], deny: [] };
	}
	const parsed = parseJson(value);
	if (Array.isArray(parsed)) {
		return { allow: parsed.filter(isString), deny: [] };
	}
	if (isRecord(parsed)) {
		return {
			allow: arrayOfStrings(parsed.allow) ?? arrayOfStrings(parsed.allowed) ?? arrayOfStrings(parsed.allowCommands) ?? [],
			deny: arrayOfStrings(parsed.deny) ?? arrayOfStrings(parsed.denied) ?? arrayOfStrings(parsed.block) ?? arrayOfStrings(parsed.blocked) ?? [],
		};
	}
	const allow: string[] = [];
	const deny: string[] = [];
	for (const token of value.split(/[\n,;]+/)) {
		const trimmed = token.trim();
		if (!trimmed) {
			continue;
		}
		const prefixed = trimmed.match(/^(allow|allowed|deny|denied|block|blocked)\s*:\s*(.+)$/i);
		if (prefixed) {
			const target = /^(deny|denied|block|blocked)$/i.test(prefixed[1]) ? deny : allow;
			target.push(prefixed[2].trim());
			continue;
		}
		allow.push(trimmed);
	}
	return { allow, deny };
}

function uniquePatterns(values: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const patterns: string[] = [];
	for (const value of values) {
		const normalized = normalizePattern(value);
		if (normalized && !seen.has(normalized)) {
			seen.add(normalized);
			patterns.push(normalized);
		}
	}
	return patterns.slice(0, 80);
}

function matchesCommandPattern(commandLine: string, pattern: string): boolean {
	const normalizedPattern = normalizePattern(pattern);
	if (!normalizedPattern) {
		return false;
	}
	if (normalizedPattern.includes('*')) {
		const escaped = normalizedPattern.split('*').map(escapeRegExp).join('.*');
		return new RegExp(`^${escaped}$`).test(commandLine);
	}
	return commandLine === normalizedPattern || commandLine.startsWith(`${normalizedPattern} `);
}

function normalizeCommandLine(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePattern(value: string): string | undefined {
	const normalized = normalizeCommandLine(value);
	return normalized.length ? normalized : undefined;
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function arrayOfStrings(value: unknown): readonly string[] | undefined {
	return Array.isArray(value) ? value.filter(isString) : undefined;
}

function isString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
