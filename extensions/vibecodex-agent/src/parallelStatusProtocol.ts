/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexParallelPlan, VibeCodexParallelThread } from './multiAgent';
import { VibeCodexParallelResult, VibeCodexParallelReview } from './parallelReview';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexParallelStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly taskId?: string;
	readonly includeResults: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexParallelThreadStatusSummary {
	readonly id: string;
	readonly role: VibeCodexParallelThread['role'];
	readonly branchName: string;
	readonly worktreePath?: string;
	readonly status: VibeCodexParallelThread['status'];
	readonly statusDetail?: string;
	readonly resultStatus?: VibeCodexParallelResult['status'];
	readonly resultScore?: number;
	readonly resultSummary?: string;
	readonly changedFiles?: readonly string[];
	readonly verificationCount?: number;
	readonly riskCount?: number;
}

export interface VibeCodexParallelReviewStatusSummary {
	readonly version: 1;
	readonly taskId: string;
	readonly createdAt: number;
	readonly recommendedThreadId?: string;
	readonly mergeReady: boolean;
	readonly blockers: readonly string[];
	readonly resultCount: number;
}

export interface VibeCodexParallelStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly activeTaskId?: string;
	readonly enabled?: boolean;
	readonly requestedThreads?: number;
	readonly maxThreads?: 8;
	readonly isolation?: VibeCodexParallelPlan['isolation'];
	readonly reviewStrategy?: VibeCodexParallelPlan['reviewStrategy'];
	readonly mergeStrategy?: VibeCodexParallelPlan['mergeStrategy'];
	readonly resultCount: number;
	readonly threads?: readonly VibeCodexParallelThreadStatusSummary[];
	readonly results?: readonly VibeCodexParallelResult[];
	readonly review?: VibeCodexParallelReviewStatusSummary;
	readonly recommendedThreadId?: string;
	readonly mergeReady: boolean;
	readonly blockers: readonly string[];
	readonly message: string;
}

export interface VibeCodexParallelStatusInput {
	readonly plan?: VibeCodexParallelPlan;
	readonly results?: readonly VibeCodexParallelResult[];
	readonly review?: VibeCodexParallelReview;
}

const parallelStatusMethods = new Set([
	'agent/getParallelStatus',
	'agent/parallelStatus',
	'parallel/status',
	'parallel.agent.status',
	'vibecodex/parallelStatus',
]);

const parallelStatusToolNames = new Set([
	'parallel_status',
	'get_parallel_status',
	'parallel_agent_status',
	'get_parallel_agent_status',
]);

