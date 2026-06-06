/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CodexConfigSummary, codexConfigPromptBlock, codexProviderApiKeyConfigured, codexProviderBaseUrl, readCodexConfigSummary } from './codexConfig';

export type VibeCodexProviderId = 'codex' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'lmstudio' | 'bedrock' | 'openrouter' | 'vercel' | 'azure' | 'vertex' | 'cerebras' | 'groq' | 'mistral' | 'xai' | 'custom';
export type VibeCodexProviderModelSource = 'modeModels' | 'globalModel' | 'codexCliConfig' | 'providerDefault' | 'unspecified';

export interface VibeCodexProviderModelRouting {
	readonly mode?: string;
	readonly globalModel?: string;
	readonly modeModel?: string;
	readonly effectiveModel?: string;
	readonly source: VibeCodexProviderModelSource;
}

export interface VibeCodexProviderRuntimeConfig {
	readonly provider: VibeCodexProviderId;
	readonly label: string;
	readonly mode?: string;
	readonly model?: string;
	readonly modelRouting: VibeCodexProviderModelRouting;
	readonly baseUrl?: string;
	readonly apiKey?: string;
	readonly apiKeyConfigured: boolean;
	readonly apiKeyStorage: 'vscodeSecretStorage' | 'codexConfigEnv' | 'codexCliConfig' | 'none';
	readonly codexConfig: CodexConfigSummary;
}

export interface VibeCodexProviderCatalogEntry {
	readonly id: VibeCodexProviderId;
	readonly label: string;
	readonly description?: string;
	readonly defaultBaseUrl?: string;
	readonly defaultModel?: string;
	readonly apiKeyLabel: string;
	readonly baseUrlRequired: boolean;
	readonly apiKeyRecommended: boolean;
	readonly openAiCompatible: boolean;
	readonly local: boolean;
}

interface ProviderChoice extends vscode.QuickPickItem {
	readonly id: VibeCodexProviderId;
	readonly defaultBaseUrl?: string;
	readonly defaultModel?: string;
	readonly apiKeyLabel: string;
	readonly baseUrlRequired: boolean;
	readonly apiKeyRecommended: boolean;
}

const providerSetting = 'provider';
const modelSetting = 'model';
const modeModelsSetting = 'modeModels';
const baseUrlSetting = 'baseUrl';
const secretPrefix = 'vibecodex.provider';

const providerModeChoices = [
	{ id: 'plan', label: 'Plan' },
	{ id: 'ask', label: 'Ask' },
	{ id: 'manual', label: 'Manual' },
	{ id: 'act', label: 'Act' },
	{ id: 'agent', label: 'Agent' },
	{ id: 'debug', label: 'Debug' },
	{ id: 'review', label: 'Review' },
	{ id: 'custom', label: 'Custom' },
] as const;

