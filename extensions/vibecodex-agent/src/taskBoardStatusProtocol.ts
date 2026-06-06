/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexTaskBoard, VibeCodexTaskBoardCard, VibeCodexTaskBoardSource, VibeCodexTaskBoardStatus, taskBoardCardReadiness, taskBoardSummary } from './taskBoard';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexTaskBoardStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly cardId?: string;
	readonly includeArchived: boolean;
	readonly includePrompts: boolean;
	readonly includeEvidence: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexTaskBoardCardStatus {
	readonly id: string;
	readonly title: string;
	readonly mode: string;
	readonly status: VibeCodexTaskBoardStatus;
	readonly source: VibeCodexTaskBoardCard['source'];
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly dependsOn: readonly string[];
	readonly parallelThreads: number;
	readonly branchName?: string;
	readonly worktreePath?: string;
	readonly ready: boolean;
	readonly blockers: readonly string[];
	readonly promptPreview: string;
	readonly prompt?: string;
	readonly evidence?: readonly string[];
}

export interface VibeCodexTaskBoardStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly updatedAt: number;
	readonly summary: string;
	readonly counts: Record<VibeCodexTaskBoardStatus, number>;
	readonly sourceCounts: Record<VibeCodexTaskBoardSource, number>;
	readonly intake: {
		readonly total: number;
		readonly external: number;
		readonly delegated: number;
		readonly headless: number;
		readonly scheduled: number;
		readonly connector: number;
	};
	readonly readyCardIds: readonly string[];
	readonly runningCardIds: readonly string[];
	readonly blockedCardIds: readonly string[];
	readonly cards: readonly VibeCodexTaskBoardCardStatus[];
	readonly selectedCard?: VibeCodexTaskBoardCardStatus;
	readonly nextReadyCard?: VibeCodexTaskBoardCardStatus;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexTaskBoardStatusInput {
	readonly board: VibeCodexTaskBoard;
}

const taskBoardStatusMethods = new Set([
	'agent/getTaskBoardStatus',
	'agent/taskBoardStatus',
	'agent/getTaskIntakeStatus',
	'agent/taskIntakeStatus',
	'taskBoard/status',
	'task_board/status',
	'task/intakeStatus',
	'task_intake/status',
	'vibecodex/taskBoardStatus',
]);

const taskBoardStatusToolNames = new Set([
	'task_board_status',
	'task_intake_status',
	'external_task_status',
	'headless_task_status',
	'get_task_board',
	'get_task_board_status',
	'get_task_intake_status',
	'list_tasks',
]);

const promptPreviewLimit = 360;
const maxEvidenceItems = 8;

