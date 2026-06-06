/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');

const { createBackendLaunchStatusResponse, normalizeBackendLaunchStatusRequest } = require('../out/backendLaunchStatusProtocol');
const { normalizeBrowserActionRequest } = require('../out/browserActionProtocol');
const { createBrowserActionEvidenceEvent, createBrowserActionStatusResponse, normalizeBrowserActionStatusRequest } = require('../out/browserActionStatusProtocol');
const { createBrowserStatusResponse, normalizeBrowserStatusRequest } = require('../out/browserStatusProtocol');
const { createCheckpointStatusResponse, normalizeCheckpointStatusRequest } = require('../out/checkpointStatusProtocol');
const { normalizeCommandPermissionPolicy } = require('../out/commandPermissions');
const { createCommitHandoff } = require('../out/commitHandoff');
const { createCommitHandoffStatusResponse, normalizeCommitHandoffStatusRequest } = require('../out/commitHandoffStatusProtocol');
const { createContextIndexStatusResponse, normalizeContextIndexStatusRequest } = require('../out/contextIndexStatusProtocol');
const { createContextStatusResponse, normalizeContextStatusRequest } = require('../out/contextStatusProtocol');
const { createDeliveryBarState } = require('../out/deliveryBar');
const { createDeliveryBarStatusResponse, normalizeDeliveryBarStatusRequest } = require('../out/deliveryBarStatusProtocol');
const { createDiffFileStatusResponse, normalizeDiffFileStatusRequest } = require('../out/diffFileStatusProtocol');
const { createDiffReapplyStatusResponse, normalizeDiffReapplyStatusRequest } = require('../out/diffReapplyStatusProtocol');
const { createDiffValidationResponse, normalizeDiffValidationRequest } = require('../out/diffValidationProtocol');
const { defaultAutoApproveConfig } = require('../out/autoApprove');
const { createAutoCommitStatusResponse, normalizeAutoCommitStatusRequest } = require('../out/autoCommitStatusProtocol');
const { createAcceptanceCriteriaStatusResponse, normalizeAcceptanceCriteriaStatusRequest } = require('../out/acceptanceCriteriaStatusProtocol');
const { createExecutionAuthorization, authorizationMatchesPlan } = require('../out/executionAuthorization');
const { createExecutionGateStatusResponse, normalizeExecutionGateStatusRequest } = require('../out/executionGateStatusProtocol');
const { createExternalIntakeStatusResponse, normalizeExternalIntakeStatusRequest } = require('../out/externalIntakeStatusProtocol');
const { createExtensionInstallStatusResponse, normalizeExtensionInstallStatusRequest } = require('../out/extensionInstallStatusProtocol');
const { createFinalReviewState } = require('../out/finalReview');
const { createGuidanceSelectionResponse, normalizeGuidanceSelectionRequest } = require('../out/guidanceSelectionProtocol');
const { createGuidanceStatusResponse, normalizeGuidanceStatusRequest } = require('../out/guidanceStatusProtocol');
const { createHappyPathStatusResponse, normalizeHappyPathStatusRequest } = require('../out/happyPathStatusProtocol');
const { createInlinePromptStatusResponse, normalizeInlinePromptStatusRequest } = require('../out/inlinePromptStatusProtocol');
const { createMcpStatusResponse, normalizeMcpStatusRequest } = require('../out/mcpStatusProtocol');
const { modePolicyFor } = require('../out/modePolicy');
const { createModeStatusResponse, normalizeModeStatusRequest } = require('../out/modeStatusProtocol');
const { createParallelAgentPlan, withParallelThreadStatus } = require('../out/multiAgent');
const { createParallelLaneExecutionStatusResponse, normalizeParallelLaneExecutionStatusRequest } = require('../out/parallelLaneExecutionStatusProtocol');
const { createParallelMergeRequest, createParallelReview, normalizeParallelResultMessage, upsertParallelResult } = require('../out/parallelReview');
const { applyPlanRemediation, applyPlanStepEdit } = require('../out/planEditing');
const { createPlanCanvasStatusResponse, normalizePlanCanvasStatusRequest } = require('../out/planCanvasStatusProtocol');
const { createPlanEditStatusResponse, normalizePlanEditStatusRequest } = require('../out/planEditStatusProtocol');
const { createPlanFocusStatusResponse, normalizePlanFocusStatusRequest } = require('../out/planFocusStatusProtocol');
const { appendPlanRevision } = require('../out/planHistory');
const { createFallbackPlan, createPlanSubmissionResponse, renderedPlanIdentity, validatePlan } = require('../out/planProtocol');
const { createPlanStatusResponse, normalizePlanStatusRequest } = require('../out/planStatusProtocol');
const { createPreviewStatusResponse, normalizePreviewStatusRequest } = require('../out/previewStatusProtocol');
const { createProtocolEvent } = require('../out/protocolDiagnostics');
const { createProtocolStatusResponse, normalizeProtocolStatusRequest } = require('../out/protocolStatusProtocol');
const { createProviderCatalogResponse, normalizeProviderCatalogRequest } = require('../out/providerCatalogProtocol');
const { createProviderStatusResponse, normalizeProviderStatusRequest } = require('../out/providerStatusProtocol');
const { createRollbackRestoreStatusResponse, normalizeRollbackRestoreStatusRequest } = require('../out/rollbackRestoreStatusProtocol');
const { createSafetyStatusResponse, normalizeSafetyStatusRequest } = require('../out/safetyStatusProtocol');
const { createSmokeBenchmarkState } = require('../out/smokeBenchmark');
const { createSmokeBenchmarkStatusResponse, normalizeSmokeBenchmarkStatusRequest } = require('../out/smokeBenchmarkStatusProtocol');
const { builtinSlashCommandSuggestions, createWorkflowSlashSuggestions, parseSlashCommandPrompt } = require('../out/slashCommands');
const { createSlashCommandStatusResponse, normalizeSlashCommandStatusRequest } = require('../out/slashCommandStatusProtocol');
const { createSymbolIndexStatusResponse, normalizeSymbolIndexStatusRequest } = require('../out/symbolIndexStatusProtocol');
const { createTerminalCommandValidationResponse, normalizeTerminalCommandValidationRequest } = require('../out/terminalCommandValidationProtocol');
const { createTerminalControlResponse, normalizeTerminalControlRequest } = require('../out/terminalControlProtocol');
const { createTerminalInsight } = require('../out/terminalInsight');
const { createTerminalRemediationEvent, createTerminalRemediationStatusResponse, normalizeTerminalRemediationStatusRequest } = require('../out/terminalRemediationStatusProtocol');
const { createToolCatalog } = require('../out/toolCatalog');
const { createToolTimelineStatusResponse, normalizeToolTimelineStatusRequest } = require('../out/toolTimelineStatusProtocol');
const { createTranscriptEvent } = require('../out/transcript');
const { queueTaskBoardCard } = require('../out/taskBoard');
const { createTaskCompletionResponse, normalizeTaskCompletionRequest } = require('../out/taskCompletionProtocol');
const { createTaskCompletionStatusResponse, normalizeTaskCompletionStatusRequest } = require('../out/taskCompletionStatusProtocol');
const { createTaskStartStatusResponse, normalizeTaskStartStatusRequest } = require('../out/taskStartStatusProtocol');
const { createVerificationStatusResponse, normalizeVerificationStatusRequest } = require('../out/verificationStatusProtocol');
const { normalizeWebFetchRequest } = require('../out/webFetchProtocol');
const { createWorkspaceReadEvidenceEvent, createWorkspaceReadStatusResponse, normalizeWorkspaceReadStatusRequest } = require('../out/workspaceReadStatusProtocol');
const { createWorkspaceSandboxStatusResponse, normalizeWorkspaceSandboxStatusRequest } = require('../out/workspaceSandboxStatusProtocol');
const { createWorkflowStatusResponse, normalizeWorkflowStatusRequest } = require('../out/workflowStatusProtocol');
const { createSessionExportResponse, normalizeSessionExportRequest } = require('../out/sessionExportProtocol');
const { createSessionHistoryStatusResponse, normalizeSessionHistoryStatusRequest } = require('../out/sessionHistoryStatusProtocol');
const packageManifest = require('../package.json');

const now = Date.now();
const contextPack = {
	gatheredAt: now,
	mode: 'agent',
	workspaceRoots: ['/workspace/vibecodex'],
	activeEditor: { path: 'src/agent.ts', languageId: 'typescript' },
	promptMentions: [{ raw: '@file src/agent.ts', kind: 'file', value: 'src/agent.ts' }],
	files: [
		{
			path: 'src/agent.ts',
			kind: 'mentioned',
			languageId: 'typescript',
			text: 'const secret = "sk-live-secret-value-1234567890";',
		},
		{
			path: 'src/agent.test.ts',
			kind: 'search',
			languageId: 'typescript',
			text: 'expect(agent).toBeReady();',
		},
	],
	searchHits: [{
		path: 'src/agent.ts',
		score: 0.97,
		matchedTerms: ['agent', 'workflow', 'sk-live-secret-value-1234567890'],
		strategy: 'lexical',
		languageId: 'typescript',
		snippet: 'workflow secret sk-live-secret-value-1234567890',
	}],
	symbolIndex: {
		version: 1,
		collectedAt: now,
		entries: [
			{ path: 'src/agent.ts', name: 'VibeCodexAgent', kind: 'class', range: '1:1-10:1' },
			{ path: 'src/agent.test.ts', name: 'runsAgentWorkflow', kind: 'function', range: '3:1-8:1', containerName: 'suite' },
		],
		truncated: false,
	},
	diagnostics: [{
		path: 'src/agent.ts',
		severity: 'warning',
		message: 'Do not leak sk-live-secret-value-1234567890',
		range: '2:1-2:12',
		source: 'eslint',
	}],
	git: {
		repositories: [{
			root: '/workspace/vibecodex',
			branch: 'codex/native-agent-ui',
			head: 'abc1234',
			changes: [{ path: 'src/agent.ts', status: 'M' }],
			recentCommits: [{ hash: 'abc1234', subject: 'Add agent context proof' }],
		}],
	},
	terminal: { name: 'Vibe Codex', cwd: '/workspace/vibecodex' },
	ignorePolicy: { rules: ['node_modules/**'], sources: ['.vibecodexignore'] },
};

const contextStatus = createContextStatusResponse(normalizeContextStatusRequest({
	jsonrpc: '2.0',
	id: 'context-1',
	method: 'agent/getContextStatus',
	params: { includeDetails: true },
}), contextPack);
assert.equal(contextStatus.ok, true);
assert.equal(contextStatus.state, 'ready');
assert.equal(contextStatus.counts.files, 2);
assert.equal(contextStatus.counts.filesWithText, 2);
assert.equal(contextStatus.files[0].hasText, true);
assert.equal(JSON.stringify(contextStatus).includes('const secret'), false);
assert.equal(JSON.stringify(contextStatus).includes('sk-live-secret-value'), false);

const contextIndexStatus = createContextIndexStatusResponse(normalizeContextIndexStatusRequest({
	jsonrpc: '2.0',
	id: 'context-index-1',
	method: 'agent/getContextIndexStatus',
	params: { includeSources: true, includeSamples: true, maxItems: 4 },
}), {
	context: contextPack,
	workspaceRoots: ['/workspace/vibecodex'],
	workspaceTrusted: true,
	generatedAt: now + 1000,
});
assert.equal(contextIndexStatus.available, true);
assert.equal(contextIndexStatus.readiness.readyForPlanning, true);
assert.equal(contextIndexStatus.readiness.needsFreshGather, false);
assert.equal(contextIndexStatus.sources.some(source => source.id === 'lexicalSearch' && source.ready), true);
assert.equal(contextIndexStatus.samples.files[0].hasText, true);
assert.equal(JSON.stringify(contextIndexStatus).includes('workflow secret'), false);
assert.equal(JSON.stringify(contextIndexStatus).includes('sk-live-secret-value'), false);

