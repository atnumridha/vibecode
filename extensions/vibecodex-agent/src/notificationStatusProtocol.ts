/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExternalApprovalCard, ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexNotificationConfig } from './notificationPolicy';
import { longRunningTerminalDelayMs } from './notificationPolicy';
import { redactSensitiveText } from './secretFilters';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';
import type { VibeCodexTranscriptEvent, VibeCodexTranscriptStatus } from './transcript';

export type VibeCodexNotificationAttentionKind = 'plan' | 'approval' | 'diff' | 'terminal' | 'tool';
export type VibeCodexNotificationAttentionOwner = 'developer' | 'runtime';

export interface VibeCodexNotificationStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeItems: boolean;
	readonly includeDetails: boolean;
	readonly maxItems: number;
	readonly requestedAt: number;
}

export interface VibeCodexNotificationAttentionItem {
	readonly id: string;
	readonly kind: VibeCodexNotificationAttentionKind;
	readonly owner: VibeCodexNotificationAttentionOwner;
	readonly status: VibeCodexTranscriptStatus;
	readonly title: string;
	readonly blocked: boolean;
	readonly requestedAt: number;
	readonly risk?: ExternalApprovalCard['risk'];
	readonly detail?: string;
}

export interface VibeCodexNotificationStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly config: {
		readonly approvals: boolean;
		readonly terminalCompletion: boolean;
		readonly longRunningTerminalSeconds: number;
		readonly longRunningTerminalDelayMs?: number;
	};
	readonly counts: {
		readonly attentionItems: number;
		readonly returnedItems: number;
		readonly waitingOnDeveloper: number;
		readonly waitingOnRuntime: number;
		readonly pendingApprovals: number;
		readonly blockedApprovals: number;
		readonly pendingDiffFiles: number;
		readonly runningTerminalRuns: number;
		readonly scheduledLongRunningTerminalNotifications: number;
		readonly deliveredLongRunningTerminalNotifications: number;
		readonly recentWaitingEvents: number;
	};
	readonly items?: readonly VibeCodexNotificationAttentionItem[];
	readonly enabledChannels: readonly string[];
	readonly disabledChannels: readonly string[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexNotificationStatusInput {
	readonly config: VibeCodexNotificationConfig;
	readonly transcriptEvents: readonly VibeCodexTranscriptEvent[];
	readonly approvals: readonly ExternalApprovalCard[];
	readonly terminalRuns: readonly VibeCodexCapturedTerminalRun[];
	readonly activeDiffReview?: ExternalDiffReview;
	readonly activePlan?: {
		readonly taskId: string;
		readonly revision: number;
		readonly summary: string;
	};
	readonly planAwaitingApproval?: boolean;
	readonly scheduledLongRunningTerminalRunIds: readonly string[];
	readonly deliveredLongRunningTerminalRunIds: readonly string[];
}

const notificationStatusMethods = new Set([
	'agent/getNotificationStatus',
	'agent/notificationStatus',
	'notification/status',
	'notifications/status',
	'attention/status',
	'developerAttention/status',
	'vibecodex/notificationStatus',
]);

const notificationStatusToolNames = new Set([
	'notification_status',
	'notifications_status',
	'attention_status',
	'human_attention_status',
	'developer_attention_status',
	'waiting_status',
]);

const defaultMaxItems = 16;
const maxItemsLimit = 80;

export function normalizeNotificationStatusRequest(message: JsonRpcMessage): VibeCodexNotificationStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!notificationStatusMethods.has(message.method) && !isNotificationStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeItems: booleanValue(payload.includeItems)
			?? booleanValue(payload.include_items)
			?? booleanValue(args.includeItems)
			?? booleanValue(args.include_items)
			?? true,
		includeDetails: booleanValue(payload.includeDetails)
			?? booleanValue(payload.include_details)
			?? booleanValue(args.includeDetails)
			?? booleanValue(args.include_details)
			?? false,
		maxItems: clampNumber(
			numberValue(payload.maxItems)
				?? numberValue(payload.max_items)
				?? numberValue(args.maxItems)
				?? numberValue(args.max_items)
				?? defaultMaxItems,
			1,
			maxItemsLimit,
		),
		requestedAt: Date.now(),
	};
}

export function createNotificationStatusResponse(request: VibeCodexNotificationStatusRequest, input: VibeCodexNotificationStatusInput): VibeCodexNotificationStatusResponse {
	const items = attentionItems(input, request.includeDetails);
	const returnedItems = items.slice(0, request.maxItems);
	const pendingDiffFiles = input.activeDiffReview?.files.filter(file => file.status === 'pending').length ?? 0;
	const recentWaitingEvents = input.transcriptEvents.filter(isWaitingEvent).length;
	const delayMs = longRunningTerminalDelayMs(input.config);
	const enabledChannels = notificationChannels(input.config, true);
	const disabledChannels = notificationChannels(input.config, false);
	const counts = {
		attentionItems: items.length,
		returnedItems: request.includeItems ? returnedItems.length : 0,
		waitingOnDeveloper: items.filter(item => item.owner === 'developer').length,
		waitingOnRuntime: items.filter(item => item.owner === 'runtime').length,
		pendingApprovals: input.approvals.length,
		blockedApprovals: input.approvals.filter(approval => approval.blocked).length,
		pendingDiffFiles,
		runningTerminalRuns: input.terminalRuns.filter(run => run.status === 'running').length,
		scheduledLongRunningTerminalNotifications: input.scheduledLongRunningTerminalRunIds.length,
		deliveredLongRunningTerminalNotifications: input.deliveredLongRunningTerminalRunIds.length,
		recentWaitingEvents,
	};
	return {
		ok: true,
		source: 'externalExtension',
		config: {
			approvals: input.config.approvals,
			terminalCompletion: input.config.terminalCompletion,
			longRunningTerminalSeconds: input.config.longRunningTerminalSeconds,
			...(delayMs !== undefined ? { longRunningTerminalDelayMs: delayMs } : {}),
		},
		counts,
		...(request.includeItems ? { items: returnedItems } : {}),
		enabledChannels,
		disabledChannels,
		guardrails: [
			'Notification status is read-only and never shows notifications, changes notification settings, opens views, interrupts terminals, retries commands, approves requests, accepts diffs, or mutates files.',
			'Notification timer handles, approval tokens, raw terminal output, full patches, and unbounded transcript text are intentionally omitted.',
			'Attention titles, details, command lines, and paths are redacted before they are returned to the backend.',
			'Use approval, diff, terminal, plan, workflow, and tool timeline status calls for deeper read-only state before requesting mutation.',
		],
		message: `${counts.waitingOnDeveloper} developer attention item${counts.waitingOnDeveloper === 1 ? '' : 's'}; ${counts.waitingOnRuntime} runtime wait${counts.waitingOnRuntime === 1 ? '' : 's'}; approvals ${input.config.approvals ? 'notify' : 'silent'}; terminal completion ${input.config.terminalCompletion ? 'notify' : 'silent'}.`,
	};
}

