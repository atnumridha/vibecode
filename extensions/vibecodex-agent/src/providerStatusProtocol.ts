/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexProviderModelRouting, VibeCodexProviderRuntimeConfig } from './providerConfig';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexProviderStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly mode?: string;
	readonly includeCodexConfig: boolean;
	readonly includeModeRoutes: boolean;
	readonly includePromptBlock?: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexProviderModeRouteStatus {
	readonly provider: VibeCodexProviderRuntimeConfig['provider'];
	readonly label: string;
	readonly mode?: string;
	readonly model?: string;
	readonly modelSource?: string;
	readonly modelRouting?: VibeCodexProviderModelRouting;
	readonly baseUrl?: string;
	readonly apiKeyConfigured: boolean;
	readonly apiKeyStorage: VibeCodexProviderRuntimeConfig['apiKeyStorage'];
}

export interface VibeCodexProviderStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly ready?: boolean;
	readonly provider?: VibeCodexProviderRuntimeConfig['provider'];
	readonly label?: string;
	readonly mode?: string;
	readonly model?: string;
	readonly modelSource?: string;
	readonly modelRouting?: VibeCodexProviderModelRouting;
	readonly baseUrl?: string;
	readonly apiKeyConfigured: boolean;
	readonly apiKeyStorage?: VibeCodexProviderRuntimeConfig['apiKeyStorage'];
	readonly readiness?: VibeCodexProviderReadiness;
	readonly codexConfig?: unknown;
	readonly modeRoutes?: readonly VibeCodexProviderModeRouteStatus[];
	readonly counts?: {
		readonly modeRoutes: number;
		readonly modeOverrides: number;
		readonly credentialReadyRoutes: number;
		readonly baseUrlReadyRoutes: number;
	};
	readonly guardrails?: readonly string[];
	readonly blockers?: readonly string[];
	readonly warnings?: readonly string[];
	readonly nextAction?: string;
	readonly promptBlock?: string;
	readonly message: string;
}

export interface VibeCodexProviderReadiness {
	readonly ready: boolean;
	readonly provider: VibeCodexProviderRuntimeConfig['provider'];
	readonly local: boolean;
	readonly openAiCompatible: boolean;
	readonly baseUrlRequired: boolean;
	readonly baseUrlReady: boolean;
	readonly apiKeyRequired: boolean;
	readonly credentialReady: boolean;
	readonly modelReady: boolean;
	readonly modelSource: string;
	readonly blockers: readonly string[];
	readonly warnings: readonly string[];
	readonly nextAction: string;
}

const providerStatusMethods = new Set([
	'agent/getProviderStatus',
	'agent/providerStatus',
	'provider/status',
	'model/status',
	'vibecodex/providerStatus',
]);

const providerStatusToolNames = new Set([
	'provider_status',
	'get_provider_status',
	'model_status',
	'get_model_status',
]);

