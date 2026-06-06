/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCommitHandoff } from './commitHandoff';
import type { VibeCodexDeliveryBarState } from './deliveryBar';
import type { VibeCodexDiagnosticsSnapshot } from './diagnosticsEvidence';
import type { VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexFinalReviewState } from './finalReview';
import type { VibeCodexParallelPlan } from './multiAgent';
import type { VibeCodexParallelMergeRequest, VibeCodexParallelReview } from './parallelReview';
import type { VibeCodexPlanRevisionSnapshot } from './planHistory';
import type { VibeCodexPlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSmokeBenchmarkState } from './smokeBenchmark';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';
import type { VibeCodexVerificationCheck, VibeCodexVerificationPlan } from './verificationPlan';

export type VibeCodexWorkflowStage = 'no_task' | 'planning' | 'approved' | 'executing' | 'reviewing' | 'rollback' | 'final_review' | 'complete' | 'blocked';
export type VibeCodexWorkflowMilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed' | 'skipped';

export interface VibeCodexWorkflowStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeMilestones: boolean;
	readonly includeEvidence: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexWorkflowReadinessItem {
	readonly ready: boolean;
	readonly status: VibeCodexWorkflowMilestoneStatus;
	readonly detail: string;
}

export interface VibeCodexWorkflowReadiness {
	readonly prompt: VibeCodexWorkflowReadinessItem;
	readonly visualPlan: VibeCodexWorkflowReadinessItem;
	readonly approvedPlan: VibeCodexWorkflowReadinessItem;
	readonly execution: VibeCodexWorkflowReadinessItem;
	readonly terminalVerification: VibeCodexWorkflowReadinessItem;
	readonly diffReview: VibeCodexWorkflowReadinessItem;
	readonly rollbackCheckpoint: VibeCodexWorkflowReadinessItem;
	readonly finalReview: VibeCodexWorkflowReadinessItem;
	readonly parallelMerge: VibeCodexWorkflowReadinessItem;
}

export interface VibeCodexWorkflowMilestone {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexWorkflowMilestoneStatus;
	readonly required: boolean;
	readonly detail: string;
	readonly evidence?: readonly string[];
}

export interface VibeCodexWorkflowStatusCounts {
	readonly terminalRuns: number;
	readonly runningTerminalRuns: number;
	readonly passedTerminalRuns: number;
	readonly failedTerminalRuns: number;
	readonly diffFiles: number;
	readonly acceptedDiffFiles: number;
	readonly pendingDiffFiles: number;
	readonly rejectedDiffFiles: number;
	readonly verificationChecks: number;
	readonly requiredVerificationChecks: number;
	readonly passedRequiredVerificationChecks: number;
	readonly failedRequiredVerificationChecks: number;
	readonly pendingRequiredVerificationChecks: number;
	readonly checkpointFiles: number;
	readonly completedMilestones: number;
	readonly pendingMilestones: number;
	readonly failedMilestones: number;
	readonly blockedMilestones: number;
}

export interface VibeCodexWorkflowStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly generatedAt: number;
	readonly stage: VibeCodexWorkflowStage;
	readonly summary: string;
	readonly task?: {
		readonly taskId?: string;
		readonly revision?: number;
		readonly summary?: string;
		readonly approved: boolean;
	};
	readonly readiness: VibeCodexWorkflowReadiness;
	readonly counts: VibeCodexWorkflowStatusCounts;
	readonly milestones?: readonly VibeCodexWorkflowMilestone[];
	readonly evidence?: readonly string[];
	readonly promptBlock?: string;
	readonly nextAction: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexWorkflowStatusInput {
	readonly prompt?: string;
	readonly inlinePromptSession?: unknown;
	readonly plan?: Pick<VibeCodexPlan, 'taskId' | 'revision' | 'summary'>;
	readonly planRevisionHistory?: readonly Pick<VibeCodexPlanRevisionSnapshot, 'event' | 'taskId' | 'revision'>[];
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly verificationPlan?: VibeCodexVerificationPlan;
	readonly diagnosticsSnapshot?: VibeCodexDiagnosticsSnapshot;
	readonly deliveryBar?: VibeCodexDeliveryBarState;
	readonly smokeBenchmark?: VibeCodexSmokeBenchmarkState;
	readonly finalReview?: VibeCodexFinalReviewState;
	readonly commitHandoff?: VibeCodexCommitHandoff;
	readonly diffReview?: ExternalDiffReview;
	readonly terminalRuns?: readonly VibeCodexCapturedTerminalRun[];
	readonly taskCheckpointId?: string;
	readonly fileCheckpointCount?: number;
	readonly fileCheckpointPaths?: readonly string[];
	readonly parallelPlan?: VibeCodexParallelPlan;
	readonly parallelReview?: VibeCodexParallelReview;
	readonly parallelMergeRequest?: VibeCodexParallelMergeRequest;
}