export function notificationStatusSummary(response: VibeCodexNotificationStatusResponse): string {
	return `${response.counts.returnedItems}/${response.counts.attentionItems} notification attention items returned; ${response.counts.waitingOnDeveloper} waiting on developer; ${response.counts.runningTerminalRuns} running terminals.`;
}

function attentionItems(input: VibeCodexNotificationStatusInput, includeDetails: boolean): readonly VibeCodexNotificationAttentionItem[] {
	const planItem = input.activePlan && input.planAwaitingApproval ? [{
		id: redactSensitiveText(`${input.activePlan.taskId}:r${input.activePlan.revision}`),
		kind: 'plan' as const,
		owner: 'developer' as const,
		status: 'pending' as const,
		title: redactSensitiveText(`Visual plan r${input.activePlan.revision} is ready`),
		blocked: false,
		requestedAt: Date.now(),
		...(includeDetails ? { detail: redactSensitiveText(input.activePlan.summary) } : {}),
	}] : [];
	const approvalItems = input.approvals.map(approval => ({
		id: redactSensitiveText(String(approval.id)),
		kind: approval.kind === 'terminal' || approval.kind === 'file' ? 'approval' as const : 'tool' as const,
		owner: 'developer' as const,
		status: approval.blocked ? 'blocked' as const : 'pending' as const,
		title: redactSensitiveText(approval.title),
		blocked: approval.blocked,
		requestedAt: approval.requestedAt,
		risk: approval.risk,
		...(includeDetails ? { detail: redactSensitiveText(approval.detail ?? approval.description) } : {}),
	}));
	const diffCounts = input.activeDiffReview ? {
		pending: input.activeDiffReview.files.filter(file => file.status === 'pending').length,
		paths: input.activeDiffReview.files.filter(file => file.status === 'pending').map(file => file.path),
	} : undefined;
	const diffItem = input.activeDiffReview && diffCounts && diffCounts.pending > 0 ? [{
		id: redactSensitiveText(input.activeDiffReview.reviewId),
		kind: 'diff' as const,
		owner: 'developer' as const,
		status: 'pending' as const,
		title: redactSensitiveText(`Diff review waiting on ${diffCounts.pending} file${diffCounts.pending === 1 ? '' : 's'}`),
		blocked: false,
		requestedAt: input.activeDiffReview.createdAt,
		...(includeDetails ? { detail: redactSensitiveText(diffCounts.paths.join(', ')) } : {}),
	}] : [];
	const terminalItems = input.terminalRuns
		.filter(run => run.status === 'running')
		.map(run => ({
			id: redactSensitiveText(run.id),
			kind: 'terminal' as const,
			owner: 'runtime' as const,
			status: 'running' as const,
			title: redactSensitiveText(`Terminal running: ${run.commandLine.slice(0, 160)}`),
			blocked: false,
			requestedAt: run.startedAt,
			...(includeDetails ? { detail: terminalNotificationDetail(run, input) } : {}),
		}));
	return [...planItem, ...approvalItems, ...diffItem, ...terminalItems]
		.sort((a, b) => b.requestedAt - a.requestedAt);
}

function terminalNotificationDetail(run: VibeCodexCapturedTerminalRun, input: VibeCodexNotificationStatusInput): string {
	const parts = [
		input.scheduledLongRunningTerminalRunIds.includes(run.id) ? 'long-running notification scheduled' : undefined,
		input.deliveredLongRunningTerminalRunIds.includes(run.id) ? 'long-running notification delivered' : undefined,
	];
	return redactSensitiveText(parts.filter((part): part is string => !!part).join('; ') || 'running');
}

function notificationChannels(config: VibeCodexNotificationConfig, enabled: boolean): readonly string[] {
	const channels = [
		{ id: 'approval_attention', enabled: config.approvals },
		{ id: 'terminal_completion', enabled: config.terminalCompletion },
		{ id: 'long_running_terminal', enabled: config.longRunningTerminalSeconds > 0 },
	];
	return channels.filter(channel => channel.enabled === enabled).map(channel => channel.id);
}

function isWaitingEvent(event: VibeCodexTranscriptEvent): boolean {
	if (event.status !== 'pending' && event.status !== 'blocked' && event.status !== 'running') {
		return false;
	}
	return event.kind === 'plan'
		|| event.kind === 'approval'
		|| event.kind === 'tool'
		|| event.kind === 'terminal'
		|| event.kind === 'diff';
}

function isNotificationStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return notificationStatusToolNames.has(tool);
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
