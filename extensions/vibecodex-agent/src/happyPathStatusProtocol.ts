/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexDeliveryBarStatusResponse } from './deliveryBarStatusProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexParallelLaneExecutionStatusResponse } from './parallelLaneExecutionStatusProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSmokeBenchmarkStatusResponse } from './smokeBenchmarkStatusProtocol';
import type { VibeCodexVerificationStatusResponse } from './verificationStatusProtocol';
import type { VibeCodexWorkflowMilestone, VibeCodexWorkflowMilestoneStatus, VibeCodexWorkflowReadinessItem, VibeCodexWorkflowStatusResponse } from './workflowStatusProtocol';

export type VibeCodexHappyPathRoute =
	| 'await_prompt'
	| 'await_visual_plan'
	| 'await_manual_plan_adjustment'
	| 'await_approval'
	| 'await_parallel_lane_dispatch'
	| 'await_terminal_verification'
	| 'await_diff_review'
	| 'await_rollback_checkpoint'
	| 'await_commit_handoff'
	| 'await_delivery_bar'
	| 'await_final_review'
	| 'ready_for_completion'
	| 'blocked'
	| 'unavailable';

export type VibeCodexHappyPathGateStatus = VibeCodexWorkflowMilestoneStatus | 'ready';

export interface VibeCodexHappyPathStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeGates: boolean;
	readonly includeEvidence: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexHappyPathGate {
	readonly id: string;
	readonly title: string;
	readonly route: VibeCodexHappyPathRoute;
	readonly ready: boolean;
	readonly required: boolean;
	readonly status: VibeCodexHappyPathGateStatus;
	readonly detail: string;
	readonly evidence?: readonly string[];
}

export interface VibeCodexHappyPathStatusCounts {
	readonly total: number;
	readonly required: number;
	readonly ready: number;
	readonly pending: number;
	readonly blocked: number;
	readonly failed: number;
	readonly skipped: number;
}

export interface VibeCodexHappyPathStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly route: VibeCodexHappyPathRoute;
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly summary: string;
	readonly counts: VibeCodexHappyPathStatusCounts;
	readonly gates?: readonly VibeCodexHappyPathGate[];
	readonly blockers: readonly string[];
	readonly evidence?: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexHappyPathStatusInput {
	readonly workflowStatus?: VibeCodexWorkflowStatusResponse;
	readonly smokeBenchmarkStatus?: VibeCodexSmokeBenchmarkStatusResponse;
	readonly deliveryBarStatus?: VibeCodexDeliveryBarStatusResponse;
	readonly finalReviewStatus?: VibeCodexVerificationStatusResponse;
	readonly parallelLaneExecutionStatus?: VibeCodexParallelLaneExecutionStatusResponse;
}

const happyPathStatusMethods = new Set([
	'agent/getHappyPathStatus',
	'agent/happyPathStatus',
	'workflow/happyPathStatus',
	'delivery/happyPathStatus',
	'delivery/proofStatus',
	'lifecycle/happyPathStatus',
	'vibecodex/happyPathStatus',
]);

const happyPathStatusToolNames = new Set([
	'happy_path_status',
	'delivery_proof_status',
	'workflow_happy_path_status',
	'e2e_workflow_status',
	'minimum_delivery_status',
	'delivery_path_status',
]);

export function normalizeHappyPathStatusRequest(message: JsonRpcMessage): VibeCodexHappyPathStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!happyPathStatusMethods.has(message.method) && !isHappyPathStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeGates: booleanValue(payload.includeGates)
			?? booleanValue(payload.include_gates)
			?? booleanValue(args.includeGates)
			?? booleanValue(args.include_gates)
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

