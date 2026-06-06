/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { authorizationMatchesPlan, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexPlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexTerminalInsight } from './terminalInsight';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';
import type { VibeCodexVerificationStatus } from './verificationPlan';

export interface VibeCodexTerminalRemediationStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly taskId?: string;
	readonly runId?: string;
	readonly includePlan: boolean;
	readonly includeEvidence: boolean;
	readonly maxEvents: number;
	readonly requestedAt: number;
}

export interface VibeCodexTerminalRemediationEvent {
	readonly id: string;
	readonly taskId: string;
	readonly previousRevision: number;
	readonly revision: number;
	readonly createdAt: number;
	readonly runId: string;
	readonly commandLine: string;
	readonly status: VibeCodexCapturedTerminalRun['status'];
	readonly exitCode?: number;
	readonly signal?: string;
	readonly reason: string;
	readonly insightSummary: string;
	readonly findingKinds: readonly string[];
	readonly errorCount: number;
	readonly followUpPromptAvailable: boolean;
	readonly remediationStepIds: readonly string[];
	readonly failedStepIds: readonly string[];
	readonly verification?: {
		readonly checkId: string;
		readonly verificationStatus: VibeCodexVerificationStatus;
	};
	readonly evidence?: string;
}

export interface VibeCodexTerminalRemediationStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly requestedTaskId?: string;
	readonly requestedRunId?: string;
	readonly activeTaskId?: string;
	readonly activeRevision?: number;
	readonly hasExecutionAuthorization: boolean;
	readonly authorizationMatchesActivePlan: boolean;
	readonly mutationLocked: boolean;
	readonly total: number;
	readonly returned: number;
	readonly latestEventId?: string;
	readonly selectedEvent?: VibeCodexTerminalRemediationEvent;
	readonly events: readonly VibeCodexTerminalRemediationEvent[];
	readonly plan?: VibeCodexPlan;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexTerminalRemediationEventInput {
	readonly taskId: string;
	readonly previousRevision: number;
	readonly plan: VibeCodexPlan;
	readonly run: VibeCodexCapturedTerminalRun;
	readonly insight: VibeCodexTerminalInsight;
	readonly reason: string;
	readonly evidence?: string;
	readonly verification?: {
		readonly checkId: string;
		readonly verificationStatus: VibeCodexVerificationStatus;
	};
}

export interface VibeCodexTerminalRemediationStatusInput {
	readonly events: readonly VibeCodexTerminalRemediationEvent[];
	readonly activePlan?: VibeCodexPlan;
	readonly authorization?: VibeCodexExecutionAuthorization;
}

const terminalRemediationStatusMethods = new Set([
	'agent/getTerminalRemediationStatus',
	'agent/terminalRemediationStatus',
	'terminal/remediationStatus',
	'terminal/failureStatus',
	'remediation/status',
	'vibecodex/terminalRemediationStatus',
]);

const terminalRemediationStatusToolNames = new Set([
	'terminal_remediation_status',
	'get_terminal_remediation_status',
	'terminal_failure_status',
	'failure_remediation_status',
	'remediation_status',
]);

const defaultMaxEvents = 8;
const maxEventsLimit = 24;

export function normalizeTerminalRemediationStatusRequest(message: JsonRpcMessage): VibeCodexTerminalRemediationStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!terminalRemediationStatusMethods.has(message.method) && !isTerminalRemediationStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const taskId = stringValue(payload.taskId)
		?? stringValue(payload.task_id)
		?? stringValue(args.taskId)
		?? stringValue(args.task_id);
	const runId = stringValue(payload.runId)
		?? stringValue(payload.run_id)
		?? stringValue(args.runId)
		?? stringValue(args.run_id);
	return {
		id: message.id,
		method: message.method,
		...(taskId ? { taskId: redactSensitiveText(taskId) } : {}),
		...(runId ? { runId: redactSensitiveText(runId) } : {}),
		includePlan: booleanValue(payload.includePlan)
			?? booleanValue(payload.include_plan)
			?? booleanValue(args.includePlan)
			?? booleanValue(args.include_plan)
			?? false,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? false,
		maxEvents: clampNumber(
			numberValue(payload.maxEvents)
				?? numberValue(payload.max_events)
				?? numberValue(args.maxEvents)
				?? numberValue(args.max_events)
				?? defaultMaxEvents,
			1,
			maxEventsLimit,
		),
		requestedAt: Date.now(),
	};
}

