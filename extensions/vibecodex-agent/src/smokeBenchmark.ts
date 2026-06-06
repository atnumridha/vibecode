/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCommitHandoff } from './commitHandoff';
import type { ExternalDiffReview } from './executionProtocol';
import type { VibeCodexParallelPlan } from './multiAgent';
import type { VibeCodexParallelMergeRequest, VibeCodexParallelReview } from './parallelReview';
import type { VibeCodexPlanRevisionSnapshot } from './planHistory';
import type { VibeCodexPlan } from './planProtocol';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';
import type { VibeCodexVerificationPlan } from './verificationPlan';

export type VibeCodexSmokeBenchmarkStatus = 'passed' | 'pending' | 'failed' | 'skipped';

export interface VibeCodexSmokeBenchmarkMilestone {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexSmokeBenchmarkStatus;
	readonly required: boolean;
	readonly evidence: string;
}

export interface VibeCodexSmokeBenchmarkState {
	readonly version: 1;
	readonly updatedAt: number;
	readonly ready: boolean;
	readonly summary: string;
	readonly milestones: readonly VibeCodexSmokeBenchmarkMilestone[];
}

export interface VibeCodexSmokeBenchmarkInput {
	readonly inlinePromptSession?: unknown;
	readonly plan?: Pick<VibeCodexPlan, 'taskId' | 'revision' | 'summary'>;
	readonly planRevisionHistory?: readonly Pick<VibeCodexPlanRevisionSnapshot, 'event' | 'taskId' | 'revision'>[];
	readonly hasExecutionAuthorization: boolean;
	readonly parallelPlan?: VibeCodexParallelPlan;
	readonly parallelReview?: VibeCodexParallelReview;
	readonly parallelMergeRequest?: VibeCodexParallelMergeRequest;
	readonly terminalRuns: readonly Pick<VibeCodexCapturedTerminalRun, 'status' | 'commandLine' | 'exitCode'>[];
	readonly verificationPlan?: VibeCodexVerificationPlan;
	readonly diffReview?: ExternalDiffReview;
	readonly taskCheckpointId?: string;
	readonly fileCheckpointCount: number;
	readonly commitHandoff?: VibeCodexCommitHandoff;
	readonly deliveryReady: boolean;
}

export function createSmokeBenchmarkState(input: VibeCodexSmokeBenchmarkInput): VibeCodexSmokeBenchmarkState {
	const milestones = [
		nativePromptMilestone(input),
		visualPlanMilestone(input.plan),
		manualPlanAdjustmentMilestone(input.planRevisionHistory ?? []),
		approvalMilestone(input.hasExecutionAuthorization),
		parallelSafeMilestone(input.parallelPlan, input.parallelReview, input.parallelMergeRequest, input.hasExecutionAuthorization),
		terminalVerificationMilestone(input.verificationPlan, input.terminalRuns),
		multiFileDiffMilestone(input.diffReview),
		rollbackMilestone(input.diffReview, input.taskCheckpointId, input.fileCheckpointCount),
		commitHandoffMilestone(input.commitHandoff),
		deliveryBarMilestone(input.deliveryReady),
	];
	const required = milestones.filter(milestone => milestone.required);
	const ready = required.length > 0 && required.every(milestone => milestone.status === 'passed');
	return {
		version: 1,
		updatedAt: Date.now(),
		ready,
		summary: smokeBenchmarkSummary(milestones, ready),
		milestones,
	};
}

export function smokeBenchmarkSummary(milestones: readonly VibeCodexSmokeBenchmarkMilestone[], ready: boolean): string {
	const passed = milestones.filter(milestone => milestone.status === 'passed').length;
	const pending = milestones.filter(milestone => milestone.status === 'pending').length;
	const failed = milestones.filter(milestone => milestone.status === 'failed').length;
	const skipped = milestones.filter(milestone => milestone.status === 'skipped').length;
	return ready
		? `Smoke benchmark ready: ${passed} passed, ${pending} pending, ${failed} failed, ${skipped} skipped.`
		: `Smoke benchmark pending: ${passed} passed, ${pending} pending, ${failed} failed, ${skipped} skipped.`;
}

