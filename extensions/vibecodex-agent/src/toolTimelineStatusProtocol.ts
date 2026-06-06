/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExternalApprovalCard, ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';
import type { VibeCodexTranscriptEvent, VibeCodexTranscriptKind, VibeCodexTranscriptStatus } from './transcript';

export interface VibeCodexToolTimelineStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeEvents: boolean;
	readonly includeLiveState: boolean;
	readonly includeDetails: boolean;
	readonly maxEvents: number;
	readonly requestedAt: number;
}

export interface VibeCodexToolTimelineEvent {
	readonly id: string;
	readonly timestamp: number;
	readonly kind: VibeCodexTranscriptKind;
	readonly status: VibeCodexTranscriptStatus;
	readonly title: string;
	readonly detail?: string;
}

export interface VibeCodexToolTimelineLiveState {
	readonly approvals: readonly {
		readonly id: string;
		readonly kind: ExternalApprovalCard['kind'];
		readonly title: string;
		readonly risk: ExternalApprovalCard['risk'];
		readonly blocked: boolean;
		readonly requestedAt: number;
		readonly toolName?: string;
		readonly commandLine?: string;
		readonly paths?: readonly string[];
	}[];
	readonly terminalRuns: readonly {
		readonly id: string;
		readonly commandLine: string;
		readonly status: VibeCodexCapturedTerminalRun['status'];
		readonly startedAt: number;
		readonly endedAt?: number;
		readonly exitCode?: number;
		readonly signal?: string;
	}[];
	readonly diffReview?: {
		readonly reviewId: string;
		readonly createdAt: number;
		readonly files: number;
		readonly pending: number;
		readonly accepted: number;
		readonly rejected: number;
		readonly paths?: readonly string[];
	};
}

export interface VibeCodexToolTimelineStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly counts: {
		readonly timelineEvents: number;
		readonly returnedEvents: number;
		readonly pending: number;
		readonly running: number;
		readonly completed: number;
		readonly blocked: number;
		readonly failed: number;
		readonly approvals: number;
		readonly blockedApprovals: number;
		readonly terminalRuns: number;
		readonly runningTerminalRuns: number;
		readonly diffFiles: number;
		readonly pendingDiffFiles: number;
	};
	readonly events?: readonly VibeCodexToolTimelineEvent[];
	readonly liveState?: VibeCodexToolTimelineLiveState;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexToolTimelineStatusInput {
	readonly transcriptEvents: readonly VibeCodexTranscriptEvent[];
	readonly approvals: readonly ExternalApprovalCard[];
	readonly terminalRuns: readonly VibeCodexCapturedTerminalRun[];
	readonly activeDiffReview?: ExternalDiffReview;
}

const toolTimelineStatusMethods = new Set([
	'agent/getToolTimelineStatus',
	'agent/toolTimelineStatus',
	'tool/timelineStatus',
	'tools/timelineStatus',
	'timeline/status',
	'activity/status',
	'vibecodex/toolTimelineStatus',
]);

const toolTimelineStatusToolNames = new Set([
	'tool_timeline_status',
	'tool_timeline',
	'activity_status',
	'agent_activity_status',
	'get_tool_timeline_status',
]);

const defaultMaxEvents = 24;
const maxEventsLimit = 80;

export function normalizeToolTimelineStatusRequest(message: JsonRpcMessage): VibeCodexToolTimelineStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!toolTimelineStatusMethods.has(message.method) && !isToolTimelineStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeEvents: booleanValue(payload.includeEvents)
			?? booleanValue(payload.include_events)
			?? booleanValue(args.includeEvents)
			?? booleanValue(args.include_events)
			?? true,
		includeLiveState: booleanValue(payload.includeLiveState)
			?? booleanValue(payload.include_live_state)
			?? booleanValue(args.includeLiveState)
			?? booleanValue(args.include_live_state)
			?? true,
		includeDetails: booleanValue(payload.includeDetails)
			?? booleanValue(payload.include_details)
			?? booleanValue(args.includeDetails)
			?? booleanValue(args.include_details)
			?? false,
		maxEvents: clampNumber(
			numberValue(payload.maxEvents)
				?? numberValue(payload.max_events)
				?? numberValue(args.maxEvents)
				?? numberValue(args.max_events)
				?? defaultMaxEvents,
			1,
			maxEventsLimit,
		),
		requestedAt: Date.now(),
	};
}

