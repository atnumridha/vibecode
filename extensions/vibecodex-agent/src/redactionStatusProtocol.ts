/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexRedactionStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeSamples: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexActiveRedactionFilter {
	readonly id: string;
	readonly label: string;
	readonly category: 'api_key' | 'authorization' | 'credential' | 'token' | 'url' | 'approval';
	readonly protects: readonly string[];
}

export interface VibeCodexRedactionSampleResult {
	readonly id: string;
	readonly category: VibeCodexActiveRedactionFilter['category'];
	readonly description: string;
	readonly redacted: boolean;
	readonly leaked: boolean;
	readonly markers: readonly string[];
	readonly outputPreview: string;
}

export interface VibeCodexRedactionStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly enabled: true;
	readonly requestedAt: number;
	readonly checkedAt: number;
	readonly filters: readonly VibeCodexActiveRedactionFilter[];
	readonly counts: {
		readonly filters: number;
		readonly samples: number;
		readonly passed: number;
		readonly failed: number;
	};
	readonly sampleResults?: readonly VibeCodexRedactionSampleResult[];
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

interface RedactionSyntheticSample {
	readonly id: string;
	readonly category: VibeCodexActiveRedactionFilter['category'];
	readonly description: string;
	readonly input: string;
	readonly rawValues: readonly string[];
}

const redactionStatusMethods = new Set([
	'agent/getRedactionStatus',
	'agent/redactionStatus',
	'security/redactionStatus',
	'redaction/status',
	'secrets/status',
	'tokenFilters/status',
	'vibecodex/redactionStatus',
]);

const redactionStatusToolNames = new Set([
	'redaction_status',
	'secret_filter_status',
	'secrets_status',
	'token_filter_status',
	'active_token_filters',
	'get_redaction_status',
]);

const activeRedactionFilters: readonly VibeCodexActiveRedactionFilter[] = [
	{ id: 'private-key-block', label: 'Private key block filter', category: 'credential', protects: ['PEM private key material'] },
	{ id: 'bearer-token', label: 'Authorization bearer filter', category: 'authorization', protects: ['Authorization headers', 'Bearer tokens'] },
	{ id: 'openai-api-key', label: 'OpenAI-style API key filter', category: 'api_key', protects: ['sk- API keys', 'OpenAI-compatible provider keys'] },
	{ id: 'github-token', label: 'GitHub token filter', category: 'token', protects: ['ghp/gho/ghu/ghs/ghr tokens'] },
	{ id: 'slack-token', label: 'Slack token filter', category: 'token', protects: ['xoxb/xoxa/xoxp/xoxr/xoxs tokens'] },
	{ id: 'aws-access-key', label: 'AWS access key filter', category: 'api_key', protects: ['AKIA/ASIA access key ids'] },
	{ id: 'jwt-token', label: 'JWT token filter', category: 'token', protects: ['JWT-like compact tokens'] },
	{ id: 'approval-token', label: 'Vibe Codex plan approval token filter', category: 'approval', protects: ['vibecodex-plan authorization tokens'] },
	{ id: 'sensitive-assignment', label: 'Sensitive assignment filter', category: 'credential', protects: ['apiKey/password/secret/credential assignments'] },
	{ id: 'sensitive-url-query', label: 'Sensitive URL query filter', category: 'url', protects: ['token/key/secret/password/auth query parameters'] },
];

const syntheticSamples: readonly RedactionSyntheticSample[] = [
	{
		id: 'openai-key',
		category: 'api_key',
		description: 'OpenAI-compatible API key assignment',
		input: 'OPENAI_API_KEY=sk-vibecodexsample1234567890',
		rawValues: ['sk-vibecodexsample1234567890'],
	},
	{
		id: 'bearer-header',
		category: 'authorization',
		description: 'Authorization bearer header',
		input: 'Authorization: Bearer vibecodex-sample-token-abcdefghijklmnopqrstuvwxyz123456',
		rawValues: ['vibecodex-sample-token-abcdefghijklmnopqrstuvwxyz123456'],
	},
	{
		id: 'jwt',
		category: 'token',
		description: 'JWT-like compact token',
		input: 'session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signaturevalue12345',
		rawValues: ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signaturevalue12345'],
	},
	{
		id: 'slack-token',
		category: 'token',
		description: 'Slack bot token',
		input: `SLACK_BOT_TOKEN=${joinSecret(['xoxb', '111111111111', '222222222222', 'vibecodexsample'])}`,
		rawValues: [joinSecret(['xoxb', '111111111111', '222222222222', 'vibecodexsample'])],
	},
	{
		id: 'private-key',
		category: 'credential',
		description: 'PEM private key block',
		input: '-----BEGIN PRIVATE KEY-----\nMIIvibecodexsampleprivatekey\n-----END PRIVATE KEY-----',
		rawValues: ['MIIvibecodexsampleprivatekey'],
	},
	{
		id: 'url-query',
		category: 'url',
		description: 'Sensitive URL query parameters',
		input: 'https://example.test/callback?token=vibecodex-url-token&api_key=sk-vibecodexurlsample12345',
		rawValues: ['vibecodex-url-token', 'sk-vibecodexurlsample12345'],
	},
	{
		id: 'credential-assignment',
		category: 'credential',
		description: 'Generic sensitive assignment',
		input: 'password="vibecodex-super-secret-password"; client_secret=vibecodex-client-secret',
		rawValues: ['vibecodex-super-secret-password', 'vibecodex-client-secret'],
	},
	{
		id: 'approval-token',
		category: 'approval',
		description: 'Vibe Codex plan approval token',
		input: 'approvalToken=vibecodex-plan:task-123:revision-2:abcdef123456',
		rawValues: ['vibecodex-plan:task-123:revision-2:abcdef123456'],
	},
];