export function createHappyPathStatusResponse(request: VibeCodexHappyPathStatusRequest, input: VibeCodexHappyPathStatusInput): VibeCodexHappyPathStatusResponse {
	const workflow = input.workflowStatus;
	const gates = createGates(input);
	const counts = countGates(gates);
	const ok = !!workflow?.ok || !!input.smokeBenchmarkStatus?.ok || !!input.deliveryBarStatus?.ok || !!input.finalReviewStatus?.ok || !!input.parallelLaneExecutionStatus?.ok;
	const blockingGate = gates.find(gate => gate.required && (gate.status === 'blocked' || gate.status === 'failed'));
	const pendingGate = gates.find(gate => gate.required && !gate.ready && gate.status !== 'skipped');
	const route = !ok ? 'unavailable' : blockingGate ? 'blocked' : pendingGate ? pendingGate.route : 'ready_for_completion';
	const blockers = createBlockers(input, blockingGate, pendingGate);
	const ready = ok && route === 'ready_for_completion';
	const response = {
		ok,
		source: 'externalExtension' as const,
		version: 1 as const,
		route,
		ready,
		blocked: route === 'blocked',
		summary: happyPathSummary(workflow, counts, route),
		counts,
		...(request.includeGates ? { gates: redactSensitiveValue(gates) as readonly VibeCodexHappyPathGate[] } : {}),
		blockers,
		...(request.includeEvidence ? { evidence: happyPathEvidence(input, gates) } : {}),
		nextAction: nextActionFor(route, input, pendingGate, blockingGate),
		guardrails: happyPathStatusGuardrails,
		message: ok
			? `Happy Path Proof routes to ${route}: ${counts.ready}/${counts.required} required gates ready.`
			: 'No Happy Path Proof is available yet.',
	};
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: happyPathPromptBlock(response, gates) } : {}),
	};
}

export function happyPathStatusSummary(response: VibeCodexHappyPathStatusResponse): string {
	return response.ok
		? `${response.message} Next: ${response.nextAction}`
		: response.message;
}

const happyPathStatusGuardrails = [
	'Happy Path Proof status is read-only and never approves plans, dispatches agents, prepares worktrees, runs tools, accepts diffs, restores checkpoints, stages commits, accepts completion, or mutates workspace files.',
	'The route is an orchestration hint composed from existing IDE proof state; every missing gate must still be satisfied through its normal visual-plan, approval, terminal, diff, rollback, and Final Review flow.',
	'Gates, blockers, evidence, prompt blocks, terminal summaries, paths, and plan text are redacted and bounded before they are returned to the backend.',
	'ready_for_completion is advisory until task completion is explicitly evaluated through agent/taskComplete, agent/attemptCompletion, or attempt_completion.',
];

function createGates(input: VibeCodexHappyPathStatusInput): readonly VibeCodexHappyPathGate[] {
	const workflow = input.workflowStatus;
	const milestones = new Map((workflow?.milestones ?? []).map(milestone => [milestone.id, milestone]));
	const readiness = workflow?.readiness;
	const manual = milestones.get('manual-plan-adjustment');
	const commit = milestones.get('commit-handoff');
	const delivery = input.deliveryBarStatus;
	const finalReview = input.finalReviewStatus?.finalReview;
	return [
		gateFromReadiness('native-prompt', 'Native prompt captured', 'await_prompt', readiness?.prompt, 'Start from sidebar chat, Ctrl/Cmd+K, command palette, task intake, or file selection.'),
		gateFromReadiness('visual-plan', 'Visual plan rendered', 'await_visual_plan', readiness?.visualPlan, 'Render Strategy, Mermaid flowchart, checklist, risks, and acceptance criteria.'),
		gateFromMilestone('manual-plan-adjustment', 'Manual plan adjustment', 'await_manual_plan_adjustment', manual, 'Record a manual checklist edit, refinement, rejection, or restored plan revision.'),
		gateFromReadiness('approved-plan', 'Exact plan approved', 'await_approval', readiness?.approvedPlan, 'Approve the exact rendered plan revision before mutation.'),
		parallelGate(input.parallelLaneExecutionStatus, readiness?.parallelMerge),
		gateFromReadiness('terminal-verification', 'Terminal/test verification', 'await_terminal_verification', readiness?.terminalVerification, 'Run or record required test/lint/build verification evidence.'),
		gateFromReadiness('diff-review', 'Diff review decisions', 'await_diff_review', readiness?.diffReview, 'Review all proposed files and accept or reject each diff.'),
		gateFromReadiness('rollback', 'Rollback checkpoint coverage', 'await_rollback_checkpoint', readiness?.rollbackCheckpoint, 'Create task/file checkpoint coverage for accepted files.'),
		gateFromMilestone('commit-handoff', 'Commit handoff prepared', 'await_commit_handoff', commit, 'Prepare commit handoff evidence after accepted diffs and verification.'),
		{
			id: 'delivery-bar',
			title: 'Delivery Bar ready',
			route: 'await_delivery_bar',
			ready: !!delivery?.ready,
			required: true,
			status: delivery?.ready ? 'completed' : delivery?.blocked ? 'blocked' : delivery?.ok ? 'pending' : 'pending',
			detail: delivery?.summary ?? 'Generate Delivery Bar checks from the current workflow state.',
			...(delivery?.blockers?.length ? { evidence: delivery.blockers.slice(0, 4).map(check => `${check.title}: ${check.status}`) } : {}),
		},
		{
			id: 'final-review',
			title: 'Final Review pass decision',
			route: 'await_final_review',
			ready: !!finalReview?.ready && finalReview.decision === 'pass',
			required: true,
			status: finalReview?.decision === 'pass' && finalReview.ready ? 'completed' : finalReview?.blocked ? 'blocked' : finalReview ? 'pending' : readiness?.finalReview?.status ?? 'pending',
			detail: finalReview?.summary ?? readiness?.finalReview?.detail ?? 'Request Final Review after Delivery Bar, Smoke Benchmark, rollback, and commit handoff are ready.',
			...(finalReview?.evidence?.length ? { evidence: finalReview.evidence.slice(0, 4) } : {}),
		},
	];
}