const symbolIndexStatus = createSymbolIndexStatusResponse(normalizeSymbolIndexStatusRequest({
	jsonrpc: '2.0',
	id: 'symbol-index-1',
	method: 'agent/getSymbolIndexStatus',
	params: { query: 'agent', includeEntries: true, includePromptBlock: true, maxItems: 4 },
}), contextPack);
assert.equal(symbolIndexStatus.available, true);
assert.equal(symbolIndexStatus.counts.matched, 2);
assert.equal(symbolIndexStatus.entries.some(entry => entry.name === 'VibeCodexAgent'), true);

const readFileEvidence = createWorkspaceReadEvidenceEvent({
	id: 'read-1',
	method: 'item/tool/call',
	kind: 'read_file',
	path: 'src/agent.ts',
	paths: ['src/agent.ts'],
	isRegex: false,
	caseSensitive: false,
	recursive: false,
	maxResults: 1,
	requestedAt: now,
}, {
	ok: true,
	files: [{ path: 'src/agent.ts', text: 'secret sk-live-secret-value-1234567890', truncated: false, startLine: 1, endLine: 1, totalLines: 1 }],
	truncated: false,
}, 'Read src/agent.ts with secret sk-live-secret-value-1234567890');
const searchEvidence = createWorkspaceReadEvidenceEvent({
	id: 'search-1',
	method: 'item/tool/call',
	kind: 'semantic_search',
	paths: [],
	query: 'agent secret sk-live-secret-value-1234567890',
	isRegex: false,
	caseSensitive: false,
	recursive: true,
	maxResults: 10,
	requestedAt: now,
}, {
	ok: true,
	hits: [{ path: 'src/agent.ts', line: 2, preview: 'secret sk-live-secret-value-1234567890', strategy: 'semantic', score: 0.92, matchedTerms: ['secret', 'agent'] }],
	truncated: false,
}, 'Searched workspace with secret sk-live-secret-value-1234567890');
const workspaceReadStatus = createWorkspaceReadStatusResponse(normalizeWorkspaceReadStatusRequest({
	jsonrpc: '2.0',
	id: 'workspace-read-1',
	method: 'agent/getWorkspaceReadStatus',
	params: { includeEvents: true, includeSamples: true, includePromptBlock: true, maxEvents: 4, maxSamples: 4 },
}), [readFileEvidence, searchEvidence]);
assert.equal(workspaceReadStatus.hasEvidence, true);
assert.equal(workspaceReadStatus.readiness.hasReadEvidence, true);
assert.equal(workspaceReadStatus.readiness.hasSemanticEvidence, true);
assert.equal(workspaceReadStatus.counts.files, 1);
assert.equal(workspaceReadStatus.counts.hits, 1);
assert.equal(JSON.stringify(workspaceReadStatus).includes('secret sk-live-secret-value'), false);
assert.equal(JSON.stringify(workspaceReadStatus).includes('"text"'), false);

const workspaceGuidance = {
	version: 1,
	collectedAt: now,
	rules: [
		{
			path: '.clinerules',
			kind: 'cline',
			text: 'Always create a visual plan before editing. secret=sk-live-secret-value-1234567890',
		},
		{
			path: '.cursor/rules/agent.mdc',
			kind: 'cursor',
			text: 'Prefer small reviewable diffs and checkpoint rollback.',
		},
	],
	skills: [
		{
			path: '.cline/skills/refactor/SKILL.md',
			name: 'refactor',
			description: 'Plan and refactor safely with tests. api_key=sk-live-secret-value-1234567890',
			text: '# Refactor\nUse diagnostics, tests, and diff review.',
		},
	],
	hooks: [
		{
			path: '.cline/hooks.json',
			kind: 'cline',
			entries: ['BeforeShellCommand: 1 item', 'AfterFileEdit: 1 item'],
			text: '{"BeforeShellCommand":[{"command":"npm test","secret":"sk-live-secret-value-1234567890"}]}',
		},
	],
};
const memoryBank = {
	version: 1,
	collectedAt: now,
	status: 'ready',
	documents: [
		{
			path: '.cline/memory-bank/activeContext.md',
			kind: 'activeContext',
			title: 'Active Context',
			text: 'Build extension-first Vibe Codex parity without leaking sk-live-secret-value-1234567890.',
			truncated: false,
		},
	],
};
const customModeCatalog = {
	version: 1,
	collectedAt: now,
	modes: [
		{
			slug: 'architect',
			name: 'Architect',
			source: '.roomodes',
			roleDefinition: 'Plan before acting.',
			groups: ['read'],
			readOnly: true,
			requiresPlanApproval: false,
		},
		{
			slug: 'agent',
			name: 'Agent',
			source: '.roomodes',
			roleDefinition: 'Execute only after approval.',
			groups: ['read', 'edit', 'terminal'],
			readOnly: false,
			requiresPlanApproval: true,
		},
	],
	sources: ['.roomodes'],
	warnings: [],
};
const guidanceStatus = createGuidanceStatusResponse(normalizeGuidanceStatusRequest({
	jsonrpc: '2.0',
	id: 'guidance-1',
	method: 'agent/getGuidanceStatus',
	params: { includeDocuments: true, includeMemoryBank: true, includeCustomModes: true },
}), {
	guidance: workspaceGuidance,
	memoryBank,
	customModeCatalog,
});
assert.equal(guidanceStatus.ok, true);
assert.equal(guidanceStatus.counts.rules, 2);
assert.equal(guidanceStatus.counts.skills, 1);
assert.equal(guidanceStatus.counts.hooks, 1);
assert.equal(guidanceStatus.counts.memoryBankDocuments, 1);
assert.equal(guidanceStatus.counts.customModes, 2);
assert.equal(guidanceStatus.hooks[0].entries[0], 'BeforeShellCommand: 1 item');
assert.equal(JSON.stringify(guidanceStatus).includes('sk-live-secret-value'), false);

const guidanceSelection = createGuidanceSelectionResponse(normalizeGuidanceSelectionRequest({
	jsonrpc: '2.0',
	id: 'guidance-select-1',
	method: 'item/tool/call',
	params: {
		tool: 'use_skill',
		arguments: {
			skillName: 'refactor',
			paths: ['src/agent.ts'],
			includeDocuments: true,
			maxItems: 4,
		},
	},
}), {
	guidance: workspaceGuidance,
	memoryBank,
});
assert.equal(guidanceSelection.ok, true);
assert.equal(guidanceSelection.counts.selected, 1);
assert.equal(guidanceSelection.selected[0].type, 'skill');
assert.equal(guidanceSelection.guardrails.some(line => line.includes('never executes hooks')), true);
assert.equal(JSON.stringify(guidanceSelection).includes('sk-live-secret-value'), false);

const workflowSuggestions = createWorkflowSlashSuggestions([
	'.cline/workflows/refactor-auth.md',
	'.clinerules/workflows/review-risk.md',
]);
const slashWorkflowContext = parseSlashCommandPrompt('/refactor-auth update auth middleware', 'agent', workflowSuggestions);
assert.ok(slashWorkflowContext);
const slashCommandStatus = createSlashCommandStatusResponse(normalizeSlashCommandStatusRequest({
	jsonrpc: '2.0',
	id: 'slash-1',
	method: 'workflowSlash/status',
	params: { includeBuiltins: true, includeWorkflows: true, includeLastCommand: true, includeDetails: true },
}), {
	suggestions: [...builtinSlashCommandSuggestions(), ...workflowSuggestions],
	lastCommand: slashWorkflowContext,
	maxWorkflowSuggestions: 40,
	maxWorkflowContentBytes: 16000,
});
assert.equal(slashCommandStatus.counts.workflows, 2);
assert.equal(slashCommandStatus.lastCommand.workflowPath, '.cline/workflows/refactor-auth.md');
assert.equal(slashCommandStatus.lastCommand.requiresVisualPlan, true);
assert.equal(slashCommandStatus.guardrails.some(line => line.includes('Every slash command still requires visual plan approval')), true);

const extensionInstallStatus = createExtensionInstallStatusResponse(normalizeExtensionInstallStatusRequest({
	jsonrpc: '2.0',
	id: 'extension-install-1',
	method: 'agent/getExtensionInstallStatus',
	params: {
		includeFeatures: true,
		includeActivationEvents: true,
		includeCommands: true,
		includeConfiguration: true,
		includePromptBlock: true,
	},
}), {
	manifest: packageManifest,
	extensionId: 'vibecodex.agent',
	extensionMode: 'test',
	extensionUri: 'file:///workspace/vibecodex/extensions/vibecodex-agent',
	runtimeModuleLoaded: true,
	strictWebviewCsp: true,
	localResourceRootsScoped: true,
});
assert.equal(extensionInstallStatus.ready, true);
assert.equal(extensionInstallStatus.counts.keybindings, 1);
assert.ok(extensionInstallStatus.counts.menuItems >= 18);
assert.equal(extensionInstallStatus.features.find(feature => feature.id === 'inline-shortcut').ready, true);
assert.equal(extensionInstallStatus.features.find(feature => feature.id === 'menu-entrypoints').ready, true);
assert.equal(extensionInstallStatus.features.find(feature => feature.id === 'mode-entrypoints').ready, true);
assert.equal(extensionInstallStatus.features.find(feature => feature.id === 'vs-code-contribution-ids').ready, true);
const contributionIdPattern = /^[A-Za-z0-9_-]+$/;
const contributedContainerId = packageManifest.contributes.viewsContainers.activitybar[0].id;
const contributedViewKey = Object.keys(packageManifest.contributes.views)[0];
const contributedViewId = packageManifest.contributes.views[contributedViewKey][0].id;
assert.match(contributedContainerId, contributionIdPattern);
assert.match(contributedViewKey, contributionIdPattern);
assert.match(contributedViewId, contributionIdPattern);
assert.equal(contributedViewKey, contributedContainerId);
assert.equal(packageManifest.activationEvents.includes(`onView:${contributedViewId}`), true);
assert.equal(extensionInstallStatus.commands.includes('vibecodex.extension.inlinePrompt'), true);
for (const command of [
	'vibecodex.extension.planMode',
	'vibecodex.extension.askMode',
	'vibecodex.extension.manualMode',
	'vibecodex.extension.actMode',
	'vibecodex.extension.agentMode',
	'vibecodex.extension.debugMode',
	'vibecodex.extension.reviewMode',
	'vibecodex.extension.customMode',
]) {
	assert.equal(extensionInstallStatus.commands.includes(command), true);
}
assert.equal(extensionInstallStatus.activationEvents.includes('onCommand:vibecodex.inlinePrompt'), true);
assert.equal(extensionInstallStatus.activationEvents.includes('onCommand:vibecodex.askMode'), true);
assert.equal(extensionInstallStatus.activationEvents.includes('onCommand:vibecodex.manualMode'), true);
assert.equal(extensionInstallStatus.activationEvents.includes('onCommand:vibecodex.customMode'), true);
assert.equal(extensionInstallStatus.promptBlock.includes('code --install-extension'), true);

const invalidDottedViewManifest = JSON.parse(JSON.stringify(packageManifest));
invalidDottedViewManifest.contributes.viewsContainers.activitybar[0].id = 'vibecodex.agent.extensionContainer';
invalidDottedViewManifest.contributes.views = {
	'vibecodex.agent.extensionContainer': [{
		...packageManifest.contributes.views[contributedViewKey][0],
		id: 'vibecodex.agent.extensionView',
	}],
};
invalidDottedViewManifest.activationEvents = packageManifest.activationEvents.map(event => event === `onView:${contributedViewId}` ? 'onView:vibecodex.agent.extensionView' : event);
const invalidDottedViewStatus = createExtensionInstallStatusResponse(normalizeExtensionInstallStatusRequest({
	jsonrpc: '2.0',
	id: 'extension-install-invalid-dotted-view',
	method: 'agent/getExtensionInstallStatus',
	params: { includeFeatures: true },
}), {
	manifest: invalidDottedViewManifest,
	extensionId: 'vibecodex.agent',
	extensionMode: 'test',
	extensionUri: 'file:///workspace/vibecodex/extensions/vibecodex-agent',
	runtimeModuleLoaded: true,
	strictWebviewCsp: true,
	localResourceRootsScoped: true,
});
assert.equal(invalidDottedViewStatus.ready, false);
assert.equal(invalidDottedViewStatus.features.find(feature => feature.id === 'vs-code-contribution-ids').ready, false);
assert.ok(invalidDottedViewStatus.blockers.some(blocker => blocker.includes('VS Code contribution id schema')));

