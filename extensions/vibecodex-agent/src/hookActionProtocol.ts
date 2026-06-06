/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexWorkspaceGuidance } from './workspaceGuidance';

export interface VibeCodexHookActionRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly hookName?: string;
	readonly manifestPath?: string;
	readonly commandLine: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly supported: boolean;
	readonly blocked: boolean;
	readonly risk: 'medium' | 'blocked';
	readonly title: string;
	readonly detail: string;
	readonly requestedAt: number;
}

const hookActionMethods = new Set([
	'agent/hook/run',
	'agent/runHook',
	'hook/run',
	'hooks/run',
	'cline/hook_run',
]);

export function normalizeHookActionRequest(message: JsonRpcMessage, guidance?: VibeCodexWorkspaceGuidance): VibeCodexHookActionRequest | undefined {
	if (message.id === undefined || !message.method || !isHookActionMethod(message.method, message.params)) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const commandLine = extractCommandLine(payload, args);
	if (!commandLine) {
		return undefined;
	}
	const hookName = stringValue(payload.hookName)
		?? stringValue(args.hookName)
		?? stringValue(payload.hook)
		?? stringValue(args.hook)
		?? stringValue(payload.name)
		?? stringValue(args.name)
		?? stringValue(payload.event)
		?? stringValue(args.event);
	const manifestPath = stringValue(payload.manifestPath)
		?? stringValue(args.manifestPath)
		?? stringValue(payload.path)
		?? stringValue(args.path);
	const match = findHookCommandMatch(commandLine, guidance, manifestPath, hookName);
	const supported = !!match;
	const reason = stringValue(payload.reason) ?? stringValue(args.reason) ?? stringValue(payload.description) ?? stringValue(args.description);
	const blockedReason = supported ? undefined : 'No indexed workspace hook manifest matches this command.';
	return {
		id: message.id,
		method: message.method,
		...(hookName ? { hookName } : {}),
		...(match?.path ?? manifestPath ? { manifestPath: match?.path ?? manifestPath } : {}),
		commandLine,
		...(stringValue(payload.cwd) ?? stringValue(args.cwd) ? { cwd: stringValue(payload.cwd) ?? stringValue(args.cwd) } : {}),
		...(reason ? { reason } : {}),
		supported,
		blocked: !supported,
		risk: supported ? 'medium' : 'blocked',
		title: 'Hook execution approval',
		detail: [
			hookName ? `Hook: ${hookName}` : undefined,
			match?.path ?? manifestPath ? `Manifest: ${match?.path ?? manifestPath}` : undefined,
			`Command: ${commandLine}`,
			reason,
			supported ? 'Hook command matched an indexed workspace hook manifest and still requires plan approval, command policy approval, and visible terminal execution.' : blockedReason,
		].filter((value): value is string => !!value).join('\n'),
		requestedAt: Date.now(),
	};
}

export function createHookActionResponse(request: VibeCodexHookActionRequest, accepted: boolean, runId?: string): unknown {
	const approved = accepted && request.supported;
	return {
		approved,
		decision: approved ? 'accept' : 'decline',
		source: 'externalExtension',
		tool: 'hook.run',
		commandLine: request.commandLine,
		...(request.hookName ? { hookName: request.hookName } : {}),
		...(request.manifestPath ? { manifestPath: request.manifestPath } : {}),
		...(runId ? { runId } : {}),
		...(!accepted ? { message: 'Hook execution declined.' } : {}),
		...(accepted && !request.supported ? { message: 'Hook execution blocked because the command was not found in indexed workspace hook manifests.' } : {}),
	};
}

export function hookCommandsFromGuidance(guidance: VibeCodexWorkspaceGuidance | undefined): readonly { readonly path: string; readonly command: string; readonly labels: readonly string[] }[] {
	if (!guidance?.hooks.length) {
		return [];
	}
	const commands: { path: string; command: string; labels: readonly string[] }[] = [];
	for (const hook of guidance.hooks) {
		const parsed = parseJson(hook.text);
		for (const command of collectCommands(parsed)) {
			commands.push({ path: hook.path, command, labels: hook.entries });
		}
		for (const entry of hook.entries) {
			const command = commandFromEntryLabel(entry);
			if (command) {
				commands.push({ path: hook.path, command, labels: hook.entries });
			}
		}
	}
	return dedupeCommands(commands);
}

function isHookActionMethod(method: string, params: unknown): boolean {
	if (hookActionMethods.has(method)) {
		return true;
	}
	if (method !== 'item/tool/call') {
		return false;
	}
	const payload = isRecord(params) ? params : {};
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? '').toLowerCase();
	return tool === 'run_hook' || tool === 'execute_hook' || tool === 'hook_run' || tool === 'hook';
}

function extractCommandLine(payload: Record<string, unknown>, args: Record<string, unknown>): string | undefined {
	return stringValue(payload.commandLine)
		?? stringValue(args.commandLine)
		?? stringValue(payload.command)
		?? stringValue(args.command)
		?? stringValue(payload.cmd)
		?? stringValue(args.cmd)
		?? stringValue(payload.shellCommand)
		?? stringValue(args.shellCommand);
}

function findHookCommandMatch(commandLine: string, guidance: VibeCodexWorkspaceGuidance | undefined, manifestPath: string | undefined, hookName: string | undefined): { readonly path: string } | undefined {
	const normalizedCommand = normalizeCommand(commandLine);
	for (const candidate of hookCommandsFromGuidance(guidance)) {
		if (normalizeCommand(candidate.command) !== normalizedCommand) {
			continue;
		}
		if (manifestPath && normalizePath(candidate.path) !== normalizePath(manifestPath)) {
			continue;
		}
		if (hookName && !candidate.labels.some(label => label.toLowerCase().includes(hookName.toLowerCase()))) {
			continue;
		}
		return { path: candidate.path };
	}
	return undefined;
}

function collectCommands(value: unknown): readonly string[] {
	const commands: string[] = [];
	visitJson(value, undefined, commands);
	return commands.map(command => command.trim()).filter(Boolean).slice(0, 80);
}

function visitJson(value: unknown, key: string | undefined, commands: string[]): void {
	if (typeof value === 'string') {
		if (key && /^(command|cmd|shell|script|run)$/i.test(key) && value.trim()) {
			commands.push(value.trim());
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			visitJson(item, key, commands);
		}
		return;
	}
	if (!isRecord(value)) {
		return;
	}
	for (const [childKey, childValue] of Object.entries(value)) {
		visitJson(childValue, childKey, commands);
	}
}

function commandFromEntryLabel(entry: string): string | undefined {
	const match = /(?:command|cmd|shell|script|run)\s*[:=]\s*(.+)$/i.exec(entry);
	return match?.[1]?.trim();
}

function dedupeCommands(commands: readonly { readonly path: string; readonly command: string; readonly labels: readonly string[] }[]): readonly { readonly path: string; readonly command: string; readonly labels: readonly string[] }[] {
	const seen = new Set<string>();
	const result: { path: string; command: string; labels: readonly string[] }[] = [];
	for (const command of commands) {
		const key = `${normalizePath(command.path)}\n${normalizeCommand(command.command)}`;
		if (!seen.has(key)) {
			seen.add(key);
			result.push(command);
		}
	}
	return result;
}

function normalizeCommand(command: string): string {
	return command.trim().replace(/\s+/g, ' ');
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
