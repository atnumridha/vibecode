/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexFinalReviewState } from './finalReview';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexTaskCompletionResponse } from './taskCompletionProtocol';

export interface VibeCodexTaskCompletionStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeLatest: boolean;
	readonly includeBlockers: boolean;
	readonly includeEvidence: boolean;
	readonly includePromptBlock: boolean;
	readonly includeResult: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexTaskCompletionGateStatus {
	readonly decision: 'pass' | 'block' | 'unknown';
	readonly ready: boolean;
	readonly required: number;
	readonly passed: number;
	readonly pending: number;
	readonly blocked: number;
	readonly blockerIds: readonly string[];
	readonly pendingIds: readonly string[];
}

export interface VibeCodexTaskCompletionLatestAttempt {
	readonly accepted: boolean;
	readonly decision: 'accept' | 'block';
	readonly completionKind: VibeCodexTaskCompletionResponse['completionKind'];
	readonly finalReviewRequired: boolean;
	readonly advisoryReason?: string;
	readonly message: string;
	readonly result?: string;
	readonly nextAction: string;
}

export interface VibeCodexTaskCompletionStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly state: 'unavailable' | 'ready' | 'accepted' | 'advisory' | 'blocked' | 'pending';
	readonly ready: boolean;
	readonly accepted: boolean;
	readonly latestAttempt: boolean;
	readonly summary: string;
	readonly gate: VibeCodexTaskCompletionGateStatus;
	readonly latest?: VibeCodexTaskCompletionLatestAttempt;
	readonly blockers?: readonly string[];
	readonly evidence?: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexTaskCompletionStatusInput {
	readonly finalReview?: VibeCodexFinalReviewState;
	readonly latestCompletion?: VibeCodexTaskCompletionResponse;
}

const taskCompletionStatusMethods = new Set([
	'agent/getTaskCompletionStatus',
	'agent/taskCompletionStatus',
	'agent/getCompletionGateStatus',
	'completion/status',
	'completion/gateStatus',
	'taskCompletion/status',
	'task/completionStatus',
	'vibecodex/taskCompletionStatus',
]);

const taskCompletionStatusToolNames = new Set([
	'task_completion_status',
	'completion_gate_status',
	'completion_status',
	'completion_readiness_status',
]);

export function normalizeTaskCompletionStatusRequest(message: JsonRpcMessage): VibeCodexTaskCompletionStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!taskCompletionStatusMethods.has(message.method) && !isTaskCompletionStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeLatest: booleanValue(payload.includeLatest)
			?? booleanValue(payload.include_latest)
			?? booleanValue(args.includeLatest)
			?? booleanValue(args.include_latest)
			?? true,
		includeBlockers: booleanValue(payload.includeBlockers)
			?? booleanValue(payload.include_blockers)
			?? booleanValue(args.includeBlockers)
			?? booleanValue(args.include_blockers)
			?? true,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		includeResult: booleanValue(payload.includeResult)
			?? booleanValue(payload.include_result)
			?? booleanValue(args.includeResult)
			?? booleanValue(args.include_result)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createTaskCompletionStatusResponse(request: VibeCodexTaskCompletionStatusRequest, input: VibeCodexTaskCompletionStatusInput): VibeCodexTaskCompletionStatusResponse {
	const finalReview = input.finalReview ?? input.latestCompletion?.finalReview;
	const gate = finalReview ? completionGate(finalReview) : emptyGate();
	const latest = input.latestCompletion ? latestAttempt(input.latestCompletion, request.includeResult) : undefined;
	const blockers = finalReview ? completionBlockers(finalReview) : [];
	const evidence = finalReview?.evidence.map(item => redactSensitiveText(item)).slice(0, 12) ?? [];
	const state = completionState(finalReview, latest);
	const response = {
		ok: !!finalReview,
		source: 'externalExtension' as const,
		version: 1 as const,
		state,
		ready: gate.ready,
		accepted: latest?.accepted ?? false,
		latestAttempt: !!latest,
		summary: taskCompletionStatusText(finalReview, latest, gate),
		gate,
		...(request.includeLatest && latest ? { latest } : {}),
		...(request.includeBlockers ? { blockers } : {}),
		...(request.includeEvidence ? { evidence } : {}),
		nextAction: taskCompletionNextAction(finalReview, latest, blockers),
		guardrails: taskCompletionStatusGuardrails,
		message: finalReview
			? latest
				? `Task completion gate status returned from the latest ${latest.completionKind} attempt.`
				: 'Task completion gate status returned from current Final Review readiness.'
			: 'No task completion gate is available yet.',
	};
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: taskCompletionStatusPromptBlock(response) } : {}),
	};
}

export function taskCompletionStatusSummary(response: VibeCodexTaskCompletionStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	return `${response.summary} Next: ${response.nextAction}`;
}

