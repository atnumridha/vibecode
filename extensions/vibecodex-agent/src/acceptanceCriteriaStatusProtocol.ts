/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexVerificationCheck, VibeCodexVerificationPlan, VibeCodexVerificationStatus } from './verificationPlan';

export interface VibeCodexAcceptanceCriteriaStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeCriteria: boolean;
	readonly includeEvidence: boolean;
	readonly includePromptBlock: boolean;
	readonly maxCriteria: number;
	readonly requestedAt: number;
}

export interface VibeCodexAcceptanceCriteriaItem {
	readonly index: number;
	readonly criterion: string;
	readonly covered: boolean;
	readonly checkId?: string;
	readonly label?: string;
	readonly status: VibeCodexVerificationStatus | 'missing';
	readonly required: boolean;
	readonly source?: string;
	readonly lastRunId?: string;
	readonly evidence?: string;
	readonly blockers: readonly string[];
}

export interface VibeCodexAcceptanceCriteriaStatusCounts {
	readonly total: number;
	readonly covered: number;
	readonly required: number;
	readonly passed: number;
	readonly pending: number;
	readonly running: number;
	readonly failed: number;
	readonly skipped: number;
	readonly missing: number;
	readonly blocking: number;
}

export interface VibeCodexAcceptanceCriteriaStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly ready: boolean;
	readonly coverageComplete: boolean;
	readonly summary: string;
	readonly counts: VibeCodexAcceptanceCriteriaStatusCounts;
	readonly criteria?: readonly VibeCodexAcceptanceCriteriaItem[];
	readonly blockers: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexAcceptanceCriteriaStatusInput {
	readonly verificationPlan?: VibeCodexVerificationPlan;
}

const acceptanceCriteriaStatusMethods = new Set([
	'agent/getAcceptanceCriteriaStatus',
	'agent/acceptanceCriteriaStatus',
	'acceptance/status',
	'acceptanceCriteria/status',
	'verification/acceptanceStatus',
	'plan/acceptanceStatus',
	'vibecodex/acceptanceCriteriaStatus',
]);

const acceptanceCriteriaStatusToolNames = new Set([
	'acceptance_criteria_status',
	'acceptance_status',
	'plan_acceptance_status',
	'criteria_status',
	'verification_acceptance_status',
]);

export function normalizeAcceptanceCriteriaStatusRequest(message: JsonRpcMessage): VibeCodexAcceptanceCriteriaStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!acceptanceCriteriaStatusMethods.has(message.method) && !isAcceptanceCriteriaStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeCriteria: booleanValue(payload.includeCriteria)
			?? booleanValue(payload.include_criteria)
			?? booleanValue(args.includeCriteria)
			?? booleanValue(args.include_criteria)
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
		maxCriteria: clampNumber(numberValue(payload.maxCriteria)
			?? numberValue(payload.max_criteria)
			?? numberValue(args.maxCriteria)
			?? numberValue(args.max_criteria)
			?? 12, 0, 40),
		requestedAt: Date.now(),
	};
}

export function createAcceptanceCriteriaStatusResponse(request: VibeCodexAcceptanceCriteriaStatusRequest, input: VibeCodexAcceptanceCriteriaStatusInput = {}): VibeCodexAcceptanceCriteriaStatusResponse {
	const plan = input.verificationPlan;
	if (!plan) {
		const unavailable = {
			ok: false,
			source: 'externalExtension' as const,
			version: 1 as const,
			ready: false,
			coverageComplete: false,
			summary: 'No verification plan is available, so acceptance criteria coverage cannot be inspected.',
			counts: emptyCounts(),
			blockers: ['Generate or refresh a visual plan so acceptance criteria become required verification checks.'],
			nextAction: 'Request plan_status or start a task to create a verification plan before final review.',
			guardrails: acceptanceCriteriaStatusGuardrails,
			message: 'Acceptance criteria status is unavailable.',
		};
		return {
			...unavailable,
			...(request.includePromptBlock ? { promptBlock: acceptanceCriteriaPromptBlock(unavailable, []) } : {}),
		};
	}
	const criteria = acceptanceCriteriaItems(plan, request.includeEvidence);
	const visibleCriteria = criteria.slice(0, request.maxCriteria);
	const counts = countCriteria(criteria);
	const blockers = criteria.flatMap(item => item.blockers.map(blocker => `${item.criterion}: ${blocker}`)).map(redactSensitiveText);
	const ready = counts.total > 0 && counts.blocking === 0 && counts.required === counts.passed;
	const coverageComplete = counts.total > 0 && counts.missing === 0 && counts.covered === counts.total;
	const response = {
		ok: true,
		source: 'externalExtension' as const,
		version: 1 as const,
		ready,
		coverageComplete,
		summary: acceptanceCriteriaSummaryFromCounts(counts, ready, coverageComplete),
		counts,
		...(request.includeCriteria ? { criteria: visibleCriteria } : {}),
		blockers,
		nextAction: acceptanceCriteriaNextAction(counts, blockers),
		guardrails: acceptanceCriteriaStatusGuardrails,
		message: ready
			? 'Acceptance criteria are covered by passed required verification checks.'
			: `Acceptance criteria are blocked by ${counts.blocking} required item${counts.blocking === 1 ? '' : 's'}.`,
	};
	return redactSensitiveValue({
		...response,
		...(request.includePromptBlock ? { promptBlock: acceptanceCriteriaPromptBlock(response, visibleCriteria) } : {}),
	}) as VibeCodexAcceptanceCriteriaStatusResponse;
}

export function acceptanceCriteriaStatusSummary(response: VibeCodexAcceptanceCriteriaStatusResponse): string {
	return response.ok
		? `${response.message} ${response.counts.passed}/${response.counts.required} required criteria passed. Next: ${response.nextAction}`
		: response.message;
}

