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

export interface VibeCodexParallelLaneExecutionStatusRequest {
	readonly id: string | number;
	readonly method: string;
	readonly taskId?: string;
	readonly threadId?: string;
	readonly includeResult: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export type VibeCodexParallelLaneExecutionRoute =
	| 'wait_for_parallel_plan'
	| 'single_lane_execution'
	| 'repair_request'
	| 'approve_plan'
	| 'switch_mode'
	| 'prepare_worktrees'
	| 'dispatch_lane'
	| 'wait_for_result'
	| 'review_reported_result'
	| 'repair_lane'
	| 'blocked';

export interface VibeCodexParallelLaneExecutionLaneModel {
	readonly id: string;
	readonly role: VibeCodexParallelThread['role'];
	readonly branchName: string;
	readonly worktreePath?: string;
	readonly promptFocus: string;
	readonly threadStatus: VibeCodexParallelThread['status'];
	readonly statusDetail?: string;
	readonly resultStatus?: VibeCodexParallelResult['status'];
	readonly resultSummary?: string;
	readonly changedFiles?: readonly string[];
	readonly verificationCount?: number;
	readonly riskCount?: number;
	readonly materialized: boolean;
	readonly branchSafe: boolean;
	readonly pathSafe: boolean;
	readonly dispatchable: boolean;
	readonly blockers: readonly string[];
}

export interface VibeCodexParallelLaneExecutionStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly activeTaskId?: string;
	readonly requestedThreadId?: string;
	readonly selectedThreadId?: string;
	readonly available: boolean;
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
		readonly pending: number;
		readonly failed: number;
		readonly skipped: number;
		readonly cleaned: number;
		readonly results: number;
		readonly runningResults: number;
		readonly completedResults: number;
		readonly failedResults: number;
		readonly blockedResults: number;
		readonly missingResults: number;
	};
	readonly review?: {
		readonly recommendedThreadId?: string;
		readonly mergeReady: boolean;
		readonly blockers: readonly string[];
		readonly resultCount: number;
	};
	readonly lane?: VibeCodexParallelLaneExecutionLaneModel;
	readonly route: VibeCodexParallelLaneExecutionRoute;
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly blockers: readonly string[];
	readonly nextAction: string;
	readonly guardrails: readonly string[];
	readonly promptBlock?: string;
	readonly message: string;
}

export interface VibeCodexParallelLaneExecutionStatusInput {
	readonly plan?: VibeCodexParallelPlan;
	readonly results?: readonly VibeCodexParallelResult[];
	readonly review?: VibeCodexParallelReview;
	readonly activePlan?: VibeCodexPlan;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly workspaceTrusted: boolean;
	readonly modePolicy: VibeCodexModePolicy;
}

const parallelLaneExecutionStatusMethods = new Set([
	'agent/getParallelLaneExecutionStatus',
	'agent/parallelLaneExecutionStatus',
	'parallel/laneExecutionStatus',
	'parallel/lane/status',
	'parallel/dispatchStatus',
	'vibecodex/parallelLaneExecutionStatus',
]);

const parallelLaneExecutionStatusToolNames = new Set([
	'parallel_lane_execution_status',
	'parallel_lane_status',
	'parallel_dispatch_status',
	'lane_execution_status',
	'lane_dispatch_status',
	'get_parallel_lane_execution_status',
]);