export function createToolTimelineStatusResponse(request: VibeCodexToolTimelineStatusRequest, input: VibeCodexToolTimelineStatusInput): VibeCodexToolTimelineStatusResponse {
	const events = input.transcriptEvents
		.filter(isToolTimelineKind)
		.sort((a, b) => b.timestamp - a.timestamp);
	const returnedEvents = events.slice(0, request.maxEvents).map(event => timelineEvent(event, request.includeDetails));
	const diffCounts = diffReviewCounts(input.activeDiffReview);
	const counts = {
		timelineEvents: events.length,
		returnedEvents: request.includeEvents ? returnedEvents.length : 0,
		pending: events.filter(event => event.status === 'pending').length,
		running: events.filter(event => event.status === 'running').length,
		completed: events.filter(event => event.status === 'completed').length,
		blocked: events.filter(event => event.status === 'blocked').length,
		failed: events.filter(event => event.status === 'failed').length,
		approvals: input.approvals.length,
		blockedApprovals: input.approvals.filter(approval => approval.blocked).length,
		terminalRuns: input.terminalRuns.length,
		runningTerminalRuns: input.terminalRuns.filter(run => run.status === 'running').length,
		diffFiles: diffCounts.files,
		pendingDiffFiles: diffCounts.pending,
	};
	return {
		ok: true,
		source: 'externalExtension',
		counts,
		...(request.includeEvents ? { events: returnedEvents } : {}),
		...(request.includeLiveState ? { liveState: liveState(input, request.includeDetails) } : {}),
		guardrails: [
			'Tool timeline status is read-only and never approves, declines, executes, interrupts, retries, accepts diffs, restores checkpoints, or mutates files.',
			'Raw terminal output, approval tokens, full patches, and unbounded transcript text are intentionally omitted.',
			'Timeline entries, command lines, paths, approval titles, and details are redacted before they are returned to the backend.',
			'Use dedicated approval, terminal, diff, checkpoint, verification, and workflow status calls for deeper read-only state before requesting mutation.',
		],
		message: `${events.length} tool timeline event${events.length === 1 ? '' : 's'}; ${input.approvals.length} pending approval${input.approvals.length === 1 ? '' : 's'}; ${counts.runningTerminalRuns} running terminal${counts.runningTerminalRuns === 1 ? '' : 's'}; ${counts.pendingDiffFiles} pending diff file${counts.pendingDiffFiles === 1 ? '' : 's'}.`,
	};
}

export function toolTimelineStatusSummary(response: VibeCodexToolTimelineStatusResponse): string {
	return `${response.counts.returnedEvents}/${response.counts.timelineEvents} timeline events returned; ${response.counts.approvals} approvals; ${response.counts.runningTerminalRuns} running terminals; ${response.counts.pendingDiffFiles} pending diff files.`;
}

function timelineEvent(event: VibeCodexTranscriptEvent, includeDetails: boolean): VibeCodexToolTimelineEvent {
	return {
		id: redactSensitiveText(event.id),
		timestamp: event.timestamp,
		kind: event.kind,
		status: event.status,
		title: redactSensitiveText(event.title),
		...(includeDetails && event.detail ? { detail: redactSensitiveText(event.detail) } : {}),
	};
}

function liveState(input: VibeCodexToolTimelineStatusInput, includeDetails: boolean): VibeCodexToolTimelineLiveState {
	return {
		approvals: input.approvals.slice(0, 24).map(approval => ({
			id: redactSensitiveText(String(approval.id)),
			kind: approval.kind,
			title: redactSensitiveText(approval.title),
			risk: approval.risk,
			blocked: approval.blocked,
			requestedAt: approval.requestedAt,
			...(approval.toolName ? { toolName: redactSensitiveText(approval.toolName) } : {}),
			...(includeDetails && approval.commandLine ? { commandLine: redactSensitiveText(approval.commandLine) } : {}),
			...(includeDetails && approval.paths.length ? { paths: redactSensitiveValue(approval.paths) as readonly string[] } : {}),
		})),
		terminalRuns: input.terminalRuns
			.slice()
			.sort((a, b) => b.startedAt - a.startedAt)
			.slice(0, 24)
			.map(run => ({
				id: redactSensitiveText(run.id),
				commandLine: redactSensitiveText(run.commandLine),
				status: run.status,
				startedAt: run.startedAt,
				...(run.endedAt ? { endedAt: run.endedAt } : {}),
				...(run.exitCode !== undefined ? { exitCode: run.exitCode } : {}),
				...(run.signal ? { signal: redactSensitiveText(run.signal) } : {}),
			})),
		...(input.activeDiffReview ? { diffReview: diffReviewState(input.activeDiffReview, includeDetails) } : {}),
	};
}

function diffReviewState(review: ExternalDiffReview, includeDetails: boolean): NonNullable<VibeCodexToolTimelineLiveState['diffReview']> {
	const counts = diffReviewCounts(review);
	return {
		reviewId: redactSensitiveText(review.reviewId),
		createdAt: review.createdAt,
		files: counts.files,
		pending: counts.pending,
		accepted: counts.accepted,
		rejected: counts.rejected,
		...(includeDetails ? { paths: redactSensitiveValue(review.files.map(file => file.path)) as readonly string[] } : {}),
	};
}

function diffReviewCounts(review: ExternalDiffReview | undefined): { readonly files: number; readonly pending: number; readonly accepted: number; readonly rejected: number } {
	return {
		files: review?.files.length ?? 0,
		pending: review?.files.filter(file => file.status === 'pending').length ?? 0,
		accepted: review?.files.filter(file => file.status === 'accepted').length ?? 0,
		rejected: review?.files.filter(file => file.status === 'rejected').length ?? 0,
	};
}

function isToolTimelineKind(event: VibeCodexTranscriptEvent): boolean {
	return event.kind === 'approval'
		|| event.kind === 'tool'
		|| event.kind === 'terminal'
		|| event.kind === 'diff'
		|| event.kind === 'verification'
		|| event.kind === 'rollback';
}

function isToolTimelineStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return toolTimelineStatusToolNames.has(tool);
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
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