function gateFromReadiness(id: string, title: string, route: VibeCodexHappyPathRoute, item: VibeCodexWorkflowReadinessItem | undefined, fallback: string): VibeCodexHappyPathGate {
	return {
		id,
		title,
		route,
		ready: !!item?.ready || item?.status === 'completed' || item?.status === 'skipped',
		required: true,
		status: item?.status ?? 'pending',
		detail: item?.detail ?? fallback,
	};
}

function gateFromMilestone(id: string, title: string, route: VibeCodexHappyPathRoute, milestone: VibeCodexWorkflowMilestone | undefined, fallback: string): VibeCodexHappyPathGate {
	return {
		id,
		title,
		route,
		ready: !!milestone && (milestone.status === 'completed' || milestone.status === 'skipped'),
		required: milestone?.required ?? true,
		status: milestone?.status ?? 'pending',
		detail: milestone?.detail ?? fallback,
		...(milestone?.evidence?.length ? { evidence: milestone.evidence.slice(0, 4) } : {}),
	};
}

function parallelGate(status: VibeCodexParallelLaneExecutionStatusResponse | undefined, workflowParallel: VibeCodexWorkflowReadinessItem | undefined): VibeCodexHappyPathGate {
	if (!status || !status.available || !status.enabled || status.route === 'single_lane_execution') {
		return {
			id: 'parallel-lane-execution',
			title: 'Parallel lane execution readiness',
			route: 'await_parallel_lane_dispatch',
			ready: true,
			required: false,
			status: 'skipped',
			detail: 'Single-lane task or no active parallel plan; isolated lane dispatch is optional.',
		};
	}
	const workflowReady = !!workflowParallel?.ready || workflowParallel?.status === 'completed' || workflowParallel?.status === 'skipped';
	const ready = workflowReady || status.route === 'review_reported_result';
	const blocked = status.blocked || status.route === 'blocked' || status.route === 'repair_lane' || status.route === 'repair_request';
	return {
		id: 'parallel-lane-execution',
		title: 'Parallel lane execution readiness',
		route: 'await_parallel_lane_dispatch',
		ready,
		required: true,
		status: ready ? 'completed' : blocked ? 'blocked' : status.route === 'wait_for_result' ? 'in_progress' : 'pending',
		detail: `${status.message} Next: ${status.nextAction}`,
		...(status.blockers.length ? { evidence: status.blockers.slice(0, 4) } : {}),
	};
}

function countGates(gates: readonly VibeCodexHappyPathGate[]): VibeCodexHappyPathStatusCounts {
	const required = gates.filter(gate => gate.required);
	return {
		total: gates.length,
		required: required.length,
		ready: required.filter(gate => gate.ready).length,
		pending: required.filter(gate => gate.status === 'pending' || gate.status === 'in_progress').length,
		blocked: required.filter(gate => gate.status === 'blocked').length,
		failed: required.filter(gate => gate.status === 'failed').length,
		skipped: gates.filter(gate => gate.status === 'skipped').length,
	};
}

