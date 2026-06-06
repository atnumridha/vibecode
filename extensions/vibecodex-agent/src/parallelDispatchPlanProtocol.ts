/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { authorizationMatchesPlan, executionAuthorizationSummary, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { VibeCodexModePolicy } from './modePolicy';
import { modeAllowsAction } from './modePolicy';
import type { VibeCodexParallelPlan, VibeCodexParallelThread } from './multiAgent';
import type { VibeCodexParallelResult, VibeCodexParallelReview } from './parallelReview';
import type { VibeCodexPlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexParallelDispatchPlanRequest {
	readonly id: string | number;
	readonly method: string;
	readonly taskId?: string;
	readonly includeLanes: boolean;
	readonly includePromptBlock: boolean;
	readonly maxLanes: number;
	readonly requestedAt: number;
}

export type VibeCodexParallelDispatchRoute =
	| 'wait_for_parallel_plan'
	| 'repair_request'
	| 'single_lane_execution'
	| 'approve_plan'
	| 'switch_mode'
	| 'prepare_worktrees'
	| 'dispatch_ready'
	| 'wait_for_results'
	| 'review_results'
	| 'blocked';

export interface VibeCodexParallelDispatchRequestPayload {
	readonly method: 'agent/dispatchParallelLane';
	readonly taskId: string;
	readonly threadId: string;
	readonly worktreePath: string;
	readonly branchName: string;
	readonly promptFocus: string;
	readonly expectedResultMethod: 'agent/parallelResult';
}

export interface VibeCodexParallelDispatchLane {
	readonly id: string;
	readonly role: VibeCodexParallelThread['role'];
	readonly branchName: string;
	readonly worktreePath?: string;
	readonly status: VibeCodexParallelThread['status'];
	readonly statusDetail?: string;
	readonly resultStatus?: VibeCodexParallelResult['status'];
	readonly promptFocus: string;
	readonly materialized: boolean;
	readonly branchSafe: boolean;
	readonly pathSafe: boolean;
	readonly dispatchable: boolean;
	readonly blockers: readonly string[];
	readonly dispatchRequest?: VibeCodexParallelDispatchRequestPayload;
}

export interface VibeCodexParallelDispatchPlanResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly activeTaskId?: string;
	readonly route: VibeCodexParallelDispatchRoute;
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly enabled: boolean;
	readonly workspaceTrusted: boolean;
	readonly hasExecutionAuthorization: boolean;
	readonly authorizationSummary: string;
	readonly mode: {
		readonly mode: string;
		readonly label: string;
		readonly readOnly: boolean;
		readonly allowsToolRequests: boolean;
	};
	readonly counts: {
		readonly threads: number;
		readonly materialized: number;
		readonly dispatchable: number;
		readonly pending: number;
		readonly runningResults: number;
		readonly completedResults: number;
		readonly failedResults: number;
		readonly blockedResults: number;
		readonly missingResults: number;
		readonly returnedLanes: number;
	};
	readonly lanes?: readonly VibeCodexParallelDispatchLane[];
	readonly dispatchQueue?: readonly VibeCodexParallelDispatchRequestPayload[];
	readonly blockers: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexParallelDispatchPlanInput {
	readonly plan?: VibeCodexParallelPlan;
	readonly results?: readonly VibeCodexParallelResult[];
	readonly review?: VibeCodexParallelReview;
	readonly activePlan?: VibeCodexPlan;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly workspaceTrusted: boolean;
	readonly modePolicy: VibeCodexModePolicy;
}

const parallelDispatchPlanMethods = new Set([
	'agent/getParallelDispatchPlan',
	'agent/parallelDispatchPlan',
	'parallel/dispatchPlan',
	'parallel/dispatchQueue',
	'parallel/laneDispatchPlan',
	'vibecodex/parallelDispatchPlan',
]);

const parallelDispatchPlanToolNames = new Set([
	'parallel_dispatch_plan',
	'parallel_dispatch_queue',
	'parallel_agent_dispatch',
	'dispatch_parallel_agents',
	'lane_dispatch_plan',
	'get_parallel_dispatch_plan',
]);

export function normalizeParallelDispatchPlanRequest(message: { readonly id?: string | number; readonly method?: string; readonly params?: unknown }): VibeCodexParallelDispatchPlanRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!parallelDispatchPlanMethods.has(message.method) && !isParallelDispatchPlanToolCall(message.method, payload, args)) {
		return undefined;
	}
	const taskId = stringValue(payload.taskId)
		?? stringValue(payload.task_id)
		?? stringValue(args.taskId)
		?? stringValue(args.task_id);
	return {
		id: message.id,
		method: message.method,
		...(taskId ? { taskId: redactSensitiveText(taskId) } : {}),
		includeLanes: booleanValue(payload.includeLanes)
			?? booleanValue(payload.include_lanes)
			?? booleanValue(args.includeLanes)
			?? booleanValue(args.include_lanes)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		maxLanes: clampLanes(numberValue(payload.maxLanes)
			?? numberValue(payload.max_lanes)
			?? numberValue(args.maxLanes)
			?? numberValue(args.max_lanes)
			?? 8),
		requestedAt: Date.now(),
	};
}

