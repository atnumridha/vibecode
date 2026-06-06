/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexFinalReviewState } from './finalReview';
import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexTaskCompletionRequest {
	readonly id?: JsonRpcId;
	readonly method: string;
	readonly result: string;
	readonly command?: string;
	readonly taskId?: string;
	readonly requestedAt: number;
}

export interface VibeCodexTaskCompletionResponse {
	readonly accepted: boolean;
	readonly decision: 'accept' | 'block';
	readonly source: 'externalExtension';
	readonly completionKind: 'final_review' | 'read_only_advisory' | 'blocked';
	readonly finalReviewRequired: boolean;
	readonly advisoryReason?: string;
	readonly message: string;
	readonly result: string;
	readonly suggestedCommand?: string;
	readonly finalReview: VibeCodexFinalReviewState;
	readonly gate: {
		readonly decision: VibeCodexFinalReviewState['decision'];
		readonly ready: boolean;
		readonly required: number;
		readonly passed: number;
		readonly pending: number;
		readonly blocked: number;
		readonly blockerIds: readonly string[];
		readonly pendingIds: readonly string[];
		readonly evidence: readonly string[];
	};
	readonly blockers: readonly string[];
	readonly nextAction: string;
}

export interface VibeCodexTaskCompletionOptions {
	readonly allowReadOnlyAdvisory?: boolean;
	readonly advisoryReason?: string;
}

const taskCompletionMethods = new Set([
	'agent/taskComplete',
	'agent/complete',
	'agent/attemptCompletion',
	'task/complete',
	'completion/attempt',
	'cline/attempt_completion',
]);

export function normalizeTaskCompletionRequest(message: JsonRpcMessage): VibeCodexTaskCompletionRequest | undefined {
	if (!message.method || !isTaskCompletionMethod(message.method, message.params)) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const result = stringValue(payload.result)
		?? stringValue(args.result)
		?? stringValue(payload.summary)
		?? stringValue(args.summary)
		?? stringValue(payload.message)
		?? stringValue(args.message)
		?? stringValue(payload.text)
		?? stringValue(args.text);
	if (!result) {
		return undefined;
	}
	const command = stringValue(payload.command) ?? stringValue(args.command);
	const taskId = stringValue(payload.taskId) ?? stringValue(args.taskId);
	return {
		...(message.id !== undefined ? { id: message.id } : {}),
		method: message.method,
		result: redactSensitiveText(result).slice(0, 12000),
		...(command ? { command: redactSensitiveText(command).slice(0, 1000) } : {}),
		...(taskId ? { taskId } : {}),
		requestedAt: Date.now(),
	};
}

export function createTaskCompletionResponse(request: VibeCodexTaskCompletionRequest, finalReview: VibeCodexFinalReviewState, options: VibeCodexTaskCompletionOptions = {}): VibeCodexTaskCompletionResponse {
	const finalReviewAccepted = finalReview.decision === 'pass' && finalReview.ready;
	const advisoryAccepted = !finalReviewAccepted && options.allowReadOnlyAdvisory === true;
	const accepted = finalReviewAccepted || advisoryAccepted;
	const gate = completionGate(finalReview);
	const finalReviewBlockers = finalReview.items
		.filter(item => item.required && item.status !== 'passed')
		.map(item => `${item.title}: ${item.detail}`);
	const blockers = accepted ? [] : finalReviewBlockers;
	const completionKind: VibeCodexTaskCompletionResponse['completionKind'] = finalReviewAccepted ? 'final_review' : advisoryAccepted ? 'read_only_advisory' : 'blocked';
	return redactSensitiveValue({
		accepted,
		decision: accepted ? 'accept' : 'block',
		source: 'externalExtension',
		completionKind,
		finalReviewRequired: !advisoryAccepted,
		...(advisoryAccepted && options.advisoryReason ? { advisoryReason: options.advisoryReason } : {}),
		message: accepted
			? advisoryAccepted
				? 'Task completion accepted as read-only/advisory; no workspace mutation evidence requires Final Review gates.'
				: 'Task completion accepted by Vibe Codex Final Review.'
			: 'Task completion blocked by Vibe Codex Final Review.',
		result: request.result,
		...(request.command ? { suggestedCommand: request.command } : {}),
		finalReview,
		gate,
		blockers,
		nextAction: accepted
			? advisoryAccepted
				? options.advisoryReason ?? 'No workspace mutation evidence requires diff, rollback, or terminal verification gates.'
				: finalReview.nextAction
			: blockers[0] ?? finalReview.nextAction,
	}) as VibeCodexTaskCompletionResponse;
}

export function taskCompletionSummary(request: VibeCodexTaskCompletionRequest, response: VibeCodexTaskCompletionResponse): string {
	return response.accepted
		? response.completionKind === 'read_only_advisory'
			? `Accepted read-only task completion${request.taskId ? ` for ${request.taskId}` : ''}: ${response.advisoryReason ?? response.nextAction}`
			: `Accepted task completion${request.taskId ? ` for ${request.taskId}` : ''}.`
		: `Blocked task completion${request.taskId ? ` for ${request.taskId}` : ''}: ${response.blockers[0] ?? response.nextAction}`;
}

function isTaskCompletionMethod(method: string, params: unknown): boolean {
	if (taskCompletionMethods.has(method)) {
		return true;
	}
	if (method !== 'item/tool/call') {
		return false;
	}
	const payload = isRecord(params) ? params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return tool === 'attempt_completion' || tool === 'submit_and_exit' || tool === 'task_complete' || tool === 'complete_task';
}

function completionGate(finalReview: VibeCodexFinalReviewState): VibeCodexTaskCompletionResponse['gate'] {
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
		blockerIds: blocked.map(item => item.id),
		pendingIds: pending.map(item => item.id),
		evidence: finalReview.evidence.slice(0, 12),
	};
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