const codexConfig = {
	found: true,
	configPath: '/home/developer/.codex/config.toml',
	authJsonPresent: true,
	defaultModel: 'gpt-5-codex',
	modelProvider: 'openai',
	approvalPolicy: 'on-request',
	sandboxMode: 'workspace-write',
	networkAccess: true,
	modelProviders: [
		{ id: 'openai', baseUrl: 'https://api.openai.com/v1', envKey: 'OPENAI_API_KEY', envKeyConfigured: true },
		{ id: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', envKeyConfigured: false },
	],
	mcpServers: ['filesystem'],
	projectTrust: 'trusted',
	warnings: [],
};
const localProvider = {
	provider: 'ollama',
	label: 'Ollama',
	mode: 'agent',
	model: 'qwen2.5-coder',
	modelRouting: {
		mode: 'agent',
		globalModel: 'gpt-4.1',
		modeModel: 'qwen2.5-coder',
		effectiveModel: 'qwen2.5-coder',
		source: 'modeModels',
	},
	baseUrl: 'http://127.0.0.1:11434/v1?api_key=sk-live-secret-value-1234567890',
	apiKey: 'sk-live-secret-value-1234567890',
	apiKeyConfigured: true,
	apiKeyStorage: 'vscodeSecretStorage',
	codexConfig,
};
const modeRoutes = [
	localProvider,
	{
		...localProvider,
		provider: 'openai',
		label: 'OpenAI',
		mode: 'plan',
		model: 'gpt-5-codex',
		modelRouting: {
			mode: 'plan',
			globalModel: 'gpt-4.1',
			modeModel: 'gpt-5-codex',
			effectiveModel: 'gpt-5-codex',
			source: 'modeModels',
		},
		baseUrl: 'https://api.openai.com/v1',
		apiKeyConfigured: true,
		apiKeyStorage: 'codexConfigEnv',
	},
	{
		...localProvider,
		mode: 'review',
		model: 'gpt-4.1',
		modelRouting: {
			mode: 'review',
			globalModel: 'gpt-4.1',
			effectiveModel: 'gpt-4.1',
			source: 'globalModel',
		},
	},
];
const providerCatalogEntries = [
	{ id: 'codex', label: 'Codex / ChatGPT Login', defaultModel: '', apiKeyLabel: 'Codex CLI login/config', baseUrlRequired: false, apiKeyRecommended: false, openAiCompatible: false, local: false },
	{ id: 'openai', label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1', apiKeyLabel: 'OpenAI API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-sonnet-4-5', apiKeyLabel: 'Anthropic API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: false, local: false },
	{ id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-pro', apiKeyLabel: 'Google Gemini API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: false, local: false },
	{ id: 'ollama', label: 'Ollama', defaultBaseUrl: 'http://127.0.0.1:11434/v1', defaultModel: 'qwen2.5-coder', apiKeyLabel: 'Optional Ollama key', baseUrlRequired: true, apiKeyRecommended: false, openAiCompatible: true, local: true },
	{ id: 'lmstudio', label: 'LM Studio', defaultBaseUrl: 'http://127.0.0.1:1234/v1', defaultModel: 'local-model', apiKeyLabel: 'Optional LM Studio key', baseUrlRequired: true, apiKeyRecommended: false, openAiCompatible: true, local: true },
	{ id: 'bedrock', label: 'Amazon Bedrock', defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0', apiKeyLabel: 'Bedrock token', baseUrlRequired: false, apiKeyRecommended: false, openAiCompatible: false, local: false },
	{ id: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', apiKeyLabel: 'OpenRouter API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'vercel', label: 'Vercel AI Gateway', defaultBaseUrl: 'https://ai-gateway.vercel.sh/v1', apiKeyLabel: 'Vercel AI Gateway key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'azure', label: 'Azure OpenAI', apiKeyLabel: 'Azure OpenAI API key', baseUrlRequired: true, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'vertex', label: 'Google Vertex AI', defaultModel: 'gemini-2.5-pro', apiKeyLabel: 'Vertex API key', baseUrlRequired: false, apiKeyRecommended: false, openAiCompatible: false, local: false },
	{ id: 'cerebras', label: 'Cerebras', defaultBaseUrl: 'https://api.cerebras.ai/v1', apiKeyLabel: 'Cerebras API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'groq', label: 'Groq', defaultBaseUrl: 'https://api.groq.com/openai/v1', apiKeyLabel: 'Groq API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'mistral', label: 'Mistral', defaultBaseUrl: 'https://api.mistral.ai/v1', apiKeyLabel: 'Mistral API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'xai', label: 'xAI', defaultBaseUrl: 'https://api.x.ai/v1', apiKeyLabel: 'xAI API key', baseUrlRequired: false, apiKeyRecommended: true, openAiCompatible: true, local: false },
	{ id: 'custom', label: 'Custom OpenAI-Compatible', defaultBaseUrl: 'http://127.0.0.1:8000/v1', defaultModel: 'custom-model', apiKeyLabel: 'Provider API key', baseUrlRequired: true, apiKeyRecommended: true, openAiCompatible: true, local: true },
];
const providerCatalogStatus = createProviderCatalogResponse(normalizeProviderCatalogRequest({
	jsonrpc: '2.0',
	id: 'provider-catalog-1',
	method: 'agent/getProviderCatalog',
	params: { includeDefaults: true, includeCodexConfig: true },
}), {
	providers: providerCatalogEntries,
	selected: localProvider,
});
assert.equal(providerCatalogStatus.ok, true);
assert.ok(providerCatalogStatus.counts.total >= 16);
assert.ok(providerCatalogStatus.counts.openAiCompatible >= 10);
assert.ok(providerCatalogStatus.counts.local >= 2);
assert.equal(providerCatalogStatus.selected.provider, 'ollama');
assert.equal(providerCatalogStatus.selected.apiKeyConfigured, true);
assert.equal(JSON.stringify(providerCatalogStatus).includes('sk-live-secret-value'), false);

const providerStatus = createProviderStatusResponse(normalizeProviderStatusRequest({
	jsonrpc: '2.0',
	id: 'provider-status-1',
	method: 'provider/status',
	params: { includeCodexConfig: true, includeModeRoutes: true, includePromptBlock: true },
}), localProvider, modeRoutes);
assert.equal(providerStatus.ok, true);
assert.equal(providerStatus.ready, true);
assert.equal(providerStatus.readiness.local, true);
assert.equal(providerStatus.readiness.openAiCompatible, true);
assert.equal(providerStatus.readiness.apiKeyRequired, false);
assert.equal(providerStatus.readiness.baseUrlReady, true);
assert.equal(providerStatus.modelSource, 'modeModels');
assert.equal(providerStatus.counts.modeRoutes, 3);
assert.equal(providerStatus.counts.modeOverrides, 2);
assert.equal(providerStatus.promptBlock.includes('provider_status'), true);
assert.equal(JSON.stringify(providerStatus).includes('sk-live-secret-value'), false);

const blockedProviderStatus = createProviderStatusResponse(normalizeProviderStatusRequest({
	jsonrpc: '2.0',
	id: 'provider-status-blocked-1',
	method: 'item/tool/call',
	params: { tool: 'provider_status', arguments: { includeModeRoutes: false, includePromptBlock: true } },
}), {
	...localProvider,
	provider: 'custom',
	label: 'Custom OpenAI-Compatible',
	mode: 'agent',
	model: 'custom-model',
	modelRouting: {
		mode: 'agent',
		effectiveModel: 'custom-model',
		source: 'providerDefault',
	},
	baseUrl: '',
	apiKey: undefined,
	apiKeyConfigured: false,
	apiKeyStorage: 'none',
}, []);
assert.equal(blockedProviderStatus.ready, false);
assert.equal(blockedProviderStatus.readiness.baseUrlReady, false);
assert.equal(blockedProviderStatus.readiness.credentialReady, false);
assert.ok(blockedProviderStatus.blockers.length >= 2);

const bridgeStatus = {
	state: 'connected',
	label: 'Codex app-server',
	detail: 'Connected to codex app-server',
	pendingRequests: 0,
	handshake: 'ok',
	transport: 'stdio',
	framing: 'content-length',
	health: {
		state: 'ok',
		connectedAt: now,
		lastMessageAt: now + 100,
		lastSendAt: now + 90,
		lastStatusAt: now + 120,
		pendingRequests: 0,
		stalePendingMs: 45000,
	},
};
const bridgeTransportConfig = {
	selectedTransport: 'stdio',
	framing: 'content-length',
	command: '/usr/local/bin/codex',
	args: ['app-server'],
	cwd: '/workspace/vibecodex',
};
const backendLaunchStatus = createBackendLaunchStatusResponse(normalizeBackendLaunchStatusRequest({
	jsonrpc: '2.0',
	id: 'backend-launch-1',
	method: 'agent/getBackendLaunchStatus',
	params: { includeRoutes: true, includePromptBlock: true },
}), {
	config: bridgeTransportConfig,
	bridgeStatus,
});
assert.equal(backendLaunchStatus.ready, true);
assert.equal(backendLaunchStatus.connected, true);
assert.equal(backendLaunchStatus.selectedRoute.transport, 'stdio');
assert.equal(backendLaunchStatus.selectedRoute.ready, true);
assert.equal(backendLaunchStatus.promptBlock.includes('backend_launch_status'), true);

const protocolEvents = [
	createProtocolEvent('out', 'agent initialize sent', {
		jsonrpc: '2.0',
		method: 'agent/initialize',
		params: { authorization: 'Bearer sk-live-secret-value-1234567890' },
	}),
	createProtocolEvent('in', 'visual plan submitted', {
		jsonrpc: '2.0',
		method: 'agent/submitPlan',
		params: { approvalToken: 'vibecodex-plan:sk-live-secret-value-1234567890' },
	}),
	createProtocolEvent('status', 'bridge connected', bridgeStatus),
];
const protocolStatus = createProtocolStatusResponse(normalizeProtocolStatusRequest({
	jsonrpc: '2.0',
	id: 'protocol-1',
	method: 'agent/getProtocolStatus',
	params: { includeEvents: true, maxEvents: 8 },
}), {
	bridgeStatus,
	protocolEvents,
	transportConfig: bridgeTransportConfig,
});
assert.equal(protocolStatus.bridgeAvailable, true);
assert.equal(protocolStatus.health.state, 'ok');
assert.equal(protocolStatus.health.handshake, 'ok');
assert.equal(protocolStatus.transportReadiness.ready, true);
assert.equal(protocolStatus.handshakeCapabilities.ready, true);
assert.equal(protocolStatus.handshakeCapabilities.backendAccepted, true);
assert.equal(protocolStatus.counts.error, 0);
assert.equal(protocolStatus.promptBlock.includes('Protocol status is observability-only'), true);
assert.equal(JSON.stringify(protocolStatus).includes('sk-live-secret-value'), false);

const unsupportedHandshakeProtocolStatus = createProtocolStatusResponse(normalizeProtocolStatusRequest({
	jsonrpc: '2.0',
	id: 'protocol-unsupported-handshake-1',
	method: 'agent/getProtocolStatus',
	params: { includeEvents: false },
}), {
	bridgeStatus: {
		...bridgeStatus,
		handshake: 'unsupported',
		detail: 'agent/initialize returned -32601 unknown method',
	},
	protocolEvents,
	transportConfig: bridgeTransportConfig,
});
assert.equal(unsupportedHandshakeProtocolStatus.bridgeAvailable, true);
assert.equal(unsupportedHandshakeProtocolStatus.handshakeCapabilities.backendAccepted, false);
assert.equal(unsupportedHandshakeProtocolStatus.handshakeCapabilities.backendHandshake, 'unsupported');
assert.equal(unsupportedHandshakeProtocolStatus.handshakeCapabilities.ready, false);
assert.equal(unsupportedHandshakeProtocolStatus.handshakeCapabilities.missingRequired.length, 0);
assert.equal(unsupportedHandshakeProtocolStatus.handshakeCapabilities.coverage.complete, true);

const initialPlan = createFallbackPlan('Add agent workflow proof for sk-live-secret-value-1234567890', 'agent');
const plan = applyPlanStepEdit(initialPlan, {
	stepId: 'review',
	title: 'Review multi-file diff, checkpoint rollback, and final delivery proof',
	status: 'pending',
});
const planRevisionHistory = appendPlanRevision(
	appendPlanRevision([], initialPlan, 'submitted', 'Initial backend visual plan submission.'),
	plan,
	'edited',
	'Manual checklist edit preview accepted for smoke proof.',
);

assert.equal(validatePlan(plan).valid, true);
assert.equal(plan.revision, 2);
assert.equal(planRevisionHistory.length, 2);

const submitted = createPlanSubmissionResponse('agent/submitPlan', plan, 'submitted');
assert.equal(submitted.accepted, true);
assert.equal(submitted.approvalReady, true);
assert.equal(JSON.stringify(submitted).includes('sk-live-secret-value'), false);

const authorization = createExecutionAuthorization(plan);
assert.equal(authorizationMatchesPlan(authorization, plan), true);
assert.equal(authorization.planHash, renderedPlanIdentity(plan).planHash);

const modeStatus = createModeStatusResponse(normalizeModeStatusRequest({
	jsonrpc: '2.0',
	id: 'mode-status-1',
	method: 'agent/getModeStatus',
	params: { includeModes: true, includeInstructions: true, includePromptBlock: true },
}), {
	modePolicy: modePolicyFor('agent'),
	authorization,
	activePlan: plan,
});
assert.equal(modeStatus.current.mode, 'agent');
assert.equal(modeStatus.current.readOnly, false);
assert.equal(modeStatus.authorization.activePlanMatches, true);
assert.equal(modeStatus.counts.modes, 8);
assert.equal(modeStatus.counts.readOnlyModes, 4);
assert.equal(modeStatus.counts.executionModes, 4);
assert.equal(modeStatus.modes.some(mode => mode.mode === 'plan' && mode.readOnly), true);
assert.equal(modeStatus.modes.some(mode => mode.mode === 'custom' && !mode.readOnly), true);
assert.equal(JSON.stringify(modeStatus).includes('sk-live-secret-value'), false);

const readOnlyModeStatus = createModeStatusResponse(normalizeModeStatusRequest({
	jsonrpc: '2.0',
	id: 'mode-status-plan-1',
	method: 'item/tool/call',
	params: { tool: 'mode_status', arguments: { includeModes: true, includePromptBlock: true } },
}), {
	modePolicy: modePolicyFor('plan'),
	authorization,
	activePlan: plan,
});
assert.equal(readOnlyModeStatus.current.mode, 'plan');
assert.equal(readOnlyModeStatus.current.readOnly, true);
assert.equal(readOnlyModeStatus.authorization.activePlanMatches, true);

const inlinePromptSession = {
	id: 'inline-1',
	source: 'inlinePrompt',
	createdAt: now,
	instruction: 'Refactor selected agent workflow without leaking sk-live-secret-value-1234567890.',
	prompt: 'Inline edit request from VibeCode Ctrl/Cmd+K with secret sk-live-secret-value-1234567890.',
	file: 'src/agent.ts',
	languageId: 'typescript',
	range: '10:1-16:1',
	selectionKind: 'selected-range',
	selectedText: 'const secret = "sk-live-secret-value-1234567890";',
	contextBefore: 'function before() { return true; }',
	contextBeforeRange: '1:1-9:1',
	contextAfter: 'function after() { return true; }',
	contextAfterRange: '17:1-24:1',
	requiredPlanSteps: [
		'Inspect selected range before mutation.',
		'Generate visual plan and Mermaid graph.',
		'Apply minimal diff after approval.',
	],
	acceptanceCriteria: [
		'No mutation occurs before plan approval.',
		'Accepted diff covers src/agent.ts.',
	],
};
const inlinePromptStatus = createInlinePromptStatusResponse(normalizeInlinePromptStatusRequest({
	jsonrpc: '2.0',
	id: 'inline-status-1',
	method: 'agent/getInlinePromptStatus',
	params: { includePrompt: true, includeContext: true },
}), {
	session: inlinePromptSession,
	activePlan: plan,
	authorization,
});
assert.equal(inlinePromptStatus.active, true);
assert.equal(inlinePromptStatus.executionAuthorization.activePlanMatches, true);
assert.equal(inlinePromptStatus.counts.requiredPlanSteps, 3);
assert.equal(JSON.stringify(inlinePromptStatus).includes('sk-live-secret-value'), false);

const taskBoard = queueTaskBoardCard({ version: 1, updatedAt: now, cards: [] }, {
	title: 'Run native prompt surface proof',
	prompt: 'Start from sidebar/URI intake with secret sk-live-secret-value-1234567890.',
	mode: 'agent',
	source: 'uri',
	parallelThreads: 8,
	evidence: ['Queued from vscode://vibecodex.agent/task'],
});
const taskStartStatus = createTaskStartStatusResponse(normalizeTaskStartStatusRequest({
	jsonrpc: '2.0',
	id: 'task-start-1',
	method: 'agent/getTaskStartStatus',
	params: { cardId: taskBoard.cards[0].id, includePromptBlock: true, includeEvidence: true },
}), { board: taskBoard });
assert.equal(taskStartStatus.readiness.startAllowed, true);
assert.equal(taskStartStatus.readiness.route, 'start_visual_plan');
assert.equal(taskStartStatus.readiness.mutationLocked, true);
assert.equal(taskStartStatus.visualPlanSeed.parallelThreads, 8);
assert.equal(JSON.stringify(taskStartStatus).includes('sk-live-secret-value'), false);

const externalIntakeStatus = createExternalIntakeStatusResponse(normalizeExternalIntakeStatusRequest({
	jsonrpc: '2.0',
	id: 'external-intake-1',
	method: 'agent/getExternalIntakeStatus',
	params: { includeExamples: true, includeQueueCounts: true },
}), { board: taskBoard });
assert.equal(externalIntakeStatus.enabled, true);
assert.equal(externalIntakeStatus.limits.maxParallelThreads, 8);
assert.equal(externalIntakeStatus.limits.startRequestBeginsPlanOnly, true);
assert.equal(externalIntakeStatus.queue.intake.external, 1);

const sessionSnapshot = {
	id: 'session-native-1',
	createdAt: now,
	updatedAt: now + 10,
	mode: 'agent',
	prompt: 'Native prompt surface session with secret sk-live-secret-value-1234567890.',
	status: 'approved',
	plan,
	planRevisionHistory: [
		{ event: 'submitted', taskId: plan.taskId, revision: 1 },
		{ event: 'edited', taskId: plan.taskId, revision: plan.revision },
	],
	inlinePromptSession,
	provider: {
		provider: localProvider.provider,
		label: localProvider.label,
		mode: localProvider.mode,
		model: localProvider.model,
		modelRouting: localProvider.modelRouting,
		baseUrl: localProvider.baseUrl,
		apiKeyConfigured: localProvider.apiKeyConfigured,
		apiKeyStorage: localProvider.apiKeyStorage,
		codexConfig: localProvider.codexConfig,
	},
	transcript: [
		createTranscriptEvent({ kind: 'user', status: 'completed', title: 'Prompt from Ctrl/Cmd+K' }, now),
		createTranscriptEvent({ kind: 'plan', status: 'completed', title: 'Visual plan rendered' }, now + 1),
	],
	evidence: ['Native prompt, provider, and plan surface ready with secret sk-live-secret-value-1234567890.'],
};
const sessionHistoryStatus = createSessionHistoryStatusResponse(normalizeSessionHistoryStatusRequest({
	jsonrpc: '2.0',
	id: 'session-history-1',
	method: 'agent/getSessionHistoryStatus',
	params: { includeDetails: true, includeTranscriptTail: true, maxSessions: 6 },
}), {
	history: [sessionSnapshot],
	activeSessionId: sessionSnapshot.id,
});
assert.equal(sessionHistoryStatus.counts.sessions, 1);
assert.equal(sessionHistoryStatus.counts.tabs, 1);
assert.equal(sessionHistoryStatus.counts.activeSessions, 1);
assert.equal(sessionHistoryStatus.sessions[0].provider.label, 'Ollama');
assert.equal(JSON.stringify(sessionHistoryStatus).includes('sk-live-secret-value'), false);

const sessionExportStatus = createSessionExportResponse(normalizeSessionExportRequest({
	jsonrpc: '2.0',
	id: 'session-export-1',
	method: 'agent/exportSession',
	params: { active: true, maxChars: 20000 },
}), {
	history: [sessionSnapshot],
	activeSessionId: sessionSnapshot.id,
});
assert.equal(sessionExportStatus.ok, true);
assert.equal(sessionExportStatus.selectedActive, true);
assert.equal(sessionExportStatus.truncated, false);
assert.equal(sessionExportStatus.counts.sessions, 1);
assert.equal(sessionExportStatus.counts.transcriptEvents, 2);
assert.equal(sessionExportStatus.markdown.includes('# Vibe Codex Session'), true);
assert.equal(sessionExportStatus.markdown.includes('## Plan'), true);
assert.equal(sessionExportStatus.guardrails.some(line => /never.*approval/i.test(line)), true);
assert.equal(JSON.stringify(sessionExportStatus).includes('sk-live-secret-value'), false);

const planCanvasStatus = createPlanCanvasStatusResponse(normalizePlanCanvasStatusRequest({
	jsonrpc: '2.0',
	id: 'plan-canvas-1',
	method: 'agent/getPlanCanvasStatus',
	params: { includeFeatures: true, includePromptBlock: true },
}), {
	plan,
	authorization,
	lastValidGraph: {
		taskId: plan.taskId,
		revision: plan.revision,
		planHash: renderedPlanIdentity(plan).planHash,
		nodes: plan.steps.length,
		edges: Math.max(0, plan.steps.length - 1),
		updatedAt: now,
	},
});
assert.equal(planCanvasStatus.ready, true);
assert.equal(planCanvasStatus.route, 'ready_for_execution');
assert.equal(planCanvasStatus.graphSource, 'validated_mermaid');
assert.equal(planCanvasStatus.approvalLocked, false);
assert.equal(planCanvasStatus.counts.steps, plan.steps.length);
assert.equal(planCanvasStatus.counts.linkedSteps, plan.steps.length);
assert.equal(planCanvasStatus.features.find(feature => feature.id === 'offline-local-svg-renderer').ready, true);
assert.equal(planCanvasStatus.features.find(feature => feature.id === 'strict-webview-csp').ready, true);
assert.equal(planCanvasStatus.promptBlock.includes('plan_canvas_status'), true);

const brokenCanvasStatus = createPlanCanvasStatusResponse(normalizePlanCanvasStatusRequest({
	jsonrpc: '2.0',
	id: 'plan-canvas-broken-1',
	method: 'item/tool/call',
	params: { tool: 'plan_canvas_status', arguments: { includeFeatures: true, includePromptBlock: true } },
}), {
	plan: {
		...plan,
		revision: plan.revision + 1,
		flowchart: 'graph TD\n  A[Safe]\n  click A "javascript:alert(1)"',
	},
	authorization,
	lastValidGraph: {
		taskId: plan.taskId,
		revision: plan.revision,
		planHash: renderedPlanIdentity(plan).planHash,
		nodes: plan.steps.length,
		edges: Math.max(0, plan.steps.length - 1),
		updatedAt: now,
	},
});
assert.equal(brokenCanvasStatus.ready, false);
assert.equal(brokenCanvasStatus.route, 'repair_mermaid');
assert.equal(brokenCanvasStatus.graphSource, 'last_valid_cached');
assert.equal(brokenCanvasStatus.counts.cachedNodes, plan.steps.length);
assert.equal(brokenCanvasStatus.blockers.some(blocker => /blocked interactive|script directives/i.test(blocker)), true);
assert.equal(JSON.stringify(brokenCanvasStatus).includes('javascript:alert'), false);

const planStatus = createPlanStatusResponse(normalizePlanStatusRequest({
	jsonrpc: '2.0',
	id: 'plan-status-1',
	method: 'agent/getPlanStatus',
	params: { includeHistory: true, includeRenderModel: true },
}), {
	plan,
	authorization,
	history: planRevisionHistory,
});
assert.equal(planStatus.ok, true);
assert.equal(planStatus.valid, true);
assert.equal(planStatus.approved, true);
assert.equal(planStatus.mutationReady, true);
assert.equal(planStatus.renderStatus.graphValid, true);
assert.equal(planStatus.renderStatus.fallbackRequired, false);
assert.equal(planStatus.renderStatus.linkedStepCount, planStatus.renderStatus.stepCount);
assert.equal(planStatus.history.length, 2);
assert.equal(planStatus.renderModel.highlightBindings.length, plan.steps.length);
assert.equal(JSON.stringify(planStatus).includes('sk-live-secret-value'), false);

const planEditStatus = createPlanEditStatusResponse(normalizePlanEditStatusRequest({
	jsonrpc: '2.0',
	id: 'plan-edit-status-1',
	method: 'agent/validatePlanEdit',
	params: {
		stepId: 'plan',
		title: 'Render strategy, Mermaid flowchart, editable checklist, risks, and acceptance criteria',
		status: 'in_progress',
		includeEditedPlan: true,
		includeRepairHints: true,
	},
}), { plan });
assert.equal(planEditStatus.ok, true);
assert.equal(planEditStatus.changed, true);
assert.equal(planEditStatus.valid, true);
assert.equal(planEditStatus.approvalReady, true);
assert.equal(planEditStatus.mutationLocked, true);
assert.equal(planEditStatus.currentRevision, plan.revision);
assert.equal(planEditStatus.prospectiveRevision, plan.revision + 1);
assert.equal(planEditStatus.render.linkedStepCount, planEditStatus.render.stepCount);
assert.equal(JSON.stringify(planEditStatus).includes('sk-live-secret-value'), false);

const planFocusStatus = createPlanFocusStatusResponse(normalizePlanFocusStatusRequest({
	jsonrpc: '2.0',
	id: 'plan-focus-status-1',
	method: 'agent/getPlanFocusStatus',
	params: {
		stepId: 'review',
		includeBindings: true,
		includeGraph: true,
		includeFiles: true,
	},
}), { plan });
assert.equal(planFocusStatus.ok, true);
assert.equal(planFocusStatus.valid, true);
assert.equal(planFocusStatus.focus.matched, true);
assert.equal(planFocusStatus.focus.graphNodePresent, true);
assert.equal(planFocusStatus.focus.checklistLinked, true);
assert.equal(planFocusStatus.counts.linkedBindings, planFocusStatus.counts.bindings);

const verificationPlan = {
	version: 1,
	createdAt: now,
	workspaceRoot: '/workspace/vibecodex',
	acceptanceCriteria: [
		'The visual plan is approved before mutation.',
		'Terminal verification evidence is recorded.',
	],
	diagnosticsBaseline: { error: 0, warning: 0, information: 0, hint: 0 },
	checks: [
		{
			id: 'acceptance-1-plan-approved-before-mutation',
			label: 'Acceptance criterion 1: The visual plan is approved before mutation.',
			kind: 'custom',
			status: 'passed',
			required: true,
			source: 'plan.acceptanceCriteria',
			evidence: 'Plan status shows exact approved revision and mutationReady=true.',
		},
		{
			id: 'acceptance-2-terminal-verification-recorded',
			label: 'Acceptance criterion 2: Terminal verification evidence is recorded.',
			kind: 'custom',
			status: 'passed',
			required: true,
			source: 'plan.acceptanceCriteria',
			evidence: 'Terminal run terminal-1 recorded npm test with 11 passing.',
			lastRunId: 'terminal-1',
		},
		{
			id: 'npm-test',
			label: 'npm test',
			command: 'npm test',
			kind: 'test',
			status: 'passed',
			required: true,
			source: 'package.json:test',
			evidence: '11 passing',
		},
		{
			id: 'diagnostics-baseline',
			label: 'IDE diagnostics do not introduce new errors',
			kind: 'diagnostics',
			status: 'passed',
			required: true,
			source: 'vscode.languages.getDiagnostics',
			evidence: '0 errors after run',
		},
	],
};

const acceptanceCriteriaStatus = createAcceptanceCriteriaStatusResponse(normalizeAcceptanceCriteriaStatusRequest({
	jsonrpc: '2.0',
	id: 'acceptance-status-1',
	method: 'agent/getAcceptanceCriteriaStatus',
	params: { includeCriteria: true, includeEvidence: true, includePromptBlock: true },
}), { verificationPlan });
assert.equal(acceptanceCriteriaStatus.ok, true);
assert.equal(acceptanceCriteriaStatus.ready, true);
assert.equal(acceptanceCriteriaStatus.coverageComplete, true);
assert.equal(acceptanceCriteriaStatus.counts.total, verificationPlan.acceptanceCriteria.length);
assert.equal(acceptanceCriteriaStatus.counts.passed, verificationPlan.acceptanceCriteria.length);
assert.equal(acceptanceCriteriaStatus.counts.blocking, 0);
assert.equal(JSON.stringify(acceptanceCriteriaStatus).includes('sk-live-secret-value'), false);

const diagnosticsSnapshot = {
	capturedAt: now,
	total: 0,
	errors: 0,
	warnings: 0,
	information: 0,
	hints: 0,
	sample: [],
};

const terminalRuns = [
	{
		id: 'terminal-1',
		commandLine: 'npm test',
		startedAt: now,
		endedAt: now + 1000,
		status: 'passed',
		output: '11 passing',
		exitCode: 0,
	},
];

const diffReview = {
	reviewId: 'review-1',
	files: [
		{ path: 'src/agent.ts', patch: '@@ -1 +1 @@\n-agent\n+agent proof\n', status: 'accepted' },
		{ path: 'src/agent.test.ts', patch: '@@ -1 +1 @@\n-test\n+workflow proof test\n', status: 'accepted' },
	],
};

const taskCheckpointId = 'task-checkpoint-1';
const fileCheckpointPaths = diffReview.files.map(file => file.path);
const fileCheckpoints = diffReview.files.map((file, index) => ({
	id: `checkpoint-${index + 1}-sk-live-secret-value-1234567890`,
	path: file.path,
	previousText: 'Secret checkpoint text sk-live-secret-value-1234567890 must stay private.',
	existed: true,
	createdAt: now + index,
}));

const commandPermissionPolicy = normalizeCommandPermissionPolicy({
	allow: ['npm test', 'npm run *'],
	deny: ['sudo *', 'rm *', 'curl * | sh'],
	defaultAllow: false,
});
const terminalCommandValidationStatus = createTerminalCommandValidationResponse(normalizeTerminalCommandValidationRequest({
	jsonrpc: '2.0',
	id: 'terminal-command-1',
	method: 'agent/validateCommand',
	params: {
		command: 'npm test',
		cwd: 'src',
		reason: 'Run required test verification.',
		verificationCheckId: 'npm-test',
		includeCommand: true,
		includeRepairHints: true,
	},
}), {
	modePolicy: modePolicyFor('agent'),
	commandPermissionPolicy,
	hasExecutionAuthorization: true,
	workspaceTrusted: true,
	workspaceRoots: ['/workspace/vibecodex'],
	verificationCheckIds: verificationPlan.checks.map(check => check.id),
});
assert.equal(terminalCommandValidationStatus.valid, true);
assert.equal(terminalCommandValidationStatus.approvalReady, true);
assert.equal(terminalCommandValidationStatus.executionReady, true);
assert.equal(terminalCommandValidationStatus.classification.kind, 'test');
assert.equal(terminalCommandValidationStatus.policy.dangerous, false);

const blockedTerminalCommandValidationStatus = createTerminalCommandValidationResponse(normalizeTerminalCommandValidationRequest({
	jsonrpc: '2.0',
	id: 'terminal-command-blocked-1',
	method: 'item/tool/call',
	params: {
		tool: 'command_validate',
		arguments: {
			command: 'sudo rm -rf / --token sk-live-secret-value-1234567890',
			cwd: '/tmp',
			includeCommand: true,
			includeRepairHints: true,
		},
	},
}), {
	modePolicy: modePolicyFor('agent'),
	commandPermissionPolicy,
	hasExecutionAuthorization: true,
	workspaceTrusted: true,
	workspaceRoots: ['/workspace/vibecodex'],
	verificationCheckIds: verificationPlan.checks.map(check => check.id),
});
assert.equal(blockedTerminalCommandValidationStatus.valid, false);
assert.equal(blockedTerminalCommandValidationStatus.risk, 'blocked');
assert.equal(blockedTerminalCommandValidationStatus.policy.dangerous, true);
assert.equal(JSON.stringify(blockedTerminalCommandValidationStatus).includes('sk-live-secret-value'), false);

const toolCatalog = createToolCatalog({
	modePolicy: modePolicyFor('agent'),
	hasExecutionAuthorization: true,
	bridgeConnected: true,
});
const executionGateStatus = createExecutionGateStatusResponse(normalizeExecutionGateStatusRequest({
	jsonrpc: '2.0',
	id: 'execution-gate-1',
	method: 'agent/getExecutionGateStatus',
	params: {
		taskId: plan.taskId,
		revision: plan.revision,
		toolName: 'execute_command',
		arguments: {
			command: 'npm test',
			cwd: '.',
			verificationCheckId: 'npm-test',
		},
		includeToolCall: true,
		includePromptBlock: true,
	},
}), {
	plan,
	authorization,
	toolCatalog,
	approvals: [],
	activeDiffReview: diffReview,
});
assert.equal(executionGateStatus.ready, true);
assert.equal(executionGateStatus.blocked, false);
assert.equal(executionGateStatus.route, 'request_user_approval');
assert.equal(executionGateStatus.plan.mutationReady, true);
assert.equal(executionGateStatus.toolCall.route, 'request_approval');
assert.equal(JSON.stringify(executionGateStatus).includes('sk-live-secret-value'), false);

const terminalControlStatus = createTerminalControlResponse(normalizeTerminalControlRequest({
	jsonrpc: '2.0',
	id: 'terminal-control-1',
	method: 'terminal/status',
	params: { runId: terminalRuns[0].id },
}), terminalRuns[0]);
assert.equal(terminalControlStatus.ok, true);
assert.equal(terminalControlStatus.status, 'passed');
assert.equal(terminalControlStatus.commandLine, 'npm test');

const workspaceSandboxStatus = createWorkspaceSandboxStatusResponse(normalizeWorkspaceSandboxStatusRequest({
	jsonrpc: '2.0',
	id: 'workspace-sandbox-1',
	method: 'agent/getWorkspaceSandboxStatus',
	params: {
		includeRoots: true,
		includeIgnorePolicy: true,
		includePaths: true,
		includeGuardrails: true,
		samplePaths: ['src/agent.ts', 'src/agent.test.ts'],
	},
}), {
	workspaceRoots: ['/workspace/vibecodex'],
	workspaceTrusted: true,
	ignorePolicy: {
		version: 1,
		sources: ['.vibecodexignore'],
		rules: [{ source: '.vibecodexignore', pattern: 'node_modules/**', negated: false }],
	},
	approvals: [],
	activeDiffReview: diffReview,
	patchCheckpoints: fileCheckpoints,
});
assert.equal(workspaceSandboxStatus.ready, true);
assert.equal(workspaceSandboxStatus.counts.blockedPaths, 0);
assert.equal(workspaceSandboxStatus.guards.checkpointsBeforeWrites, true);
assert.equal(workspaceSandboxStatus.guards.atomicDiffRollback, true);

const blockedWorkspaceSandboxStatus = createWorkspaceSandboxStatusResponse(normalizeWorkspaceSandboxStatusRequest({
	jsonrpc: '2.0',
	id: 'workspace-sandbox-blocked-1',
	method: 'item/tool/call',
	params: {
		tool: 'workspace_sandbox_status',
		arguments: {
			includePaths: true,
			samplePaths: ['../sk-live-secret-value-1234567890.txt', 'node_modules/package/index.js'],
		},
	},
}), {
	workspaceRoots: ['/workspace/vibecodex'],
	workspaceTrusted: true,
	ignorePolicy: {
		version: 1,
		sources: ['.vibecodexignore'],
		rules: [{ source: '.vibecodexignore', pattern: 'node_modules/**', negated: false }],
	},
	approvals: [],
	activeDiffReview: undefined,
	patchCheckpoints: [],
});
assert.equal(blockedWorkspaceSandboxStatus.ready, false);
assert.equal(blockedWorkspaceSandboxStatus.counts.blockedPaths, 2);
assert.equal(JSON.stringify(blockedWorkspaceSandboxStatus).includes('sk-live-secret-value'), false);

const safetyStatus = createSafetyStatusResponse(normalizeSafetyStatusRequest({
	jsonrpc: '2.0',
	id: 'safety-1',
	method: 'agent/getSafetyStatus',
	params: { includePolicies: true, includePendingDetails: true },
}), {
	modePolicy: modePolicyFor('agent'),
	commandPermissionPolicy,
	autoApproveConfig: defaultAutoApproveConfig,
	authorization,
	activePlan: plan,
	workspaceTrusted: true,
	workspaceRoots: ['/workspace/vibecodex'],
	pending: {
		approvals: 0,
		browserActions: 0,
		mcpActions: 0,
		webFetches: 0,
		hookActions: 0,
		userInputRequests: 0,
		diffFiles: 0,
	},
	pendingDetails: [],
});
assert.equal(safetyStatus.mode.readOnly, false);
assert.equal(safetyStatus.executionAuthorization.approved, true);
assert.equal(safetyStatus.executionAuthorization.activePlanMatches, true);
assert.equal(safetyStatus.workspace.pathTraversalBlocked, true);
assert.equal(safetyStatus.workspace.symlinkTraversalBlocked, true);
assert.equal(JSON.stringify(safetyStatus).includes('sk-live-secret-value'), false);

const failedTerminalRun = {
	id: 'terminal-failed-1',
	commandLine: 'npm test -- --runInBand sk-live-secret-value-1234567890',
	startedAt: now + 2000,
	endedAt: now + 3000,
	status: 'failed',
	output: 'FAIL src/agent.test.ts\nExpected true but received false\nsecret sk-live-secret-value-1234567890',
	exitCode: 1,
};
const failedTerminalInsight = createTerminalInsight(failedTerminalRun);
const remediationPlan = applyPlanRemediation(plan, {
	reason: 'npm test failed',
	evidence: failedTerminalInsight.summary,
	failedStepHint: 'review',
});
const remediationAuthorization = createExecutionAuthorization(remediationPlan);
const terminalRemediationEvent = createTerminalRemediationEvent({
	taskId: remediationPlan.taskId,
	previousRevision: plan.revision,
	plan: remediationPlan,
	run: failedTerminalRun,
	insight: failedTerminalInsight,
	reason: 'Terminal verification failed and required a visual-plan remediation revision.',
	evidence: failedTerminalRun.output,
	verification: { checkId: 'npm-test', verificationStatus: 'failed' },
});
const terminalRemediationStatus = createTerminalRemediationStatusResponse(normalizeTerminalRemediationStatusRequest({
	jsonrpc: '2.0',
	id: 'terminal-remediation-1',
	method: 'agent/getTerminalRemediationStatus',
	params: { taskId: remediationPlan.taskId, runId: failedTerminalRun.id, includePlan: true, includeEvidence: true },
}), {
	events: [terminalRemediationEvent],
	activePlan: remediationPlan,
	authorization: remediationAuthorization,
});
assert.equal(terminalRemediationStatus.ok, true);
assert.equal(terminalRemediationStatus.authorizationMatchesActivePlan, true);
assert.equal(terminalRemediationStatus.mutationLocked, false);
assert.equal(terminalRemediationStatus.selectedEvent.followUpPromptAvailable, true);
assert.equal(terminalRemediationStatus.selectedEvent.remediationStepIds.length, 1);
assert.equal(terminalRemediationStatus.selectedEvent.failedStepIds.length, 1);
assert.equal(JSON.stringify(terminalRemediationStatus).includes('sk-live-secret-value'), false);

const devServerRun = {
	id: 'terminal-preview-1',
	commandLine: 'npm run dev',
	startedAt: now + 4000,
	status: 'running',
	output: 'Vite ready at http://localhost:5173/?token=sk-live-secret-value-1234567890',
};
const devServerInsight = createTerminalInsight(devServerRun);
const previewPlan = {
	version: 1,
	detectedAt: now,
	previews: [{
		id: 'preview-web',
		label: 'dev',
		command: 'npm run dev',
		url: 'http://localhost:5173',
		source: 'package.json:dev',
		status: 'available',
	}],
};
const previewStatus = createPreviewStatusResponse(normalizePreviewStatusRequest({
	jsonrpc: '2.0',
	id: 'preview-status-1',
	method: 'agent/getPreviewStatus',
	params: { url: 'http://localhost:5173', includeTargets: true, includeInsights: true },
}), {
	previewPlan,
	terminalInsights: [devServerInsight],
	pendingBrowserActions: 0,
	hasExecutionAuthorization: true,
});
assert.equal(previewStatus.available, true);
assert.equal(previewStatus.requestedUrlKnown, true);
assert.equal(previewStatus.approval.hasExecutionAuthorization, true);
assert.equal(JSON.stringify(previewStatus).includes('sk-live-secret-value'), false);

const browserOpenAction = normalizeBrowserActionRequest({
	jsonrpc: '2.0',
	id: 'browser-open-1',
	method: 'item/tool/call',
	params: {
		tool: 'browser_action',
		arguments: {
			action: 'open',
			url: 'http://localhost:5173/?token=sk-live-secret-value-1234567890',
			reason: 'Open approved preview.',
		},
	},
});
assert.ok(browserOpenAction);
assert.equal(browserOpenAction.supported, true);
assert.equal(JSON.stringify(browserOpenAction).includes('sk-live-secret-value'), false);
const browserClickAction = normalizeBrowserActionRequest({
	jsonrpc: '2.0',
	id: 'browser-click-1',
	method: 'cline/browser_action',
	params: {
		action: 'click',
		selector: '#submit',
		text: 'sk-live-secret-value-1234567890',
		reason: 'Native controller handoff proof.',
	},
});
assert.ok(browserClickAction);
assert.equal(browserClickAction.supported, false);
assert.equal(JSON.stringify(browserClickAction).includes('sk-live-secret-value'), false);
const browserStatus = createBrowserStatusResponse(normalizeBrowserStatusRequest({
	jsonrpc: '2.0',
	id: 'browser-status-1',
	method: 'agent/getBrowserStatus',
	params: { includePendingActions: true, maxActions: 4 },
}), {
	pendingActions: [],
	hasExecutionAuthorization: true,
});
assert.equal(browserStatus.approval.hasExecutionAuthorization, true);
assert.equal(browserStatus.counts.nativeRequiredPendingActions, 0);
assert.equal(browserStatus.capabilities.loopbackPreviewPanel, true);

const browserActionStatus = createBrowserActionStatusResponse(normalizeBrowserActionStatusRequest({
	jsonrpc: '2.0',
	id: 'browser-action-status-1',
	method: 'agent/getBrowserActionStatus',
	params: { includeEvents: true, includePendingActions: true, includePromptBlock: true },
}), {
	events: [
		createBrowserActionEvidenceEvent(browserOpenAction, 'started', { decision: 'accept', responseMessage: 'Opened loopback preview.' }),
		createBrowserActionEvidenceEvent(browserClickAction, 'native_required', { reason: 'Bundled native controller required.' }),
	],
	pendingActions: [],
});
assert.equal(browserActionStatus.counts.openNavigateStarted, 1);
assert.equal(browserActionStatus.counts.nativeRequired, 1);
assert.equal(browserActionStatus.counts.pendingActions, 0);
assert.equal(browserActionStatus.counts.blocked, 0);

const mcpCatalog = {
	version: 1,
	collectedAt: now,
	sources: ['.vibecodex/mcp.json'],
	servers: [
		{
			name: 'workspace-docs',
			source: '.vibecodex/mcp.json',
			transport: 'stdio',
			disabled: false,
			command: 'node',
			args: ['tools/mcp-docs.js'],
			envKeys: ['VIBECODEX_MCP_TOKEN'],
			autoApprove: ['read_docs'],
			timeoutMs: 30000,
		},
		{
			name: 'disabled-global-mirror',
			source: '.vibecodex/mcp.json',
			transport: 'http',
			disabled: true,
			url: 'https://mcp.example.com?token=sk-live-secret-value-1234567890',
			headerKeys: ['Authorization'],
		},
	],
};
const mcpStatus = createMcpStatusResponse(normalizeMcpStatusRequest({
	jsonrpc: '2.0',
	id: 'mcp-status-1',
	method: 'agent/getMcpStatus',
	params: { includeServers: true, includeTools: true },
}), {
	catalog: mcpCatalog,
	pendingActions: 0,
	hasExecutionAuthorization: true,
});
assert.equal(mcpStatus.available, true);
assert.equal(mcpStatus.counts.enabled, 1);
assert.equal(mcpStatus.counts.disabled, 1);
assert.equal(mcpStatus.approval.hasExecutionAuthorization, true);
assert.equal(JSON.stringify(mcpStatus).includes('sk-live-secret-value'), false);

const unknownMcpStatus = createMcpStatusResponse(normalizeMcpStatusRequest({
	jsonrpc: '2.0',
	id: 'mcp-status-unknown-1',
	method: 'item/tool/call',
	params: { tool: 'mcp_status', arguments: { serverName: 'global-secret-sk-live-secret-value-1234567890', includeServers: true } },
}), {
	catalog: mcpCatalog,
	pendingActions: 0,
	hasExecutionAuthorization: true,
});
assert.equal(unknownMcpStatus.requestedServer.found, false);
assert.equal(unknownMcpStatus.counts.requestedUnknownServers, 1);
assert.equal(JSON.stringify(unknownMcpStatus).includes('sk-live-secret-value'), false);

const webFetchRequest = normalizeWebFetchRequest({
	jsonrpc: '2.0',
	id: 'web-fetch-1',
	method: 'item/tool/call',
	params: {
		tool: 'fetch_web_content',
		arguments: {
			url: 'https://example.com/docs?api_key=sk-live-secret-value-1234567890',
			reason: 'Reference current API documentation.',
		},
	},
});
assert.ok(webFetchRequest);
assert.equal(webFetchRequest.supported, true);
assert.equal(webFetchRequest.blocked, false);
assert.equal(JSON.stringify(webFetchRequest).includes('sk-live-secret-value'), false);

const blockedWebFetchRequest = normalizeWebFetchRequest({
	jsonrpc: '2.0',
	id: 'web-fetch-blocked-1',
	method: 'web/fetch',
	params: { url: 'file:///etc/passwd?token=sk-live-secret-value-1234567890' },
});
assert.ok(blockedWebFetchRequest);
assert.equal(blockedWebFetchRequest.supported, false);
assert.equal(blockedWebFetchRequest.blocked, true);
assert.equal(JSON.stringify(blockedWebFetchRequest).includes('sk-live-secret-value'), false);

const toolTimelineStatus = createToolTimelineStatusResponse(normalizeToolTimelineStatusRequest({
	jsonrpc: '2.0',
	id: 'tool-timeline-1',
	method: 'agent/getToolTimelineStatus',
	params: { includeEvents: true, includeLiveState: true, includeDetails: true, maxEvents: 8 },
}), {
	transcriptEvents: [
		createTranscriptEvent({ kind: 'approval', status: 'completed', title: 'Approved terminal npm test' }, now),
		createTranscriptEvent({ kind: 'terminal', status: 'completed', title: 'npm test passed', detail: 'secret sk-live-secret-value-1234567890' }, now + 1),
		createTranscriptEvent({ kind: 'diff', status: 'completed', title: 'Accepted multi-file diff' }, now + 2),
		createTranscriptEvent({ kind: 'verification', status: 'completed', title: 'Diagnostics baseline passed' }, now + 3),
		createTranscriptEvent({ kind: 'rollback', status: 'completed', title: 'Checkpoint ready' }, now + 4),
	],
	approvals: [],
	terminalRuns,
	activeDiffReview: diffReview,
});
assert.equal(toolTimelineStatus.counts.approvals, 0);
assert.equal(toolTimelineStatus.counts.runningTerminalRuns, 0);
assert.equal(toolTimelineStatus.counts.pendingDiffFiles, 0);
assert.equal(toolTimelineStatus.counts.failed, 0);
assert.equal(JSON.stringify(toolTimelineStatus).includes('sk-live-secret-value'), false);

const diffCandidate = {
	reviewId: diffReview.reviewId,
	files: [
		{
			path: 'src/agent.ts',
			previousText: 'agent\n',
			patch: '@@ -1 +1 @@\n-agent\n+agent proof\n',
		},
		{
			path: 'src/agent.test.ts',
			previousText: 'test\n',
			replacements: [
				{ search: 'test', replace: 'workflow proof test', startLine: 1 },
			],
		},
	],
};
const diffValidationStatus = createDiffValidationResponse(normalizeDiffValidationRequest({
	jsonrpc: '2.0',
	id: 'diff-validation-1',
	method: 'agent/validateDiff',
	params: { diff: diffCandidate, includePatchPreviews: true, includeRepairHints: true },
}));
assert.equal(diffValidationStatus.valid, true);
assert.equal(diffValidationStatus.reviewReady, true);
assert.equal(diffValidationStatus.counts.files, 2);
assert.equal(diffValidationStatus.counts.unifiedDiff, 1);
assert.equal(diffValidationStatus.counts.searchReplace, 1);
assert.equal(diffValidationStatus.counts.duplicatePaths, 0);

const blockedDiffValidationStatus = createDiffValidationResponse(normalizeDiffValidationRequest({
	jsonrpc: '2.0',
	id: 'diff-validation-blocked-1',
	method: 'item/tool/call',
	params: {
		tool: 'diff_validate',
		arguments: {
			files: [
				{ path: '../secrets.txt', proposedText: 'api_key=sk-live-secret-value-1234567890' },
			],
			includeCandidate: true,
			includeRepairHints: true,
		},
	},
}));
assert.equal(blockedDiffValidationStatus.valid, false);
assert.equal(blockedDiffValidationStatus.files[0].pathSafety, 'blocked');
assert.equal(blockedDiffValidationStatus.validationErrors.some(error => /parent-directory traversal/i.test(error)), true);
assert.equal(JSON.stringify(blockedDiffValidationStatus).includes('sk-live-secret-value'), false);

const diffFileStatus = createDiffFileStatusResponse(normalizeDiffFileStatusRequest({
	jsonrpc: '2.0',
	id: 'diff-file-1',
	method: 'agent/getDiffFileStatus',
	params: { path: 'src/agent.ts', includePatchPreview: true, includeSiblings: true },
}), {
	review: diffReview,
	taskCheckpointId,
	fileCheckpoints,
});
assert.equal(diffFileStatus.ok, true);
assert.equal(diffFileStatus.file.path, 'src/agent.ts');
assert.equal(diffFileStatus.file.status, 'accepted');
assert.equal(diffFileStatus.file.hasCheckpoint, true);
assert.equal(diffFileStatus.file.actions.canOpenDiff, true);
assert.equal(diffFileStatus.file.actions.canRestoreCheckpoint, true);
assert.equal(diffFileStatus.file.actions.requiresPlanApprovalForAccept, true);
assert.equal(JSON.stringify(diffFileStatus).includes('sk-live-secret-value'), false);

const diffReapplyStatus = createDiffReapplyStatusResponse(normalizeDiffReapplyStatusRequest({
	jsonrpc: '2.0',
	id: 'diff-reapply-1',
	method: 'agent/getDiffReapplyStatus',
	params: {
		path: 'src/agent.ts',
		candidate: {
			files: [
				{
					path: 'src/agent.ts',
					previousText: 'agent proof\n',
					patch: '@@ -1 +1 @@\n-agent proof\n+agent proof v2\n',
				},
			],
		},
		includePatchPreviews: true,
		includeActiveFile: true,
		includeRepairHints: true,
	},
}), {
	review: diffReview,
	path: 'src/agent.ts',
	taskCheckpointId,
	fileCheckpoints,
});
assert.equal(diffReapplyStatus.reapplyReady, true);
assert.equal(diffReapplyStatus.route, 'submit_revised_review_file');
assert.equal(diffReapplyStatus.activeFile.hasCheckpoint, true);
assert.equal(diffReapplyStatus.candidate.valid, true);

let parallelPlan = createParallelAgentPlan('Run an 8-lane agent proof', 'agent', '/workspace/vibecodex', 8);
for (const thread of [...parallelPlan.threads]) {
	parallelPlan = withParallelThreadStatus(parallelPlan, thread.id, 'materialized', 'Smoke-test worktree materialized.');
}
assert.equal(parallelPlan.requestedThreads, 8);
assert.equal(parallelPlan.threads.length, 8);
assert.equal(new Set(parallelPlan.threads.map(thread => thread.worktreePath)).size, 8);
assert.equal(parallelPlan.threads.every(thread => thread.branchName.startsWith('vibecodex/checkpoint/')), true);
assert.equal(parallelPlan.threads.every(thread => thread.worktreePath.startsWith(`${parallelPlan.worktreeRoot}/`)), true);

let parallelResults = [];
for (const [index, thread] of parallelPlan.threads.entries()) {
	const result = normalizeParallelResultMessage('agent/parallelResult', {
		taskId: parallelPlan.taskId,
		threadId: thread.id,
		status: 'completed',
		summary: `${thread.id} completed isolated review and verification.`,
		changedFiles: diffReview.files.map(file => file.path),
		verification: ['npm test passed', 'diagnostics baseline passed'],
		risks: [],
		score: thread.id === 'agent-03' ? 0.99 : 0.75 - index / 100,
	}, parallelPlan);
	assert.ok(result);
	parallelResults = upsertParallelResult(parallelResults, result);
}
const parallelReview = createParallelReview(parallelPlan, parallelResults);
assert.equal(parallelReview.mergeReady, true);
assert.equal(parallelReview.results.length, 8);
assert.equal(parallelReview.blockers.length, 0);
assert.equal(parallelReview.recommendedThreadId, 'agent-03');
const parallelMergeRequest = createParallelMergeRequest(parallelReview, parallelReview.recommendedThreadId);
assert.equal(parallelMergeRequest.mergeReady, true);

const parallelLaneRequest = normalizeParallelLaneExecutionStatusRequest({
	jsonrpc: '2.0',
	id: 'parallel-lane-1',
	method: 'agent/getParallelLaneExecutionStatus',
	params: {
		taskId: parallelPlan.taskId,
		threadId: parallelReview.recommendedThreadId,
		includeResult: true,
		includePromptBlock: true,
	},
});
assert.ok(parallelLaneRequest);
const parallelLaneExecutionStatus = createParallelLaneExecutionStatusResponse(parallelLaneRequest, {
	plan: parallelPlan,
	results: parallelResults,
	review: parallelReview,
	activePlan: plan,
	authorization,
	workspaceTrusted: true,
	modePolicy: modePolicyFor('agent'),
});
assert.equal(parallelLaneExecutionStatus.ready, true);
assert.equal(parallelLaneExecutionStatus.route, 'review_reported_result');
assert.equal(parallelLaneExecutionStatus.counts.threads, 8);
assert.equal(parallelLaneExecutionStatus.counts.completedResults, 8);

const deliveryBarInput = {
	plan,
	hasExecutionAuthorization: true,
	verificationPlan,
	diagnosticsSnapshot,
	diagnosticsBaseline: verificationPlan.diagnosticsBaseline,
	diffReview,
	diffValidationStatus,
	diffFileStatus,
	diffReapplyStatus,
	taskCheckpointId,
	fileCheckpointCount: fileCheckpointPaths.length,
	fileCheckpointPaths,
	backendLaunchStatus,
	protocolStatus,
	extensionInstallStatus,
	inlinePromptStatus,
	modeStatus,
	taskStartStatus,
	externalIntakeStatus,
	sessionHistoryStatus,
	sessionExportStatus,
	providerCatalogStatus,
	providerStatus,
	planCanvasStatus,
	planStatus,
	planEditStatus,
	planFocusStatus,
	acceptanceCriteriaStatus,
	guidanceStatus,
	guidanceSelection,
	slashCommandStatus,
	terminalCommandValidationStatus,
	executionGateStatus,
	safetyStatus,
	workspaceSandboxStatus,
	terminalControlStatus,
	browserStatus,
	browserActionStatus,
	previewStatus,
	mcpStatus,
	webFetchRequest,
	toolTimelineStatus,
	parallelPlan,
	parallelReview,
	parallelMergeRequest,
};
const deliveryBarBase = createDeliveryBarState(deliveryBarInput);

assert.equal(deliveryBarBase.ready, true);
assert.equal(deliveryBarBase.blocked, false);
assert.equal(deliveryBarBase.checks.find(check => check.id === 'native-prompt-surface').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'mode-readiness').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'bridge').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'plan-interaction').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'guidance').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'execution-safety').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'tool-surface').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'diff-protocol').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'rollback').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'parallel').status, 'passed');
assert.equal(deliveryBarBase.checks.find(check => check.id === 'completion-handoff').status, 'skipped');

