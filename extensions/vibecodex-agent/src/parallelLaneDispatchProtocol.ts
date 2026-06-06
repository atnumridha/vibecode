/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCommandPermissionDecision } from './commandPermissions';
import type { ExternalApprovalCard } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexParallelPlan, VibeCodexParallelThread } from './multiAgent';
import { redactSensitiveText } from './secretFilters';

export interface VibeCodexParallelLaneDispatchRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly taskId: string;
	readonly threadId: string;
	readonly worktreePath?: string;
	readonly branchName?: string;
	readonly promptFocus?: string;
	readonly requestedAt: number;
}

export interface VibeCodexParallelLaneDispatchResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly accepted: boolean;
	readonly started: boolean;
	readonly runId?: string;
	readonly taskId: string;
	readonly threadId: string;
	readonly worktreePath: string;
	readonly branchName: string;
	readonly expectedResultMethod: 'agent/parallelResult';
	readonly message: string;
}

const parallelLaneDispatchMethods = new Set([
	'agent/dispatchParallelLane',
	'agent/parallel/dispatchLane',
	'parallel/dispatchLane',
	'parallel/laneDispatch',
	'vibecodex/dispatchParallelLane',
]);

const parallelLaneDispatchToolNames = new Set([
	'dispatch_parallel_lane',
	'parallel_dispatch_lane',
	'parallel_agent_dispatch_lane',
	'run_parallel_lane',
	'launch_parallel_lane',
]);

export function normalizeParallelLaneDispatchRequest(message: JsonRpcMessage): VibeCodexParallelLaneDispatchRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!parallelLaneDispatchMethods.has(message.method) && !isParallelLaneDispatchToolCall(message.method, payload, args)) {
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
	if (!taskId || !threadId) {
		return undefined;
	}
	const worktreePath = stringValue(payload.worktreePath)
		?? stringValue(payload.worktree_path)
		?? stringValue(args.worktreePath)
		?? stringValue(args.worktree_path);
	const branchName = stringValue(payload.branchName)
		?? stringValue(payload.branch_name)
		?? stringValue(args.branchName)
		?? stringValue(args.branch_name);
	const promptFocus = stringValue(payload.promptFocus)
		?? stringValue(payload.prompt_focus)
		?? stringValue(args.promptFocus)
		?? stringValue(args.prompt_focus);
	return {
		id: message.id,
		method: message.method,
		taskId: redactSensitiveText(taskId),
		threadId: redactSensitiveText(threadId),
		...(worktreePath ? { worktreePath: redactSensitiveText(worktreePath) } : {}),
		...(branchName ? { branchName: redactSensitiveText(branchName) } : {}),
		...(promptFocus ? { promptFocus: redactSensitiveText(promptFocus) } : {}),
		requestedAt: Date.now(),
	};
}

export function createParallelLaneDispatchApprovalCard(request: VibeCodexParallelLaneDispatchRequest, plan: VibeCodexParallelPlan, thread: VibeCodexParallelThread, commandLine: string, commandDecision: VibeCodexCommandPermissionDecision): ExternalApprovalCard {
	const worktreePath = thread.worktreePath ?? request.worktreePath;
	const branchName = thread.branchName || request.branchName || '';
	const promptFocus = request.promptFocus ?? thread.promptFocus;
	const blocked = commandDecision.blocked || !worktreePath;
	return {
		id: request.id,
		method: request.method,
		kind: 'terminal',
		title: `Dispatch ${thread.id}`,
		description: `Launch isolated parallel lane ${thread.id} for ${plan.taskId}.`,
		detail: [
			'Tool: dispatch_parallel_lane',
			`Task: ${plan.taskId}`,
			`Lane: ${thread.id}`,
			`Role: ${thread.role}`,
			`Branch: ${branchName}`,
			worktreePath ? `Worktree: ${worktreePath}` : 'Worktree: missing',
			`Expected result: agent/parallelResult`,
			`Focus: ${promptFocus}`,
			`Command: ${commandLine}`,
			commandDecision.reason,
			'This launches only after exact visual-plan approval and this explicit approval card.',
		].filter((value): value is string => !!value).map(redactSensitiveText).join('\n'),
		toolName: 'dispatch_parallel_lane',
		commandLine: redactSensitiveText(commandLine),
		...(worktreePath ? { cwd: redactSensitiveText(worktreePath) } : {}),
		reason: `Dispatch parallel Vibe Codex lane ${thread.id}.`,
		parallelDispatchTaskId: redactSensitiveText(plan.taskId),
		parallelDispatchThreadId: redactSensitiveText(thread.id),
		parallelDispatchBranchName: redactSensitiveText(branchName),
		...(worktreePath ? { parallelDispatchWorktreePath: redactSensitiveText(worktreePath) } : {}),
		parallelDispatchPromptFocus: redactSensitiveText(promptFocus),
		paths: worktreePath ? [redactSensitiveText(worktreePath)] : [],
		risk: blocked ? 'blocked' : 'medium',
		blocked,
		requestedAt: request.requestedAt,
	};
}

export function createParallelLaneDispatchResponse(card: ExternalApprovalCard, accepted: boolean, runId?: string): VibeCodexParallelLaneDispatchResponse {
	const taskId = card.parallelDispatchTaskId ?? '';
	const threadId = card.parallelDispatchThreadId ?? '';
	const worktreePath = card.parallelDispatchWorktreePath ?? card.cwd ?? '';
	const branchName = card.parallelDispatchBranchName ?? '';
	return {
		ok: accepted && !!runId && !card.blocked,
		source: 'externalExtension',
		accepted,
		started: accepted && !!runId && !card.blocked,
		...(runId ? { runId: redactSensitiveText(runId) } : {}),
		taskId: redactSensitiveText(taskId),
		threadId: redactSensitiveText(threadId),
		worktreePath: redactSensitiveText(worktreePath),
		branchName: redactSensitiveText(branchName),
		expectedResultMethod: 'agent/parallelResult',
		message: accepted && runId && !card.blocked
			? `Parallel lane ${threadId} started in ${worktreePath}.`
			: `Parallel lane ${threadId || 'unknown'} dispatch was declined.`,
	};
}

export function parallelLaneDispatchSummary(response: VibeCodexParallelLaneDispatchResponse): string {
	return response.started
		? `Parallel lane ${response.threadId} started; run ${response.runId}.`
		: `Parallel lane ${response.threadId || 'unknown'} dispatch declined.`;
}

function isParallelLaneDispatchToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return parallelLaneDispatchToolNames.has(tool);
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

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
