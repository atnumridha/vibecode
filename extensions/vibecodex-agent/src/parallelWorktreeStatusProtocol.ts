/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexModePolicy } from './modePolicy';
import { modeAllowsAction } from './modePolicy';
import type { VibeCodexParallelPlan, VibeCodexParallelThread, VibeCodexParallelThreadStatus } from './multiAgent';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexParallelWorktreeStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly taskId?: string;
	readonly includeThreads: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexParallelWorktreeLaneStatus {
	readonly id: string;
	readonly role: VibeCodexParallelThread['role'];
	readonly branchName: string;
	readonly worktreePath?: string;
	readonly status: VibeCodexParallelThreadStatus;
	readonly statusDetail?: string;
	readonly branchSafe: boolean;
	readonly pathSafe: boolean;
	readonly pathUnderWorktreeRoot: boolean;
	readonly blockers: readonly string[];
}

export interface VibeCodexParallelWorktreeStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly activeTaskId?: string;
	readonly available: boolean;
	readonly enabled: boolean;
	readonly workspaceTrusted: boolean;
	readonly hasPlanAuthorization: boolean;
	readonly mode: {
		readonly mode: string;
		readonly label: string;
		readonly readOnly: boolean;
		readonly allowsToolRequests: boolean;
	};
	readonly root?: {
		readonly baseWorkspaceRoot?: string;
		readonly worktreeRoot?: string;
		readonly isolation?: VibeCodexParallelPlan['isolation'];
		readonly worktreeRootUnderWorkspace: boolean;
	};
	readonly counts: {
		readonly requestedThreads: number;
		readonly maxThreads: 8;
		readonly pending: number;
		readonly materialized: number;
		readonly failed: number;
		readonly skipped: number;
		readonly cleaned: number;
		readonly unsafe: number;
	};
	readonly readiness: {
		readonly canPrepare: boolean;
		readonly canCleanup: boolean;
		readonly blockedReasons: readonly string[];
	};
	readonly lanes?: readonly VibeCodexParallelWorktreeLaneStatus[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexParallelWorktreeStatusInput {
	readonly plan?: VibeCodexParallelPlan;
	readonly workspaceTrusted: boolean;
	readonly hasExecutionAuthorization: boolean;
	readonly modePolicy: VibeCodexModePolicy;
}

const parallelWorktreeStatusMethods = new Set([
	'agent/getParallelWorktreeStatus',
	'agent/parallelWorktreeStatus',
	'parallel/worktreeStatus',
	'parallelWorktree/status',
	'worktree/status',
	'worktree/parallelStatus',
	'vibecodex/parallelWorktreeStatus',
]);

const parallelWorktreeStatusToolNames = new Set([
	'parallel_worktree_status',
	'parallel_worktrees_status',
	'worktree_status',
	'parallel_lane_status',
	'get_parallel_worktree_status',
]);

export function normalizeParallelWorktreeStatusRequest(message: JsonRpcMessage): VibeCodexParallelWorktreeStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!parallelWorktreeStatusMethods.has(message.method) && !isParallelWorktreeStatusToolCall(message.method, payload, args)) {
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
		includeThreads: booleanValue(payload.includeThreads)
			?? booleanValue(payload.include_threads)
			?? booleanValue(args.includeThreads)
			?? booleanValue(args.include_threads)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createParallelWorktreeStatusResponse(request: VibeCodexParallelWorktreeStatusRequest, input: VibeCodexParallelWorktreeStatusInput): VibeCodexParallelWorktreeStatusResponse {
	const activeTaskId = input.plan?.taskId;
	if (request.taskId && activeTaskId && request.taskId !== activeTaskId) {
		return baseResponse(input, {
			ok: false,
			taskId: request.taskId,
			activeTaskId,
			available: false,
			enabled: false,
			counts: emptyCounts(),
			readiness: {
				canPrepare: false,
				canCleanup: false,
				blockedReasons: [`Requested task ${request.taskId} does not match active parallel task ${activeTaskId}.`],
			},
			message: `Parallel worktree task ${request.taskId} is not active; active task is ${activeTaskId}.`,
		});
	}
	if (!input.plan) {
		return baseResponse(input, {
			ok: false,
			available: false,
			enabled: false,
			counts: emptyCounts(),
			readiness: {
				canPrepare: false,
				canCleanup: false,
				blockedReasons: ['No parallel worktree plan is available.'],
			},
			message: 'No parallel worktree lifecycle status is available.',
		});
	}
	const plan = input.plan;
	const lanes = plan.threads.map(thread => laneStatus(plan, thread));
	const unsafeCount = lanes.filter(lane => lane.blockers.length > 0).length;
	const validationBlockers = planBlockers(plan, lanes);
	const readinessBlockers = readinessBlockersFor(input, plan, validationBlockers);
	const canOperate = readinessBlockers.length === 0;
	return baseResponse(input, {
		ok: true,
		taskId: plan.taskId,
		activeTaskId,
		available: true,
		enabled: plan.enabled,
		root: {
			...(plan.baseWorkspaceRoot ? { baseWorkspaceRoot: redactSensitiveText(plan.baseWorkspaceRoot) } : {}),
			...(plan.worktreeRoot ? { worktreeRoot: redactSensitiveText(plan.worktreeRoot) } : {}),
			isolation: plan.isolation,
			worktreeRootUnderWorkspace: worktreeRootUnderWorkspace(plan),
		},
		counts: {
			requestedThreads: plan.requestedThreads,
			maxThreads: plan.maxThreads,
			pending: countStatus(plan, 'pending'),
			materialized: countStatus(plan, 'materialized'),
			failed: countStatus(plan, 'failed'),
			skipped: countStatus(plan, 'skipped'),
			cleaned: countStatus(plan, 'cleaned'),
			unsafe: unsafeCount,
		},
		readiness: {
			canPrepare: canOperate,
			canCleanup: canOperate,
			blockedReasons: redactSensitiveValue(readinessBlockers) as readonly string[],
		},
		...(request.includeThreads ? { lanes } : {}),
		message: canOperate
			? `Parallel worktree lifecycle is ready for ${plan.requestedThreads} lane${plan.requestedThreads === 1 ? '' : 's'} on ${plan.taskId}.`
			: `Parallel worktree lifecycle is blocked for ${plan.taskId}: ${readinessBlockers.slice(0, 3).join('; ')}.`,
	});
}

export function parallelWorktreeStatusSummary(response: VibeCodexParallelWorktreeStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	const blockers = response.readiness.blockedReasons.length ? ` Blockers: ${response.readiness.blockedReasons.slice(0, 3).join('; ')}.` : '';
	return `Parallel worktree status ${response.taskId}: ${response.counts.requestedThreads}/${response.counts.maxThreads} lanes, prepare ${response.readiness.canPrepare ? 'ready' : 'blocked'}, cleanup ${response.readiness.canCleanup ? 'ready' : 'blocked'}.${blockers}`;
}

function baseResponse(input: VibeCodexParallelWorktreeStatusInput, partial: Omit<VibeCodexParallelWorktreeStatusResponse, 'source' | 'workspaceTrusted' | 'hasPlanAuthorization' | 'mode' | 'guardrails'>): VibeCodexParallelWorktreeStatusResponse {
	const response: VibeCodexParallelWorktreeStatusResponse = {
		source: 'externalExtension',
		workspaceTrusted: input.workspaceTrusted,
		hasPlanAuthorization: input.hasExecutionAuthorization,
		mode: {
			mode: input.modePolicy.mode,
			label: input.modePolicy.label,
			readOnly: input.modePolicy.readOnly,
			allowsToolRequests: modeAllowsAction(input.modePolicy, 'tool'),
		},
		guardrails: [
			'Parallel worktree status is read-only and never prepares, cleans, removes, checks out, merges, stages, writes, deletes, or mutates files.',
			'Preparing or cleaning isolated worktrees remains blocked until the exact visual plan revision is approved and the active mode allows tool requests.',
			'Worktrees must stay under the workspace .vibecodex/worktrees directory and use vibecodex/checkpoint/... branch names.',
			'Merge-back still requires judge review, selected recommended lane, normal diff review cards, verification evidence, and rollback checkpoint coverage.',
		],
		...partial,
	};
	return response;
}

function laneStatus(plan: VibeCodexParallelPlan, thread: VibeCodexParallelThread): VibeCodexParallelWorktreeLaneStatus {
	const blockers = [
		isSafeBranchName(thread.branchName) ? undefined : `Unsafe branch name for ${thread.id}.`,
		thread.worktreePath ? undefined : `Missing worktree path for ${thread.id}.`,
		thread.worktreePath && pathUnderWorktreeRoot(plan, thread.worktreePath) ? undefined : `Unsafe worktree path for ${thread.id}.`,
	].filter((value): value is string => !!value);
	return {
		id: thread.id,
		role: thread.role,
		branchName: redactSensitiveText(thread.branchName),
		...(thread.worktreePath ? { worktreePath: redactSensitiveText(thread.worktreePath) } : {}),
		status: thread.status,
		...(thread.statusDetail ? { statusDetail: redactSensitiveText(thread.statusDetail) } : {}),
		branchSafe: isSafeBranchName(thread.branchName),
		pathSafe: !!thread.worktreePath && pathUnderWorktreeRoot(plan, thread.worktreePath),
		pathUnderWorktreeRoot: !!thread.worktreePath && pathUnderWorktreeRoot(plan, thread.worktreePath),
		blockers: blockers.map(redactSensitiveText),
	};
}

function readinessBlockersFor(input: VibeCodexParallelWorktreeStatusInput, plan: VibeCodexParallelPlan, validationBlockers: readonly string[]): readonly string[] {
	return [
		plan.enabled ? undefined : 'Parallel agents are disabled for the active task; single-lane execution does not need worktree preparation.',
		input.workspaceTrusted ? undefined : 'Workspace is not trusted; git worktree lifecycle is blocked.',
		input.hasExecutionAuthorization ? undefined : 'Approve the exact visual plan revision before preparing or cleaning parallel worktrees.',
		modeAllowsAction(input.modePolicy, 'tool') ? undefined : `${input.modePolicy.label} Mode blocks tool requests for parallel worktree lifecycle.`,
		...validationBlockers,
	].filter((value): value is string => !!value);
}

function planBlockers(plan: VibeCodexParallelPlan, lanes: readonly VibeCodexParallelWorktreeLaneStatus[]): readonly string[] {
	return [
		plan.isolation === 'git-worktree' ? undefined : 'Only git-worktree isolation can be materialized by the extension.',
		plan.baseWorkspaceRoot ? undefined : 'Parallel plan is missing base workspace root.',
		plan.worktreeRoot ? undefined : 'Parallel plan is missing worktree root.',
		worktreeRootUnderWorkspace(plan) ? undefined : 'Worktree root must be inside the workspace .vibecodex/worktrees directory.',
		plan.requestedThreads <= plan.maxThreads ? undefined : 'Requested thread count exceeds the 8-lane maximum.',
		...lanes.flatMap(lane => lane.blockers),
	].filter((value): value is string => !!value);
}

function worktreeRootUnderWorkspace(plan: VibeCodexParallelPlan): boolean {
	if (!plan.baseWorkspaceRoot || !plan.worktreeRoot) {
		return false;
	}
	const baseRoot = normalizePath(plan.baseWorkspaceRoot);
	const worktreeRoot = normalizePath(plan.worktreeRoot);
	return worktreeRoot.startsWith(`${baseRoot}/.vibecodex/worktrees/`);
}

function pathUnderWorktreeRoot(plan: VibeCodexParallelPlan, value: string): boolean {
	if (!plan.worktreeRoot) {
		return false;
	}
	return normalizePath(value).startsWith(`${normalizePath(plan.worktreeRoot)}/`);
}

function countStatus(plan: VibeCodexParallelPlan, status: VibeCodexParallelThreadStatus): number {
	return plan.threads.filter(thread => thread.status === status).length;
}

function emptyCounts(): VibeCodexParallelWorktreeStatusResponse['counts'] {
	return {
		requestedThreads: 0,
		maxThreads: 8,
		pending: 0,
		materialized: 0,
		failed: 0,
		skipped: 0,
		cleaned: 0,
		unsafe: 0,
	};
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

function isParallelWorktreeStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return parallelWorktreeStatusToolNames.has(tool);
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