const deliveryBarReadOnlyMode = createDeliveryBarState({
	...deliveryBarInput,
	modeStatus: readOnlyModeStatus,
});
assert.equal(deliveryBarReadOnlyMode.blocked, true);
assert.equal(deliveryBarReadOnlyMode.checks.find(check => check.id === 'mode-readiness').status, 'failed');

const deliveryBarUnsupportedHandshake = createDeliveryBarState({
	...deliveryBarInput,
	protocolStatus: unsupportedHandshakeProtocolStatus,
});
assert.equal(deliveryBarUnsupportedHandshake.blocked, true);
assert.equal(deliveryBarUnsupportedHandshake.checks.find(check => check.id === 'bridge').status, 'failed');
assert.match(deliveryBarUnsupportedHandshake.checks.find(check => check.id === 'bridge').detail, /Backend handshake is unsupported/);

const checkpointStatus = createCheckpointStatusResponse(normalizeCheckpointStatusRequest({
	jsonrpc: '2.0',
	id: 'checkpoint-1',
	method: 'agent/getCheckpointStatus',
	params: { includeFiles: true, includeGit: true, includeActiveReview: true },
}), {
	taskCheckpointId,
	fileCheckpoints,
	activeReview: diffReview,
});
assert.equal(checkpointStatus.state, 'ready');
assert.equal(checkpointStatus.restoreAvailable, true);
assert.equal(checkpointStatus.fileCheckpointCount, 2);
assert.equal(checkpointStatus.reviewCoverage.complete, true);
assert.equal(checkpointStatus.reviewCoverage.acceptedWithCheckpoint, 2);
assert.equal(JSON.stringify(checkpointStatus).includes('previousText'), false);
assert.equal(JSON.stringify(checkpointStatus).includes('sk-live-secret-value'), false);

