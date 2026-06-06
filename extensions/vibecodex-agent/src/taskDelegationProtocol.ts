/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexDelegatedTaskRequest {
	readonly id?: JsonRpcId;
	readonly method: string;
	readonly title: string;
	readonly prompt: string;
	readonly mode: string;
	readonly dependsOn: readonly string[];
	readonly parallelThreads: number;
	readonly parentTaskId?: string;
	readonly reason?: string;
	readonly subagentCount?: number;
	readonly subtaskCount?: number;
	readonly requestedAt: number;
}

const delegationMethods = new Set([
	'agent/newTask',
	'agent/task/new',
	'agent/delegateTask',
	'agent/useSubagents',
	'agent/useSubAgents',
	'agent/subagents',
	'task/new',
	'task/delegate',
	'task/subagents',
	'cline/new_task',
	'cline/use_subagents',
	'new_task',
	'use_subagents',
]);

const delegationToolNames = new Set([
	'new_task',
	'newtask',
	'delegate_task',
	'delegatetask',
	'use_subagents',
	'usesubagents',
	'use_subagent',
	'usesubagent',
	'subagents',
	'parallel_subagents',
	'agent_subagents',
]);

export function normalizeTaskDelegationRequest(message: JsonRpcMessage, activeTaskId?: string): VibeCodexDelegatedTaskRequest | undefined {
	if (!message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	const toolName = delegationToolName(message.method, payload, args);
	if (!delegationMethods.has(message.method) && !toolName) {
		return undefined;
	}
	const subagentPlan = createSubagentPlan(args, payload);
	const prompt = composePrompt(stringValue(args.prompt)
		?? stringValue(args.task)
		?? stringValue(args.instructions)
		?? stringValue(args.description)
		?? stringValue(args.context)
		?? stringValue(payload.prompt)
		?? stringValue(payload.task)
		?? stringValue(payload.description), subagentPlan);
	if (!prompt) {
		return undefined;
	}
	const title = stringValue(args.title)
		?? stringValue(args.name)
		?? stringValue(payload.title)
		?? subagentPlan?.title
		?? firstPromptLine(prompt);
	const mode = stringValue(args.mode)
		?? stringValue(payload.mode)
		?? 'agent';
	const parentTaskId = stringValue(args.parentTaskId)
		?? stringValue(args.parent_task_id)
		?? stringValue(payload.parentTaskId)
		?? activeTaskId;
	const dependsOn = arrayOfStrings(args.dependsOn)
		?? arrayOfStrings(args.depends_on)
		?? arrayOfStrings(payload.dependsOn)
		?? arrayOfStrings(payload.depends_on)
		?? (parentTaskId ? [parentTaskId] : []);
	const parallelThreads = numberValue(args.parallelThreads)
		?? numberValue(args.parallel_threads)
		?? numberValue(args.threadCount)
		?? numberValue(args.thread_count)
		?? numberValue(args.maxAgents)
		?? numberValue(args.max_agents)
		?? numberValue(args.workers)
		?? numberValue(payload.threadCount)
		?? numberValue(payload.thread_count)
		?? numberValue(payload.parallelThreads)
		?? subagentPlan?.parallelThreads
		?? 1;
	const reason = stringValue(args.reason)
		?? stringValue(payload.reason)
		?? (subagentPlan ? 'Cline-compatible subagent delegation request.' : undefined);
	return {
		...(message.id !== undefined ? { id: message.id } : {}),
		method: message.method,
		title: redactSensitiveText(title),
		prompt: redactSensitiveText(prompt),
		mode,
		dependsOn: dependsOn.map(redactSensitiveText),
		parallelThreads: clampParallelThreads(parallelThreads),
		...(parentTaskId ? { parentTaskId: redactSensitiveText(parentTaskId) } : {}),
		...(reason ? { reason: redactSensitiveText(reason) } : {}),
		...(subagentPlan?.subagentCount ? { subagentCount: subagentPlan.subagentCount } : {}),
		...(subagentPlan?.subtaskCount ? { subtaskCount: subagentPlan.subtaskCount } : {}),
		requestedAt: Date.now(),
	};
}

export function createTaskDelegationResponse(request: VibeCodexDelegatedTaskRequest, cardId: string | undefined): unknown {
	return {
		approved: !!cardId,
		queued: !!cardId,
		source: 'externalExtension',
		method: request.method,
		...(cardId ? { cardId } : {}),
		...(cardId ? {
			statusRequest: {
				method: 'agent/getTaskBoardStatus',
				cardId,
				includePrompts: false,
				includeEvidence: true,
			},
		} : {}),
		title: request.title,
		parallelThreads: request.parallelThreads,
		...(request.subagentCount ? { subagentCount: request.subagentCount } : {}),
		...(request.subtaskCount ? { subtaskCount: request.subtaskCount } : {}),
		guardrails: [
			'Delegated task requests only queue Task Board cards; they never start execution, approve plans, run terminal commands, accept diffs, or mutate workspace files.',
			'Starting a queued task still requires the normal Vibe Codex visual plan, exact revision approval, diff review, verification, and rollback gates.',
			'Cline-compatible use_subagents requests are intake-only coordination hints; parallel worktrees are prepared later through the normal approved-plan gate.',
		],
		message: cardId ? 'Delegated task queued on the Vibe Codex Task Board.' : 'Delegated task could not be queued.',
	};
}

interface SubagentPlan {
	readonly title?: string;
	readonly taskLines: readonly string[];
	readonly agentLines: readonly string[];
	readonly subagentCount: number;
	readonly subtaskCount: number;
	readonly parallelThreads: number;
}

function delegationToolName(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): string | undefined {
	if (method !== 'item/tool/call') {
		return undefined;
	}
	const tool = stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name);
	const normalized = tool?.replace(/\s+/g, '_').toLowerCase();
	return normalized && delegationToolNames.has(normalized) ? normalized : undefined;
}

