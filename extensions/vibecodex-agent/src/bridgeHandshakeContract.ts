/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const vibeCodexSupportedTransports = ['stdio', 'pipe', 'websocket'] as const;

export type VibeCodexSupportedTransport = typeof vibeCodexSupportedTransports[number];
export type VibeCodexHandshakeCapabilityValue = boolean | number | string | readonly string[] | { readonly [key: string]: VibeCodexHandshakeCapabilityValue };
export type VibeCodexAgentHandshakeCapabilities = Readonly<Record<string, VibeCodexHandshakeCapabilityValue>>;

export const vibeCodexAgentHandshakeCapabilities = {
	visualPlanning: true,
	planRevisionEditing: true,
	planValidationRequests: ['agent/validatePlan', 'agent/planValidation', 'plan/validate', 'visualPlan/validate'],
	planEditStatusRequests: ['agent/validatePlanEdit', 'agent/getPlanEditStatus', 'agent/planEditStatus', 'plan/editStatus', 'visualPlan/editStatus'],
	planStatusRequests: ['agent/getPlanStatus', 'agent/planStatus', 'agent/getVisualPlanStatus', 'agent/visualPlanStatus', 'plan/status', 'plan/renderStatus', 'visualPlan/status'],
	planCanvasStatusRequests: ['agent/getPlanCanvasStatus', 'agent/planCanvasStatus', 'visualPlan/canvasStatus', 'plan/canvasStatus'],
	planFocusStatusRequests: ['agent/getPlanFocusStatus', 'agent/planFocusStatus', 'visualPlan/focusStatus', 'plan/focusStatus'],
		planFocusEvents: ['agent/planFocusChanged'],
		inlinePromptStatusRequests: ['agent/getInlinePromptStatus', 'agent/inlinePromptStatus', 'inlinePrompt/status'],
		userInputRequests: ['ask_question', 'ask_followup_question', 'plan_mode_respond'],
		userInputStatusRequests: ['agent/getUserInputStatus', 'agent/userInputStatus', 'userInput/status', 'input/status'],
		transcriptStreaming: ['agent/message', 'agent/messageDelta', 'agent/status', 'cline/say'],
	taskSummaryRequests: ['agent/summarizeTask', 'agent/condense', 'summarize_task', 'condense'],
	approvalGates: true,
	approvalStatusRequests: ['agent/getApprovalStatus', 'agent/approvalStatus', 'approval/status'],
	actionApprovalStatusRequests: ['agent/getActionApprovalStatus', 'agent/actionApprovalStatus', 'action/approvalStatus', 'autoApprove/status'],
	toolTimelineStatusRequests: ['agent/getToolTimelineStatus', 'agent/toolTimelineStatus', 'tool/timelineStatus', 'timeline/status'],
	notificationStatusRequests: ['agent/getNotificationStatus', 'agent/notificationStatus', 'notification/status', 'attention/status'],
	modeStatusRequests: ['agent/getModeStatus', 'agent/modeStatus', 'mode/status', 'modePolicy/status'],
	safetyStatusRequests: ['agent/getSafetyStatus', 'agent/safetyStatus', 'safety/status'],
	redactionStatusRequests: ['agent/getRedactionStatus', 'agent/redactionStatus', 'redaction/status', 'security/redactionStatus'],
	diffReview: true,
	diffValidationRequests: ['agent/validateDiff', 'agent/diffValidation', 'diff/validate', 'patch/validate'],
	diffReviewStatusRequests: ['agent/getDiffReviewStatus', 'agent/diffReviewStatus', 'diff/status'],
	diffFileStatusRequests: ['agent/getDiffFileStatus', 'agent/diffFileStatus', 'diff/fileStatus', 'diff/focusStatus'],
	diffReapplyStatusRequests: ['agent/getDiffReapplyStatus', 'agent/diffReapplyStatus', 'diff/reapplyStatus', 'diff/repairStatus'],
	checkpointStatusRequests: ['agent/getCheckpointStatus', 'agent/checkpointStatus', 'checkpoint/status', 'rollback/status'],
	rollbackRestoreStatusRequests: ['agent/getRollbackRestoreStatus', 'agent/rollbackRestoreStatus', 'rollback/restoreStatus', 'checkpoint/restoreStatus', 'diff/restoreStatus'],
	taskRollbackNotifications: true,
	reviewFirstEditTools: ['editor', 'write_file', 'write_to_file', 'edit_file', 'replace_in_file', 'apply_patch', 'patch_file'],
	workspaceReadTools: ['editor', 'read_file', 'read_files', 'list_files', 'list_dir', 'search', 'grep_search', 'search_files', 'semantic_search', 'codebase_search', 'list_code_definition_names', 'vscode_references', 'find_references', 'workspace_symbols', 'symbol_search', 'get_diagnostics'],
	workspaceReadStatusRequests: ['agent/getWorkspaceReadStatus', 'agent/workspaceReadStatus', 'workspace/readStatus', 'workspace/searchStatus'],
	workspaceSandboxStatusRequests: ['agent/getWorkspaceSandboxStatus', 'agent/workspaceSandboxStatus', 'workspace/sandboxStatus', 'sandbox/status'],
	contextRefreshRequests: ['agent/refreshContext', 'agent/gatherContext', 'context/refresh', 'context/gather'],
	contextStatusRequests: ['agent/getContextStatus', 'agent/contextStatus', 'context/status'],
	contextIndexStatusRequests: ['agent/getContextIndexStatus', 'agent/contextIndexStatus', 'context/indexStatus', 'context/index/status'],
	symbolIndexStatusRequests: ['agent/getSymbolIndexStatus', 'agent/symbolIndexStatus', 'symbol/indexStatus', 'symbols/status'],
	gitContextTools: ['status', 'diff', 'log'],
	checkpointedDeleteFile: true,
	terminalEvidence: true,
	terminalResultNotifications: true,
	terminalCommandValidationRequests: ['agent/validateCommand', 'agent/commandValidation', 'command/validate', 'terminal/validate'],
	terminalOutputRequests: ['command_output', 'agent/getTerminalOutput', 'terminal/output'],
	terminalInsightStatusRequests: ['agent/getTerminalInsightStatus', 'agent/terminalInsightStatus', 'terminal/insightStatus'],
	terminalRemediationStatusRequests: ['agent/getTerminalRemediationStatus', 'agent/terminalRemediationStatus', 'terminal/remediationStatus'],
	terminalOutputStreaming: 'agent/terminalOutput',
	terminalControlRequests: ['agent/terminalControl', 'terminal/interrupt', 'terminal/retry', 'terminal/proceed', 'terminal/status'],
	terminalInterruptRetry: true,
	verificationEvidence: true,
	executionGateStatusRequests: ['agent/getExecutionGateStatus', 'agent/executionGateStatus', 'execution/gateStatus'],
	acceptanceCriteriaStatusRequests: ['agent/getAcceptanceCriteriaStatus', 'agent/acceptanceCriteriaStatus', 'acceptance/status', 'acceptanceCriteria/status', 'verification/acceptanceStatus'],
	taskCompletionStatusRequests: ['agent/getTaskCompletionStatus', 'agent/taskCompletionStatus', 'completion/status', 'completion/gateStatus'],
	deliveryBarStatusRequests: ['agent/getDeliveryBarStatus', 'agent/deliveryBarStatus', 'deliveryBar/status', 'delivery/gateStatus'],
	verificationStatusRequests: ['agent/getVerificationStatus', 'agent/verificationStatus', 'verification/status'],
	smokeBenchmarkStatusRequests: ['agent/getSmokeBenchmarkStatus', 'agent/smokeBenchmarkStatus', 'smokeBenchmark/status', 'smoke/status'],
	finalReviewStatusRequests: ['agent/getFinalReviewStatus', 'agent/finalReviewStatus', 'finalReview/status'],
	workflowStatusRequests: ['agent/getWorkflowStatus', 'agent/workflowStatus', 'workflow/status', 'delivery/workflowStatus', 'lifecycle/status'],
	happyPathStatusRequests: ['agent/getHappyPathStatus', 'agent/happyPathStatus', 'workflow/happyPathStatus', 'delivery/happyPathStatus', 'delivery/proofStatus'],
	diagnosticsEvidence: true,
	taskCompletionGate: ['attempt_completion', 'submit_and_exit', 'agent/taskComplete'],
	commitHandoffStatusRequests: ['agent/getCommitHandoffStatus', 'agent/commitHandoffStatus', 'commit/status'],
	autoCommitStatusRequests: ['agent/getAutoCommitStatus', 'agent/autoCommitStatus', 'autoCommit/status', 'commit/autoStatus'],
	webFetch: true,
	webSearch: true,
	browserOpenNavigate: true,
	browserStatusRequests: ['agent/getBrowserStatus', 'agent/browserStatus', 'browser/status'],
	browserActionStatusRequests: ['agent/getBrowserActionStatus', 'agent/browserActionStatus', 'browser/actionStatus', 'browser/controllerStatus'],
	previewStatusRequests: ['agent/getPreviewStatus', 'agent/previewStatus', 'preview/status'],
	previewStartRequests: ['agent/startPreview', 'agent/previewStart', 'preview/start', 'preview.start', 'start_preview'],
	previewStartTools: ['start_preview', 'preview_start', 'start_localhost_preview', 'localhost_start_preview', 'localhost_preview_start'],
	mcpStatusRequests: ['agent/getMcpStatus', 'agent/mcpStatus', 'mcp/status'],
	mcpApproval: true,
	hookExecution: true,
	rulesSkillsHooksContext: true,
	guidanceStatusRequests: ['agent/getGuidanceStatus', 'agent/guidanceStatus', 'guidance/status'],
	guidanceSelectionRequests: ['agent/selectGuidance', 'agent/guidanceSelect', 'guidance/select', 'rules/select'],
	memoryBankContext: true,
	providerSelection: true,
	providerCatalogRequests: ['agent/getProviderCatalog', 'agent/providerCatalog', 'provider/catalog'],
	providerStatusRequests: ['agent/getProviderStatus', 'agent/providerStatus', 'provider/status'],
	providerModeRouteStatus: true,
	sessionHistory: true,
	sessionHistoryStatusRequests: ['agent/getSessionHistoryStatus', 'agent/sessionHistoryStatus', 'session/historyStatus'],
	sessionExportRequests: ['agent/exportSession', 'agent/sessionExport', 'session/export', 'chat/export'],
	slashCommandStatusRequests: ['agent/getSlashCommandStatus', 'agent/slashCommandStatus', 'slash/status', 'slashCommands/status'],
	taskDelegationRequests: ['agent/newTask', 'agent/delegateTask', 'new_task', 'delegate_task'],
	taskBoardStatusRequests: ['agent/getTaskBoardStatus', 'agent/taskBoardStatus', 'taskBoard/status'],
	taskStartStatusRequests: ['agent/getTaskStartStatus', 'agent/taskStartStatus', 'task/startStatus', 'taskBoard/startStatus'],
	taskIntakeStatusRequests: ['agent/getTaskIntakeStatus', 'agent/taskIntakeStatus', 'task/intakeStatus', 'task_intake_status'],
	externalIntakeStatusRequests: ['agent/getExternalIntakeStatus', 'agent/externalIntakeStatus', 'externalIntake/status', 'intake/status'],
	connectorScheduleStatusRequests: ['agent/getConnectorStatus', 'agent/connectorStatus', 'connector/status', 'agent/getScheduledAgentStatus', 'schedule/status', 'automation/status', 'headless/status'],
	extensionInstallStatusRequests: ['agent/getExtensionInstallStatus', 'agent/extensionInstallStatus', 'extension/installStatus', 'vsix/status', 'package/status'],
	backendLaunchStatusRequests: ['agent/getBackendLaunchStatus', 'agent/backendLaunchStatus', 'backend/launchStatus', 'bridge/launchStatus'],
	protocolStatusRequests: ['agent/getProtocolStatus', 'agent/protocolStatus', 'protocol/status', 'bridge/status'],
	protocolDiagnostics: true,
	clientStateRequests: true,
	capabilityMatrixRequests: ['agent/getCapabilityMatrix', 'agent/getParityMatrix', 'capability/status', 'parity/status'],
	toolSchemaRequests: ['agent/getToolSchemas', 'agent/toolSchemas', 'tools/list', 'tools/schema', 'tool/schema'],
	toolCallStatusRequests: ['agent/validateToolCall', 'agent/toolCallStatus', 'tool/callStatus', 'tools/callStatus'],
	parallelStatusRequests: ['agent/getParallelStatus', 'agent/parallelStatus', 'parallel/status'],
	parallelWorktreeStatusRequests: ['agent/getParallelWorktreeStatus', 'agent/parallelWorktreeStatus', 'parallel/worktreeStatus', 'worktree/status'],
	parallelLaneExecutionStatusRequests: ['agent/getParallelLaneExecutionStatus', 'agent/parallelLaneExecutionStatus', 'parallel/laneExecutionStatus', 'parallel/dispatchStatus'],
	parallelDispatchPlanRequests: ['agent/getParallelDispatchPlan', 'agent/parallelDispatchPlan', 'parallel/dispatchPlan', 'parallel/dispatchQueue', 'parallel/laneDispatchPlan'],
	parallelLaneDispatchRequests: ['agent/dispatchParallelLane', 'agent/parallel/dispatchLane', 'parallel/dispatchLane', 'parallel/laneDispatch', 'vibecodex/dispatchParallelLane'],
	parallelWorktreeLifecycleRequests: ['agent/prepareParallelWorktrees', 'agent/cleanupParallelWorktrees', 'agent/parallel/prepareWorktrees', 'agent/parallel/cleanupWorktrees', 'parallel/prepareWorktrees', 'parallel/cleanupWorktrees'],
	parallelWorktreeLifecycleApproval: true,
	parallelReviewStatusRequests: ['agent/getParallelReviewStatus', 'agent/parallelReviewStatus', 'parallel/reviewStatus', 'parallel/judgeStatus'],
	parallelMergeStatusRequests: ['agent/getParallelMergeStatus', 'agent/parallelMergeStatus', 'parallel/mergeStatus'],
	parallelAgents: {
		maxThreads: 8,
		isolatedWorktrees: true,
		statusRequests: ['agent/getParallelStatus', 'agent/parallelStatus', 'parallel/status'],
		worktreeStatusRequests: ['agent/getParallelWorktreeStatus', 'agent/parallelWorktreeStatus', 'parallel/worktreeStatus', 'worktree/status'],
		laneExecutionStatusRequests: ['agent/getParallelLaneExecutionStatus', 'agent/parallelLaneExecutionStatus', 'parallel/laneExecutionStatus', 'parallel/dispatchStatus'],
		dispatchPlanRequests: ['agent/getParallelDispatchPlan', 'agent/parallelDispatchPlan', 'parallel/dispatchPlan', 'parallel/dispatchQueue', 'parallel/laneDispatchPlan'],
		dispatchLaneRequests: ['agent/dispatchParallelLane', 'agent/parallel/dispatchLane', 'parallel/dispatchLane', 'parallel/laneDispatch', 'vibecodex/dispatchParallelLane'],
		worktreeLifecycleRequests: ['agent/prepareParallelWorktrees', 'agent/cleanupParallelWorktrees', 'parallel/prepareWorktrees', 'parallel/cleanupWorktrees'],
		worktreeLifecycleApproval: true,
		reviewStatusRequests: ['agent/getParallelReviewStatus', 'agent/parallelReviewStatus', 'parallel/reviewStatus', 'parallel/judgeStatus'],
		mergeStatusRequests: ['agent/getParallelMergeStatus', 'agent/parallelMergeStatus', 'parallel/mergeStatus'],
		judgeBeforeMerge: true,
	},
	finalReview: true,
} as const satisfies VibeCodexAgentHandshakeCapabilities;

