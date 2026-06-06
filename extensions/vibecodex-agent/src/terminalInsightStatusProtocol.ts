/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexTerminalInsight, VibeCodexTerminalInsightFinding, VibeCodexTerminalInsightSeverity } from './terminalInsight';
import { terminalInsightSignature } from './terminalInsight';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexTerminalInsightStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly runId?: string;
	readonly latest: boolean;
	readonly includeFindings: boolean;
	readonly maxFindings: number;
	readonly requestedAt: number;
}

export interface VibeCodexTerminalInsightStatusItem {
	readonly runId: string;
	readonly commandLine: string;
	readonly status: VibeCodexTerminalInsight['status'];
	readonly createdAt: number;
	readonly summary: string;
	readonly urls: readonly string[];
	readonly findingCounts: Record<VibeCodexTerminalInsightSeverity, number>;
	readonly findingKinds: readonly string[];
	readonly signature: string;
	readonly followUpPromptAvailable: boolean;
	readonly followUpPrompt?: string;
	readonly findings?: readonly VibeCodexTerminalInsightFinding[];
}

export interface VibeCodexTerminalInsightStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly requestedRunId?: string;
	readonly selectedRunId?: string;
	readonly latestRunId?: string;
	readonly knownRunIds: readonly string[];
	readonly total: number;
	readonly insight?: VibeCodexTerminalInsightStatusItem;
	readonly insights?: readonly VibeCodexTerminalInsightStatusItem[];
	readonly counts: Record<VibeCodexTerminalInsightSeverity, number>;
	readonly guardrails: readonly string[];
	readonly message: string;
}

const terminalInsightStatusMethods = new Set([
	'agent/getTerminalInsightStatus',
	'agent/terminalInsightStatus',
	'agent/getTerminalInsights',
	'agent/terminalInsights',
	'terminal/insightStatus',
	'terminal/insights',
	'vibecodex/terminalInsightStatus',
]);

const terminalInsightStatusToolNames = new Set([
	'terminal_insight_status',
	'terminal_insights',
	'get_terminal_insight_status',
	'get_terminal_insights',
	'terminal_findings',
]);

const defaultMaxFindings = 8;
const maxFindingsLimit = 32;
const maxInsights = 12;

export function normalizeTerminalInsightStatusRequest(message: JsonRpcMessage): VibeCodexTerminalInsightStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!terminalInsightStatusMethods.has(message.method) && !isTerminalInsightStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const runId = stringValue(payload.runId)
		?? stringValue(payload.run_id)
		?? stringValue(payload.terminalId)
		?? stringValue(payload.terminal_id)
		?? stringValue(payload.commandId)
		?? stringValue(payload.command_id)
		?? stringValue(args.runId)
		?? stringValue(args.run_id)
		?? stringValue(args.terminalId)
		?? stringValue(args.terminal_id)
		?? stringValue(args.commandId)
		?? stringValue(args.command_id);
	return {
		id: message.id,
		method: message.method,
		...(runId ? { runId } : {}),
		latest: booleanValue(payload.latest) ?? booleanValue(args.latest) ?? !runId,
		includeFindings: booleanValue(payload.includeFindings)
			?? booleanValue(payload.include_findings)
			?? booleanValue(args.includeFindings)
			?? booleanValue(args.include_findings)
			?? !!runId,
		maxFindings: clampNumber(
			numberValue(payload.maxFindings)
				?? numberValue(payload.max_findings)
				?? numberValue(args.maxFindings)
				?? numberValue(args.max_findings)
				?? defaultMaxFindings,
			0,
			maxFindingsLimit,
		),
		requestedAt: Date.now(),
	};
}

