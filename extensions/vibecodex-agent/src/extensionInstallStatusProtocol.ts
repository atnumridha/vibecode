/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexExtensionInstallState = 'ready' | 'partial' | 'blocked' | 'unavailable';

export interface VibeCodexExtensionInstallStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeFeatures: boolean;
	readonly includeActivationEvents: boolean;
	readonly includeCommands: boolean;
	readonly includeConfiguration: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexExtensionManifestSummary {
	readonly extensionId?: string;
	readonly publisher?: string;
	readonly name?: string;
	readonly version?: string;
	readonly displayName?: string;
	readonly description?: string;
	readonly main?: string;
	readonly extensionKind: readonly string[];
	readonly extensionMode?: string;
	readonly extensionUri?: string;
	readonly installCommand: string;
}

export interface VibeCodexExtensionInstallFeature {
	readonly id: string;
	readonly title: string;
	readonly ready: boolean;
	readonly detail: string;
}

export interface VibeCodexExtensionInstallStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly method: string;
	readonly generatedAt: number;
	readonly state: VibeCodexExtensionInstallState;
	readonly ready: boolean;
	readonly manifest: VibeCodexExtensionManifestSummary;
	readonly counts: {
		readonly features: number;
		readonly readyFeatures: number;
		readonly blockers: number;
		readonly activationEvents: number;
		readonly commands: number;
		readonly configurationKeys: number;
		readonly keybindings: number;
		readonly menuItems: number;
	};
	readonly features?: readonly VibeCodexExtensionInstallFeature[];
	readonly activationEvents?: readonly string[];
	readonly commands?: readonly string[];
	readonly configurationKeys?: readonly string[];
	readonly blockers: readonly string[];
	readonly warnings: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexExtensionInstallStatusInput {
	readonly manifest?: unknown;
	readonly extensionId?: string;
	readonly extensionMode?: string;
	readonly extensionUri?: string;
	readonly runtimeModuleLoaded?: boolean;
	readonly strictWebviewCsp?: boolean;
	readonly localResourceRootsScoped?: boolean;
}

const extensionInstallStatusMethods = new Set([
	'agent/getExtensionInstallStatus',
	'agent/extensionInstallStatus',
	'extension/installStatus',
	'extension/status',
	'vsix/status',
	'package/status',
	'vibecodex/extensionInstallStatus',
]);

const extensionInstallStatusToolNames = new Set([
	'extension_install_status',
	'vsix_status',
	'install_status',
	'package_status',
	'agent_extension_status',
	'external_install_status',
]);

