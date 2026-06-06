/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSmokeBenchmarkMilestone, VibeCodexSmokeBenchmarkState, VibeCodexSmokeBenchmarkStatus } from './smokeBenchmark';

export interface VibeCodexSmokeBenchmarkStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeMilestones: boolean;
	readonly includeBlockers: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexSmokeBenchmarkStatusCounts {
	readonly total: number;
	readonly required: number;
	readonly optional: number;
	readonly passed: number;
	readonly pending: number;
	readonly failed: number;
	readonly skipped: number;
	readonly blocking: number;
}

export interface VibeCodexSmokeBenchmarkStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly state: 'unavailable' | 'ready' | 'blocked' | 'pending';
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly summary: string;
	readonly counts: VibeCodexSmokeBenchmarkStatusCounts;
	readonly milestones?: readonly VibeCodexSmokeBenchmarkMilestone[];
	readonly blockers?: readonly VibeCodexSmokeBenchmarkMilestone[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexSmokeBenchmarkStatusInput {
	readonly smokeBenchmark?: VibeCodexSmokeBenchmarkState;
}

const smokeBenchmarkStatusMethods = new Set([
	'agent/getSmokeBenchmarkStatus',
	'agent/smokeBenchmarkStatus',
	'agent/getSmokeStatus',
	'smokeBenchmark/status',
	'smoke/status',
	'delivery/smokeBenchmarkStatus',
	'vibecodex/smokeBenchmarkStatus',
]);

const smokeBenchmarkStatusToolNames = new Set([
	'smoke_benchmark_status',
	'smoke_status',
	'e2e_smoke_status',
	'benchmark_status',
	'delivery_smoke_status',
]);

const smokeStatuses: readonly VibeCodexSmokeBenchmarkStatus[] = ['passed', 'pending', 'failed', 'skipped'];

export function normalizeSmokeBenchmarkStatusRequest(message: JsonRpcMessage): VibeCodexSmokeBenchmarkStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!smokeBenchmarkStatusMethods.has(message.method) && !isSmokeBenchmarkStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeMilestones: booleanValue(payload.includeMilestones)
			?? booleanValue(payload.include_milestones)
			?? booleanValue(args.includeMilestones)
			?? booleanValue(args.include_milestones)
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

export function createSmokeBenchmarkStatusResponse(request: VibeCodexSmokeBenchmarkStatusRequest, input: VibeCodexSmokeBenchmarkStatusInput): VibeCodexSmokeBenchmarkStatusResponse {
	const smokeBenchmark = input.smokeBenchmark;
	if (!smokeBenchmark) {
		const response = {
			ok: false,
			source: 'externalExtension' as const,
			version: 1 as const,
			state: 'unavailable' as const,
			ready: false,
			blocked: false,
			summary: 'No Smoke Benchmark has been generated yet.',
			counts: emptyCounts(),
			nextAction: 'Start a task or request workflow_status after a visual plan is available.',
			guardrails: smokeBenchmarkStatusGuardrails,
			message: 'No Smoke Benchmark status is available yet.',
		};
		return {
			...response,
			...(request.includePromptBlock ? { promptBlock: smokeBenchmarkPromptBlock(response, []) } : {}),
		};
	}
	const milestones = smokeBenchmark.milestones.map(sanitizeMilestone);
	const blockers = blockingMilestones(milestones);
	const counts = countMilestones(milestones, blockers);
	const failedRequired = blockers.some(milestone => milestone.status === 'failed');
	const state: VibeCodexSmokeBenchmarkStatusResponse['state'] = smokeBenchmark.ready ? 'ready' : failedRequired ? 'blocked' : 'pending';
	const response = {
		ok: true,
		source: 'externalExtension' as const,
		version: 1 as const,
		state,
		ready: smokeBenchmark.ready,
		blocked: failedRequired,
		summary: redactSensitiveText(smokeBenchmark.summary),
		counts,
		...(request.includeMilestones ? { milestones } : {}),
		...(request.includeBlockers ? { blockers } : {}),
		nextAction: nextAction(smokeBenchmark, blockers),
		guardrails: smokeBenchmarkStatusGuardrails,
		message: smokeBenchmark.ready
			? 'Smoke Benchmark is ready for Final Review/task-completion gating.'
			: failedRequired
				? `Smoke Benchmark is blocked by ${blockers.length} required milestone${blockers.length === 1 ? '' : 's'}.`
				: `Smoke Benchmark is pending ${blockers.length} required milestone${blockers.length === 1 ? '' : 's'}.`,
	};
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: smokeBenchmarkPromptBlock(response, blockers) } : {}),
	};
}