const providerChoices: readonly ProviderChoice[] = [
	{
		id: 'codex',
		label: 'Codex / ChatGPT Login',
		description: '~/.codex auth and Codex CLI defaults',
		defaultModel: '',
		apiKeyLabel: 'Codex uses the Codex CLI login/config when available.',
		baseUrlRequired: false,
		apiKeyRecommended: false,
	},
	{
		id: 'openai',
		label: 'OpenAI',
		description: 'OpenAI API key and OpenAI-compatible models',
		defaultBaseUrl: 'https://api.openai.com/v1',
		defaultModel: 'gpt-4.1',
		apiKeyLabel: 'OpenAI API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'anthropic',
		label: 'Anthropic',
		description: 'Claude models through Anthropic or backend-native routing',
		defaultModel: 'claude-sonnet-4-5',
		apiKeyLabel: 'Anthropic API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'gemini',
		label: 'Google Gemini',
		description: 'Google AI Studio / Gemini models through backend-native routing',
		defaultModel: 'gemini-2.5-pro',
		apiKeyLabel: 'Google Gemini API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'ollama',
		label: 'Ollama',
		description: 'Local open-source models',
		defaultBaseUrl: 'http://127.0.0.1:11434/v1',
		defaultModel: 'qwen2.5-coder',
		apiKeyLabel: 'Ollama API key, if your proxy requires one',
		baseUrlRequired: true,
		apiKeyRecommended: false,
	},
	{
		id: 'lmstudio',
		label: 'LM Studio',
		description: 'Local OpenAI-compatible server',
		defaultBaseUrl: 'http://127.0.0.1:1234/v1',
		defaultModel: 'local-model',
		apiKeyLabel: 'LM Studio API key, if enabled',
		baseUrlRequired: true,
		apiKeyRecommended: false,
	},
	{
		id: 'bedrock',
		label: 'Amazon Bedrock',
		description: 'Bedrock-compatible upstream handled by Vibecodex',
		defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
		apiKeyLabel: 'Bedrock access token, if using a proxy',
		baseUrlRequired: false,
		apiKeyRecommended: false,
	},
	{
		id: 'openrouter',
		label: 'OpenRouter',
		description: 'Multi-provider OpenAI-compatible gateway',
		defaultBaseUrl: 'https://openrouter.ai/api/v1',
		apiKeyLabel: 'OpenRouter API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'vercel',
		label: 'Vercel AI Gateway',
		description: 'OpenAI-compatible Vercel AI Gateway',
		defaultBaseUrl: 'https://ai-gateway.vercel.sh/v1',
		apiKeyLabel: 'Vercel AI Gateway API key or OIDC token',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'azure',
		label: 'Azure OpenAI',
		description: 'Azure-hosted OpenAI-compatible deployments',
		apiKeyLabel: 'Azure OpenAI API key',
		baseUrlRequired: true,
		apiKeyRecommended: true,
	},
	{
		id: 'vertex',
		label: 'Google Vertex AI',
		description: 'Vertex AI models handled by Vibecodex/Codex backend credentials',
		defaultModel: 'gemini-2.5-pro',
		apiKeyLabel: 'Vertex API key, if using a proxy',
		baseUrlRequired: false,
		apiKeyRecommended: false,
	},
	{
		id: 'cerebras',
		label: 'Cerebras',
		description: 'Fast inference through Cerebras OpenAI-compatible API',
		defaultBaseUrl: 'https://api.cerebras.ai/v1',
		apiKeyLabel: 'Cerebras API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'groq',
		label: 'Groq',
		description: 'Fast inference through Groq OpenAI-compatible API',
		defaultBaseUrl: 'https://api.groq.com/openai/v1',
		apiKeyLabel: 'Groq API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'mistral',
		label: 'Mistral',
		description: 'Mistral API through OpenAI-compatible routing',
		defaultBaseUrl: 'https://api.mistral.ai/v1',
		apiKeyLabel: 'Mistral API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'xai',
		label: 'xAI',
		description: 'Grok models through OpenAI-compatible xAI API',
		defaultBaseUrl: 'https://api.x.ai/v1',
		apiKeyLabel: 'xAI API key',
		baseUrlRequired: false,
		apiKeyRecommended: true,
	},
	{
		id: 'custom',
		label: 'Custom OpenAI-Compatible',
		description: 'Any provider with API key and base URL',
		defaultBaseUrl: 'http://127.0.0.1:8000/v1',
		defaultModel: 'custom-model',
		apiKeyLabel: 'Provider API key',
		baseUrlRequired: true,
		apiKeyRecommended: true,
	},
];

export async function configureProvider(secrets: vscode.SecretStorage): Promise<VibeCodexProviderRuntimeConfig | undefined> {
	const provider = await selectProvider();
	if (!provider) {
		return undefined;
	}
	await updateConfig(providerSetting, provider.id);
	const current = currentProviderConfig();
	const baseUrl = await promptBaseUrl(provider, current.baseUrl);
	if (baseUrl === undefined) {
		return undefined;
	}
	await updateConfig(baseUrlSetting, baseUrl);
	const model = await promptModel(provider, current.model);
	if (model === undefined) {
		return undefined;
	}
	await updateConfig(modelSetting, model);
	if (provider.apiKeyRecommended || provider.id === 'custom') {
		await promptAndStoreApiKey(secrets, provider);
	}
	return providerRuntimeConfig(secrets);
}