export function createTerminalRemediationEvent(input: VibeCodexTerminalRemediationEventInput): VibeCodexTerminalRemediationEvent {
	const findingKinds = [...new Set(input.insight.findings.map(finding => finding.kind))];
	const errorCount = input.insight.findings.filter(finding => finding.severity === 'error').length;
	const remediationStepIds = input.plan.steps
		.filter(step => /^remediate-/i.test(step.id) || /remediate failure/i.test(step.title))
		.map(step => step.id);
	const failedStepIds = input.plan.steps
		.filter(step => step.status === 'failed')
		.map(step => step.id);
	return redactSensitiveValue({
		id: `terminal-remediation-${input.run.id}-${input.plan.revision}`,
		taskId: input.taskId,
		previousRevision: input.previousRevision,
		revision: input.plan.revision,
		createdAt: Date.now(),
		runId: input.run.id,
		commandLine: input.run.commandLine,
		status: input.run.status,
		...(typeof input.run.exitCode === 'number' ? { exitCode: input.run.exitCode } : {}),
		...(input.run.signal ? { signal: input.run.signal } : {}),
		reason: input.reason,
		insightSummary: input.insight.summary,
		findingKinds,
		errorCount,
		followUpPromptAvailable: !!input.insight.followUpPrompt,
		remediationStepIds,
		failedStepIds,
		...(input.verification ? { verification: input.verification } : {}),
		...(input.evidence ? { evidence: input.evidence } : {}),
	}) as VibeCodexTerminalRemediationEvent;
}

export function createTerminalRemediationStatusResponse(request: VibeCodexTerminalRemediationStatusRequest, input: VibeCodexTerminalRemediationStatusInput): VibeCodexTerminalRemediationStatusResponse {
	const filtered = input.events
		.filter(event => !request.taskId || event.taskId === request.taskId)
		.filter(event => !request.runId || event.runId === request.runId)
		.sort((first, second) => second.createdAt - first.createdAt);
	const returned = filtered.slice(0, request.maxEvents).map(event => request.includeEvidence ? event : withoutEvidence(event));
	const selectedEvent = request.runId ? returned.find(event => event.runId === request.runId) : returned[0];
	const authorizationMatchesActivePlan = authorizationMatchesPlan(input.authorization, input.activePlan);
	const mutationLocked = !!input.activePlan && !authorizationMatchesActivePlan;
	const ok = (!request.runId || !!selectedEvent) && filtered.length > 0;
	return {
		ok,
		source: 'externalExtension',
		...(request.taskId ? { requestedTaskId: request.taskId } : {}),
		...(request.runId ? { requestedRunId: request.runId } : {}),
		...(input.activePlan ? { activeTaskId: redactSensitiveText(input.activePlan.taskId), activeRevision: input.activePlan.revision } : {}),
		hasExecutionAuthorization: !!input.authorization,
		authorizationMatchesActivePlan,
		mutationLocked,
		total: filtered.length,
		returned: returned.length,
		...(returned[0] ? { latestEventId: returned[0].id } : {}),
		...(selectedEvent ? { selectedEvent } : {}),
		events: returned,
		...(request.includePlan && input.activePlan ? { plan: redactSensitiveValue(input.activePlan) as VibeCodexPlan } : {}),
		guardrails: [
			'Terminal remediation status is read-only and never starts, retries, interrupts, reruns, or approves terminal commands.',
			'Remediation revisions clear execution authorization until the exact updated visual plan revision is approved again.',
			'The response never applies diffs, accepts task completion, changes verification checks, or mutates workspace files.',
			'Command lines, evidence, findings, plans, and terminal text are redacted before returning to the backend.',
		],
		message: terminalRemediationStatusMessage(filtered.length, selectedEvent, mutationLocked),
	};
}

export function terminalRemediationStatusSummary(response: VibeCodexTerminalRemediationStatusResponse): string {
	const lock = response.mutationLocked ? ' Execution is locked until the remediation plan revision is approved.' : '';
	return `${response.message}${lock}`;
}

function withoutEvidence(event: VibeCodexTerminalRemediationEvent): VibeCodexTerminalRemediationEvent {
	const { evidence: _evidence, ...rest } = event;
	return rest;
}

function terminalRemediationStatusMessage(total: number, selectedEvent: VibeCodexTerminalRemediationEvent | undefined, mutationLocked: boolean): string {
	if (selectedEvent) {
		return `Returned terminal remediation ${selectedEvent.id}: plan r${selectedEvent.previousRevision} -> r${selectedEvent.revision}; ${selectedEvent.errorCount} error finding${selectedEvent.errorCount === 1 ? '' : 's'}.`;
	}
	return total
		? `Returned ${total} terminal remediation event${total === 1 ? '' : 's'}.`
		: mutationLocked ? 'No matching terminal remediation event was found; execution remains locked by the active plan.' : 'No terminal remediation events are available yet.';
}

function isTerminalRemediationStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return terminalRemediationStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function numberValue(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(number) ? number : undefined;
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
