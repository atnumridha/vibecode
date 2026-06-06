/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createChatTabs } from './chatTabs';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSessionSnapshot } from './sessionHistory';
import { sanitizeTranscriptEvents } from './transcript';

export interface VibeCodexSessionHistoryStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeDetails: boolean;
	readonly includeTranscriptTail: boolean;
	readonly maxSessions: number;
	readonly requestedAt: number;
}

export interface VibeCodexSessionHistoryStatusSession {
	readonly id: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly mode: string;
	readonly status: string;
	readonly active: boolean;
	readonly promptPreview: string;
	readonly taskId?: string;
	readonly revision?: number;
	readonly planSummary?: string;
	readonly provider?: {
		readonly label?: string;
		readonly model?: string;
		readonly modelSource?: string;
	};
	readonly transcriptEventCount: number;
	readonly evidenceCount: number;
	readonly planRevisionCount: number;
	readonly inlinePrompt?: {
		readonly file?: string;
		readonly range?: string;
		readonly selectionKind: string;
	};
	readonly lastEvent?: {
		readonly kind: string;
		readonly status: string;
		readonly title: string;
	};
	readonly transcriptTail?: readonly {
		readonly kind: string;
		readonly status: string;
		readonly title: string;
		readonly detail?: string;
	}[];
}

export interface VibeCodexSessionHistoryStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly activeSessionId?: string;
	readonly counts: {
		readonly sessions: number;
		readonly returnedSessions: number;
		readonly tabs: number;
		readonly activeSessions: number;
		readonly transcriptEvents: number;
		readonly planning: number;
		readonly approved: number;
		readonly terminal: number;
		readonly diffReview: number;
		readonly rollback: number;
		readonly blocked: number;
		readonly completed: number;
		readonly error: number;
	};
	readonly tabs: ReturnType<typeof createChatTabs>['tabs'];
	readonly sessions: readonly VibeCodexSessionHistoryStatusSession[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

const sessionHistoryStatusMethods = new Set([
	'agent/getSessionHistoryStatus',
	'agent/sessionHistoryStatus',
	'session/historyStatus',
	'session/history/status',
	'chat/historyStatus',
	'chat/history/status',
	'chat/status',
	'vibecodex/sessionHistoryStatus',
]);

const sessionHistoryStatusToolNames = new Set([
	'session_history_status',
	'get_session_history_status',
	'chat_history_status',
	'chat_tabs_status',
	'conversation_history_status',
]);

const defaultMaxSessions = 8;
const maxMaxSessions = 30;
const transcriptTailLimit = 5;

export function normalizeSessionHistoryStatusRequest(message: JsonRpcMessage): VibeCodexSessionHistoryStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!sessionHistoryStatusMethods.has(message.method) && !isSessionHistoryStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeDetails: booleanValue(payload.includeDetails)
			?? booleanValue(payload.include_details)
			?? booleanValue(args.includeDetails)
			?? booleanValue(args.include_details)
			?? false,
		includeTranscriptTail: booleanValue(payload.includeTranscriptTail)
			?? booleanValue(payload.include_transcript_tail)
			?? booleanValue(args.includeTranscriptTail)
			?? booleanValue(args.include_transcript_tail)
			?? false,
		maxSessions: clampNumber(numberValue(payload.maxSessions)
			?? numberValue(payload.max_sessions)
			?? numberValue(args.maxSessions)
			?? numberValue(args.max_sessions)
			?? defaultMaxSessions, 1, maxMaxSessions),
		requestedAt: Date.now(),
	};
}

export function createSessionHistoryStatusResponse(request: VibeCodexSessionHistoryStatusRequest, input: {
	readonly history: readonly VibeCodexSessionSnapshot[];
	readonly activeSessionId?: string;
}): VibeCodexSessionHistoryStatusResponse {
	const history = input.history.slice(0, maxMaxSessions);
	const tabs = createChatTabs(history, input.activeSessionId, Math.min(request.maxSessions, 12)).tabs;
	const sessions = history
		.slice(0, request.maxSessions)
		.map(session => sessionStatus(session, input.activeSessionId, request));
	const counts = statusCounts(history, input.activeSessionId, tabs.length, sessions.length);
	return {
		ok: true,
		source: 'externalExtension',
		...(input.activeSessionId ? { activeSessionId: redactSensitiveText(input.activeSessionId) } : {}),
		counts,
		tabs: redactSensitiveValue(tabs) as VibeCodexSessionHistoryStatusResponse['tabs'],
		sessions,
		guardrails: [
			'Session history status is read-only and never restores, exports, creates, deletes, archives, or mutates chat sessions.',
			'Old plans, restored sessions, and session history never count as approval for the current task.',
			'Only bounded redacted previews are returned by default; full prompts, full transcripts, approval tokens, raw API keys, and command-output secrets are never exposed.',
			'Transcript tail is returned only when includeTranscriptTail=true and remains capped and redacted.',
		],
		message: `Session history: ${history.length} stored session${history.length === 1 ? '' : 's'}, ${tabs.length} visible chat tab${tabs.length === 1 ? '' : 's'}${input.activeSessionId ? ', active session available' : ''}.`,
	};
}

