/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexDeliveryBarCheck, VibeCodexDeliveryBarState, VibeCodexDeliveryBarStatus } from './deliveryBar';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexDeliveryBarStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeChecks: boolean;
	readonly includeBlockers: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexDeliveryBarStatusCounts {
	readonly total: number;
	readonly required: number;
	readonly optional: number;
	readonly passed: number;
	readonly pending: number;
	readonly failed: number;
	readonly skipped: number;
	readonly blocking: number;
}

export interface VibeCodexDeliveryBarStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly state: 'unavailable' | 'ready' | 'blocked' | 'pending';
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly summary: string;
	readonly counts: VibeCodexDeliveryBarStatusCounts;
	readonly checks?: readonly VibeCodexDeliveryBarCheck[];
	readonly blockers?: readonly VibeCodexDeliveryBarCheck[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexDeliveryBarStatusInput {
	readonly deliveryBar?: VibeCodexDeliveryBarState;
}

const deliveryBarStatusMethods = new Set([
	'agent/getDeliveryBarStatus',
	'agent/deliveryBarStatus',
	'agent/getDeliveryGateStatus',
	'deliveryBar/status',
	'delivery/barStatus',
	'delivery/gateStatus',
	'vibecodex/deliveryBarStatus',
]);

const deliveryBarStatusToolNames = new Set([
	'delivery_bar_status',
	'delivery_gate_status',
	'delivery_readiness_status',
	'delivery_check_status',
]);

const deliveryStatuses: readonly VibeCodexDeliveryBarStatus[] = ['passed', 'pending', 'failed', 'skipped'];

export function normalizeDeliveryBarStatusRequest(message: JsonRpcMessage): VibeCodexDeliveryBarStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!deliveryBarStatusMethods.has(message.method) && !isDeliveryBarStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeChecks: booleanValue(payload.includeChecks)
			?? booleanValue(payload.include_checks)
			?? booleanValue(args.includeChecks)
			?? booleanValue(args.include_checks)
			?? true,
		includeBlockers: booleanValue(payload.includeBlockers)
			?? booleanValue(payload.include_blockers)
			?? booleanValue(args.includeBlockers)
			?? booleanValue(args.include_blockers)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createDeliveryBarStatusResponse(request: VibeCodexDeliveryBarStatusRequest, input: VibeCodexDeliveryBarStatusInput): VibeCodexDeliveryBarStatusResponse {
	const deliveryBar = input.deliveryBar;
	if (!deliveryBar) {
		const response = {
			ok: false,
			source: 'externalExtension' as const,
			version: 1 as const,
			state: 'unavailable' as const,
			ready: false,
			blocked: false,
			summary: 'No Delivery Bar has been generated yet.',
			counts: emptyCounts(),
			nextAction: 'Start a task or request workflow_status after a visual plan is available.',
			guardrails: deliveryBarStatusGuardrails,
			message: 'No Delivery Bar status is available yet.',
		};
		return {
			...response,
			...(request.includePromptBlock ? { promptBlock: deliveryBarPromptBlock(response, []) } : {}),
		};
	}
	const checks = deliveryBar.checks.map(sanitizeCheck);
	const blockers = blockingChecks(checks);
	const counts = countChecks(checks, blockers);
	const state: VibeCodexDeliveryBarStatusResponse['state'] = deliveryBar.ready ? 'ready' : deliveryBar.blocked ? 'blocked' : 'pending';
	const response = {
		ok: true,
		source: 'externalExtension' as const,
		version: 1 as const,
		state,
		ready: deliveryBar.ready,
		blocked: deliveryBar.blocked,
		summary: redactSensitiveText(deliveryBar.summary),
		counts,
		...(request.includeChecks ? { checks } : {}),
		...(request.includeBlockers ? { blockers } : {}),
		nextAction: nextAction(deliveryBar, blockers),
		guardrails: deliveryBarStatusGuardrails,
		message: deliveryBar.ready
			? 'Delivery Bar is ready for Final Review/task-completion gating.'
			: deliveryBar.blocked
				? `Delivery Bar is blocked by ${blockers.length} required check${blockers.length === 1 ? '' : 's'}.`
				: `Delivery Bar is pending ${blockers.length} required check${blockers.length === 1 ? '' : 's'}.`,
	};
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: deliveryBarPromptBlock(response, blockers) } : {}),
	};
}

