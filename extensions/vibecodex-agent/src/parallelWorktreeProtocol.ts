/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { ExternalApprovalCard } from './executionProtocol';
import { VibeCodexParallelPlan } from './multiAgent';
import { VibeCodexWorktreeOperationResult } from './parallelWorktrees';
import { redactSensitiveText } from './secretFilters';

export type VibeCodexParallelWorktreeOperation = 'prepare' | 'cleanup';

export interface VibeCodexParallelWorktreeRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly operation: VibeCodexParallelWorktreeOperation;
	readonly taskId?: string;
	readonly requestedAt: number;
}

export interface VibeCodexParallelWorktreeResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly operation: VibeCodexParallelWorktreeOperation;
	readonly taskId?: string;
	readonly plan?: VibeCodexParallelPlan;
	readonly evidence: readonly string[];
	readonly message: string;
}

const prepareMethods = new Set([
	'agent/prepareParallelWorktrees',
	'agent/parallel/prepareWorktrees',
	'parallel/prepareWorktrees',
	'parallel.prepareWorktrees',
	'worktree/prepareParallelAgents',
]);

const cleanupMethods = new Set([
	'agent/cleanupParallelWorktrees',
	'agent/parallel/cleanupWorktrees',
	'parallel/cleanupWorktrees',
	'parallel.cleanupWorktrees',
	'worktree/cleanupParallelAgents',
]);

export function normalizeParallelWorktreeRequest(message: JsonRpcMessage): VibeCodexParallelWorktreeRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const operation = classifyOperation(message.method, payload, args);
	if (!operation) {
		return undefined;
	}
	const taskId = stringValue(payload.taskId) ?? stringValue(args.taskId);
	return {
		id: message.id,
		method: message.method,
		operation,
		...(taskId ? { taskId } : {}),
		requestedAt: Date.now(),
	};
}

export function createParallelWorktreeResponse(request: VibeCodexParallelWorktreeRequest, result: VibeCodexWorktreeOperationResult): VibeCodexParallelWorktreeResponse {
	const failed = result.plan.threads.some(thread => thread.status === 'failed');
	return {
		ok: !failed,
		source: 'externalExtension',
		operation: request.operation,
		taskId: result.plan.taskId,
		plan: result.plan,
		evidence: result.evidence,
		message: parallelWorktreeRequestSummary(request, result),
	};
}

export function createParallelWorktreeApprovalCard(request: VibeCodexParallelWorktreeRequest, plan: VibeCodexParallelPlan): ExternalApprovalCard {
	const operationLabel = request.operation === 'prepare' ? 'Prepare' : 'Clean';
	const toolName = request.operation === 'prepare' ? 'prepare_parallel_worktrees' : 'cleanup_parallel_worktrees';
	const paths = [
		plan.worktreeRoot,
		...plan.threads.map(thread => thread.worktreePath),
	].filter((value): value is string => !!value);
	return {
		id: request.id,
		method: request.method,
		kind: 'tool',
		title: `${operationLabel} parallel worktrees`,
		description: `${operationLabel} ${plan.requestedThreads} isolated git worktree lane${plan.requestedThreads === 1 ? '' : 's'} for ${plan.taskId}.`,
		detail: [
			`Tool: ${toolName}`,
			`Task: ${plan.taskId}`,
			`Operation: ${request.operation}`,
			`Isolation: ${plan.isolation}`,
			plan.worktreeRoot ? `Worktree root: ${plan.worktreeRoot}` : undefined,
			`Lanes: ${plan.threads.map(thread => `${thread.id}:${thread.branchName}`).join(', ')}`,
			'This request still runs only after exact visual-plan approval and this explicit approval card.',
		].filter((value): value is string => !!value).map(redactSensitiveText).join('\n'),
		toolName,
		reason: `${operationLabel} isolated parallel Vibe Codex agent worktrees.`,
		parallelWorktreeOperation: request.operation,
		parallelTaskId: plan.taskId,
		paths: paths.map(redactSensitiveText),
		risk: request.operation === 'cleanup' ? 'high' : 'medium',
		blocked: false,
		requestedAt: request.requestedAt,
	};
}

export function parallelWorktreeRequestSummary(request: VibeCodexParallelWorktreeRequest, result?: VibeCodexWorktreeOperationResult): string {
	const verb = request.operation === 'prepare' ? 'prepared' : 'cleaned';
	if (!result) {
		return `${request.operation === 'prepare' ? 'Prepare' : 'Cleanup'} parallel worktrees requested${request.taskId ? ` for ${request.taskId}` : ''}.`;
	}
	const failed = result.plan.threads.some(thread => thread.status === 'failed');
	const count = result.plan.threads.length;
	return `${failed ? 'Failed to finish' : 'Successfully'} ${verb} ${count} parallel worktree lane${count === 1 ? '' : 's'} for ${result.plan.taskId}.`;
}

function classifyOperation(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): VibeCodexParallelWorktreeOperation | undefined {
	if (prepareMethods.has(method)) {
		return 'prepare';
	}
	if (cleanupMethods.has(method)) {
		return 'cleanup';
	}
	if (method !== 'item/tool/call') {
		return undefined;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	const operation = (stringValue(payload.operation) ?? stringValue(args.operation) ?? '').toLowerCase();
	if (tool === 'parallel.prepareworktrees' || tool === 'prepare_parallel_worktrees' || tool === 'prepare_parallel_agents' || operation === 'prepare_parallel_worktrees') {
		return 'prepare';
	}
	if (tool === 'parallel.cleanupworktrees' || tool === 'cleanup_parallel_worktrees' || tool === 'cleanup_parallel_agents' || operation === 'cleanup_parallel_worktrees') {
		return 'cleanup';
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
