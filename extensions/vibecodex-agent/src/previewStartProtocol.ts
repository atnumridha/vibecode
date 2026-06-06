/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCommandPermissionDecision } from './commandPermissions';
import type { ExternalApprovalCard } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexPreviewPlan, VibeCodexPreviewTarget } from './previewPlan';
import { redactSensitiveText } from './secretFilters';

export interface VibeCodexPreviewStartRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly targetId?: string;
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly url?: string;
	readonly label?: string;
	readonly reason?: string;
	readonly requestedAt: number;
}

export interface VibeCodexPreviewStartApprovalCard extends ExternalApprovalCard {
	readonly toolName: 'start_preview';
	readonly commandLine: string;
	readonly previewTargetId: string;
	readonly previewUrl: string;
	readonly previewLabel: string;
}

export interface VibeCodexPreviewStartResponse {
	readonly ok: boolean;
	readonly decision: 'accept' | 'decline';
	readonly approved: boolean;
	readonly started: boolean;
	readonly source: 'externalExtension';
	readonly tool: 'start_preview';
	readonly targetId?: string;
	readonly label?: string;
	readonly previewUrl?: string;
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly runId?: string;
	readonly availableTargets?: readonly {
		readonly id: string;
		readonly label: string;
		readonly command: string;
		readonly cwd?: string;
		readonly url: string;
		readonly source: string;
	}[];
	readonly message: string;
	readonly guardrails: readonly string[];
}

const previewStartMethods = new Set([
	'agent/startPreview',
	'agent/previewStart',
	'preview/start',
	'preview.start',
	'localhost/startPreview',
	'vibecodex/previewStart',
]);

const previewStartToolNames = new Set([
	'start_preview',
	'preview_start',
	'preview.start',
	'localhost_start_preview',
	'start_localhost_preview',
	'localhost_preview_start',
]);

export function normalizePreviewStartRequest(message: JsonRpcMessage): VibeCodexPreviewStartRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!previewStartMethods.has(message.method) && !isPreviewStartToolCall(message.method, payload, args)) {
		return undefined;
	}
	const targetId = stringValue(payload.targetId)
		?? stringValue(payload.target_id)
		?? stringValue(payload.previewId)
		?? stringValue(payload.preview_id)
		?? stringValue(payload.target)
		?? stringValue(payload.id)
		?? stringValue(args.targetId)
		?? stringValue(args.target_id)
		?? stringValue(args.previewId)
		?? stringValue(args.preview_id)
		?? stringValue(args.target)
		?? stringValue(args.id);
	const commandLine = stringValue(payload.commandLine)
		?? stringValue(payload.command)
		?? stringValue(payload.cmd)
		?? stringValue(payload.command_line)
		?? stringValue(args.commandLine)
		?? stringValue(args.command)
		?? stringValue(args.cmd)
		?? stringValue(args.command_line);
	const cwd = stringValue(payload.cwd)
		?? stringValue(payload.workingDirectory)
		?? stringValue(payload.working_directory)
		?? stringValue(args.cwd)
		?? stringValue(args.workingDirectory)
		?? stringValue(args.working_directory);
	const url = stringValue(payload.url)
		?? stringValue(payload.previewUrl)
		?? stringValue(payload.preview_url)
		?? stringValue(args.url)
		?? stringValue(args.previewUrl)
		?? stringValue(args.preview_url);
	const label = stringValue(payload.label) ?? stringValue(payload.name) ?? stringValue(args.label) ?? stringValue(args.name);
	const reason = stringValue(payload.reason) ?? stringValue(payload.description) ?? stringValue(args.reason) ?? stringValue(args.description);
	return {
		id: message.id,
		method: message.method,
		...(targetId ? { targetId: redactSensitiveText(targetId) } : {}),
		...(commandLine ? { commandLine: redactSensitiveText(commandLine) } : {}),
		...(cwd ? { cwd: redactSensitiveText(cwd) } : {}),
		...(url ? { url: redactSensitiveText(url) } : {}),
		...(label ? { label: redactSensitiveText(label) } : {}),
		...(reason ? { reason: redactSensitiveText(reason) } : {}),
		requestedAt: Date.now(),
	};
}

export function resolvePreviewStartTarget(request: VibeCodexPreviewStartRequest, plan: VibeCodexPreviewPlan | undefined): VibeCodexPreviewTarget | undefined {
	const previews = plan?.previews ?? [];
	if (!previews.length) {
		return undefined;
	}
	if (request.targetId) {
		const byId = previews.find(target => target.id === request.targetId);
		if (byId) {
			return byId;
		}
	}
	if (request.url) {
		const byUrl = previews.find(target => redactSensitiveText(target.url) === request.url);
		if (byUrl) {
			return byUrl;
		}
	}
	if (request.commandLine) {
		const byCommand = previews.find(target => redactSensitiveText(target.command) === request.commandLine && (!request.cwd || redactSensitiveText(target.cwd ?? '') === request.cwd));
		if (byCommand) {
			return byCommand;
		}
	}
	if (request.label) {
		return previews.find(target => redactSensitiveText(target.label) === request.label);
	}
	return undefined;
}

