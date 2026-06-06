/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexTaskBoard, VibeCodexTaskBoardCard, VibeCodexTaskBoardStatus } from './taskBoard';
import { taskBoardCardReadiness } from './taskBoard';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexConnectorScheduleFamily = 'all' | 'connector' | 'scheduled' | 'headless';

export interface VibeCodexConnectorScheduleStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly family: VibeCodexConnectorScheduleFamily;
	readonly includeExamples: boolean;
	readonly includeQueue: boolean;
	readonly includePromptBlock: boolean;
	readonly maxCards: number;
	readonly requestedAt: number;
}

export interface VibeCodexConnectorScheduleChannelGroup {
	readonly id: 'messaging' | 'issueTracker' | 'sourceControl' | 'calendarAutomation' | 'headlessRuntime';
	readonly label: string;
	readonly channels: readonly string[];
}

export interface VibeCodexConnectorScheduleRoute {
	readonly family: Exclude<VibeCodexConnectorScheduleFamily, 'all'>;
	readonly label: string;
	readonly routes: readonly string[];
	readonly aliases: readonly string[];
	readonly payloadKeys: readonly string[];
	readonly startBehavior: string;
	readonly controllerBoundary: string;
}

export interface VibeCodexConnectorScheduleQueuedCard {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexTaskBoardStatus;
	readonly source: 'connector' | 'scheduled' | 'headless';
	readonly mode: string;
	readonly ready: boolean;
	readonly blockers: readonly string[];
	readonly dependsOn: readonly string[];
	readonly parallelThreads: number;
	readonly promptPreview: string;
	readonly evidence: readonly string[];
}

export interface VibeCodexConnectorScheduleStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly enabled: true;
	readonly requestedAt: number;
	readonly updatedAt: number;
	readonly family: VibeCodexConnectorScheduleFamily;
	readonly channelGroups: readonly VibeCodexConnectorScheduleChannelGroup[];
	readonly routes: readonly VibeCodexConnectorScheduleRoute[];
	readonly queue?: {
		readonly total: number;
		readonly connector: number;
		readonly scheduled: number;
		readonly headless: number;
		readonly returnedCards: number;
		readonly readyCardIds: readonly string[];
		readonly runningCardIds: readonly string[];
		readonly blockedCardIds: readonly string[];
		readonly cards: readonly VibeCodexConnectorScheduleQueuedCard[];
	};
	readonly examples?: readonly string[];
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
	readonly nextAction: string;
}

export interface VibeCodexConnectorScheduleStatusInput {
	readonly board?: VibeCodexTaskBoard;
}

const connectorScheduleStatusMethods = new Set([
	'agent/getConnectorStatus',
	'agent/connectorStatus',
	'connector/status',
	'connectors/status',
	'agent/getScheduledAgentStatus',
	'agent/scheduledAgentStatus',
	'scheduled/status',
	'schedule/status',
	'automation/status',
	'headless/status',
	'agent/getExternalChannelStatus',
	'externalChannel/status',
	'vibecodex/connectorScheduleStatus',
]);

const connectorScheduleStatusToolNames = new Set([
	'connector_status',
	'connectors_status',
	'messaging_connector_status',
	'cline_connector_status',
	'external_channel_status',
	'scheduled_agent_status',
	'schedule_status',
	'automation_status',
	'cron_status',
	'headless_agent_status',
	'headless_status',
]);

const payloadKeys = [
	'prompt',
	'task',
	'instructions',
	'description',
	'message',
	'title',
	'mode',
	'source',
	'connector',
	'provider',
	'sourceId',
	'triggerId',
	'eventId',
	'cron',
	'schedule',
	'dependsOn',
	'parallelThreads',
	'start',
	'autoStart',
	'action',
];

const channelGroups: readonly VibeCodexConnectorScheduleChannelGroup[] = [
	{ id: 'messaging', label: 'Messaging connectors', channels: ['Slack', 'Telegram', 'Discord', 'Google Chat', 'WhatsApp', 'Email', 'Webhook'] },
	{ id: 'issueTracker', label: 'Issue and project connectors', channels: ['Linear', 'Jira', 'GitHub Issues', 'GitLab Issues'] },
	{ id: 'sourceControl', label: 'Source-control events', channels: ['GitHub', 'GitLab', 'Pull Request', 'Commit', 'CI webhook'] },
	{ id: 'calendarAutomation', label: 'Scheduled automations', channels: ['Cron', 'Scheduled task', 'Recurring audit', 'Dependency check'] },
	{ id: 'headlessRuntime', label: 'Headless runtimes', channels: ['CLI', 'CI/CD', 'Server job', 'Scripted JSON handoff'] },
];