function nativePromptMilestone(input: VibeCodexSmokeBenchmarkInput): VibeCodexSmokeBenchmarkMilestone {
	const passed = !!input.inlinePromptSession || !!input.plan;
	return {
		id: 'native-prompt',
		title: 'Native prompt captured',
		required: true,
		status: passed ? 'passed' : 'pending',
		evidence: input.inlinePromptSession
			? 'Ctrl/Cmd+K inline prompt session captured active editor context.'
			: input.plan
				? 'Sidebar task prompt produced a visual planning cycle.'
				: 'Start from the sidebar prompt or Ctrl/Cmd+K inline prompt.',
	};
}

function visualPlanMilestone(plan: VibeCodexSmokeBenchmarkInput['plan']): VibeCodexSmokeBenchmarkMilestone {
	return {
		id: 'visual-plan',
		title: 'Visual plan rendered',
		required: true,
		status: plan ? 'passed' : 'pending',
		evidence: plan ? `${plan.taskId} r${plan.revision}: ${plan.summary}` : 'Waiting for Strategy, Mermaid flowchart, checklist, risks, and acceptance criteria.',
	};
}

function manualPlanAdjustmentMilestone(history: readonly Pick<VibeCodexPlanRevisionSnapshot, 'event' | 'taskId' | 'revision'>[]): VibeCodexSmokeBenchmarkMilestone {
	const adjustment = history.find(snapshot => snapshot.event === 'edited'
		|| snapshot.event === 'refine_requested'
		|| snapshot.event === 'updated'
		|| snapshot.event === 'restored'
		|| snapshot.event === 'rejected');
	return {
		id: 'manual-plan-adjustment',
		title: 'Manual plan adjustment',
		required: true,
		status: adjustment ? 'passed' : 'pending',
		evidence: adjustment ? `${adjustment.event} snapshot recorded for ${adjustment.taskId} r${adjustment.revision}.` : 'Edit a checklist step, restore a revision, reject, or request refinement before approval.',
	};
}

function approvalMilestone(hasExecutionAuthorization: boolean): VibeCodexSmokeBenchmarkMilestone {
	return {
		id: 'approval',
		title: 'Exact plan approved',
		required: true,
		status: hasExecutionAuthorization ? 'passed' : 'pending',
		evidence: hasExecutionAuthorization ? 'Execution authorization exists for the approved task revision.' : 'Approve the exact rendered plan revision to unblock mutation.',
	};
}

function parallelSafeMilestone(plan: VibeCodexParallelPlan | undefined, review: VibeCodexParallelReview | undefined, mergeRequest: VibeCodexParallelMergeRequest | undefined, hasExecutionAuthorization: boolean): VibeCodexSmokeBenchmarkMilestone {
	if (!plan || plan.requestedThreads <= 1) {
		return {
			id: 'parallel-safe',
			title: 'Parallel-safe execution',
			required: false,
			status: 'skipped',
			evidence: 'Single-lane task; parallel worktree review is optional.',
		};
	}
	if (!review) {
		return {
			id: 'parallel-safe',
			title: 'Parallel-safe execution',
			required: true,
			status: 'pending',
			evidence: `${plan.requestedThreads} lanes requested; waiting for judge review before merge-back.`,
		};
	}
	if (!review.mergeReady) {
		return {
			id: 'parallel-safe',
			title: 'Parallel-safe execution',
			required: true,
			status: review.blockers.length ? 'failed' : 'pending',
			evidence: review.blockers.slice(0, 4).join('; ') || 'Waiting for completed parallel results.',
		};
	}
	if (!hasExecutionAuthorization) {
		return {
			id: 'parallel-safe',
			title: 'Parallel-safe execution',
			required: true,
			status: 'pending',
			evidence: `Recommended lane ${review.recommendedThreadId} is ready; exact plan authorization is required before merge-back selection.`,
		};
	}
	if (!mergeRequest) {
		return {
			id: 'parallel-safe',
			title: 'Parallel-safe execution',
			required: true,
			status: 'pending',
			evidence: `Recommended lane ${review.recommendedThreadId} is ready; merge-back has not been requested yet.`,
		};
	}
	const selectedRecommended = mergeRequest.threadId === review.recommendedThreadId;
	const ready = mergeRequest.mergeReady && selectedRecommended;
	return {
		id: 'parallel-safe',
		title: 'Parallel-safe execution',
		required: true,
		status: ready ? 'passed' : mergeRequest.blockers.length || !selectedRecommended ? 'failed' : 'pending',
		evidence: ready
			? `Selected recommended lane ${mergeRequest.threadId} for controlled merge-back.`
			: mergeRequest.blockers.slice(0, 4).join('; ') || `Selected lane ${mergeRequest.threadId} does not match recommended lane ${review.recommendedThreadId}.`,
	};
}