export async function chooseProvider(secrets: vscode.SecretStorage): Promise<VibeCodexProviderRuntimeConfig | undefined> {
	const provider = await selectProvider();
	if (!provider) {
		return undefined;
	}
	await updateConfig(providerSetting, provider.id);
	const current = currentProviderConfig();
	if (!current.baseUrl && provider.defaultBaseUrl) {
		await updateConfig(baseUrlSetting, provider.defaultBaseUrl);
	}
	if (!current.model && provider.defaultModel) {
		await updateConfig(modelSetting, provider.defaultModel);
	}
	return providerRuntimeConfig(secrets);
}

export async function chooseModel(secrets: vscode.SecretStorage): Promise<VibeCodexProviderRuntimeConfig | undefined> {
	const provider = providerChoice(currentProviderConfig().provider);
	const model = await promptModel(provider, currentProviderConfig().model);
	if (model === undefined) {
		return undefined;
	}
	await updateConfig(modelSetting, model);
	return providerRuntimeConfig(secrets);
}

export async function chooseModeModel(secrets: vscode.SecretStorage, currentMode?: string): Promise<VibeCodexProviderRuntimeConfig | undefined> {
	const mode = normalizeModeKey(currentMode) ?? await selectModeForModel();
	if (!mode) {
		return undefined;
	}
	const provider = providerChoice(currentProviderConfig().provider);
	const current = currentProviderConfig();
	const model = await promptModel(provider, current.modeModels[mode] ?? current.model);
	if (model === undefined) {
		return undefined;
	}
	const modeModels = { ...current.modeModels };
	if (model) {
		modeModels[mode] = model;
	} else {
		delete modeModels[mode];
	}
	await updateConfigValue(modeModelsSetting, modeModels);
	return providerRuntimeConfig(secrets, mode);
}

export async function loginProvider(secrets: vscode.SecretStorage): Promise<VibeCodexProviderRuntimeConfig | undefined> {
	const provider = providerChoice(currentProviderConfig().provider);
	await promptAndStoreApiKey(secrets, provider, true);
	return providerRuntimeConfig(secrets);
}

export async function clearProviderCredentials(secrets: vscode.SecretStorage): Promise<VibeCodexProviderRuntimeConfig | undefined> {
	const provider = providerChoice(currentProviderConfig().provider);
	const existing = await secrets.get(secretKey(provider.id));
	if (!existing) {
		void vscode.window.showInformationMessage(`No ${provider.label} credentials are stored in VS Code SecretStorage.`);
		return providerRuntimeConfig(secrets);
	}
	const action = 'Clear credentials';
	const confirmed = await vscode.window.showWarningMessage(
		`Clear stored ${provider.label} credentials from VS Code SecretStorage?`,
		{ modal: true },
		action
	);
	if (confirmed !== action) {
		return undefined;
	}
	await secrets.delete(secretKey(provider.id));
	return providerRuntimeConfig(secrets);
}

export async function providerRuntimeConfig(secrets: vscode.SecretStorage, mode?: string): Promise<VibeCodexProviderRuntimeConfig> {
	const current = currentProviderConfig();
	const provider = providerChoice(current.provider);
	const codexConfig = readCodexConfigSummary(workspaceRootPath());
	const apiKey = await secrets.get(secretKey(provider.id));
	const codexBaseUrl = codexProviderBaseUrl(provider.id, codexConfig);
	const codexEnvKeyConfigured = codexProviderApiKeyConfigured(provider.id, codexConfig);
	const modelRouting = providerModelRouting(current, provider, codexConfig, mode);
	const apiKeyConfigured = !!apiKey || codexEnvKeyConfigured || (provider.id === 'codex' && codexConfig.authJsonPresent);
	return {
		provider: provider.id,
		label: provider.label,
		...(modelRouting.mode ? { mode: modelRouting.mode } : {}),
		...(modelRouting.effectiveModel ? { model: modelRouting.effectiveModel } : {}),
		modelRouting,
		...(current.baseUrl ? { baseUrl: current.baseUrl } : codexBaseUrl ? { baseUrl: codexBaseUrl } : provider.defaultBaseUrl ? { baseUrl: provider.defaultBaseUrl } : {}),
		...(apiKey ? { apiKey } : {}),
		apiKeyConfigured,
		apiKeyStorage: apiKey ? 'vscodeSecretStorage' : codexEnvKeyConfigured ? 'codexConfigEnv' : provider.id === 'codex' && codexConfig.authJsonPresent ? 'codexCliConfig' : 'none',
		codexConfig,
	};
}