export function normalizeProviderStatusRequest(message: JsonRpcMessage): VibeCodexProviderStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!providerStatusMethods.has(message.method) && !isProviderStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		...(stringValue(payload.mode) ?? stringValue(args.mode) ? { mode: stringValue(payload.mode) ?? stringValue(args.mode) } : {}),
		includeCodexConfig: booleanValue(payload.includeCodexConfig)
			?? booleanValue(payload.include_codex_config)
			?? booleanValue(args.includeCodexConfig)
			?? booleanValue(args.include_codex_config)
			?? true,
		includeModeRoutes: booleanValue(payload.includeModeRoutes)
			?? booleanValue(payload.include_mode_routes)
			?? booleanValue(args.includeModeRoutes)
			?? booleanValue(args.include_mode_routes)
			?? false,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createProviderStatusResponse(
	request: VibeCodexProviderStatusRequest,
	provider: VibeCodexProviderRuntimeConfig | undefined,
	modeRoutes: readonly (VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>)[] = [],
): VibeCodexProviderStatusResponse {
	if (!provider) {
		return {
			ok: false,
			source: 'externalExtension',
			ready: false,
			apiKeyConfigured: false,
			...(request.includeModeRoutes ? {
				modeRoutes: [],
				counts: { modeRoutes: 0, modeOverrides: 0, credentialReadyRoutes: 0, baseUrlReadyRoutes: 0 },
				guardrails: providerStatusGuardrails(),
			} : {}),
			blockers: ['No provider runtime config is available.'],
			warnings: [],
			nextAction: 'Configure a provider, model, base URL, or Codex CLI login before requesting provider_status again.',
			message: 'No provider status is available yet.',
		};
	}
	const sanitizedRoutes = request.includeModeRoutes ? modeRoutes.map(providerModeRoute) : [];
	const readiness = providerReadiness(provider);
	const responseWithoutPromptBlock = {
		ok: true,
		source: 'externalExtension' as const,
		ready: readiness.ready,
		provider: provider.provider,
		label: redactSensitiveText(provider.label),
		...(provider.mode ? { mode: provider.mode } : {}),
		...(provider.model ? { model: redactSensitiveText(provider.model) } : {}),
		modelSource: provider.modelRouting.source,
		modelRouting: redactSensitiveValue(provider.modelRouting) as VibeCodexProviderModelRouting,
		...(provider.baseUrl ? { baseUrl: redactSensitiveText(provider.baseUrl) } : {}),
		apiKeyConfigured: provider.apiKeyConfigured,
		apiKeyStorage: provider.apiKeyStorage,
		readiness,
		...(request.includeCodexConfig ? { codexConfig: redactSensitiveValue(provider.codexConfig) } : {}),
		...(request.includeModeRoutes ? {
			modeRoutes: sanitizedRoutes,
			counts: {
				modeRoutes: sanitizedRoutes.length,
				modeOverrides: sanitizedRoutes.filter(route => route.modelSource === 'modeModels').length,
				credentialReadyRoutes: sanitizedRoutes.filter(route => route.apiKeyConfigured).length,
				baseUrlReadyRoutes: sanitizedRoutes.filter(route => !!route.baseUrl).length,
			},
			guardrails: providerStatusGuardrails(),
		} : {}),
		blockers: readiness.blockers,
		warnings: readiness.warnings,
		nextAction: readiness.nextAction,
		message: `Provider ${provider.label}${provider.mode ? ` for ${provider.mode} mode` : ''}${provider.model ? ` / ${provider.model}` : ''}: API key ${provider.apiKeyConfigured ? `configured via ${provider.apiKeyStorage}` : 'not configured'}; model source ${provider.modelRouting.source}.`,
	};
	return {
		...responseWithoutPromptBlock,
		...(request.includePromptBlock ? { promptBlock: providerStatusPromptBlock(responseWithoutPromptBlock) } : {}),
	};
}

export function providerStatusSummary(response: VibeCodexProviderStatusResponse): string {
	if (!response.ok) {
		return response.message;
	}
	return `${response.message} Base URL: ${response.baseUrl ?? 'provider default'}.`;
}

function providerModeRoute(provider: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>): VibeCodexProviderModeRouteStatus {
	return {
		provider: provider.provider,
		label: redactSensitiveText(provider.label),
		...(provider.mode ? { mode: provider.mode } : {}),
		...(provider.model ? { model: redactSensitiveText(provider.model) } : {}),
		modelSource: provider.modelRouting.source,
		modelRouting: redactSensitiveValue(provider.modelRouting) as VibeCodexProviderModelRouting,
		...(provider.baseUrl ? { baseUrl: redactSensitiveText(provider.baseUrl) } : {}),
		apiKeyConfigured: provider.apiKeyConfigured,
		apiKeyStorage: provider.apiKeyStorage,
	};
}

function providerStatusGuardrails(): readonly string[] {
	return [
		'Provider status and mode routing are read-only and never change selected provider, model overrides, base URL, SecretStorage, Codex auth, or environment variables.',
		'Raw API keys are never returned; only credential readiness and storage source are exposed.',
		'Mode route entries are redacted before they are returned to the backend or rendered in the sidebar.',
		'Use explicit provider, model, or mode-model commands to change routing, then request provider status again.',
	];
}