export function normalizeTaskBoardStatusRequest(message: JsonRpcMessage): VibeCodexTaskBoardStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!taskBoardStatusMethods.has(message.method) && !isTaskBoardStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const cardId = stringValue(payload.cardId)
		?? stringValue(payload.card_id)
		?? stringValue(args.cardId)
		?? stringValue(args.card_id);
	return {
		id: message.id,
		method: message.method,
		...(cardId ? { cardId } : {}),
		includeArchived: booleanValue(payload.includeArchived)
			?? booleanValue(payload.include_archived)
			?? booleanValue(args.includeArchived)
			?? booleanValue(args.include_archived)
			?? false,
		includePrompts: booleanValue(payload.includePrompts)
			?? booleanValue(payload.include_prompts)
			?? booleanValue(args.includePrompts)
			?? booleanValue(args.include_prompts)
			?? false,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createTaskBoardStatusResponse(request: VibeCodexTaskBoardStatusRequest, input: VibeCodexTaskBoardStatusInput): VibeCodexTaskBoardStatusResponse {
	const visibleCards = input.board.cards.filter(card => request.includeArchived || card.status !== 'archived');
	const cards = visibleCards.map(card => cardStatus(input.board, card, request));
	const selectedCard = request.cardId ? cards.find(card => card.id === request.cardId) : undefined;
	const counts = visibleCards.reduce<Record<VibeCodexTaskBoardStatus, number>>((result, card) => {
		result[card.status]++;
		return result;
	}, { queued: 0, ready: 0, running: 0, completed: 0, blocked: 0, archived: 0 });
	const sourceCounts = visibleCards.reduce<Record<VibeCodexTaskBoardSource, number>>((result, card) => {
		result[card.source]++;
		return result;
	}, emptySourceCounts());
	const readyCards = cards.filter(card => card.ready && card.status === 'ready');
	const runningCards = cards.filter(card => card.status === 'running');
	const blockedCards = cards.filter(card => card.status === 'blocked' || card.blockers.length > 0);
	const ok = !request.cardId || !!selectedCard;
	return {
		ok,
		source: 'externalExtension',
		version: input.board.version,
		updatedAt: input.board.updatedAt,
		summary: redactSensitiveText(taskBoardSummary(input.board)),
		counts,
		sourceCounts,
		intake: intakeCounts(sourceCounts),
		readyCardIds: readyCards.map(card => card.id),
		runningCardIds: runningCards.map(card => card.id),
		blockedCardIds: blockedCards.map(card => card.id),
		cards,
		...(selectedCard ? { selectedCard } : {}),
		...(readyCards[0] ? { nextReadyCard: readyCards[0] } : {}),
		guardrails: [
			'Task Board status is read-only and never creates, starts, completes, blocks, archives, or deletes Task Board cards.',
			'Connector, scheduled, headless, URI, and delegated cards are intake-only until a developer starts the card and approves the exact visual plan revision.',
			'Prompts and evidence are omitted unless explicitly requested and are always capped and redacted.',
			'Parallel thread requests remain clamped to 8 and do not prepare worktrees from this status response.',
		],
		message: ok
			? `${cards.length} Task Board card${cards.length === 1 ? '' : 's'} returned; ${intakeCounts(sourceCounts).external} external intake card${intakeCounts(sourceCounts).external === 1 ? '' : 's'}.`
			: `Task Board card ${request.cardId} was not found.`,
	};
}

export function taskBoardStatusSummary(response: VibeCodexTaskBoardStatusResponse): string {
	return response.ok
		? `${response.message} ${response.counts.ready} ready, ${response.counts.queued} queued, ${response.counts.running} running, ${response.counts.blocked} blocked. Intake: ${response.intake.external} external, ${response.intake.delegated} delegated.`
		: response.message;
}

function cardStatus(board: VibeCodexTaskBoard, card: VibeCodexTaskBoardCard, request: VibeCodexTaskBoardStatusRequest): VibeCodexTaskBoardCardStatus {
	const readiness = taskBoardCardReadiness(board, card.id);
	const prompt = redactSensitiveText(card.prompt);
	return {
		id: card.id,
		title: redactSensitiveText(card.title),
		mode: card.mode,
		status: card.status,
		source: card.source,
		createdAt: card.createdAt,
		updatedAt: card.updatedAt,
		dependsOn: redactSensitiveValue(card.dependsOn) as readonly string[],
		parallelThreads: card.parallelThreads,
		...(card.branchName ? { branchName: redactSensitiveText(card.branchName) } : {}),
		...(card.worktreePath ? { worktreePath: redactSensitiveText(card.worktreePath) } : {}),
		ready: readiness.ready,
		blockers: redactSensitiveValue(readiness.blockers) as readonly string[],
		promptPreview: preview(prompt),
		...(request.includePrompts ? { prompt } : {}),
		...(request.includeEvidence ? { evidence: redactSensitiveValue(card.evidence.slice(0, maxEvidenceItems)) as readonly string[] } : {}),
	};
}

function preview(value: string): string {
	return value.length > promptPreviewLimit ? `${value.slice(0, promptPreviewLimit).trimEnd()}...` : value;
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

function intakeCounts(sourceCounts: Record<VibeCodexTaskBoardSource, number>): VibeCodexTaskBoardStatusResponse['intake'] {
	const external = sourceCounts.uri + sourceCounts.connector + sourceCounts.scheduled + sourceCounts.headless;
	return {
		total: external + sourceCounts.delegated,
		external,
		delegated: sourceCounts.delegated,
		headless: sourceCounts.headless,
		scheduled: sourceCounts.scheduled,
		connector: sourceCounts.connector,
	};
}

function isTaskBoardStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return taskBoardStatusToolNames.has(tool);
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
