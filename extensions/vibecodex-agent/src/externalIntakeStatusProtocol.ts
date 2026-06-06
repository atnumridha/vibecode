/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexTaskBoard, VibeCodexTaskBoardSource, VibeCodexTaskBoardStatus } from './taskBoard';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexExternalIntakeTrigger = 'uri' | 'connector' | 'scheduled' | 'headless' | 'delegated';

export interface VibeCodexExternalIntakeStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly triggerKind?: VibeCodexExternalIntakeTrigger;
	readonly includeExamples: boolean;
	readonly includeQueueCounts: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexExternalIntakeRoute {
	readonly triggerKind: VibeCodexExternalIntakeTrigger;
	readonly label: string;
	readonly routes: readonly string[];
	readonly aliases: readonly string[];
	readonly startBehavior: string;
}

export interface VibeCodexExternalIntakeStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly enabled: true;
	readonly requestedAt: number;
	readonly updatedAt: number;
	readonly triggers: readonly VibeCodexExternalIntakeRoute[];
	readonly entrypoints: {
		readonly uriSchemes: readonly string[];
		readonly authorities: readonly string[];
		readonly routes: readonly string[];
		readonly jsonPayloadKeys: readonly string[];
		readonly queryKeys: readonly string[];
	};
	readonly limits: {
		readonly promptRequired: true;
		readonly minParallelThreads: 1;
		readonly maxParallelThreads: 8;
		readonly defaultMode: 'agent';
		readonly startRequestBeginsPlanOnly: true;
	};
	readonly queue?: {
		readonly counts: Record<VibeCodexTaskBoardStatus, number>;
		readonly sourceCounts: Record<VibeCodexTaskBoardSource, number>;
		readonly intake: {
			readonly total: number;
			readonly external: number;
			readonly delegated: number;
			readonly uri: number;
			readonly connector: number;
			readonly scheduled: number;
			readonly headless: number;
		};
		readonly readyCardIds: readonly string[];
		readonly runningCardIds: readonly string[];
		readonly blockedCardIds: readonly string[];
	};
	readonly examples?: readonly string[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexExternalIntakeStatusInput {
	readonly board?: VibeCodexTaskBoard;
}

const externalIntakeStatusMethods = new Set([
	'agent/getExternalIntakeStatus',
	'agent/externalIntakeStatus',
	'externalIntake/status',
	'external/intakeStatus',
	'intake/status',
	'connector/status',
	'headless/status',
	'scheduled/status',
	'vibecodex/externalIntakeStatus',
]);

const externalIntakeStatusToolNames = new Set([
	'external_intake_status',
	'intake_capability_status',
	'connector_intake_status',
	'scheduled_intake_status',
	'headless_intake_status',
	'uri_intake_status',
]);

const routes: readonly VibeCodexExternalIntakeRoute[] = [
	{
		triggerKind: 'uri',
		label: 'Generic URI intake',
		routes: ['/task', '/tasks', '/queue', '/start', '/plan'],
		aliases: ['uri', 'vscode-uri'],
		startBehavior: 'Queues a Task Board card; start=true or /start opens the visual planning phase only.',
	},
	{
		triggerKind: 'connector',
		label: 'Connector intake',
		routes: ['/connector', '/connectors', '/connector/task'],
		aliases: ['slack', 'telegram', 'discord', 'google-chat', 'whatsapp', 'jira', 'linear', 'github', 'gitlab', 'email', 'webhook'],
		startBehavior: 'Connector tasks are queued with source metadata and remain blocked from mutation until a developer approves the rendered visual plan.',
	},
	{
		triggerKind: 'scheduled',
		label: 'Scheduled automation intake',
		routes: ['/scheduled', '/schedule', '/automation', '/automations'],
		aliases: ['schedule', 'cron', 'automation'],
		startBehavior: 'Scheduled tasks can request planning, but execution still requires the normal visual plan approval gate.',
	},
	{
		triggerKind: 'headless',
		label: 'Headless/CLI intake',
		routes: ['/headless', '/task', '/queue'],
		aliases: ['headless', 'cli', 'server'],
		startBehavior: 'Headless tasks are intake-only in the extension and cannot run tools until surfaced to the developer.',
	},
	{
		triggerKind: 'delegated',
		label: 'Delegated subtask intake',
		routes: ['new_task', 'delegate_task', 'agent/newTask', 'agent/delegateTask'],
		aliases: ['new_task', 'delegate_task'],
		startBehavior: 'Delegated subtasks only queue dependent Task Board cards; they do not start execution.',
	},
];

const allRoutes = ['/task', '/tasks', '/queue', '/start', '/plan', '/headless', '/scheduled', '/schedule', '/automation', '/automations', '/connector', '/connectors'];
const payloadKeys = ['prompt', 'task', 'instructions', 'description', 'message', 'title', 'name', 'mode', 'triggerKind', 'trigger', 'type', 'source', 'connector', 'provider', 'sourceId', 'source_id', 'triggerId', 'trigger_id', 'eventId', 'event_id', 'dependsOn', 'depends_on', 'parallelThreads', 'parallel_threads', 'start', 'autoStart', 'auto_start', 'action'];
const examples = [
	'vscode://vibecodex.agent/task?prompt=Review%20auth&mode=plan',
	'vscode://vibecodex.agent/connector/task?source=slack&eventId=evt-123&prompt=Fix%20failing%20tests&start=true',
	'vscode://vibecodex.agent/scheduled?payload={"prompt":"Run dependency audit","mode":"review","parallelThreads":3}',
	'item/tool/call new_task { "prompt": "Document the approved migration", "depends_on": ["task-a"] }',
];

export function normalizeExternalIntakeStatusRequest(message: JsonRpcMessage): VibeCodexExternalIntakeStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!externalIntakeStatusMethods.has(message.method) && !isExternalIntakeStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const triggerKind = triggerValue(stringValue(payload.triggerKind)
		?? stringValue(payload.trigger_kind)
		?? stringValue(payload.source)
		?? stringValue(args.triggerKind)
		?? stringValue(args.trigger_kind)
		?? stringValue(args.source));
	return {
		id: message.id,
		method: message.method,
		...(triggerKind ? { triggerKind } : {}),
		includeExamples: booleanValue(payload.includeExamples)
			?? booleanValue(payload.include_examples)
			?? booleanValue(args.includeExamples)
			?? booleanValue(args.include_examples)
			?? true,
		includeQueueCounts: booleanValue(payload.includeQueueCounts)
			?? booleanValue(payload.include_queue_counts)
			?? booleanValue(args.includeQueueCounts)
			?? booleanValue(args.include_queue_counts)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createExternalIntakeStatusResponse(request: VibeCodexExternalIntakeStatusRequest, input: VibeCodexExternalIntakeStatusInput = {}): VibeCodexExternalIntakeStatusResponse {
	const selectedRoutes = request.triggerKind ? routes.filter(route => route.triggerKind === request.triggerKind) : routes;
	const queue = request.includeQueueCounts && input.board ? queueStatus(input.board) : undefined;
	const response: VibeCodexExternalIntakeStatusResponse = {
		ok: true,
		source: 'externalExtension',
		version: 1,
		enabled: true,
		requestedAt: request.requestedAt,
		updatedAt: input.board?.updatedAt ?? Date.now(),
		triggers: selectedRoutes,
		entrypoints: {
			uriSchemes: ['vscode'],
			authorities: ['vibecodex.agent', 'vibecodex', 'openai-codex'],
			routes: allRoutes,
			jsonPayloadKeys: payloadKeys,
			queryKeys: payloadKeys,
		},
		limits: {
			promptRequired: true,
			minParallelThreads: 1,
			maxParallelThreads: 8,
			defaultMode: 'agent',
			startRequestBeginsPlanOnly: true,
		},
		...(queue ? { queue } : {}),
		...(request.includeExamples ? { examples: examples.map(redactSensitiveText) } : {}),
		guardrails: [
			'External intake status is read-only and never queues, starts, completes, blocks, archives, deletes, or mutates Task Board cards.',
			'Connector, scheduled, headless, URI, and delegated requests are intake-only until surfaced in the UI and approved through the exact rendered visual plan revision.',
			'start=true, /start, or /plan can only begin the planning phase; it never approves terminal commands, file edits, MCP/browser tools, diffs, checkpoints, or parallel worktrees.',
			'Prompts, payloads, source ids, route examples, and queue metadata are capped and redacted before leaving the extension.',
			'Parallel thread requests are clamped to 8 and this status response never prepares worktrees.',
		],
		message: `${selectedRoutes.length} external intake route group${selectedRoutes.length === 1 ? '' : 's'} available${queue ? `; ${queue.intake.external} external and ${queue.intake.delegated} delegated card${queue.intake.total === 1 ? '' : 's'} currently queued` : ''}.`,
	};
	return redactSensitiveValue(response) as VibeCodexExternalIntakeStatusResponse;
}

export function externalIntakeStatusSummary(response: VibeCodexExternalIntakeStatusResponse): string {
	const queue = response.queue ? ` Queue: ${response.queue.intake.external} external, ${response.queue.intake.delegated} delegated, ${response.queue.readyCardIds.length} ready.` : '';
	return `${response.message}${queue}`;
}

function queueStatus(board: VibeCodexTaskBoard): NonNullable<VibeCodexExternalIntakeStatusResponse['queue']> {
	const visibleCards = board.cards.filter(card => card.status !== 'archived');
	const counts = visibleCards.reduce<Record<VibeCodexTaskBoardStatus, number>>((result, card) => {
		result[card.status]++;
		return result;
	}, { queued: 0, ready: 0, running: 0, completed: 0, blocked: 0, archived: 0 });
	const sourceCounts = visibleCards.reduce<Record<VibeCodexTaskBoardSource, number>>((result, card) => {
		result[card.source]++;
		return result;
	}, emptySourceCounts());
	return {
		counts,
		sourceCounts,
		intake: {
			total: sourceCounts.uri + sourceCounts.connector + sourceCounts.scheduled + sourceCounts.headless + sourceCounts.delegated,
			external: sourceCounts.uri + sourceCounts.connector + sourceCounts.scheduled + sourceCounts.headless,
			delegated: sourceCounts.delegated,
			uri: sourceCounts.uri,
			connector: sourceCounts.connector,
			scheduled: sourceCounts.scheduled,
			headless: sourceCounts.headless,
		},
		readyCardIds: visibleCards.filter(card => card.status === 'ready').map(card => card.id),
		runningCardIds: visibleCards.filter(card => card.status === 'running').map(card => card.id),
		blockedCardIds: visibleCards.filter(card => card.status === 'blocked').map(card => card.id),
	};
}

function emptySourceCounts(): Record<VibeCodexTaskBoardSource, number> {
	return {
		sidebar: 0,
		inline: 0,
		uri: 0,
		connector: 0,
		scheduled: 0,
		headless: 0,
		restored: 0,
		delegated: 0,
	};
}

function isExternalIntakeStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return externalIntakeStatusToolNames.has(tool);
}

function triggerValue(value: string | undefined): VibeCodexExternalIntakeTrigger | undefined {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) {
		return undefined;
	}
	if (/schedule|cron|automation/.test(normalized)) {
		return 'scheduled';
	}
	if (/headless|cli|server/.test(normalized)) {
		return 'headless';
	}
	if (/connector|slack|telegram|discord|google|whatsapp|jira|linear|github|gitlab|email|webhook/.test(normalized)) {
		return 'connector';
	}
	if (/delegate|new_task/.test(normalized)) {
		return 'delegated';
	}
	if (/uri|vscode/.test(normalized)) {
		return 'uri';
	}
	return undefined;
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

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