function providerReadiness(provider: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>): VibeCodexProviderReadiness {
	const local = isLocalProvider(provider.provider);
	const openAiCompatible = isOpenAiCompatibleProvider(provider.provider);
	const baseUrlRequired = providerBaseUrlRequired(provider.provider);
	const apiKeyRequired = providerApiKeyRequired(provider.provider);
	const baseUrlReady = !baseUrlRequired || !!provider.baseUrl;
	const credentialReady = !apiKeyRequired || provider.apiKeyConfigured;
	const modelReady = !!provider.model || provider.modelRouting.source === 'unspecified';
	const blockers = [
		baseUrlReady ? undefined : `${provider.label} requires a base URL before backend requests can be routed.`,
		credentialReady ? undefined : `${provider.label} requires configured credentials before backend requests can be routed.`,
		modelReady ? undefined : `${provider.label} needs a model or mode-specific model override before backend requests can be routed.`,
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const warnings = [
		local && !provider.baseUrl ? `${provider.label} is local but no explicit base URL is configured; provider defaults may be used.` : undefined,
		openAiCompatible && provider.baseUrl?.startsWith('http://') ? `${provider.label} uses plain http://; keep this local or switch to https:// for remote endpoints.` : undefined,
		provider.provider === 'codex' && !provider.codexConfig.found ? 'Codex config.toml was not found; Codex CLI defaults or login may still be used.' : undefined,
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const ready = blockers.length === 0;
	return {
		ready,
		provider: provider.provider,
		local,
		openAiCompatible,
		baseUrlRequired,
		baseUrlReady,
		apiKeyRequired,
		credentialReady,
		modelReady,
		modelSource: provider.modelRouting.source,
		blockers,
		warnings,
		nextAction: ready
			? 'Provider route is configured. Continue with backend_launch_status and protocol_status before requesting execution.'
			: blockers[0] ?? 'Fix provider route blockers, then request provider_status again.',
	};
}

function providerStatusPromptBlock(response: Omit<VibeCodexProviderStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'provider_status',
		ready: response.ready,
		provider: response.provider,
		label: response.label,
		mode: response.mode,
		model: response.model,
		modelSource: response.modelSource,
		modelRouting: response.modelRouting,
		baseUrl: response.baseUrl,
		apiKeyConfigured: response.apiKeyConfigured,
		apiKeyStorage: response.apiKeyStorage,
		readiness: response.readiness,
		counts: response.counts,
		blockers: response.blockers,
		warnings: response.warnings,
		nextAction: response.nextAction,
		guardrails: response.guardrails ?? providerStatusGuardrails(),
	}), null, 2);
}

function isOpenAiCompatibleProvider(provider: VibeCodexProviderRuntimeConfig['provider']): boolean {
	return provider === 'openai'
		|| provider === 'custom'
		|| provider === 'lmstudio'
		|| provider === 'ollama'
		|| provider === 'openrouter'
		|| provider === 'vercel'
		|| provider === 'azure'
		|| provider === 'cerebras'
		|| provider === 'groq'
		|| provider === 'mistral'
		|| provider === 'xai';
}

function isLocalProvider(provider: VibeCodexProviderRuntimeConfig['provider']): boolean {
	return provider === 'ollama' || provider === 'lmstudio';
}

function providerBaseUrlRequired(provider: VibeCodexProviderRuntimeConfig['provider']): boolean {
	return provider === 'ollama' || provider === 'lmstudio' || provider === 'azure' || provider === 'custom';
}

function providerApiKeyRequired(provider: VibeCodexProviderRuntimeConfig['provider']): boolean {
	return provider === 'openai'
		|| provider === 'anthropic'
		|| provider === 'gemini'
		|| provider === 'openrouter'
		|| provider === 'vercel'
		|| provider === 'azure'
		|| provider === 'cerebras'
		|| provider === 'groq'
		|| provider === 'mistral'
		|| provider === 'xai'
		|| provider === 'custom'
		|| provider === 'codex';
}

function isProviderStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return providerStatusToolNames.has(tool);
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