const rollbackRestoreStatus = createRollbackRestoreStatusResponse(normalizeRollbackRestoreStatusRequest({
	jsonrpc: '2.0',
	id: 'rollback-1',
	method: 'agent/getRollbackRestoreStatus',
	params: { target: 'task', includeFiles: true, includePromptBlock: true },
}), {
	taskCheckpointId,
	fileCheckpoints,
	activeReview: diffReview,
});
assert.equal(rollbackRestoreStatus.readiness.canRestore, true);
assert.equal(rollbackRestoreStatus.readiness.route, 'restore_task_checkpoint');
assert.equal(rollbackRestoreStatus.readiness.mutationLocked, true);
assert.equal(rollbackRestoreStatus.readiness.requiresDeveloperAction, true);
assert.equal(rollbackRestoreStatus.coverage.complete, true);
assert.equal(rollbackRestoreStatus.promptBlock.includes('rollback_restore_status'), true);
assert.equal(JSON.stringify(rollbackRestoreStatus).includes('previousText'), false);
assert.equal(JSON.stringify(rollbackRestoreStatus).includes('sk-live-secret-value'), false);

const fileRollbackRestoreStatus = createRollbackRestoreStatusResponse(normalizeRollbackRestoreStatusRequest({
	jsonrpc: '2.0',
	id: 'rollback-file-1',
	method: 'checkpoint/restoreStatus',
	params: { path: diffReview.files[0].path, includeFiles: false, includePromptBlock: false },
}), {
	taskCheckpointId,
	fileCheckpoints,
	activeReview: diffReview,
});
assert.equal(fileRollbackRestoreStatus.readiness.canRestore, true);
assert.equal(fileRollbackRestoreStatus.readiness.route, 'restore_file_checkpoint');
assert.equal(fileRollbackRestoreStatus.file.canRestore, true);

