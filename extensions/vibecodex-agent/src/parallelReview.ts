/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexParallelPlan } from './multiAgent';

export type VibeCodexParallelResultStatus = 'running' | 'completed' | 'failed' | 'blocked';

export interface VibeCodexParallelResult {
	readonly taskId: string;
	readonly threadId: string;
	readonly branchName?: string;
	readonly worktreePath?: string;
	readonly status: VibeCodexParallelResultStatus;
	readonly summary: string;
	readonly changedFiles: readonly string[];
	readonly verification: readonly string[];
	readonly risks: readonly string[];
	readonly score?: number;
	readonly patchId?: string;
	readonly producedAt: number;
}

export interface VibeCodexParallelReview {
	readonly version: 1;
	readonly taskId: string;
	readonly createdAt: number;
	readonly results: readonly VibeCodexParallelResult[];
	readonly recommendedThreadId?: string;
	readonly mergeReady: boolean;
	readonly blockers: readonly string[];
}

export interface VibeCodexParallelMergeRequest {
	readonly version: 1;
	readonly taskId: string;
	readonly threadId: string;
	readonly review: VibeCodexParallelReview;
	readonly mergeReady: boolean;
	readonly blockers: readonly string[];
	readonly requestedAt: number;
	readonly source: 'externalExtension';
}

const parallelResultMethods = new Set([
	'agent/parallelResult',
	'agent/parallelReview',
	'turn/parallel/result',
	'turn/parallel/updated',
]);

export function normalizeParallelResultMessage(method: string | undefined, params: unknown, plan: VibeCodexParallelPlan | undefined): VibeCodexParallelResult | undefined {
	if (!method || !parallelResultMethods.has(method) || !isRecord(params)) {
		return undefined;
	}
	const threadId = stringValue(params.threadId) ?? stringValue(params.agentId) ?? stringValue(params.laneId);
	if (!threadId) {
		return undefined;
	}
	const thread = plan?.threads.find(candidate => candidate.id === threadId);
	const taskId = stringValue(params.taskId) ?? plan?.taskId;
	if (!taskId) {
		return undefined;
	}
	const branchName = stringValue(params.branchName) ?? thread?.branchName;
	const worktreePath = stringValue(params.worktreePath) ?? thread?.worktreePath;
	const score = numberValue(params.score);
	return {
		taskId,
		threadId,
		...(branchName ? { branchName } : {}),
		...(worktreePath ? { worktreePath } : {}),
		status: normalizeResultStatus(stringValue(params.status)),
		summary: stringValue(params.summary) ?? stringValue(params.message) ?? `${threadId} reported a parallel result.`,
		changedFiles: arrayOfStrings(params.changedFiles) ?? arrayOfStrings(params.files) ?? [],
		verification: arrayOfStrings(params.verification) ?? arrayOfStrings(params.evidence) ?? [],
		risks: arrayOfStrings(params.risks) ?? [],
		...(score !== undefined ? { score } : {}),
		...(stringValue(params.patchId) ? { patchId: stringValue(params.patchId) } : {}),
		producedAt: numberValue(params.producedAt) ?? Date.now(),
	};
}

export function upsertParallelResult(results: readonly VibeCodexParallelResult[], result: VibeCodexParallelResult): readonly VibeCodexParallelResult[] {
	const next = results.filter(candidate => !(candidate.taskId === result.taskId && candidate.threadId === result.threadId));
	return [...next, result].sort((a, b) => a.threadId.localeCompare(b.threadId));
}

export function createParallelReview(plan: VibeCodexParallelPlan | undefined, results: readonly VibeCodexParallelResult[]): VibeCodexParallelReview | undefined {
	const taskId = plan?.taskId ?? results[0]?.taskId;
	if (!taskId) {
		return undefined;
	}
	const scoped = results.filter(result => result.taskId === taskId);
	const planThreadIds = new Set(plan?.threads.map(thread => thread.id) ?? []);
	const eligible = plan ? scoped.filter(result => planThreadIds.has(result.threadId)) : scoped;
	const completed = eligible.filter(result => result.status === 'completed');
	const recommended = completed.slice().sort(compareResults)[0];
	const expectedThreadIds = new Set(plan?.threads.map(thread => thread.id) ?? scoped.map(result => result.threadId));
	const reportedThreadIds = new Set(scoped.map(result => result.threadId));
	const unplannedResults = plan ? scoped.filter(result => !expectedThreadIds.has(result.threadId)) : [];
	const blockers = [
		completed.length ? undefined : 'No completed parallel result is available for merge-back.',
		...Array.from(expectedThreadIds).filter(id => !reportedThreadIds.has(id)).map(id => `${id} has not reported a result.`),
		...unplannedResults.map(result => `${result.threadId} is not part of the active parallel plan.`),
		...scoped.filter(result => result.status === 'failed' || result.status === 'blocked').map(result => `${result.threadId} is ${result.status}: ${result.summary}`),
		...(recommended?.risks ?? []).map(risk => `Recommended result risk: ${risk}`),
	].filter((value): value is string => !!value);
	return {
		version: 1,
		taskId,
		createdAt: Date.now(),
		results: scoped,
		...(recommended ? { recommendedThreadId: recommended.threadId } : {}),
		mergeReady: !!recommended && blockers.length === 0,
		blockers,
	};
}

export function parallelReviewSummary(review: VibeCodexParallelReview): string {
	return [
		`${review.results.length} parallel result${review.results.length === 1 ? '' : 's'} for ${review.taskId}.`,
		review.recommendedThreadId ? `Recommended: ${review.recommendedThreadId}` : 'Recommended: none yet',
		`Merge ready: ${review.mergeReady ? 'yes' : 'no'}`,
		review.blockers.length ? `Blockers: ${review.blockers.slice(0, 4).join('; ')}` : undefined,
	].filter((line): line is string => !!line).join('\n');
}

export function createParallelMergeRequest(review: VibeCodexParallelReview, threadId: string): VibeCodexParallelMergeRequest {
	const blockers = mergeRequestBlockers(review, threadId);
	return {
		version: 1,
		taskId: review.taskId,
		threadId,
		review,
		mergeReady: blockers.length === 0,
		blockers,
		requestedAt: Date.now(),
		source: 'externalExtension',
	};
}

function compareResults(a: VibeCodexParallelResult, b: VibeCodexParallelResult): number {
	const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
	if (scoreDelta) {
		return scoreDelta;
	}
	return a.risks.length - b.risks.length || b.verification.length - a.verification.length || a.threadId.localeCompare(b.threadId);
}

function mergeRequestBlockers(review: VibeCodexParallelReview, threadId: string): readonly string[] {
	const blockers = [
		...review.blockers,
		review.recommendedThreadId ? undefined : 'No recommended parallel lane is available for merge-back.',
		review.recommendedThreadId && review.recommendedThreadId !== threadId
			? `Requested lane ${threadId} does not match recommended lane ${review.recommendedThreadId}.`
			: undefined,
		review.mergeReady ? undefined : 'Parallel judge review is not merge-ready.',
	].filter((value): value is string => !!value);
	return Array.from(new Set(blockers));
}

function normalizeResultStatus(value: string | undefined): VibeCodexParallelResultStatus {
	switch (value) {
		case 'running':
		case 'completed':
		case 'failed':
		case 'blocked':
			return value;
		default:
			return 'completed';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function arrayOfStrings(value: unknown): readonly string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim());
}