export function normalizeExtensionInstallStatusRequest(message: JsonRpcMessage): VibeCodexExtensionInstallStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!extensionInstallStatusMethods.has(message.method) && !isExtensionInstallStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeFeatures: booleanValue(payload.includeFeatures)
			?? booleanValue(payload.include_features)
			?? booleanValue(args.includeFeatures)
			?? booleanValue(args.include_features)
			?? true,
		includeActivationEvents: booleanValue(payload.includeActivationEvents)
			?? booleanValue(payload.include_activation_events)
			?? booleanValue(args.includeActivationEvents)
			?? booleanValue(args.include_activation_events)
			?? true,
		includeCommands: booleanValue(payload.includeCommands)
			?? booleanValue(payload.include_commands)
			?? booleanValue(args.includeCommands)
			?? booleanValue(args.include_commands)
			?? true,
		includeConfiguration: booleanValue(payload.includeConfiguration)
			?? booleanValue(payload.include_configuration)
			?? booleanValue(args.includeConfiguration)
			?? booleanValue(args.include_configuration)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createExtensionInstallStatusResponse(request: VibeCodexExtensionInstallStatusRequest, input: VibeCodexExtensionInstallStatusInput): VibeCodexExtensionInstallStatusResponse {
	const manifest = isRecord(input.manifest) ? input.manifest : undefined;
	const contributes = manifest && isRecord(manifest.contributes) ? manifest.contributes : {};
	const configuration = isRecord(contributes.configuration) ? contributes.configuration : {};
	const configurationProperties = isRecord(configuration.properties) ? configuration.properties : {};
	const capabilities = manifest && isRecord(manifest.capabilities) ? manifest.capabilities : {};
	const untrustedWorkspaces = isRecord(capabilities.untrustedWorkspaces) ? capabilities.untrustedWorkspaces : {};
	const activationEvents = stringArray(manifest?.activationEvents).map(redactSensitiveText);
	const commands = commandIds(contributes).map(redactSensitiveText);
	const configurationKeys = Object.keys(configurationProperties).sort().map(redactSensitiveText);
	const keybindings = keybindingEntries(contributes);
	const menuItems = menuCommandIds(contributes).map(redactSensitiveText);
	const extensionKind = stringArray(manifest?.extensionKind).map(redactSensitiveText);
	const publisher = stringValue(manifest?.publisher);
	const name = stringValue(manifest?.name);
	const version = stringValue(manifest?.version);
	const extensionId = input.extensionId ?? (publisher && name ? `${publisher}.${name}` : undefined);
	const description = stringValue(manifest?.description);
	const main = stringValue(manifest?.main);
	const features = createFeatures({
		manifestAvailable: !!manifest,
		publisher,
		name,
		version,
		displayName: stringValue(manifest?.displayName),
		description,
		main,
		extensionKind,
		activationEvents,
		commands,
		configurationKeys,
		keybindings,
		menuItems,
		contributes,
		capabilities,
		untrustedWorkspaces,
		runtimeModuleLoaded: input.runtimeModuleLoaded === true,
		strictWebviewCsp: input.strictWebviewCsp === true,
		localResourceRootsScoped: input.localResourceRootsScoped === true,
	});
	const blockers = createBlockers(manifest, features);
	const warnings = createWarnings(features, commands, activationEvents, configurationKeys);
	const state = stateFor(manifest, features, blockers);
	const manifestSummary: VibeCodexExtensionManifestSummary = {
		...(extensionId ? { extensionId: redactSensitiveText(extensionId) } : {}),
		...(publisher ? { publisher: redactSensitiveText(publisher) } : {}),
		...(name ? { name: redactSensitiveText(name) } : {}),
		...(version ? { version: redactSensitiveText(version) } : {}),
		...(stringValue(manifest?.displayName) ? { displayName: redactSensitiveText(stringValue(manifest?.displayName)!) } : {}),
		...(description ? { description: redactSensitiveText(description) } : {}),
		...(main ? { main: redactSensitiveText(main) } : {}),
		extensionKind,
		...(input.extensionMode ? { extensionMode: redactSensitiveText(input.extensionMode) } : {}),
		...(input.extensionUri ? { extensionUri: redactSensitiveText(input.extensionUri) } : {}),
		installCommand: 'code --install-extension extensions/vibecodex-agent/vibecodex.agent-0.1.0.vsix',
	};
	const responseWithoutMessage = {
		ok: !!manifest,
		source: 'externalExtension' as const,
		version: 1 as const,
		method: request.method,
		generatedAt: Date.now(),
		state,
		ready: state === 'ready',
		manifest: manifestSummary,
		counts: {
			features: features.length,
			readyFeatures: features.filter(feature => feature.ready).length,
			blockers: blockers.length,
			activationEvents: activationEvents.length,
			commands: commands.length,
			configurationKeys: configurationKeys.length,
			keybindings: keybindings.length,
			menuItems: menuItems.length,
		},
		...(request.includeFeatures ? { features: redactSensitiveValue(features) as readonly VibeCodexExtensionInstallFeature[] } : {}),
		...(request.includeActivationEvents ? { activationEvents } : {}),
		...(request.includeCommands ? { commands } : {}),
		...(request.includeConfiguration ? { configurationKeys } : {}),
		blockers,
		warnings,
		nextAction: nextActionFor(state, blockers),
		guardrails: extensionInstallStatusGuardrails,
	};
	const response = {
		...responseWithoutMessage,
		message: extensionInstallStatusSummary(responseWithoutMessage),
	} satisfies Omit<VibeCodexExtensionInstallStatusResponse, 'promptBlock'>;
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: extensionInstallStatusPromptBlock(response) } : {}),
	};
}

export function extensionInstallStatusSummary(response: Pick<VibeCodexExtensionInstallStatusResponse, 'state' | 'counts' | 'manifest'>): string {
	const id = response.manifest.extensionId ?? 'unknown extension';
	const version = response.manifest.version ? `@${response.manifest.version}` : '';
	const blockers = response.counts.blockers ? `; blockers=${response.counts.blockers}` : '';
	return `Extension install readiness: ${id}${version} ${response.state}; ${response.counts.readyFeatures}/${response.counts.features} features ready${blockers}.`;
}