const commitHandoff = createCommitHandoff({
	plan,
	diffReview,
	verificationPlan,
	diagnosticsSnapshot,
	taskCheckpointId,
	fileCheckpointCount: fileCheckpointPaths.length,
});
assert.equal(commitHandoff.ready, true);

const smokeBenchmark = createSmokeBenchmarkState({
	plan,
	planRevisionHistory: [
		{ event: 'submitted', taskId: plan.taskId, revision: 1 },
		{ event: 'edited', taskId: plan.taskId, revision: plan.revision },
	],
	hasExecutionAuthorization: true,
	parallelPlan,
	parallelReview,
	parallelMergeRequest,
	terminalRuns,
	verificationPlan,
	diffReview,
	taskCheckpointId,
	fileCheckpointCount: fileCheckpointPaths.length,
	commitHandoff,
		deliveryReady: deliveryBarBase.ready,
});
assert.equal(smokeBenchmark.ready, true);
assert.equal(smokeBenchmark.milestones.find(milestone => milestone.id === 'manual-plan-adjustment').status, 'passed');
assert.equal(smokeBenchmark.milestones.find(milestone => milestone.id === 'parallel-safe').status, 'passed');

const finalReview = createFinalReviewState({ deliveryBar: deliveryBarBase, smokeBenchmark, commitHandoff });
assert.equal(finalReview.ready, true);
assert.equal(finalReview.decision, 'pass');