function terminalVerificationMilestone(plan: VibeCodexVerificationPlan | undefined, runs: readonly Pick<VibeCodexCapturedTerminalRun, 'status' | 'commandLine' | 'exitCode'>[]): VibeCodexSmokeBenchmarkMilestone {
	if (!plan) {
		return {
			id: 'terminal-verification',
			title: 'Terminal/test verification',
			required: true,
			status: 'pending',
			evidence: 'No verification gate has been generated yet.',
		};
	}
	const required = plan.checks.filter(check => check.required);
	const failed = required.filter(check => check.status === 'failed');
	const pending = required.filter(check => check.status === 'pending' || check.status === 'running');
	const passedRuns = runs.filter(run => run.status === 'passed');
	const failedRuns = runs.filter(run => run.status === 'failed');
	return {
		id: 'terminal-verification',
		title: 'Terminal/test verification',
		required: true,
		status: failed.length || failedRuns.length ? 'failed' : pending.length ? 'pending' : 'passed',
		evidence: `${required.length} required check${required.length === 1 ? '' : 's'}; ${passedRuns.length} passed terminal run${passedRuns.length === 1 ? '' : 's'}, ${failedRuns.length} failed terminal run${failedRuns.length === 1 ? '' : 's'}.`,
	};
}

function multiFileDiffMilestone(review: ExternalDiffReview | undefined): VibeCodexSmokeBenchmarkMilestone {
	if (!review) {
		return {
			id: 'multi-file-diff',
			title: 'Multi-file diff review',
			required: true,
			status: 'pending',
			evidence: 'Waiting for a backend diff review with at least two files.',
		};
	}
	const pending = review.files.filter(file => file.status === 'pending');
	const accepted = review.files.filter(file => file.status === 'accepted');
	const rejected = review.files.filter(file => file.status === 'rejected');
	const status: VibeCodexSmokeBenchmarkStatus = pending.length ? 'pending' : review.files.length >= 2 ? 'passed' : 'pending';
	return {
		id: 'multi-file-diff',
		title: 'Multi-file diff review',
		required: true,
		status,
		evidence: `${review.files.length} file${review.files.length === 1 ? '' : 's'}; ${accepted.length} accepted, ${rejected.length} rejected, ${pending.length} pending.`,
	};
}

function rollbackMilestone(review: ExternalDiffReview | undefined, taskCheckpointId: string | undefined, fileCheckpointCount: number): VibeCodexSmokeBenchmarkMilestone {
	const accepted = review?.files.filter(file => file.status === 'accepted').length ?? 0;
	if (!accepted) {
		return {
			id: 'rollback',
			title: 'Rollback checkpoint coverage',
			required: true,
			status: 'pending',
			evidence: 'No accepted diff files have checkpoint coverage yet.',
		};
	}
	const passed = !!taskCheckpointId && fileCheckpointCount >= accepted;
	return {
		id: 'rollback',
		title: 'Rollback checkpoint coverage',
		required: true,
		status: passed ? 'passed' : 'failed',
		evidence: passed ? `${taskCheckpointId} covers ${fileCheckpointCount} accepted file checkpoint${fileCheckpointCount === 1 ? '' : 's'}.` : `${accepted} accepted file${accepted === 1 ? '' : 's'} need checkpoint coverage.`,
	};
}

function commitHandoffMilestone(handoff: VibeCodexCommitHandoff | undefined): VibeCodexSmokeBenchmarkMilestone {
	return {
		id: 'commit-handoff',
		title: 'Commit handoff ready',
		required: true,
		status: handoff?.ready ? 'passed' : 'pending',
		evidence: handoff ? handoff.summary : 'Waiting for accepted files, passing checks, diagnostics evidence, and rollback coverage.',
	};
}

function deliveryBarMilestone(deliveryReady: boolean): VibeCodexSmokeBenchmarkMilestone {
	return {
		id: 'delivery-bar',
		title: 'Delivery bar ready',
		required: true,
		status: deliveryReady ? 'passed' : 'pending',
		evidence: deliveryReady ? 'Delivery Bar gates are satisfied.' : 'Delivery Bar is still waiting on one or more required gates.',
	};
}