const extensionInstallStatusGuardrails = [
	'Extension install status is read-only and never installs VSIX packages, starts Codex, opens sockets, sends JSON-RPC requests, changes settings, approves plans, runs tools, or mutates files.',
	'Manifest, activation, command, configuration, URI, and runtime values are redacted before being returned to the backend.',
	'Credential and provider readiness are reported only as configuration key presence; API keys, tokens, secrets, and ~/.codex/config.toml contents are never read or returned.',
	'Webview security readiness is a local contract snapshot for strict CSP and scoped localResourceRoots; it does not execute webview scripts or fetch remote assets.',
	'Use backend_launch_status and protocol_status for Codex app-server connection readiness after the extension package is installed.',
];

function createFeatures(input: {
	readonly manifestAvailable: boolean;
	readonly publisher?: string;
	readonly name?: string;
	readonly version?: string;
	readonly displayName?: string;
	readonly description?: string;
	readonly main?: string;
	readonly extensionKind: readonly string[];
	readonly activationEvents: readonly string[];
	readonly commands: readonly string[];
	readonly configurationKeys: readonly string[];
	readonly keybindings: readonly Record<string, unknown>[];
	readonly menuItems: readonly string[];
	readonly contributes: Record<string, unknown>;
	readonly capabilities: Record<string, unknown>;
	readonly untrustedWorkspaces: Record<string, unknown>;
	readonly runtimeModuleLoaded: boolean;
	readonly strictWebviewCsp: boolean;
	readonly localResourceRootsScoped: boolean;
}): readonly VibeCodexExtensionInstallFeature[] {
	const viewContainers = isRecord(input.contributes.viewsContainers) ? input.contributes.viewsContainers : {};
	const activitybar = Array.isArray(viewContainers.activitybar) ? viewContainers.activitybar : [];
	const views = isRecord(input.contributes.views) ? input.contributes.views : {};
	const hasAgentViewContainer = activitybar.some(item => isRecord(item) && stringValue(item.id) === 'vibecodex-agent-extension-container');
	const hasAgentView = Array.isArray(views['vibecodex-agent-extension-container'])
		&& views['vibecodex-agent-extension-container'].some(item => isRecord(item) && stringValue(item.id) === 'vibecodex-agent-extension-view');
	const providerConfigKeys = [
		'vibeCodex.extension.codexCommand',
		'vibeCodex.extension.transport',
		'vibeCodex.extension.messageFraming',
		'vibeCodex.extension.provider',
		'vibeCodex.extension.model',
		'vibeCodex.extension.modeModels',
		'vibeCodex.extension.baseUrl',
		'vibeCodex.extension.parallelThreads',
	];
	const requiredCommands = [
		'vibecodex.extension.openAgent',
		'vibecodex.extension.inlinePrompt',
		'vibecodex.extension.planMode',
		'vibecodex.extension.askMode',
		'vibecodex.extension.manualMode',
		'vibecodex.extension.actMode',
		'vibecodex.extension.agentMode',
		'vibecodex.extension.debugMode',
		'vibecodex.extension.reviewMode',
		'vibecodex.extension.customMode',
		'vibecodex.extension.runInTerminal',
		'vibecodex.extension.connectBackend',
		'vibecodex.extension.disconnectBackend',
		'vibecodex.extension.restartBackend',
	];
	const nativeAliases = [
		'onCommand:vibecodex.openAgent',
		'onCommand:vibecodex.inlinePrompt',
		'onCommand:vibecodex.planMode',
		'onCommand:vibecodex.askMode',
		'onCommand:vibecodex.manualMode',
		'onCommand:vibecodex.actMode',
		'onCommand:vibecodex.agentMode',
		'onCommand:vibecodex.debugMode',
		'onCommand:vibecodex.reviewMode',
		'onCommand:vibecodex.customMode',
		'onUri',
	];
	const modeCommands = [
		'vibecodex.extension.planMode',
		'vibecodex.extension.askMode',
		'vibecodex.extension.manualMode',
		'vibecodex.extension.actMode',
		'vibecodex.extension.agentMode',
		'vibecodex.extension.debugMode',
		'vibecodex.extension.reviewMode',
		'vibecodex.extension.customMode',
	];
	const hasInlinePromptKeybinding = input.keybindings.some(keybinding => {
		const command = stringValue(keybinding.command);
		const key = stringValue(keybinding.key)?.toLowerCase();
		const mac = stringValue(keybinding.mac)?.toLowerCase();
		const when = stringValue(keybinding.when)?.toLowerCase() ?? '';
		return command === 'vibecodex.extension.inlinePrompt'
			&& key === 'ctrl+k'
			&& mac === 'cmd+k'
			&& when.includes('editortextfocus')
			&& when.includes('!editorreadonly');
	});
	const hasCommandPaletteEntries = [
		'commandPalette:vibecodex.extension.openAgent',
		'commandPalette:vibecodex.extension.inlinePrompt',
		'commandPalette:vibecodex.extension.connectBackend',
	].every(entry => input.menuItems.includes(entry));
	const hasModeCommandPaletteEntries = modeCommands.every(command => input.menuItems.includes(`commandPalette:${command}`));
	const hasViewTitleActions = [
		'view/title:vibecodex.extension.openAgent',
		'view/title:vibecodex.extension.configureProvider',
		'view/title:vibecodex.extension.connectBackend',
		'view/title:vibecodex.extension.restartBackend',
	].every(entry => input.menuItems.includes(entry));
	const hasEditorContextInlinePrompt = input.menuItems.includes('editor/context:vibecodex.extension.inlinePrompt');
	return [
		feature('manifest-identity', 'Manifest identity', input.publisher === 'vibecodex' && input.name === 'agent' && !!input.version && !!input.displayName, 'Publisher, name, version, and displayName identify the installable Vibe Codex Agent extension.'),
		feature('standalone-vsix-description', 'Standalone VSIX description', /installable.*vs code.*vsix|vs code.*vsix|vsix/i.test(input.description ?? ''), 'The manifest description advertises the external VS Code VSIX install surface.'),
		feature('main-runtime-bundle', 'Main runtime bundle', input.main === './out/extension', 'The extension host entrypoint is the compiled ./out/extension bundle.'),
		feature('extension-kind', 'UI/workspace extension kind', input.extensionKind.includes('ui') && input.extensionKind.includes('workspace'), 'The same VSIX can run as UI and workspace extension kind for local and remote workspaces.'),
		feature('activation-routes', 'Activation routes', input.activationEvents.includes('onView:vibecodex-agent-extension-view') && nativeAliases.every(event => input.activationEvents.includes(event)), 'View, URI, and native vibecodex.* command aliases wake the same sidebar surface.'),
		feature('command-contributions', 'Command contributions', requiredCommands.every(command => input.commands.includes(command)), 'Open Agent, Ctrl/Cmd+K inline prompt, terminal, and bridge lifecycle commands are contributed.'),
		feature('mode-entrypoints', 'Eight standard mode entrypoints', modeCommands.every(command => input.commands.includes(command)) && hasModeCommandPaletteEntries, 'Plan, Ask, Manual, Act, Agent, Debug, Review, and Custom modes are visible installable commands and command-palette entries.'),
		feature('inline-shortcut', 'Ctrl/Cmd+K inline prompt shortcut', hasInlinePromptKeybinding, 'The installable extension binds Ctrl+K and Cmd+K to the Vibe Codex inline prompt only while an editable editor is focused.'),
		feature('menu-entrypoints', 'Command palette, view, and editor menus', hasCommandPaletteEntries && hasViewTitleActions && hasEditorContextInlinePrompt, 'Agent, provider/backend, and inline-prompt commands are visible from command palette, Agent view title, and editor context menu.'),
		feature('sidebar-view', 'Activity bar and webview view', hasAgentViewContainer && hasAgentView, 'The installable extension contributes the Vibe Codex activity bar container and Agent webview view.'),
		feature('provider-backend-config', 'Provider/backend configuration', providerConfigKeys.every(key => input.configurationKeys.includes(key)), 'Codex command, transport, framing, provider, model, mode routing, base URL, and parallel thread settings are configurable.'),
		feature('workspace-support', 'Workspace support declaration', input.capabilities.virtualWorkspaces === true && input.untrustedWorkspaces.supported === 'limited', 'Virtual workspaces are supported and untrusted workspaces are explicitly limited and approval/trust gated.'),
		feature('runtime-loaded', 'Runtime module loaded', input.runtimeModuleLoaded, 'The current extension host loaded the compiled runtime module.'),
		feature('webview-security', 'Strict webview security contract', input.strictWebviewCsp && input.localResourceRootsScoped, 'Sidebar webviews use strict CSP and localResourceRoots scoped to extension media assets.'),
	];
}

