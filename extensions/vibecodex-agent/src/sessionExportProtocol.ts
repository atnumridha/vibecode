/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSessionSnapshot } from './sessionHistory';

export interface VibeCodexSessionExportRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly sessionId?: string;
	readonly active: boolean;
	readonly maxChars: number;
	readonly requestedAt: number;
}

export interface VibeCodexSessionExportResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly sessionId?: string;
	readonly activeSessionId?: string;
	readonly selectedActive: boolean;
	readonly generatedAt: number;
	readonly maxChars: number;
	readonly truncated: boolean;
	readonly markdown?: string;
	readonly counts: {
		readonly sessions: number;
		readonly markdownChars: number;
		readonly returnedChars: number;
		readonly transcriptEvents: number;
		readonly evidenceItems: number;
		readonly planRevisions: number;
	};
	readonly guardrails: readonly string[];
	readonly message: string;
}

const sessionExportMethods = new Set([
	'agent/exportSession',
	'agent/sessionExport',
	'session/export',
	'chat/export',
	'conversation/export',
	'vibecodex/sessionExport',
]);

const sessionExportToolNames = new Set([
	'session_export',
	'export_session',
	'chat_export',
	'export_chat',
	'conversation_export',
	'export_active_session',
]);

const defaultMaxChars = 20000;
const minMaxChars = 500;
const maxMaxChars = 120000;

export function normalizeSessionExportRequest(message: JsonRpcMessage): VibeCodexSessionExportRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!sessionExportMethods.has(message.method) && !isSessionExportToolCall(message.method, payload, args)) {
		return undefined;
	}
	const sessionId = stringValue(payload.sessionId)
		?? stringValue(payload.session_id)
		?? stringValue(args.sessionId)
		?? stringValue(args.session_id);
	return {
		id: message.id,
		method: message.method,
		...(sessionId ? { sessionId: redactSensitiveText(sessionId) } : {}),
		active: booleanValue(payload.active)
			?? booleanValue(payload.activeOnly)
			?? booleanValue(payload.active_only)
			?? booleanValue(args.active)
			?? booleanValue(args.activeOnly)
			?? booleanValue(args.active_only)
			?? !sessionId,
		maxChars: clampNumber(numberValue(payload.maxChars)
			?? numberValue(payload.max_chars)
			?? numberValue(args.maxChars)
			?? numberValue(args.max_chars)
			?? defaultMaxChars, minMaxChars, maxMaxChars),
		requestedAt: Date.now(),
	};
}

export function createSessionExportResponse(request: VibeCodexSessionExportRequest, input: {
	readonly history: readonly VibeCodexSessionSnapshot[];
	readonly activeSessionId?: string;
}): VibeCodexSessionExportResponse {
	const selected = selectSession(request, input.history, input.activeSessionId);
	const fullMarkdown = selected ? redactSensitiveText(sessionExportMarkdown(selected)) : '';
	const markdown = truncateText(fullMarkdown, request.maxChars);
	const response: VibeCodexSessionExportResponse = {
		ok: !!selected,
		source: 'externalExtension',
		...(selected ? { sessionId: redactSensitiveText(selected.id) } : {}),
		...(input.activeSessionId ? { activeSessionId: redactSensitiveText(input.activeSessionId) } : {}),
		selectedActive: !!selected && selected.id === input.activeSessionId,
		generatedAt: Date.now(),
		maxChars: request.maxChars,
		truncated: markdown.length < fullMarkdown.length,
		...(selected ? { markdown } : {}),
		counts: {
			sessions: input.history.length,
			markdownChars: fullMarkdown.length,
			returnedChars: markdown.length,
			transcriptEvents: selected?.transcript.length ?? 0,
			evidenceItems: selected?.evidence.length ?? 0,
			planRevisions: selected?.planRevisionHistory.length ?? 0,
		},
		guardrails: sessionExportGuardrails(),
		message: selected
			? `Exported session ${selected.id} as redacted Markdown (${markdown.length}/${fullMarkdown.length} chars).`
			: 'No matching session is available to export.',
	};
	return redactSensitiveValue(response) as VibeCodexSessionExportResponse;
}

export function sessionExportSummary(response: VibeCodexSessionExportResponse): string {
	return response.ok ? response.message : `${response.message} Stored sessions: ${response.counts.sessions}.`;
}

function selectSession(request: VibeCodexSessionExportRequest, history: readonly VibeCodexSessionSnapshot[], activeSessionId: string | undefined): VibeCodexSessionSnapshot | undefined {
	if (request.sessionId) {
		return history.find(session => session.id === request.sessionId);
	}
	if (request.active && activeSessionId) {
		return history.find(session => session.id === activeSessionId);
	}
	return history[0];
}

function sessionExportGuardrails(): readonly string[] {
	return [
		'Session export is read-only and never restores sessions, deletes history, approves old plans, accepts completion, or mutates workspace files.',
		'Exported Markdown is capped and redacted before returning to the backend.',
		'Old plans, exported sessions, and restored transcripts never count as approval for the current task.',
	];
}

function sessionExportMarkdown(snapshot: VibeCodexSessionSnapshot): string {
	return [
		`# Vibe Codex Session ${snapshot.id}`,
		'',
		`- Mode: ${snapshot.mode}`,
		`- Status: ${snapshot.status}`,
		`- Created: ${safeIsoDate(snapshot.createdAt)}`,
		`- Updated: ${safeIsoDate(snapshot.updatedAt)}`,
		snapshot.provider ? `- Provider: ${snapshot.provider.label}${snapshot.provider.model ? ` / ${snapshot.provider.model}` : ''}` : undefined,
		'',
		'## Prompt',
		'',
		snapshot.prompt || '(empty prompt)',
		snapshot.contextSummary ? `\n## Context\n\n${snapshot.contextSummary}` : undefined,
		snapshot.plan ? [
			'',
			'## Plan',
			'',
			`Revision ${snapshot.plan.revision}: ${snapshot.plan.summary}`,
			'',
			snapshot.plan.strategy,
			'',
			'```mermaid',
			snapshot.plan.flowchart,
			'```',
			'',
			...snapshot.plan.steps.map(step => `- [${step.status === 'completed' ? 'x' : ' '}] ${step.id}: ${step.title}`),
		].join('\n') : undefined,
		snapshot.planRevisionHistory.length ? [
			'',
			'## Plan Revision History',
			'',
			...snapshot.planRevisionHistory.slice(-12).map(revision => `- r${revision.revision} ${revision.event}: ${revision.summary}`),
		].join('\n') : undefined,
		snapshot.transcript.length ? [
			'',
			'## Transcript',
			'',
			...snapshot.transcript.slice(-80).map(event => `- ${safeIsoDate(event.timestamp)} ${event.kind}/${event.status}: ${event.title}${event.detail ? `\n  ${event.detail}` : ''}`),
		].join('\n') : undefined,
		snapshot.evidence.length ? [
			'',
			'## Evidence',
			'',
			...snapshot.evidence.slice(-80).map(item => `- ${item}`),
		].join('\n') : undefined,
		'',
	].filter((value): value is string => value !== undefined).join('\n');
}

function safeIsoDate(value: number): string {
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function isSessionExportToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return sessionExportToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function truncateText(value: string, maxChars: number): string {
	if (value.length <= maxChars) {
		return value;
	}
	const suffix = '\n\n[Session export truncated by client cap]';
	return `${value.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : defaultMaxChars)));
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) {
		return Number(value);
	}
	return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		return /^(1|true|yes)$/i.test(value) ? true : /^(0|false|no)$/i.test(value) ? false : undefined;
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