export function smokeBenchmarkStatusSummary(response: VibeCodexSmokeBenchmarkStatusResponse): string {
	return response.ok
		? `${response.message} ${response.counts.passed}/${response.counts.required} required milestones passed. Next: ${response.nextAction}`
		: response.message;
}

const smokeBenchmarkStatusGuardrails = [
	'Smoke Benchmark status is read-only and never runs checks, changes benchmark state, approves plans, accepts diffs, restores checkpoints, accepts task completion, stages commits, or mutates workspace files.',
	'Smoke Benchmark readiness is advisory until Delivery Bar, Commit Handoff, Final Review, and task completion gates pass through their normal approval flow.',
	'Milestone titles, evidence, blockers, summaries, and prompt blocks are redacted before they are returned to the backend.',
];

function sanitizeMilestone(milestone: VibeCodexSmokeBenchmarkMilestone): VibeCodexSmokeBenchmarkMilestone {
	return {
		id: redactSensitiveText(milestone.id),
		title: redactSensitiveText(milestone.title),
		status: milestone.status,
		required: milestone.required,
		evidence: redactSensitiveText(milestone.evidence),
	};
}

function blockingMilestones(milestones: readonly VibeCodexSmokeBenchmarkMilestone[]): readonly VibeCodexSmokeBenchmarkMilestone[] {
	return milestones.filter(milestone => milestone.required && milestone.status !== 'passed');
}

function countMilestones(milestones: readonly VibeCodexSmokeBenchmarkMilestone[], blockers: readonly VibeCodexSmokeBenchmarkMilestone[]): VibeCodexSmokeBenchmarkStatusCounts {
	const statusCounts = Object.fromEntries(smokeStatuses.map(status => [status, milestones.filter(milestone => milestone.status === status).length])) as Record<VibeCodexSmokeBenchmarkStatus, number>;
	return {
		total: milestones.length,
		required: milestones.filter(milestone => milestone.required).length,
		optional: milestones.filter(milestone => !milestone.required).length,
		passed: statusCounts.passed,
		pending: statusCounts.pending,
		failed: statusCounts.failed,
		skipped: statusCounts.skipped,
		blocking: blockers.length,
	};
}

function nextAction(smokeBenchmark: VibeCodexSmokeBenchmarkState, blockers: readonly VibeCodexSmokeBenchmarkMilestone[]): string {
	if (smokeBenchmark.ready) {
		return 'Request final_review_status or task_completion_status before asking to complete the task.';
	}
	const failed = blockers.find(milestone => milestone.status === 'failed');
	if (failed) {
		return `Resolve failed Smoke Benchmark milestone "${failed.title}": ${failed.evidence}`;
	}
	const pending = blockers.find(milestone => milestone.status === 'pending');
	if (pending) {
		return `Complete pending Smoke Benchmark milestone "${pending.title}": ${pending.evidence}`;
	}
	const skipped = blockers.find(milestone => milestone.status === 'skipped');
	if (skipped) {
		return `Replace skipped required Smoke Benchmark milestone "${skipped.title}" with explicit workflow evidence.`;
	}
	return 'Continue the approved execution loop until all required Smoke Benchmark milestones pass.';
}

function smokeBenchmarkPromptBlock(response: Omit<VibeCodexSmokeBenchmarkStatusResponse, 'promptBlock'>, blockers: readonly VibeCodexSmokeBenchmarkMilestone[]): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'smoke_benchmark_status',
		state: response.state,
		ready: response.ready,
		blocked: response.blocked,
		summary: response.summary,
		counts: response.counts,
		blockers,
		nextAction: response.nextAction,
		note: 'Smoke Benchmark status is read-only. Do not claim completion until Final Review passes and task completion is accepted.',
	}), null, 2);
}

function emptyCounts(): VibeCodexSmokeBenchmarkStatusCounts {
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

function isSmokeBenchmarkStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return smokeBenchmarkStatusToolNames.has(tool);
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