const routes: readonly VibeCodexConnectorScheduleRoute[] = [
	{
		family: 'connector',
		label: 'Messaging and issue connector intake',
		routes: ['/connector', '/connectors', '/connector/task', '/task?source=slack', '/task?source=linear'],
		aliases: ['slack', 'telegram', 'discord', 'google-chat', 'whatsapp', 'linear', 'jira', 'github', 'gitlab', 'email', 'webhook'],
		payloadKeys,
		startBehavior: 'Queues a visible Task Board card; start=true can open visual Plan Mode only.',
		controllerBoundary: 'The extension does not host chat bots or store connector credentials; connector services must call the URI/JSON-RPC intake contract.',
	},
	{
		family: 'scheduled',
		label: 'Scheduled and cron automation intake',
		routes: ['/scheduled', '/schedule', '/automation', '/automations', '/task?source=cron'],
		aliases: ['schedule', 'scheduled', 'cron', 'automation', 'recurring'],
		payloadKeys,
		startBehavior: 'Queues a scheduled Task Board card that remains read-only until the developer starts planning and approves the rendered plan.',
		controllerBoundary: 'The extension records scheduled intake evidence; durable cron orchestration belongs to the calling scheduler or backend service.',
	},
	{
		family: 'headless',
		label: 'Headless CLI/CI intake',
		routes: ['/headless', '/task', '/queue', '/start', '/plan'],
		aliases: ['headless', 'cli', 'ci', 'server', 'json'],
		payloadKeys,
		startBehavior: 'Queues a Task Board card from a script or headless caller; execution still passes through Plan Mode, approvals, diffs, and verification.',
		controllerBoundary: 'Headless callers can submit tasks, but the extension does not execute hidden terminals or workspace mutation without visible approval evidence.',
	},
];

const examples = [
	'vscode://vibecodex.agent/connector/task?source=slack&eventId=evt-123&prompt=Fix%20failing%20tests&start=true',
	'vscode://vibecodex.agent/connector/task?source=telegram&prompt=Summarize%20open%20PR%20risk',
	'vscode://vibecodex.agent/scheduled?payload={"prompt":"Run dependency audit","cron":"0 9 * * MON-FRI","mode":"review"}',
	'vscode://vibecodex.agent/headless?prompt=Review%20git%20diff&parallelThreads=3',
	'item/tool/call connector_status { "family": "connector", "includeQueue": true }',
];

export function normalizeConnectorScheduleStatusRequest(message: JsonRpcMessage): VibeCodexConnectorScheduleStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	const toolName = toolCallName(message.method, payload, args);
	if (!connectorScheduleStatusMethods.has(message.method) && !toolName) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		family: familyValue(
			stringValue(payload.family)
			?? stringValue(payload.triggerKind)
			?? stringValue(payload.trigger_kind)
			?? stringValue(payload.source)
			?? stringValue(args.family)
			?? stringValue(args.triggerKind)
			?? stringValue(args.trigger_kind)
			?? stringValue(args.source)
			?? toolName
			?? message.method,
		),
		includeExamples: booleanValue(payload.includeExamples)
			?? booleanValue(payload.include_examples)
			?? booleanValue(args.includeExamples)
			?? booleanValue(args.include_examples)
			?? true,
		includeQueue: booleanValue(payload.includeQueue)
			?? booleanValue(payload.include_queue)
			?? booleanValue(args.includeQueue)
			?? booleanValue(args.include_queue)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		maxCards: clampNumber(numberValue(payload.maxCards)
			?? numberValue(payload.max_cards)
			?? numberValue(args.maxCards)
			?? numberValue(args.max_cards)
			?? 8, 0, 30),
		requestedAt: Date.now(),
	};
}

export function createConnectorScheduleStatusResponse(request: VibeCodexConnectorScheduleStatusRequest, input: VibeCodexConnectorScheduleStatusInput = {}): VibeCodexConnectorScheduleStatusResponse {
	const selectedRoutes = request.family === 'all' ? routes : routes.filter(route => route.family === request.family);
	const queue = request.includeQueue && input.board ? queueStatus(input.board, request.family, request.maxCards) : undefined;
	const response: VibeCodexConnectorScheduleStatusResponse = {
		ok: true,
		source: 'externalExtension',
		version: 1,
		enabled: true,
		requestedAt: request.requestedAt,
		updatedAt: input.board?.updatedAt ?? Date.now(),
		family: request.family,
		channelGroups,
		routes: selectedRoutes,
		...(queue ? { queue } : {}),
		...(request.includeExamples ? { examples: examples.map(redactSensitiveText) } : {}),
		guardrails: [
			'Connector/scheduled status is read-only and never connects accounts, stores bot credentials, creates schedules, queues cards, starts tasks, approves plans, runs tools, or mutates files.',
			'Slack, Telegram, Discord, Google Chat, WhatsApp, Linear, Jira, GitHub, GitLab, email, webhook, cron, and headless callers are modeled as intake channels that must surface visible Task Board evidence.',
			'Queued connector, scheduled, and headless cards can only enter visual Plan Mode; writes, terminals, MCP/browser tools, diffs, checkpoints, and worktrees still require exact rendered-plan approval.',
			'Durable connector bots and cron runners belong to the external connector/backend service; the extension exposes the intake contract and redacted queue evidence.',
			'Prompts, payload examples, source ids, event ids, and card evidence are capped and redacted before leaving the extension.',
		],
		message: connectorScheduleStatusMessage(request.family, selectedRoutes.length, queue),
		nextAction: queue && queue.total
			? 'Inspect task_start_status for a ready connector/scheduled/headless card before opening visual Plan Mode.'
			: 'Use connector_status, scheduled_agent_status, or external_intake_status to verify the intake route before submitting a task.',
	};
	return redactSensitiveValue({
		...response,
		...(request.includePromptBlock ? { promptBlock: connectorSchedulePromptBlock(response) } : {}),
	}) as VibeCodexConnectorScheduleStatusResponse;
}

