/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexPlanRevisionSnapshot, planRevisionHistoryMarkdown } from './planHistory';
import { VibeCodexPlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import { VibeCodexTranscriptEvent, transcriptMarkdown } from './transcript';

export interface VibeCodexTaskSummaryRequest {
	readonly id?: JsonRpcId;
	readonly method: string;
	readonly purpose: string;
	readonly maxChars: number;
	readonly includePlan: boolean;
	readonly includeTranscript: boolean;
	readonly includeEvidence: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexTaskSummaryInput {
	readonly sessionId?: string;
	readonly taskId?: string;
	readonly mode?: string;
	readonly status?: string;
	readonly prompt?: string;
	readonly plan?: VibeCodexPlan;
	readonly planRevisionHistory?: readonly VibeCodexPlanRevisionSnapshot[];
	readonly contextSummary?: string;
	readonly providerSummary?: string;
	readonly parallelSummary?: string;
	readonly verificationSummary?: string;
	readonly workspaceGuidanceSummary?: string;
	readonly docsContextSummary?: string;
	readonly memoryBankSummary?: string;
	readonly previewSummary?: string;
	readonly mcpSummary?: string;
	readonly ruleProposalSummary?: string;
	readonly taskBoardSummary?: string;
	readonly transcriptEvents?: readonly VibeCodexTranscriptEvent[];
	readonly evidence?: readonly string[];
}

const taskSummaryMethods = new Set([
	'agent/summarizeTask',
	'agent/taskSummary',
	'agent/task/summarize',
	'agent/condenseTask',
	'agent/task/condense',
	'agent/condense',
	'task/summarize',
	'task/condense',
	'cline/summarize_task',
	'cline/condense',
	'summarize_task',
	'condense',
]);

const defaultMaxSummaryChars = 8000;
const minSummaryChars = 500;
const maxSummaryChars = 24000;
const transcriptTailEvents = 12;
const revisionTailCount = 8;

export function normalizeTaskSummaryRequest(message: JsonRpcMessage): VibeCodexTaskSummaryRequest | undefined {
	if (!message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!taskSummaryMethods.has(message.method) && !isTaskSummaryToolCall(message.method, payload, args)) {
		return undefined;
	}
	const purpose = stringValue(args.purpose)
		?? stringValue(args.reason)
		?? stringValue(args.context)
		?? stringValue(payload.purpose)
		?? 'Condense the active Vibe Codex task into safe handoff context.';
	const maxChars = numberValue(args.maxChars)
		?? numberValue(args.max_chars)
		?? numberValue(args.tokenBudget)
		?? numberValue(args.token_budget)
		?? numberValue(payload.maxChars)
		?? defaultMaxSummaryChars;
	return {
		...(message.id !== undefined ? { id: message.id } : {}),
		method: message.method,
		purpose,
		maxChars: clampNumber(maxChars, minSummaryChars, maxSummaryChars),
		includePlan: booleanValue(args.includePlan) ?? booleanValue(args.include_plan) ?? true,
		includeTranscript: booleanValue(args.includeTranscript) ?? booleanValue(args.include_transcript) ?? true,
		includeEvidence: booleanValue(args.includeEvidence) ?? booleanValue(args.include_evidence) ?? true,
		requestedAt: Date.now(),
	};
}

export function createTaskSummaryResponse(request: VibeCodexTaskSummaryRequest, input: VibeCodexTaskSummaryInput): Record<string, unknown> {
	const fullMarkdown = taskSummaryMarkdown(request, input);
	const markdown = truncateText(fullMarkdown, request.maxChars);
	return {
		ok: true,
		source: 'externalExtension',
		method: request.method,
		generatedAt: Date.now(),
		purpose: request.purpose,
		sessionId: input.sessionId,
		taskId: input.taskId,
		mode: input.mode,
		status: input.status,
		truncated: markdown.length < fullMarkdown.length,
		maxChars: request.maxChars,
		summary: taskSummaryHeadline(input),
		markdown,
		condensedPrompt: markdown,
		sections: taskSummarySections(request, input),
		guardrails: taskSummaryGuardrails(),
		note: 'This summary is read-only handoff context. It is not an execution approval or approval token.',
	};
}

export function taskSummaryRequestSummary(request: VibeCodexTaskSummaryRequest): string {
	return `${request.method} requested a redacted task summary capped at ${request.maxChars} characters. Plan: ${request.includePlan ? 'yes' : 'no'}; transcript: ${request.includeTranscript ? 'yes' : 'no'}; evidence: ${request.includeEvidence ? 'yes' : 'no'}.`;
}

function taskSummaryMarkdown(request: VibeCodexTaskSummaryRequest, input: VibeCodexTaskSummaryInput): string {
	const plan = request.includePlan ? input.plan : undefined;
	const revisions = request.includePlan ? input.planRevisionHistory?.slice(0, revisionTailCount) ?? [] : [];
	const transcript = request.includeTranscript ? transcriptMarkdown(input.transcriptEvents?.slice(0, transcriptTailEvents) ?? []) : '';
	const evidence = request.includeEvidence ? input.evidence ?? [] : [];
	const sections = [
		'# Vibe Codex Task Summary',
		'',
		`- Purpose: ${request.purpose}`,
		input.sessionId ? `- Session: ${input.sessionId}` : undefined,
		input.taskId ? `- Task: ${input.taskId}` : undefined,
		input.mode ? `- Mode: ${input.mode}` : undefined,
		input.status ? `- Status: ${input.status}` : undefined,
		'',
		'## Original Prompt',
		'',
		input.prompt || '(no active prompt)',
		plan ? `\n## Current Visual Plan\n\nRevision ${plan.revision}: ${plan.summary}\n\n${plan.strategy}\n\nSteps:\n${plan.steps.map(step => `- [${step.status === 'completed' ? 'x' : ' '}] ${step.id}: ${step.title} (${step.status})`).join('\n')}${plan.acceptanceCriteria?.length ? `\n\nAcceptance criteria:\n${plan.acceptanceCriteria.map(item => `- ${item}`).join('\n')}` : ''}${plan.risks?.length ? `\n\nRisks:\n${plan.risks.map(item => `- ${item}`).join('\n')}` : ''}\n\nFlowchart:\n\n\`\`\`mermaid\n${plan.flowchart}\n\`\`\`` : undefined,
		revisions.length ? `\n## Plan Revision Tail\n\n${planRevisionHistoryMarkdown(revisions)}` : undefined,
		compactContextSection(input),
		evidence.length ? `\n## Verification And Evidence\n\n${evidence.map(item => `- ${item}`).join('\n')}` : undefined,
		transcript ? `\n## Transcript Tail\n\n${transcript}` : undefined,
		'\n## Handoff Rules\n\n- Treat this as compact context only, not approval.\n- Re-enter Plan Mode before any new mutation unless the backend already has the current exact plan authorization.\n- Keep file writes, terminal commands, browser/MCP calls, and diff acceptance behind the existing approval gates.',
	];
	return redactSensitiveText(sections.filter((value): value is string => value !== undefined).join('\n'));
}

function compactContextSection(input: VibeCodexTaskSummaryInput): string | undefined {
	const items = [
		input.providerSummary ? `Provider: ${input.providerSummary}` : undefined,
		input.contextSummary ? `Workspace context: ${input.contextSummary}` : undefined,
		input.parallelSummary ? `Parallel agents: ${input.parallelSummary}` : undefined,
		input.verificationSummary ? `Verification: ${input.verificationSummary}` : undefined,
		input.workspaceGuidanceSummary ? `Rules/skills/hooks: ${input.workspaceGuidanceSummary}` : undefined,
		input.ruleProposalSummary ? `Rule proposal: ${input.ruleProposalSummary}` : undefined,
		input.docsContextSummary ? `Docs: ${input.docsContextSummary}` : undefined,
		input.memoryBankSummary ? `Memory Bank: ${input.memoryBankSummary}` : undefined,
		input.previewSummary ? `Previews: ${input.previewSummary}` : undefined,
		input.mcpSummary ? `MCP: ${input.mcpSummary}` : undefined,
		input.taskBoardSummary ? `Task Board: ${input.taskBoardSummary}` : undefined,
	].filter((value): value is string => value !== undefined);
	return items.length ? `\n## Active Context\n\n${items.map(item => `- ${item}`).join('\n')}` : undefined;
}

function taskSummaryHeadline(input: VibeCodexTaskSummaryInput): string {
	const subject = input.taskId ?? input.sessionId ?? 'active task';
	const plan = input.plan ? `; plan r${input.plan.revision}: ${input.plan.summary}` : '';
	return redactSensitiveText(`Condensed handoff for ${subject}${input.mode ? ` in ${input.mode} mode` : ''}${plan}.`);
}

function taskSummarySections(request: VibeCodexTaskSummaryRequest, input: VibeCodexTaskSummaryInput): readonly string[] {
	return [
		'originalPrompt',
		request.includePlan && input.plan ? 'currentVisualPlan' : undefined,
		request.includePlan && input.planRevisionHistory?.length ? 'planRevisionTail' : undefined,
		compactContextSection(input) ? 'activeContext' : undefined,
		request.includeEvidence && input.evidence?.length ? 'verificationAndEvidence' : undefined,
		request.includeTranscript && input.transcriptEvents?.length ? 'transcriptTail' : undefined,
		'handoffRules',
	].filter((section): section is string => !!section);
}

function taskSummaryGuardrails(): readonly string[] {
	return [
		'Task summary is read-only continuation context and never approves a plan, accepts completion, exposes approval tokens, or unlocks mutation.',
		'Markdown is capped, transcript tails are bounded, and secrets are redacted before returning to the backend.',
		'Backends must re-check active plan authorization before writing files, running terminal commands, accepting diffs, calling tools, or claiming completion.',
	];
}

function isTaskSummaryToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name);
		return tool === 'task_summary'
			|| tool === 'summarize_task'
			|| tool === 'summarizeTask'
		|| tool === 'condense'
		|| tool === 'condense_task'
		|| tool === 'condenseTask';
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return payload;
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
			return true;
		}
		if (normalized === 'false' || normalized === 'no' || normalized === '0') {
			return false;
		}
	}
	return undefined;
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

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : defaultMaxSummaryChars)));
}

function stringValue(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length ? String(redactSensitiveValue(trimmed)) : undefined;
}

function truncateText(value: string, maxChars: number): string {
	if (value.length <= maxChars) {
		return value;
	}
	const suffix = '\n\n[Task summary truncated by client cap]';
	return `${value.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