export function createParallelDispatchPlanResponse(request: VibeCodexParallelDispatchPlanRequest, input: VibeCodexParallelDispatchPlanInput): VibeCodexParallelDispatchPlanResponse {
	const activeTaskId = input.plan?.taskId ?? input.review?.taskId ?? input.results?.[0]?.taskId;
	const hasExecutionAuthorization = authorizationMatchesPlan(input.authorization, input.activePlan);
	const mode = {
		mode: input.modePolicy.mode,
		label: input.modePolicy.label,
		readOnly: input.modePolicy.readOnly,
		allowsToolRequests: modeAllowsAction(input.modePolicy, 'tool'),
	};
	const base = {
		source: 'externalExtension' as const,
		...(request.taskId ? { taskId: request.taskId } : activeTaskId ? { taskId: redactSensitiveText(activeTaskId) } : {}),
		...(activeTaskId ? { activeTaskId: redactSensitiveText(activeTaskId) } : {}),
		enabled: input.plan?.enabled ?? false,
		workspaceTrusted: input.workspaceTrusted,
		hasExecutionAuthorization,
		authorizationSummary: redactSensitiveText(executionAuthorizationSummary(input.authorization)),
		mode,
		guardrails: parallelDispatchPlanGuardrails,
	};
	if (!input.plan) {
		return finalizeResponse(request, {
			...base,
			ok: false,
			route: 'wait_for_parallel_plan',
			ready: false,
			blocked: true,
			counts: emptyCounts,
			blockers: ['No parallel dispatch plan is available.'],
			nextAction: 'Create or submit a parallel agent plan before asking for dispatch lanes.',
			message: 'No parallel dispatch plan is available.',
		});
	}
	const plan = input.plan;
	if (request.taskId && request.taskId !== plan.taskId) {
		const blockers = [`Requested task ${request.taskId} does not match active parallel task ${plan.taskId}.`];
		return finalizeResponse(request, {
			...base,
			ok: false,
			route: 'repair_request',
			ready: false,
			blocked: true,
			counts: countDispatchState(plan, input.results ?? [], []),
			blockers,
			nextAction: 'Refresh parallel_status or parallel_dispatch_plan and retry with the active task id.',
			message: blockers[0],
		});
	}

	const scopedResults = (input.results ?? []).filter(result => result.taskId === plan.taskId);
	const lanes = plan.threads.map(thread => laneModel(plan, thread, scopedResults.find(result => result.threadId === thread.id)));
	const limitedLanes = lanes.slice(0, request.maxLanes);
	const dispatchQueue = limitedLanes
		.filter(lane => lane.dispatchable && lane.dispatchRequest)
		.map(lane => lane.dispatchRequest as VibeCodexParallelDispatchRequestPayload);
	const counts = countDispatchState(plan, scopedResults, lanes);
	const blockers = routeBlockers(plan, input, hasExecutionAuthorization, mode, lanes);
	const route = routeFor(plan, input, hasExecutionAuthorization, mode, counts, dispatchQueue, input.review, blockers);
	const ready = route === 'dispatch_ready';
	const blocked = route === 'wait_for_results' || route === 'review_results' ? false : !ready;

	return finalizeResponse(request, {
		...base,
		ok: true,
		route,
		ready,
		blocked,
		counts,
		...(request.includeLanes ? { lanes: limitedLanes } : {}),
		dispatchQueue,
		blockers: redactSensitiveValue(blockers) as readonly string[],
		nextAction: nextActionFor(route),
		message: createMessage(plan.taskId, route, counts, blockers),
	});
}