export function normalizeParallelLaneExecutionStatusRequest(message: { readonly id?: string | number; readonly method?: string; readonly params?: unknown }): VibeCodexParallelLaneExecutionStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!parallelLaneExecutionStatusMethods.has(message.method) && !isParallelLaneExecutionStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const taskId = stringValue(payload.taskId)
		?? stringValue(payload.task_id)
		?? stringValue(args.taskId)
		?? stringValue(args.task_id);
	const threadId = stringValue(payload.threadId)
		?? stringValue(payload.thread_id)
		?? stringValue(payload.laneId)
		?? stringValue(payload.lane_id)
		?? stringValue(args.threadId)
		?? stringValue(args.thread_id)
		?? stringValue(args.laneId)
		?? stringValue(args.lane_id);
	return {
		id: message.id,
		method: message.method,
		...(taskId ? { taskId: redactSensitiveText(taskId) } : {}),
		...(threadId ? { threadId: redactSensitiveText(threadId) } : {}),
		includeResult: booleanValue(payload.includeResult)
			?? booleanValue(payload.include_result)
			?? booleanValue(args.includeResult)
			?? booleanValue(args.include_result)
			?? false,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createParallelLaneExecutionStatusResponse(request: VibeCodexParallelLaneExecutionStatusRequest, input: VibeCodexParallelLaneExecutionStatusInput): VibeCodexParallelLaneExecutionStatusResponse {
	const activeTaskId = input.plan?.taskId ?? input.review?.taskId ?? input.results?.[0]?.taskId;
	const hasExecutionAuthorization = authorizationMatchesPlan(input.authorization, input.activePlan);
	const mode = {
		mode: input.modePolicy.mode,
		label: input.modePolicy.label,
		readOnly: input.modePolicy.readOnly,
		allowsToolRequests: modeAllowsAction(input.modePolicy, 'tool'),
	};
	const counts = countLaneState(input.plan, input.results ?? []);
	const base = {
		source: 'externalExtension' as const,
		...(request.taskId ? { taskId: request.taskId } : activeTaskId ? { taskId: redactSensitiveText(activeTaskId) } : {}),
		...(activeTaskId ? { activeTaskId: redactSensitiveText(activeTaskId) } : {}),
		...(request.threadId ? { requestedThreadId: request.threadId } : {}),
		available: !!input.plan,
		enabled: input.plan?.enabled ?? false,
		workspaceTrusted: input.workspaceTrusted,
		hasExecutionAuthorization,
		authorizationSummary: redactSensitiveText(executionAuthorizationSummary(input.authorization)),
		mode,
		counts,
		...(input.review ? { review: reviewSummary(input.review) } : {}),
		guardrails: parallelLaneExecutionStatusGuardrails,
	};
	if (!input.plan) {
		return finalizeResponse(request, {
			...base,
			ok: false,
			route: 'wait_for_parallel_plan',
			ready: false,
			blocked: true,
			blockers: ['No parallel agent plan is available.'],
			nextAction: 'Create or submit a parallel agent plan before dispatching isolated lanes.',
			message: 'No parallel lane execution status is available.',
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
			blockers,
			nextAction: 'Refresh parallel_status or parallel_worktree_status and retry with the active task id.',
			message: blockers[0],
		});
	}
	if (!plan.enabled) {
		const blockers = highLevelBlockers(input, hasExecutionAuthorization, false);
		const route = blockers.length ? highLevelRoute(input, hasExecutionAuthorization) : 'single_lane_execution';
		return finalizeResponse(request, {
			...base,
			ok: true,
			route,
			ready: blockers.length === 0,
			blocked: blockers.length > 0,
			blockers,
			nextAction: blockers.length ? nextActionFor(route) : 'Use the normal approved single-lane execution path; no isolated worktree dispatch is required.',
			message: blockers.length
				? `Single-lane execution is blocked: ${blockers.slice(0, 3).join('; ')}.`
				: 'Parallel agents are disabled; the approved task can use the normal single-lane execution route.',
		});
	}
	const scopedResults = (input.results ?? []).filter(result => result.taskId === plan.taskId);
	const selectedThread = selectThread(plan, request.threadId, scopedResults);
	if (!selectedThread) {
		const blockers = [`Requested lane ${request.threadId ?? 'unknown'} is not part of the active parallel plan.`];
		return finalizeResponse(request, {
			...base,
			ok: false,
			route: 'repair_request',
			ready: false,
			blocked: true,
			blockers,
			nextAction: 'Call parallel_worktree_status with includeThreads=true and retry with a valid lane id.',
			message: blockers[0],
		});
	}
	const result = scopedResults.find(candidate => candidate.threadId === selectedThread.id);
	const lane = laneModel(plan, selectedThread, result, request.includeResult);
	const blockers = [
		...highLevelBlockers(input, hasExecutionAuthorization, true),
		...lane.blockers,
		...(result?.status === 'failed' || result?.status === 'blocked' ? [`Lane result is ${result.status}; review or remediate before dispatch.`] : []),
	];
	const route = routeFor(input, hasExecutionAuthorization, lane, result, blockers);
	const ready = route === 'dispatch_lane' || route === 'review_reported_result';
	return finalizeResponse(request, {
		...base,
		ok: true,
		selectedThreadId: lane.id,
		lane,
		route,
		ready,
		blocked: !ready && route !== 'wait_for_result',
		blockers: redactSensitiveValue(blockers) as readonly string[],
		nextAction: nextActionFor(route),
		message: createMessage(plan.taskId, lane.id, route, blockers),
	});
}

export function parallelLaneExecutionStatusSummary(response: VibeCodexParallelLaneExecutionStatusResponse): string {
	const selected = response.selectedThreadId ? ` Lane: ${response.selectedThreadId}.` : '';
	const blockers = response.blockers.length ? ` Blockers: ${response.blockers.slice(0, 3).join('; ')}.` : '';
	return `Parallel lane execution ${response.route}: ${response.ready ? 'ready' : response.blocked ? 'blocked' : 'waiting'}.${selected}${blockers}`;
}

const parallelLaneExecutionStatusGuardrails = [
	'Parallel lane execution status is read-only and never dispatches agents, prepares worktrees, runs commands, writes files, selects merge lanes, applies diffs, stages, commits, checks out branches, deletes paths, or mutates worktrees.',
	'Lane dispatch remains blocked until the exact rendered visual plan revision is approved and the active mode allows tool requests.',
	'Every dispatchable lane must be materialized inside the workspace .vibecodex/worktrees root with a safe vibecodex/checkpoint/... branch.',
	'Completed lane output still requires judge review, normal multi-file diff review, checkpoint coverage, and explicit Accept/Reject decisions before merge-back.',
];

type ResponseDraft = Omit<VibeCodexParallelLaneExecutionStatusResponse, 'promptBlock'>;

function finalizeResponse(request: VibeCodexParallelLaneExecutionStatusRequest, draft: ResponseDraft): VibeCodexParallelLaneExecutionStatusResponse {
	return {
		...draft,
		...(request.includePromptBlock ? { promptBlock: JSON.stringify(redactSensitiveValue({
			type: 'vibecodex.parallelLaneExecutionStatus',
			taskId: draft.taskId,
			activeTaskId: draft.activeTaskId,
			requestedThreadId: draft.requestedThreadId,
			selectedThreadId: draft.selectedThreadId,
			available: draft.available,
			enabled: draft.enabled,
			workspaceTrusted: draft.workspaceTrusted,
			hasExecutionAuthorization: draft.hasExecutionAuthorization,
			mode: draft.mode,
			counts: draft.counts,
			lane: draft.lane,
			route: draft.route,
			ready: draft.ready,
			blocked: draft.blocked,
			blockers: draft.blockers,
			nextAction: draft.nextAction,
			note: 'This status only routes parallel lane dispatch readiness. It does not execute or mutate anything.',
		}), null, 2) } : {}),
	};
}

function highLevelBlockers(input: VibeCodexParallelLaneExecutionStatusInput, hasExecutionAuthorization: boolean, requireTrusted: boolean): readonly string[] {
	return [
		requireTrusted && !input.workspaceTrusted ? 'Workspace is not trusted; parallel lane execution is blocked.' : undefined,
		!hasExecutionAuthorization ? 'Approve the exact visual plan revision before dispatching parallel lanes.' : undefined,
		modeAllowsAction(input.modePolicy, 'tool') ? undefined : `${input.modePolicy.label} Mode blocks tool requests for lane execution.`,
	].filter((value): value is string => !!value);
}

function highLevelRoute(input: VibeCodexParallelLaneExecutionStatusInput, hasExecutionAuthorization: boolean): VibeCodexParallelLaneExecutionRoute {
	if (!hasExecutionAuthorization) {
		return 'approve_plan';
	}
	if (!modeAllowsAction(input.modePolicy, 'tool')) {
		return 'switch_mode';
	}
	return 'blocked';
}

function routeFor(input: VibeCodexParallelLaneExecutionStatusInput, hasExecutionAuthorization: boolean, lane: VibeCodexParallelLaneExecutionLaneModel, result: VibeCodexParallelResult | undefined, blockers: readonly string[]): VibeCodexParallelLaneExecutionRoute {
	if (!hasExecutionAuthorization) {
		return 'approve_plan';
	}
	if (!modeAllowsAction(input.modePolicy, 'tool')) {
		return 'switch_mode';
	}
	if (!input.workspaceTrusted) {
		return 'blocked';
	}
	if (!lane.branchSafe || !lane.pathSafe) {
		return 'blocked';
	}
	if (lane.threadStatus === 'pending') {
		return 'prepare_worktrees';
	}
	if (lane.threadStatus === 'failed' || lane.threadStatus === 'skipped' || lane.threadStatus === 'cleaned') {
		return 'repair_lane';
	}
	if (result?.status === 'running') {
		return 'wait_for_result';
	}
	if (result?.status === 'completed') {
		return blockers.length ? 'review_reported_result' : 'review_reported_result';
	}
	if (result?.status === 'failed' || result?.status === 'blocked') {
		return 'repair_lane';
	}
	return blockers.length ? 'blocked' : 'dispatch_lane';
}

function nextActionFor(route: VibeCodexParallelLaneExecutionRoute): string {
	switch (route) {
		case 'wait_for_parallel_plan':
			return 'Create a parallel plan, then ask for lane execution status again.';
		case 'single_lane_execution':
			return 'Use normal single-lane execution; isolated worktree dispatch is not required.';
		case 'repair_request':
			return 'Refresh the active parallel task/lane identifiers and retry.';
		case 'approve_plan':
			return 'Approve the exact rendered visual plan revision before dispatching or preparing lanes.';
		case 'switch_mode':
			return 'Switch to Act, Agent, Debug, or an execution-capable Custom mode before lane execution.';
		case 'prepare_worktrees':
			return 'Request approval-gated parallel worktree preparation before dispatching this lane.';
		case 'dispatch_lane':
			return 'Dispatch this lane inside its isolated worktree and report agent/parallelResult when done.';
		case 'wait_for_result':
			return 'Wait for the running lane to report a completed, failed, or blocked result.';
		case 'review_reported_result':
			return 'Run or inspect the judge review before merge-back; completed lane output still enters normal diff review.';
		case 'repair_lane':
			return 'Repair or clean the lane state before dispatching again.';
		case 'blocked':
			return 'Resolve blockers before any lane dispatch.';
	}
}

function createMessage(taskId: string, threadId: string, route: VibeCodexParallelLaneExecutionRoute, blockers: readonly string[]): string {
	return blockers.length
		? `Parallel lane ${threadId} for ${taskId} routes to ${route}; ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} remain.`
		: `Parallel lane ${threadId} for ${taskId} routes to ${route}.`;
}

function countLaneState(plan: VibeCodexParallelPlan | undefined, results: readonly VibeCodexParallelResult[]): VibeCodexParallelLaneExecutionStatusResponse['counts'] {
	const scoped = plan ? results.filter(result => result.taskId === plan.taskId) : results;
	const expected = plan?.threads.length ?? 0;
	return {
		threads: expected,
		materialized: countThreadStatus(plan, 'materialized'),
		pending: countThreadStatus(plan, 'pending'),
		failed: countThreadStatus(plan, 'failed'),
		skipped: countThreadStatus(plan, 'skipped'),
		cleaned: countThreadStatus(plan, 'cleaned'),
		results: scoped.length,
		runningResults: scoped.filter(result => result.status === 'running').length,
		completedResults: scoped.filter(result => result.status === 'completed').length,
		failedResults: scoped.filter(result => result.status === 'failed').length,
		blockedResults: scoped.filter(result => result.status === 'blocked').length,
		missingResults: Math.max(0, expected - new Set(scoped.map(result => result.threadId)).size),
	};
}

function countThreadStatus(plan: VibeCodexParallelPlan | undefined, status: VibeCodexParallelThread['status']): number {
	return plan?.threads.filter(thread => thread.status === status).length ?? 0;
}

function selectThread(plan: VibeCodexParallelPlan, requestedThreadId: string | undefined, results: readonly VibeCodexParallelResult[]): VibeCodexParallelThread | undefined {
	if (requestedThreadId) {
		return plan.threads.find(thread => thread.id === requestedThreadId);
	}
	const resultThreadIds = new Set(results.filter(result => result.status === 'running' || result.status === 'completed').map(result => result.threadId));
	return plan.threads.find(thread => thread.status === 'materialized' && !resultThreadIds.has(thread.id))
		?? plan.threads.find(thread => thread.status === 'pending')
		?? plan.threads[0];
}

function laneModel(plan: VibeCodexParallelPlan, thread: VibeCodexParallelThread, result: VibeCodexParallelResult | undefined, includeResult: boolean): VibeCodexParallelLaneExecutionLaneModel {
	const branchSafe = isSafeBranchName(thread.branchName);
	const pathSafe = !!thread.worktreePath && pathUnderWorktreeRoot(plan, thread.worktreePath);
	const blockers = [
		branchSafe ? undefined : `Unsafe branch name for ${thread.id}.`,
		thread.worktreePath ? undefined : `Missing worktree path for ${thread.id}.`,
		pathSafe ? undefined : `Unsafe worktree path for ${thread.id}.`,
	].filter((value): value is string => !!value).map(redactSensitiveText);
	return {
		id: redactSensitiveText(thread.id),
		role: thread.role,
		branchName: redactSensitiveText(thread.branchName),
		...(thread.worktreePath ? { worktreePath: redactSensitiveText(thread.worktreePath) } : {}),
		promptFocus: redactSensitiveText(thread.promptFocus),
		threadStatus: thread.status,
		...(thread.statusDetail ? { statusDetail: redactSensitiveText(thread.statusDetail) } : {}),
		...(result ? {
			resultStatus: result.status,
			resultSummary: includeResult ? redactSensitiveText(result.summary) : summarizeResult(result),
			...(includeResult ? { changedFiles: redactSensitiveValue(result.changedFiles) as readonly string[] } : {}),
			verificationCount: result.verification.length,
			riskCount: result.risks.length,
		} : {}),
		materialized: thread.status === 'materialized',
		branchSafe,
		pathSafe,
		dispatchable: thread.status === 'materialized' && branchSafe && pathSafe && !result,
		blockers,
	};
}

function summarizeResult(result: VibeCodexParallelResult): string {
	return redactSensitiveText(`${result.status}: ${result.summary.slice(0, 220)}`);
}

function reviewSummary(review: VibeCodexParallelReview): VibeCodexParallelLaneExecutionStatusResponse['review'] {
	return {
		...(review.recommendedThreadId ? { recommendedThreadId: redactSensitiveText(review.recommendedThreadId) } : {}),
		mergeReady: review.mergeReady,
		blockers: redactSensitiveValue(review.blockers) as readonly string[],
		resultCount: review.results.length,
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

function isParallelLaneExecutionStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return parallelLaneExecutionStatusToolNames.has(tool);
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
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