export function normalizeParallelStatusRequest(message: JsonRpcMessage): VibeCodexParallelStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!parallelStatusMethods.has(message.method) && !isParallelStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const taskId = stringValue(payload.taskId)
		?? stringValue(payload.task_id)
		?? stringValue(args.taskId)
		?? stringValue(args.task_id);
	return {
		id: message.id,
		method: message.method,
		...(taskId ? { taskId } : {}),
		includeResults: booleanValue(payload.includeResults)
			?? booleanValue(payload.include_results)
			?? booleanValue(args.includeResults)
			?? booleanValue(args.include_results)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createParallelStatusResponse(request: VibeCodexParallelStatusRequest, input: VibeCodexParallelStatusInput): VibeCodexParallelStatusResponse {
	const activeTaskId = input.plan?.taskId ?? input.review?.taskId ?? input.results?.[0]?.taskId;
	if (request.taskId && activeTaskId && request.taskId !== activeTaskId) {
		return {
			ok: false,
			source: 'externalExtension',
			taskId: request.taskId,
			activeTaskId,
			resultCount: 0,
			mergeReady: false,
			blockers: [`Requested task ${request.taskId} does not match active parallel task ${activeTaskId}.`],
			message: `Parallel task ${request.taskId} is not active; active task is ${activeTaskId}.`,
		};
	}
	if (!activeTaskId) {
		return {
			ok: false,
			source: 'externalExtension',
			resultCount: 0,
			mergeReady: false,
			blockers: ['No parallel agent plan or review is available.'],
			message: 'No parallel agent status is available.',
		};
	}
	const taskId = request.taskId ?? activeTaskId;
	const scopedResults = (input.results ?? []).filter(result => result.taskId === taskId);
	const resultByThread = new Map(scopedResults.map(result => [result.threadId, result]));
	const review = input.review?.taskId === taskId ? input.review : undefined;
	const blockers = review?.blockers ?? (input.plan ? [] : ['No parallel agent plan is available.']);
	const mergeReady = review?.mergeReady ?? false;
	const recommendedThreadId = review?.recommendedThreadId;
	const threads = input.plan?.taskId === taskId
		? input.plan.threads.map(thread => threadSummary(thread, resultByThread.get(thread.id)))
		: undefined;
	return {
		ok: true,
		source: 'externalExtension',
		taskId,
		activeTaskId,
		...(input.plan?.taskId === taskId ? {
			enabled: input.plan.enabled,
			requestedThreads: input.plan.requestedThreads,
			maxThreads: input.plan.maxThreads,
			isolation: input.plan.isolation,
			reviewStrategy: input.plan.reviewStrategy,
			mergeStrategy: input.plan.mergeStrategy,
		} : {}),
		resultCount: scopedResults.length,
		...(threads ? { threads } : {}),
		...(request.includeResults ? { results: redactSensitiveValue(scopedResults) as readonly VibeCodexParallelResult[] } : {}),
		...(review ? { review: reviewSummary(review) } : {}),
		...(recommendedThreadId ? { recommendedThreadId } : {}),
		mergeReady,
		blockers: redactSensitiveValue(blockers) as readonly string[],
		message: createMessage(taskId, input.plan, scopedResults.length, mergeReady, recommendedThreadId, blockers.length),
	};
}

export function parallelStatusSummary(response: VibeCodexParallelStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	const lanes = response.requestedThreads ?? response.threads?.length ?? response.resultCount;
	const recommended = response.recommendedThreadId ? ` Recommended: ${response.recommendedThreadId}.` : '';
	const blockers = response.blockers.length ? ` Blockers: ${response.blockers.slice(0, 3).join('; ')}.` : '';
	return `Parallel status ${response.taskId}: ${response.resultCount}/${lanes} result${response.resultCount === 1 ? '' : 's'}, merge ${response.mergeReady ? 'ready' : 'blocked'}.${recommended}${blockers}`;
}

function threadSummary(thread: VibeCodexParallelThread, result: VibeCodexParallelResult | undefined): VibeCodexParallelThreadStatusSummary {
	return {
		id: thread.id,
		role: thread.role,
		branchName: redactSensitiveText(thread.branchName),
		...(thread.worktreePath ? { worktreePath: redactSensitiveText(thread.worktreePath) } : {}),
		status: thread.status,
		...(thread.statusDetail ? { statusDetail: redactSensitiveText(thread.statusDetail) } : {}),
		...(result ? {
			resultStatus: result.status,
			...(result.score !== undefined ? { resultScore: result.score } : {}),
			resultSummary: redactSensitiveText(result.summary),
			changedFiles: redactSensitiveValue(result.changedFiles) as readonly string[],
			verificationCount: result.verification.length,
			riskCount: result.risks.length,
		} : {}),
	};
}

function reviewSummary(review: VibeCodexParallelReview): VibeCodexParallelReviewStatusSummary {
	return {
		version: review.version,
		taskId: review.taskId,
		createdAt: review.createdAt,
		...(review.recommendedThreadId ? { recommendedThreadId: review.recommendedThreadId } : {}),
		mergeReady: review.mergeReady,
		blockers: redactSensitiveValue(review.blockers) as readonly string[],
		resultCount: review.results.length,
	};
}

function createMessage(taskId: string, plan: VibeCodexParallelPlan | undefined, resultCount: number, mergeReady: boolean, recommendedThreadId: string | undefined, blockerCount: number): string {
	const lanes = plan?.requestedThreads ?? plan?.threads.length ?? resultCount;
	return [
		`Parallel task ${taskId}: ${resultCount}/${lanes} lanes reported.`,
		recommendedThreadId ? `Recommended lane: ${recommendedThreadId}.` : 'No recommended lane yet.',
		`Merge-back is ${mergeReady ? 'ready' : 'blocked'}.`,
		blockerCount ? `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} remain.` : undefined,
	].filter((line): line is string => !!line).join(' ');
}

function isParallelStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return parallelStatusToolNames.has(tool);
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