export function parallelDispatchPlanSummary(response: VibeCodexParallelDispatchPlanResponse): string {
	const task = response.taskId ?? response.activeTaskId ?? 'none';
	const queue = response.dispatchQueue ? ` Queue: ${response.dispatchQueue.length}.` : '';
	const blockers = response.blockers.length ? ` Blockers: ${response.blockers.slice(0, 3).join('; ')}.` : '';
	return `Parallel dispatch plan ${response.route}: ${response.ready ? 'ready' : response.blocked ? 'blocked' : 'waiting'} for ${task}.${queue}${blockers}`;
}

const parallelDispatchPlanGuardrails = [
	'Parallel dispatch plan status is read-only and never dispatches agents, prepares worktrees, runs terminals, writes files, deletes files, merges, stages, checks out branches, accepts diffs, or mutates worktrees.',
	'Dispatch requires the exact rendered visual plan revision to be approved and the active mode to allow tool requests.',
	'Each dispatch request must run only inside a materialized .vibecodex/worktrees lane with a safe vibecodex/checkpoint/... branch.',
	'Every dispatched lane must report agent/parallelResult; merge-back still requires judge review, normal diff review, checkpoint coverage, and explicit Accept/Reject.',
];

const emptyCounts: VibeCodexParallelDispatchPlanResponse['counts'] = {
	threads: 0,
	materialized: 0,
	dispatchable: 0,
	pending: 0,
	runningResults: 0,
	completedResults: 0,
	failedResults: 0,
	blockedResults: 0,
	missingResults: 0,
	returnedLanes: 0,
};

type ResponseDraft = Omit<VibeCodexParallelDispatchPlanResponse, 'promptBlock'>;

function finalizeResponse(request: VibeCodexParallelDispatchPlanRequest, draft: ResponseDraft): VibeCodexParallelDispatchPlanResponse {
	return {
		...draft,
		...(request.includePromptBlock ? { promptBlock: JSON.stringify(redactSensitiveValue({
			type: 'vibecodex.parallelDispatchPlan',
			taskId: draft.taskId,
			activeTaskId: draft.activeTaskId,
			route: draft.route,
			ready: draft.ready,
			blocked: draft.blocked,
			enabled: draft.enabled,
			workspaceTrusted: draft.workspaceTrusted,
			hasExecutionAuthorization: draft.hasExecutionAuthorization,
			mode: draft.mode,
			counts: draft.counts,
			dispatchQueue: draft.dispatchQueue,
			blockers: draft.blockers,
			nextAction: draft.nextAction,
			expectedResultMethod: 'agent/parallelResult',
			note: 'This prompt block describes dispatch readiness only. It does not launch lanes or mutate worktrees.',
		}), null, 2) } : {}),
	};
}