export function normalizeRedactionStatusRequest(message: JsonRpcMessage): VibeCodexRedactionStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!redactionStatusMethods.has(message.method) && !isRedactionStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeSamples: booleanValue(payload.includeSamples)
			?? booleanValue(payload.include_samples)
			?? booleanValue(args.includeSamples)
			?? booleanValue(args.include_samples)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createRedactionStatusResponse(request: VibeCodexRedactionStatusRequest): VibeCodexRedactionStatusResponse {
	const sampleResults = syntheticSamples.map(evaluateSyntheticSample);
	const failed = sampleResults.filter(sample => sample.leaked || !sample.redacted);
	const response: VibeCodexRedactionStatusResponse = {
		ok: true,
		source: 'externalExtension',
		version: 1,
		enabled: true,
		requestedAt: request.requestedAt,
		checkedAt: Date.now(),
		filters: activeRedactionFilters,
		counts: {
			filters: activeRedactionFilters.length,
			samples: sampleResults.length,
			passed: sampleResults.length - failed.length,
			failed: failed.length,
		},
		...(request.includeSamples ? { sampleResults } : {}),
		...(request.includePromptBlock ? { promptBlock: redactionStatusPromptBlock(sampleResults) } : {}),
		guardrails: [
			'Redaction status is read-only and never scans workspace files, terminal buffers, provider config, VS Code secret storage, or environment variables.',
			'Synthetic sample tokens are generated inside the extension; raw sample values are never returned in status responses, transcripts, prompt blocks, or protocol diagnostics.',
			'Protocol diagnostics, transcripts, tool responses, context prompt blocks, session exports, terminal evidence, provider status, workflow status, and client-state payloads must pass through the active token filters before leaving the extension.',
			'This self-test proves active token filter availability for known token classes; it is not a guarantee that every possible secret format in the workspace is absent.',
		],
		message: failed.length
			? `Active token filter self-test failed ${failed.length}/${sampleResults.length} synthetic sample${failed.length === 1 ? '' : 's'}.`
			: `Active token filters passed ${sampleResults.length}/${sampleResults.length} synthetic samples across ${activeRedactionFilters.length} filters.`,
	};
	return redactSensitiveValue(response) as VibeCodexRedactionStatusResponse;
}

export function redactionStatusSummary(response: VibeCodexRedactionStatusResponse): string {
	return `${response.message} Filters: ${response.counts.filters}; passed: ${response.counts.passed}; failed: ${response.counts.failed}.`;
}

function evaluateSyntheticSample(sample: RedactionSyntheticSample): VibeCodexRedactionSampleResult {
	const redactedText = redactSensitiveText(sample.input);
	const leaked = sample.rawValues.some(raw => redactedText.includes(raw));
	const outputPreview = leaked ? '[redaction-self-test-output-suppressed]' : excerpt(redactedText, 180);
	const markers = Array.from(new Set(redactedText.match(/\[redacted(?::[^\]]+)?\]/g) ?? (redactedText.includes('Bearer [redacted]') ? ['Bearer [redacted]'] : [])));
	return {
		id: sample.id,
		category: sample.category,
		description: sample.description,
		redacted: redactedText !== sample.input,
		leaked,
		markers,
		outputPreview,
	};
}

function redactionStatusPromptBlock(samples: readonly VibeCodexRedactionSampleResult[]): string {
	const failedIds = samples.filter(sample => sample.leaked || !sample.redacted).map(sample => sample.id);
	return JSON.stringify(redactSensitiveValue({
		redactionStatus: 'active_token_filters',
		enabled: true,
		filterCount: activeRedactionFilters.length,
		sampleCount: samples.length,
		passed: samples.length - failedIds.length,
		failed: failedIds.length,
		failedIds,
		note: 'Active token filters must be applied before returning context, protocol diagnostics, terminal evidence, transcripts, provider state, workflow status, or client-state payloads. Redaction status is read-only and never scans workspace secrets.',
	}), null, 2);
}

function isRedactionStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return redactionStatusToolNames.has(tool);
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

function excerpt(value: string, maxChars: number): string {
	const oneLine = value.replace(/\s+/g, ' ').trim();
	if (oneLine.length <= maxChars) {
		return oneLine;
	}
	return `${oneLine.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function joinSecret(parts: readonly string[]): string {
	return parts.join('-');
}
