/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexTaskBoard, VibeCodexTaskBoardCard, VibeCodexTaskBoardSource, VibeCodexTaskBoardStatus, taskBoardCardReadiness } from './taskBoard';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexTaskStartRoute = 'start_visual_plan' | 'choose_card' | 'complete_dependencies' | 'already_running' | 'already_completed' | 'archived' | 'blocked' | 'not_found' | 'empty_board';

export interface VibeCodexTaskStartStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly cardId?: string;
	readonly includePromptBlock: boolean;
	readonly includeEvidence: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexTaskStartCardSummary {
	readonly id: string;
	readonly title: string;
	readonly mode: string;
	readonly status: VibeCodexTaskBoardStatus;
	readonly source: VibeCodexTaskBoardSource;
	readonly dependsOn: readonly string[];
	readonly parallelThreads: number;
	readonly promptPreview: string;
	readonly evidence?: readonly string[];
}

export interface VibeCodexTaskStartVisualPlanSeed {
	readonly type: 'vibecodex.taskBoardVisualPlanSeed';
	readonly cardId: string;
	readonly taskId: string;
	readonly summary: string;
	readonly mode: string;
	readonly source: VibeCodexTaskBoardSource;
	readonly prompt: string;
	readonly dependsOn: readonly string[];
	readonly parallelThreads: number;
	readonly requiredPlanSteps: readonly string[];
	readonly acceptanceCriteria: readonly string[];
	readonly evidence?: readonly string[];
	readonly handoffPrompt: string;
}

export interface VibeCodexTaskStartReadiness {
	readonly route: VibeCodexTaskStartRoute;
	readonly startAllowed: boolean;
	readonly beginsPlanOnly: true;
	readonly requiresVisualPlanApproval: true;
	readonly mutationLocked: true;
	readonly blockers: readonly string[];
	readonly nextAction: string;
}

export interface VibeCodexTaskStartStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly method: string;
	readonly requestedAt: number;
	readonly updatedAt: number;
	readonly counts: Record<VibeCodexTaskBoardStatus, number>;
	readonly selectedCard?: VibeCodexTaskStartCardSummary;
	readonly nextReadyCard?: VibeCodexTaskStartCardSummary;
	readonly readiness: VibeCodexTaskStartReadiness;
	readonly visualPlanSeed?: VibeCodexTaskStartVisualPlanSeed;
	readonly planningHandoff?: {
		readonly command: 'startTaskBoardCard';
		readonly cardId: string;
		readonly mode: string;
		readonly parallelThreads: number;
		readonly source: VibeCodexTaskBoardSource;
		readonly visualPlanSeedAvailable: boolean;
	};
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexTaskStartStatusInput {
	readonly board: VibeCodexTaskBoard;
}

const taskStartStatusMethods = new Set([
	'agent/getTaskStartStatus',
	'agent/taskStartStatus',
	'agent/getTaskBoardStartStatus',
	'task/startStatus',
	'task/start/status',
	'taskBoard/startStatus',
	'task_board/startStatus',
	'vibecodex/taskStartStatus',
]);

const taskStartStatusToolNames = new Set([
	'task_start_status',
	'task_board_start_status',
	'start_task_status',
	'start_card_status',
	'plan_start_status',
]);

const promptPreviewLimit = 360;