export function deliveryBarStatusSummary(response: VibeCodexDeliveryBarStatusResponse): string {
	return response.ok
		? `${response.message} ${response.counts.passed}/${response.counts.required} required checks passed. Next: ${response.nextAction}`
		: response.message;
}

const deliveryBarStatusGuardrails = [
	'Delivery Bar status is read-only and never runs checks, changes Delivery Bar state, approves plans, accepts diffs, restores checkpoints, accepts task completion, stages commits, or mutates workspace files.',
	'Delivery Bar readiness is advisory until Final Review passes and task completion is explicitly accepted through the normal completion gate.',
	'Check titles, details, blockers, summaries, and prompt blocks are redacted before they are returned to the backend.',
];

function sanitizeCheck(check: VibeCodexDeliveryBarCheck): VibeCodexDeliveryBarCheck {
	return {
		id: redactSensitiveText(check.id),
		title: redactSensitiveText(check.title),
		status: check.status,
		required: check.required,
		detail: redactSensitiveText(check.detail),
	};
}

function blockingChecks(checks: readonly VibeCodexDeliveryBarCheck[]): readonly VibeCodexDeliveryBarCheck[] {
	return checks.filter(check => check.required && check.status !== 'passed');
}

function countChecks(checks: readonly VibeCodexDeliveryBarCheck[], blockers: readonly VibeCodexDeliveryBarCheck[]): VibeCodexDeliveryBarStatusCounts {
	const statusCounts = Object.fromEntries(deliveryStatuses.map(status => [status, checks.filter(check => check.status === status).length])) as Record<VibeCodexDeliveryBarStatus, number>;
	return {
		total: checks.length,
		required: checks.filter(check => check.required).length,
		optional: checks.filter(check => !check.required).length,
		passed: statusCounts.passed,
		pending: statusCounts.pending,
		failed: statusCounts.failed,
		skipped: statusCounts.skipped,
		blocking: blockers.length,
	};
}

function nextAction(deliveryBar: VibeCodexDeliveryBarState, blockers: readonly VibeCodexDeliveryBarCheck[]): string {
	if (deliveryBar.ready) {
		return 'Request final_review_status or attempt task completion through the normal completion gate.';
	}
	const failed = blockers.find(check => check.status === 'failed');
	if (failed) {
		return `Resolve failed Delivery Bar check "${failed.title}": ${failed.detail}`;
	}
	const pending = blockers.find(check => check.status === 'pending');
	if (pending) {
		return `Complete pending Delivery Bar check "${pending.title}": ${pending.detail}`;
	}
	const skipped = blockers.find(check => check.status === 'skipped');
	if (skipped) {
		return `Replace skipped required Delivery Bar check "${skipped.title}" with explicit verification evidence or mark it passed through the normal flow.`;
	}
	return 'Continue the approved execution loop until all required Delivery Bar checks pass.';
}

function deliveryBarPromptBlock(response: Omit<VibeCodexDeliveryBarStatusResponse, 'promptBlock'>, blockers: readonly VibeCodexDeliveryBarCheck[]): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'delivery_bar_status',
		state: response.state,
		ready: response.ready,
		blocked: response.blocked,
		summary: response.summary,
		counts: response.counts,
		blockers,
		nextAction: response.nextAction,
		note: 'Delivery Bar status is read-only. Do not claim completion until Final Review passes and task completion is accepted.',
	}), null, 2);
}

function emptyCounts(): VibeCodexDeliveryBarStatusCounts {
	return {
		total: 0,
		required: 0,
		optional: 0,
		passed: 0,
		pending: 0,
		failed: 0,
		skipped: 0,
		blocking: 0,
	};
}

function isDeliveryBarStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return deliveryBarStatusToolNames.has(tool);
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