const workflowStatusMethods = new Set([
	'agent/getWorkflowStatus',
	'agent/workflowStatus',
	'agent/getDeliveryWorkflowStatus',
	'agent/deliveryWorkflowStatus',
	'workflow/status',
	'delivery/workflowStatus',
	'delivery/workflow',
	'lifecycle/status',
	'vibecodex/workflowStatus',
]);

const workflowStatusToolNames = new Set([
	'workflow_status',
	'get_workflow_status',
	'delivery_workflow_status',
	'get_delivery_workflow_status',
	'lifecycle_status',
	'delivery_lifecycle_status',
	'vibecodex_workflow_status',
]);

export function normalizeWorkflowStatusRequest(message: JsonRpcMessage): VibeCodexWorkflowStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!workflowStatusMethods.has(message.method) && !isWorkflowStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeMilestones: booleanValue(payload.includeMilestones)
			?? booleanValue(payload.include_milestones)
			?? booleanValue(args.includeMilestones)
			?? booleanValue(args.include_milestones)
			?? true,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? false,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createWorkflowStatusResponse(request: VibeCodexWorkflowStatusRequest, input: VibeCodexWorkflowStatusInput): VibeCodexWorkflowStatusResponse {
	const terminalRuns = input.terminalRuns ?? [];
	const verificationChecks = input.verificationPlan?.checks ?? [];
	const diffFiles = input.diffReview?.files ?? [];
	const readiness = workflowReadiness(input, terminalRuns, verificationChecks, diffFiles);
	const milestones = createMilestones(input, readiness);
	const counts = createCounts(terminalRuns, verificationChecks, diffFiles, milestones, input.fileCheckpointCount ?? 0);
	const stage = workflowStage(input, milestones, counts, readiness);
	const ok = hasWorkflowState(input, terminalRuns, diffFiles);
	const summary = createSummary(stage, input, counts, milestones);
	const evidence = workflowEvidence(input, terminalRuns, diffFiles);
	const responseHeader = {
		ok,
		source: 'externalExtension' as const,
		version: 1 as const,
		generatedAt: Date.now(),
		stage,
		summary,
		task: input.plan ? {
			taskId: redactSensitiveText(input.plan.taskId),
			revision: input.plan.revision,
			summary: redactSensitiveText(input.plan.summary),
			approved: !!input.authorization,
		} : undefined,
		readiness: redactSensitiveValue(readiness) as VibeCodexWorkflowReadiness,
		counts,
		...(request.includeMilestones ? { milestones: redactSensitiveValue(milestones) as readonly VibeCodexWorkflowMilestone[] } : {}),
		...(request.includeEvidence ? { evidence: redactSensitiveValue(evidence) as readonly string[] } : {}),
		nextAction: nextAction(stage, readiness, input.finalReview),
		guardrails: [
			'Workflow status is read-only and never approves plans, runs tools, accepts diffs, restores checkpoints, stages commits, or mutates workspace files.',
			'The lifecycle proof summarizes existing IDE state only; missing milestones must be satisfied through the normal visual-plan, approval, terminal, diff, rollback, and Final Review flows.',
			'Terminal evidence, file paths, commit handoff text, diagnostics, prompts, and plan summaries are redacted and bounded before they are returned.',
			'The complete stage is informational until backend task completion is explicitly evaluated through agent/taskComplete, agent/attemptCompletion, or attempt_completion.',
		],
		message: ok ? `Workflow status returned at ${stage}: ${counts.completedMilestones} completed, ${counts.pendingMilestones} pending, ${counts.failedMilestones + counts.blockedMilestones} blocked or failed.` : 'No workflow status is available yet.',
	};
	const promptBlock = request.includePromptBlock ? workflowPromptBlock(responseHeader, milestones, evidence) : undefined;
	return {
		...responseHeader,
		...(promptBlock ? { promptBlock } : {}),
	};
}

