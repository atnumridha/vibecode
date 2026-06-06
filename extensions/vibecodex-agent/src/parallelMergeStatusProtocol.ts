/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexParallelPlan } from './multiAgent';
import type { VibeCodexParallelMergeRequest, VibeCodexParallelResult, VibeCodexParallelReview } from './parallelReview';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexParallelMergeStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly taskId?: string;
	readonly includeReview: boolean;
	readonly requestedAt: number;
}

export type VibeCodexParallelMergeDiffHandoffRoute = 'select_lane' | 'approve_plan' | 'resolve_review_blockers' | 'request_parallel_merge' | 'await_backend_diff_review' | 'await_diff_acceptance';

export interface VibeCodexParallelMergeDiffHandoff {
	readonly reviewFirst: true;
	readonly expectedRequestMethod: 'agent/parallelMergeRequest';
	readonly expectedResponseMethods: readonly string[];
	readonly receivedReviewId?: string;
	readonly waitingForDiffReview: boolean;
	readonly normalDiffReviewRequired: true;
	readonly checkpointRequired: true;
	readonly acceptRejectRequired: true;
	readonly nextRoute: VibeCodexParallelMergeDiffHandoffRoute;
	readonly guardrails: readonly string[];
}

export interface VibeCodexParallelMergeStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly activeTaskId?: string;
	readonly hasPlanAuthorization: boolean;
	readonly mergeRequested: boolean;
	readonly selectedThreadId?: string;
	readonly recommendedThreadId?: string;
	readonly selectedAt?: number;
	readonly mergeReady: boolean;
	readonly reviewMergeReady: boolean;
	readonly blockers: readonly string[];
	readonly diffHandoff: VibeCodexParallelMergeDiffHandoff;
	readonly selectedResult?: {
		readonly threadId: string;
		readonly status: VibeCodexParallelResult['status'];
		readonly score?: number;
		readonly summary: string;
		readonly changedFiles: readonly string[];
		readonly verificationCount: number;
		readonly riskCount: number;
	};
	readonly review?: {
		readonly version: 1;
		readonly taskId: string;
		readonly createdAt: number;
		readonly recommendedThreadId?: string;
		readonly mergeReady: boolean;
		readonly blockers: readonly string[];
		readonly resultCount: number;
	};
	readonly message: string;
}

export interface VibeCodexParallelMergeStatusInput {
	readonly plan?: VibeCodexParallelPlan;
	readonly review?: VibeCodexParallelReview;
	readonly mergeRequest?: VibeCodexParallelMergeRequest;
	readonly diffReview?: { readonly reviewId: string; readonly threadId?: string };
	readonly hasExecutionAuthorization: boolean;
}

const parallelMergeStatusMethods = new Set([
	'agent/getParallelMergeStatus',
	'agent/parallelMergeStatus',
	'parallel/mergeStatus',
	'parallel.mergeStatus',
	'vibecodex/parallelMergeStatus',
]);

const parallelMergeStatusToolNames = new Set([
	'parallel_merge_status',
	'get_parallel_merge_status',
	'parallel_merge_back_status',
	'get_parallel_merge_back_status',
]);

const expectedDiffReviewResponseMethods = [
	'agent/diffReview',
	'agent/submitDiff',
	'agent/requestDiffReview',
	'agent/requestToolApproval',
] as const;