function createBlockers(input: VibeCodexHappyPathStatusInput, blockingGate: VibeCodexHappyPathGate | undefined, pendingGate: VibeCodexHappyPathGate | undefined): readonly string[] {
	return redactSensitiveValue([
		...(blockingGate ? [`${blockingGate.title}: ${blockingGate.detail}`] : []),
		...(input.smokeBenchmarkStatus?.blocked ? input.smokeBenchmarkStatus.blockers?.slice(0, 4).map(milestone => `${milestone.title}: ${milestone.evidence}`) ?? ['Smoke Benchmark is blocked.'] : []),
		...(input.deliveryBarStatus?.blocked ? input.deliveryBarStatus.blockers?.slice(0, 4).map(check => `${check.title}: ${check.detail}`) ?? ['Delivery Bar is blocked.'] : []),
		...(input.parallelLaneExecutionStatus?.blocked ? input.parallelLaneExecutionStatus.blockers.slice(0, 4) : []),
		...(pendingGate && !blockingGate ? [`Next required gate: ${pendingGate.title}. ${pendingGate.detail}`] : []),
	].filter(Boolean)) as readonly string[];
}

function nextActionFor(route: VibeCodexHappyPathRoute, input: VibeCodexHappyPathStatusInput, pendingGate: VibeCodexHappyPathGate | undefined, blockingGate: VibeCodexHappyPathGate | undefined): string {
	if (route === 'blocked') {
		return blockingGate
			? `Repair blocked Happy Path gate "${blockingGate.title}" before continuing.`
			: input.deliveryBarStatus?.nextAction ?? input.smokeBenchmarkStatus?.nextAction ?? input.parallelLaneExecutionStatus?.nextAction ?? 'Repair blocked workflow gates before continuing.';
	}
	if (route === 'ready_for_completion') {
		return 'Request task_completion_status or attempt_completion through the normal Final Review completion gate.';
	}
	if (route === 'unavailable') {
		return 'Start a task, render a visual plan, or request workflow_status before asking for Happy Path Proof.';
	}
	return pendingGate?.detail ?? 'Continue the approved workflow until the next Happy Path Proof gate is satisfied.';
}

function happyPathSummary(workflow: VibeCodexWorkflowStatusResponse | undefined, counts: VibeCodexHappyPathStatusCounts, route: VibeCodexHappyPathRoute): string {
	return redactSensitiveText([
		`Happy Path route: ${route}.`,
		workflow?.task?.taskId ? `Task: ${workflow.task.taskId} r${workflow.task.revision ?? 'n/a'}.` : 'No active task identity.',
		`${counts.ready}/${counts.required} required gates ready; ${counts.blocked + counts.failed} blocked or failed.`,
		workflow?.summary,
	].filter((line): line is string => !!line).join('\n'));
}

function happyPathEvidence(input: VibeCodexHappyPathStatusInput, gates: readonly VibeCodexHappyPathGate[]): readonly string[] {
	return [
		input.workflowStatus?.message,
		input.smokeBenchmarkStatus?.summary,
		input.deliveryBarStatus?.summary,
		input.finalReviewStatus?.finalReview?.summary,
		input.parallelLaneExecutionStatus?.message,
		...gates.filter(gate => gate.evidence?.length).slice(0, 6).map(gate => `${gate.title}: ${gate.evidence?.slice(0, 2).join('; ')}`),
	].filter((value): value is string => !!value).map(value => redactSensitiveText(value)).slice(0, 12);
}

function happyPathPromptBlock(response: Omit<VibeCodexHappyPathStatusResponse, 'promptBlock' | 'gates' | 'evidence'>, gates: readonly VibeCodexHappyPathGate[]): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'happy_path_status',
		route: response.route,
		ready: response.ready,
		blocked: response.blocked,
		counts: response.counts,
		blockers: response.blockers,
		nextAction: response.nextAction,
		gates: gates.map(gate => ({
			id: gate.id,
			route: gate.route,
			ready: gate.ready,
			required: gate.required,
			status: gate.status,
			detail: gate.detail,
		})),
		note: 'Happy Path Proof is read-only. Do not claim completion until task_completion_status or attempt_completion passes.',
	}), null, 2);
}

function isHappyPathStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return happyPathStatusToolNames.has(tool);
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