export function workflowStatusSummary(response: VibeCodexWorkflowStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	const plan = response.task?.taskId ? ` ${response.task.taskId} r${response.task.revision ?? 'n/a'}.` : '';
	return `${response.message}${plan} Next: ${response.nextAction}`;
}

function workflowReadiness(input: VibeCodexWorkflowStatusInput, terminalRuns: readonly VibeCodexCapturedTerminalRun[], verificationChecks: readonly VibeCodexVerificationCheck[], diffFiles: ExternalDiffReview['files']): VibeCodexWorkflowReadiness {
	const delivery = checkMap(input.deliveryBar);
	const smoke = milestoneMap(input.smokeBenchmark);
	const requiredChecks = verificationChecks.filter(check => check.required);
	const failedRequired = requiredChecks.filter(check => check.status === 'failed');
	const pendingRequired = requiredChecks.filter(check => check.status === 'pending' || check.status === 'running');
	const runningTerminal = terminalRuns.some(run => run.status === 'running');
	const failedTerminal = terminalRuns.some(run => run.status === 'failed' || run.status === 'interrupted');
	const pendingDiffs = diffFiles.filter(file => file.status === 'pending');
	const acceptedDiffs = diffFiles.filter(file => file.status === 'accepted');
	const rollbackCheck = delivery.get('rollback');
	const parallelCheck = delivery.get('parallel');
	return {
		prompt: fromSmoke(smoke.get('native-prompt'), !!input.prompt || !!input.inlinePromptSession || !!input.plan, 'Prompt captured', 'Start from sidebar chat, Ctrl/Cmd+K, command palette, task intake, or file selection.'),
		visualPlan: fromDelivery(delivery.get('visual-plan'), !!input.plan, input.plan ? `${input.plan.taskId} r${input.plan.revision}: ${input.plan.summary}` : 'Waiting for a structured Strategy, Mermaid flowchart, checklist, risks, and acceptance criteria.'),
		approvedPlan: fromDelivery(delivery.get('approved-plan'), !!input.authorization, input.authorization ? 'Exact rendered plan revision has execution authorization.' : 'Approve the exact rendered plan revision before mutation.'),
		execution: {
			ready: !!input.authorization && (terminalRuns.length > 0 || acceptedDiffs.length > 0 || !!input.finalReview),
			status: runningTerminal ? 'in_progress' : input.authorization ? 'completed' : 'pending',
			detail: input.authorization ? `${terminalRuns.length} terminal run${terminalRuns.length === 1 ? '' : 's'} and ${acceptedDiffs.length} accepted diff file${acceptedDiffs.length === 1 ? '' : 's'} recorded.` : 'Execution is locked until plan approval.',
		},
		terminalVerification: {
			ready: requiredChecks.length > 0 && !failedRequired.length && !pendingRequired.length && !failedTerminal,
			status: failedRequired.length || failedTerminal ? 'failed' : pendingRequired.length || runningTerminal ? 'in_progress' : requiredChecks.length ? 'completed' : 'pending',
			detail: requiredChecks.length ? `${requiredChecks.length} required check${requiredChecks.length === 1 ? '' : 's'}; ${failedRequired.length} failed, ${pendingRequired.length} pending or running.` : 'No verification gate has been generated yet.',
		},
		diffReview: fromDelivery(delivery.get('diff-review'), diffFiles.length > 0 && pendingDiffs.length === 0, diffFiles.length ? `${diffFiles.length} diff file${diffFiles.length === 1 ? '' : 's'}; ${pendingDiffs.length} pending.` : 'No diff review has been received yet.'),
		rollbackCheckpoint: rollbackCheck
			? fromDelivery(rollbackCheck, rollbackCheck.status === 'passed' || rollbackCheck.status === 'skipped', rollbackCheck.detail)
			: rollbackReadiness(input, acceptedDiffs),
		finalReview: {
			ready: !!input.finalReview?.ready,
			status: input.finalReview?.decision === 'pass' ? 'completed' : input.finalReview?.blocked ? 'blocked' : input.finalReview ? 'pending' : 'pending',
			detail: input.finalReview?.summary ?? 'Final Review has not been produced yet.',
		},
		parallelMerge: parallelCheck
			? fromDelivery(parallelCheck, parallelCheck.status === 'passed' || parallelCheck.status === 'skipped', parallelCheck.detail)
			: {
				ready: !input.parallelPlan || input.parallelPlan.requestedThreads <= 1 || !!input.parallelMergeRequest,
				status: !input.parallelPlan || input.parallelPlan.requestedThreads <= 1 ? 'skipped' : input.parallelReview?.mergeReady && input.parallelMergeRequest ? 'completed' : input.parallelReview?.blockers.length ? 'blocked' : 'pending',
				detail: input.parallelPlan && input.parallelPlan.requestedThreads > 1 ? 'Parallel lanes require judge review and selected merge-back before final diff review.' : 'Single-lane task; parallel merge is optional.',
			},
	};
}