export function sessionHistoryStatusSummary(response: VibeCodexSessionHistoryStatusResponse): string {
	return `${response.message} ${response.counts.completed} completed; ${response.counts.blocked + response.counts.error} blocked/error.`;
}

function sessionStatus(session: VibeCodexSessionSnapshot, activeSessionId: string | undefined, request: VibeCodexSessionHistoryStatusRequest): VibeCodexSessionHistoryStatusSession {
	const events = sanitizeTranscriptEvents(session.transcript);
	const lastEvent = events[0];
	return {
		id: redactSensitiveText(session.id),
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		mode: redactSensitiveText(session.mode),
		status: session.status,
		active: session.id === activeSessionId,
		promptPreview: preview(session.prompt),
		...(session.plan?.taskId ? { taskId: redactSensitiveText(session.plan.taskId) } : {}),
		...(session.plan ? { revision: session.plan.revision, planSummary: preview(session.plan.summary) } : {}),
		...(request.includeDetails && session.provider ? {
			provider: {
				label: session.provider.label ? redactSensitiveText(session.provider.label) : undefined,
				model: session.provider.model ? redactSensitiveText(session.provider.model) : undefined,
				modelSource: session.provider.modelRouting?.source,
			},
		} : {}),
		transcriptEventCount: events.length,
		evidenceCount: session.evidence.length,
		planRevisionCount: session.planRevisionHistory.length,
		...(request.includeDetails && session.inlinePromptSession ? {
			inlinePrompt: {
				...(session.inlinePromptSession.file ? { file: redactSensitiveText(session.inlinePromptSession.file) } : {}),
				...(session.inlinePromptSession.range ? { range: redactSensitiveText(session.inlinePromptSession.range) } : {}),
				selectionKind: session.inlinePromptSession.selectionKind,
			},
		} : {}),
		...(lastEvent ? {
			lastEvent: {
				kind: lastEvent.kind,
				status: lastEvent.status,
				title: preview(lastEvent.title),
			},
		} : {}),
		...(request.includeTranscriptTail ? {
			transcriptTail: events.slice(0, transcriptTailLimit).map(event => ({
				kind: event.kind,
				status: event.status,
				title: preview(event.title),
				...(event.detail ? { detail: preview(event.detail, 500) } : {}),
			})),
		} : {}),
	};
}

function statusCounts(history: readonly VibeCodexSessionSnapshot[], activeSessionId: string | undefined, tabs: number, returnedSessions: number): VibeCodexSessionHistoryStatusResponse['counts'] {
	return {
		sessions: history.length,
		returnedSessions,
		tabs,
		activeSessions: activeSessionId && history.some(session => session.id === activeSessionId) ? 1 : 0,
		transcriptEvents: history.reduce((sum, session) => sum + sanitizeTranscriptEvents(session.transcript).length, 0),
		planning: history.filter(session => session.status === 'planning').length,
		approved: history.filter(session => session.status === 'approved').length,
		terminal: history.filter(session => session.status === 'terminal').length,
		diffReview: history.filter(session => session.status === 'diff_review').length,
		rollback: history.filter(session => session.status === 'rollback').length,
		blocked: history.filter(session => session.status === 'blocked').length,
		completed: history.filter(session => session.status === 'completed').length,
		error: history.filter(session => session.status === 'error').length,
	};
}

function preview(value: string, maxChars = 180): string {
	const text = redactSensitiveText(value).replace(/\s+/g, ' ').trim();
	if (text.length <= maxChars) {
		return text || 'Untitled';
	}
	return `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function isSessionHistoryStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return sessionHistoryStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
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

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) {
		return Number(value);
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : defaultMaxSessions)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