const commitHandoffStatus = createCommitHandoffStatusResponse(normalizeCommitHandoffStatusRequest({
	jsonrpc: '2.0',
	id: 'commit-handoff-status-1',
	method: 'agent/getCommitHandoffStatus',
	params: { includeMessage: true, includeEvidence: true, includeCommands: true },
}), commitHandoff);
assert.equal(commitHandoffStatus.ready, true);
assert.equal(commitHandoffStatus.counts.acceptedFiles, diffReview.files.length);
assert.equal(commitHandoffStatus.counts.commands >= 2, true);
assert.equal(JSON.stringify(commitHandoffStatus).includes('sk-live-secret-value'), false);

const autoCommitStatus = createAutoCommitStatusResponse(normalizeAutoCommitStatusRequest({
	jsonrpc: '2.0',
	id: 'auto-commit-status-1',
	method: 'agent/getAutoCommitStatus',
	params: { includeCommands: true, includeEvidence: true },
}), {
	enabled: true,
	workspaceTrusted: true,
	hasExecutionAuthorization: true,
	modePolicy: modePolicyFor('agent'),
	commitHandoff,
	finalReview,
});
assert.equal(autoCommitStatus.ready, true);
assert.equal(autoCommitStatus.enabled, true);
assert.equal(autoCommitStatus.counts.acceptedFiles, diffReview.files.length);
assert.equal(autoCommitStatus.commands.some(command => command.startsWith('git add')), true);
assert.equal(autoCommitStatus.commands.some(command => command.startsWith('git commit')), true);