function createMilestones(input: VibeCodexWorkflowStatusInput, readiness: VibeCodexWorkflowReadiness): readonly VibeCodexWorkflowMilestone[] {
	const smoke = milestoneMap(input.smokeBenchmark);
	return [
		milestone('native-prompt', 'Native prompt captured', readiness.prompt, true, smoke.get('native-prompt')?.evidence),
		milestone('visual-plan', 'Visual plan rendered', readiness.visualPlan, true, smoke.get('visual-plan')?.evidence),
		milestone('manual-plan-adjustment', 'Manual plan adjustment', fromSmoke(smoke.get('manual-plan-adjustment'), !!input.planRevisionHistory?.some(snapshot => snapshot.event !== 'submitted'), 'Plan revision history includes a manual adjustment.', 'No manual plan edit, refinement, rejection, or restore has been recorded.'), true, smoke.get('manual-plan-adjustment')?.evidence),
		milestone('approved-plan', 'Exact plan approved', readiness.approvedPlan, true, smoke.get('approval')?.evidence),
		milestone('parallel-safe', 'Parallel-safe merge-back', readiness.parallelMerge, !!input.parallelPlan && input.parallelPlan.requestedThreads > 1, smoke.get('parallel-safe')?.evidence),
		milestone('execution', 'Approval-gated execution evidence', readiness.execution, true),
		milestone('terminal-verification', 'Terminal/test verification', readiness.terminalVerification, true, smoke.get('terminal-verification')?.evidence),
		milestone('diff-review', 'Diff review decisions', readiness.diffReview, true, smoke.get('multi-file-diff')?.evidence),
		milestone('rollback', 'Rollback checkpoint coverage', readiness.rollbackCheckpoint, readiness.rollbackCheckpoint.status !== 'skipped', smoke.get('rollback')?.evidence),
		milestone('commit-handoff', 'Commit handoff prepared', {
			ready: !!input.commitHandoff?.ready,
			status: input.commitHandoff?.ready ? 'completed' : input.commitHandoff ? 'pending' : 'pending',
			detail: input.commitHandoff?.summary ?? 'Commit handoff has not been generated yet.',
		}, true, input.commitHandoff?.evidence.join(' ')),
		milestone('final-review', 'Final Review decision', readiness.finalReview, true, input.finalReview?.summary),
	];
}