const taskCompletionStatusGuardrails = [
	'Task completion status is read-only and never accepts completion, runs checks, changes Final Review or Delivery Bar state, stages commits, restores checkpoints, or mutates workspace files.',
	'Backends must call attempt_completion, submit_and_exit, or agent/taskComplete separately to request completion acceptance; this status tool only reports readiness.',
	'Completion results, blockers, evidence, summaries, and prompt blocks are redacted before they are returned to the backend.',
];

function completionGate(finalReview: VibeCodexFinalReviewState): VibeCodexTaskCompletionGateStatus {
	const required = finalReview.items.filter(item => item.required);
	const passed = required.filter(item => item.status === 'passed');
	const pending = required.filter(item => item.status === 'pending');
	const blocked = required.filter(item => item.status === 'blocked');
	return {
		decision: finalReview.decision,
		ready: finalReview.ready,
		required: required.length,
		passed: passed.length,
		pending: pending.length,
		blocked: blocked.length,
		blockerIds: blocked.map(item => redactSensitiveText(item.id)),
		pendingIds: pending.map(item => redactSensitiveText(item.id)),
	};
}

function emptyGate(): VibeCodexTaskCompletionGateStatus {
	return {
		decision: 'unknown',
		ready: false,
		required: 0,
		passed: 0,
		pending: 0,
		blocked: 0,
		blockerIds: [],
		pendingIds: [],
	};
}

function latestAttempt(response: VibeCodexTaskCompletionResponse, includeResult: boolean): VibeCodexTaskCompletionLatestAttempt {
	return {
		accepted: response.accepted,
		decision: response.decision,
		completionKind: response.completionKind,
		finalReviewRequired: response.finalReviewRequired,
		...(response.advisoryReason ? { advisoryReason: redactSensitiveText(response.advisoryReason) } : {}),
		message: redactSensitiveText(response.message),
		...(includeResult ? { result: redactSensitiveText(response.result).slice(0, 4000) } : {}),
		nextAction: redactSensitiveText(response.nextAction),
	};
}

function completionBlockers(finalReview: VibeCodexFinalReviewState): readonly string[] {
	return finalReview.items
		.filter(item => item.required && item.status !== 'passed')
		.map(item => redactSensitiveText(`${item.title}: ${item.detail}`));
}

function completionState(finalReview: VibeCodexFinalReviewState | undefined, latest: VibeCodexTaskCompletionLatestAttempt | undefined): VibeCodexTaskCompletionStatusResponse['state'] {
	if (!finalReview) {
		return 'unavailable';
	}
	if (latest?.accepted && latest.completionKind === 'final_review') {
		return 'accepted';
	}
	if (latest?.accepted && latest.completionKind === 'read_only_advisory') {
		return 'advisory';
	}
	if (latest && !latest.accepted) {
		return 'blocked';
	}
	if (finalReview.ready && finalReview.decision === 'pass') {
		return 'ready';
	}
	return finalReview.blocked ? 'blocked' : 'pending';
}

function taskCompletionStatusText(finalReview: VibeCodexFinalReviewState | undefined, latest: VibeCodexTaskCompletionLatestAttempt | undefined, gate: VibeCodexTaskCompletionGateStatus): string {
	if (!finalReview) {
		return 'No Final Review has been produced yet, so task completion readiness cannot be inspected.';
	}
	const attempt = latest
		? ` Latest completion attempt: ${latest.decision} (${latest.completionKind}).`
		: ' No completion attempt has been made yet.';
	return `${redactSensitiveText(finalReview.summary)} Required gate: ${gate.passed}/${gate.required} passed, ${gate.pending} pending, ${gate.blocked} blocked.${attempt}`;
}

function taskCompletionNextAction(finalReview: VibeCodexFinalReviewState | undefined, latest: VibeCodexTaskCompletionLatestAttempt | undefined, blockers: readonly string[]): string {
	if (!finalReview) {
		return 'Start a task and request workflow_status or final_review_status after a visual plan is available.';
	}
	if (latest?.accepted && latest.completionKind === 'final_review') {
		return finalReview.nextAction;
	}
	if (latest?.accepted && latest.completionKind === 'read_only_advisory') {
		return latest.nextAction;
	}
	if (finalReview.ready && finalReview.decision === 'pass') {
		return 'Task completion is ready; call attempt_completion, submit_and_exit, or agent/taskComplete to request explicit acceptance.';
	}
	return blockers[0] ?? finalReview.nextAction;
}

function taskCompletionStatusPromptBlock(response: Omit<VibeCodexTaskCompletionStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'task_completion_status',
		state: response.state,
		ready: response.ready,
		accepted: response.accepted,
		latestAttempt: response.latestAttempt,
		summary: response.summary,
		gate: response.gate,
		latest: response.latest,
		blockers: response.blockers,
		nextAction: response.nextAction,
		note: 'Task completion status is read-only. Do not claim completion until attempt_completion or agent/taskComplete is explicitly accepted.',
	}), null, 2);
}

function isTaskCompletionStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return taskCompletionStatusToolNames.has(tool);
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
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