const disabledAutoCommitStatus = createAutoCommitStatusResponse(normalizeAutoCommitStatusRequest({
	jsonrpc: '2.0',
	id: 'auto-commit-status-disabled-1',
	method: 'item/tool/call',
	params: { tool: 'auto_commit_status', arguments: { includeCommands: true, includeEvidence: false } },
}), {
	enabled: false,
	workspaceTrusted: true,
	hasExecutionAuthorization: true,
	modePolicy: modePolicyFor('agent'),
	commitHandoff,
	finalReview,
});
assert.equal(disabledAutoCommitStatus.ready, false);
assert.equal(disabledAutoCommitStatus.blockers.some(blocker => /disabled/i.test(blocker)), true);

const taskCompletionResponse = createTaskCompletionResponse(normalizeTaskCompletionRequest({
	jsonrpc: '2.0',
	id: 'task-completion-1',
	method: 'item/tool/call',
	params: {
		tool: 'attempt_completion',
		arguments: {
			result: 'Completed Vibe Codex extension delivery proof without leaking sk-live-secret-value-1234567890.',
			command: 'npm --prefix extensions/vibecodex-agent run verify',
			taskId: plan.taskId,
		},
	},
}), finalReview);
assert.equal(taskCompletionResponse.accepted, true);
assert.equal(taskCompletionResponse.completionKind, 'final_review');
assert.equal(JSON.stringify(taskCompletionResponse).includes('sk-live-secret-value'), false);

const taskCompletionStatus = createTaskCompletionStatusResponse(normalizeTaskCompletionStatusRequest({
	jsonrpc: '2.0',
	id: 'task-completion-status-1',
	method: 'agent/getTaskCompletionStatus',
	params: { includeLatest: true, includeBlockers: true, includeEvidence: true, includePromptBlock: true, includeResult: true },
}), {
	finalReview,
	latestCompletion: taskCompletionResponse,
});
assert.equal(taskCompletionStatus.ready, true);
assert.equal(taskCompletionStatus.accepted, true);
assert.equal(taskCompletionStatus.state, 'accepted');
assert.equal(taskCompletionStatus.gate.decision, 'pass');
assert.equal(taskCompletionStatus.promptBlock.includes('task_completion_status'), true);
assert.equal(JSON.stringify(taskCompletionStatus).includes('sk-live-secret-value'), false);

const deliveryBar = createDeliveryBarState({
	...deliveryBarInput,
	commitHandoffStatus,
	autoCommitStatus,
	taskCompletionStatus,
});
assert.equal(deliveryBar.ready, true);
assert.equal(deliveryBar.blocked, false);
assert.equal(deliveryBar.checks.find(check => check.id === 'completion-handoff').status, 'passed');

const workflowRequest = normalizeWorkflowStatusRequest({
	jsonrpc: '2.0',
	id: 'workflow-1',
	method: 'agent/getWorkflowStatus',
	params: { includeMilestones: true, includeEvidence: true, includePromptBlock: true },
});
assert.ok(workflowRequest);
const workflowStatus = createWorkflowStatusResponse(workflowRequest, {
	prompt: 'Build the Vibe Codex delivery proof.',
	plan,
	planRevisionHistory: [
		{ event: 'submitted', taskId: plan.taskId, revision: 1 },
		{ event: 'edited', taskId: plan.taskId, revision: plan.revision },
	],
	authorization,
	verificationPlan,
	diagnosticsSnapshot,
	deliveryBar,
	smokeBenchmark,
	finalReview,
	commitHandoff,
	diffReview,
	terminalRuns,
	taskCheckpointId,
	fileCheckpointCount: fileCheckpointPaths.length,
	fileCheckpointPaths,
	parallelPlan,
	parallelReview,
	parallelMergeRequest,
});
assert.equal(workflowStatus.stage, 'complete');
assert.equal(workflowStatus.readiness.rollbackCheckpoint.ready, true);
assert.equal(workflowStatus.readiness.finalReview.ready, true);
assert.equal(JSON.stringify(workflowStatus).includes('sk-live-secret-value'), false);

const deliveryStatus = createDeliveryBarStatusResponse(normalizeDeliveryBarStatusRequest({
	jsonrpc: '2.0',
	id: 'delivery-1',
	method: 'agent/getDeliveryBarStatus',
	params: { includeChecks: true, includeBlockers: true, includePromptBlock: true },
}), { deliveryBar });
assert.equal(deliveryStatus.ready, true);

const smokeStatus = createSmokeBenchmarkStatusResponse(normalizeSmokeBenchmarkStatusRequest({
	jsonrpc: '2.0',
	id: 'smoke-1',
	method: 'agent/getSmokeBenchmarkStatus',
	params: { includeMilestones: true, includeBlockers: true, includePromptBlock: true },
}), { smokeBenchmark });
assert.equal(smokeStatus.ready, true);

const finalReviewStatus = createVerificationStatusResponse(normalizeVerificationStatusRequest({
	jsonrpc: '2.0',
	id: 'final-1',
	method: 'agent/getFinalReviewStatus',
	params: { includeChecks: true, includeFinalReview: true },
}), {
	verificationPlan,
	diagnosticsSnapshot,
	deliveryBar,
	smokeBenchmark,
	finalReview,
	terminalRuns,
});
assert.equal(finalReviewStatus.finalReview.decision, 'pass');

const happyPathStatus = createHappyPathStatusResponse(normalizeHappyPathStatusRequest({
	jsonrpc: '2.0',
	id: 'happy-1',
	method: 'agent/getHappyPathStatus',
	params: { includeGates: true, includeEvidence: true, includePromptBlock: true },
}), {
	workflowStatus,
	smokeBenchmarkStatus: smokeStatus,
	deliveryBarStatus: deliveryStatus,
	finalReviewStatus,
	parallelLaneExecutionStatus,
});
assert.equal(happyPathStatus.ready, true);
assert.equal(happyPathStatus.route, 'ready_for_completion');
assert.equal(happyPathStatus.gates.every(gate => !gate.required || gate.ready), true);
assert.equal(happyPathStatus.gates.find(gate => gate.id === 'parallel-lane-execution').ready, true);
assert.equal(JSON.stringify(happyPathStatus).includes('sk-live-secret-value'), false);

console.log(`Extension smoke proof ready: ${happyPathStatus.counts.ready}/${happyPathStatus.counts.required} required gates ready.`);