function createSubagentPlan(args: Record<string, unknown>, payload: Record<string, unknown>): SubagentPlan | undefined {
	const payloadArgs: Record<string, unknown> = args === payload ? {} : payload;
	const taskLines = [
		...arrayOfTaskLines(args.subtasks),
		...arrayOfTaskLines(args.sub_tasks),
		...arrayOfTaskLines(args.tasks),
		...arrayOfTaskLines(payloadArgs.subtasks),
		...arrayOfTaskLines(payloadArgs.tasks),
	];
	const agentLines = [
		...arrayOfAgentLines(args.agents),
		...arrayOfAgentLines(args.subagents),
		...arrayOfAgentLines(args.sub_agents),
		...arrayOfAgentLines(payloadArgs.agents),
		...arrayOfAgentLines(payloadArgs.subagents),
	];
	const subagentCount = agentLines.length;
	const subtaskCount = taskLines.length;
	if (!subagentCount && !subtaskCount) {
		return undefined;
	}
	const titleSource = stringValue(args.title)
		?? stringValue(payload.title)
		?? firstPromptLine(taskLines[0] ?? agentLines[0] ?? 'Parallel subagents');
	return {
		title: titleSource.startsWith('Parallel subagents') ? titleSource : `Parallel subagents: ${titleSource}`,
		taskLines: taskLines.slice(0, 16),
		agentLines: agentLines.slice(0, 16),
		subagentCount,
		subtaskCount,
		parallelThreads: Math.max(subagentCount, subtaskCount, 1),
	};
}

function composePrompt(basePrompt: string | undefined, subagentPlan: SubagentPlan | undefined): string | undefined {
	if (!subagentPlan) {
		return basePrompt;
	}
	const sections = [
		basePrompt ?? 'Coordinate these subagents as one Vibe Codex Task Board item.',
		subagentPlan.taskLines.length ? `Subtasks:\n${subagentPlan.taskLines.map(line => `- ${line}`).join('\n')}` : undefined,
		subagentPlan.agentLines.length ? `Agent lanes:\n${subagentPlan.agentLines.map(line => `- ${line}`).join('\n')}` : undefined,
		'Do not execute the delegated work until the Vibe Codex visual plan is approved.',
	].filter((value): value is string => !!value);
	return sections.join('\n\n');
}

function arrayOfTaskLines(value: unknown): readonly string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((item, index) => taskLine(item, index)).filter((item): item is string => !!item);
}

function arrayOfAgentLines(value: unknown): readonly string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map((item, index) => agentLine(item, index)).filter((item): item is string => !!item);
}

function taskLine(value: unknown, index: number): string | undefined {
	if (typeof value === 'string') {
		return stringValue(value);
	}
	if (!isRecord(value)) {
		return undefined;
	}
	const title = stringValue(value.title) ?? stringValue(value.name) ?? `Subtask ${index + 1}`;
	const task = stringValue(value.task)
		?? stringValue(value.prompt)
		?? stringValue(value.instructions)
		?? stringValue(value.description)
		?? stringValue(value.context);
	return task ? `${title}: ${task}` : title;
}

function agentLine(value: unknown, index: number): string | undefined {
	if (typeof value === 'string') {
		return stringValue(value);
	}
	if (!isRecord(value)) {
		return undefined;
	}
	const role = stringValue(value.role)
		?? stringValue(value.name)
		?? stringValue(value.title)
		?? `Subagent ${index + 1}`;
	const task = stringValue(value.task)
		?? stringValue(value.prompt)
		?? stringValue(value.instructions)
		?? stringValue(value.description)
		?? stringValue(value.focus);
	return task ? `${role}: ${task}` : role;
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return payload;
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function firstPromptLine(prompt: string): string {
	return prompt.split(/\r?\n/, 1)[0].trim().slice(0, 72) || 'Delegated Vibe Codex task';
}

function arrayOfStrings(value: unknown): readonly string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	return value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) {
		return Number(value);
	}
	return undefined;
}

function clampParallelThreads(value: number): number {
	return Math.max(1, Math.min(8, Math.floor(Number.isFinite(value) ? value : 1)));
}

function stringValue(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length ? String(redactSensitiveValue(trimmed)) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