export async function providerDisplayConfig(secrets: vscode.SecretStorage, mode?: string): Promise<Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>> {
	const { apiKey, ...display } = await providerRuntimeConfig(secrets, mode);
	return display;
}

export async function providerModeRouteConfigs(secrets: vscode.SecretStorage): Promise<readonly Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>[]> {
	return Promise.all(providerModeChoices.map(mode => providerDisplayConfig(secrets, mode.id)));
}

export function providerCatalogEntries(): readonly VibeCodexProviderCatalogEntry[] {
	return providerChoices.map(provider => ({
		id: provider.id,
		label: provider.label,
		...(provider.description ? { description: provider.description } : {}),
		...(provider.defaultBaseUrl ? { defaultBaseUrl: provider.defaultBaseUrl } : {}),
		...(provider.defaultModel ? { defaultModel: provider.defaultModel } : {}),
		apiKeyLabel: provider.apiKeyLabel,
		baseUrlRequired: provider.baseUrlRequired,
		apiKeyRecommended: provider.apiKeyRecommended,
		openAiCompatible: isOpenAiCompatibleProviderId(provider.id),
		local: provider.id === 'ollama' || provider.id === 'lmstudio' || provider.defaultBaseUrl?.startsWith('http://127.0.0.1') === true || provider.defaultBaseUrl?.startsWith('http://localhost') === true,
	}));
}

export function providerPromptBlock(config: Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>): string {
	return JSON.stringify({
		provider: config.provider,
		mode: config.mode,
		model: config.model,
		modelRouting: config.modelRouting,
		baseUrl: config.baseUrl,
		apiKeyConfigured: config.apiKeyConfigured,
		apiKeyStorage: config.apiKeyStorage,
		codexConfig: JSON.parse(codexConfigPromptBlock(config.codexConfig)) as unknown,
	}, null, 2);
}