function routeBlockers(plan: VibeCodexParallelPlan, input: VibeCodexParallelDispatchPlanInput, hasExecutionAuthorization: boolean, mode: VibeCodexParallelDispatchPlanResponse['mode'], lanes: readonly VibeCodexParallelDispatchLane[]): readonly string[] {
	return [
		!plan.enabled ? 'Parallel agents are disabled for this task; use the normal single-lane execution path.' : undefined,
		!hasExecutionAuthorization ? 'Approve the exact visual plan revision before dispatching parallel lanes.' : undefined,
		mode.allowsToolRequests ? undefined : `${mode.label} Mode blocks tool requests for parallel dispatch.`,
		!input.workspaceTrusted ? 'Workspace is not trusted; parallel dispatch is blocked.' : undefined,
		...lanes.flatMap(lane => lane.blockers),
		...lanes.filter(lane => lane.resultStatus === 'failed' || lane.resultStatus === 'blocked').map(lane => `${lane.id} has reported ${lane.resultStatus}; review or remediate before dispatch.`),
	].filter((value): value is string => !!value);
}

function routeFor(plan: VibeCodexParallelPlan, input: VibeCodexParallelDispatchPlanInput, hasExecutionAuthorization: boolean, mode: VibeCodexParallelDispatchPlanResponse['mode'], counts: VibeCodexParallelDispatchPlanResponse['counts'], dispatchQueue: readonly VibeCodexParallelDispatchRequestPayload[], review: VibeCodexParallelReview | undefined, blockers: readonly string[]): VibeCodexParallelDispatchRoute {
	if (!plan.enabled) {
		return 'single_lane_execution';
	}
	if (!hasExecutionAuthorization) {
		return 'approve_plan';
	}
	if (!mode.allowsToolRequests) {
		return 'switch_mode';
	}
	if (!input.workspaceTrusted) {
		return 'blocked';
	}
	if (dispatchQueue.length > 0) {
		return 'dispatch_ready';
	}
	if (counts.pending > 0 && counts.dispatchable === 0) {
		return 'prepare_worktrees';
	}
	if (counts.runningResults > 0) {
		return 'wait_for_results';
	}
	if (review || (counts.threads > 0 && counts.missingResults === 0 && counts.completedResults > 0)) {
		return 'review_results';
	}
	return blockers.length ? 'blocked' : 'blocked';
}

function nextActionFor(route: VibeCodexParallelDispatchRoute): string {
	switch (route) {
		case 'wait_for_parallel_plan':
			return 'Create a parallel plan, then request parallel_dispatch_plan again.';
		case 'repair_request':
			return 'Refresh active parallel task metadata and retry with the active task id.';
		case 'single_lane_execution':
			return 'Use the approved single-lane Act/Agent path; no parallel dispatch queue is needed.';
		case 'approve_plan':
			return 'Approve the exact rendered visual plan revision before dispatching lanes.';
		case 'switch_mode':
			return 'Switch to Act, Agent, Debug, or execution-capable Custom mode before dispatching lanes.';
		case 'prepare_worktrees':
			return 'Request approval-gated parallel worktree preparation before dispatching lanes.';
		case 'dispatch_ready':
			return 'Dispatch each queued lane inside its isolated worktree and report agent/parallelResult.';
		case 'wait_for_results':
			return 'Wait for running lanes to report completed, failed, or blocked results.';
		case 'review_results':
			return 'Run or inspect judge review, then request merge-back through the normal diff-review path.';
		case 'blocked':
			return 'Resolve blockers before dispatching parallel agents.';
	}
}

function createMessage(taskId: string, route: VibeCodexParallelDispatchRoute, counts: VibeCodexParallelDispatchPlanResponse['counts'], blockers: readonly string[]): string {
	if (route === 'dispatch_ready') {
		return `Parallel dispatch plan for ${taskId} has ${counts.dispatchable} dispatchable lane${counts.dispatchable === 1 ? '' : 's'}.`;
	}
	if (blockers.length) {
		return `Parallel dispatch plan for ${taskId} routes to ${route}; ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} remain.`;
	}
	return `Parallel dispatch plan for ${taskId} routes to ${route}.`;
}

