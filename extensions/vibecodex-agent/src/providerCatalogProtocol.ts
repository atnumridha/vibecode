/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexProviderCatalogEntry, VibeCodexProviderRuntimeConfig } from './providerConfig';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexProviderCatalogRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeDefaults: boolean;
	readonly includeCodexConfig: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexProviderCatalogResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly selected?: {
		readonly provider: VibeCodexProviderRuntimeConfig['provider'];
		readonly label: string;
		readonly mode?: string;
		readonly model?: string;
		readonly modelSource?: string;
		readonly modelRouting?: VibeCodexProviderRuntimeConfig['modelRouting'];
		readonly baseUrl?: string;
		readonly apiKeyConfigured: boolean;
		readonly apiKeyStorage: VibeCodexProviderRuntimeConfig['apiKeyStorage'];
	};
	readonly counts: {
		readonly total: number;
		readonly openAiCompatible: number;
		readonly local: number;
		readonly apiKeyRecommended: number;
		readonly baseUrlRequired: number;
	};
	readonly providers: readonly VibeCodexProviderCatalogEntry[];
	readonly codexConfig?: unknown;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexProviderCatalogInput {
	readonly providers: readonly VibeCodexProviderCatalogEntry[];
	readonly selected?: VibeCodexProviderRuntimeConfig;
}

const providerCatalogMethods = new Set([
	'agent/getProviderCatalog',
	'agent/providerCatalog',
	'provider/catalog',
	'model/catalog',
	'vibecodex/providerCatalog',
]);

const providerCatalogToolNames = new Set([
	'provider_catalog',
	'get_provider_catalog',
	'model_catalog',
	'get_model_catalog',
	'provider_list',
	'list_providers',
]);

export function normalizeProviderCatalogRequest(message: JsonRpcMessage): VibeCodexProviderCatalogRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!providerCatalogMethods.has(message.method) && !isProviderCatalogToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeDefaults: booleanValue(payload.includeDefaults)
			?? booleanValue(payload.include_defaults)
			?? booleanValue(args.includeDefaults)
			?? booleanValue(args.include_defaults)
			?? true,
		includeCodexConfig: booleanValue(payload.includeCodexConfig)
			?? booleanValue(payload.include_codex_config)
			?? booleanValue(args.includeCodexConfig)
			?? booleanValue(args.include_codex_config)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createProviderCatalogResponse(request: VibeCodexProviderCatalogRequest, input: VibeCodexProviderCatalogInput): VibeCodexProviderCatalogResponse {
	const providers = input.providers.map(provider => sanitizeProvider(provider, request.includeDefaults));
	const response: VibeCodexProviderCatalogResponse = {
		ok: true,
		source: 'externalExtension',
		...(input.selected ? { selected: selectedProvider(input.selected) } : {}),
		counts: {
			total: providers.length,
			openAiCompatible: providers.filter(provider => provider.openAiCompatible).length,
			local: providers.filter(provider => provider.local).length,
			apiKeyRecommended: providers.filter(provider => provider.apiKeyRecommended).length,
			baseUrlRequired: providers.filter(provider => provider.baseUrlRequired).length,
		},
		providers,
		...(request.includeCodexConfig && input.selected ? { codexConfig: redactSensitiveValue(input.selected.codexConfig) } : {}),
		guardrails: [
			'Provider catalog is read-only and never changes selected provider, model, base URL, SecretStorage, Codex auth, or environment variables.',
			'Raw API keys are never returned; only credential readiness and storage source are exposed for the selected provider.',
			'Use explicit provider selection/configuration commands for changes, then request provider status or provider catalog again.',
		],
		message: `Provider catalog: ${providers.length} provider${providers.length === 1 ? '' : 's'}, ${providers.filter(provider => provider.openAiCompatible).length} OpenAI-compatible, ${providers.filter(provider => provider.local).length} local.`,
	};
	return response;
}

export function providerCatalogSummary(response: VibeCodexProviderCatalogResponse): string {
	const selected = response.selected ? ` Selected: ${response.selected.label}${response.selected.model ? ` / ${response.selected.model}` : ''}.` : '';
	return `${response.message}${selected}`;
}

function selectedProvider(provider: VibeCodexProviderRuntimeConfig): VibeCodexProviderCatalogResponse['selected'] {
	return {
		provider: provider.provider,
		label: redactSensitiveText(provider.label),
		...(provider.mode ? { mode: provider.mode } : {}),
		...(provider.model ? { model: redactSensitiveText(provider.model) } : {}),
		modelSource: provider.modelRouting.source,
		modelRouting: redactSensitiveValue(provider.modelRouting) as VibeCodexProviderRuntimeConfig['modelRouting'],
		...(provider.baseUrl ? { baseUrl: redactSensitiveText(provider.baseUrl) } : {}),
		apiKeyConfigured: provider.apiKeyConfigured,
		apiKeyStorage: provider.apiKeyStorage,
	};
}

function sanitizeProvider(provider: VibeCodexProviderCatalogEntry, includeDefaults: boolean): VibeCodexProviderCatalogEntry {
	return {
		id: provider.id,
		label: redactSensitiveText(provider.label),
		...(provider.description ? { description: redactSensitiveText(provider.description) } : {}),
		...(includeDefaults && provider.defaultBaseUrl ? { defaultBaseUrl: redactSensitiveText(provider.defaultBaseUrl) } : {}),
		...(includeDefaults && provider.defaultModel ? { defaultModel: redactSensitiveText(provider.defaultModel) } : {}),
		apiKeyLabel: redactSensitiveText(provider.apiKeyLabel),
		baseUrlRequired: provider.baseUrlRequired,
		apiKeyRecommended: provider.apiKeyRecommended,
		openAiCompatible: provider.openAiCompatible,
		local: provider.local,
	};
}

function isProviderCatalogToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return providerCatalogToolNames.has(tool);
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