export type VibeCodexHandshakeCapabilityKey = keyof typeof vibeCodexAgentHandshakeCapabilities;

export type VibeCodexAgentInitializeParams = {
	readonly client: 'vibecodex.agent';
	readonly version: 1;
	readonly transports: readonly VibeCodexSupportedTransport[];
	readonly capabilities: typeof vibeCodexAgentHandshakeCapabilities;
};

export interface VibeCodexHandshakeCapabilityGroupDefinition {
	readonly id: string;
	readonly title: string;
	readonly critical: boolean;
	readonly capabilities: readonly VibeCodexHandshakeCapabilityKey[];
	readonly methods: readonly string[];
}

export const vibeCodexHandshakeCapabilityGroups: readonly VibeCodexHandshakeCapabilityGroupDefinition[] = [
	{
		id: 'visualPlanning',
		title: 'Visual Planning',
		critical: true,
		capabilities: ['visualPlanning', 'planRevisionEditing', 'planValidationRequests', 'planEditStatusRequests', 'planStatusRequests', 'planCanvasStatusRequests', 'planFocusStatusRequests', 'planFocusEvents', 'inlinePromptStatusRequests'],
		methods: ['agent/submitPlan', 'agent/updatePlan', 'agent/validatePlan', 'agent/validatePlanEdit', 'agent/getPlanStatus', 'agent/getPlanCanvasStatus', 'agent/getPlanFocusStatus', 'agent/planFocusChanged'],
	},
	{
		id: 'contextAndGuidance',
		title: 'Context, Rules, and Guidance',
		critical: true,
			capabilities: ['workspaceReadTools', 'workspaceReadStatusRequests', 'contextRefreshRequests', 'contextStatusRequests', 'contextIndexStatusRequests', 'symbolIndexStatusRequests', 'gitContextTools', 'workspaceSandboxStatusRequests', 'guidanceStatusRequests', 'guidanceSelectionRequests', 'rulesSkillsHooksContext', 'memoryBankContext'],
		methods: ['read_file', 'search_files', 'agent/getWorkspaceReadStatus', 'agent/refreshContext', 'agent/getContextStatus', 'agent/getGuidanceStatus'],
	},
	{
		id: 'approvalAndDiff',
		title: 'Approvals, Diff Review, and Rollback',
		critical: true,
		capabilities: ['approvalGates', 'approvalStatusRequests', 'actionApprovalStatusRequests', 'diffReview', 'diffValidationRequests', 'diffReviewStatusRequests', 'diffFileStatusRequests', 'diffReapplyStatusRequests', 'checkpointStatusRequests', 'rollbackRestoreStatusRequests', 'taskRollbackNotifications', 'reviewFirstEditTools', 'checkpointedDeleteFile'],
		methods: ['agent/requestToolApproval', 'agent/getActionApprovalStatus', 'agent/approvePlan', 'agent/validateDiff', 'agent/getDiffReviewStatus', 'agent/getCheckpointStatus', 'agent/getRollbackRestoreStatus'],
	},
	{
		id: 'terminalAndVerification',
		title: 'Terminal, Diagnostics, and Verification',
		critical: true,
		capabilities: ['terminalEvidence', 'terminalResultNotifications', 'terminalCommandValidationRequests', 'terminalOutputRequests', 'terminalInsightStatusRequests', 'terminalRemediationStatusRequests', 'terminalOutputStreaming', 'terminalControlRequests', 'terminalInterruptRetry', 'verificationEvidence', 'executionGateStatusRequests', 'acceptanceCriteriaStatusRequests', 'verificationStatusRequests', 'smokeBenchmarkStatusRequests', 'deliveryBarStatusRequests', 'taskCompletionStatusRequests', 'finalReviewStatusRequests', 'workflowStatusRequests', 'happyPathStatusRequests', 'diagnosticsEvidence', 'taskCompletionGate', 'commitHandoffStatusRequests', 'autoCommitStatusRequests', 'finalReview'],
		methods: ['agent/validateCommand', 'agent/terminalResult', 'agent/getAcceptanceCriteriaStatus', 'agent/getVerificationStatus', 'agent/getSmokeBenchmarkStatus', 'agent/getDeliveryBarStatus', 'agent/getWorkflowStatus', 'agent/getHappyPathStatus'],
	},
	{
		id: 'attentionAndSafety',
		title: 'Attention, Timeline, and Safety',
		critical: true,
		capabilities: ['toolTimelineStatusRequests', 'notificationStatusRequests', 'modeStatusRequests', 'safetyStatusRequests', 'redactionStatusRequests'],
		methods: ['agent/getToolTimelineStatus', 'agent/getNotificationStatus', 'agent/getModeStatus', 'agent/getSafetyStatus', 'agent/getRedactionStatus'],
	},
	{
		id: 'parallelAgents',
		title: 'Parallel Agents and Worktrees',
		critical: false,
		capabilities: ['parallelAgents', 'parallelStatusRequests', 'parallelWorktreeStatusRequests', 'parallelLaneExecutionStatusRequests', 'parallelDispatchPlanRequests', 'parallelLaneDispatchRequests', 'parallelWorktreeLifecycleRequests', 'parallelWorktreeLifecycleApproval', 'parallelReviewStatusRequests', 'parallelMergeStatusRequests'],
		methods: ['agent/getParallelStatus', 'agent/getParallelWorktreeStatus', 'agent/getParallelLaneExecutionStatus', 'agent/getParallelDispatchPlan', 'agent/dispatchParallelLane', 'agent/prepareParallelWorktrees', 'agent/cleanupParallelWorktrees', 'agent/getParallelReviewStatus', 'agent/getParallelMergeStatus'],
	},
	{
		id: 'providersAndSchemas',
		title: 'Providers, Tool Schemas, and Protocol Diagnostics',
		critical: true,
		capabilities: ['providerSelection', 'providerCatalogRequests', 'providerStatusRequests', 'providerModeRouteStatus', 'extensionInstallStatusRequests', 'backendLaunchStatusRequests', 'protocolStatusRequests', 'protocolDiagnostics', 'clientStateRequests', 'capabilityMatrixRequests', 'toolSchemaRequests', 'toolCallStatusRequests'],
		methods: ['agent/getProviderStatus', 'agent/getExtensionInstallStatus', 'agent/getBackendLaunchStatus', 'agent/getProtocolStatus', 'agent/getClientState', 'agent/getToolSchemas', 'agent/validateToolCall'],
	},
	{
		id: 'clineSurfaces',
		title: 'Cline-Compatible Surfaces',
		critical: false,
				capabilities: ['userInputRequests', 'userInputStatusRequests', 'transcriptStreaming', 'taskSummaryRequests', 'sessionHistory', 'sessionHistoryStatusRequests', 'sessionExportRequests', 'taskDelegationRequests', 'taskBoardStatusRequests', 'taskStartStatusRequests', 'taskIntakeStatusRequests', 'externalIntakeStatusRequests', 'connectorScheduleStatusRequests', 'slashCommandStatusRequests'],
				methods: ['ask_question', 'plan_mode_respond', 'agent/getUserInputStatus', 'new_task', 'agent/getTaskBoardStatus', 'agent/getTaskStartStatus', 'agent/getConnectorStatus', 'agent/getScheduledAgentStatus', 'agent/getSlashCommandStatus'],
			},
	{
		id: 'externalTools',
		title: 'Web, Browser, MCP, Hooks, and Preview',
		critical: false,
		capabilities: ['webFetch', 'webSearch', 'browserOpenNavigate', 'browserStatusRequests', 'browserActionStatusRequests', 'previewStatusRequests', 'previewStartRequests', 'previewStartTools', 'mcpStatusRequests', 'mcpApproval', 'hookExecution'],
		methods: ['fetch_web', 'browser_action', 'agent/getBrowserStatus', 'agent/getBrowserActionStatus', 'agent/getMcpStatus', 'agent/startPreview'],
	},
];

export function createAgentInitializeParams(): VibeCodexAgentInitializeParams {
	return {
		client: 'vibecodex.agent',
		version: 1,
		transports: vibeCodexSupportedTransports,
		capabilities: vibeCodexAgentHandshakeCapabilities,
	};
}