const acceptanceCriteriaStatusGuardrails = [
	'Acceptance criteria status is read-only and never marks criteria passed, runs checks, edits plans, approves execution, accepts diffs, accepts completion, stages commits, or mutates workspace files.',
	'Criteria are considered ready only when each plan acceptance criterion is covered by a required verification check and every required criterion check has passed.',
	'Criteria text, check ids, evidence, run ids, blockers, and prompt blocks are redacted before they are returned to the backend.',
	'Backends must run terminal checks or provide explicit verification evidence through the normal approved execution flow; this status tool only reports readiness.',
];

function acceptanceCriteriaItems(plan: VibeCodexVerificationPlan, includeEvidence: boolean): readonly VibeCodexAcceptanceCriteriaItem[] {
	const checks = acceptanceChecks(plan.checks);
	return plan.acceptanceCriteria.map((criterion, index) => {
		const check = checks[index] ?? findCriterionCheck(checks, criterion);
		if (!check) {
			return {
				index: index + 1,
				criterion: redactSensitiveText(criterion),
				covered: false,
				status: 'missing',
				required: true,
				blockers: ['No required verification check covers this acceptance criterion.'],
			};
		}
		const blockers = criterionBlockers(check);
		return {
			index: index + 1,
			criterion: redactSensitiveText(criterion),
			covered: true,
			checkId: redactSensitiveText(check.id),
			label: redactSensitiveText(check.label),
			status: check.status,
			required: check.required,
			source: redactSensitiveText(check.source),
			...(check.lastRunId ? { lastRunId: redactSensitiveText(check.lastRunId) } : {}),
			...(includeEvidence && check.evidence ? { evidence: redactSensitiveText(check.evidence) } : {}),
			blockers,
		};
	});
}

function acceptanceChecks(checks: readonly VibeCodexVerificationCheck[]): readonly VibeCodexVerificationCheck[] {
	return checks.filter(check => check.source === 'plan.acceptanceCriteria');
}

function findCriterionCheck(checks: readonly VibeCodexVerificationCheck[], criterion: string): VibeCodexVerificationCheck | undefined {
	const normalized = normalizeText(criterion);
	return checks.find(check => normalizeText(check.label).includes(normalized));
}

function criterionBlockers(check: VibeCodexVerificationCheck): readonly string[] {
	if (!check.required) {
		return ['Acceptance criterion check is not marked required.'];
	}
	switch (check.status) {
		case 'passed':
			return [];
		case 'running':
			return ['Required acceptance criterion check is still running.'];
		case 'failed':
			return ['Required acceptance criterion check failed.'];
		case 'skipped':
			return ['Required acceptance criterion check was skipped and needs explicit evidence.'];
		default:
			return ['Required acceptance criterion check is pending evidence.'];
	}
}

function countCriteria(criteria: readonly VibeCodexAcceptanceCriteriaItem[]): VibeCodexAcceptanceCriteriaStatusCounts {
	const counts: Record<VibeCodexVerificationStatus | 'missing', number> = { pending: 0, running: 0, passed: 0, failed: 0, skipped: 0, missing: 0 };
	for (const item of criteria) {
		counts[item.status]++;
	}
	return {
		total: criteria.length,
		covered: criteria.filter(item => item.covered).length,
		required: criteria.filter(item => item.required).length,
		passed: counts.passed,
		pending: counts.pending,
		running: counts.running,
		failed: counts.failed,
		skipped: counts.skipped,
		missing: counts.missing,
		blocking: criteria.filter(item => item.required && item.status !== 'passed').length,
	};
}

function acceptanceCriteriaSummaryFromCounts(counts: VibeCodexAcceptanceCriteriaStatusCounts, ready: boolean, coverageComplete: boolean): string {
	const state = ready ? 'ready' : coverageComplete ? 'covered but pending evidence' : 'missing coverage';
	return `Acceptance criteria ${state}: ${counts.passed}/${counts.required} required passed, ${counts.covered}/${counts.total} covered, ${counts.blocking} blocking.`;
}

function acceptanceCriteriaNextAction(counts: VibeCodexAcceptanceCriteriaStatusCounts, blockers: readonly string[]): string {
	if (!counts.total) {
		return 'Add acceptance criteria to the visual plan before execution.';
	}
	if (counts.missing) {
		return 'Refresh the verification plan so every acceptance criterion has a required check.';
	}
	if (counts.failed) {
		return blockers[0] ?? 'Fix failed acceptance criteria before Final Review.';
	}
	if (counts.running) {
		return 'Wait for running acceptance criteria checks to finish.';
	}
	if (counts.pending || counts.skipped) {
		return 'Run linked checks or provide explicit evidence through the approved execution flow.';
	}
	return 'Request delivery_bar_status or final_review_status before attempting completion.';
}

function acceptanceCriteriaPromptBlock(response: Omit<VibeCodexAcceptanceCriteriaStatusResponse, 'promptBlock'>, criteria: readonly VibeCodexAcceptanceCriteriaItem[]): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'acceptance_criteria_status',
		ready: response.ready,
		coverageComplete: response.coverageComplete,
		counts: response.counts,
		criteria,
		blockers: response.blockers,
		nextAction: response.nextAction,
		guardrails: response.guardrails,
	}), null, 2);
}

function emptyCounts(): VibeCodexAcceptanceCriteriaStatusCounts {
	return {
		total: 0,
		covered: 0,
		required: 0,
		passed: 0,
		pending: 0,
		running: 0,
		failed: 0,
		skipped: 0,
		missing: 0,
		blocking: 0,
	};
}

function isAcceptanceCriteriaStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return acceptanceCriteriaStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function normalizeText(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim().length) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
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