export function normalizeParallelMergeStatusRequest(message: JsonRpcMessage): VibeCodexParallelMergeStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!parallelMergeStatusMethods.has(message.method) && !isParallelMergeStatusToolCall(message.method, payload, args)) {
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
		includeReview: booleanValue(payload.includeReview)
			?? booleanValue(payload.include_review)
			?? booleanValue(args.includeReview)
			?? booleanValue(args.include_review)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createParallelMergeStatusResponse(request: VibeCodexParallelMergeStatusRequest, input: VibeCodexParallelMergeStatusInput): VibeCodexParallelMergeStatusResponse {
	const activeTaskId = input.mergeRequest?.taskId ?? input.review?.taskId ?? input.plan?.taskId;
	if (request.taskId && activeTaskId && request.taskId !== activeTaskId) {
		const blockers = [`Requested task ${request.taskId} does not match active parallel task ${activeTaskId}.`];
		return {
			ok: false,
			source: 'externalExtension',
			taskId: request.taskId,
			activeTaskId,
			hasPlanAuthorization: input.hasExecutionAuthorization,
			mergeRequested: false,
			mergeReady: false,
			reviewMergeReady: false,
			blockers,
			diffHandoff: createDiffHandoff(undefined, undefined, undefined, input.hasExecutionAuthorization, false, blockers),
			message: `Parallel merge-back task ${request.taskId} is not active; active task is ${activeTaskId}.`,
		};
	}
	if (!activeTaskId) {
		const blockers = ['No parallel review or merge-back request is available.'];
		return {
			ok: false,
			source: 'externalExtension',
			hasPlanAuthorization: input.hasExecutionAuthorization,
			mergeRequested: false,
			mergeReady: false,
			reviewMergeReady: false,
			blockers,
			diffHandoff: createDiffHandoff(undefined, undefined, undefined, input.hasExecutionAuthorization, false, blockers),
			message: 'No parallel merge-back status is available.',
		};
	}
	const taskId = request.taskId ?? activeTaskId;
	const review = input.review?.taskId === taskId ? input.review : undefined;
	const mergeRequest = input.mergeRequest?.taskId === taskId ? input.mergeRequest : undefined;
	const selectedResult = mergeRequest && review ? review.results.find(result => result.threadId === mergeRequest.threadId) : undefined;
	const blockers = mergeBlockers(review, mergeRequest, input.hasExecutionAuthorization);
	const mergeReady = !!mergeRequest && input.hasExecutionAuthorization && blockers.length === 0;
	const redactedBlockers = redactSensitiveValue(blockers) as readonly string[];
	const diffHandoff = createDiffHandoff(review, mergeRequest, input.diffReview, input.hasExecutionAuthorization, mergeReady, redactedBlockers);
	return {
		ok: true,
		source: 'externalExtension',
		taskId,
		activeTaskId,
		hasPlanAuthorization: input.hasExecutionAuthorization,
		mergeRequested: !!mergeRequest,
		...(mergeRequest ? { selectedThreadId: mergeRequest.threadId, selectedAt: mergeRequest.requestedAt } : {}),
		...(review?.recommendedThreadId ? { recommendedThreadId: review.recommendedThreadId } : {}),
		mergeReady,
		reviewMergeReady: review?.mergeReady ?? false,
		blockers: redactedBlockers,
		diffHandoff,
		...(selectedResult ? { selectedResult: resultSummary(selectedResult) } : {}),
		...(request.includeReview && review ? { review: reviewSummary(review) } : {}),
		message: createMessage(taskId, mergeRequest, review, mergeReady, blockers.length, input.hasExecutionAuthorization, diffHandoff.nextRoute),
	};
}

export function parallelMergeStatusSummary(response: VibeCodexParallelMergeStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	const selected = response.selectedThreadId ? ` Selected: ${response.selectedThreadId}.` : ' No selected lane yet.';
	const recommended = response.recommendedThreadId ? ` Recommended: ${response.recommendedThreadId}.` : '';
	const handoff = ` Diff handoff: ${response.diffHandoff.nextRoute}.`;
	const blockers = response.blockers.length ? ` Blockers: ${response.blockers.slice(0, 3).join('; ')}.` : '';
	return `Parallel merge-back ${response.taskId}: ${response.mergeReady ? 'ready' : 'blocked'}.${selected}${recommended}${handoff}${blockers}`;
}

function mergeBlockers(review: VibeCodexParallelReview | undefined, mergeRequest: VibeCodexParallelMergeRequest | undefined, hasExecutionAuthorization: boolean): readonly string[] {
	const blockers = [
		hasExecutionAuthorization ? undefined : 'No approved visual plan authorization exists for merge-back.',
		review ? undefined : 'No parallel judge review is available.',
		mergeRequest ? undefined : 'No parallel merge-back lane has been selected.',
		...(review?.blockers ?? []),
		...(mergeRequest?.blockers ?? []),
		review?.recommendedThreadId && mergeRequest?.threadId && review.recommendedThreadId !== mergeRequest.threadId
			? `Selected lane ${mergeRequest.threadId} does not match recommended lane ${review.recommendedThreadId}.`
			: undefined,
		review?.mergeReady === false ? 'Parallel judge review is not merge-ready.' : undefined,
	].filter((value): value is string => !!value);
	return Array.from(new Set(blockers)).map(redactSensitiveText);
}

function createDiffHandoff(review: VibeCodexParallelReview | undefined, mergeRequest: VibeCodexParallelMergeRequest | undefined, diffReview: { readonly reviewId: string; readonly threadId?: string } | undefined, hasExecutionAuthorization: boolean, mergeReady: boolean, blockers: readonly string[]): VibeCodexParallelMergeDiffHandoff {
	const receivedReviewId = mergeRequest && diffReview?.threadId === mergeRequest.threadId ? diffReview.reviewId : undefined;
	return {
		reviewFirst: true,
		expectedRequestMethod: 'agent/parallelMergeRequest',
		expectedResponseMethods: expectedDiffReviewResponseMethods,
		...(receivedReviewId ? { receivedReviewId: redactSensitiveText(receivedReviewId) } : {}),
		waitingForDiffReview: !!mergeRequest && mergeReady && !receivedReviewId,
		normalDiffReviewRequired: true,
		checkpointRequired: true,
		acceptRejectRequired: true,
		nextRoute: diffHandoffRoute(review, mergeRequest, hasExecutionAuthorization, mergeReady, blockers, receivedReviewId),
		guardrails: [
			'Parallel merge-back never applies lane patches directly.',
			'Backend merge-back must return through the normal diff review response path before workspace writes apply.',
			'Checkpoint rollback coverage is required before any reviewed parallel-lane diff can be accepted.',
			'Accept/Reject controls remain required for every generated diff file.',
		],
	};
}

function diffHandoffRoute(review: VibeCodexParallelReview | undefined, mergeRequest: VibeCodexParallelMergeRequest | undefined, hasExecutionAuthorization: boolean, mergeReady: boolean, blockers: readonly string[], receivedReviewId: string | undefined): VibeCodexParallelMergeDiffHandoffRoute {
	if (!review?.recommendedThreadId) {
		return 'select_lane';
	}
	if (!hasExecutionAuthorization) {
		return 'approve_plan';
	}
	if (!mergeRequest) {
		return 'request_parallel_merge';
	}
	if (receivedReviewId) {
		return 'await_diff_acceptance';
	}
	if (blockers.length) {
		return 'resolve_review_blockers';
	}
	return mergeReady ? 'await_backend_diff_review' : 'resolve_review_blockers';
}

function resultSummary(result: VibeCodexParallelResult): VibeCodexParallelMergeStatusResponse['selectedResult'] {
	return {
		threadId: result.threadId,
		status: result.status,
		...(result.score !== undefined ? { score: result.score } : {}),
		summary: redactSensitiveText(result.summary),
		changedFiles: redactSensitiveValue(result.changedFiles) as readonly string[],
		verificationCount: result.verification.length,
		riskCount: result.risks.length,
	};
}

function reviewSummary(review: VibeCodexParallelReview): NonNullable<VibeCodexParallelMergeStatusResponse['review']> {
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

function createMessage(taskId: string, mergeRequest: VibeCodexParallelMergeRequest | undefined, review: VibeCodexParallelReview | undefined, mergeReady: boolean, blockerCount: number, hasExecutionAuthorization: boolean, nextRoute: VibeCodexParallelMergeDiffHandoffRoute): string {
	return [
		`Parallel merge-back ${taskId}: ${mergeReady ? 'ready' : 'blocked'}.`,
		mergeRequest ? `Selected lane: ${mergeRequest.threadId}.` : 'No lane selected.',
		review?.recommendedThreadId ? `Recommended lane: ${review.recommendedThreadId}.` : 'No recommended lane yet.',
		hasExecutionAuthorization ? 'Approved plan authorization is present.' : 'Approved plan authorization is missing.',
		`Diff handoff route: ${nextRoute}.`,
		blockerCount ? `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} remain.` : undefined,
	].filter((line): line is string => !!line).join(' ');
}

function isParallelMergeStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return parallelMergeStatusToolNames.has(tool);
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