export function createTerminalInsightStatusResponse(request: VibeCodexTerminalInsightStatusRequest, insights: readonly VibeCodexTerminalInsight[]): VibeCodexTerminalInsightStatusResponse {
	const ordered = [...insights].sort((a, b) => b.createdAt - a.createdAt).slice(0, maxInsights);
	const selected = request.runId
		? ordered.find(insight => insight.runId === request.runId)
		: request.latest ? ordered[0] : undefined;
	const visible = selected ? [selected] : request.runId ? [] : ordered;
	const counts = countFindings(visible.flatMap(insight => [...insight.findings]));
	const ok = !request.runId || !!selected;
	const selectedItem = selected ? terminalInsightStatusItem(selected, request) : undefined;
	return {
		ok,
		source: 'externalExtension',
		...(request.runId ? { requestedRunId: redactSensitiveText(request.runId) } : {}),
		...(selectedItem ? { selectedRunId: selectedItem.runId } : {}),
		...(ordered[0] ? { latestRunId: redactSensitiveText(ordered[0].runId) } : {}),
		knownRunIds: ordered.map(insight => redactSensitiveText(insight.runId)),
		total: visible.length,
		...(selectedItem ? { insight: selectedItem } : {}),
		...(!selectedItem ? { insights: visible.map(insight => terminalInsightStatusItem(insight, request)) } : {}),
		counts,
		guardrails: [
			'Terminal insight status is read-only and never starts, interrupts, retries, or reruns terminal commands.',
			'Raw terminal output is intentionally omitted; use command_output or terminal/output for capped redacted output tails.',
			'Command lines, findings, URLs, and follow-up prompts are redacted before they are returned to the backend.',
			'The response reports classified IDE-side evidence only and does not approve plans, accept diffs, or mark verification complete.',
		],
		message: ok
			? terminalInsightStatusMessage(visible, selectedItem)
			: `Terminal insight ${redactSensitiveText(request.runId ?? '')} was not found.`,
	};
}

export function terminalInsightStatusSummary(response: VibeCodexTerminalInsightStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	return `${response.message} Findings: ${response.counts.error} error, ${response.counts.warning} warning, ${response.counts.info} info.`;
}

function terminalInsightStatusItem(insight: VibeCodexTerminalInsight, request: VibeCodexTerminalInsightStatusRequest): VibeCodexTerminalInsightStatusItem {
	const findings = insight.findings.slice(0, request.maxFindings).map(redactedFinding);
	return {
		runId: redactSensitiveText(insight.runId),
		commandLine: redactSensitiveText(insight.commandLine),
		status: insight.status,
		createdAt: insight.createdAt,
		summary: redactSensitiveText(insight.summary),
		urls: redactSensitiveValue(insight.urls) as readonly string[],
		findingCounts: countFindings(insight.findings),
		findingKinds: [...new Set(insight.findings.map(finding => finding.kind))],
		signature: redactSensitiveText(terminalInsightSignature(insight)),
		followUpPromptAvailable: !!insight.followUpPrompt,
		...(request.includeFindings ? { findings } : {}),
		...(request.includeFindings && insight.followUpPrompt ? { followUpPrompt: redactSensitiveText(insight.followUpPrompt) } : {}),
	};
}

function redactedFinding(finding: VibeCodexTerminalInsightFinding): VibeCodexTerminalInsightFinding {
	return {
		...finding,
		id: redactSensitiveText(finding.id),
		title: redactSensitiveText(finding.title),
		detail: redactSensitiveText(finding.detail),
	};
}

function countFindings(findings: readonly VibeCodexTerminalInsightFinding[]): Record<VibeCodexTerminalInsightSeverity, number> {
	return findings.reduce<Record<VibeCodexTerminalInsightSeverity, number>>((counts, finding) => {
		counts[finding.severity]++;
		return counts;
	}, { info: 0, warning: 0, error: 0 });
}

function terminalInsightStatusMessage(insights: readonly VibeCodexTerminalInsight[], selected: VibeCodexTerminalInsightStatusItem | undefined): string {
	if (selected) {
		return `Returned terminal insight for ${selected.runId}: ${selected.summary}`;
	}
	return insights.length
		? `Returned ${insights.length} terminal insight${insights.length === 1 ? '' : 's'}.`
		: 'No terminal insights are available yet.';
}

function isTerminalInsightStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return terminalInsightStatusToolNames.has(tool);
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