function countDispatchState(plan: VibeCodexParallelPlan, results: readonly VibeCodexParallelResult[], lanes: readonly VibeCodexParallelDispatchLane[]): VibeCodexParallelDispatchPlanResponse['counts'] {
	const scoped = results.filter(result => result.taskId === plan.taskId);
	const resultThreadIds = new Set(scoped.map(result => result.threadId));
	return {
		threads: plan.threads.length,
		materialized: plan.threads.filter(thread => thread.status === 'materialized').length,
		dispatchable: lanes.filter(lane => lane.dispatchable).length,
		pending: plan.threads.filter(thread => thread.status === 'pending').length,
		runningResults: scoped.filter(result => result.status === 'running').length,
		completedResults: scoped.filter(result => result.status === 'completed').length,
		failedResults: scoped.filter(result => result.status === 'failed').length,
		blockedResults: scoped.filter(result => result.status === 'blocked').length,
		missingResults: Math.max(0, plan.threads.length - resultThreadIds.size),
		returnedLanes: lanes.length,
	};
}

function laneModel(plan: VibeCodexParallelPlan, thread: VibeCodexParallelThread, result: VibeCodexParallelResult | undefined): VibeCodexParallelDispatchLane {
	const branchSafe = isSafeBranchName(thread.branchName);
	const pathSafe = !!thread.worktreePath && pathUnderWorktreeRoot(plan, thread.worktreePath);
	const materialized = thread.status === 'materialized';
	const blockers = [
		branchSafe ? undefined : `Unsafe branch name for ${thread.id}.`,
		thread.worktreePath ? undefined : `Missing worktree path for ${thread.id}.`,
		pathSafe ? undefined : `Unsafe worktree path for ${thread.id}.`,
		result ? `${thread.id} has already reported ${result.status}.` : undefined,
	].filter((value): value is string => !!value).map(redactSensitiveText);
	const dispatchable = materialized && branchSafe && pathSafe && !result;
	const dispatchRequest = dispatchable && thread.worktreePath ? {
		method: 'agent/dispatchParallelLane' as const,
		taskId: redactSensitiveText(plan.taskId),
		threadId: redactSensitiveText(thread.id),
		worktreePath: redactSensitiveText(thread.worktreePath),
		branchName: redactSensitiveText(thread.branchName),
		promptFocus: redactSensitiveText(thread.promptFocus),
		expectedResultMethod: 'agent/parallelResult' as const,
	} : undefined;
	return {
		id: redactSensitiveText(thread.id),
		role: thread.role,
		branchName: redactSensitiveText(thread.branchName),
		...(thread.worktreePath ? { worktreePath: redactSensitiveText(thread.worktreePath) } : {}),
		status: thread.status,
		...(thread.statusDetail ? { statusDetail: redactSensitiveText(thread.statusDetail) } : {}),
		...(result ? { resultStatus: result.status } : {}),
		promptFocus: redactSensitiveText(thread.promptFocus),
		materialized,
		branchSafe,
		pathSafe,
		dispatchable,
		blockers,
		...(dispatchRequest ? { dispatchRequest } : {}),
	};
}

function pathUnderWorktreeRoot(plan: VibeCodexParallelPlan, value: string): boolean {
	if (!plan.worktreeRoot) {
		return false;
	}
	return normalizePath(value).startsWith(`${normalizePath(plan.worktreeRoot)}/`);
}

function isSafeBranchName(value: string): boolean {
	return value.startsWith('vibecodex/checkpoint/')
		&& !value.includes('..')
		&& !/[\s~^:?*[\\\u0000-\u001f]/.test(value)
		&& !value.endsWith('/')
		&& !value.endsWith('.');
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isParallelDispatchPlanToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return parallelDispatchPlanToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (typeof args === 'string') {
		try {
			const parsed = JSON.parse(args);
			return isRecord(parsed) ? parsed : {};
		} catch {
			return {};
		}
	}
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function clampLanes(value: number): number {
	if (!Number.isFinite(value)) {
		return 8;
	}
	return Math.max(1, Math.min(8, Math.floor(value)));
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

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