function feature(id: string, title: string, ready: boolean, detail: string): VibeCodexExtensionInstallFeature {
	return {
		id,
		title,
		ready,
		detail,
	};
}

function createBlockers(manifest: Record<string, unknown> | undefined, features: readonly VibeCodexExtensionInstallFeature[]): readonly string[] {
	if (!manifest) {
		return ['Extension manifest/packageJSON is unavailable; activate the Vibe Codex Agent extension before requesting install readiness.'];
	}
	return features
		.filter(feature => !feature.ready)
		.map(feature => `${feature.title}: ${feature.detail}`)
		.slice(0, 16);
}

function createWarnings(features: readonly VibeCodexExtensionInstallFeature[], commands: readonly string[], activationEvents: readonly string[], configurationKeys: readonly string[]): readonly string[] {
	const warnings: string[] = [];
	if (!commands.includes('vibecodex.extension.clearProviderCredentials')) {
		warnings.push('Clear Provider Credentials command is not contributed.');
	}
	if (!activationEvents.includes('onCommand:vibecodex.extension.clearProviderCredentials')) {
		warnings.push('Clear Provider Credentials activation route is not contributed.');
	}
	if (!configurationKeys.includes('vibeCodex.extension.autoApprove.enabled')) {
		warnings.push('Auto-approve configuration keys are not contributed.');
	}
	if (!configurationKeys.includes('vibeCodex.extension.autoCommit.enabled')) {
		warnings.push('Auto-commit configuration key is not contributed.');
	}
	if (!features.find(feature => feature.id === 'inline-shortcut')?.ready) {
		warnings.push('Ctrl/Cmd+K inline prompt keybinding is not contributed for editable editors.');
	}
	if (!features.find(feature => feature.id === 'menu-entrypoints')?.ready) {
		warnings.push('Command palette, view title, or editor context menu entrypoints are incomplete.');
	}
	if (!features.find(feature => feature.id === 'mode-entrypoints')?.ready) {
		warnings.push('Plan/Ask/Manual/Act/Agent/Debug/Review/Custom command entrypoints are incomplete.');
	}
	if (!features.find(feature => feature.id === 'webview-security')?.ready) {
		warnings.push('Strict CSP and scoped localResourceRoots should be verified before external installs are trusted.');
	}
	return warnings.slice(0, 12).map(redactSensitiveText);
}