export function normalizeTaskStartStatusRequest(message: JsonRpcMessage): VibeCodexTaskStartStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!taskStartStatusMethods.has(message.method) && !isTaskStartStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const cardId = stringValue(payload.cardId)
		?? stringValue(payload.card_id)
		?? stringValue(args.cardId)
		?? stringValue(args.card_id)
		?? stringValue(args.taskId)
		?? stringValue(args.task_id);
	return {
		id: message.id,
		method: message.method,
		...(cardId ? { cardId } : {}),
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createTaskStartStatusResponse(request: VibeCodexTaskStartStatusRequest, input: VibeCodexTaskStartStatusInput): VibeCodexTaskStartStatusResponse {
	const visibleCards = input.board.cards.filter(card => card.status !== 'archived');
	const counts = visibleCards.reduce<Record<VibeCodexTaskBoardStatus, number>>((result, card) => {
		result[card.status]++;
		return result;
	}, { queued: 0, ready: 0, running: 0, completed: 0, blocked: 0, archived: 0 });
	const selected = request.cardId
		? input.board.cards.find(card => card.id === request.cardId)
		: visibleCards.find(card => taskBoardCardReadiness(input.board, card.id).ready && card.status === 'ready')
			?? visibleCards.find(card => taskBoardCardReadiness(input.board, card.id).ready && card.status === 'queued');
	const nextReady = visibleCards.find(card => taskBoardCardReadiness(input.board, card.id).ready && (card.status === 'ready' || card.status === 'queued'));
	const readiness = createReadiness(input.board, request, selected, visibleCards.length);
	const selectedCard = selected ? cardSummary(selected, request.includeEvidence) : undefined;
	const nextReadyCard = nextReady ? cardSummary(nextReady, false) : undefined;
	const visualPlanSeed = selected && request.includePromptBlock ? createVisualPlanSeed(selected, request.includeEvidence) : undefined;
	const promptBlock = request.includePromptBlock ? createPromptBlock(input.board, selected, readiness, request.includeEvidence) : undefined;
	const response: VibeCodexTaskStartStatusResponse = {
		ok: readiness.startAllowed || readiness.route !== 'not_found',
		source: 'externalExtension',
		method: request.method,
		requestedAt: request.requestedAt,
		updatedAt: input.board.updatedAt,
		counts,
		...(selectedCard ? { selectedCard } : {}),
		...(nextReadyCard ? { nextReadyCard } : {}),
		...(visualPlanSeed ? { visualPlanSeed } : {}),
		readiness,
		...(readiness.startAllowed && selected ? {
			planningHandoff: {
				command: 'startTaskBoardCard',
				cardId: selected.id,
				mode: selected.mode,
				parallelThreads: selected.parallelThreads,
				source: selected.source,
				visualPlanSeedAvailable: !!visualPlanSeed,
			},
		} : {}),
		...(promptBlock ? { promptBlock } : {}),
		guardrails: [
			'Task start status is read-only and never starts cards, submits prompts, approves plans, runs terminal commands, prepares worktrees, accepts diffs, completes tasks, archives cards, or mutates files.',
			'Starting a Task Board card only begins the visual planning phase; file edits, terminals, MCP/browser tools, checkpoints, parallel worktrees, and diff acceptance remain locked until exact plan approval.',
			'Delegated, URI, connector, scheduled, and headless cards keep their intake-only source metadata and must be surfaced to the developer before execution.',
			'Prompt and evidence context is capped and redacted before leaving the extension.',
			'Parallel thread counts are already clamped to 8 and this status response never materializes worktrees.',
		],
		message: createMessage(readiness, selectedCard, nextReadyCard),
	};
	return redactSensitiveValue(response) as VibeCodexTaskStartStatusResponse;
}

export function taskStartStatusSummary(response: VibeCodexTaskStartStatusResponse): string {
	return response.message;
}

function createReadiness(board: VibeCodexTaskBoard, request: VibeCodexTaskStartStatusRequest, card: VibeCodexTaskBoardCard | undefined, visibleCount: number): VibeCodexTaskStartReadiness {
	if (!visibleCount) {
		return readiness('empty_board', false, ['Task Board has no visible cards.'], 'Queue a task before requesting start readiness.');
	}
	if (!card) {
		return request.cardId
			? readiness('not_found', false, [`Task Board card ${request.cardId} was not found.`], 'Request task_board_status or omit cardId to discover the next ready card.')
			: readiness('choose_card', false, ['No ready Task Board card is available.'], 'Complete dependencies or choose a specific queued card to inspect blockers.');
	}
	if (card.status === 'archived') {
		return readiness('archived', false, ['Archived cards cannot be started.'], 'Restore or queue a new task card before planning.');
	}
	if (card.status === 'running') {
		return readiness('already_running', false, ['Task Board card is already running.'], 'Continue the active visual planning session for this card.');
	}
	if (card.status === 'completed') {
		return readiness('already_completed', false, ['Completed cards cannot be started again.'], 'Queue a follow-up task if more work is required.');
	}
	if (card.status === 'blocked') {
		return readiness('blocked', false, ['Task Board card is marked blocked.'], 'Unblock the card or queue a dependent remediation task before planning.');
	}
	const dependencyReadiness = taskBoardCardReadiness(board, card.id);
	if (!dependencyReadiness.ready) {
		return readiness('complete_dependencies', false, dependencyReadiness.blockers.length ? dependencyReadiness.blockers : ['Dependencies are not complete.'], 'Complete dependency cards before starting visual Plan Mode.');
	}
	return readiness('start_visual_plan', true, [], 'Start the card in visual Plan Mode; mutation remains locked until the rendered plan revision is approved.');
}

function readiness(route: VibeCodexTaskStartRoute, startAllowed: boolean, blockers: readonly string[], nextAction: string): VibeCodexTaskStartReadiness {
	return {
		route,
		startAllowed,
		beginsPlanOnly: true,
		requiresVisualPlanApproval: true,
		mutationLocked: true,
		blockers: redactSensitiveValue(blockers) as readonly string[],
		nextAction: redactSensitiveText(nextAction),
	};
}

function cardSummary(card: VibeCodexTaskBoardCard, includeEvidence: boolean): VibeCodexTaskStartCardSummary {
	return {
		id: card.id,
		title: redactSensitiveText(card.title),
		mode: card.mode,
		status: card.status,
		source: card.source,
		dependsOn: redactSensitiveValue(card.dependsOn) as readonly string[],
		parallelThreads: card.parallelThreads,
		promptPreview: preview(redactSensitiveText(card.prompt)),
		...(includeEvidence ? { evidence: redactSensitiveValue(card.evidence.slice(0, 8)) as readonly string[] } : {}),
	};
}

function createVisualPlanSeed(card: VibeCodexTaskBoardCard, includeEvidence: boolean): VibeCodexTaskStartVisualPlanSeed {
	const prompt = capText(redactSensitiveText(card.prompt), 6000);
	const requiredPlanSteps = [
		`Review Task Board card ${card.id}, dependency state, and source metadata before planning.`,
		'Create a VibeCodexPlan with strategy, safe Mermaid flowchart, linked checklist steps, risks, and acceptance criteria before mutation.',
		card.parallelThreads > 1
			? `Decide how to use up to ${card.parallelThreads} isolated parallel agent lane${card.parallelThreads === 1 ? '' : 's'} and keep worktrees review-gated.`
			: 'Keep execution single-lane unless the approved visual plan explicitly adds parallel work.',
		'Define verification commands, diagnostics checks, diff review, and rollback evidence before switching to Act or Agent mode.',
	];
	const acceptanceCriteria = [
		'Developer approves the exact visual plan revision for this Task Board card before any workspace mutation.',
		'All file changes are proposed through review-first diffs with checkpoint rollback coverage.',
		'Required verification checks pass or are recorded as blocked with evidence before task completion.',
		card.parallelThreads > 1
			? 'Parallel lane results are compared by the reviewer/judge flow before merge-back.'
			: 'Single-lane execution records terminal and diff evidence before completion.',
	];
	const seedWithoutPrompt = {
		type: 'vibecodex.taskBoardVisualPlanSeed' as const,
		cardId: card.id,
		taskId: `task-board-${card.id}`,
		summary: redactSensitiveText(card.title),
		mode: card.mode,
		source: card.source,
		dependsOn: redactSensitiveValue(card.dependsOn) as readonly string[],
		parallelThreads: card.parallelThreads,
		requiredPlanSteps: requiredPlanSteps.map(redactSensitiveText),
		acceptanceCriteria: acceptanceCriteria.map(redactSensitiveText),
		...(includeEvidence ? { evidence: redactSensitiveValue(card.evidence.slice(0, 8)) as readonly string[] } : {}),
	};
	const handoffPrompt = [
		`Task Board visual plan seed for ${seedWithoutPrompt.cardId}: ${seedWithoutPrompt.summary}`,
		`Mode: ${seedWithoutPrompt.mode}`,
		`Source: ${seedWithoutPrompt.source}`,
		`Parallel threads: ${seedWithoutPrompt.parallelThreads}`,
		seedWithoutPrompt.dependsOn.length ? `Depends on: ${seedWithoutPrompt.dependsOn.join(', ')}` : undefined,
		'',
		'Prompt:',
		prompt,
		'',
		'Required planning steps:',
		...seedWithoutPrompt.requiredPlanSteps.map(item => `- ${item}`),
		'',
		'Acceptance criteria:',
		...seedWithoutPrompt.acceptanceCriteria.map(item => `- ${item}`),
	].filter((value): value is string => value !== undefined).join('\n');
	return redactSensitiveValue({
		...seedWithoutPrompt,
		prompt,
		handoffPrompt,
	}) as VibeCodexTaskStartVisualPlanSeed;
}

function createPromptBlock(board: VibeCodexTaskBoard, card: VibeCodexTaskBoardCard | undefined, readiness: VibeCodexTaskStartReadiness, includeEvidence: boolean): string {
	const visualPlanSeed = card ? createVisualPlanSeed(card, includeEvidence) : undefined;
	return JSON.stringify(redactSensitiveValue({
		type: 'vibecodex.taskStartStatus',
		cardId: card?.id,
		title: card?.title,
		mode: card?.mode,
		source: card?.source,
		status: card?.status,
		parallelThreads: card?.parallelThreads,
		dependsOn: card?.dependsOn,
		ready: readiness.startAllowed,
		route: readiness.route,
		blockers: readiness.blockers,
		nextAction: readiness.nextAction,
		prompt: card?.prompt,
		visualPlanSeed,
		boardVisibleCards: board.cards.filter(candidate => candidate.status !== 'archived').length,
		note: 'This is a read-only start-readiness snapshot. visualPlanSeed can initialize Plan Mode, but backend must wait for a user start action and then agent/approvePlan before mutation.',
	}), null, 2);
}

function createMessage(readiness: VibeCodexTaskStartReadiness, selectedCard: VibeCodexTaskStartCardSummary | undefined, nextReadyCard: VibeCodexTaskStartCardSummary | undefined): string {
	if (readiness.startAllowed && selectedCard) {
		return `Task Board card ${selectedCard.id} can start visual Plan Mode with ${selectedCard.parallelThreads} lane${selectedCard.parallelThreads === 1 ? '' : 's'}.`;
	}
	if (selectedCard) {
		return `Task Board card ${selectedCard.id} cannot start: ${readiness.nextAction}`;
	}
	if (nextReadyCard) {
		return `Task Board card ${nextReadyCard.id} is the next ready card.`;
	}
	return readiness.nextAction;
}

function preview(value: string): string {
	return value.length > promptPreviewLimit ? `${value.slice(0, promptPreviewLimit).trimEnd()}...` : value;
}

function capText(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max).trimEnd()}\n[truncated]` : value;
}

function isTaskStartStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return taskStartStatusToolNames.has(tool);
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
	return typeof value === 'string' && value.trim().length ? redactSensitiveText(value.trim()) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