function createCounts(terminalRuns: readonly VibeCodexCapturedTerminalRun[], verificationChecks: readonly VibeCodexVerificationCheck[], diffFiles: ExternalDiffReview['files'], milestones: readonly VibeCodexWorkflowMilestone[], checkpointFiles: number): VibeCodexWorkflowStatusCounts {
	const requiredChecks = verificationChecks.filter(check => check.required);
	return {
		terminalRuns: terminalRuns.length,
		runningTerminalRuns: terminalRuns.filter(run => run.status === 'running').length,
		passedTerminalRuns: terminalRuns.filter(run => run.status === 'passed').length,
		failedTerminalRuns: terminalRuns.filter(run => run.status === 'failed' || run.status === 'interrupted').length,
		diffFiles: diffFiles.length,
		acceptedDiffFiles: diffFiles.filter(file => file.status === 'accepted').length,
		pendingDiffFiles: diffFiles.filter(file => file.status === 'pending').length,
		rejectedDiffFiles: diffFiles.filter(file => file.status === 'rejected').length,
		verificationChecks: verificationChecks.length,
		requiredVerificationChecks: requiredChecks.length,
		passedRequiredVerificationChecks: requiredChecks.filter(check => check.status === 'passed').length,
		failedRequiredVerificationChecks: requiredChecks.filter(check => check.status === 'failed').length,
		pendingRequiredVerificationChecks: requiredChecks.filter(check => check.status === 'pending' || check.status === 'running').length,
		checkpointFiles,
		completedMilestones: milestones.filter(item => item.status === 'completed' || item.status === 'skipped').length,
		pendingMilestones: milestones.filter(item => item.status === 'pending' || item.status === 'in_progress').length,
		failedMilestones: milestones.filter(item => item.status === 'failed').length,
		blockedMilestones: milestones.filter(item => item.status === 'blocked').length,
	};
}

function workflowStage(input: VibeCodexWorkflowStatusInput, milestones: readonly VibeCodexWorkflowMilestone[], counts: VibeCodexWorkflowStatusCounts, readiness: VibeCodexWorkflowReadiness): VibeCodexWorkflowStage {
	const requiredFailed = milestones.some(item => item.required && (item.status === 'failed' || item.status === 'blocked'));
	if (input.finalReview?.decision === 'pass' && input.finalReview.ready) {
		return 'complete';
	}
	if (requiredFailed || input.finalReview?.blocked || input.deliveryBar?.blocked || counts.failedRequiredVerificationChecks > 0 || counts.failedTerminalRuns > 0) {
		return 'blocked';
	}
	if (input.finalReview || input.deliveryBar?.ready || input.smokeBenchmark?.ready || input.commitHandoff?.ready) {
		return 'final_review';
	}
	if (counts.pendingDiffFiles > 0 || counts.diffFiles > 0) {
		return 'reviewing';
	}
	if (readiness.rollbackCheckpoint.status === 'blocked') {
		return 'rollback';
	}
	if (counts.runningTerminalRuns > 0 || (input.authorization && (counts.terminalRuns > 0 || counts.requiredVerificationChecks > 0))) {
		return 'executing';
	}
	if (input.authorization) {
		return 'approved';
	}
	if (input.plan) {
		return 'planning';
	}
	return 'no_task';
}

function createSummary(stage: VibeCodexWorkflowStage, input: VibeCodexWorkflowStatusInput, counts: VibeCodexWorkflowStatusCounts, milestones: readonly VibeCodexWorkflowMilestone[]): string {
	const required = milestones.filter(item => item.required);
	const completed = required.filter(item => item.status === 'completed' || item.status === 'skipped').length;
	return redactSensitiveText([
		`Workflow stage: ${stage}.`,
		input.plan ? `Plan: ${input.plan.taskId} r${input.plan.revision}: ${input.plan.summary}` : 'No active visual plan.',
		`${completed}/${required.length} required lifecycle milestones complete.`,
		`${counts.passedRequiredVerificationChecks}/${counts.requiredVerificationChecks} required verification checks passed.`,
		`${counts.acceptedDiffFiles}/${counts.diffFiles} diff files accepted; ${counts.pendingDiffFiles} pending.`,
		input.finalReview ? `Final Review: ${input.finalReview.decision}.` : undefined,
	].filter((line): line is string => !!line).join('\n'));
}

