/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface VibeCodexParallelPlan {
	readonly version: 1;
	readonly taskId: string;
	readonly enabled: boolean;
	readonly requestedThreads: number;
	readonly maxThreads: 8;
	readonly isolation: 'git-worktree';
	readonly reviewStrategy: 'judge-before-merge';
	readonly mergeStrategy: 'manual-diff-review';
	readonly baseWorkspaceRoot?: string;
	readonly worktreeRoot?: string;
	readonly threads: readonly VibeCodexParallelThread[];
	readonly safety: {
		readonly requiresApprovalBeforeMutation: true;
		readonly requiresCheckpointBeforeMerge: true;
		readonly keepWorktreesUntilReview: true;
		readonly blockDirtyMergeBack: true;
	};
}

export interface VibeCodexParallelThread {
	readonly id: string;
	readonly role: 'implementer' | 'reviewer' | 'verifier';
	readonly branchName: string;
	readonly worktreePath?: string;
	readonly status: VibeCodexParallelThreadStatus;
	readonly statusDetail?: string;
	readonly promptFocus: string;
}

export type VibeCodexParallelThreadStatus = 'pending' | 'materialized' | 'failed' | 'skipped' | 'cleaned';

const maxThreads = 8;

export function createParallelAgentPlan(prompt: string, mode: string, workspaceRoot: string | undefined, requestedThreads: number): VibeCodexParallelPlan {
	const threadCount = clampThreadCount(requestedThreads);
	const taskId = `vibecodex-${Date.now().toString(36)}-${hashText(`${mode}:${prompt}`).slice(0, 8)}`;
	const enabled = threadCount > 1;
	const worktreeRoot = workspaceRoot ? `${normalizePath(workspaceRoot)}/.vibecodex/worktrees/${taskId}` : undefined;
	return {
		version: 1,
		taskId,
		enabled,
		requestedThreads: threadCount,
		maxThreads,
		isolation: 'git-worktree',
		reviewStrategy: 'judge-before-merge',
		mergeStrategy: 'manual-diff-review',
		...(workspaceRoot ? { baseWorkspaceRoot: normalizePath(workspaceRoot) } : {}),
		...(worktreeRoot ? { worktreeRoot } : {}),
		threads: Array.from({ length: threadCount }, (_, index) => createThread(taskId, index, worktreeRoot)),
		safety: {
			requiresApprovalBeforeMutation: true,
			requiresCheckpointBeforeMerge: true,
			keepWorktreesUntilReview: true,
			blockDirtyMergeBack: true,
		},
	};
}

export function parallelPlanSummary(plan: VibeCodexParallelPlan): string {
	if (!plan.enabled) {
		return 'Parallel agents disabled; using a single approved execution lane.';
	}
	return [
		`${plan.requestedThreads} isolated worktree agents`,
		`Isolation: ${plan.isolation}`,
		`Review: ${plan.reviewStrategy}`,
		`Merge: ${plan.mergeStrategy}`,
		plan.worktreeRoot ? `Worktrees: ${plan.worktreeRoot}` : undefined,
	].filter((line): line is string => !!line).join('\n');
}

export function parallelPlanPromptBlock(plan: VibeCodexParallelPlan): string {
	return JSON.stringify({
		version: plan.version,
		taskId: plan.taskId,
		enabled: plan.enabled,
		requestedThreads: plan.requestedThreads,
		maxThreads: plan.maxThreads,
		isolation: plan.isolation,
		reviewStrategy: plan.reviewStrategy,
		mergeStrategy: plan.mergeStrategy,
		baseWorkspaceRoot: plan.baseWorkspaceRoot,
		worktreeRoot: plan.worktreeRoot,
		threads: plan.threads,
		safety: plan.safety,
	}, null, 2);
}

export function withParallelThreadStatus(plan: VibeCodexParallelPlan, threadId: string, status: VibeCodexParallelThreadStatus, statusDetail?: string): VibeCodexParallelPlan {
	return {
		...plan,
		threads: plan.threads.map(thread => thread.id === threadId ? {
			...thread,
			status,
			...(statusDetail ? { statusDetail } : {}),
		} : thread),
	};
}

export function clampThreadCount(value: number): number {
	if (!Number.isFinite(value)) {
		return 1;
	}
	return Math.max(1, Math.min(maxThreads, Math.floor(value)));
}

function createThread(taskId: string, index: number, worktreeRoot: string | undefined): VibeCodexParallelThread {
	const lane = index + 1;
	const id = `agent-${String(lane).padStart(2, '0')}`;
	const role = index === 0 ? 'implementer' : index === 1 ? 'reviewer' : 'verifier';
	return {
		id,
		role,
		branchName: `vibecodex/checkpoint/${taskId}/${id}`,
		...(worktreeRoot ? { worktreePath: `${worktreeRoot}/${id}` } : {}),
		status: 'pending',
		promptFocus: role === 'implementer'
			? 'Implement the approved plan with the smallest correct diff.'
			: role === 'reviewer'
				? 'Independently review the plan and resulting patch for correctness, risks, and missed tests.'
				: 'Run verification, compare outputs, and report acceptance evidence before merge-back.',
	};
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}
