/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexPreviewPlan, VibeCodexPreviewTarget } from './previewPlan';
import type { VibeCodexTerminalInsight, VibeCodexTerminalInsightFinding, VibeCodexTerminalInsightSeverity } from './terminalInsight';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexPreviewStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly url?: string;
	readonly includeTargets: boolean;
	readonly includeInsights: boolean;
	readonly maxInsights: number;
	readonly requestedAt: number;
}

export interface VibeCodexPreviewStatusTarget {
	readonly id: string;
	readonly label: string;
	readonly command: string;
	readonly cwd?: string;
	readonly url: string;
	readonly source: string;
	readonly status: VibeCodexPreviewTarget['status'];
}

export interface VibeCodexPreviewStatusInsight {
	readonly runId: string;
	readonly commandLine: string;
	readonly status: VibeCodexTerminalInsight['status'];
	readonly createdAt: number;
	readonly summary: string;
	readonly urls: readonly string[];
	readonly findingCounts: Record<VibeCodexTerminalInsightSeverity, number>;
	readonly findingKinds: readonly string[];
}

export interface VibeCodexPreviewStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly method: string;
	readonly available: boolean;
	readonly generatedAt: number;
	readonly detectedAt?: number;
	readonly requestedUrl?: string;
	readonly requestedUrlKnown: boolean;
	readonly counts: {
		readonly targets: number;
		readonly returnedTargets: number;
		readonly terminalUrls: number;
		readonly insights: number;
		readonly returnedInsights: number;
		readonly runningInsights: number;
		readonly pendingBrowserActions: number;
	};
	readonly targets: readonly VibeCodexPreviewStatusTarget[];
	readonly localUrls: readonly string[];
	readonly insights: readonly VibeCodexPreviewStatusInsight[];
	readonly approval: {
		readonly startRequiresApproval: true;
		readonly openNavigateRequiresApproval: true;
		readonly hasExecutionAuthorization: boolean;
		readonly pendingBrowserActions: number;
	};
	readonly guardrails: readonly string[];
	readonly message: string;
	readonly promptBlock: string;
}

const previewStatusMethods = new Set([
	'agent/getPreviewStatus',
	'agent/previewStatus',
	'preview/status',
	'browser/previewStatus',
	'localhost/previewStatus',
	'vibecodex/previewStatus',
]);

const previewStatusToolNames = new Set([
	'preview_status',
	'get_preview_status',
	'localhost_preview_status',
	'browser_preview_status',
	'web_preview_status',
	'preview_targets_status',
]);

const defaultMaxInsights = 8;
const maxInsightLimit = 24;
const maxTargets = 16;

export function normalizePreviewStatusRequest(message: JsonRpcMessage): VibeCodexPreviewStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!previewStatusMethods.has(message.method) && !isPreviewStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const url = stringValue(payload.url)
		?? stringValue(args.url)
		?? stringValue(payload.previewUrl)
		?? stringValue(payload.preview_url)
		?? stringValue(args.previewUrl)
		?? stringValue(args.preview_url);
	return {
		id: message.id,
		method: message.method,
		...(url ? { url: redactSensitiveText(url) } : {}),
		includeTargets: booleanValue(payload.includeTargets)
			?? booleanValue(payload.include_targets)
			?? booleanValue(args.includeTargets)
			?? booleanValue(args.include_targets)
			?? true,
		includeInsights: booleanValue(payload.includeInsights)
			?? booleanValue(payload.include_insights)
			?? booleanValue(args.includeInsights)
			?? booleanValue(args.include_insights)
			?? true,
		maxInsights: clampNumber(
			numberValue(payload.maxInsights)
				?? numberValue(payload.max_insights)
				?? numberValue(args.maxInsights)
				?? numberValue(args.max_insights)
				?? defaultMaxInsights,
			0,
			maxInsightLimit,
		),
		requestedAt: Date.now(),
	};
}