function workflowEvidence(input: VibeCodexWorkflowStatusInput, terminalRuns: readonly VibeCodexCapturedTerminalRun[], diffFiles: ExternalDiffReview['files']): readonly string[] {
	const missingCheckpointPaths = missingRollbackCheckpointPaths(diffFiles.filter(file => file.status === 'accepted'), input.fileCheckpointPaths);
	return [
		input.deliveryBar?.summary,
		input.smokeBenchmark?.summary,
		input.finalReview?.summary,
		input.commitHandoff?.summary,
		input.taskCheckpointId ? `Rollback checkpoint: ${input.taskCheckpointId} (${input.fileCheckpointCount ?? 0} file checkpoint${input.fileCheckpointCount === 1 ? '' : 's'}${input.fileCheckpointPaths ? ', path-accurate coverage tracked' : ''}).` : undefined,
		missingCheckpointPaths.length ? `Missing rollback checkpoint paths: ${missingCheckpointPaths.slice(0, 8).join(', ')}.` : undefined,
		terminalRuns.length ? `Terminal runs: ${terminalRuns.slice(-5).map(run => `${run.commandLine} -> ${run.status}`).join('; ')}` : undefined,
		diffFiles.length ? `Diff files: ${diffFiles.slice(0, 8).map(file => `${file.path}=${file.status}`).join(', ')}` : undefined,
		input.diagnosticsSnapshot ? `Diagnostics: ${input.diagnosticsSnapshot.errors} errors, ${input.diagnosticsSnapshot.warnings} warnings.` : undefined,
	].filter((value): value is string => !!value).map(value => redactSensitiveText(value)).slice(0, 12);
}

function rollbackReadiness(input: VibeCodexWorkflowStatusInput, acceptedDiffs: ExternalDiffReview['files']): VibeCodexWorkflowReadinessItem {
	if (!acceptedDiffs.length) {
		return {
			ready: true,
			status: 'skipped',
			detail: 'No accepted diff files require rollback coverage yet.',
		};
	}
	const countCoversAccepted = (input.fileCheckpointCount ?? 0) >= acceptedDiffs.length;
	const missingCheckpointPaths = missingRollbackCheckpointPaths(acceptedDiffs, input.fileCheckpointPaths);
	const pathCoverageReady = input.fileCheckpointPaths ? missingCheckpointPaths.length === 0 : countCoversAccepted;
	const ready = !!input.taskCheckpointId && countCoversAccepted && pathCoverageReady;
	return {
		ready,
		status: ready ? 'completed' : 'blocked',
		detail: ready
			? `${input.taskCheckpointId} covers ${input.fileCheckpointCount ?? 0} accepted file checkpoint${input.fileCheckpointCount === 1 ? '' : 's'}${input.fileCheckpointPaths ? ' with path-accurate rollback coverage' : ''}.`
			: missingCheckpointPaths.length
				? `Accepted files missing checkpoint coverage: ${missingCheckpointPaths.join(', ')}.`
				: `${acceptedDiffs.length} accepted file${acceptedDiffs.length === 1 ? '' : 's'} need task/file checkpoint coverage.`,
	};
}

function missingRollbackCheckpointPaths(acceptedDiffs: ExternalDiffReview['files'], fileCheckpointPaths: readonly string[] | undefined): readonly string[] {
	if (!fileCheckpointPaths) {
		return [];
	}
	const checkpointPathSet = new Set(fileCheckpointPaths.map(normalizePath));
	return acceptedDiffs
		.filter(file => !checkpointPathSet.has(normalizePath(file.path)))
		.map(file => redactSensitiveText(file.path));
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\.\/+/, '').toLowerCase();
}

function workflowPromptBlock(response: Omit<VibeCodexWorkflowStatusResponse, 'promptBlock' | 'milestones' | 'evidence'>, milestones: readonly VibeCodexWorkflowMilestone[], evidence: readonly string[]): string {
	return redactSensitiveText(JSON.stringify(redactSensitiveValue({
		version: response.version,
		stage: response.stage,
		summary: response.summary,
		task: response.task,
		counts: response.counts,
		nextAction: response.nextAction,
		milestones: milestones.map(item => ({
			id: item.id,
			status: item.status,
			required: item.required,
			detail: item.detail,
		})),
		evidence,
		note: 'Workflow status is a read-only lifecycle proof. Do not claim delivery complete until Final Review passes and task completion is explicitly accepted.',
	}), null, 2));
}