export function connectorScheduleStatusSummary(response: VibeCodexConnectorScheduleStatusResponse): string {
	const queue = response.queue ? ` Queue: ${response.queue.total} card${response.queue.total === 1 ? '' : 's'} (${response.queue.connector} connector, ${response.queue.scheduled} scheduled, ${response.queue.headless} headless).` : '';
	return `${response.message}${queue}`;
}

function queueStatus(board: VibeCodexTaskBoard, family: VibeCodexConnectorScheduleFamily, maxCards: number): NonNullable<VibeCodexConnectorScheduleStatusResponse['queue']> {
	const visible = board.cards.filter(card => card.status !== 'archived' && isSelectedSource(card.source, family));
	const cards = visible.slice(0, maxCards).map(card => queuedCard(board, card));
	const connector = visible.filter(card => card.source === 'connector').length;
	const scheduled = visible.filter(card => card.source === 'scheduled').length;
	const headless = visible.filter(card => card.source === 'headless').length;
	return {
		total: visible.length,
		connector,
		scheduled,
		headless,
		returnedCards: cards.length,
		readyCardIds: visible.filter(card => taskBoardCardReadiness(board, card.id).ready).map(card => card.id),
		runningCardIds: visible.filter(card => card.status === 'running').map(card => card.id),
		blockedCardIds: visible.filter(card => card.status === 'blocked' || taskBoardCardReadiness(board, card.id).blockers.length > 0).map(card => card.id),
		cards,
	};
}

function queuedCard(board: VibeCodexTaskBoard, card: VibeCodexTaskBoardCard): VibeCodexConnectorScheduleQueuedCard {
	const readiness = taskBoardCardReadiness(board, card.id);
	return {
		id: card.id,
		title: redactSensitiveText(card.title),
		status: card.status,
		source: card.source as 'connector' | 'scheduled' | 'headless',
		mode: redactSensitiveText(card.mode),
		ready: readiness.ready,
		blockers: redactSensitiveValue(readiness.blockers) as readonly string[],
		dependsOn: redactSensitiveValue(card.dependsOn) as readonly string[],
		parallelThreads: card.parallelThreads,
		promptPreview: preview(redactSensitiveText(card.prompt), 280),
		evidence: redactSensitiveValue(card.evidence.slice(0, 6)) as readonly string[],
	};
}

function connectorScheduleStatusMessage(family: VibeCodexConnectorScheduleFamily, routeCount: number, queue?: NonNullable<VibeCodexConnectorScheduleStatusResponse['queue']>): string {
	const scope = family === 'all' ? 'connector/scheduled/headless' : family;
	return `${routeCount} ${scope} intake route group${routeCount === 1 ? '' : 's'} available${queue ? `; ${queue.total} matching queued card${queue.total === 1 ? '' : 's'}` : ''}.`;
}

function connectorSchedulePromptBlock(response: VibeCodexConnectorScheduleStatusResponse): string {
	return JSON.stringify({
		tool: 'connector_status',
		status: response.message,
		family: response.family,
		channels: response.channelGroups.map(group => ({ id: group.id, channels: group.channels })),
		routes: response.routes.map(route => ({ family: route.family, aliases: route.aliases, startBehavior: route.startBehavior })),
		queue: response.queue ? {
			total: response.queue.total,
			readyCardIds: response.queue.readyCardIds,
			runningCardIds: response.queue.runningCardIds,
			blockedCardIds: response.queue.blockedCardIds,
		} : undefined,
		guardrails: response.guardrails,
		nextAction: response.nextAction,
	}, null, 2);
}

function isSelectedSource(source: string, family: VibeCodexConnectorScheduleFamily): boolean {
	if (family === 'all') {
		return source === 'connector' || source === 'scheduled' || source === 'headless';
	}
	return source === family;
}

function familyValue(value: string | undefined): VibeCodexConnectorScheduleFamily {
	const normalized = (value ?? '').trim().toLowerCase().replace(/[_\s-]+/g, '_');
	if (/schedule|scheduled|cron|automation/.test(normalized)) {
		return 'scheduled';
	}
	if (/headless|cli|ci|server|json/.test(normalized)) {
		return 'headless';
	}
	if (/connector|connectors|channel|slack|telegram|discord|google|whatsapp|linear|jira|github|gitlab|email|webhook/.test(normalized)) {
		return 'connector';
	}
	return 'all';
}

function toolCallName(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): string | undefined {
	if (method !== 'item/tool/call') {
		return undefined;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return connectorScheduleStatusToolNames.has(tool) ? tool : undefined;
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function preview(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max).trimEnd()}...` : value;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim().length) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
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
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