export function createPreviewStatusResponse(request: VibeCodexPreviewStatusRequest, input: {
	readonly previewPlan?: VibeCodexPreviewPlan;
	readonly terminalInsights?: readonly VibeCodexTerminalInsight[];
	readonly pendingBrowserActions?: number;
	readonly hasExecutionAuthorization?: boolean;
}): VibeCodexPreviewStatusResponse {
	const planTargets = input.previewPlan?.previews ?? [];
	const localUrls = dedupe([
		...planTargets.map(target => target.url),
		...(input.terminalInsights ?? []).flatMap(insight => [...insight.urls]),
	].map(url => redactSensitiveText(url)).filter(isLoopbackUrl));
	const requestedUrl = request.url ? redactSensitiveText(request.url) : undefined;
	const requestedUrlKnown = requestedUrl ? localUrls.includes(requestedUrl) || planTargets.some(target => redactSensitiveText(target.url) === requestedUrl) : false;
	const targets = request.includeTargets ? planTargets.slice(0, maxTargets).map(sanitizeTarget) : [];
	const orderedInsights = [...(input.terminalInsights ?? [])].sort((first, second) => second.createdAt - first.createdAt);
	const returnedInsights = request.includeInsights ? orderedInsights.slice(0, request.maxInsights).map(sanitizeInsight) : [];
	const pendingBrowserActions = input.pendingBrowserActions ?? 0;
	const responseWithoutMessage = {
		ok: true,
		source: 'externalExtension' as const,
		method: request.method,
		available: !!input.previewPlan || localUrls.length > 0 || pendingBrowserActions > 0,
		generatedAt: Date.now(),
		...(input.previewPlan ? { detectedAt: input.previewPlan.detectedAt } : {}),
		...(requestedUrl ? { requestedUrl } : {}),
		requestedUrlKnown,
		counts: {
			targets: planTargets.length,
			returnedTargets: targets.length,
			terminalUrls: localUrls.length,
			insights: orderedInsights.length,
			returnedInsights: returnedInsights.length,
			runningInsights: orderedInsights.filter(insight => insight.status === 'running').length,
			pendingBrowserActions,
		},
		targets,
		localUrls,
		insights: returnedInsights,
		approval: {
			startRequiresApproval: true as const,
			openNavigateRequiresApproval: true as const,
			hasExecutionAuthorization: !!input.hasExecutionAuthorization,
			pendingBrowserActions,
		},
		guardrails: [
			'Preview status is read-only and never starts servers, runs terminal commands, opens browsers, fetches URLs, approves browser actions, or mutates files.',
			'Preview startup remains a visible terminal handoff gated by Mode Policy, exact visual-plan approval, command permissions, and user approval.',
			'Browser open/navigate remains a separate approval-gated action; this status call only reports pending browser actions and known safe loopback URLs.',
			'Raw terminal output is omitted; use terminal_insight_status or command_output for capped redacted terminal evidence.',
			'Preview target commands, URLs, run ids, and summaries are redacted before they are returned to the backend.',
		],
	};
	return {
		...responseWithoutMessage,
		message: previewStatusSummary(responseWithoutMessage),
		promptBlock: previewStatusPromptBlock(responseWithoutMessage),
	};
}

export function previewStatusSummary(response: Pick<VibeCodexPreviewStatusResponse, 'available' | 'counts' | 'requestedUrlKnown' | 'requestedUrl'>): string {
	if (!response.available) {
		return 'Preview status unavailable: no preview plan, terminal-discovered localhost URL, or pending browser action is available yet.';
	}
	const targetWord = response.counts.targets === 1 ? 'target' : 'targets';
	const urlWord = response.counts.terminalUrls === 1 ? 'URL' : 'URLs';
	const pending = response.counts.pendingBrowserActions ? ` ${response.counts.pendingBrowserActions} pending browser approval${response.counts.pendingBrowserActions === 1 ? '' : 's'}.` : '';
	const requested = response.requestedUrl ? ` Requested URL is ${response.requestedUrlKnown ? 'known' : 'not known'}.` : '';
	return `${response.counts.targets} preview ${targetWord}; ${response.counts.terminalUrls} loopback ${urlWord}; ${response.counts.runningInsights} running terminal insight${response.counts.runningInsights === 1 ? '' : 's'}.${pending}${requested}`;
}

function previewStatusPromptBlock(response: Omit<VibeCodexPreviewStatusResponse, 'message' | 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		available: response.available,
		requestedUrl: response.requestedUrl,
		requestedUrlKnown: response.requestedUrlKnown,
		counts: response.counts,
		targets: response.targets,
		localUrls: response.localUrls,
		insights: response.insights,
		approval: response.approval,
		guardrails: response.guardrails,
		note: 'Preview status is read-only planning/runtime context. Backend must still request preview.start, execute_command, or browser_action through explicit Vibe Codex approval.',
	}), null, 2);
}

function sanitizeTarget(target: VibeCodexPreviewTarget): VibeCodexPreviewStatusTarget {
	return {
		id: redactSensitiveText(target.id),
		label: redactSensitiveText(target.label),
		command: redactSensitiveText(target.command),
		...(target.cwd ? { cwd: redactSensitiveText(target.cwd) } : {}),
		url: redactSensitiveText(target.url),
		source: redactSensitiveText(target.source),
		status: target.status,
	};
}

function sanitizeInsight(insight: VibeCodexTerminalInsight): VibeCodexPreviewStatusInsight {
	return {
		runId: redactSensitiveText(insight.runId),
		commandLine: redactSensitiveText(insight.commandLine),
		status: insight.status,
		createdAt: insight.createdAt,
		summary: redactSensitiveText(insight.summary),
		urls: redactSensitiveValue(insight.urls.filter(isLoopbackUrl)) as readonly string[],
		findingCounts: countFindings(insight.findings),
		findingKinds: [...new Set(insight.findings.map(finding => finding.kind))].map(kind => redactSensitiveText(kind)),
	};
}

function countFindings(findings: readonly VibeCodexTerminalInsightFinding[]): Record<VibeCodexTerminalInsightSeverity, number> {
	return findings.reduce<Record<VibeCodexTerminalInsightSeverity, number>>((counts, finding) => {
		counts[finding.severity]++;
		return counts;
	}, { info: 0, warning: 0, error: 0 });
}

function isPreviewStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name)
		?? '').toLowerCase();
	return previewStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function isLoopbackUrl(url: string): boolean {
	return /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?(?:\/[^\s'"<>)\]]*)?$/i.test(url);
}

function dedupe(values: readonly string[]): readonly string[] {
	return [...new Set(values)];
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