function isOpenAiCompatibleProviderId(provider: VibeCodexProviderId): boolean {
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

function workspaceRootPath(): string | undefined {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function currentProviderConfig(): { readonly provider: VibeCodexProviderId; readonly model: string; readonly modeModels: Record<string, string>; readonly baseUrl: string } {
	const config = vscode.workspace.getConfiguration('vibeCodex.extension');
	return {
		provider: normalizeProvider(config.get<string>(providerSetting, 'codex')),
		model: config.get<string>(modelSetting, '').trim(),
		modeModels: normalizeModeModels(config.get<Record<string, unknown>>(modeModelsSetting, {})),
		baseUrl: config.get<string>(baseUrlSetting, '').trim(),
	};
}

function providerModelRouting(current: { readonly model: string; readonly modeModels: Record<string, string> }, provider: ProviderChoice, codexConfig: CodexConfigSummary, mode?: string): VibeCodexProviderModelRouting {
	const normalizedMode = normalizeModeKey(mode);
	const modeModel = normalizedMode ? current.modeModels[normalizedMode] : undefined;
	const globalModel = current.model || undefined;
	const effectiveModel = modeModel
		?? globalModel
		?? (provider.id === 'codex' ? codexConfig.defaultModel : undefined)
		?? provider.defaultModel
		?? undefined;
	const source: VibeCodexProviderModelSource = modeModel
		? 'modeModels'
		: globalModel
			? 'globalModel'
			: provider.id === 'codex' && codexConfig.defaultModel
				? 'codexCliConfig'
				: provider.defaultModel
					? 'providerDefault'
					: 'unspecified';
	return {
		...(normalizedMode ? { mode: normalizedMode } : {}),
		...(globalModel ? { globalModel } : {}),
		...(modeModel ? { modeModel } : {}),
		...(effectiveModel ? { effectiveModel } : {}),
		source,
	};
}

async function selectProvider(): Promise<ProviderChoice | undefined> {
	return vscode.window.showQuickPick(providerChoices, {
		title: 'Select Vibe Codex Provider',
		placeHolder: 'Choose the model provider for Vibe Codex',
	});
}

async function promptBaseUrl(provider: ProviderChoice, current: string): Promise<string | undefined> {
	if (!provider.baseUrlRequired && provider.id !== 'openai' && provider.id !== 'custom') {
		return current || provider.defaultBaseUrl || '';
	}
	const value = await vscode.window.showInputBox({
		title: `${provider.label}: Base URL`,
		prompt: provider.baseUrlRequired ? 'Required for local/custom OpenAI-compatible providers.' : 'Leave blank to use the provider default.',
		value: current || provider.defaultBaseUrl || '',
		ignoreFocusOut: true,
		validateInput: input => validateBaseUrl(input, provider.baseUrlRequired),
	});
	return value === undefined ? undefined : value.trim();
}

async function promptModel(provider: ProviderChoice, current: string): Promise<string | undefined> {
	const value = await vscode.window.showInputBox({
		title: `${provider.label}: Model`,
		prompt: 'Model name sent to the Vibecodex/Codex backend.',
		value: current || provider.defaultModel || '',
		ignoreFocusOut: true,
		validateInput: input => input.trim().length > 120 ? 'Model name is too long.' : undefined,
	});
	return value === undefined ? undefined : value.trim();
}

async function selectModeForModel(): Promise<string | undefined> {
	const choice = await vscode.window.showQuickPick(providerModeChoices.map(mode => ({
		label: mode.label,
		description: `${mode.id} mode`,
		id: mode.id,
	})), {
		title: 'Select Vibe Codex Mode Model',
		placeHolder: 'Choose which mode should use this model override',
	});
	return choice?.id;
}

async function promptAndStoreApiKey(secrets: vscode.SecretStorage, provider: ProviderChoice, force = false): Promise<void> {
	const existing = await secrets.get(secretKey(provider.id));
	const value = await vscode.window.showInputBox({
		title: `${provider.label}: API Key`,
		prompt: existing && !force ? `${provider.apiKeyLabel}. Leave blank to keep the stored key.` : provider.apiKeyLabel,
		password: true,
		ignoreFocusOut: true,
	});
	if (value === undefined) {
		return;
	}
	if (!value.trim()) {
		if (!existing && provider.apiKeyRecommended) {
			void vscode.window.showWarningMessage(`${provider.label} usually needs an API key. You can add it later with Vibe Codex: Login.`);
		}
		return;
	}
	await secrets.store(secretKey(provider.id), value.trim());
}

async function updateConfig(key: string, value: string): Promise<void> {
	await vscode.workspace.getConfiguration('vibeCodex.extension').update(key, value, vscode.ConfigurationTarget.Global);
}

async function updateConfigValue(key: string, value: unknown): Promise<void> {
	await vscode.workspace.getConfiguration('vibeCodex.extension').update(key, value, vscode.ConfigurationTarget.Global);
}

function validateBaseUrl(input: string, required: boolean): string | undefined {
	const value = input.trim();
	if (!value) {
		return required ? 'Base URL is required.' : undefined;
	}
	if (!/^https?:\/\/[^\s]+$/i.test(value)) {
		return 'Base URL must start with http:// or https://.';
	}
	if (/[\r\n\u0000]/.test(value)) {
		return 'Base URL must not contain control characters.';
	}
	return undefined;
}

function providerChoice(provider: VibeCodexProviderId): ProviderChoice {
	return providerChoices.find(choice => choice.id === provider) ?? providerChoices[0];
}

function normalizeModeKey(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	const normalized = value.trim().toLowerCase();
	return providerModeChoices.some(mode => mode.id === normalized) ? normalized : undefined;
}

function normalizeModeModels(value: Record<string, unknown> | undefined): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, item] of Object.entries(value ?? {})) {
		const mode = normalizeModeKey(key);
		if (!mode || typeof item !== 'string') {
			continue;
		}
		const model = item.trim();
		if (model && model.length <= 120) {
			result[mode] = model;
		}
	}
	return result;
}

function normalizeProvider(value: string): VibeCodexProviderId {
	switch (value) {
		case 'openai':
		case 'anthropic':
		case 'gemini':
		case 'ollama':
		case 'lmstudio':
		case 'bedrock':
		case 'openrouter':
		case 'vercel':
		case 'azure':
		case 'vertex':
		case 'cerebras':
		case 'groq':
		case 'mistral':
		case 'xai':
		case 'custom':
		case 'codex':
			return value;
		default:
			return 'codex';
	}
}

function secretKey(provider: VibeCodexProviderId): string {
	return `${secretPrefix}.${provider}.apiKey`;
}
