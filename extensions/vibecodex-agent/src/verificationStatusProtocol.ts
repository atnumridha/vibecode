/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexDeliveryBarState } from './deliveryBar';
import type { VibeCodexDiagnosticsSnapshot } from './diagnosticsEvidence';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexFinalReviewState } from './finalReview';
import { finalReviewPromptBlock } from './finalReview';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSmokeBenchmarkState } from './smokeBenchmark';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';
import type { VibeCodexVerificationCheck, VibeCodexVerificationPlan, VibeCodexVerificationStatus } from './verificationPlan';

export interface VibeCodexVerificationStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeChecks: boolean;
	readonly includeDiagnostics: boolean;
	readonly includeTerminalRuns: boolean;
	readonly includeFinalReview: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexVerificationStatusCounts {
	readonly total: number;
	readonly required: number;
	readonly pending: number;
	readonly running: number;
	readonly passed: number;
	readonly failed: number;
	readonly skipped: number;
}

export interface VibeCodexVerificationTerminalRunSummary {
	readonly id: string;
	readonly commandLine: string;
	readonly status: string;
	readonly exitCode?: number;
	readonly signal?: string;
	readonly outputTail?: string;
}

export interface VibeCodexVerificationStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly summary: string;
	readonly counts: VibeCodexVerificationStatusCounts;
	readonly verificationPlan?: unknown;
	readonly checks?: readonly VibeCodexVerificationCheck[];
	readonly diagnosticsSnapshot?: VibeCodexDiagnosticsSnapshot;
	readonly deliveryBar?: VibeCodexDeliveryBarState;
	readonly smokeBenchmark?: VibeCodexSmokeBenchmarkState;
	readonly finalReview?: VibeCodexFinalReviewState;
	readonly finalReviewPromptBlock?: string;
	readonly terminalRuns?: readonly VibeCodexVerificationTerminalRunSummary[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexVerificationStatusInput {
	readonly verificationPlan?: VibeCodexVerificationPlan;
	readonly diagnosticsSnapshot?: VibeCodexDiagnosticsSnapshot;
	readonly deliveryBar?: VibeCodexDeliveryBarState;
	readonly smokeBenchmark?: VibeCodexSmokeBenchmarkState;
	readonly finalReview?: VibeCodexFinalReviewState;
	readonly terminalRuns?: readonly VibeCodexCapturedTerminalRun[];
}

const verificationStatusMethods = new Set([
	'agent/getVerificationStatus',
	'agent/verificationStatus',
	'agent/getFinalReviewStatus',
	'agent/finalReviewStatus',
	'verification/status',
	'delivery/status',
	'finalReview/status',
	'finalReview/getStatus',
	'vibecodex/verificationStatus',
]);

const verificationStatusToolNames = new Set([
	'verification_status',
	'get_verification_status',
	'delivery_status',
	'final_review_status',
	'get_final_review_status',
	'final_review',
	'smoke_benchmark_status',
]);

const maxTerminalRuns = 8;
const maxOutputTail = 1200;

export function normalizeVerificationStatusRequest(message: JsonRpcMessage): VibeCodexVerificationStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!verificationStatusMethods.has(message.method) && !isVerificationStatusToolCall(message.method, payload, args)) {
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
		includeDiagnostics: booleanValue(payload.includeDiagnostics)
			?? booleanValue(payload.include_diagnostics)
			?? booleanValue(args.includeDiagnostics)
			?? booleanValue(args.include_diagnostics)
			?? true,
		includeTerminalRuns: booleanValue(payload.includeTerminalRuns)
			?? booleanValue(payload.include_terminal_runs)
			?? booleanValue(args.includeTerminalRuns)
			?? booleanValue(args.include_terminal_runs)
			?? false,
		includeFinalReview: booleanValue(payload.includeFinalReview)
			?? booleanValue(payload.include_final_review)
			?? booleanValue(args.includeFinalReview)
			?? booleanValue(args.include_final_review)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createVerificationStatusResponse(request: VibeCodexVerificationStatusRequest, input: VibeCodexVerificationStatusInput): VibeCodexVerificationStatusResponse {
	const counts = verificationCounts(input.verificationPlan?.checks ?? []);
	const ok = !!input.verificationPlan || !!input.deliveryBar || !!input.smokeBenchmark || !!input.finalReview || !!input.diagnosticsSnapshot;
	const summary = createSummary(input, counts);
	return {
		ok,
		source: 'externalExtension',
		version: 1,
		summary,
		counts,
		...(input.verificationPlan ? { verificationPlan: verificationPlanHeader(input.verificationPlan) } : {}),
		...(request.includeChecks && input.verificationPlan ? { checks: redactSensitiveValue(input.verificationPlan.checks) as readonly VibeCodexVerificationCheck[] } : {}),
		...(request.includeDiagnostics && input.diagnosticsSnapshot ? { diagnosticsSnapshot: redactSensitiveValue(input.diagnosticsSnapshot) as VibeCodexDiagnosticsSnapshot } : {}),
		...(input.deliveryBar ? { deliveryBar: redactSensitiveValue(input.deliveryBar) as VibeCodexDeliveryBarState } : {}),
		...(input.smokeBenchmark ? { smokeBenchmark: redactSensitiveValue(input.smokeBenchmark) as VibeCodexSmokeBenchmarkState } : {}),
		...(request.includeFinalReview && input.finalReview ? { finalReview: redactSensitiveValue(input.finalReview) as VibeCodexFinalReviewState } : {}),
		...(request.includeFinalReview && input.finalReview ? { finalReviewPromptBlock: redactSensitiveText(finalReviewPromptBlock(input.finalReview)) } : {}),
		...(request.includeTerminalRuns ? { terminalRuns: terminalRunSummaries(input.terminalRuns ?? []) } : {}),
		guardrails: [
			'Verification and Final Review status is read-only and never runs checks, accepts completion, changes Delivery Bar state, stages commits, or mutates workspace files.',
			'Final Review status is advisory until task completion is explicitly attempted through agent/taskComplete, agent/attemptCompletion, or attempt_completion.',
			'Final Review prompt blocks, diagnostics, terminal tails, and evidence are redacted before they are returned to the backend.',
			'A pass decision still represents IDE-side delivery readiness, not an automatic git commit or merge.',
		],
		message: ok
			? `Verification status returned: ${counts.passed}/${counts.required} required checks passed, ${counts.failed} failed.`
			: 'No verification status is available yet.',
	};
}

export function verificationStatusSummary(response: VibeCodexVerificationStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	const delivery = response.deliveryBar ? ` Delivery Bar: ${response.deliveryBar.ready ? 'ready' : response.deliveryBar.blocked ? 'blocked' : 'pending'}.` : '';
	const final = response.finalReview ? ` Final Review: ${response.finalReview.decision}.` : '';
	return `${response.message}${delivery}${final}`;
}

function verificationCounts(checks: readonly VibeCodexVerificationCheck[]): VibeCodexVerificationStatusCounts {
	const result: Record<VibeCodexVerificationStatus, number> = { pending: 0, running: 0, passed: 0, failed: 0, skipped: 0 };
	for (const check of checks) {
		result[check.status]++;
	}
	return {
		total: checks.length,
		required: checks.filter(check => check.required).length,
		pending: result.pending,
		running: result.running,
		passed: result.passed,
		failed: result.failed,
		skipped: result.skipped,
	};
}

function verificationPlanHeader(plan: VibeCodexVerificationPlan): unknown {
	return redactSensitiveValue({
		version: plan.version,
		createdAt: plan.createdAt,
		workspaceRoot: plan.workspaceRoot,
		diagnosticsBaseline: plan.diagnosticsBaseline,
		acceptanceCriteria: plan.acceptanceCriteria,
	});
}

function terminalRunSummaries(runs: readonly VibeCodexCapturedTerminalRun[]): readonly VibeCodexVerificationTerminalRunSummary[] {
	return runs.slice(-maxTerminalRuns).map(run => {
		const output = typeof run.output === 'string' ? redactSensitiveText(run.output) : '';
		const outputTail = output.length > maxOutputTail ? output.slice(output.length - maxOutputTail) : output;
		return {
			id: redactSensitiveText(run.id),
			commandLine: redactSensitiveText(run.commandLine),
			status: run.status,
			...(typeof run.exitCode === 'number' ? { exitCode: run.exitCode } : {}),
			...(run.signal ? { signal: redactSensitiveText(run.signal) } : {}),
			...(outputTail ? { outputTail } : {}),
		};
	});
}

function createSummary(input: VibeCodexVerificationStatusInput, counts: VibeCodexVerificationStatusCounts): string {
	return [
		input.verificationPlan ? `${input.verificationPlan.checks.length} verification check${input.verificationPlan.checks.length === 1 ? '' : 's'}; ${counts.required} required.` : undefined,
		input.diagnosticsSnapshot ? `Diagnostics: ${input.diagnosticsSnapshot.errors} error${input.diagnosticsSnapshot.errors === 1 ? '' : 's'}, ${input.diagnosticsSnapshot.warnings} warning${input.diagnosticsSnapshot.warnings === 1 ? '' : 's'}.` : undefined,
		input.deliveryBar ? input.deliveryBar.summary : undefined,
		input.smokeBenchmark ? input.smokeBenchmark.summary : undefined,
		input.finalReview ? input.finalReview.summary : undefined,
		'Verification status is read-only; it never runs checks, accepts completion, or changes Delivery Bar state.',
	].filter((line): line is string => !!line).map(line => redactSensitiveText(line)).join('\n');
}

function isVerificationStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return verificationStatusToolNames.has(tool);
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
