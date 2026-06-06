/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexParallelPlan, VibeCodexParallelThread } from './multiAgent';
import { createParallelReview } from './parallelReview';
import type { VibeCodexParallelResult, VibeCodexParallelReview } from './parallelReview';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexParallelReviewStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly taskId?: string;
	readonly includeResults: boolean;
	readonly includeRanking: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexParallelReviewLaneSummary {
	readonly rank: number;
	readonly threadId: string;
	readonly role?: VibeCodexParallelThread['role'];
	readonly branchName?: string;
	readonly worktreePath?: string;
	readonly threadStatus?: VibeCodexParallelThread['status'];
	readonly resultStatus: VibeCodexParallelResult['status'];
	readonly score?: number;
	readonly summary: string;
	readonly changedFiles: readonly string[];
	readonly verificationCount: number;
	readonly riskCount: number;
	readonly mergeCandidate: boolean;
	readonly blocked: boolean;
	readonly rationale: readonly string[];
}

export interface VibeCodexParallelReviewStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly activeTaskId?: string;
	readonly hasPlan: boolean;
	readonly hasReview: boolean;
	readonly reviewSource: 'stored' | 'computed' | 'missing';
	readonly expectedThreadCount: number;
	readonly resultCount: number;
	readonly counts: {
		readonly completed: number;
		readonly running: number;
		readonly failed: number;
		readonly blocked: number;
		readonly missing: number;
	};
	readonly recommendedThreadId?: string;
	readonly mergeReady: boolean;
	readonly blockers: readonly string[];
	readonly missingThreads: readonly string[];
	readonly ranking?: readonly VibeCodexParallelReviewLaneSummary[];
	readonly results?: readonly VibeCodexParallelResult[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexParallelReviewStatusInput {
	readonly plan?: VibeCodexParallelPlan;
	readonly results?: readonly VibeCodexParallelResult[];
	readonly review?: VibeCodexParallelReview;
}

const parallelReviewStatusMethods = new Set([
	'agent/getParallelReviewStatus',
	'agent/parallelReviewStatus',
	'parallel/reviewStatus',
	'parallel/judgeStatus',
	'vibecodex/parallelReviewStatus',
]);

const parallelReviewStatusToolNames = new Set([
	'parallel_review_status',
	'get_parallel_review_status',
	'parallel_judge_status',
	'get_parallel_judge_status',
	'lane_review_status',
]);

export function normalizeParallelReviewStatusRequest(message: JsonRpcMessage): VibeCodexParallelReviewStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!parallelReviewStatusMethods.has(message.method) && !isParallelReviewStatusToolCall(message.method, payload, args)) {
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
		includeResults: booleanValue(payload.includeResults)
			?? booleanValue(payload.include_results)
			?? booleanValue(args.includeResults)
			?? booleanValue(args.include_results)
			?? false,
		includeRanking: booleanValue(payload.includeRanking)
			?? booleanValue(payload.include_ranking)
			?? booleanValue(args.includeRanking)
			?? booleanValue(args.include_ranking)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createParallelReviewStatusResponse(request: VibeCodexParallelReviewStatusRequest, input: VibeCodexParallelReviewStatusInput): VibeCodexParallelReviewStatusResponse {
	const activeTaskId = input.review?.taskId ?? input.plan?.taskId ?? input.results?.[0]?.taskId;
	if (request.taskId && activeTaskId && request.taskId !== activeTaskId) {
		return {
			ok: false,
			source: 'externalExtension',
			taskId: request.taskId,
			activeTaskId,
			hasPlan: !!input.plan,
			hasReview: !!input.review,
			reviewSource: 'missing',
			expectedThreadCount: input.plan?.threads.length ?? 0,
			resultCount: 0,
			counts: emptyCounts(),
			mergeReady: false,
			blockers: [`Requested task ${request.taskId} does not match active parallel task ${activeTaskId}.`],
			missingThreads: [],
			guardrails: guardrails(),
			message: `Parallel review task ${request.taskId} is not active; active task is ${activeTaskId}.`,
		};
	}
	if (!activeTaskId) {
		return {
			ok: false,
			source: 'externalExtension',
			hasPlan: false,
			hasReview: false,
			reviewSource: 'missing',
			expectedThreadCount: 0,
			resultCount: 0,
			counts: emptyCounts(),
			mergeReady: false,
			blockers: ['No parallel plan, lane results, or judge review is available.'],
			missingThreads: [],
			guardrails: guardrails(),
			message: 'No parallel review status is available.',
		};
	}
	const taskId = request.taskId ?? activeTaskId;
	const scopedResults = (input.results ?? []).filter(result => result.taskId === taskId);
	const storedReview = input.review?.taskId === taskId ? input.review : undefined;
	const computedReview = storedReview ?? createParallelReview(input.plan?.taskId === taskId ? input.plan : undefined, scopedResults);
	const expectedThreadIds = expectedThreads(input.plan?.taskId === taskId ? input.plan : undefined, scopedResults);
	const reportedThreadIds = new Set(scopedResults.map(result => result.threadId));
	const missingThreads = expectedThreadIds.filter(threadId => !reportedThreadIds.has(threadId));
	const counts = resultCounts(scopedResults, missingThreads.length);
	const blockers = computedReview?.blockers ?? ['No judge review could be computed from current lane results.'];
	return {
		ok: true,
		source: 'externalExtension',
		taskId,
		activeTaskId,
		hasPlan: input.plan?.taskId === taskId,
		hasReview: !!computedReview,
		reviewSource: storedReview ? 'stored' : computedReview ? 'computed' : 'missing',
		expectedThreadCount: expectedThreadIds.length,
		resultCount: scopedResults.length,
		counts,
		...(computedReview?.recommendedThreadId ? { recommendedThreadId: computedReview.recommendedThreadId } : {}),
		mergeReady: computedReview?.mergeReady ?? false,
		blockers: redactSensitiveValue(blockers) as readonly string[],
		missingThreads,
		...(request.includeRanking ? { ranking: createRanking(scopedResults, input.plan, computedReview?.recommendedThreadId) } : {}),
		...(request.includeResults ? { results: redactSensitiveValue(scopedResults) as readonly VibeCodexParallelResult[] } : {}),
		guardrails: guardrails(),
		message: createMessage(taskId, scopedResults.length, expectedThreadIds.length, computedReview?.recommendedThreadId, computedReview?.mergeReady ?? false, blockers.length),
	};
}

export function parallelReviewStatusSummary(response: VibeCodexParallelReviewStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	const recommended = response.recommendedThreadId ? ` Recommended: ${response.recommendedThreadId}.` : ' No recommendation yet.';
	const blockers = response.blockers.length ? ` Blockers: ${response.blockers.slice(0, 3).join('; ')}.` : '';
	return `Parallel review ${response.taskId}: ${response.resultCount}/${response.expectedThreadCount} lane result${response.resultCount === 1 ? '' : 's'}, merge ${response.mergeReady ? 'ready' : 'blocked'}.${recommended}${blockers}`;
}

function createRanking(results: readonly VibeCodexParallelResult[], plan: VibeCodexParallelPlan | undefined, recommendedThreadId: string | undefined): readonly VibeCodexParallelReviewLaneSummary[] {
	const threadById = new Map((plan?.threads ?? []).map(thread => [thread.id, thread]));
	return [...results].sort((a, b) => compareLaneResults(a, b, plan)).map((result, index) => {
		const thread = threadById.get(result.threadId);
		const unplanned = !!plan && !thread;
		const blocked = unplanned || result.status === 'failed' || result.status === 'blocked' || result.risks.length > 0;
		const branchName = result.branchName ?? thread?.branchName;
		const worktreePath = result.worktreePath ?? thread?.worktreePath;
		return {
			rank: index + 1,
			threadId: result.threadId,
			...(thread?.role ? { role: thread.role } : {}),
			...(branchName ? { branchName: redactSensitiveText(branchName) } : {}),
			...(worktreePath ? { worktreePath: redactSensitiveText(worktreePath) } : {}),
			...(thread?.status ? { threadStatus: thread.status } : {}),
			resultStatus: result.status,
			...(result.score !== undefined ? { score: result.score } : {}),
			summary: redactSensitiveText(result.summary),
			changedFiles: redactSensitiveValue(result.changedFiles) as readonly string[],
			verificationCount: result.verification.length,
			riskCount: result.risks.length,
			mergeCandidate: result.threadId === recommendedThreadId,
			blocked,
			rationale: laneRationale(result, result.threadId === recommendedThreadId, blocked, unplanned),
		};
	});
}

function laneRationale(result: VibeCodexParallelResult, recommended: boolean, blocked: boolean, unplanned: boolean): readonly string[] {
	return [
		recommended ? 'Selected by judge ordering.' : undefined,
		unplanned ? 'Lane is not part of the active parallel plan.' : undefined,
		result.status === 'completed' ? 'Lane completed.' : `Lane is ${result.status}.`,
		result.score !== undefined ? `Score ${result.score}.` : undefined,
		`${result.verification.length} verification item${result.verification.length === 1 ? '' : 's'}.`,
		result.risks.length ? `${result.risks.length} risk${result.risks.length === 1 ? '' : 's'} reported.` : undefined,
		blocked ? 'Requires review before merge-back.' : undefined,
	].filter((item): item is string => !!item).map(redactSensitiveText);
}

function compareLaneResults(a: VibeCodexParallelResult, b: VibeCodexParallelResult, plan: VibeCodexParallelPlan | undefined): number {
	if (plan) {
		const plannedIds = new Set(plan.threads.map(thread => thread.id));
		const plannedDelta = (plannedIds.has(b.threadId) ? 1 : 0) - (plannedIds.has(a.threadId) ? 1 : 0);
		if (plannedDelta) {
			return plannedDelta;
		}
	}
	const statusDelta = statusWeight(b.status) - statusWeight(a.status);
	if (statusDelta) {
		return statusDelta;
	}
	const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
	if (scoreDelta) {
		return scoreDelta;
	}
	return a.risks.length - b.risks.length || b.verification.length - a.verification.length || a.threadId.localeCompare(b.threadId);
}

function statusWeight(status: VibeCodexParallelResult['status']): number {
	switch (status) {
		case 'completed':
			return 4;
		case 'running':
			return 3;
		case 'blocked':
			return 2;
		case 'failed':
			return 1;
	}
}

function expectedThreads(plan: VibeCodexParallelPlan | undefined, results: readonly VibeCodexParallelResult[]): readonly string[] {
	return plan?.threads.map(thread => thread.id) ?? Array.from(new Set(results.map(result => result.threadId))).sort();
}

function resultCounts(results: readonly VibeCodexParallelResult[], missing: number): VibeCodexParallelReviewStatusResponse['counts'] {
	return {
		completed: results.filter(result => result.status === 'completed').length,
		running: results.filter(result => result.status === 'running').length,
		failed: results.filter(result => result.status === 'failed').length,
		blocked: results.filter(result => result.status === 'blocked').length,
		missing,
	};
}

function emptyCounts(): VibeCodexParallelReviewStatusResponse['counts'] {
	return { completed: 0, running: 0, failed: 0, blocked: 0, missing: 0 };
}

function guardrails(): readonly string[] {
	return [
		'Parallel review status is read-only and never prepares worktrees, selects lanes, requests merge-back, applies diffs, cleans worktrees, or mutates files.',
		'Judge recommendations are advisory until a developer selects a lane and the approved visual plan authorization is present.',
		'Merge-back must still return through normal review-first diff cards and checkpoint rollback coverage.',
		'Lane summaries, paths, risks, verification evidence, and raw results are redacted before returning to the backend.',
	];
}

function createMessage(taskId: string, resultCount: number, expectedCount: number, recommendedThreadId: string | undefined, mergeReady: boolean, blockerCount: number): string {
	return [
		`Parallel review ${taskId}: ${resultCount}/${expectedCount} lanes reported.`,
		recommendedThreadId ? `Recommended lane: ${recommendedThreadId}.` : 'No recommended lane yet.',
		`Merge-back is ${mergeReady ? 'ready' : 'blocked'}.`,
		blockerCount ? `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} remain.` : undefined,
	].filter((line): line is string => !!line).join(' ');
}

function isParallelReviewStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return parallelReviewStatusToolNames.has(tool);
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