export function createPreviewStartApprovalCard(request: VibeCodexPreviewStartRequest, target: VibeCodexPreviewTarget, commandDecision: VibeCodexCommandPermissionDecision): VibeCodexPreviewStartApprovalCard {
	const blocked = !commandDecision.allowed || commandDecision.blocked;
	return {
		id: request.id,
		method: request.method,
		kind: 'terminal',
		title: 'Start preview',
		description: request.reason ?? `Start ${target.label} at ${target.url}`,
		detail: [
			`Tool: start_preview`,
			`Target: ${redactSensitiveText(target.label)}`,
			`URL: ${redactSensitiveText(target.url)}`,
			`Command: ${redactSensitiveText(target.command)}`,
			target.cwd ? `Cwd: ${redactSensitiveText(target.cwd)}` : undefined,
			commandDecision.reason ? redactSensitiveText(commandDecision.reason) : undefined,
		].filter((value): value is string => !!value).join('\n'),
		toolName: 'start_preview',
		commandLine: target.command,
		...(target.cwd ? { cwd: target.cwd } : {}),
		reason: request.reason ?? `Start preview ${target.label} at ${target.url}`,
		paths: [],
		risk: blocked ? 'blocked' : 'medium',
		blocked,
		requestedAt: request.requestedAt,
		previewTargetId: target.id,
		previewUrl: target.url,
		previewLabel: target.label,
	};
}

export function createPreviewStartResponse(input: {
	readonly request?: VibeCodexPreviewStartRequest;
	readonly card?: Pick<VibeCodexPreviewStartApprovalCard, 'id' | 'method' | 'previewTargetId' | 'previewUrl' | 'previewLabel' | 'commandLine' | 'cwd'>;
	readonly target?: VibeCodexPreviewTarget;
	readonly previewPlan?: VibeCodexPreviewPlan;
	readonly accepted: boolean;
	readonly started?: boolean;
	readonly runId?: string;
	readonly message?: string;
}): VibeCodexPreviewStartResponse {
	const target = input.target;
	const card = input.card;
	const started = !!input.started && !!input.accepted;
		const response = {
			ok: started,
			decision: input.accepted ? 'accept' as const : 'decline' as const,
			approved: input.accepted,
			started,
			...(target ? sanitizeTarget(target) : {}),
			...(card && !target ? {
				targetId: redactSensitiveText(card.previewTargetId),
			label: redactSensitiveText(card.previewLabel),
			previewUrl: redactSensitiveText(card.previewUrl),
			commandLine: redactSensitiveText(card.commandLine),
			...(card.cwd ? { cwd: redactSensitiveText(card.cwd) } : {}),
			} : {}),
			...(input.runId ? { runId: redactSensitiveText(input.runId) } : {}),
			...(!target && !card && input.previewPlan ? { availableTargets: input.previewPlan.previews.slice(0, 12).map(sanitizeTarget) } : {}),
			source: 'externalExtension' as const,
			tool: 'start_preview' as const,
			message: input.message ?? (started ? 'Preview terminal started.' : 'Preview start declined.'),
			guardrails: previewStartGuardrails,
		};
	return response;
}

export function previewStartSummary(response: VibeCodexPreviewStartResponse): string {
	if (response.started) {
		return `Started preview${response.label ? ` ${response.label}` : ''}${response.previewUrl ? ` at ${response.previewUrl}` : ''}.`;
	}
	return `Preview start declined: ${response.message}`;
}

export function isPreviewStartApprovalCard(card: ExternalApprovalCard): card is VibeCodexPreviewStartApprovalCard {
	return card.toolName === 'start_preview'
		&& typeof card.commandLine === 'string'
		&& typeof card.previewTargetId === 'string'
		&& typeof card.previewUrl === 'string'
		&& typeof card.previewLabel === 'string';
}

const previewStartGuardrails = [
	'Preview start only starts a detected preview target from the current preview plan; arbitrary shell commands must use execute_command.',
	'Preview start runs as a visible captured VS Code terminal and remains gated by Mode Policy, command permissions, exact visual-plan authorization, and user approval.',
	'Preview start does not open browsers or embedded preview panels; backend must request browser_action/open_preview separately for the returned loopback URL.',
	'Target command, cwd, URL, label, and run id are redacted before being returned to the backend.',
];

function sanitizeTarget(target: VibeCodexPreviewTarget): NonNullable<VibeCodexPreviewStartResponse['availableTargets']>[number] & {
	readonly targetId: string;
	readonly label: string;
	readonly previewUrl: string;
	readonly commandLine: string;
} {
	return {
		id: redactSensitiveText(target.id),
		targetId: redactSensitiveText(target.id),
		label: redactSensitiveText(target.label),
		command: redactSensitiveText(target.command),
		commandLine: redactSensitiveText(target.command),
		...(target.cwd ? { cwd: redactSensitiveText(target.cwd) } : {}),
		url: redactSensitiveText(target.url),
		previewUrl: redactSensitiveText(target.url),
		source: redactSensitiveText(target.source),
	};
}

function isPreviewStartToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name)
		?? '').toLowerCase();
	return previewStartToolNames.has(tool);
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