function nextAction(stage: VibeCodexWorkflowStage, readiness: VibeCodexWorkflowReadiness, finalReview: VibeCodexFinalReviewState | undefined): string {
	if (stage === 'complete') {
		return finalReview?.nextAction ?? 'Task is ready for explicit completion acceptance and commit handoff.';
	}
	if (stage === 'blocked') {
		return 'Resolve failed or blocked lifecycle milestones, then request workflow_status again before attempting completion.';
	}
	if (!readiness.visualPlan.ready) {
		return 'Submit a structured visual plan with Strategy, Mermaid flowchart, checklist, risks, and acceptance criteria.';
	}
	if (!readiness.approvedPlan.ready) {
		return 'Refine, edit, reject, or approve the exact rendered plan revision before mutation.';
	}
	if (stage === 'reviewing') {
		return 'Review pending diffs with Accept File, Reject File, Accept All, Reject All, or checkpoint restore controls.';
	}
	if (stage === 'executing') {
		return 'Run required terminal/test checks and stream evidence back before diff/final review.';
	}
	if (stage === 'final_review') {
		return finalReview?.nextAction ?? 'Resolve Delivery Bar, Smoke Benchmark, Commit Handoff, and Final Review pending items.';
	}
	return 'Continue through the approved execution loop while preserving approval, diff, rollback, and verification gates.';
}

function milestone(id: string, title: string, readiness: VibeCodexWorkflowReadinessItem, required: boolean, evidence?: string): VibeCodexWorkflowMilestone {
	return {
		id,
		title,
		status: readiness.status,
		required,
		detail: readiness.detail,
		...(evidence ? { evidence: [redactSensitiveText(evidence)] } : {}),
	};
}

function fromDelivery(check: VibeCodexDeliveryBarState['checks'][number] | undefined, fallbackReady: boolean, fallbackDetail: string): VibeCodexWorkflowReadinessItem {
	if (!check) {
		return { ready: fallbackReady, status: fallbackReady ? 'completed' : 'pending', detail: redactSensitiveText(fallbackDetail) };
	}
	return {
		ready: check.status === 'passed' || check.status === 'skipped',
		status: check.status === 'passed' ? 'completed' : check.status === 'failed' ? 'blocked' : check.status === 'skipped' ? 'skipped' : 'pending',
		detail: redactSensitiveText(check.detail),
	};
}

function fromSmoke(milestone: VibeCodexSmokeBenchmarkState['milestones'][number] | undefined, fallbackReady: boolean, readyDetail: string, pendingDetail: string): VibeCodexWorkflowReadinessItem {
	if (!milestone) {
		return {
			ready: fallbackReady,
			status: fallbackReady ? 'completed' : 'pending',
			detail: fallbackReady ? readyDetail : pendingDetail,
		};
	}
	return {
		ready: milestone.status === 'passed' || milestone.status === 'skipped',
		status: milestone.status === 'passed' ? 'completed' : milestone.status === 'failed' ? 'failed' : milestone.status === 'skipped' ? 'skipped' : 'pending',
		detail: redactSensitiveText(milestone.evidence),
	};
}

function checkMap(deliveryBar: VibeCodexDeliveryBarState | undefined): Map<string, VibeCodexDeliveryBarState['checks'][number]> {
	return new Map((deliveryBar?.checks ?? []).map(check => [check.id, check]));
}

function milestoneMap(smokeBenchmark: VibeCodexSmokeBenchmarkState | undefined): Map<string, VibeCodexSmokeBenchmarkState['milestones'][number]> {
	return new Map((smokeBenchmark?.milestones ?? []).map(milestone => [milestone.id, milestone]));
}

function hasWorkflowState(input: VibeCodexWorkflowStatusInput, terminalRuns: readonly VibeCodexCapturedTerminalRun[], diffFiles: ExternalDiffReview['files']): boolean {
	return !!input.prompt
		|| !!input.inlinePromptSession
		|| !!input.plan
		|| !!input.authorization
		|| !!input.deliveryBar
		|| !!input.smokeBenchmark
		|| !!input.finalReview
		|| !!input.commitHandoff
		|| !!input.verificationPlan
		|| !!input.diagnosticsSnapshot
		|| terminalRuns.length > 0
		|| diffFiles.length > 0
		|| !!input.taskCheckpointId;
}

function isWorkflowStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return workflowStatusToolNames.has(tool);
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