function stateFor(manifest: Record<string, unknown> | undefined, features: readonly VibeCodexExtensionInstallFeature[], blockers: readonly string[]): VibeCodexExtensionInstallState {
	if (!manifest) {
		return 'unavailable';
	}
	if (!blockers.length) {
		return 'ready';
	}
	const readyFeatures = features.filter(feature => feature.ready).length;
	return readyFeatures >= Math.ceil(features.length / 2) ? 'partial' : 'blocked';
}

function nextActionFor(state: VibeCodexExtensionInstallState, blockers: readonly string[]): string {
	switch (state) {
		case 'ready':
			return 'Package with npm --prefix extensions/vibecodex-agent run package-vsix, install the VSIX externally if needed, then use backend_launch_status and protocol_status to connect Codex.';
		case 'partial':
			return blockers[0] ?? 'Fix incomplete manifest, activation, command, configuration, or webview security readiness before trusting external installs.';
		case 'blocked':
			return blockers[0] ?? 'Fix required extension manifest and activation blockers before packaging or installing the VSIX.';
		case 'unavailable':
			return 'Activate the Vibe Codex Agent extension or provide its package manifest before requesting extension_install_status again.';
	}
}

function extensionInstallStatusPromptBlock(response: Omit<VibeCodexExtensionInstallStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'extension_install_status',
		state: response.state,
		ready: response.ready,
		manifest: response.manifest,
		counts: response.counts,
		blockers: response.blockers,
		warnings: response.warnings,
		nextAction: response.nextAction,
		guardrails: response.guardrails,
		note: 'This status only proves the installable extension contract. It does not install the VSIX or connect the Codex app-server.',
	}), null, 2);
}

function commandIds(contributes: Record<string, unknown>): readonly string[] {
	const commands = Array.isArray(contributes.commands) ? contributes.commands : [];
	return commands
		.map(command => isRecord(command) ? stringValue(command.command) : undefined)
		.filter((value): value is string => !!value)
		.sort();
}

function keybindingEntries(contributes: Record<string, unknown>): readonly Record<string, unknown>[] {
	const keybindings = Array.isArray(contributes.keybindings) ? contributes.keybindings : [];
	return keybindings.filter(isRecord);
}

function menuCommandIds(contributes: Record<string, unknown>): readonly string[] {
	const menus = isRecord(contributes.menus) ? contributes.menus : {};
	const entries: string[] = [];
	for (const [location, value] of Object.entries(menus)) {
		if (!Array.isArray(value)) {
			continue;
		}
		for (const item of value) {
			if (!isRecord(item)) {
				continue;
			}
			const command = stringValue(item.command);
			if (command) {
				entries.push(`${location}:${command}`);
			}
		}
	}
	return entries.sort();
}

function stringArray(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean) : [];
}

function isExtensionInstallStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return extensionInstallStatusToolNames.has(tool);
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
