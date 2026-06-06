/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { acceptanceCriteriaStatusSummary, createAcceptanceCriteriaStatusResponse, normalizeAcceptanceCriteriaStatusRequest, type VibeCodexAcceptanceCriteriaStatusRequest, type VibeCodexAcceptanceCriteriaStatusResponse } from './acceptanceCriteriaStatusProtocol';
import { actionApprovalStatusSummary, createActionApprovalStatusResponse, normalizeActionApprovalStatusRequest, type VibeCodexActionApprovalStatusRequest, type VibeCodexActionApprovalStatusResponse } from './actionApprovalStatusProtocol';
import { approvalStatusSummary, createApprovalStatusResponse, normalizeApprovalStatusRequest, type VibeCodexApprovalStatusRequest, type VibeCodexApprovalStatusResponse } from './approvalStatusProtocol';
import { autoCommitStatusSummary, createAutoCommitStatusResponse, normalizeAutoCommitStatusRequest, type VibeCodexAutoCommitStatusRequest, type VibeCodexAutoCommitStatusResponse } from './autoCommitStatusProtocol';
import { VibeCodexAutoApproveConfig, autoApproveSummary, defaultAutoApproveConfig, shouldAutoApproveApproval, shouldAutoApproveBrowser, shouldAutoApproveMcp } from './autoApprove';
import { VibeCodexBackendTranscriptMessage, backendTranscriptMessageSummary, createBackendTranscriptAck, normalizeBackendTranscriptMessage } from './backendMessageProtocol';
import { backendLaunchStatusSummary, createBackendLaunchStatusResponse, normalizeBackendLaunchStatusRequest, type VibeCodexBackendLaunchConfig, type VibeCodexBackendLaunchStatusRequest, type VibeCodexBackendLaunchStatusResponse } from './backendLaunchStatusProtocol';
import { VibeCodexBrowserActionRequest, createBrowserActionResponse, normalizeBrowserActionRequest } from './browserActionProtocol';
import { browserActionStatusSummary, createBrowserActionEvidenceEvent, createBrowserActionStatusResponse, normalizeBrowserActionStatusRequest, type VibeCodexBrowserActionEvidenceEvent, type VibeCodexBrowserActionStatusRequest, type VibeCodexBrowserActionStatusResponse } from './browserActionStatusProtocol';
import { browserStatusSummary, createBrowserStatusResponse, normalizeBrowserStatusRequest, type VibeCodexBrowserStatusRequest, type VibeCodexBrowserStatusResponse } from './browserStatusProtocol';
import { VibeCodexCapabilityMatrixResponse, capabilityMatrixSummary, createCapabilityMatrixResponse, normalizeCapabilityMatrixRequest } from './capabilityMatrixProtocol';
import { checkpointStatusSummary, createCheckpointStatusResponse, normalizeCheckpointStatusRequest, type VibeCodexCheckpointStatusRequest, type VibeCodexCheckpointStatusResponse } from './checkpointStatusProtocol';
import { VibeCodexClientStateRequest, clientStateRequestSummary, normalizeClientStateRequest } from './clientStateProtocol';
import { chatTabsSummary, createChatTabs } from './chatTabs';
import { codeDefinitionSummary, normalizeCodeDefinitionRequest, performCodeDefinitionRequest } from './codeDefinitionTools';
import { VibeCodexCommandPermissionPolicy, commandPermissionPromptBlock, commandPermissionSummary, evaluateCommandPermission, normalizeCommandPermissionPolicy } from './commandPermissions';
import { VibeCodexCommitHandoff, createCommitHandoff } from './commitHandoff';
import { commitHandoffStatusSummary, createCommitHandoffStatusResponse, normalizeCommitHandoffStatusRequest, type VibeCodexCommitHandoffStatusRequest, type VibeCodexCommitHandoffStatusResponse } from './commitHandoffStatusProtocol';
import { VibeCodexContextPack, collectVibeCodexContext, contextPackForPrompt, summarizeContextPack } from './contextEngine';
import { contextIndexStatusSummary, createContextIndexStatusResponse, normalizeContextIndexStatusRequest, type VibeCodexContextIndexStatusRequest, type VibeCodexContextIndexStatusResponse } from './contextIndexStatusProtocol';
import { contextRefreshSummary, createContextRefreshResponse, normalizeContextRefreshRequest } from './contextRefreshProtocol';
import { contextStatusSummary, createContextStatusResponse, normalizeContextStatusRequest, type VibeCodexContextStatusRequest, type VibeCodexContextStatusResponse } from './contextStatusProtocol';
import { VibeCodexCustomModeCatalog, collectCustomModeCatalog, customModeCatalogPromptBlock, customModeCatalogSummary } from './customModes';
import { createDeliveryBarState } from './deliveryBar';
import { createDeliveryBarStatusResponse, deliveryBarStatusSummary, normalizeDeliveryBarStatusRequest, type VibeCodexDeliveryBarStatusRequest, type VibeCodexDeliveryBarStatusResponse } from './deliveryBarStatusProtocol';
import { VibeCodexDiagnosticsSnapshot, collectDiagnosticsSnapshot, diagnosticsBaselineEvidence, diagnosticsBaselineStatus, diagnosticsSnapshotPromptBlock, diagnosticsSnapshotSummary } from './diagnosticsEvidence';
import { diagnosticsToolSummary, normalizeDiagnosticsRequest, performDiagnosticsRequest } from './diagnosticsTools';
import { connectorScheduleStatusSummary, createConnectorScheduleStatusResponse, normalizeConnectorScheduleStatusRequest, type VibeCodexConnectorScheduleStatusResponse } from './connectorScheduleStatusProtocol';
import { VibeCodexDiffPreviewProvider } from './diffPreview';
import { createDiffFileStatusResponse, diffFileStatusSummary, normalizeDiffFileStatusRequest, type VibeCodexDiffFileStatusRequest, type VibeCodexDiffFileStatusResponse } from './diffFileStatusProtocol';
import { createDiffReapplyStatusResponse, diffReapplyStatusSummary, normalizeDiffReapplyStatusRequest, type VibeCodexDiffReapplyStatusRequest, type VibeCodexDiffReapplyStatusResponse } from './diffReapplyStatusProtocol';
import { createDiffReviewStatusResponse, diffReviewStatusSummary, normalizeDiffReviewStatusRequest, type VibeCodexDiffReviewStatusRequest, type VibeCodexDiffReviewStatusResponse } from './diffReviewStatusProtocol';
import { createDiffValidationResponse, diffValidationSummary, normalizeDiffValidationRequest } from './diffValidationProtocol';
import { VibeCodexDocsContext, collectDocsContext, docsContextPromptBlock, docsContextSummary } from './docsContext';
import { createExecutionGateStatusResponse, executionGateStatusSummary, normalizeExecutionGateStatusRequest, type VibeCodexExecutionGateStatusResponse } from './executionGateStatusProtocol';
import { VibeCodexExecutionAuthorization, attachExecutionAuthorization, authorizationMatchesPlan, createExecutionAuthorization, executionAuthorizationSummary, requiresApprovalAuthorization, requiresBrowserAuthorization, requiresMcpAuthorization, requiresWebFetchAuthorization } from './executionAuthorization';
import { ExternalBridgeStatus, JsonRpcFraming, JsonRpcId, JsonRpcMessage, VibeCodexExternalBridge } from './externalBridge';
import { createExternalIntakeStatusResponse, externalIntakeStatusSummary, normalizeExternalIntakeStatusRequest, type VibeCodexExternalIntakeStatusResponse } from './externalIntakeStatusProtocol';
import { VibeCodexExternalTaskIntake, externalTaskIntakePromptBlock, externalTaskIntakeSummary, normalizeExternalTaskUri } from './externalTaskIntake';
import { createExtensionInstallStatusResponse, extensionInstallStatusSummary, normalizeExtensionInstallStatusRequest, type VibeCodexExtensionInstallStatusInput, type VibeCodexExtensionInstallStatusRequest, type VibeCodexExtensionInstallStatusResponse } from './extensionInstallStatusProtocol';
import { ExternalApprovalCard, ExternalDiffReview, createApprovalResponse, createDiffReviewResponse, createEditToolDiffResponse, isLocalDeleteFileApproval, isLocalParallelLaneDispatchApproval, isLocalParallelWorktreeApproval, isLocalTerminalToolApproval, normalizeApprovalRequest, normalizeDiffReview, normalizeEditToolDiffReview, normalizeTerminalRunRequest, withDiffFileDecision } from './executionProtocol';
import { VibeCodexFinalReviewState, createFinalReviewState, finalReviewPromptBlock, finalReviewSignature } from './finalReview';
import { gitContextToolSummary, normalizeGitContextRequest, performGitContextTool } from './gitContextTools';
import { createGuidanceSelectionResponse, guidanceSelectionSummary, normalizeGuidanceSelectionRequest } from './guidanceSelectionProtocol';
import { createGuidanceStatusResponse, guidanceStatusSummary, normalizeGuidanceStatusRequest, type VibeCodexGuidanceStatusRequest, type VibeCodexGuidanceStatusResponse } from './guidanceStatusProtocol';
import { createHappyPathStatusResponse, happyPathStatusSummary, normalizeHappyPathStatusRequest, type VibeCodexHappyPathStatusRequest, type VibeCodexHappyPathStatusResponse } from './happyPathStatusProtocol';
import { VibeCodexHookActionRequest, createHookActionResponse, normalizeHookActionRequest } from './hookActionProtocol';
import { VibeCodexInlinePromptSession, createInlinePromptSession } from './inlinePromptSession';
import { createInlinePromptStatusResponse, inlinePromptStatusSummary, normalizeInlinePromptStatusRequest, type VibeCodexInlinePromptStatusRequest, type VibeCodexInlinePromptStatusResponse } from './inlinePromptStatusProtocol';
import { languageContextSummary, normalizeLanguageContextRequest, performLanguageContextRequest } from './languageContextTools';
import { parseMermaidFlowchart } from './mermaidFlow';
import { VibeCodexMemoryBank, collectMemoryBank, memoryBankPromptBlock, memoryBankSummary } from './memoryBank';
import { VibeCodexMcpActionRequest, createMcpActionResponse, normalizeMcpActionRequest } from './mcpActionProtocol';
import { VibeCodexModePolicy, VibeCodexSensitiveAction, modeAllowsAction, modePolicyFor, modePolicyPromptBlock, modePolicySummary, normalizeVibeCodexMode } from './modePolicy';
import { createModeStatusResponse, modeStatusSummary, normalizeModeStatusRequest, type VibeCodexModeStatusRequest, type VibeCodexModeStatusResponse } from './modeStatusProtocol';
import { VibeCodexMcpCatalog, collectMcpCatalog, mcpCatalogPromptBlock, mcpCatalogSummary } from './mcpCatalog';
import { createMcpDocumentationResponse, mcpDocumentationRequestSummary, normalizeMcpDocumentationRequest } from './mcpDocumentationProtocol';
import { createMcpStatusResponse, mcpStatusSummary, normalizeMcpStatusRequest, type VibeCodexMcpStatusRequest, type VibeCodexMcpStatusResponse } from './mcpStatusProtocol';
import { VibeCodexParallelPlan, VibeCodexParallelThread, createParallelAgentPlan, parallelPlanPromptBlock, parallelPlanSummary } from './multiAgent';
import { VibeCodexParallelMergeRequest, VibeCodexParallelResult, VibeCodexParallelReview, createParallelMergeRequest, createParallelReview, normalizeParallelResultMessage, parallelReviewSummary, upsertParallelResult } from './parallelReview';
import { createParallelDispatchPlanResponse, normalizeParallelDispatchPlanRequest, parallelDispatchPlanSummary, type VibeCodexParallelDispatchPlanRequest, type VibeCodexParallelDispatchPlanResponse } from './parallelDispatchPlanProtocol';
import { VibeCodexParallelLaneDispatchRequest, createParallelLaneDispatchApprovalCard, createParallelLaneDispatchResponse, normalizeParallelLaneDispatchRequest, parallelLaneDispatchSummary } from './parallelLaneDispatchProtocol';
import { createParallelLaneExecutionStatusResponse, normalizeParallelLaneExecutionStatusRequest, parallelLaneExecutionStatusSummary, type VibeCodexParallelLaneExecutionStatusRequest, type VibeCodexParallelLaneExecutionStatusResponse } from './parallelLaneExecutionStatusProtocol';
import { createParallelMergeStatusResponse, normalizeParallelMergeStatusRequest, parallelMergeStatusSummary, type VibeCodexParallelMergeStatusRequest, type VibeCodexParallelMergeStatusResponse } from './parallelMergeStatusProtocol';
import { createParallelReviewStatusResponse, normalizeParallelReviewStatusRequest, parallelReviewStatusSummary, type VibeCodexParallelReviewStatusRequest, type VibeCodexParallelReviewStatusResponse } from './parallelReviewStatusProtocol';
import { createParallelStatusResponse, normalizeParallelStatusRequest, parallelStatusSummary, type VibeCodexParallelStatusRequest, type VibeCodexParallelStatusResponse } from './parallelStatusProtocol';
import { VibeCodexParallelWorktreeOperation, createParallelWorktreeApprovalCard, createParallelWorktreeResponse, normalizeParallelWorktreeRequest, parallelWorktreeRequestSummary } from './parallelWorktreeProtocol';
import { createParallelWorktreeStatusResponse, normalizeParallelWorktreeStatusRequest, parallelWorktreeStatusSummary, type VibeCodexParallelWorktreeStatusRequest, type VibeCodexParallelWorktreeStatusResponse } from './parallelWorktreeStatusProtocol';
import { VibeCodexWorktreeOperationResult, cleanupParallelWorktrees as cleanupParallelWorktreePlan, materializeParallelWorktrees } from './parallelWorktrees';
import { VibeCodexNotificationConfig, defaultNotificationConfig, longRunningTerminalDelayMs, normalizeNotificationConfig, shouldNotifyApproval, shouldNotifyTerminalCompletion } from './notificationPolicy';
import { createNotificationStatusResponse, normalizeNotificationStatusRequest, notificationStatusSummary, type VibeCodexNotificationStatusRequest, type VibeCodexNotificationStatusResponse } from './notificationStatusProtocol';
import { VibeCodexPlanRevisionEvent, VibeCodexPlanRevisionSnapshot, appendPlanRevision, planRevisionHistorySummary } from './planHistory';
import { applyPlanRemediation, applyPlanStepEdit, planStepEditSummary } from './planEditing';
import { planFromPlanModeResponse } from './planModeResponseAdapter';
import { createPlanEditStatusResponse, normalizePlanEditStatusRequest, planEditStatusSummary, type VibeCodexPlanEditStatusResponse } from './planEditStatusProtocol';
import { createPlanFocusStatusResponse, normalizePlanFocusStatusRequest, planFocusStatusSummary, type VibeCodexPlanFocusStatusRequest, type VibeCodexPlanFocusStatusResponse } from './planFocusStatusProtocol';
import { createPlanCanvasStatusResponse, normalizePlanCanvasStatusRequest, planCanvasStatusSummary, type VibeCodexPlanCanvasCachedGraph, type VibeCodexPlanCanvasStatusRequest, type VibeCodexPlanCanvasStatusResponse } from './planCanvasStatusProtocol';
import { VibeCodexPlan, createFallbackPlan, createPlanFeedbackHandoff, createPlanSubmissionResponse, normalizeIncomingPlan, planToPrompt, refineFallbackPlan, renderedPlanIdentity, validatePlan, type VibeCodexRenderedPlanIdentity } from './planProtocol';
import { createPlanStatusResponse, normalizePlanStatusRequest, planStatusSummary, type VibeCodexPlanStatusRequest, type VibeCodexPlanStatusResponse } from './planStatusProtocol';
import { createPlanValidationResponse, normalizePlanValidationRequest, planValidationSummary } from './planValidationProtocol';
import { VibeCodexPreviewPlan, VibeCodexPreviewTarget, collectPreviewPlan, previewPlanPromptBlock, previewPlanSummary } from './previewPlan';
import { VibeCodexPreviewStartApprovalCard, createPreviewStartApprovalCard, createPreviewStartResponse, isPreviewStartApprovalCard, normalizePreviewStartRequest, previewStartSummary, resolvePreviewStartTarget } from './previewStartProtocol';
import { createPreviewStatusResponse, normalizePreviewStatusRequest, previewStatusSummary, type VibeCodexPreviewStatusRequest, type VibeCodexPreviewStatusResponse } from './previewStatusProtocol';
import { VibeCodexProviderRuntimeConfig, chooseModeModel, chooseModel, chooseProvider, clearProviderCredentials as clearStoredProviderCredentials, configureProvider as configureStoredProvider, loginProvider, providerCatalogEntries, providerDisplayConfig, providerModeRouteConfigs, providerPromptBlock, providerRuntimeConfig } from './providerConfig';
import { createProviderCatalogResponse, normalizeProviderCatalogRequest, providerCatalogSummary, type VibeCodexProviderCatalogRequest, type VibeCodexProviderCatalogResponse } from './providerCatalogProtocol';
import { createProviderStatusResponse, normalizeProviderStatusRequest, providerStatusSummary, type VibeCodexProviderStatusRequest, type VibeCodexProviderStatusResponse } from './providerStatusProtocol';
import { VibeCodexProtocolDirection, VibeCodexProtocolEvent, appendProtocolEvent, createProtocolEvent } from './protocolDiagnostics';
import { createProtocolStatusResponse, normalizeProtocolStatusRequest, protocolStatusSummary, type VibeCodexProtocolStatusRequest, type VibeCodexProtocolStatusResponse, type VibeCodexProtocolTransportConfig } from './protocolStatusProtocol';
import { createRedactionStatusResponse, normalizeRedactionStatusRequest, redactionStatusSummary, type VibeCodexRedactionStatusResponse } from './redactionStatusProtocol';
import { createRuntimeReadinessStatusResponse, normalizeRuntimeReadinessStatusRequest, runtimeReadinessSummary, type VibeCodexRuntimeReadinessStatusRequest, type VibeCodexRuntimeReadinessStatusResponse } from './runtimeReadinessStatusProtocol';
import { VibeCodexRuleProposal, createRuleProposal, ruleProposalPromptBlock, ruleProposalSummary } from './ruleProposal';
import { createRollbackRestoreStatusResponse, normalizeRollbackRestoreStatusRequest, rollbackRestoreStatusSummary, type VibeCodexRollbackRestoreStatusRequest, type VibeCodexRollbackRestoreStatusResponse } from './rollbackRestoreStatusProtocol';
import { VibeCodexSessionSnapshot, createSessionSnapshot, exportSessionSnapshot, loadSessionHistory, saveSessionSnapshot, updateSessionSnapshot } from './sessionHistory';
import { createSessionExportResponse, normalizeSessionExportRequest, sessionExportSummary, type VibeCodexSessionExportRequest, type VibeCodexSessionExportResponse } from './sessionExportProtocol';
import { createSessionHistoryStatusResponse, normalizeSessionHistoryStatusRequest, sessionHistoryStatusSummary, type VibeCodexSessionHistoryStatusRequest, type VibeCodexSessionHistoryStatusResponse } from './sessionHistoryStatusProtocol';
import { VibeCodexSessionRecall, createSessionRecall, sessionRecallPromptBlock, sessionRecallSummary } from './sessionRecall';
import { redactSensitiveText } from './secretFilters';
import { createSafetyStatusResponse, normalizeSafetyStatusRequest, safetyStatusSummary, type VibeCodexSafetyStatusRequest, type VibeCodexSafetyStatusResponse } from './safetyStatusProtocol';
import { VibeCodexSlashCommandContext, VibeCodexSlashCommandSuggestion, VibeCodexSlashWorkflowContent, builtinSlashCommandSuggestions, createWorkflowSlashSuggestions, parseSlashCommandPrompt, slashCommandPromptBlock, slashCommandSummary } from './slashCommands';
import { createSlashCommandStatusResponse, normalizeSlashCommandStatusRequest, slashCommandStatusSummary } from './slashCommandStatusProtocol';
import { VibeCodexSmokeBenchmarkState, createSmokeBenchmarkState } from './smokeBenchmark';
import { createSmokeBenchmarkStatusResponse, normalizeSmokeBenchmarkStatusRequest, smokeBenchmarkStatusSummary, type VibeCodexSmokeBenchmarkStatusRequest, type VibeCodexSmokeBenchmarkStatusResponse } from './smokeBenchmarkStatusProtocol';
import { createSymbolIndexStatusResponse, normalizeSymbolIndexStatusRequest, symbolIndexStatusSummary, type VibeCodexSymbolIndexStatusRequest, type VibeCodexSymbolIndexStatusResponse } from './symbolIndexStatusProtocol';
import { VibeCodexTaskCompletionRequest, VibeCodexTaskCompletionResponse, createTaskCompletionResponse, normalizeTaskCompletionRequest, taskCompletionSummary } from './taskCompletionProtocol';
import { createTaskCompletionStatusResponse, normalizeTaskCompletionStatusRequest, taskCompletionStatusSummary, type VibeCodexTaskCompletionStatusRequest, type VibeCodexTaskCompletionStatusResponse } from './taskCompletionStatusProtocol';
import { VibeCodexTaskBoard, VibeCodexTaskBoardStatus, archiveTaskBoardCard, createEmptyTaskBoard, queueTaskBoardCard, sanitizeTaskBoard, taskBoardCardReadiness, taskBoardPromptBlock, taskBoardStorageKey, taskBoardSummary, updateTaskBoardCardStatus } from './taskBoard';
import { createTaskBoardStatusResponse, normalizeTaskBoardStatusRequest, taskBoardStatusSummary, type VibeCodexTaskBoardStatusRequest, type VibeCodexTaskBoardStatusResponse } from './taskBoardStatusProtocol';
import { VibeCodexDelegatedTaskRequest, createTaskDelegationResponse, normalizeTaskDelegationRequest } from './taskDelegationProtocol';
import { createTaskStartStatusResponse, normalizeTaskStartStatusRequest, taskStartStatusSummary, type VibeCodexTaskStartStatusResponse } from './taskStartStatusProtocol';
import { VibeCodexTaskSummaryInput, createTaskSummaryResponse, normalizeTaskSummaryRequest, taskSummaryRequestSummary } from './taskSummaryProtocol';
import { VibeCodexTerminalInsight, createTerminalInsight, terminalInsightPromptBlock, terminalInsightSignature } from './terminalInsight';
import { createTerminalInsightStatusResponse, normalizeTerminalInsightStatusRequest, terminalInsightStatusSummary, type VibeCodexTerminalInsightStatusRequest, type VibeCodexTerminalInsightStatusResponse } from './terminalInsightStatusProtocol';
import { VibeCodexTerminalRemediationEvent, createTerminalRemediationEvent, createTerminalRemediationStatusResponse, normalizeTerminalRemediationStatusRequest, terminalRemediationStatusSummary, type VibeCodexTerminalRemediationStatusRequest, type VibeCodexTerminalRemediationStatusResponse } from './terminalRemediationStatusProtocol';
import { createTerminalCommandValidationResponse, normalizeTerminalCommandValidationRequest, terminalCommandValidationSummary, type VibeCodexTerminalCommandValidationRequest, type VibeCodexTerminalCommandValidationResponse } from './terminalCommandValidationProtocol';
import { VibeCodexTerminalControlRequest, createTerminalControlResponse, normalizeTerminalControlRequest, terminalControlSummary, type VibeCodexTerminalControlResponse } from './terminalControlProtocol';
import { VibeCodexTerminalOutputStreamState, createTerminalOutputResponse, createTerminalOutputStreamNotification, normalizeTerminalOutputRequest, terminalOutputSummary, type VibeCodexTerminalOutputRequest, type VibeCodexTerminalOutputResponse } from './terminalOutputProtocol';
import { VibeCodexCapturedTerminalRun, VibeCodexTerminalRunner } from './terminalRunner';
import { VibeCodexToolCatalog, createToolCatalog, toolCatalogPromptBlock, toolCatalogSignature, toolCatalogSummary } from './toolCatalog';
import { createToolCallStatusResponse, normalizeToolCallStatusRequest, toolCallStatusSummary } from './toolCallStatusProtocol';
import { VibeCodexToolSchemaResponse, createToolSchemaManifestPayload, createToolSchemaResponse, normalizeToolSchemaRequest, toolSchemaSummary } from './toolSchemaProtocol';
import { createToolTimelineStatusResponse, normalizeToolTimelineStatusRequest, toolTimelineStatusSummary, type VibeCodexToolTimelineStatusRequest, type VibeCodexToolTimelineStatusResponse } from './toolTimelineStatusProtocol';
import { VibeCodexTranscriptEvent, VibeCodexTranscriptKind, VibeCodexTranscriptStatus, appendTranscriptEvent, createTranscriptEvent, upsertTranscriptEvent } from './transcript';
import { VibeCodexUserInputRequest, createUserInputResponse, normalizeUserInputRequest, userInputRequestSummary } from './userInputProtocol';
import { createUserInputStatusResponse, normalizeUserInputStatusRequest, userInputStatusSummary, type VibeCodexUserInputStatusRequest, type VibeCodexUserInputStatusResponse } from './userInputStatusProtocol';
import { VibeCodexVerificationPlan, VibeCodexVerificationStatus, collectVerificationPlan, verificationPlanPromptBlock, verificationPlanSummary, withVerificationCheckStatus } from './verificationPlan';
import { createVerificationStatusResponse, normalizeVerificationStatusRequest, verificationStatusSummary, type VibeCodexVerificationStatusRequest, type VibeCodexVerificationStatusResponse } from './verificationStatusProtocol';
import { VibeCodexWebFetchRequest, createWebFetchResponse, normalizeWebFetchRequest, performWebFetch } from './webFetchProtocol';
import { createWorkflowStatusResponse, normalizeWorkflowStatusRequest, workflowStatusSummary, type VibeCodexWorkflowStatusRequest, type VibeCodexWorkflowStatusResponse } from './workflowStatusProtocol';
import { createWorkspaceSandboxStatusResponse, normalizeWorkspaceSandboxStatusRequest, workspaceSandboxStatusSummary, type VibeCodexWorkspaceSandboxStatusResponse } from './workspaceSandboxStatusProtocol';
import { normalizeWorkspaceReadToolRequest, performWorkspaceReadTool, workspaceReadToolSummary } from './workspaceReadTools';
import { createWorkspaceReadEvidenceEvent, createWorkspaceReadStatusResponse, normalizeWorkspaceReadStatusRequest, workspaceReadStatusSummary, type VibeCodexWorkspaceReadEvidenceEvent, type VibeCodexWorkspaceReadStatusRequest, type VibeCodexWorkspaceReadStatusResponse } from './workspaceReadStatusProtocol';
import { VibeCodexGitCheckpoint, createWorkspaceGitCheckpoint, gitCheckpointSummary } from './workspaceGitCheckpoint';
import { collectWorkspaceIgnorePolicy } from './workspaceIgnore';
import { ExternalPatchCheckpoint, applyExternalDiffFile, applyExternalDiffFilesAtomically, assertWorkspaceUriHasNoSymlinkTraversal, deleteExternalWorkspaceFile, resolveWorkspaceFileUri, restoreExternalPatchCheckpoint } from './workspacePatch';
import { VibeCodexWorkspaceGuidance, collectWorkspaceGuidance, workspaceGuidancePromptBlock, workspaceGuidanceSummary } from './workspaceGuidance';

declare function require(name: string): unknown;
declare function setTimeout(handler: () => void, timeout?: number): number;
declare function clearTimeout(handle: number): void;
declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

const path = require('path') as {
	readonly sep: string;
	readonly isAbsolute: (value: string) => boolean;
	readonly resolve: (...segments: string[]) => string;
};
const process = require('process') as { readonly env: Record<string, string | undefined> };

const extensionViewId = 'vibecodex-agent-extension-view';
const maxMentionSuggestionFiles = 80;
const maxMentionSuggestionFolders = 24;
const mentionSuggestionExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const slashWorkflowInclude = '{.cline/workflows/**/*,.clinerules/workflows/**/*,.vibecodex/workflows/**/*,.cursor/rules/workflows/**/*,.github/workflows/vibecodex-*}';
const maxSlashWorkflowSuggestions = 40;
const maxSlashWorkflowContentBytes = 16000;
const terminalOutputStreamMinIntervalMs = 500;
const terminalOutputStreamMinDeltaChars = 256;

interface VibeCodexRenderedPlanActionPayload {
	readonly taskId?: unknown;
	readonly revision?: unknown;
	readonly planHash?: unknown;
}

const nativeCommands = {
	openAgent: 'vibecodex.openAgent',
	login: 'vibecodex.login',
	configureProvider: 'vibecodex.configureProvider',
	selectProvider: 'vibecodex.selectProvider',
	selectModel: 'vibecodex.selectModel',
	selectModeModel: 'vibecodex.selectModeModel',
	clearProviderCredentials: 'vibecodex.clearProviderCredentials',
	inlinePrompt: 'vibecodex.inlinePrompt',
	planMode: 'vibecodex.planMode',
	askMode: 'vibecodex.askMode',
	manualMode: 'vibecodex.manualMode',
	actMode: 'vibecodex.actMode',
	agentMode: 'vibecodex.agentMode',
	debugMode: 'vibecodex.debugMode',
	reviewMode: 'vibecodex.reviewMode',
	customMode: 'vibecodex.customMode'
} as const;

const extensionCommands = {
	openAgent: 'vibecodex.extension.openAgent',
	login: 'vibecodex.extension.login',
	configureProvider: 'vibecodex.extension.configureProvider',
	selectProvider: 'vibecodex.extension.selectProvider',
	selectModel: 'vibecodex.extension.selectModel',
	selectModeModel: 'vibecodex.extension.selectModeModel',
	clearProviderCredentials: 'vibecodex.extension.clearProviderCredentials',
	inlinePrompt: 'vibecodex.extension.inlinePrompt',
	planMode: 'vibecodex.extension.planMode',
	askMode: 'vibecodex.extension.askMode',
	manualMode: 'vibecodex.extension.manualMode',
	actMode: 'vibecodex.extension.actMode',
	agentMode: 'vibecodex.extension.agentMode',
	debugMode: 'vibecodex.extension.debugMode',
	reviewMode: 'vibecodex.extension.reviewMode',
	customMode: 'vibecodex.extension.customMode',
	runInTerminal: 'vibecodex.extension.runInTerminal',
	connectBackend: 'vibecodex.extension.connectBackend',
	disconnectBackend: 'vibecodex.extension.disconnectBackend',
	restartBackend: 'vibecodex.extension.restartBackend'
} as const;

interface VibeCodexMentionSuggestion {
	readonly label: string;
	readonly insertText: string;
	readonly kind: 'file' | 'folder' | 'git' | 'diagnostics' | 'terminal' | 'workspace' | 'symbols' | 'docs' | 'chat' | 'slash';
	readonly detail: string;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const nativeCommandSnapshot = new Set(await vscode.commands.getCommands(true));
	const host = new VibeCodexExtensionHost(nativeCommandSnapshot, context);
	context.subscriptions.push(host);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(extensionViewId, host));

	registerExtensionCommand(context, extensionCommands.openAgent, () => host.openAgent());
	registerExtensionCommand(context, extensionCommands.login, () => host.login());
	registerExtensionCommand(context, extensionCommands.configureProvider, () => host.configureProvider());
	registerExtensionCommand(context, extensionCommands.selectProvider, () => host.selectProvider());
	registerExtensionCommand(context, extensionCommands.selectModel, () => host.selectModel());
	registerExtensionCommand(context, extensionCommands.selectModeModel, () => host.selectModeModel());
	registerExtensionCommand(context, extensionCommands.clearProviderCredentials, () => host.clearProviderCredentials());
	registerExtensionCommand(context, extensionCommands.inlinePrompt, () => host.inlinePrompt());
	registerExtensionCommand(context, extensionCommands.planMode, () => host.runFallbackAlias(nativeCommands.planMode, []));
	registerExtensionCommand(context, extensionCommands.askMode, () => host.runFallbackAlias(nativeCommands.askMode, []));
	registerExtensionCommand(context, extensionCommands.manualMode, () => host.runFallbackAlias(nativeCommands.manualMode, []));
	registerExtensionCommand(context, extensionCommands.actMode, () => host.runFallbackAlias(nativeCommands.actMode, []));
	registerExtensionCommand(context, extensionCommands.agentMode, () => host.runFallbackAlias(nativeCommands.agentMode, []));
	registerExtensionCommand(context, extensionCommands.debugMode, () => host.runFallbackAlias(nativeCommands.debugMode, []));
	registerExtensionCommand(context, extensionCommands.reviewMode, () => host.runFallbackAlias(nativeCommands.reviewMode, []));
	registerExtensionCommand(context, extensionCommands.customMode, () => host.runFallbackAlias(nativeCommands.customMode, []));
	registerExtensionCommand(context, extensionCommands.runInTerminal, () => host.runExternalCodexTask('agent', ''));
	registerExtensionCommand(context, extensionCommands.connectBackend, () => host.connectExternalBackend());
	registerExtensionCommand(context, extensionCommands.disconnectBackend, () => host.disconnectExternalBackend());
	registerExtensionCommand(context, extensionCommands.restartBackend, () => host.restartExternalBackend());

	for (const command of Object.values(nativeCommands)) {
		if (!nativeCommandSnapshot.has(command)) {
			registerExtensionCommand(context, command, (...args: unknown[]) => host.runFallbackAlias(command, args));
		}
	}

	context.subscriptions.push(vscode.window.registerUriHandler({
		handleUri: uri => host.handleUri(uri)
	}));
}

export function deactivate(): void {
	// No background process is started by the extension wrapper.
}

function registerExtensionCommand(context: vscode.ExtensionContext, command: string, callback: (...args: unknown[]) => unknown): void {
	context.subscriptions.push(vscode.commands.registerCommand(command, callback));
}

interface VibeCodexTerminalControlStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly response?: VibeCodexTerminalControlResponse;
	readonly selectedRun?: {
		readonly id: string;
		readonly status: VibeCodexCapturedTerminalRun['status'];
		readonly commandLine: string;
		readonly cwd?: string;
		readonly reason?: string;
		readonly startedAt: number;
		readonly endedAt?: number;
		readonly exitCode?: number;
	readonly signal?: string;
	readonly proceeded?: boolean;
};
	readonly latestRunId?: string;
	readonly counts: {
		readonly total: number;
		readonly running: number;
		readonly passed: number;
		readonly failed: number;
		readonly interrupted: number;
		readonly proceeded: number;
	};
	readonly actions: {
		readonly canInspectStatus: boolean;
		readonly canInterrupt: boolean;
		readonly canRetry: boolean;
		readonly canProceed: boolean;
		readonly requiresExactPlanApproval: boolean;
		readonly requiresMutationMode: boolean;
	};
	readonly blockers: readonly string[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

interface VibeCodexTerminalOutputStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly response?: VibeCodexTerminalOutputResponse;
	readonly requestedRunId?: string;
	readonly latest: boolean;
	readonly tailChars: number;
	readonly tailLines?: number;
	readonly latestRunId?: string;
	readonly counts: {
		readonly total: number;
		readonly running: number;
		readonly completed: number;
	};
	readonly selectedRun?: {
		readonly id: string;
		readonly status: VibeCodexCapturedTerminalRun['status'];
		readonly commandLine: string;
		readonly cwd?: string;
		readonly startedAt: number;
		readonly endedAt?: number;
		readonly exitCode?: number;
		readonly signal?: string;
		readonly outputLength: number;
	};
	readonly output: {
		readonly available: boolean;
		readonly tailLength: number;
		readonly truncated: boolean;
		readonly tailPreview?: string;
	};
	readonly guardrails: readonly string[];
	readonly message: string;
}

interface VibeCodexTerminalRunRequestRecord {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly requestedAt: number;
	readonly verificationCheckId?: string;
	readonly toolName?: string;
	readonly previewTargetId?: string;
	readonly previewUrl?: string;
	readonly previewLabel?: string;
	readonly parallelTaskId?: string;
	readonly parallelThreadId?: string;
	readonly parallelBranchName?: string;
	readonly parallelWorktreePath?: string;
	readonly parallelPromptFocus?: string;
	readonly parallelResultExpectedBy?: string;
}

class VibeCodexExtensionHost implements vscode.WebviewViewProvider, vscode.Disposable {
	private view: vscode.WebviewView | undefined;
	private readonly disposables: vscode.Disposable[] = [];
	private bridge: VibeCodexExternalBridge | undefined;
	private readonly bridgeDisposables: Array<() => void> = [];
	private activePlan: VibeCodexPlan | undefined;
	private lastValidPlanCanvasGraph: VibeCodexPlanCanvasCachedGraph | undefined;
	private activeDiffReview: ExternalDiffReview | undefined;
	private executionAuthorization: VibeCodexExecutionAuthorization | undefined;
	private readonly approvalCards = new Map<string, ExternalApprovalCard>();
	private readonly browserActions = new Map<string, VibeCodexBrowserActionRequest>();
	private readonly mcpActions = new Map<string, VibeCodexMcpActionRequest>();
	private readonly webFetches = new Map<string, VibeCodexWebFetchRequest>();
	private readonly hookActions = new Map<string, VibeCodexHookActionRequest>();
	private readonly userInputRequests = new Map<string, VibeCodexUserInputRequest>();
	private readonly terminalRuns = new Map<string, VibeCodexCapturedTerminalRun>();
	private readonly terminalRunRequests = new Map<string, VibeCodexTerminalRunRequestRecord>();
	private readonly terminalRunRequestHistory = new Map<string, VibeCodexTerminalRunRequestRecord>();
	private readonly reportedParallelTerminalRuns = new Set<string>();
	private readonly proceededTerminalRuns = new Set<string>();
	private lastTerminalCommandValidationRequest: VibeCodexTerminalCommandValidationRequest | undefined;
	private lastTerminalCommandValidationResponse: VibeCodexTerminalCommandValidationResponse | undefined;
	private lastTerminalOutputRequest: VibeCodexTerminalOutputRequest | undefined;
	private readonly terminalOutputStreamStates = new Map<string, VibeCodexTerminalOutputStreamState>();
	private readonly terminalInsights = new Map<string, VibeCodexTerminalInsight>();
	private readonly terminalInsightSignatures = new Map<string, string>();
	private terminalRemediations: readonly VibeCodexTerminalRemediationEvent[] = [];
	private readonly terminalNotificationTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly longRunningTerminalNotifications = new Set<string>();
	private readonly verificationRunChecks = new Map<string, string>();
	private readonly patchCheckpoints = new Map<string, ExternalPatchCheckpoint>();
	private readonly diffPreviewProvider = new VibeCodexDiffPreviewProvider();
	private readonly terminalRunner = new VibeCodexTerminalRunner();
	private taskCheckpointId: string | undefined;
	private taskGitCheckpoint: VibeCodexGitCheckpoint | undefined;
	private lastBridgeStatus: ExternalBridgeStatus | undefined;
	private lastPrompt = '';
	private lastMode = 'agent';
	private lastSentToolCatalogSignature: string | undefined;
	private lastSentToolSchemaManifestSignature: string | undefined;
	private lastSentFinalReviewSignature: string | undefined;
	private lastModePolicy: VibeCodexModePolicy = modePolicyFor('agent');
	private lastCommandPermissionPolicy: VibeCodexCommandPermissionPolicy = normalizeCommandPermissionPolicy();
	private lastCustomModeCatalog: VibeCodexCustomModeCatalog | undefined;
	private lastSlashCommand: VibeCodexSlashCommandContext | undefined;
	private lastInlinePromptSession: VibeCodexInlinePromptSession | undefined;
	private lastContext: VibeCodexContextPack | undefined;
	private lastProvider: VibeCodexProviderRuntimeConfig | undefined;
	private lastParallelPlan: VibeCodexParallelPlan | undefined;
	private parallelResults: readonly VibeCodexParallelResult[] = [];
	private lastParallelReview: VibeCodexParallelReview | undefined;
	private lastParallelMergeRequest: VibeCodexParallelMergeRequest | undefined;
	private lastParallelMergeDiffReviewId: string | undefined;
	private planRevisionHistory: readonly VibeCodexPlanRevisionSnapshot[] = [];
	private lastVerificationPlan: VibeCodexVerificationPlan | undefined;
	private lastVerificationCriteriaKey = '';
	private lastWorkspaceGuidance: VibeCodexWorkspaceGuidance | undefined;
	private lastRuleProposal: VibeCodexRuleProposal | undefined;
	private lastSessionRecall: VibeCodexSessionRecall | undefined;
	private lastDocsContext: VibeCodexDocsContext | undefined;
	private lastMemoryBank: VibeCodexMemoryBank | undefined;
	private lastPreviewPlan: VibeCodexPreviewPlan | undefined;
	private lastMcpCatalog: VibeCodexMcpCatalog | undefined;
	private lastToolCatalog: VibeCodexToolCatalog | undefined;
	private lastDiagnosticsSnapshot: VibeCodexDiagnosticsSnapshot | undefined;
	private lastCommitHandoff: VibeCodexCommitHandoff | undefined;
	private lastTaskCompletionResponse: VibeCodexTaskCompletionResponse | undefined;
	private taskBoard: VibeCodexTaskBoard = createEmptyTaskBoard();
	private activeSessionId: string | undefined;
	private activeTaskBoardCardId: string | undefined;
	private protocolEvents: readonly VibeCodexProtocolEvent[] = [];
	private transcriptEvents: readonly VibeCodexTranscriptEvent[] = [];
	private workspaceReadEvidence: readonly VibeCodexWorkspaceReadEvidenceEvent[] = [];
	private browserActionEvidence: readonly VibeCodexBrowserActionEvidenceEvent[] = [];
	private lastPlanFocusEventKey = '';
	private lastPlanFocusEventAt = 0;

	constructor(
		private readonly nativeCommandSnapshot: ReadonlySet<string>,
		private readonly extensionContext: vscode.ExtensionContext
	) {
		this.disposables.push(this.diffPreviewProvider);
		this.disposables.push(vscode.workspace.registerTextDocumentContentProvider(VibeCodexDiffPreviewProvider.scheme, this.diffPreviewProvider));
		this.disposables.push(this.terminalRunner);
		this.disposables.push(this.terminalRunner.onDidUpdate(run => void this.handleTerminalRunUpdate(run)));
	}

	dispose(): void {
		this.bridge?.disconnect();
		for (const disposable of this.bridgeDisposables.splice(0)) {
			disposable();
		}
		for (const timer of this.terminalNotificationTimers.values()) {
			clearTimeout(timer);
		}
		this.terminalNotificationTimers.clear();
		this.longRunningTerminalNotifications.clear();
		this.proceededTerminalRuns.clear();
		for (const disposable of this.disposables.splice(0)) {
			disposable.dispose();
		}
	}

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionContext.extensionUri, 'media')],
		};
		view.webview.html = this.renderHtml(view.webview);
		this.disposables.push(view.webview.onDidReceiveMessage(message => this.handleWebviewMessage(message)));
		this.loadTaskBoard();
		void this.postProviderState();
		this.postModePolicy(this.lastModePolicy);
		this.lastCommandPermissionPolicy = this.commandPermissionPolicy();
		this.postCommandPermissionPolicy(this.lastCommandPermissionPolicy);
		this.postTerminalCommandValidationStatus();
		if (this.lastCustomModeCatalog) {
			this.postCustomModeCatalog(this.lastCustomModeCatalog);
		}
		this.postRuleProposal(this.lastRuleProposal);
		this.postGuidanceStatus();
		this.postSessionRecall(this.lastSessionRecall);
		this.postDocsContext(this.lastDocsContext);
		this.refreshToolCatalog();
		this.postSessionHistory();
		this.postProtocolDiagnostics();
			this.postExtensionInstallStatus();
			this.postBackendLaunchStatus();
			this.postProtocolStatus();
			this.postTranscript();
			this.postApprovalStatus();
			this.postActionApprovalStatus();
			this.postUserInputStatus();
			this.postContextStatus();
		this.postWorkspaceReadStatus();
		this.postContextIndexStatus();
		this.postSymbolIndexStatus();
		this.postPlanStatus();
		this.postPlanCanvasStatus();
		this.postPlanFocusStatus();
		this.postMcpStatus();
		this.postBrowserStatus();
		this.postBrowserActionStatus();
		this.postCheckpointStatus();
		this.postRollbackRestoreStatus();
		this.postDiffReviewStatus();
		this.postParallelStatus();
		this.postParallelWorktreeStatus();
		this.postParallelLaneExecutionStatus();
		this.postParallelDispatchPlan();
		this.postParallelReviewStatus();
		this.postParallelMergeStatus();
		this.postNotificationStatus();
		this.postToolTimelineStatus();
		void this.postMentionSuggestions();
		void this.postSlashCommandSuggestions();
		this.postAutoApproveState();
		if (this.lastTaskCompletionResponse) {
			this.postMessage({ type: 'taskCompletionGate', response: this.lastTaskCompletionResponse, summary: taskCompletionSummary({ method: 'restore', result: this.lastTaskCompletionResponse.result, requestedAt: Date.now() }, this.lastTaskCompletionResponse) });
		}
			for (const request of this.userInputRequests.values()) {
				this.postMessage({ type: 'userInputRequest', request });
			}
			this.postUserInputStatus();
		this.postAcceptanceCriteriaStatus();
		this.postDeliveryBar();
		this.postWorkspaceSandboxStatus();
		this.postRedactionStatus();
		this.postSafetyStatus();
		if (this.lastInlinePromptSession) {
			this.postInlinePromptSession(this.lastInlinePromptSession);
		}
		this.postInlinePromptStatus();
		if (this.lastDiagnosticsSnapshot) {
			this.postMessage({ type: 'diagnosticsEvidence', summary: diagnosticsSnapshotSummary(this.lastDiagnosticsSnapshot), snapshot: this.lastDiagnosticsSnapshot });
		}
		this.postTerminalInsights();
		this.postTerminalControlStatus();
		this.postTerminalOutputStatus();
		this.postTerminalInsightStatus();
		this.postTerminalRemediationStatus();
		this.postPreviewStatus();
	}

	async openAgent(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.openAgent)) {
			return;
		}
		await this.revealExtensionView();
		this.updateStatus('External VS Code install detected. Use Run in Terminal for Codex CLI handoff, or install the VibeCode build for the native agent bridge.');
	}

	private async revealExtensionView(): Promise<void> {
		await vscode.commands.executeCommand('workbench.view.extension.vibecodex-agent-extension-container');
	}

	async runNativeOrShowFallback(command: string, label: string): Promise<void> {
		if (await this.tryRunNative(command)) {
			return;
		}
		this.updateStatus(`${label} needs the native VibeCode host. External installs can configure Codex CLI with vibeCodex.extension.codexCommand.`);
		await this.openAgent();
	}

	async login(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.login)) {
			return;
		}
		const config = await loginProvider(this.extensionContext.secrets);
		if (config) {
			this.lastProvider = config;
			this.postProvider(config);
			this.updateStatus(`Stored ${config.label} credentials in VS Code SecretStorage.`);
		}
	}

	async configureProvider(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.configureProvider)) {
			return;
		}
		const config = await configureStoredProvider(this.extensionContext.secrets);
		if (config) {
			this.lastProvider = config;
			this.postProvider(config);
			this.updateStatus(`Configured ${config.label}${config.model ? ` with ${config.model}` : ''}.`);
		}
	}

	async selectProvider(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.selectProvider)) {
			return;
		}
		const config = await chooseProvider(this.extensionContext.secrets);
		if (config) {
			this.lastProvider = config;
			this.postProvider(config);
			this.updateStatus(`Selected ${config.label}.`);
		}
	}

	async selectModel(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.selectModel)) {
			return;
		}
		const config = await chooseModel(this.extensionContext.secrets);
		if (config) {
			this.lastProvider = config;
			this.postProvider(config);
			this.updateStatus(`Selected ${config.model || 'provider default model'} for ${config.label}.`);
		}
	}

	async selectModeModel(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.selectModeModel)) {
			return;
		}
		const config = await chooseModeModel(this.extensionContext.secrets, this.lastMode);
		if (config) {
			this.lastProvider = config;
			this.postProvider(config);
			this.updateStatus(`Selected ${config.model || 'provider default model'} for ${config.mode ?? 'current'} mode on ${config.label}.`);
		}
	}

	async clearProviderCredentials(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.clearProviderCredentials)) {
			return;
		}
		const config = await clearStoredProviderCredentials(this.extensionContext.secrets);
		if (config) {
			this.lastProvider = config;
			this.postProvider(config);
			this.updateStatus(`${config.label} credentials are not stored in VS Code SecretStorage.`);
		}
	}

	async inlinePrompt(): Promise<void> {
		if (await this.tryRunNative(nativeCommands.inlinePrompt)) {
			return;
		}
		const editor = vscode.window.activeTextEditor;
		const location = editor ? vscode.workspace.asRelativePath(editor.document.uri, false) : undefined;
		const selection = editor?.selection;
		const hasSelection = !!selection && !selection.isEmpty;
		const value = await vscode.window.showInputBox({
			title: 'Vibe Codex Inline Prompt',
			prompt: hasSelection ? `Ask Vibe Codex about the selected code in ${location}.` : location ? `Ask Vibe Codex about ${location}.` : 'Ask Vibe Codex to plan a workspace change.',
			placeHolder: 'Refactor this, explain this, add tests, fix the bug...',
			ignoreFocusOut: true,
		});
		const instruction = value?.trim();
		if (!instruction) {
			return;
		}
		const session = createInlinePromptSession(editor, instruction);
		await this.startExternalTask('agent', session.prompt, session);
	}

	async runFallbackAlias(command: string, args: readonly unknown[]): Promise<void> {
		if (command === nativeCommands.openAgent) {
			await this.openAgent();
			return;
		}
		if (command === nativeCommands.login) {
			await this.login();
			return;
		}
		if (command === nativeCommands.configureProvider) {
			await this.configureProvider();
			return;
		}
		if (command === nativeCommands.selectProvider) {
			await this.selectProvider();
			return;
		}
		if (command === nativeCommands.selectModel) {
			await this.selectModel();
			return;
		}
		if (command === nativeCommands.selectModeModel) {
			await this.selectModeModel();
			return;
		}
		if (command === nativeCommands.clearProviderCredentials) {
			await this.clearProviderCredentials();
			return;
		}
		if (command === nativeCommands.inlinePrompt) {
			await this.inlinePrompt();
			return;
		}
		const mode = modeFromNativeCommand(command);
		if (mode) {
			await this.setFallbackMode(mode);
			return;
		}
		this.updateStatus(`Command ${command} is not handled by the external Vibe Codex extension. Args received: ${args.length}.`);
		await this.openAgent();
	}

	private async setFallbackMode(mode: string): Promise<void> {
		this.lastMode = normalizeMode(mode);
		this.lastModePolicy = modePolicyFor(this.lastMode);
		this.postModePolicy(this.lastModePolicy);
		this.postMessage({ type: 'modeChanged', mode: this.lastMode, summary: modePolicySummary(this.lastModePolicy) });
		this.refreshToolCatalog();
		this.postActionApprovalStatus();
		this.postParallelDispatchPlan();
		await this.postProviderState();
		this.recordTranscript('system', `Switched to ${this.lastModePolicy.label} Mode`, modePolicySummary(this.lastModePolicy));
		this.updateStatus(`Switched to ${this.lastModePolicy.label} Mode.`);
		await this.revealExtensionView();
	}

	async runExternalCodexTask(mode: string, prompt: string, slashCommand?: VibeCodexSlashCommandContext): Promise<void> {
		if (await this.tryRunNative(nativeCommands.openAgent)) {
			return;
		}

		const prepared = await this.preparePromptInput(mode, prompt, slashCommand);
		if (!slashCommand && prepared.slashCommand?.route === 'queueTask') {
			await this.queueTaskBoardPrompt(prepared.mode, prepared.prompt, [], prepared.slashCommand);
			return;
		}
		const command = this.codexCommand();
		const args = this.codexArgs();
		this.resetTaskCheckpoint();
		this.clearExecutionAuthorization();
		this.lastTaskCompletionResponse = undefined;
		this.workspaceReadEvidence = [];
		this.browserActionEvidence = [];
		this.postWorkspaceReadStatus();
		this.postBrowserActionStatus();
		this.lastSlashCommand = prepared.slashCommand;
		this.lastModePolicy = modePolicyFor(prepared.mode);
		this.lastCommandPermissionPolicy = this.commandPermissionPolicy();
		this.lastInlinePromptSession = undefined;
		this.postInlinePromptSession(undefined);
		const context = await collectVibeCodexContext(prepared.prompt, prepared.mode);
		const provider = await providerRuntimeConfig(this.extensionContext.secrets, prepared.mode);
		const parallelPlan = this.createParallelPlan(prepared.prompt, prepared.mode);
		const verificationPlan = await collectVerificationPlan(this.activePlan?.acceptanceCriteria);
		const customModeCatalog = await collectCustomModeCatalog();
		const workspaceGuidance = await collectWorkspaceGuidance();
		const docsContext = await collectDocsContext(prepared.prompt);
		const memoryBank = await collectMemoryBank();
		const previewPlan = await collectPreviewPlan();
		const mcpCatalog = await collectMcpCatalog();
		const sessionRecall = createSessionRecall(loadSessionHistory(this.extensionContext.globalState), prepared.prompt);
		this.lastVerificationPlan = verificationPlan;
		this.lastVerificationCriteriaKey = verificationCriteriaKey(verificationPlan.acceptanceCriteria);
		this.lastCustomModeCatalog = customModeCatalog;
		this.lastWorkspaceGuidance = workspaceGuidance;
		this.lastRuleProposal = this.createRuleProposalForSlash(prepared.prompt, prepared.slashCommand, workspaceGuidance);
		this.lastSessionRecall = sessionRecall;
		this.lastDocsContext = docsContext;
		this.lastMemoryBank = memoryBank;
		this.lastPreviewPlan = previewPlan;
		this.lastMcpCatalog = mcpCatalog;
		this.lastProvider = provider;
		this.lastContext = context;
		this.lastParallelPlan = parallelPlan;
		this.parallelResults = [];
		this.lastParallelReview = undefined;
		this.lastParallelMergeRequest = undefined;
		this.terminalRemediations = [];
		this.postTerminalRemediationStatus();
		const toolCatalog = this.refreshToolCatalog();
		this.postContext(context);
		this.postProvider(provider);
		this.postModePolicy(this.lastModePolicy);
		this.postCommandPermissionPolicy(this.lastCommandPermissionPolicy);
		this.postParallelPlan(parallelPlan);
		this.postVerificationPlan(verificationPlan);
		this.postCustomModeCatalog(customModeCatalog);
		this.postWorkspaceGuidance(workspaceGuidance);
		this.postRuleProposal(this.lastRuleProposal);
		this.postSessionRecall(sessionRecall);
		this.postDocsContext(docsContext);
		this.postMemoryBank(memoryBank);
		this.postPreviewPlan(previewPlan);
		this.postMcpCatalog(mcpCatalog);
		await this.startSession({
			mode: prepared.mode,
			prompt: prepared.prompt,
			modePolicy: this.lastModePolicy,
			commandPermissionPolicy: this.lastCommandPermissionPolicy,
			slashCommand: prepared.slashCommand,
			contextSummary: summarizeContextPack(context),
			provider,
			parallelPlan,
			verificationPlan,
			customModeCatalog,
			sessionRecall,
			docsContext,
			workspaceGuidance,
			ruleProposal: this.lastRuleProposal,
			memoryBank,
			previewPlan,
			mcpCatalog,
			toolCatalog,
			transcript: createInitialTranscript(prepared.mode, prepared.prompt, 'Started Codex CLI terminal handoff with workspace verification gate.', context, provider, this.lastModePolicy, this.lastCommandPermissionPolicy, parallelPlan, verificationPlan, customModeCatalog, sessionRecall, docsContext, workspaceGuidance, this.lastRuleProposal, memoryBank, previewPlan, mcpCatalog, toolCatalog, prepared.slashCommand),
			status: 'terminal',
			evidence: ['Started Codex CLI terminal handoff with workspace verification gate.', ...(prepared.slashCommand ? [slashCommandSummary(prepared.slashCommand)] : [])],
		});
		const taskPrompt = createTerminalTaskPrompt(prepared.mode, prepared.prompt, context, provider, this.lastModePolicy, this.lastCommandPermissionPolicy, parallelPlan, verificationPlan, customModeCatalog, sessionRecall, docsContext, workspaceGuidance, this.lastRuleProposal, memoryBank, previewPlan, mcpCatalog, toolCatalog, this.taskBoard, prepared.slashCommand);
		const terminal = vscode.window.createTerminal({
			name: 'Vibe Codex CLI',
			cwd: vscode.workspace.workspaceFolders?.[0]?.uri,
			env: terminalProviderEnv(provider),
		});
		terminal.show();
		terminal.sendText([command, ...args, taskPrompt].map(shellQuote).join(' '));
		this.recordTranscript('terminal', `Started ${modeLabel(prepared.mode)} CLI terminal handoff`, [command, ...args].join(' '), 'running');
		this.updateStatus(`Started ${modeLabel(prepared.mode)} handoff in the Vibe Codex CLI terminal.`);
	}

	async connectExternalBackend(): Promise<boolean> {
		if (this.bridge?.connected) {
			this.updateStatus('Codex app-server is already connected.');
			return true;
		}

		this.bridge?.disconnect();
		for (const disposable of this.bridgeDisposables.splice(0)) {
			disposable();
		}
		this.lastSentToolCatalogSignature = undefined;
		this.lastSentToolSchemaManifestSignature = undefined;

		const bridge = new VibeCodexExternalBridge({
			transport: this.bridgeTransport(),
			framing: this.messageFraming(),
			command: this.codexCommand(),
			args: this.appServerArgs(),
			cwd: this.workspaceRootPath(),
			pipePath: this.pipePath(),
			websocketUrl: this.websocketUrl(),
		});
		this.bridge = bridge;
		this.bridgeDisposables.push(bridge.onStatus(status => {
			this.lastBridgeStatus = status;
			this.updateStatus(bridgeStatusText(status));
			this.recordProtocol('status', status.label, status);
			this.postMessage({ type: 'backendStatus', status });
			this.postBackendLaunchStatus();
			this.refreshToolCatalog();
		}));
		this.bridgeDisposables.push(bridge.onNotification(message => this.handleBridgeNotification(message)));

		try {
			await bridge.connect();
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.updateStatus(`Codex app-server unavailable: ${message}`);
			return false;
		}
	}

	disconnectExternalBackend(reason = 'user request'): void {
		if (!this.bridge) {
			this.updateStatus('Codex app-server is not connected.');
			return;
		}
		this.bridge.disconnect();
		for (const disposable of this.bridgeDisposables.splice(0)) {
			disposable();
		}
		this.bridge = undefined;
		this.lastSentToolCatalogSignature = undefined;
		this.lastSentToolSchemaManifestSignature = undefined;
		const status: ExternalBridgeStatus = {
			state: 'disconnected',
			label: 'Codex app-server disconnected',
			detail: reason,
			pendingRequests: 0,
			handshake: 'unknown',
			transport: this.bridgeTransport(),
			framing: this.messageFraming(),
		};
		this.lastBridgeStatus = status;
		this.recordProtocol('status', 'Codex app-server disconnected', status);
		this.postMessage({ type: 'backendStatus', status });
		this.postBackendLaunchStatus();
		this.refreshToolCatalog();
		this.updateStatus(`Disconnected Codex app-server: ${reason}.`);
	}

	async restartExternalBackend(): Promise<boolean> {
		this.disconnectExternalBackend('restart requested');
		this.updateStatus('Restarting Codex app-server...');
		return this.connectExternalBackend();
	}

	async startExternalTask(mode: string, prompt: string, inlineSession?: VibeCodexInlinePromptSession, slashCommand?: VibeCodexSlashCommandContext): Promise<void> {
		if (await this.tryRunNative(nativeCommands.openAgent)) {
			return;
		}

		const prepared = await this.preparePromptInput(mode, prompt, slashCommand);
		if (!slashCommand && prepared.slashCommand?.route === 'queueTask') {
			await this.queueTaskBoardPrompt(prepared.mode, prepared.prompt, [], prepared.slashCommand);
			return;
		}
		await vscode.commands.executeCommand('workbench.view.extension.vibecodex-agent-extension-container');
		this.resetTaskCheckpoint();
		this.clearExecutionAuthorization();
		this.lastTaskCompletionResponse = undefined;
		this.planRevisionHistory = [];
		this.workspaceReadEvidence = [];
		this.browserActionEvidence = [];
		this.postPlanRevisionHistory();
		this.postWorkspaceReadStatus();
		this.postBrowserActionStatus();
		this.lastSlashCommand = prepared.slashCommand;
		this.lastInlinePromptSession = inlineSession;
		this.postInlinePromptSession(inlineSession);
		this.lastMode = prepared.mode;
		this.lastModePolicy = modePolicyFor(this.lastMode);
		this.lastCommandPermissionPolicy = this.commandPermissionPolicy();
		this.lastPrompt = prepared.prompt;
		this.lastContext = await collectVibeCodexContext(this.lastPrompt, this.lastMode);
		this.lastProvider = await providerRuntimeConfig(this.extensionContext.secrets, this.lastMode);
		this.lastParallelPlan = this.createParallelPlan(this.lastPrompt, this.lastMode);
		this.parallelResults = [];
		this.lastParallelReview = undefined;
		this.lastParallelMergeRequest = undefined;
		this.terminalRemediations = [];
		this.postTerminalRemediationStatus();
		this.lastCustomModeCatalog = await collectCustomModeCatalog();
		this.lastWorkspaceGuidance = await collectWorkspaceGuidance();
		this.lastRuleProposal = this.createRuleProposalForSlash(this.lastPrompt, this.lastSlashCommand, this.lastWorkspaceGuidance);
		this.lastSessionRecall = createSessionRecall(loadSessionHistory(this.extensionContext.globalState), this.lastPrompt);
		this.lastDocsContext = await collectDocsContext(this.lastPrompt);
		this.lastMemoryBank = await collectMemoryBank();
		this.lastPreviewPlan = await collectPreviewPlan();
		this.lastMcpCatalog = await collectMcpCatalog();
		const toolCatalog = this.refreshToolCatalog();
		this.postContext(this.lastContext);
		this.postProvider(this.lastProvider);
		this.postModePolicy(this.lastModePolicy);
		this.postCommandPermissionPolicy(this.lastCommandPermissionPolicy);
		this.postParallelPlan(this.lastParallelPlan);
		this.postCustomModeCatalog(this.lastCustomModeCatalog);
		this.postWorkspaceGuidance(this.lastWorkspaceGuidance);
		this.postRuleProposal(this.lastRuleProposal);
		this.postSessionRecall(this.lastSessionRecall);
		this.postDocsContext(this.lastDocsContext);
		this.postMemoryBank(this.lastMemoryBank);
		this.postPreviewPlan(this.lastPreviewPlan);
		this.postMcpCatalog(this.lastMcpCatalog);
		const runtimeBeforeBackend = await this.currentRuntimeReadinessStatus({
			id: 'task-start-runtime-readiness-before-backend',
			method: 'task/startRuntimeReadiness',
			includeGates: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		});
		this.postRuntimeReadinessStatus(runtimeBeforeBackend);
		const runtimeBeforeSummary = runtimeReadinessSummary(runtimeBeforeBackend);
		const fallbackPlan = createFallbackPlan(this.lastPrompt, this.lastMode);
		this.lastVerificationPlan = await collectVerificationPlan(fallbackPlan.acceptanceCriteria);
		this.lastVerificationCriteriaKey = verificationCriteriaKey(this.lastVerificationPlan.acceptanceCriteria);
		this.postVerificationPlan(this.lastVerificationPlan);
		const sessionStartDetail = [
			'Local visual plan and verification gate generated before backend refinement.',
			`Runtime startup gate: ${runtimeBeforeSummary}`,
		].join('\n');
		await this.startSession({
			mode: this.lastMode,
			prompt: this.lastPrompt,
			modePolicy: this.lastModePolicy,
			commandPermissionPolicy: this.lastCommandPermissionPolicy,
			slashCommand: this.lastSlashCommand,
			plan: fallbackPlan,
			contextSummary: summarizeContextPack(this.lastContext),
			provider: this.lastProvider,
			parallelPlan: this.lastParallelPlan,
			verificationPlan: this.lastVerificationPlan,
			customModeCatalog: this.lastCustomModeCatalog,
			sessionRecall: this.lastSessionRecall,
			docsContext: this.lastDocsContext,
			workspaceGuidance: this.lastWorkspaceGuidance,
			ruleProposal: this.lastRuleProposal,
			memoryBank: this.lastMemoryBank,
			previewPlan: this.lastPreviewPlan,
			mcpCatalog: this.lastMcpCatalog,
			toolCatalog,
			inlinePromptSession: inlineSession,
			transcript: createInitialTranscript(this.lastMode, this.lastPrompt, sessionStartDetail, this.lastContext, this.lastProvider, this.lastModePolicy, this.lastCommandPermissionPolicy, this.lastParallelPlan, this.lastVerificationPlan, this.lastCustomModeCatalog, this.lastSessionRecall, this.lastDocsContext, this.lastWorkspaceGuidance, this.lastRuleProposal, this.lastMemoryBank, this.lastPreviewPlan, this.lastMcpCatalog, toolCatalog, this.lastSlashCommand),
			status: 'planning',
			evidence: ['Local visual plan and verification gate generated before backend refinement.', `Runtime startup gate: ${runtimeBeforeSummary}`, ...(this.lastSlashCommand ? [slashCommandSummary(this.lastSlashCommand)] : [])],
		});
		this.setActivePlan(fallbackPlan, 'Local visual plan and workspace context ready. Connecting to Codex app-server for backend plan refinement.', 'submitted');

		const connected = await this.connectExternalBackend();
		const runtimeAfterConnect = await this.currentRuntimeReadinessStatus({
			id: 'task-start-runtime-readiness-after-connect',
			method: 'task/startRuntimeReadinessAfterConnect',
			includeGates: true,
			includePromptBlock: true,
			requestedAt: Date.now(),
		});
		this.postRuntimeReadinessStatus(runtimeAfterConnect);
		const runtimeAfterSummary = runtimeReadinessSummary(runtimeAfterConnect);
		if (!connected || !this.bridge) {
			this.recordTranscript('system', 'Runtime startup gate kept backend refinement offline', runtimeAfterSummary, 'pending');
			await this.patchActiveSession({
				status: 'planning',
				evidence: this.activeEvidence(`Backend runtime readiness: ${runtimeAfterSummary}`),
			});
			this.updateStatus('Review the local visual plan, then approve to run the Codex CLI terminal fallback.');
			return;
		}
		if (!runtimeAfterConnect.ready) {
			const detail = [
				runtimeAfterSummary,
				`Next: ${runtimeAfterConnect.nextAction}`,
				runtimeAfterConnect.blockers.length ? `Blockers:\n${runtimeAfterConnect.blockers.join('\n')}` : undefined,
			].filter(Boolean).join('\n');
			this.recordTranscript('system', 'Blocked backend plan refinement by runtime readiness gate', detail, runtimeAfterConnect.route === 'connect_backend' ? 'pending' : 'blocked');
			await this.patchActiveSession({
				status: 'planning',
				evidence: this.activeEvidence(`Backend runtime readiness blocked: ${runtimeAfterSummary}`),
			});
			this.updateStatus(`Backend plan refinement blocked: ${runtimeAfterConnect.nextAction}`);
			return;
		}

		try {
			const context = {
				...this.createBackendTaskContext(this.lastMode, this.lastPrompt, this.lastContext, this.lastProvider, this.lastModePolicy, this.lastCommandPermissionPolicy, this.lastParallelPlan, this.lastVerificationPlan, this.lastCustomModeCatalog, this.lastSessionRecall, this.lastDocsContext, this.lastWorkspaceGuidance, this.lastRuleProposal, this.lastMemoryBank, this.lastPreviewPlan, this.lastMcpCatalog),
				runtimeReadiness: runtimeAfterConnect,
				runtimeReadinessSummary: runtimeAfterSummary,
				...(runtimeAfterConnect.promptBlock ? { runtimeReadinessPrompt: runtimeAfterConnect.promptBlock } : {}),
			};
			this.recordProtocol('out', 'thread/start', { jsonrpc: '2.0', method: 'thread/start', params: context });
			const thread = await this.bridge.request('thread/start', context);
			const threadId = extractThreadId(thread);
			const turnStart = {
				...context,
				threadId,
				requireVisualPlan: true,
				planProtocol: 'agent/submitPlan',
			};
			this.recordProtocol('out', 'turn/start', { jsonrpc: '2.0', method: 'turn/start', params: turnStart });
			await this.bridge.request('turn/start', turnStart);
			this.updateStatus('Task sent to Codex app-server. Waiting for agent/submitPlan or plan updates.');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.recordProtocol('error', 'Codex app-server task failed', { error: message });
			this.updateStatus(`Codex app-server task failed: ${message}. The local visual plan remains available.`);
		}
	}

	async approveExternalPlan(renderedAction: VibeCodexRenderedPlanActionPayload): Promise<void> {
		const activePlan = this.activePlanForRenderedAction('approve', renderedAction);
		if (!activePlan) {
			return;
		}
		const validation = validatePlan(activePlan);
		if (!validation.valid) {
			const detail = validation.errors.join('\n');
			this.clearExecutionAuthorization();
			this.recordTranscript('approval', `Blocked approval for invalid plan ${activePlan.taskId} r${activePlan.revision}`, detail, 'blocked');
			await this.patchActiveSession({
				status: 'planning',
				evidence: this.activeEvidence(`Blocked plan approval because validation failed: ${validation.errors.join('; ')}`),
			});
			this.postMessage({ type: 'planApprovalBlocked', taskId: activePlan.taskId, revision: activePlan.revision, validationErrors: validation.errors });
			this.updateStatus(`Cannot approve invalid visual plan: ${validation.errors[0] ?? 'plan validation failed'}`);
			return;
		}

		this.executionAuthorization = createExecutionAuthorization(activePlan);
		this.postAutoApproveState();
		const toolCatalog = this.refreshToolCatalog();
		this.postPlanStatus();
		this.postPlanCanvasStatus();
		this.postModeStatus();
		this.postExecutionGateStatus();
		this.postTerminalRemediationStatus();
		this.postTerminalCommandValidationStatus();
		this.postInlinePromptStatus();
		this.postPreviewStatus();
		const approval = {
			source: 'externalExtension',
			action: 'approve',
			taskId: activePlan.taskId,
			revision: activePlan.revision,
			planIdentity: renderedPlanIdentity(activePlan),
			plan: activePlan,
			verificationPlan: this.lastVerificationPlan,
			customModeCatalog: this.lastCustomModeCatalog,
			workspaceGuidance: this.lastWorkspaceGuidance,
			ruleProposal: this.lastRuleProposal,
			previewPlan: this.lastPreviewPlan,
			mcpCatalog: this.lastMcpCatalog,
			toolCatalog,
		};
		this.postDeliveryBar();
		this.postParallelMergeStatus();

		if (this.bridge?.connected) {
			const authorizedApproval = { ...approval, executionAuthorization: this.executionAuthorization };
			this.recordProtocol('out', 'agent/approvePlan', { jsonrpc: '2.0', method: 'agent/approvePlan', params: authorizedApproval });
			await this.bridge.notify('agent/approvePlan', authorizedApproval);
			this.recordPlanRevision(activePlan, 'approved', 'Approved for execution and sent through agent/approvePlan.');
			this.recordTranscript('approval', `Approved plan ${activePlan.taskId} r${activePlan.revision}`, 'agent/approvePlan sent to Codex app-server.');
			await this.patchActiveSession({
				status: 'approved',
				evidence: this.activeEvidence(`Approved plan ${activePlan.taskId} r${activePlan.revision}.`),
			});
			this.updateStatus(`Approved plan ${activePlan.taskId} r${activePlan.revision}; agent/approvePlan sent to Codex app-server.`);
			this.postMessage({ type: 'planApproved', taskId: activePlan.taskId, revision: activePlan.revision });
			return;
		}

		this.recordPlanRevision(activePlan, 'approved', 'Approved for local Codex CLI terminal execution.');
		this.recordTranscript('approval', `Approved local plan ${activePlan.taskId} r${activePlan.revision}`, 'Falling back to Codex CLI terminal execution.');
		await this.runExternalCodexTask('act', planToPrompt(activePlan), this.lastSlashCommand);
	}

	async refineExternalPlan(feedback: string, renderedAction: VibeCodexRenderedPlanActionPayload): Promise<void> {
		const activePlan = this.activePlanForRenderedAction('refine', renderedAction);
		if (!activePlan) {
			return;
		}
		const trimmed = feedback.trim();
		this.clearExecutionAuthorization();
		const handoff = createPlanFeedbackHandoff(activePlan, 'refine', trimmed);
		const refinement = {
			...handoff,
			plan: activePlan,
		};

		await this.patchActiveSession({
			status: 'planning',
			evidence: this.activeEvidence(`Requested plan refinement for ${activePlan.taskId} r${activePlan.revision}: ${trimmed || 'no feedback supplied'}.`),
		});
		this.recordPlanRevision(activePlan, 'refine_requested', trimmed || 'Refinement requested without additional feedback.');
		this.recordTranscript('plan', `Requested refinement for ${activePlan.taskId} r${activePlan.revision}`, trimmed || 'No feedback supplied.', 'pending');

		if (this.bridge?.connected) {
			this.recordProtocol('out', 'agent/refinePlan', { jsonrpc: '2.0', method: 'agent/refinePlan', params: refinement });
			await this.bridge.notify('agent/refinePlan', refinement);
			this.updateStatus(`Requested refinement for plan ${activePlan.taskId} r${activePlan.revision}.`);
			this.postMessage({ type: 'planRefinementRequested', taskId: activePlan.taskId, revision: activePlan.revision });
			return;
		}

		const refined = refineFallbackPlan(activePlan, trimmed);
		this.setActivePlan(refined, `Created local plan revision ${refined.revision} from refinement feedback.`, 'updated');
	}

	async rejectExternalPlan(feedback: string, renderedAction: VibeCodexRenderedPlanActionPayload): Promise<void> {
		const activePlan = this.activePlanForRenderedAction('reject', renderedAction);
		if (!activePlan) {
			return;
		}
		const trimmed = feedback.trim();
		this.clearExecutionAuthorization();
		const handoff = createPlanFeedbackHandoff(activePlan, 'reject', trimmed);
		const rejection = {
			...handoff,
			plan: activePlan,
		};
		await this.patchActiveSession({
			status: 'planning',
			evidence: this.activeEvidence(`Rejected plan ${activePlan.taskId} r${activePlan.revision}: ${trimmed || 'no reason supplied'}.`),
		});
		this.recordPlanRevision(activePlan, 'rejected', trimmed || 'Rejected without additional feedback.');
		this.recordTranscript('plan', `Rejected plan ${activePlan.taskId} r${activePlan.revision}`, trimmed || 'No reason supplied.', 'blocked');

		if (this.bridge?.connected) {
			this.recordProtocol('out', 'agent/rejectPlan', { jsonrpc: '2.0', method: 'agent/rejectPlan', params: rejection });
			await this.bridge.notify('agent/rejectPlan', rejection);
			this.updateStatus(`Rejected plan ${activePlan.taskId} r${activePlan.revision}; waiting for a revised plan.`);
			this.postMessage({ type: 'planRejected', taskId: activePlan.taskId, revision: activePlan.revision });
			return;
		}

		const refined = refineFallbackPlan(activePlan, trimmed || 'Previous plan rejected; produce a safer revised plan before execution.');
		this.setActivePlan(refined, `Rejected local plan and created revision ${refined.revision}.`, 'updated');
	}

	async editPlanStep(renderedAction: VibeCodexRenderedPlanActionPayload, stepId: string, title: string | undefined, status: string | undefined): Promise<void> {
		const activePlan = this.activePlanForRenderedAction('edit step', renderedAction);
		if (!activePlan) {
			return;
		}
		try {
			const previousRevision = activePlan.revision;
			const edited = applyPlanStepEdit(activePlan, { stepId, title, status });
			if (edited === activePlan) {
				this.updateStatus(`Plan step ${stepId} is already up to date.`);
				return;
			}
			this.setActivePlan(edited, planStepEditSummary(edited, previousRevision), 'edited');
			const payload = {
				...createPlanFeedbackHandoff(edited, 'manualStepEdit', `Edited step ${stepId}`),
				previousRevision,
				previousPlanIdentity: renderedPlanIdentity(activePlan),
				stepId,
				plan: edited,
			};
			await this.patchActiveSession({
				status: 'planning',
				evidence: this.activeEvidence(`Edited plan step ${stepId}; plan is now revision ${edited.revision}.`),
			});
			this.recordTranscript('plan', `Edited plan step ${stepId}`, `Plan is now revision ${edited.revision}.`, 'pending');
			if (this.bridge?.connected) {
				this.recordProtocol('out', 'agent/updatePlan', { jsonrpc: '2.0', method: 'agent/updatePlan', params: payload });
				await this.bridge.notify('agent/updatePlan', payload);
			}
			this.postMessage({ type: 'planEdited', taskId: edited.taskId, revision: edited.revision, stepId });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.updateStatus(`Could not edit plan step: ${message}`);
		}
	}

	private async handlePlanFocusChanged(message: { readonly flowNodeId?: unknown; readonly stepId?: unknown; readonly file?: unknown; readonly source?: unknown; readonly active?: unknown }): Promise<void> {
		const active = message.active !== false;
		const flowNodeId = typeof message.flowNodeId === 'string' ? message.flowNodeId.trim() : '';
		const stepId = typeof message.stepId === 'string' ? message.stepId.trim() : '';
		const file = typeof message.file === 'string' ? message.file.trim() : '';
		const uiSource = typeof message.source === 'string' && message.source.trim() ? message.source.trim().slice(0, 64) : 'unknown';
		if (!active) {
			this.lastPlanFocusEventKey = '';
			this.lastPlanFocusEventAt = 0;
			return;
		}
		if (!flowNodeId && !stepId && !file) {
			return;
		}

		const now = Date.now();
		const request: VibeCodexPlanFocusStatusRequest = {
			id: `ui-plan-focus-${now.toString(36)}`,
			method: 'ui/planFocusChanged',
			...(stepId ? { stepId } : {}),
			...(flowNodeId ? { flowNodeId } : {}),
			...(file ? { file } : {}),
			includeBindings: true,
			includeGraph: true,
			includeFiles: true,
			includeRepairHints: true,
			requestedAt: now,
		};
		const response = createPlanFocusStatusResponse(request, {
			plan: this.activePlan,
		});
		const summary = planFocusStatusSummary(response);
		this.postPlanFocusStatus(response);
		this.updateStatus(`Visual plan focus from ${uiSource}: ${summary}`);
		if (!response.ok || !response.focus.matched || !this.bridge?.connected) {
			return;
		}

		const eventKey = [
			response.taskId ?? '',
			response.revision ?? '',
			uiSource,
			response.target.flowNodeId ?? '',
			response.target.stepId ?? '',
			response.target.file ?? '',
		].join(':');
		if (eventKey === this.lastPlanFocusEventKey && now - this.lastPlanFocusEventAt < 750) {
			return;
		}
		this.lastPlanFocusEventKey = eventKey;
		this.lastPlanFocusEventAt = now;

		const payload = {
			source: 'externalExtension',
			event: 'uiPlanFocusChanged',
			uiSource,
			active: true,
			taskId: response.taskId,
			revision: response.revision,
			target: response.target,
			focus: response.focus,
			counts: response.counts,
			guardrails: response.guardrails,
		};
		this.recordProtocol('out', 'agent/planFocusChanged', { jsonrpc: '2.0', method: 'agent/planFocusChanged', params: payload });
		try {
			await this.bridge.notify('agent/planFocusChanged', payload);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			this.recordProtocol('error', 'agent/planFocusChanged notification failed', { error: detail });
		}
	}

	async decideApproval(id: string, decision: 'accept' | 'decline'): Promise<void> {
		const card = this.approvalCards.get(id);
		if (!card) {
			this.updateStatus(`Approval ${id} is no longer pending.`);
			return;
			}
			this.approvalCards.delete(id);
			this.postMessage({ type: 'approvalRemoved', id });
			this.postApprovalStatus();
			this.postExecutionGateStatus();
			if (isPreviewStartApprovalCard(card)) {
				await this.decidePreviewStartApproval(card, decision);
				return;
			}
			if (decision === 'accept' && card.blocked) {
				this.recordProtocol('out', 'approval response', { id: card.id, result: createApprovalResponse(card, 'decline') });
			await this.bridge?.respond(card.id, createApprovalResponse(card, 'decline'));
			this.recordTranscript('approval', `Declined blocked approval: ${card.title}`, card.detail || card.description, 'blocked');
			this.updateStatus('Blocked approval was declined by safety policy.');
			return;
		}
		if (decision === 'accept') {
			const modeBlock = this.modeBlockReason(card.kind);
			if (modeBlock) {
				const response = createApprovalResponse(card, 'decline');
				this.recordProtocol('out', 'approval response blocked by mode policy', { id: card.id, result: response, modePolicy: this.lastModePolicy, reason: modeBlock });
				await this.bridge?.respond(card.id, response);
				this.recordTranscript('approval', `Declined approval by ${this.lastModePolicy.label} Mode: ${card.title}`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
		}
		if (decision === 'accept' && requiresApprovalAuthorization(card) && !this.executionAuthorization) {
			const response = createApprovalResponse(card, 'decline');
			this.recordProtocol('out', 'approval response missing approved plan', { id: card.id, result: response, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
			await this.bridge?.respond(card.id, response);
			this.recordTranscript('approval', `Declined approval before plan execution authorization: ${card.title}`, card.detail || card.description, 'blocked');
			this.updateStatus('Plan approval is required before accepting tool, file, or terminal requests.');
			return;
		}
		const approved = decision === 'accept' && !card.blocked;
		if (approved && isLocalDeleteFileApproval(card)) {
			await this.executeLocalDeleteFileApproval(card);
			return;
		}
		if (approved && isLocalTerminalToolApproval(card)) {
			await this.executeLocalTerminalToolApproval(card);
			return;
		}
		if (approved && isLocalParallelLaneDispatchApproval(card)) {
			await this.executeLocalParallelLaneDispatchApproval(card);
			return;
		}
		if (approved && isLocalParallelWorktreeApproval(card)) {
			await this.executeLocalParallelWorktreeApproval(card);
			return;
		}
		const response = attachExecutionAuthorization(createApprovalResponse(card, decision), this.executionAuthorization, approved);
		this.recordProtocol('out', 'approval response', { id: card.id, result: response });
		await this.bridge?.respond(card.id, response);
		this.recordTranscript('approval', `${decision === 'accept' ? 'Accepted' : 'Declined'} approval: ${card.title}`, card.detail || card.description, decision === 'accept' ? 'completed' : 'blocked');
		this.updateStatus(`${decision === 'accept' ? 'Accepted' : 'Declined'} ${card.title.toLowerCase()}.`);
	}

	private async executeLocalDeleteFileApproval(card: ExternalApprovalCard): Promise<void> {
		const targetPath = card.paths[0];
			try {
				await this.ensureTaskCheckpoint();
				const result = await deleteExternalWorkspaceFile(targetPath);
				this.patchCheckpoints.set(result.path, result.checkpoint);
				this.postTaskCheckpointState();
				const toolName = card.toolName?.toLowerCase() === 'remove_file' ? 'remove_file' : 'delete_file';
				const response = attachExecutionAuthorization({
					decision: 'accept',
					approved: true,
					source: 'externalExtension',
					tool: toolName,
					path: result.path,
					checkpointId: result.checkpoint.id,
				}, this.executionAuthorization, true);
				this.recordProtocol('out', `local ${toolName} response`, { id: card.id, result: response });
				await this.bridge?.respond(card.id, response);
				await this.patchActiveSession({
					status: 'diff_review',
					evidence: this.activeEvidence(`Deleted ${result.path} through approved ${toolName} tool call; checkpoint ${result.checkpoint.id} can restore it.`),
				});
				this.recordTranscript('tool', `Deleted file through ${toolName} tool`, `${result.path}\nCheckpoint: ${result.checkpoint.id}`, 'completed');
			this.updateStatus(`Deleted ${result.path}; checkpoint ${result.checkpoint.id} is available for rollback.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const data = { method: card.method, tool: card.toolName, paths: card.paths };
			this.recordProtocol('out', 'local delete_file failed', { id: card.id, error: message, data });
			await this.bridge?.respondError(card.id, -32006, message, data);
			this.recordTranscript('tool', 'Failed delete_file tool call', `${targetPath}\n${message}`, 'failed');
			this.updateStatus(`Could not delete ${targetPath}: ${message}`);
		}
		}

		private async decidePreviewStartApproval(card: VibeCodexPreviewStartApprovalCard, decision: 'accept' | 'decline'): Promise<void> {
			const decline = async (message: string): Promise<void> => {
				const response = createPreviewStartResponse({ card, accepted: false, message });
				this.recordProtocol('out', 'preview start response', { id: card.id, result: response });
				await this.bridge?.respond(card.id, response);
				this.recordTranscript('terminal', `Declined preview start: ${card.previewLabel}`, `${card.commandLine}\n${message}`, 'blocked');
				this.updateStatus(message);
			};
			if (decision !== 'accept') {
				await decline('Preview start declined by the developer.');
				return;
			}
			if (card.blocked) {
				await decline('Preview start was blocked by command permissions.');
				return;
			}
			const modeBlock = this.modeBlockReason('terminal');
			if (modeBlock) {
				await decline(modeBlock);
				return;
			}
			if (!this.executionAuthorization) {
				await decline('Plan approval is required before starting previews.');
				return;
			}
			const commandDecision = evaluateCommandPermission(card.commandLine, this.lastCommandPermissionPolicy);
			if (!commandDecision.allowed) {
				await decline(commandDecision.reason);
				return;
			}
			try {
				const runId = this.runVisibleTerminal(card.commandLine, card.cwd, card.reason ?? `Start preview ${card.previewLabel} at ${card.previewUrl}`);
				this.trackTerminalRunRequest(runId, {
					id: card.id,
					method: card.method,
					requestedAt: Date.now(),
					toolName: card.toolName,
					previewTargetId: card.previewTargetId,
					previewUrl: card.previewUrl,
					previewLabel: card.previewLabel,
				});
				const response = attachExecutionAuthorization(createPreviewStartResponse({
					card,
					accepted: true,
					started: true,
					runId,
					message: 'Preview terminal started. Request browser_action/open_preview separately to open the returned loopback URL.',
				}), this.executionAuthorization, true);
				this.recordProtocol('out', 'preview start response', { id: card.id, result: response });
				await this.bridge?.respond(card.id, response);
				await this.patchActiveSession({
					status: 'terminal',
					evidence: this.activeEvidence(`Started preview ${card.previewLabel}: ${card.commandLine} -> ${card.previewUrl}`),
				});
				this.recordTranscript('terminal', `Started preview ${card.previewLabel}`, `${card.commandLine}\n${card.previewUrl}`, 'running');
				this.updateStatus(`Started preview ${card.previewLabel}.`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				await decline(message);
			}
		}

	private async executeLocalTerminalToolApproval(card: ExternalApprovalCard): Promise<void> {
		if (!card.commandLine) {
			const response = createApprovalResponse(card, 'decline');
			this.recordProtocol('out', 'local terminal tool missing command', { id: card.id, result: response });
			await this.bridge?.respond(card.id, response);
			this.recordTranscript('terminal', 'Declined terminal tool without a command', card.detail || card.description, 'blocked');
			this.updateStatus('Terminal tool call did not include a command.');
			return;
		}
		const commandDecision = evaluateCommandPermission(card.commandLine, this.lastCommandPermissionPolicy);
		if (!commandDecision.allowed) {
			const response = createApprovalResponse(card, 'decline');
			this.recordProtocol('out', 'local terminal tool blocked by command permissions', { id: card.id, result: response, commandPermissionPolicy: this.lastCommandPermissionPolicy, reason: commandDecision.reason });
			await this.bridge?.respond(card.id, response);
			this.recordTranscript('terminal', 'Declined terminal tool by command permissions', `${card.commandLine}\n${commandDecision.reason}`, 'blocked');
			this.updateStatus(commandDecision.reason);
			return;
		}
		try {
			const runId = this.runVisibleTerminal(card.commandLine, card.cwd, card.reason ?? card.description);
			this.trackTerminalRunRequest(runId, { id: card.id, method: card.method, requestedAt: Date.now() });
			const response = attachExecutionAuthorization({
				decision: 'accept',
				approved: true,
				started: true,
				source: 'externalExtension',
				tool: card.toolName,
				runId,
				commandLine: card.commandLine,
			}, this.executionAuthorization, true);
			this.recordProtocol('out', 'local terminal tool response', { id: card.id, result: response });
			await this.bridge?.respond(card.id, response);
			await this.patchActiveSession({
				status: 'terminal',
				evidence: this.activeEvidence(`Started approved ${card.toolName ?? 'terminal'} tool command: ${card.commandLine}`),
			});
			this.recordTranscript('terminal', `Started approved ${card.toolName ?? 'terminal'} tool command`, card.commandLine, 'running');
			this.updateStatus(`Started approved terminal command: ${card.commandLine}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const response = createApprovalResponse(card, 'decline');
			this.recordProtocol('out', 'local terminal tool rejected by sandbox', { id: card.id, result: response, error: message });
			await this.bridge?.respond(card.id, response);
			this.recordTranscript('terminal', 'Rejected terminal tool by workspace sandbox', `${card.commandLine}\n${message}`, 'blocked');
			this.updateStatus(message);
		}
	}

	private async executeLocalParallelLaneDispatchApproval(card: ExternalApprovalCard): Promise<void> {
		const backendAddressed = !isSidebarRequestMethod(card.method);
		if (!card.commandLine || !card.cwd || !card.parallelDispatchTaskId || !card.parallelDispatchThreadId) {
			const response = createParallelLaneDispatchResponse(card, false);
			this.recordProtocol('out', 'parallel lane dispatch missing command metadata', { id: card.id, result: response });
			if (backendAddressed) {
				await this.bridge?.respond(card.id, response);
			}
			this.recordTranscript('terminal', 'Declined parallel lane dispatch without complete metadata', card.detail || card.description, 'blocked');
			this.updateStatus('Parallel lane dispatch approval did not include complete command/worktree metadata.');
			return;
		}
		if (!this.lastParallelPlan) {
			if (backendAddressed) {
				await this.bridge?.respondError(card.id, -32011, 'No parallel agent plan is available.', { method: card.method, threadId: card.parallelDispatchThreadId });
			}
			this.recordTranscript('terminal', 'Rejected parallel lane dispatch without a parallel plan', card.detail || card.description, 'blocked');
			this.updateStatus('No parallel agent plan is available.');
			return;
		}
		if (card.parallelDispatchTaskId !== this.lastParallelPlan.taskId) {
			const message = `Parallel lane dispatch task ${card.parallelDispatchTaskId} does not match active task ${this.lastParallelPlan.taskId}.`;
			if (backendAddressed) {
				await this.bridge?.respondError(card.id, -32012, message, { method: card.method, activeTaskId: this.lastParallelPlan.taskId, threadId: card.parallelDispatchThreadId });
			}
			this.recordTranscript('terminal', `Rejected stale parallel lane dispatch: ${card.parallelDispatchThreadId}`, message, 'blocked');
			this.updateStatus(message);
			return;
		}
		const thread = this.lastParallelPlan.threads.find(candidate => candidate.id === card.parallelDispatchThreadId);
		if (!thread || thread.worktreePath !== card.cwd || thread.status !== 'materialized') {
			const message = `Parallel lane ${card.parallelDispatchThreadId} is not materialized at the approved worktree path.`;
			if (backendAddressed) {
				await this.bridge?.respondError(card.id, -32013, message, { method: card.method, cwd: card.cwd, threadId: card.parallelDispatchThreadId });
			}
			this.recordTranscript('terminal', `Rejected unmaterialized parallel lane dispatch: ${card.parallelDispatchThreadId}`, message, 'blocked');
			this.updateStatus(message);
			return;
		}
		if (!authorizationMatchesPlan(this.executionAuthorization, this.activePlan)) {
			const response = createParallelLaneDispatchResponse(card, false);
			this.recordProtocol('out', 'parallel lane dispatch missing exact plan authorization', { id: card.id, result: response, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
			if (backendAddressed) {
				await this.bridge?.respond(card.id, response);
			}
			this.recordTranscript('terminal', `Declined parallel lane dispatch before exact plan authorization: ${card.parallelDispatchThreadId}`, card.detail || card.description, 'blocked');
			this.updateStatus('Approve the exact current visual plan revision before dispatching parallel lanes.');
			return;
		}
		const commandDecision = evaluateCommandPermission(card.commandLine, this.lastCommandPermissionPolicy);
		if (!commandDecision.allowed) {
			const response = createParallelLaneDispatchResponse(card, false);
			this.recordProtocol('out', 'parallel lane dispatch blocked by command permissions', { id: card.id, result: response, commandPermissionPolicy: this.lastCommandPermissionPolicy, reason: commandDecision.reason });
			if (backendAddressed) {
				await this.bridge?.respond(card.id, response);
			}
			this.recordTranscript('terminal', 'Declined parallel lane dispatch by command permissions', `${card.commandLine}\n${commandDecision.reason}`, 'blocked');
			this.updateStatus(commandDecision.reason);
			return;
		}
		try {
			const runId = this.runVisibleTerminal(card.commandLine, card.cwd, card.reason ?? card.description);
			this.trackTerminalRunRequest(runId, {
				id: card.id,
				method: card.method,
				requestedAt: Date.now(),
				toolName: card.toolName,
				parallelTaskId: card.parallelDispatchTaskId,
				parallelThreadId: card.parallelDispatchThreadId,
				parallelBranchName: card.parallelDispatchBranchName,
				parallelWorktreePath: card.parallelDispatchWorktreePath ?? card.cwd,
				parallelPromptFocus: card.parallelDispatchPromptFocus,
				parallelResultExpectedBy: 'dispatch_parallel_lane',
			});
			const runningResult = this.createParallelRunningResult(card, runId);
			await this.recordParallelResult(runningResult);
			await this.notifyParallelResult(runningResult, {
				expectedBy: 'dispatch_parallel_lane',
				terminalRunId: runId,
				terminalStatus: 'running',
			});
			const response = attachExecutionAuthorization(createParallelLaneDispatchResponse(card, true, runId), this.executionAuthorization, true);
			this.recordProtocol('out', 'parallel lane dispatch response', { id: card.id, result: response });
			if (backendAddressed) {
				await this.bridge?.respond(card.id, response);
			}
			await this.patchActiveSession({
				status: 'terminal',
				evidence: this.activeEvidence(`Started parallel lane ${card.parallelDispatchThreadId}: ${card.commandLine}`),
			});
			this.postParallelLaneExecutionStatus();
			this.postParallelDispatchPlan();
			const summary = parallelLaneDispatchSummary(createParallelLaneDispatchResponse(card, true, runId));
			this.recordTranscript('terminal', `Started parallel lane ${card.parallelDispatchThreadId}`, `${summary}\n${card.commandLine}`, 'running');
			this.updateStatus(summary);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const response = createParallelLaneDispatchResponse(card, false);
			this.recordProtocol('out', 'parallel lane dispatch rejected by workspace sandbox', { id: card.id, result: response, error: message });
			if (backendAddressed) {
				await this.bridge?.respond(card.id, response);
			}
			this.recordTranscript('terminal', 'Rejected parallel lane dispatch by workspace sandbox', `${card.commandLine}\n${message}`, 'blocked');
			this.updateStatus(message);
		}
	}

	private createParallelRunningResult(card: ExternalApprovalCard, runId: string): VibeCodexParallelResult {
		const result = this.createParallelRunningResultFromRequest({
			id: card.id,
			method: card.method,
			requestedAt: Date.now(),
			toolName: card.toolName,
			parallelTaskId: card.parallelDispatchTaskId,
			parallelThreadId: card.parallelDispatchThreadId,
			parallelBranchName: card.parallelDispatchBranchName,
			parallelWorktreePath: card.parallelDispatchWorktreePath ?? card.cwd,
			parallelPromptFocus: card.parallelDispatchPromptFocus,
			parallelResultExpectedBy: 'dispatch_parallel_lane',
		}, runId, card.commandLine ?? '', card.cwd);
		return result ?? {
			taskId: '',
			threadId: '',
			status: 'running',
			summary: redactSensitiveText(`Parallel lane ${card.parallelDispatchThreadId ?? 'unknown'} terminal running: ${runId}`),
			changedFiles: [],
			verification: [redactSensitiveText(`Terminal run: ${runId}`)],
			risks: [],
			producedAt: Date.now(),
		};
	}

	private createParallelRunningResultFromRequest(request: VibeCodexTerminalRunRequestRecord, runId: string, commandLine: string, cwd?: string): VibeCodexParallelResult | undefined {
		if (!request.parallelTaskId || !request.parallelThreadId) {
			return undefined;
		}
		return {
			taskId: redactSensitiveText(request.parallelTaskId),
			threadId: redactSensitiveText(request.parallelThreadId),
			...(request.parallelBranchName ? { branchName: redactSensitiveText(request.parallelBranchName) } : {}),
			...(request.parallelWorktreePath || cwd ? { worktreePath: redactSensitiveText(request.parallelWorktreePath ?? cwd ?? '') } : {}),
			status: 'running',
			summary: redactSensitiveText(`Parallel lane ${request.parallelThreadId} terminal running: ${runId}`),
			changedFiles: [],
			verification: [
				redactSensitiveText([
					`Terminal run: ${runId}`,
					commandLine ? `Command: ${commandLine}` : undefined,
					cwd ? `Cwd: ${cwd}` : undefined,
					request.parallelPromptFocus ? `Focus: ${request.parallelPromptFocus}` : undefined,
				].filter(Boolean).join('\n')),
			],
			risks: [],
			producedAt: Date.now(),
		};
	}

	private trackTerminalRunRequest(runId: string, request: VibeCodexTerminalRunRequestRecord): void {
		this.terminalRunRequests.set(runId, request);
		this.terminalRunRequestHistory.set(runId, request);
	}

	private terminalRunRequestForRetry(runId: string): VibeCodexTerminalRunRequestRecord | undefined {
		return this.terminalRunRequests.get(runId) ?? this.terminalRunRequestHistory.get(runId);
	}

	private async inheritTerminalRunRequestForRetry(previousRun: VibeCodexCapturedTerminalRun, retryId: string, options: { readonly id: JsonRpcId; readonly method: string; readonly expectedBy: string; readonly source: string }): Promise<void> {
		const previous = this.terminalRunRequestForRetry(previousRun.id);
		if (!previous) {
			return;
		}
		const retryRequest: VibeCodexTerminalRunRequestRecord = {
			...previous,
			id: options.id,
			method: options.method,
			requestedAt: Date.now(),
			parallelResultExpectedBy: previous.parallelTaskId && previous.parallelThreadId ? options.expectedBy : previous.parallelResultExpectedBy,
		};
		this.trackTerminalRunRequest(retryId, retryRequest);
		if (retryRequest.verificationCheckId) {
			await this.attachTerminalRunToVerification(retryId, retryRequest.verificationCheckId, previousRun.commandLine, options.source);
		}
		const runningResult = this.createParallelRunningResultFromRequest(retryRequest, retryId, previousRun.commandLine, previousRun.cwd);
		if (!runningResult) {
			return;
		}
		await this.recordParallelResult(runningResult);
		await this.notifyParallelResult(runningResult, {
			expectedBy: options.expectedBy,
			terminalRunId: retryId,
			terminalStatus: 'running',
		});
		this.postParallelLaneExecutionStatus();
		this.postParallelDispatchPlan();
	}

	private async executeLocalParallelWorktreeApproval(card: ExternalApprovalCard): Promise<void> {
		const operation = card.parallelWorktreeOperation;
		if (!operation) {
			const response = createApprovalResponse(card, 'decline');
			this.recordProtocol('out', 'parallel worktree approval missing operation', { id: card.id, result: response });
			await this.bridge?.respond(card.id, response);
			this.recordTranscript('tool', 'Declined parallel worktree request without an operation', card.detail || card.description, 'blocked');
			this.updateStatus('Parallel worktree approval did not include an operation.');
			return;
		}
		if (!this.lastParallelPlan) {
			await this.bridge?.respondError(card.id, -32008, 'No parallel agent plan is available.', { method: card.method, operation });
			this.recordTranscript('tool', `Rejected parallel worktree ${operation} without a parallel plan`, card.detail || card.description, 'blocked');
			this.updateStatus('No parallel agent plan is available.');
			return;
		}
		if (card.parallelTaskId && card.parallelTaskId !== this.lastParallelPlan.taskId) {
			const message = `Parallel worktree approval task ${card.parallelTaskId} does not match active plan ${this.lastParallelPlan.taskId}.`;
			await this.bridge?.respondError(card.id, -32009, message, { method: card.method, operation, activeTaskId: this.lastParallelPlan.taskId });
			this.recordTranscript('tool', `Rejected parallel worktree ${operation} for stale task`, message, 'blocked');
			this.updateStatus(message);
			return;
		}
		if (!authorizationMatchesPlan(this.executionAuthorization, this.activePlan)) {
			const message = 'Approve the exact current visual plan revision before preparing or cleaning parallel worktrees.';
			const response = createApprovalResponse(card, 'decline');
			this.recordProtocol('out', 'parallel worktree approval missing exact plan authorization', { id: card.id, result: response, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
			await this.bridge?.respond(card.id, response);
			this.recordTranscript('tool', `Declined parallel worktree ${operation} before exact plan authorization`, card.detail || card.description, 'blocked');
			this.updateStatus(message);
			return;
		}
		try {
			const result = await this.executeParallelWorktreeOperation(operation);
			const response = attachExecutionAuthorization(createParallelWorktreeResponse({
				id: card.id,
				method: card.method,
				operation,
				...(card.parallelTaskId ? { taskId: card.parallelTaskId } : {}),
				requestedAt: card.requestedAt,
			}, result), this.executionAuthorization, true);
			this.recordProtocol('out', 'parallel worktree approval response', { id: card.id, result: response });
			await this.bridge?.respond(card.id, response);
			this.recordTranscript('tool', operation === 'prepare' ? 'Approved and prepared parallel worktrees' : 'Approved and cleaned parallel worktrees', parallelWorktreeRequestSummary({
				id: card.id,
				method: card.method,
				operation,
				...(card.parallelTaskId ? { taskId: card.parallelTaskId } : {}),
				requestedAt: card.requestedAt,
			}, result), result.plan.threads.some(thread => thread.status === 'failed') ? 'failed' : 'completed');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.recordProtocol('out', 'parallel worktree approval failed', { id: card.id, error: message });
			await this.bridge?.respondError(card.id, -32010, message, { method: card.method, operation });
			this.recordTranscript('tool', `Parallel worktree ${operation} failed`, message, 'failed');
			this.updateStatus(`Parallel worktree ${operation} failed: ${message}`);
		}
	}

	async decideBrowserAction(id: string, decision: 'accept' | 'decline'): Promise<void> {
		const action = this.browserActions.get(id);
		if (!action) {
			this.updateStatus(`Browser action ${id} is no longer pending.`);
			return;
		}
		this.browserActions.delete(id);
		this.postMessage({ type: 'browserActionRemoved', id });
		this.postBrowserStatus();
		this.postPreviewStatus();

		if (decision === 'accept' && requiresBrowserAuthorization(action) && !this.executionAuthorization) {
			const response = createBrowserActionResponse(action, false, 'Plan approval is required before browser actions.');
			this.recordProtocol('out', 'browser action response missing approved plan', { id: action.id, result: response, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
			await this.bridge?.respond(action.id, response);
			this.recordBrowserActionEvidence(createBrowserActionEvidenceEvent(action, 'blocked', { decision, responseMessage: 'Plan approval is required before browser actions.' }));
			this.recordTranscript('tool', `Declined browser ${action.action} before plan execution authorization`, action.detail || action.url, 'blocked');
			this.updateStatus('Plan approval is required before browser actions.');
			return;
		}
		if (decision === 'accept') {
			const modeBlock = this.modeBlockReason('browser');
			if (modeBlock) {
				const response = createBrowserActionResponse(action, false, modeBlock);
				this.recordProtocol('out', 'browser action response blocked by mode policy', { id: action.id, result: response, modePolicy: this.lastModePolicy, reason: modeBlock });
				await this.bridge?.respond(action.id, response);
				this.recordBrowserActionEvidence(createBrowserActionEvidenceEvent(action, 'blocked', { decision, reason: modeBlock, responseMessage: modeBlock }));
				this.recordTranscript('tool', `Declined browser ${action.action} by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
		}

		if (decision === 'accept' && action.supported && action.url) {
			if (isLoopbackUrl(action.url)) {
				await this.openPreview(String(action.id), action.url);
			} else {
				await vscode.env.openExternal(vscode.Uri.parse(action.url));
			}
		}

		const response = attachExecutionAuthorization(createBrowserActionResponse(action, decision === 'accept', decision === 'accept' && action.supported ? 'Browser action started.' : action.supported ? 'Browser action declined.' : 'Browser action requires the native browser controller.'), this.executionAuthorization, decision === 'accept' && action.supported);
		this.recordBrowserActionEvidence(createBrowserActionEvidenceEvent(action, decision === 'accept' && action.supported ? 'started' : action.supported ? 'declined' : 'native_required', {
			decision,
			responseMessage: decision === 'accept' && action.supported ? 'Browser action started.' : action.supported ? 'Browser action declined.' : 'Browser action requires the native browser controller.',
		}));
		this.recordProtocol('out', 'browser action response', { id: action.id, result: response });
		await this.bridge?.respond(action.id, response);
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`${decision === 'accept' ? 'Accepted' : 'Declined'} browser ${action.action}${action.url ? ` for ${action.url}` : ''}.`),
		});
		this.recordTranscript('tool', `${decision === 'accept' ? 'Accepted' : 'Declined'} browser ${action.action}`, action.detail || action.url, decision === 'accept' && action.supported ? 'running' : 'blocked');
		this.updateStatus(`${decision === 'accept' && action.supported ? 'Started' : 'Declined'} browser ${action.action}.`);
	}

	async decideMcpAction(id: string, decision: 'accept' | 'decline'): Promise<void> {
		const action = this.mcpActions.get(id);
		if (!action) {
			this.updateStatus(`MCP request ${id} is no longer pending.`);
			return;
		}
		this.mcpActions.delete(id);
		this.postMessage({ type: 'mcpActionRemoved', id });
		this.postMcpStatus();
		if (decision === 'accept' && requiresMcpAuthorization(action) && !this.executionAuthorization) {
			const response = createMcpActionResponse(action, 'decline');
			this.recordProtocol('out', 'mcp action response missing approved plan', { id: action.id, result: response, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
			await this.bridge?.respond(action.id, response);
			this.recordTranscript('tool', `Declined ${action.title} before plan execution authorization`, action.detail, 'blocked');
			this.updateStatus('Plan approval is required before MCP tool or resource requests.');
			return;
		}
		if (decision === 'accept') {
			const modeBlock = this.modeBlockReason('mcp');
			if (modeBlock) {
				const response = createMcpActionResponse(action, 'decline');
				this.recordProtocol('out', 'mcp action response blocked by mode policy', { id: action.id, result: response, modePolicy: this.lastModePolicy, reason: modeBlock });
				await this.bridge?.respond(action.id, response);
				this.recordTranscript('tool', `Declined ${action.title} by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
		}
		const response = attachExecutionAuthorization(createMcpActionResponse(action, decision), this.executionAuthorization, decision === 'accept' && !action.blocked);
		this.recordProtocol('out', 'mcp action response', { id: action.id, result: response });
		await this.bridge?.respond(action.id, response);
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`${decision === 'accept' && !action.blocked ? 'Approved' : 'Declined'} ${action.kind === 'tool' ? 'MCP tool' : 'MCP resource'}${action.serverName ? ` on ${action.serverName}` : ''}.`),
		});
		this.recordTranscript('tool', `${decision === 'accept' && !action.blocked ? 'Approved' : 'Declined'} ${action.title}`, action.detail, decision === 'accept' && !action.blocked ? 'running' : 'blocked');
		this.updateStatus(`${decision === 'accept' && !action.blocked ? 'Approved' : 'Declined'} ${action.title.toLowerCase()}.`);
	}

	async decideWebFetch(id: string, decision: 'accept' | 'decline'): Promise<void> {
		const request = this.webFetches.get(id);
		if (!request) {
			this.updateStatus(`Web fetch ${id} is no longer pending.`);
			return;
		}
		this.webFetches.delete(id);
		this.postMessage({ type: 'webFetchRemoved', id });
		if (decision === 'accept' && requiresWebFetchAuthorization(request) && !this.executionAuthorization) {
			const response = createWebFetchResponse(request, false);
			this.recordProtocol('out', 'web fetch response missing approved plan', { id: request.id, result: response, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
			await this.bridge?.respond(request.id, response);
			this.recordTranscript('tool', 'Declined web fetch before plan execution authorization', request.detail, 'blocked');
			this.updateStatus('Plan approval is required before web fetch requests.');
			return;
		}
		if (decision === 'accept') {
			const modeBlock = this.modeBlockReason('tool');
			if (modeBlock) {
				const response = createWebFetchResponse(request, false);
				this.recordProtocol('out', 'web fetch response blocked by mode policy', { id: request.id, result: response, modePolicy: this.lastModePolicy, reason: modeBlock });
				await this.bridge?.respond(request.id, response);
				this.recordTranscript('tool', `Declined web fetch by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
		}
		if (decision === 'accept' && request.blocked) {
			const response = createWebFetchResponse(request, false);
			this.recordProtocol('out', 'web fetch response blocked by URL safety policy', { id: request.id, result: response });
			await this.bridge?.respond(request.id, response);
			this.recordTranscript('tool', 'Declined blocked web fetch', request.detail, 'blocked');
			this.updateStatus('Blocked web fetch was declined by safety policy.');
			return;
		}
		const result = decision === 'accept' ? await performWebFetch(request) : undefined;
		const response = attachExecutionAuthorization(createWebFetchResponse(request, decision === 'accept', result), this.executionAuthorization, decision === 'accept' && request.supported && !request.blocked);
		this.recordProtocol('out', 'web fetch response', { id: request.id, result: response });
		await this.bridge?.respond(request.id, response);
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`${decision === 'accept' ? 'Accepted' : 'Declined'} web fetch ${request.url}${result?.status ? ` (${result.status})` : ''}.`),
		});
		this.recordTranscript('tool', `${decision === 'accept' ? 'Accepted' : 'Declined'} web fetch`, result ? `${request.detail}\nStatus: ${result.status ?? 'n/a'}\n${result.error ?? ''}` : request.detail, decision === 'accept' && result?.ok ? 'completed' : decision === 'accept' ? 'failed' : 'blocked');
		this.updateStatus(`${decision === 'accept' ? 'Completed' : 'Declined'} web fetch.`);
	}

	async answerUserInputRequest(id: string, answer: string, cancelled = false, selectedSuggestionIndex?: number): Promise<void> {
		const request = this.userInputRequests.get(id);
		if (!request) {
			this.updateStatus(`User input request ${id} is no longer pending.`);
			return;
			}
			this.userInputRequests.delete(id);
			this.postMessage({ type: 'userInputRequestRemoved', id });
			this.postUserInputStatus();
			const response = createUserInputResponse(request, answer, cancelled, selectedSuggestionIndex);
		this.recordProtocol('out', 'user input response', { id: request.id, result: response });
		await this.bridge?.respond(request.id, response);
		this.recordTranscript('system', response.answered ? 'Answered backend user input request' : 'Cancelled backend user input request', response.answered ? response.answer : request.prompt, response.answered ? 'completed' : 'blocked');
		await this.patchActiveSession({
			evidence: this.activeEvidence(`${response.answered ? 'Answered' : 'Cancelled'} ${request.kind === 'plan_feedback' ? 'Plan Mode response' : 'backend user-input request'}.`),
		});
		this.updateStatus(response.answered ? 'Sent user input response to Codex app-server.' : 'Cancelled user input request.');
	}

	private async evaluateTaskCompletion(request: VibeCodexTaskCompletionRequest): Promise<VibeCodexTaskCompletionResponse> {
		const gate = this.createCurrentDeliveryGate();
		this.lastCommitHandoff = gate.commitHandoff;
		this.postMessage({ type: 'deliveryBar', state: gate.deliveryBar });
		this.postMessage({ type: 'commitHandoff', handoff: gate.commitHandoff });
		this.postMessage({ type: 'smokeBenchmark', state: gate.smokeBenchmark });
		this.postMessage({ type: 'finalReview', review: gate.finalReview, promptBlock: finalReviewPromptBlock(gate.finalReview) });
		this.postAutoCommitStatus(this.currentAutoCommitStatus(undefined, gate));
		this.postWorkflowStatus(this.currentWorkflowStatus(undefined, gate));
		this.notifyFinalReview(gate.finalReview);

		const response = createTaskCompletionResponse(request, gate.finalReview, this.taskCompletionOptions());
		const summary = taskCompletionSummary(request, response);
		this.lastTaskCompletionResponse = response;
		this.postMessage({ type: 'taskCompletionGate', response, summary });
		this.postTaskCompletionStatus();
		await this.patchActiveSession({
			status: response.accepted ? 'completed' : 'blocked',
			finalReview: gate.finalReview,
			evidence: this.activeEvidence(summary),
		});
		await this.markTaskBoardCompletion(request, response, summary);
		this.recordTranscript(response.accepted ? 'assistant' : 'system', response.accepted ? 'Backend task completion accepted' : 'Backend task completion blocked', `${request.result}\n\n${summary}`, response.accepted ? 'completed' : 'blocked');
		this.updateStatus(summary);
		return response;
	}

	private taskCompletionOptions(): { readonly allowReadOnlyAdvisory?: boolean; readonly advisoryReason?: string } {
		const hasDiffReview = !!this.activeDiffReview?.files.length;
		const hasTerminalRuns = this.terminalRuns.size > 0;
		const hasCheckpoint = !!this.taskCheckpointId || this.patchCheckpoints.size > 0;
		const hasExecutionAuthorization = !!this.executionAuthorization;
		if (hasDiffReview || hasTerminalRuns || hasCheckpoint) {
			return {};
		}
		if (this.lastModePolicy.readOnly) {
			return {
				allowReadOnlyAdvisory: true,
				advisoryReason: `${this.lastModePolicy.label} Mode is read-only and no terminal, diff, checkpoint, or workspace mutation evidence was produced.`,
			};
		}
		if (!hasExecutionAuthorization) {
			return {
				allowReadOnlyAdvisory: true,
				advisoryReason: 'No approved execution authorization, terminal run, diff review, checkpoint, or workspace mutation evidence was produced.',
			};
		}
		return {};
	}

	private async markTaskBoardCompletion(request: VibeCodexTaskCompletionRequest, response: VibeCodexTaskCompletionResponse, summary: string): Promise<void> {
		if (!response.accepted) {
			return;
		}
		const card = this.findTaskBoardCompletionCard(request.taskId);
		if (!card || card.status === 'completed' || card.status === 'archived') {
			return;
		}
		await this.saveTaskBoard(updateTaskBoardCardStatus(this.taskBoard, card.id, 'completed', `${summary} Result: ${request.result.slice(0, 500)}`));
		if (this.activeTaskBoardCardId === card.id) {
			this.activeTaskBoardCardId = undefined;
		}
		this.recordProtocol('out', 'task board completion linked', { cardId: card.id, taskId: request.taskId, completionKind: response.completionKind });
		this.recordTranscript('system', `Completed Task Board card ${card.title}`, summary, 'completed');
	}

	private findTaskBoardCompletionCard(taskId: string | undefined) {
		const direct = taskId ? this.taskBoard.cards.find(card => card.id === taskId) : undefined;
		if (direct) {
			return direct;
		}
		const active = this.activeTaskBoardCardId ? this.taskBoard.cards.find(card => card.id === this.activeTaskBoardCardId) : undefined;
		if (active) {
			return active;
		}
		const running = this.taskBoard.cards.filter(card => card.status === 'running');
		return running.length === 1 ? running[0] : undefined;
	}

	async decideHookAction(id: string, decision: 'accept' | 'decline'): Promise<void> {
		const action = this.hookActions.get(id);
		if (!action) {
			this.updateStatus(`Hook request ${id} is no longer pending.`);
			return;
		}
		this.hookActions.delete(id);
		this.postMessage({ type: 'hookActionRemoved', id });

		if (decision === 'accept' && !this.executionAuthorization) {
			const response = createHookActionResponse(action, false);
			this.recordProtocol('out', 'hook action response missing approved plan', { id: action.id, result: response, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
			await this.bridge?.respond(action.id, response);
			this.recordTranscript('tool', 'Declined hook execution before plan execution authorization', action.detail, 'blocked');
			this.updateStatus('Plan approval is required before hook execution.');
			return;
		}
		if (decision === 'accept') {
			const modeBlock = this.modeBlockReason('terminal');
			if (modeBlock) {
				const response = createHookActionResponse(action, false);
				this.recordProtocol('out', 'hook action response blocked by mode policy', { id: action.id, result: response, modePolicy: this.lastModePolicy, reason: modeBlock });
				await this.bridge?.respond(action.id, response);
				this.recordTranscript('tool', `Declined hook execution by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			if (action.blocked) {
				const response = createHookActionResponse(action, false);
				this.recordProtocol('out', 'hook action response blocked by manifest policy', { id: action.id, result: response });
				await this.bridge?.respond(action.id, response);
				this.recordTranscript('tool', 'Declined unknown hook execution', action.detail, 'blocked');
				this.updateStatus('Hook execution was blocked because no indexed hook manifest matched the command.');
				return;
			}
			const commandDecision = evaluateCommandPermission(action.commandLine, this.lastCommandPermissionPolicy);
			if (!commandDecision.allowed) {
				const response = createHookActionResponse(action, false);
				this.recordProtocol('out', 'hook action response blocked by command permissions', { id: action.id, result: response, commandPermissionPolicy: this.lastCommandPermissionPolicy, reason: commandDecision.reason });
				await this.bridge?.respond(action.id, response);
				this.recordTranscript('tool', 'Declined hook execution by command permissions', `${action.commandLine}\n${commandDecision.reason}`, 'blocked');
				this.updateStatus(commandDecision.reason);
				return;
			}
		}

		let runId: string | undefined;
		if (decision === 'accept' && action.supported) {
			try {
				runId = this.runVisibleTerminal(action.commandLine, action.cwd, action.reason ? `Hook: ${action.reason}` : `Hook: ${action.hookName ?? action.manifestPath ?? 'workspace hook'}`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const response = createHookActionResponse(action, false);
				this.recordProtocol('out', 'hook action rejected by workspace sandbox', { id: action.id, result: response, error: message });
				await this.bridge?.respond(action.id, response);
				this.recordTranscript('tool', 'Rejected hook execution by workspace sandbox', `${action.commandLine}\n${message}`, 'blocked');
				this.updateStatus(message);
				return;
			}
		}
		const approved = decision === 'accept' && action.supported;
		const response = attachExecutionAuthorization(createHookActionResponse(action, decision === 'accept', runId), this.executionAuthorization, approved);
		this.recordProtocol('out', 'hook action response', { id: action.id, result: response });
		await this.bridge?.respond(action.id, response);
		await this.patchActiveSession({
			status: approved ? 'terminal' : 'planning',
			evidence: this.activeEvidence(`${approved ? 'Started' : 'Declined'} hook execution${action.manifestPath ? ` from ${action.manifestPath}` : ''}.`),
		});
		this.recordTranscript('tool', `${approved ? 'Started' : 'Declined'} hook execution`, action.detail, approved ? 'running' : 'blocked');
		this.updateStatus(`${approved ? 'Started' : 'Declined'} hook execution.`);
	}

	async decideDiff(path: string, status: 'accepted' | 'rejected'): Promise<void> {
		if (!this.activeDiffReview) {
			this.updateStatus('No active diff review is available.');
			return;
		}
		const file = this.activeDiffReview.files.find(candidate => candidate.path === path);
		if (!file) {
			this.updateStatus(`Diff for ${path} is no longer pending.`);
			return;
		}
		if (status === 'accepted' && !this.executionAuthorization) {
			this.recordTranscript('diff', `Blocked diff acceptance before plan execution authorization: ${path}`, file.patch, 'blocked');
			this.updateStatus('Plan approval is required before accepting diff files.');
			return;
		}
		if (status === 'accepted') {
			const modeBlock = this.modeBlockReason('diff');
			if (modeBlock) {
				this.recordTranscript('diff', `Blocked diff acceptance by ${this.lastModePolicy.label} Mode: ${path}`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
		}

		let checkpointId: string | undefined;
		let restored = false;
		try {
			if (status === 'accepted') {
				await this.ensureTaskCheckpoint();
				const existingCheckpoint = this.patchCheckpoints.get(path);
				if (existingCheckpoint && file.status === 'accepted') {
					checkpointId = existingCheckpoint.id;
				} else {
					const result = await applyExternalDiffFile(file);
					this.patchCheckpoints.set(path, result.checkpoint);
					checkpointId = result.checkpoint.id;
				}
			} else {
				restored = await this.restoreCheckpointForPath(path);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.updateStatus(`Could not ${status === 'accepted' ? 'apply' : 'restore'} diff for ${path}: ${message}`);
			return;
		}

		this.activeDiffReview = withDiffFileDecision(this.activeDiffReview, path, status);
		this.postMessage({ type: 'diffReview', review: this.activeDiffReview });
		this.postDiffReviewStatus();
		this.postTaskCheckpointState();
		this.postExecutionGateStatus();
		const diffDecision = {
			source: 'externalExtension',
			reviewId: this.activeDiffReview.reviewId,
			path,
			status,
			...(checkpointId ? { checkpointId } : {}),
			restored,
		};
		this.recordProtocol('out', 'agent/diffDecision', { jsonrpc: '2.0', method: 'agent/diffDecision', params: diffDecision });
		await this.bridge?.notify('agent/diffDecision', diffDecision);
		await this.patchActiveSession({
			status: status === 'accepted' ? 'diff_review' : restored ? 'rollback' : 'diff_review',
			evidence: this.activeEvidence(`${status === 'accepted' ? 'Accepted' : restored ? 'Restored and rejected' : 'Rejected'} diff for ${path}.`),
		});
		this.recordTranscript(status === 'accepted' ? 'diff' : restored ? 'rollback' : 'diff', `${status === 'accepted' ? 'Accepted' : restored ? 'Restored and rejected' : 'Rejected'} diff for ${path}`, file.patch, status === 'accepted' ? 'completed' : restored ? 'completed' : 'blocked');
		this.updateStatus(`${status === 'accepted' ? 'Applied and accepted' : restored ? 'Restored and rejected' : 'Rejected'} diff for ${path}.`);
	}

	async decideAllDiffs(status: 'accepted' | 'rejected'): Promise<void> {
		if (!this.activeDiffReview) {
			this.updateStatus('No active diff review is available.');
			return;
		}
		const files = this.activeDiffReview.files.filter(file => file.status !== status);
		if (!files.length) {
			this.updateStatus(`All diff files are already ${status}.`);
			return;
		}
		if (status === 'accepted') {
			await this.acceptAllDiffsAtomically(files);
			return;
		}
		for (const file of files) {
			await this.decideDiff(file.path, status);
		}
		this.recordTranscript('diff', 'Rejected all diff files', `${files.length} file${files.length === 1 ? '' : 's'} marked rejected.`);
		this.updateStatus(`Rejected ${files.length} diff file${files.length === 1 ? '' : 's'}.`);
	}

	private async acceptAllDiffsAtomically(files: readonly ExternalDiffReview['files'][number][]): Promise<void> {
		if (!this.activeDiffReview) {
			this.updateStatus('No active diff review is available.');
			return;
		}
		if (!this.executionAuthorization) {
			this.recordTranscript('diff', 'Blocked atomic Accept All before plan execution authorization', `${files.length} file${files.length === 1 ? '' : 's'} pending.`, 'blocked');
			this.updateStatus('Plan approval is required before accepting diff files.');
			return;
		}
		try {
			await this.ensureTaskCheckpoint();
			const batch = await applyExternalDiffFilesAtomically(files);
			for (const result of batch.applied) {
				this.patchCheckpoints.set(result.path, result.checkpoint);
				this.activeDiffReview = withDiffFileDecision(this.activeDiffReview, result.path, 'accepted');
			}
			this.postMessage({ type: 'diffReview', review: this.activeDiffReview });
			this.postDiffReviewStatus();
			this.postTaskCheckpointState();
			this.postExecutionGateStatus();
			for (const result of batch.applied) {
				const diffDecision = {
					source: 'externalExtension',
					reviewId: this.activeDiffReview.reviewId,
					path: result.path,
					status: 'accepted',
					checkpointId: result.checkpoint.id,
					atomicBatch: true,
				};
				this.recordProtocol('out', 'agent/diffDecision', { jsonrpc: '2.0', method: 'agent/diffDecision', params: diffDecision });
				await this.bridge?.notify('agent/diffDecision', diffDecision);
			}
			await this.patchActiveSession({
				status: 'diff_review',
				evidence: this.activeEvidence(`Atomically accepted ${batch.applied.length} diff file${batch.applied.length === 1 ? '' : 's'}.`),
			});
			this.recordTranscript('diff', 'Atomically accepted all diff files', batch.applied.map(result => `${result.path} -> ${result.checkpoint.id}`).join('\n'));
			this.updateStatus(`Atomically accepted ${batch.applied.length} diff file${batch.applied.length === 1 ? '' : 's'}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.recordTranscript('rollback', 'Atomic Accept All failed and rolled back', message, 'failed');
			this.updateStatus(message);
		}
	}

	async openDiffPreview(path: string): Promise<void> {
		if (!this.activeDiffReview) {
			this.updateStatus('No active diff review is available.');
			return;
		}
		const file = this.activeDiffReview.files.find(candidate => candidate.path === path);
		if (!file) {
			this.updateStatus(`Diff for ${path} is no longer pending.`);
			return;
		}
		try {
			await this.diffPreviewProvider.open(file, this.patchCheckpoints.get(path));
			this.recordTranscript('diff', `Opened diff preview for ${path}`, 'Native VS Code diff editor opened with Vibe Codex baseline and proposed documents.');
			this.updateStatus(`Opened diff preview for ${path}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.recordTranscript('diff', `Diff preview failed for ${path}`, message, 'failed');
			this.updateStatus(`Could not open diff preview for ${path}: ${message}`);
		}
	}

	async openWorkspacePath(path: string): Promise<void> {
		if (!path.trim()) {
			this.updateStatus('No workspace path was supplied.');
			return;
		}
		try {
			const uri = resolveWorkspaceFileUri(path);
			const stat = await vscode.workspace.fs.stat(uri);
			if (stat.type === vscode.FileType.Directory) {
				await vscode.commands.executeCommand('revealInExplorer', uri);
				this.updateStatus(`Revealed ${path} in Explorer.`);
				return;
			}
			const document = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(document, { preview: false });
			this.updateStatus(`Opened ${path}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.recordTranscript('tool', `Could not open workspace path ${path}`, message, 'failed');
			this.updateStatus(`Could not open ${path}: ${message}`);
		}
	}

	async restoreCheckpoint(path: string): Promise<void> {
		if (!this.activeDiffReview) {
			this.updateStatus('No active diff review is available.');
			return;
		}
		const checkpoint = this.patchCheckpoints.get(path);
		if (!checkpoint) {
			this.updateStatus(`No checkpoint is available for ${path}.`);
			return;
		}
		try {
			await restoreExternalPatchCheckpoint(checkpoint);
			this.patchCheckpoints.delete(path);
			this.activeDiffReview = withDiffFileDecision(this.activeDiffReview, path, 'rejected');
			this.postMessage({ type: 'diffReview', review: this.activeDiffReview });
			this.postDiffReviewStatus();
			this.postTaskCheckpointState();
			this.postExecutionGateStatus();
			const rollback = {
				source: 'externalExtension',
				reviewId: this.activeDiffReview.reviewId,
				path,
				checkpointId: checkpoint.id,
			};
			this.recordProtocol('out', 'agent/diffRollback', { jsonrpc: '2.0', method: 'agent/diffRollback', params: rollback });
			await this.bridge?.notify('agent/diffRollback', rollback);
			await this.patchActiveSession({
				status: 'rollback',
				evidence: this.activeEvidence(`Restored checkpoint ${checkpoint.id} for ${path}.`),
			});
			this.recordTranscript('rollback', `Restored checkpoint for ${path}`, checkpoint.id);
			this.updateStatus(`Restored checkpoint for ${path}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.updateStatus(`Could not restore checkpoint for ${path}: ${message}`);
		}
	}

	async startPreview(id: string): Promise<void> {
		const target = this.previewTarget(id);
		if (!target) {
			this.updateStatus(`Preview target ${id} is not available.`);
			return;
		}
		this.runVisibleTerminal(target.command, target.cwd, `Start preview ${target.label} at ${target.url}`);
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`Started preview ${target.label}: ${target.command}`),
		});
	}

	async openPreview(id: string, url?: string): Promise<void> {
		const target = this.previewTarget(id);
		const previewUrl = target?.url ?? url;
		if (!previewUrl || !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?(?:\/|$)/.test(previewUrl)) {
			this.updateStatus('Only localhost preview URLs can be opened in the embedded preview panel.');
			return;
		}
		const panel = vscode.window.createWebviewPanel('vibecodexPreview', target?.label ?? 'Vibe Codex Preview', vscode.ViewColumn.Beside, { enableScripts: false });
		panel.webview.html = previewPanelHtml(panel.webview, previewUrl, target?.label ?? previewUrl);
		this.updateStatus(`Opened preview panel for ${previewUrl}.`);
	}

	async restoreTaskCheckpoint(): Promise<void> {
		const checkpoints = [...this.patchCheckpoints.values()];
		if (!checkpoints.length) {
			this.updateStatus('No accepted diff checkpoints are available for task rollback.');
			return;
		}
		const restoredPaths: string[] = [];
		const failures: string[] = [];
		for (const checkpoint of checkpoints.reverse()) {
			try {
				await restoreExternalPatchCheckpoint(checkpoint);
				this.patchCheckpoints.delete(checkpoint.path);
				restoredPaths.push(checkpoint.path);
				if (this.activeDiffReview) {
					this.activeDiffReview = withDiffFileDecision(this.activeDiffReview, checkpoint.path, 'rejected');
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				failures.push(`${checkpoint.path}: ${message}`);
			}
		}
		if (this.activeDiffReview) {
			this.postMessage({ type: 'diffReview', review: this.activeDiffReview });
			this.postDiffReviewStatus();
			this.postExecutionGateStatus();
		}
		this.postTaskCheckpointState();
		const evidence = restoredPaths.length
			? `Restored task checkpoint ${this.taskCheckpointId ?? 'task'} for ${restoredPaths.length} file${restoredPaths.length === 1 ? '' : 's'}: ${restoredPaths.join(', ')}.`
			: `Task checkpoint restore failed: ${failures.join('; ')}`;
		await this.patchActiveSession({
			status: restoredPaths.length ? 'rollback' : 'error',
			evidence: this.activeEvidence(evidence),
		});
		await this.notifyTaskRollback(restoredPaths, failures, evidence);
		this.recordTranscript('rollback', restoredPaths.length ? 'Restored task checkpoint' : 'Task checkpoint restore failed', evidence, restoredPaths.length ? 'completed' : 'failed');
		if (failures.length) {
			this.updateStatus(`Task checkpoint partially restored. Failures: ${failures.join('; ')}`);
			return;
		}
		this.updateStatus(evidence);
	}

	private async notifyTaskRollback(restoredPaths: readonly string[], failures: readonly string[], evidence: string): Promise<void> {
		const payload = {
			source: 'externalExtension',
			taskId: this.activePlan?.taskId,
			revision: this.activePlan?.revision,
			sessionId: this.activeSessionId,
			checkpointId: this.taskCheckpointId,
			gitCheckpoint: this.taskGitCheckpoint,
			gitCheckpointSummary: gitCheckpointSummary(this.taskGitCheckpoint),
			restoredPaths,
			failures,
			ok: restoredPaths.length > 0 && failures.length === 0,
			evidence,
		};
		this.recordProtocol('out', 'agent/taskRollback', { jsonrpc: '2.0', method: 'agent/taskRollback', params: payload });
		await this.bridge?.notify('agent/taskRollback', payload);
	}

	async runVerificationCheck(checkId: string): Promise<void> {
		const check = this.lastVerificationPlan?.checks.find(candidate => candidate.id === checkId);
		if (!check || !this.lastVerificationPlan) {
			this.updateStatus(`Verification check ${checkId} is not available.`);
			return;
		}
		let runId: string | undefined;
		if (check.command) {
			runId = this.runVisibleTerminal(check.command, undefined, `Verification: ${check.label}`);
			this.verificationRunChecks.set(runId, check.id);
		}
		const evidence = check.command ? `Started verification check ${check.label}: ${check.command}` : `Recorded diagnostics verification check ${check.label} as running.`;
		await this.updateVerificationCheck(check.id, 'running', evidence, runId);
		this.recordTranscript('verification', `Started verification: ${check.label}`, check.command, 'running');
		this.updateStatus(evidence);
	}

	private async attachTerminalRunToVerification(runId: string, verificationCheckId: string, commandLine: string, source: string): Promise<void> {
		const check = this.lastVerificationPlan?.checks.find(candidate => candidate.id === verificationCheckId);
		if (!check || !this.lastVerificationPlan) {
			const evidence = `Backend terminal run ${runId} requested unknown verification check ${verificationCheckId}: ${commandLine}`;
			this.recordTranscript('verification', 'Terminal run requested unknown verification check', redactSensitiveText(evidence), 'blocked');
			this.updateStatus(`Terminal run started, but verification check ${verificationCheckId} is not available.`);
			return;
		}
		this.verificationRunChecks.set(runId, check.id);
		const evidence = redactSensitiveText(`Started ${source} for verification check ${check.label}: ${commandLine}`);
		await this.updateVerificationCheck(check.id, 'running', evidence, runId);
		this.recordTranscript('verification', `Started backend verification: ${check.label}`, redactSensitiveText(commandLine), 'running');
	}

	async recordVerificationCheck(checkId: string, status: VibeCodexVerificationStatus): Promise<void> {
		if (status === 'pending' || status === 'running') {
			this.updateStatus(`Use Run to mark verification check ${checkId} as running.`);
			return;
		}
		const check = this.lastVerificationPlan?.checks.find(candidate => candidate.id === checkId);
		if (!check) {
			this.updateStatus(`Verification check ${checkId} is not available.`);
			return;
		}
		const evidence = `Marked verification check ${check.label} as ${status}.`;
		await this.updateVerificationCheck(check.id, status, evidence, check.lastRunId);
		this.recordTranscript('verification', `Verification ${status}: ${check.label}`, check.evidence, status === 'failed' ? 'failed' : 'completed');
		this.updateStatus(evidence);
	}

	async prepareParallelWorktrees(): Promise<void> {
		try {
			await this.executeParallelWorktreeOperation('prepare');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.recordTranscript('tool', 'Parallel worktree preparation failed', message, 'failed');
			this.updateStatus(`Could not prepare parallel worktrees: ${message}`);
		}
	}

	async cleanupParallelWorktrees(): Promise<void> {
		try {
			await this.executeParallelWorktreeOperation('cleanup');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.recordTranscript('rollback', 'Parallel worktree cleanup failed', message, 'failed');
			this.updateStatus(`Could not clean parallel worktrees: ${message}`);
		}
	}

	async dispatchParallelLaneFromSidebar(threadId: string): Promise<void> {
		const plan = this.lastParallelPlan;
		if (!plan) {
			this.updateStatus('No parallel agent plan is available.');
			return;
		}
		const thread = plan.threads.find(candidate => candidate.id === threadId);
		if (!thread) {
			this.updateStatus(`Parallel lane ${threadId || 'unknown'} is not available.`);
			return;
		}
		await this.handleParallelLaneDispatchRequest({
			id: `sidebar-dispatch-${Date.now().toString(36)}-${thread.id}`,
			method: 'sidebar/dispatchParallelLane',
			taskId: plan.taskId,
			threadId: thread.id,
			...(thread.worktreePath ? { worktreePath: thread.worktreePath } : {}),
			branchName: thread.branchName,
			promptFocus: thread.promptFocus,
			requestedAt: Date.now(),
		});
	}

	private async executeParallelWorktreeOperation(operation: VibeCodexParallelWorktreeOperation): Promise<VibeCodexWorktreeOperationResult> {
		if (!this.lastParallelPlan) {
			throw new Error('No parallel agent plan is available.');
		}
		const result = operation === 'prepare'
			? await materializeParallelWorktrees(this.lastParallelPlan)
			: await cleanupParallelWorktreePlan(this.lastParallelPlan);
		this.lastParallelPlan = result.plan;
		this.postParallelPlan(result.plan);
		const evidence = result.evidence.join('\n');
		await this.patchActiveSession({
			parallelPlan: result.plan,
			evidence: this.activeEvidence(evidence),
		});
		const failed = result.plan.threads.some(thread => thread.status === 'failed');
		this.recordTranscript(
			operation === 'prepare' ? 'tool' : 'rollback',
			operation === 'prepare' ? 'Prepared parallel git worktrees' : 'Cleaned parallel git worktrees',
			evidence,
			failed ? 'failed' : 'completed',
		);
		this.updateStatus(result.evidence.join(' '));
		return result;
	}

	async interruptTerminalRun(runId: string): Promise<void> {
		const run = this.terminalRuns.get(runId);
		if (!run) {
			this.updateStatus(`Terminal run ${runId} is no longer tracked.`);
			return;
		}
		this.terminalRunner.interrupt(runId);
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`Interrupted terminal run ${runId}: ${run.commandLine}`),
		});
		this.recordTranscript('terminal', `Interrupted terminal run ${runId}`, run.commandLine, 'blocked');
		this.updateStatus(`Interrupted terminal run ${runId}.`);
	}

	async retryTerminalRun(runId: string): Promise<void> {
		const run = this.terminalRuns.get(runId);
		if (!run) {
			this.updateStatus(`Terminal run ${runId} is no longer tracked.`);
			return;
		}
		const retryId = this.runVisibleTerminal(run.commandLine, run.cwd, run.reason ? `Retry: ${run.reason}` : 'Retry terminal run');
		await this.inheritTerminalRunRequestForRetry(run, retryId, {
			id: `sidebar-retry-${retryId}`,
			method: 'sidebar/retryTerminalRun',
			expectedBy: 'terminal_retry',
			source: 'sidebar terminal retry',
		});
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`Retried terminal run ${runId} as ${retryId}: ${run.commandLine}`),
		});
		this.recordTranscript('terminal', `Retried terminal run ${runId}`, `${retryId}: ${run.commandLine}`, 'running');
	}

	async proceedTerminalRun(runId: string, source = 'sidebar'): Promise<boolean> {
		const run = this.terminalRuns.get(runId);
		if (!run) {
			this.updateStatus(`Terminal run ${runId} is no longer tracked.`);
			return false;
		}
		const running = run.status === 'running';
		if (running) {
			this.proceededTerminalRuns.add(run.id);
		}
		this.postTerminalRun(run);
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(running
				? `${source} proceeding while terminal run ${run.id} continues in the background: ${run.commandLine}`
				: `${source} proceed inspected terminal run ${run.id}, but it is already ${run.status}: ${run.commandLine}`),
		});
		this.recordTranscript('terminal', running ? `Proceeding while terminal continues: ${run.id}` : `Proceed inspected completed terminal: ${run.id}`, run.commandLine, running ? 'running' : 'completed');
		this.updateStatus(running ? `Proceeding while terminal run ${run.id} continues.` : `Terminal run ${run.id} is already ${run.status}.`);
		return running;
	}

	private terminalRunForControl(request: VibeCodexTerminalControlRequest): VibeCodexCapturedTerminalRun | undefined {
		if (request.runId) {
			return this.terminalRuns.get(request.runId);
		}
		const runs = [...this.terminalRuns.values()];
		return request.latest ? runs[runs.length - 1] : undefined;
	}

	private async handleTerminalControlRequest(request: VibeCodexTerminalControlRequest): Promise<void> {
		const run = this.terminalRunForControl(request);
		if (!run) {
			const response = createTerminalControlResponse(request, undefined);
			this.recordProtocol('out', 'terminal control missing run', { id: request.id, result: response });
			await this.bridge?.respond(request.id, response);
			this.postTerminalControlStatus(response);
			this.recordTranscript('terminal', 'Terminal control unavailable', terminalControlSummary(response), 'blocked');
			this.updateStatus(response.message);
			return;
		}
		if (request.action === 'status') {
			const response = createTerminalControlResponse(request, run);
			this.recordProtocol('out', 'terminal status response', { id: request.id, result: response });
			await this.bridge?.respond(request.id, response);
			this.postTerminalControlStatus(response);
			this.recordTranscript('terminal', 'Returned terminal status', terminalControlSummary(response), 'completed');
			this.updateStatus(terminalControlSummary(response));
			return;
		}
		if (request.action === 'proceed') {
			const proceeded = await this.proceedTerminalRun(run.id, 'backend');
			const response = createTerminalControlResponse(request, run, {
				message: proceeded
					? `Terminal run ${run.id} will continue streaming in the background; backend may proceed.`
					: `Terminal run ${run.id} is ${run.status}; backend proceed was recorded as an inspection.`,
			}, proceeded);
			this.recordProtocol('out', 'terminal proceed response', { id: request.id, result: response });
			await this.bridge?.respond(request.id, response);
			this.postTerminalControlStatus(response);
			this.recordTranscript('terminal', proceeded ? `Backend proceeding while terminal continues: ${run.id}` : `Backend proceed inspected terminal: ${run.id}`, terminalControlSummary(response), proceeded ? 'running' : 'completed');
			this.updateStatus(terminalControlSummary(response));
			return;
		}
		const modeBlock = this.modeBlockReason('terminal');
		if (modeBlock) {
			const response = createTerminalControlResponse(request, run, { message: modeBlock });
			this.recordProtocol('out', 'terminal control blocked by mode policy', { id: request.id, modePolicy: this.lastModePolicy, reason: modeBlock, result: response });
			await this.bridge?.respond(request.id, { ...response, ok: false });
			this.postTerminalControlStatus({ ...response, ok: false });
			this.recordTranscript('terminal', `Blocked terminal ${request.action} by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
			this.updateStatus(modeBlock);
			return;
		}
		if (!this.executionAuthorization) {
			const message = 'Plan approval is required before backend terminal control.';
			const response = createTerminalControlResponse(request, run, { message });
			this.recordProtocol('out', 'terminal control rejected before approved plan', { id: request.id, approvedPlan: executionAuthorizationSummary(this.executionAuthorization), result: response });
			await this.bridge?.respond(request.id, { ...response, ok: false });
			this.postTerminalControlStatus({ ...response, ok: false });
			this.recordTranscript('terminal', `Rejected terminal ${request.action} before plan execution authorization`, run.commandLine, 'blocked');
			this.updateStatus(message);
			return;
		}
		if (request.action === 'interrupt') {
			this.terminalRunner.interrupt(run.id);
			const response = attachExecutionAuthorization(createTerminalControlResponse(request, run), this.executionAuthorization, true);
			this.recordProtocol('out', 'terminal interrupt response', { id: request.id, result: response });
			await this.bridge?.respond(request.id, response);
			this.postTerminalControlStatus(response);
			await this.patchActiveSession({
				status: 'terminal',
				evidence: this.activeEvidence(`Backend interrupted terminal run ${run.id}: ${run.commandLine}`),
			});
			this.recordTranscript('terminal', `Backend interrupted terminal run ${run.id}`, run.commandLine, 'blocked');
			this.updateStatus(`Interrupted terminal run ${run.id}.`);
			return;
		}
		const retryId = this.runVisibleTerminal(run.commandLine, run.cwd, run.reason ? `Backend retry: ${run.reason}` : 'Backend retry terminal run');
		await this.inheritTerminalRunRequestForRetry(run, retryId, {
			id: request.id,
			method: request.method,
			expectedBy: 'terminal_retry',
			source: 'backend terminal retry',
		});
		const response = attachExecutionAuthorization(createTerminalControlResponse(request, run, { retryRunId: retryId }), this.executionAuthorization, true);
		this.recordProtocol('out', 'terminal retry response', { id: request.id, result: response });
		await this.bridge?.respond(request.id, response);
		this.postTerminalControlStatus(response);
		await this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`Backend retried terminal run ${run.id} as ${retryId}: ${run.commandLine}`),
		});
		this.recordTranscript('terminal', `Backend retried terminal run ${run.id}`, `${retryId}: ${run.commandLine}`, 'running');
	}

	private async copyCommitMessage(): Promise<void> {
		const handoff = this.lastCommitHandoff ?? createCommitHandoff({
			plan: this.activePlan,
			diffReview: this.activeDiffReview,
			verificationPlan: this.lastVerificationPlan,
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
		});
		await vscode.env.clipboard.writeText(handoff.message);
		this.recordTranscript('system', 'Copied Vibe Codex commit message', handoff.summary, handoff.ready ? 'completed' : 'pending');
		this.updateStatus('Copied Vibe Codex commit message to clipboard.');
	}

	private async updateVerificationCheck(checkId: string, status: VibeCodexVerificationStatus, evidence: string, runId?: string): Promise<void> {
		if (!this.lastVerificationPlan) {
			return;
		}
		try {
			this.lastVerificationPlan = withVerificationCheckStatus(this.lastVerificationPlan, checkId, status, evidence, runId);
			this.postVerificationPlan(this.lastVerificationPlan);
			const check = this.lastVerificationPlan.checks.find(candidate => candidate.id === checkId);
			await this.patchActiveSession({
				verificationPlan: this.lastVerificationPlan,
				evidence: this.activeEvidence(evidence),
			});
			const payload = {
				source: 'externalExtension',
				checkId,
				status,
				runId,
				evidence,
				check,
				taskId: this.activePlan?.taskId,
				revision: this.activePlan?.revision,
			};
			if (this.bridge?.connected) {
				this.recordProtocol('out', 'agent/verificationEvidence', { jsonrpc: '2.0', method: 'agent/verificationEvidence', params: payload });
				await this.bridge.notify('agent/verificationEvidence', payload);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.updateStatus(`Could not update verification check: ${message}`);
		}
	}

	async handleUri(uri: vscode.Uri): Promise<void> {
		const intake = normalizeExternalTaskUri(uri);
		if (intake) {
			await this.queueExternalTaskIntake(intake);
			return;
		}
		const command = this.commandFromUri(uri);
		if (command && await this.tryRunNative(command, uri.toString())) {
			return;
		}
		await this.openAgent();
		this.updateStatus(`Received Vibe Codex URI: ${uri.toString(true)}`);
	}

	private async handleWebviewMessage(message: unknown): Promise<void> {
		if (!isWebviewCommandMessage(message)) {
			return;
		}
		switch (message.command) {
			case 'open':
				await this.openAgent();
				break;
			case 'login':
				await this.login();
				break;
			case 'configure':
				await this.configureProvider();
				break;
			case 'provider':
				await this.selectProvider();
				break;
			case 'model':
				await this.selectModel();
				break;
			case 'modeModel':
				await this.selectModeModel();
				break;
			case 'clearProviderCredentials':
				await this.clearProviderCredentials();
				break;
			case 'newChatSession':
				this.newChatSession();
				break;
			case 'startTask':
				await this.handlePromptCommand('startTask', message.mode ?? 'agent', message.prompt ?? '');
				break;
			case 'queueTask':
				await this.handlePromptCommand('queueTask', message.mode ?? 'agent', message.prompt ?? '');
				break;
			case 'queueTaskAfter':
				await this.handlePromptCommand('queueTask', message.mode ?? 'agent', message.prompt ?? '', [String(message.id ?? '')]);
				break;
			case 'startTaskBoardCard':
				await this.startTaskBoardCard(String(message.id ?? ''));
				break;
			case 'setTaskBoardStatus':
				await this.setTaskBoardCardStatus(String(message.id ?? ''), normalizeTaskBoardStatusMessage(message.status));
				break;
			case 'archiveTaskBoardCard':
				await this.archiveTaskBoardCard(String(message.id ?? ''));
				break;
			case 'runTerminal':
				await this.handlePromptCommand('runTerminal', message.mode ?? 'agent', message.prompt ?? '');
				break;
			case 'refreshMentions':
				await this.postMentionSuggestions();
				await this.postSlashCommandSuggestions();
				break;
			case 'openWorkspacePath':
				await this.openWorkspacePath(String(message.path ?? ''));
				break;
			case 'toggleAutoApprove':
				await this.toggleAutoApproveSetting(String(message.key ?? ''), Boolean(message.value));
				break;
			case 'setAutoApproveRisk':
				await this.setAutoApproveRisk(String(message.value ?? 'medium'));
				break;
			case 'connectBackend':
				await this.connectExternalBackend();
				break;
			case 'disconnectBackend':
				this.disconnectExternalBackend('sidebar disconnect');
				break;
			case 'restartBackend':
				await this.restartExternalBackend();
				break;
			case 'approvePlan':
				await this.approveExternalPlan(message);
				break;
			case 'refinePlan':
				await this.refineExternalPlan(String(message.feedback ?? ''), message);
				break;
			case 'rejectPlan':
				await this.rejectExternalPlan(String(message.feedback ?? ''), message);
				break;
				case 'editPlanStep':
					await this.editPlanStep(message, String(message.stepId ?? ''), typeof message.title === 'string' ? message.title : undefined, typeof message.status === 'string' ? message.status : undefined);
					break;
				case 'planFocusChanged':
					await this.handlePlanFocusChanged(message);
					break;
				case 'restorePlanRevision':
					this.restorePlanRevision(String(message.id ?? ''));
					break;
			case 'copyCommitMessage':
				await this.copyCommitMessage();
				break;
			case 'openSourceControl':
				await vscode.commands.executeCommand('workbench.view.scm');
				this.updateStatus('Opened Source Control for commit handoff.');
				break;
			case 'runGitStatus':
				this.runVisibleTerminal('git status --short', undefined, 'Commit handoff status');
				break;
			case 'approvalDecision':
				await this.decideApproval(String(message.id ?? ''), message.decision === 'accept' ? 'accept' : 'decline');
				break;
			case 'browserActionDecision':
				await this.decideBrowserAction(String(message.id ?? ''), message.decision === 'accept' ? 'accept' : 'decline');
				break;
			case 'mcpActionDecision':
				await this.decideMcpAction(String(message.id ?? ''), message.decision === 'accept' ? 'accept' : 'decline');
				break;
			case 'webFetchDecision':
				await this.decideWebFetch(String(message.id ?? ''), message.decision === 'accept' ? 'accept' : 'decline');
				break;
			case 'userInputResponse':
				await this.answerUserInputRequest(String(message.id ?? ''), String(message.answer ?? ''), Boolean(message.cancelled), numberValue(message.selectedSuggestionIndex));
				break;
			case 'hookActionDecision':
				await this.decideHookAction(String(message.id ?? ''), message.decision === 'accept' ? 'accept' : 'decline');
				break;
			case 'diffDecision':
				await this.decideDiff(String(message.path ?? ''), message.status === 'accepted' ? 'accepted' : 'rejected');
				break;
			case 'openDiffPreview':
				await this.openDiffPreview(String(message.path ?? ''));
				break;
			case 'acceptAllDiffs':
				await this.decideAllDiffs('accepted');
				break;
			case 'rejectAllDiffs':
				await this.decideAllDiffs('rejected');
				break;
			case 'restoreDiff':
				await this.restoreCheckpoint(String(message.path ?? ''));
				break;
			case 'restoreTaskCheckpoint':
				await this.restoreTaskCheckpoint();
				break;
			case 'runVerificationCheck':
				await this.runVerificationCheck(String(message.checkId ?? ''));
				break;
			case 'recordVerificationCheck':
				await this.recordVerificationCheck(String(message.checkId ?? ''), normalizeVerificationStatusMessage(message.status));
				break;
			case 'prepareParallelWorktrees':
				await this.prepareParallelWorktrees();
				break;
			case 'cleanupParallelWorktrees':
				await this.cleanupParallelWorktrees();
				break;
			case 'dispatchParallelLane':
				await this.dispatchParallelLaneFromSidebar(String(message.threadId ?? ''));
				break;
			case 'requestParallelMerge':
				await this.requestParallelMerge(String(message.threadId ?? ''));
				break;
			case 'interruptTerminalRun':
				await this.interruptTerminalRun(String(message.id ?? ''));
				break;
			case 'retryTerminalRun':
				await this.retryTerminalRun(String(message.id ?? ''));
				break;
			case 'proceedTerminalRun':
				await this.proceedTerminalRun(String(message.id ?? ''));
				break;
			case 'restoreSession':
				await this.restoreSession(String(message.sessionId ?? ''));
				break;
			case 'exportSession':
				await this.exportSession(String(message.sessionId ?? ''));
				break;
			case 'startPreview':
				await this.startPreview(String(message.id ?? ''));
				break;
			case 'openPreview':
				await this.openPreview(String(message.id ?? ''), typeof message.url === 'string' ? message.url : undefined);
				break;
		}
	}

	private async handlePromptCommand(command: 'startTask' | 'queueTask' | 'runTerminal', mode: string, prompt: string, dependsOn: readonly string[] = []): Promise<void> {
		const prepared = await this.preparePromptInput(mode, prompt);
		if (command === 'queueTask' || prepared.slashCommand?.route === 'queueTask') {
			await this.queueTaskBoardPrompt(prepared.mode, prepared.prompt, dependsOn, prepared.slashCommand);
			return;
		}
		if (command === 'runTerminal') {
			await this.runExternalCodexTask(prepared.mode, prepared.prompt, prepared.slashCommand);
			return;
		}
		await this.startExternalTask(prepared.mode, prepared.prompt, undefined, prepared.slashCommand);
	}

	private newChatSession(): void {
		this.activeSessionId = undefined;
		this.activeTaskBoardCardId = undefined;
		this.activePlan = undefined;
		this.lastValidPlanCanvasGraph = undefined;
		this.activeDiffReview = undefined;
		this.approvalCards.clear();
		this.browserActions.clear();
		this.mcpActions.clear();
		this.postMcpStatus();
		this.webFetches.clear();
			this.hookActions.clear();
			this.userInputRequests.clear();
			this.postUserInputStatus();
			this.lastPrompt = '';
		this.lastSlashCommand = undefined;
		this.lastInlinePromptSession = undefined;
		this.lastRuleProposal = undefined;
		this.lastSessionRecall = undefined;
		this.lastDocsContext = undefined;
		this.lastTaskCompletionResponse = undefined;
		this.terminalRemediations = [];
		this.planRevisionHistory = [];
		this.transcriptEvents = [];
		this.resetTaskCheckpoint();
		this.clearExecutionAuthorization();
		this.postPlanRevisionHistory();
		this.postInlinePromptSession(undefined);
		this.postRuleProposal(undefined);
		this.postSessionRecall(undefined);
		this.postDocsContext(undefined);
		this.postTerminalRemediationStatus();
		this.postTranscript();
		this.postSessionHistory();
		this.postMessage({ type: 'chatReset' });
		this.updateStatus('Started a new Vibe Codex chat. Previous chats remain available in tabs and history.');
	}

	private resetTransientSessionStateForRestore(): void {
		this.activePlan = undefined;
		this.lastValidPlanCanvasGraph = undefined;
		this.activeDiffReview = undefined;
		this.executionAuthorization = undefined;
		this.approvalCards.clear();
		this.browserActions.clear();
		this.mcpActions.clear();
		this.webFetches.clear();
		this.hookActions.clear();
		this.userInputRequests.clear();
		this.terminalRuns.clear();
		this.terminalRunRequests.clear();
		this.terminalRunRequestHistory.clear();
		this.reportedParallelTerminalRuns.clear();
		this.proceededTerminalRuns.clear();
		this.lastTerminalCommandValidationRequest = undefined;
		this.lastTerminalCommandValidationResponse = undefined;
		this.lastTerminalOutputRequest = undefined;
		this.terminalOutputStreamStates.clear();
		this.terminalInsights.clear();
		this.terminalInsightSignatures.clear();
		this.terminalRemediations = [];
		for (const timer of this.terminalNotificationTimers.values()) {
			clearTimeout(timer);
		}
		this.terminalNotificationTimers.clear();
		this.longRunningTerminalNotifications.clear();
		this.verificationRunChecks.clear();
		this.patchCheckpoints.clear();
		this.taskCheckpointId = undefined;
		this.taskGitCheckpoint = undefined;
		this.lastSentFinalReviewSignature = undefined;
		this.lastCustomModeCatalog = undefined;
		this.lastInlinePromptSession = undefined;
		this.lastContext = undefined;
		this.lastProvider = undefined;
		this.lastParallelPlan = undefined;
		this.parallelResults = [];
		this.lastParallelReview = undefined;
		this.lastParallelMergeRequest = undefined;
		this.lastParallelMergeDiffReviewId = undefined;
		this.lastVerificationPlan = undefined;
		this.lastVerificationCriteriaKey = '';
		this.lastWorkspaceGuidance = undefined;
		this.lastRuleProposal = undefined;
		this.lastSessionRecall = undefined;
		this.lastDocsContext = undefined;
		this.lastMemoryBank = undefined;
		this.lastPreviewPlan = undefined;
		this.lastMcpCatalog = undefined;
		this.lastToolCatalog = undefined;
		this.lastDiagnosticsSnapshot = undefined;
		this.lastCommitHandoff = undefined;
		this.lastTaskCompletionResponse = undefined;
		this.lastPlanFocusEventKey = '';
		this.lastPlanFocusEventAt = 0;
	}

	private async preparePromptInput(mode: string, prompt: string, slashCommand?: VibeCodexSlashCommandContext): Promise<{ readonly mode: string; readonly prompt: string; readonly slashCommand?: VibeCodexSlashCommandContext }> {
		const parsed = slashCommand ?? parseSlashCommandPrompt(prompt, normalizeMode(mode), await collectSlashCommandSuggestions());
		const enriched = parsed ? await this.enrichSlashWorkflowContext(parsed) : undefined;
		return {
			mode: normalizeMode(slashCommand ? mode : enriched?.modeOverride ?? mode),
			prompt: slashCommand ? prompt.trim() : enriched?.normalizedPrompt ?? prompt.trim(),
			...(enriched ? { slashCommand: enriched } : {}),
		};
	}

	private async enrichSlashWorkflowContext(context: VibeCodexSlashCommandContext): Promise<VibeCodexSlashCommandContext> {
		if (context.command !== 'workflow' || !context.workflowPath || context.workflowContent) {
			return context;
		}
		return {
			...context,
			workflowContent: await this.loadSlashWorkflowFile(context.workflowPath),
		};
	}

	private async loadSlashWorkflowFile(workflowPath: string): Promise<VibeCodexSlashWorkflowContent> {
		const normalizedPath = workflowPath.replace(/\\/g, '/').replace(/^\/+/, '');
		if (!isAllowedSlashWorkflowPath(normalizedPath)) {
			return {
				path: normalizedPath,
				error: 'Workflow path is not under a supported Cline/Cursor/VibeCodex workflow location.',
			};
		}
		try {
			const uri = resolveWorkspaceFileUri(normalizedPath);
			await assertWorkspaceUriHasNoSymlinkTraversal(uri, normalizedPath);
			const bytes = await vscode.workspace.fs.readFile(uri);
			const truncated = bytes.byteLength > maxSlashWorkflowContentBytes;
			const text = new TextDecoder('utf-8').decode(truncated ? bytes.slice(0, maxSlashWorkflowContentBytes) : bytes);
			return {
				path: normalizedPath,
				text: redactSensitiveText(text).slice(0, maxSlashWorkflowContentBytes),
				byteLength: bytes.byteLength,
				truncated,
			};
		} catch (error) {
			return {
				path: normalizedPath,
				error: redactSensitiveText(error instanceof Error ? error.message : String(error)).slice(0, 1000),
			};
		}
	}

	private async tryRunNative(command: string, ...args: unknown[]): Promise<boolean> {
		if (!this.prefersNativeHost() || !this.nativeCommandSnapshot.has(command)) {
			return false;
		}
		await vscode.commands.executeCommand(command, ...args);
		return true;
	}

	private prefersNativeHost(): boolean {
		return vscode.workspace.getConfiguration('vibeCodex.extension').get<boolean>('preferNativeHost', true);
	}

	private codexCommand(): string {
		return vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('codexCommand', 'codex').trim() || 'codex';
	}

	private codexArgs(): string[] {
		const configured = vscode.workspace.getConfiguration('vibeCodex.extension').get<unknown[]>('codexArgs', []);
		return configured.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map(value => value.trim());
	}

	private appServerArgs(): string[] {
		const configured = vscode.workspace.getConfiguration('vibeCodex.extension').get<unknown[]>('appServerArgs', ['app-server']);
		const args = configured.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map(value => value.trim());
		return args.length ? args : ['app-server'];
	}

	private bridgeTransport(): 'stdio' | 'pipe' | 'websocket' {
		const configured = vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('transport', 'stdio');
		if (configured === 'pipe' || configured === 'websocket') {
			return configured;
		}
		return 'stdio';
	}

	private messageFraming(): JsonRpcFraming {
		const configured = vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('messageFraming', 'ndjson');
		return configured === 'content-length' ? 'content-length' : 'ndjson';
	}

	private pipePath(): string | undefined {
		return vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('pipePath', '').trim() || undefined;
	}

	private websocketUrl(): string | undefined {
		return vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('websocketUrl', '').trim() || undefined;
	}

	private commandPermissionPolicy(): VibeCodexCommandPermissionPolicy {
		const config = vscode.workspace.getConfiguration('vibeCodex.extension.commandPermissions');
		return normalizeCommandPermissionPolicy({
			allow: config.get<unknown[]>('allow', []).filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
			deny: config.get<unknown[]>('deny', []).filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
			defaultAllow: config.get<boolean>('defaultAllow', true),
			clineCommandPermissions: process.env.CLINE_COMMAND_PERMISSIONS,
		});
	}

	private parallelThreads(): number {
		const value = vscode.workspace.getConfiguration('vibeCodex.extension').get<number>('parallelThreads', 1);
		return Math.max(1, Math.min(8, Math.floor(value)));
	}

	private workspaceRootPath(): string | undefined {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}

	private loadTaskBoard(): void {
		this.taskBoard = sanitizeTaskBoard(this.extensionContext.globalState.get(taskBoardStorageKey));
		this.postTaskBoard();
	}

	private async saveTaskBoard(board: VibeCodexTaskBoard): Promise<void> {
		this.taskBoard = board;
		await this.extensionContext.globalState.update(taskBoardStorageKey, board);
		this.postTaskBoard();
	}

	private async queueTaskBoardPrompt(mode: string, prompt: string, dependsOn: readonly string[] = [], slashCommand?: VibeCodexSlashCommandContext): Promise<void> {
		const prepared = await this.preparePromptInput(mode, prompt, slashCommand);
		const trimmed = prepared.prompt.trim();
		if (!trimmed) {
			this.updateStatus('Enter a task prompt before queueing it on the Task Board.');
			return;
		}
		const board = queueTaskBoardCard(this.taskBoard, {
			mode: prepared.mode,
			prompt: trimmed,
			source: 'sidebar',
			dependsOn,
			parallelThreads: this.parallelThreads(),
			evidence: prepared.slashCommand ? [slashCommandSummary(prepared.slashCommand)] : ['Queued from the Vibe Codex sidebar.'],
		});
		await this.saveTaskBoard(board);
		const detail = [
			`${modeLabel(prepared.mode)} · ${trimmed.slice(0, 240)}`,
			prepared.slashCommand ? slashCommandSummary(prepared.slashCommand) : undefined,
		].filter(Boolean).join('\n');
		this.recordTranscript('system', prepared.slashCommand?.command === 'newtask' ? 'Queued /newtask card' : 'Queued Task Board card', detail);
		this.updateStatus(prepared.slashCommand ? `Queued ${prepared.slashCommand.label} on the Vibe Codex Task Board.` : 'Queued task on the Vibe Codex Task Board.');
	}

	private async queueDelegatedTask(request: VibeCodexDelegatedTaskRequest): Promise<string | undefined> {
		const board = queueTaskBoardCard(this.taskBoard, {
			title: request.title,
			mode: normalizeMode(request.mode),
			prompt: request.prompt,
			source: 'delegated',
			dependsOn: request.dependsOn,
			parallelThreads: request.parallelThreads,
			evidence: delegatedTaskEvidence(request),
		});
		const card = board.cards[0];
		await this.saveTaskBoard(board);
		const detail = [
			request.reason,
			request.parentTaskId ? `Parent: ${request.parentTaskId}` : undefined,
			request.dependsOn.length ? `Depends on: ${request.dependsOn.join(', ')}` : undefined,
			`Mode: ${normalizeMode(request.mode)}`,
		].filter(Boolean).join('\n');
		this.recordTranscript('tool', `Queued delegated task: ${request.title}`, `${detail}\n\n${request.prompt}`.trim(), 'pending');
		this.updateStatus(`Queued delegated task "${request.title}" on the Task Board.`);
		return card?.id;
	}

	private async queueExternalTaskIntake(intake: VibeCodexExternalTaskIntake): Promise<void> {
		await this.revealExtensionView();
		this.recordProtocol('in', 'external task URI intake', intake);
		let board = queueTaskBoardCard(this.taskBoard, {
			title: intake.title,
			mode: normalizeMode(intake.mode),
			prompt: intake.prompt,
			source: intake.triggerKind,
			dependsOn: intake.dependsOn,
			parallelThreads: intake.parallelThreads,
			evidence: externalTaskEvidence(intake),
		});
		const card = board.cards[0];
		if (!card) {
			this.updateStatus('External task URI did not contain a task prompt.');
			return;
		}
		board = updateTaskBoardCardStatus(board, card.id, card.status, externalTaskIntakeSummary(intake));
		await this.saveTaskBoard(board);
		const detail = [
			externalTaskIntakeSummary(intake),
			'',
			intake.prompt,
			'',
			externalTaskIntakePromptBlock(intake),
		].join('\n');
		this.recordTranscript('system', `Queued external ${intake.triggerKind} task: ${intake.title}`, detail, 'pending');
		this.updateStatus(intake.startRequested ? `Queued external task "${intake.title}" and starting visual Plan Mode.` : `Queued external task "${intake.title}" on the Task Board.`);
		if (intake.startRequested) {
			await this.startTaskBoardCard(card.id);
		}
	}

	private async startTaskBoardCard(cardId: string): Promise<void> {
		const card = this.taskBoard.cards.find(candidate => candidate.id === cardId);
		if (!card) {
			this.updateStatus('Task Board card was not found.');
			return;
		}
		const readiness = taskBoardCardReadiness(this.taskBoard, cardId);
		if (!readiness.ready) {
			await this.saveTaskBoard(updateTaskBoardCardStatus(this.taskBoard, cardId, 'blocked', readiness.blockers.join('; ') || 'Dependencies are not complete.'));
			this.updateStatus(`Task Board card is blocked: ${readiness.blockers.join('; ')}`);
			return;
		}
		await this.saveTaskBoard(updateTaskBoardCardStatus(this.taskBoard, cardId, 'running', 'Started from the Vibe Codex Task Board.'));
		this.activeTaskBoardCardId = cardId;
		this.recordTranscript('system', `Started Task Board card ${card.title}`, taskBoardPromptBlock(this.taskBoard, cardId));
		await this.startExternalTask(card.mode, card.prompt);
	}

	private async setTaskBoardCardStatus(cardId: string, status: VibeCodexTaskBoardStatus): Promise<void> {
		const card = this.taskBoard.cards.find(candidate => candidate.id === cardId);
		if (!card) {
			this.updateStatus('Task Board card was not found.');
			return;
		}
		await this.saveTaskBoard(updateTaskBoardCardStatus(this.taskBoard, cardId, status, `Marked ${status} from the sidebar.`));
		this.recordTranscript(status === 'blocked' ? 'tool' : 'system', `Task Board card ${status}: ${card.title}`, card.prompt.slice(0, 800), status === 'blocked' ? 'blocked' : 'completed');
		this.updateStatus(`Marked Task Board card "${card.title}" as ${status}.`);
	}

	private async archiveTaskBoardCard(cardId: string): Promise<void> {
		const card = this.taskBoard.cards.find(candidate => candidate.id === cardId);
		if (!card) {
			this.updateStatus('Task Board card was not found.');
			return;
		}
		await this.saveTaskBoard(archiveTaskBoardCard(this.taskBoard, cardId));
		this.recordTranscript('system', `Archived Task Board card ${card.title}`, card.prompt.slice(0, 800));
		this.updateStatus(`Archived Task Board card "${card.title}".`);
	}

		private postTaskBoard(): void {
			this.postMessage({
				type: 'taskBoard',
				summary: taskBoardSummary(this.taskBoard),
				board: this.taskBoard,
			});
			this.postTaskBoardStatus();
			this.postTaskStartStatus();
			this.postExternalIntakeStatus();
			this.postConnectorScheduleStatus();
		}

	private postTaskBoardStatus(response?: VibeCodexTaskBoardStatusResponse): void {
		const status = response ?? this.currentTaskBoardStatus();
		this.postMessage({
			type: 'taskBoardStatus',
			summary: taskBoardStatusSummary(status),
			status,
		});
	}

		private currentTaskBoardStatus(request?: VibeCodexTaskBoardStatusRequest): VibeCodexTaskBoardStatusResponse {
			return createTaskBoardStatusResponse(request ?? {
				id: 'sidebar-task-board-status',
				method: 'sidebar/taskBoardStatus',
			includeArchived: false,
			includePrompts: false,
			includeEvidence: false,
			requestedAt: Date.now(),
			}, { board: this.taskBoard });
		}

		private postTaskStartStatus(response?: VibeCodexTaskStartStatusResponse): void {
			const status = response ?? createTaskStartStatusResponse({
				id: 'sidebar-task-start-status',
				method: 'sidebar/taskStartStatus',
				...(this.activeTaskBoardCardId ? { cardId: this.activeTaskBoardCardId } : {}),
				includePromptBlock: false,
				includeEvidence: false,
				requestedAt: Date.now(),
			}, { board: this.taskBoard });
			this.postMessage({
				type: 'taskStartStatus',
				summary: taskStartStatusSummary(status),
				status,
			});
		}

		private postExternalIntakeStatus(response?: VibeCodexExternalIntakeStatusResponse): void {
		const status = response ?? createExternalIntakeStatusResponse({
			id: 'sidebar-external-intake-status',
			method: 'sidebar/externalIntakeStatus',
			includeExamples: true,
			includeQueueCounts: true,
			requestedAt: Date.now(),
		}, { board: this.taskBoard });
		this.postMessage({
			type: 'externalIntakeStatus',
			summary: externalIntakeStatusSummary(status),
			status,
		});
	}

	private postConnectorScheduleStatus(response?: VibeCodexConnectorScheduleStatusResponse): void {
		const status = response ?? createConnectorScheduleStatusResponse({
			id: 'sidebar-connector-schedule-status',
			method: 'sidebar/connectorScheduleStatus',
			family: 'all',
			includeExamples: true,
			includeQueue: true,
			includePromptBlock: false,
			maxCards: 8,
			requestedAt: Date.now(),
		}, { board: this.taskBoard });
		this.postMessage({
			type: 'connectorScheduleStatus',
			summary: connectorScheduleStatusSummary(status),
			status,
		});
	}

	private createBackendTaskContext(mode: string, prompt: string, context: VibeCodexContextPack | undefined, provider: VibeCodexProviderRuntimeConfig | undefined, modePolicy: VibeCodexModePolicy | undefined, commandPermissionPolicy: VibeCodexCommandPermissionPolicy | undefined, parallelPlan: VibeCodexParallelPlan | undefined, verificationPlan: VibeCodexVerificationPlan | undefined, customModeCatalog: VibeCodexCustomModeCatalog | undefined, sessionRecall: VibeCodexSessionRecall | undefined, docsContext: VibeCodexDocsContext | undefined, workspaceGuidance: VibeCodexWorkspaceGuidance | undefined, ruleProposal: VibeCodexRuleProposal | undefined, memoryBank: VibeCodexMemoryBank | undefined, previewPlan: VibeCodexPreviewPlan | undefined, mcpCatalog: VibeCodexMcpCatalog | undefined): Record<string, unknown> {
		const workspaceRoots = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];
		const visibleTaskCards = this.taskBoard.cards.filter(card => card.status !== 'archived');
		return {
			prompt,
			mode,
			source: 'externalExtension',
			requireVisualPlan: true,
			approvalPolicy: 'on-request',
			cwd: workspaceRoots[0],
			runtimeWorkspaceRoots: workspaceRoots,
			...(modePolicy ? {
				modePolicy,
				modePolicySummary: modePolicySummary(modePolicy),
			} : {}),
			...(commandPermissionPolicy ? {
				commandPermissionPolicy,
				commandPermissionSummary: commandPermissionSummary(commandPermissionPolicy),
				commandPermissionPrompt: commandPermissionPromptBlock(commandPermissionPolicy),
			} : {}),
			...(this.lastSlashCommand ? {
				slashCommand: this.lastSlashCommand,
				slashCommandPrompt: slashCommandPromptBlock(this.lastSlashCommand),
			} : {}),
			...(context ? {
				vibecodexContext: context,
				contextSummary: summarizeContextPack(context),
			} : {}),
			...(provider ? {
				provider: {
					provider: provider.provider,
					label: provider.label,
					mode: provider.mode,
					model: provider.model,
					modelRouting: provider.modelRouting,
					baseUrl: provider.baseUrl,
					apiKey: provider.apiKey,
					apiKeyConfigured: provider.apiKeyConfigured,
					apiKeyStorage: provider.apiKeyStorage,
					codexConfig: provider.codexConfig,
				},
			} : {}),
			...(parallelPlan ? {
				parallelAgents: parallelPlan,
			} : {}),
			...(verificationPlan ? {
				verificationPlan,
				verificationSummary: verificationPlanSummary(verificationPlan),
			} : {}),
			...(customModeCatalog ? {
				customModeCatalog,
				customModeSummary: customModeCatalogSummary(customModeCatalog),
				customModePrompt: customModeCatalogPromptBlock(customModeCatalog),
			} : {}),
			...(sessionRecall ? {
				sessionRecall,
				sessionRecallSummary: sessionRecallSummary(sessionRecall),
				sessionRecallPrompt: sessionRecallPromptBlock(sessionRecall),
			} : {}),
			...(docsContext ? {
				docsContext,
				docsContextSummary: docsContextSummary(docsContext),
				docsContextPrompt: docsContextPromptBlock(docsContext),
			} : {}),
			...(workspaceGuidance ? {
				workspaceGuidance,
				workspaceGuidanceSummary: workspaceGuidanceSummary(workspaceGuidance),
			} : {}),
			...(ruleProposal ? {
				ruleProposal,
				ruleProposalSummary: ruleProposalSummary(ruleProposal),
				ruleProposalPrompt: ruleProposalPromptBlock(ruleProposal),
			} : {}),
			...(memoryBank ? {
				memoryBank,
				memoryBankSummary: memoryBankSummary(memoryBank),
			} : {}),
			...(previewPlan ? {
				previewPlan,
				previewSummary: previewPlanSummary(previewPlan),
			} : {}),
			...(mcpCatalog ? {
				mcpCatalog,
				mcpSummary: mcpCatalogSummary(mcpCatalog),
			} : {}),
			...(this.lastToolCatalog ? {
				toolCatalog: this.lastToolCatalog,
				toolCatalogSummary: toolCatalogSummary(this.lastToolCatalog),
				toolCatalogPrompt: toolCatalogPromptBlock(this.lastToolCatalog),
			} : {}),
			...(visibleTaskCards.length ? {
				taskBoard: this.taskBoard,
				taskBoardSummary: taskBoardSummary(this.taskBoard),
			} : {}),
		};
	}

	private createCurrentDeliveryGate(): {
		readonly deliveryBar: ReturnType<typeof createDeliveryBarState>;
		readonly commitHandoff: VibeCodexCommitHandoff;
		readonly smokeBenchmark: VibeCodexSmokeBenchmarkState;
		readonly finalReview: VibeCodexFinalReviewState;
	} {
		const deliveryBar = createDeliveryBarState({
			plan: this.activePlan,
			hasExecutionAuthorization: !!this.executionAuthorization,
			verificationPlan: this.lastVerificationPlan,
			diffReview: this.activeDiffReview,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
			fileCheckpointPaths: [...this.patchCheckpoints.keys()],
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			diagnosticsBaseline: this.lastVerificationPlan?.diagnosticsBaseline,
			parallelPlan: this.lastParallelPlan,
			parallelReview: this.lastParallelReview,
			parallelMergeRequest: this.lastParallelMergeRequest,
		});
		const commitHandoff = createCommitHandoff({
			plan: this.activePlan,
			diffReview: this.activeDiffReview,
			verificationPlan: this.lastVerificationPlan,
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
		});
		const smokeBenchmark = createSmokeBenchmarkState({
			inlinePromptSession: this.lastInlinePromptSession,
			plan: this.activePlan,
			planRevisionHistory: this.planRevisionHistory,
			hasExecutionAuthorization: !!this.executionAuthorization,
			parallelPlan: this.lastParallelPlan,
			parallelReview: this.lastParallelReview,
			parallelMergeRequest: this.lastParallelMergeRequest,
			terminalRuns: [...this.terminalRuns.values()],
			verificationPlan: this.lastVerificationPlan,
			diffReview: this.activeDiffReview,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
			commitHandoff,
			deliveryReady: deliveryBar.ready,
		});
		const finalReview = createFinalReviewState({ deliveryBar, smokeBenchmark, commitHandoff });
		return { deliveryBar, commitHandoff, smokeBenchmark, finalReview };
	}

	private createClientStateResponse(request: VibeCodexClientStateRequest): Record<string, unknown> {
		const provider = this.lastProvider ? {
			provider: this.lastProvider.provider,
			label: this.lastProvider.label,
			model: this.lastProvider.model,
			baseUrl: this.lastProvider.baseUrl,
			apiKeyConfigured: this.lastProvider.apiKeyConfigured,
			apiKeyStorage: this.lastProvider.apiKeyStorage,
			codexConfig: this.lastProvider.codexConfig,
		} : undefined;
		const toolCatalog = this.refreshToolCatalog();
		const { deliveryBar, commitHandoff, smokeBenchmark, finalReview } = this.createCurrentDeliveryGate();
		const parallelMergeStatus = createParallelMergeStatusResponse({
			id: request.id,
			method: 'client/state',
			includeReview: false,
			requestedAt: request.requestedAt,
		}, {
			plan: this.lastParallelPlan,
			review: this.lastParallelReview,
			mergeRequest: this.lastParallelMergeRequest,
			diffReview: this.activeDiffReview,
			hasExecutionAuthorization: !!this.executionAuthorization,
		});
		return {
			ok: true,
			source: 'externalExtension',
			version: 1,
			generatedAt: Date.now(),
			request: {
				method: request.method,
				includeProtocolDiagnostics: request.includeProtocolDiagnostics,
				requestedAt: request.requestedAt,
			},
			backend: this.lastBridgeStatus,
			mode: this.lastMode,
			modePolicy: this.lastModePolicy,
			modeSummary: modePolicySummary(this.lastModePolicy),
			commandPermissionSummary: commandPermissionSummary(this.lastCommandPermissionPolicy),
			task: {
				sessionId: this.activeSessionId,
				prompt: this.lastPrompt,
				activeTaskId: this.activePlan?.taskId,
				revision: this.activePlan?.revision,
				executionAuthorized: !!this.executionAuthorization,
				executionAuthorization: executionAuthorizationSummary(this.executionAuthorization),
			},
			provider,
			activePlan: this.activePlan,
			planRevisionHistory: this.planRevisionHistory.slice(-8),
			parallelPlan: this.lastParallelPlan,
			parallelReview: this.lastParallelReview,
			parallelMergeRequest: this.lastParallelMergeRequest,
			parallelMergeStatus,
			verificationPlan: this.lastVerificationPlan,
			diffReview: this.activeDiffReview,
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			toolCatalog,
			toolCatalogSummary: toolCatalogSummary(toolCatalog),
			deliveryBar,
			smokeBenchmark,
			finalReview,
			commitHandoff,
			pending: {
				approvals: this.approvalCards.size,
				browserActions: this.browserActions.size,
				mcpActions: this.mcpActions.size,
				webFetches: this.webFetches.size,
				hookActions: this.hookActions.size,
				userInputRequests: this.userInputRequests.size,
				diffFiles: this.activeDiffReview?.files.filter(file => file.status === 'pending').length ?? 0,
				terminalRuns: this.terminalRuns.size,
				patchCheckpoints: this.patchCheckpoints.size,
			},
			contextSummary: this.lastContext ? summarizeContextPack(this.lastContext) : undefined,
			docsSummary: docsContextSummary(this.lastDocsContext),
			sessionRecallSummary: sessionRecallSummary(this.lastSessionRecall),
			memoryBankSummary: this.lastMemoryBank ? memoryBankSummary(this.lastMemoryBank) : undefined,
			taskBoard: this.taskBoard,
			taskBoardSummary: taskBoardSummary(this.taskBoard),
			...(request.includeProtocolDiagnostics ? { protocolEvents: this.protocolEvents.slice(-20) } : {}),
		};
	}

	private createTaskSummaryInput(): VibeCodexTaskSummaryInput {
		const terminalEvidence = [...this.terminalRuns.values()].slice(-8).map(run => {
			const result = run.status === 'running'
				? 'running'
				: `${run.status}${run.exitCode !== undefined ? ` exit ${run.exitCode}` : run.signal ? ` ${run.signal}` : ''}`;
			const tail = run.output ? `: ${run.output.slice(-600)}` : '';
			return `${run.commandLine} -> ${result}${tail}`;
		});
		const finalReview = this.createCurrentDeliveryGate().finalReview;
		const status = this.activeDiffReview
			? 'diff_review'
			: this.executionAuthorization
				? 'approved'
				: this.activePlan
					? 'planning'
					: terminalEvidence.length
						? 'terminal'
						: 'idle';
		return {
			sessionId: this.activeSessionId,
			taskId: this.activePlan?.taskId ?? this.lastParallelPlan?.taskId,
			mode: this.lastMode,
			status,
			prompt: this.lastPrompt,
			plan: this.activePlan,
			planRevisionHistory: this.planRevisionHistory,
			contextSummary: this.lastContext ? summarizeContextPack(this.lastContext) : undefined,
			providerSummary: this.lastProvider ? `${this.lastProvider.label}${this.lastProvider.model ? ` / ${this.lastProvider.model}` : ''}${this.lastProvider.baseUrl ? ` / ${this.lastProvider.baseUrl}` : ''}` : undefined,
			parallelSummary: this.lastParallelPlan ? parallelPlanSummary(this.lastParallelPlan) : undefined,
			verificationSummary: this.lastVerificationPlan ? verificationPlanSummary(this.lastVerificationPlan) : undefined,
			workspaceGuidanceSummary: this.lastWorkspaceGuidance ? workspaceGuidanceSummary(this.lastWorkspaceGuidance) : undefined,
			docsContextSummary: this.lastDocsContext ? docsContextSummary(this.lastDocsContext) : undefined,
			memoryBankSummary: this.lastMemoryBank ? memoryBankSummary(this.lastMemoryBank) : undefined,
			previewSummary: this.lastPreviewPlan ? previewPlanSummary(this.lastPreviewPlan) : undefined,
			mcpSummary: this.lastMcpCatalog ? mcpCatalogSummary(this.lastMcpCatalog) : undefined,
			ruleProposalSummary: this.lastRuleProposal ? ruleProposalSummary(this.lastRuleProposal) : undefined,
			taskBoardSummary: taskBoardSummary(this.taskBoard),
			transcriptEvents: this.transcriptEvents,
			evidence: [...terminalEvidence, ...finalReview.evidence],
		};
	}

	private postTaskSummary(response: ReturnType<typeof createTaskSummaryResponse>, summary: string): void {
		this.postMessage({
			type: 'taskSummary',
			summary,
			response,
		});
	}

	private modeBlockReason(action: VibeCodexSensitiveAction): string | undefined {
		if (modeAllowsAction(this.lastModePolicy, action)) {
			return undefined;
		}
		return `${this.lastModePolicy.label} Mode blocks ${action} requests. Switch to Act, Agent, Debug, or Custom mode and approve a visual plan before allowing this action.`;
	}

	private handleBridgeNotification(message: JsonRpcMessage): void {
		if (!message.method) {
			return;
		}
		this.recordProtocol('in', message.method, message);
		if (message.id !== undefined) {
			void this.handleBridgeRequest(message);
			return;
		}
		const parallelResult = normalizeParallelResultMessage(message.method, message.params, this.lastParallelPlan);
		if (parallelResult) {
			void this.recordParallelResult(parallelResult);
			return;
		}
		const delegatedTask = normalizeTaskDelegationRequest(message, this.activePlan?.taskId ?? this.activeSessionId);
		if (delegatedTask) {
			void this.queueDelegatedTask(delegatedTask);
			return;
		}
		const mcpStatus = normalizeMcpStatusRequest(message);
		if (mcpStatus) {
			const response = createMcpStatusResponse(mcpStatus, {
				catalog: this.lastMcpCatalog,
				pendingActions: this.mcpActions.size,
				hasExecutionAuthorization: !!this.executionAuthorization,
			});
			const summary = mcpStatusSummary(response);
			this.recordProtocol('out', 'mcp status notification generated', { method: message.method, result: response });
			this.postMcpStatus(response);
			this.recordTranscript('system', response.available ? 'Generated MCP status for backend' : 'MCP status unavailable for backend', summary, response.available ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}
		const mcpDocumentation = normalizeMcpDocumentationRequest(message);
		if (mcpDocumentation) {
			const response = createMcpDocumentationResponse(mcpDocumentation, this.lastMcpCatalog);
			this.recordProtocol('out', 'mcp documentation notification generated', { method: message.method, result: response });
			this.recordTranscript('system', 'Generated MCP documentation for backend', mcpDocumentationRequestSummary(mcpDocumentation, this.lastMcpCatalog), 'completed');
			this.updateStatus('Generated read-only MCP documentation for backend.');
			return;
		}
		const taskSummary = normalizeTaskSummaryRequest(message);
		if (taskSummary) {
			const response = createTaskSummaryResponse(taskSummary, this.createTaskSummaryInput());
			const summary = taskSummaryRequestSummary(taskSummary);
			this.recordProtocol('out', 'task summary notification generated', { method: message.method, result: response });
			this.postTaskSummary(response, summary);
			this.recordTranscript('system', 'Generated task summary for backend handoff', summary, 'completed');
			this.updateStatus('Generated a redacted task summary for backend handoff.');
			return;
		}
		const completion = normalizeTaskCompletionRequest(message);
		if (completion) {
			void this.evaluateTaskCompletion(completion).then(response => {
				this.recordProtocol('out', 'task completion notification evaluated', { method: message.method, result: response });
			}, error => {
				this.recordProtocol('error', 'task completion notification failed', error instanceof Error ? error.message : String(error));
			});
			return;
		}
		const backendMessage = normalizeBackendTranscriptMessage(message);
		if (backendMessage) {
			this.recordBackendTranscriptMessage(backendMessage);
			return;
		}
		const plan = normalizeIncomingPlan(message.method, message.params, this.lastPrompt, this.lastMode);
		if (plan) {
			const event: VibeCodexPlanRevisionEvent = message.method === 'agent/submitPlan' ? 'submitted' : 'updated';
			this.setActivePlan(plan, `${message.method} received from Codex app-server.`, event);
			return;
		}
		this.handleBridgeEvent(message);
	}

	private async handleBridgeRequest(message: JsonRpcMessage): Promise<void> {
		const method = message.method;
		if (method === 'agent/submitPlan' || method === 'agent/updatePlan') {
			const planSubmissionEvent = method === 'agent/submitPlan' ? 'submitted' : 'updated';
			const plan = normalizeIncomingPlan(method, message.params, this.lastPrompt, this.lastMode);
			const response = createPlanSubmissionResponse(method, message.params, planSubmissionEvent);
			if (plan) {
				this.setActivePlan(plan, `${message.method} request received from Codex app-server.`, planSubmissionEvent);
			}
			const summary = response.message;
			this.recordProtocol('out', planSubmissionEvent === 'submitted' ? 'plan submission response' : 'plan update response', { id: message.id!, result: response });
			await this.bridge?.respond(message.id!, response);
			this.recordTranscript('plan', response.ok ? `Accepted ${planSubmissionEvent === 'submitted' ? 'submitted' : 'updated'} visual plan` : `Rejected ${planSubmissionEvent === 'submitted' ? 'submitted' : 'updated'} visual plan`, summary, response.ok ? 'pending' : 'blocked');
			if (!response.ok) {
				this.updateStatus(summary);
			}
			return;
		}

		const approvalStatus = normalizeApprovalStatusRequest(message);
		if (approvalStatus) {
			const response = createApprovalStatusResponse(approvalStatus, {
				approvals: [...this.approvalCards.values()],
				modePolicy: this.lastModePolicy,
				authorization: this.executionAuthorization,
			});
			const summary = approvalStatusSummary(response);
			this.recordProtocol('out', 'approval status response', { id: approvalStatus.id, result: response });
			await this.bridge?.respond(approvalStatus.id, response);
			this.postApprovalStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned approval status' : 'Approval status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const actionApprovalStatus = normalizeActionApprovalStatusRequest(message);
		if (actionApprovalStatus) {
			const response = this.currentActionApprovalStatus(actionApprovalStatus);
			const summary = actionApprovalStatusSummary(response);
			this.recordProtocol('out', 'action approval status response', { id: actionApprovalStatus.id, result: response });
			await this.bridge?.respond(actionApprovalStatus.id, response);
			this.postActionApprovalStatus(response);
			this.recordTranscript('system', response.ready ? 'Returned action approval route' : 'Action approval route blocked', summary, response.ready ? 'completed' : response.ok ? 'pending' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const toolTimelineStatus = normalizeToolTimelineStatusRequest(message);
		if (toolTimelineStatus) {
			const response = createToolTimelineStatusResponse(toolTimelineStatus, {
				transcriptEvents: this.transcriptEvents,
				approvals: [...this.approvalCards.values()],
				terminalRuns: [...this.terminalRuns.values()],
				activeDiffReview: this.activeDiffReview,
			});
			const summary = toolTimelineStatusSummary(response);
			this.recordProtocol('out', 'tool timeline status response', { id: toolTimelineStatus.id, result: response });
			await this.bridge?.respond(toolTimelineStatus.id, response);
			this.postToolTimelineStatus(response);
			this.recordTranscript('system', 'Returned tool timeline status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const notificationStatus = normalizeNotificationStatusRequest(message);
		if (notificationStatus) {
			const response = createNotificationStatusResponse(notificationStatus, {
				config: this.notificationConfig(),
				transcriptEvents: this.transcriptEvents,
				approvals: [...this.approvalCards.values()],
				terminalRuns: [...this.terminalRuns.values()],
				activeDiffReview: this.activeDiffReview,
				activePlan: this.activePlan ? { taskId: this.activePlan.taskId, revision: this.activePlan.revision, summary: this.activePlan.summary } : undefined,
				planAwaitingApproval: this.activePlan ? !authorizationMatchesPlan(this.executionAuthorization, this.activePlan) : false,
				scheduledLongRunningTerminalRunIds: [...this.terminalNotificationTimers.keys()],
				deliveredLongRunningTerminalRunIds: [...this.longRunningTerminalNotifications.values()],
			});
			const summary = notificationStatusSummary(response);
			this.recordProtocol('out', 'notification status response', { id: notificationStatus.id, result: response });
			await this.bridge?.respond(notificationStatus.id, response);
			this.postNotificationStatus(response);
			this.recordTranscript('system', 'Returned notification status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const slashCommandStatus = normalizeSlashCommandStatusRequest(message);
		if (slashCommandStatus) {
			const response = createSlashCommandStatusResponse(slashCommandStatus, {
				suggestions: await collectSlashCommandSuggestions(),
				lastCommand: this.lastSlashCommand,
				maxWorkflowSuggestions: maxSlashWorkflowSuggestions,
				maxWorkflowContentBytes: maxSlashWorkflowContentBytes,
			});
			const summary = slashCommandStatusSummary(response);
			this.recordProtocol('out', 'slash command status response', { id: slashCommandStatus.id, result: response });
			await this.bridge?.respond(slashCommandStatus.id, response);
			this.recordTranscript('system', 'Returned slash command status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const workspaceSandboxStatus = normalizeWorkspaceSandboxStatusRequest(message);
		if (workspaceSandboxStatus) {
			const response = createWorkspaceSandboxStatusResponse(workspaceSandboxStatus, {
				workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
				workspaceTrusted: vscode.workspace.isTrusted,
				ignorePolicy: await collectWorkspaceIgnorePolicy(),
				approvals: [...this.approvalCards.values()],
				activeDiffReview: this.activeDiffReview,
				patchCheckpoints: [...this.patchCheckpoints.values()],
			});
			const summary = workspaceSandboxStatusSummary(response);
			this.recordProtocol('out', 'workspace sandbox status response', { id: workspaceSandboxStatus.id, result: response });
			await this.bridge?.respond(workspaceSandboxStatus.id, response);
			this.postWorkspaceSandboxStatus(response);
			this.recordTranscript('system', 'Returned workspace sandbox status', summary, response.ready ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const taskBoardStatus = normalizeTaskBoardStatusRequest(message);
			if (taskBoardStatus) {
				const response = createTaskBoardStatusResponse(taskBoardStatus, { board: this.taskBoard });
				const summary = taskBoardStatusSummary(response);
				this.recordProtocol('out', 'task board status response', { id: taskBoardStatus.id, result: response });
				await this.bridge?.respond(taskBoardStatus.id, response);
			this.postTaskBoardStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned Task Board status' : 'Task Board status unavailable', summary, response.ok ? 'completed' : 'blocked');
				this.updateStatus(summary);
				return;
			}

			const taskStartStatus = normalizeTaskStartStatusRequest(message);
			if (taskStartStatus) {
				const response = createTaskStartStatusResponse(taskStartStatus, { board: this.taskBoard });
				const summary = taskStartStatusSummary(response);
				this.recordProtocol('out', 'task start status response', { id: taskStartStatus.id, result: response });
				await this.bridge?.respond(taskStartStatus.id, response);
				this.postTaskStartStatus(response);
				this.recordTranscript('system', response.readiness.startAllowed ? 'Returned Task Board start readiness' : 'Task Board start blocked', summary, response.readiness.startAllowed ? 'completed' : 'blocked');
				this.updateStatus(summary);
				return;
			}

			const externalIntakeStatus = normalizeExternalIntakeStatusRequest(message);
			if (externalIntakeStatus) {
			const response = createExternalIntakeStatusResponse(externalIntakeStatus, { board: this.taskBoard });
			const summary = externalIntakeStatusSummary(response);
			this.recordProtocol('out', 'external intake status response', { id: externalIntakeStatus.id, result: response });
			await this.bridge?.respond(externalIntakeStatus.id, response);
			this.postExternalIntakeStatus(response);
			this.recordTranscript('system', 'Returned external intake capability status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const connectorScheduleStatus = normalizeConnectorScheduleStatusRequest(message);
		if (connectorScheduleStatus) {
			const response = createConnectorScheduleStatusResponse(connectorScheduleStatus, { board: this.taskBoard });
			const summary = connectorScheduleStatusSummary(response);
			this.recordProtocol('out', 'connector/scheduled intake status response', { id: connectorScheduleStatus.id, result: response });
			await this.bridge?.respond(connectorScheduleStatus.id, response);
			this.postConnectorScheduleStatus(response);
			this.recordTranscript('system', 'Returned connector/scheduled intake status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const delegatedTask = normalizeTaskDelegationRequest(message, this.activePlan?.taskId ?? this.activeSessionId);
		if (delegatedTask) {
			const cardId = await this.queueDelegatedTask(delegatedTask);
			const response = createTaskDelegationResponse(delegatedTask, cardId);
			if (message.id !== undefined) {
				await this.bridge?.respond(message.id, response);
				this.recordProtocol('out', 'task delegation response', { id: message.id, result: response });
			}
			return;
		}
		const mcpStatus = normalizeMcpStatusRequest(message);
		if (mcpStatus) {
			const response = createMcpStatusResponse(mcpStatus, {
				catalog: this.lastMcpCatalog,
				pendingActions: this.mcpActions.size,
				hasExecutionAuthorization: !!this.executionAuthorization,
			});
			const summary = mcpStatusSummary(response);
			this.recordProtocol('out', 'mcp status response', { id: mcpStatus.id, result: response });
			await this.bridge?.respond(mcpStatus.id!, response);
			this.postMcpStatus(response);
			this.recordTranscript('system', response.available ? 'Returned MCP status to backend' : 'MCP status unavailable for backend', summary, response.available ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}
		const mcpDocumentation = normalizeMcpDocumentationRequest(message);
		if (mcpDocumentation) {
			const response = createMcpDocumentationResponse(mcpDocumentation, this.lastMcpCatalog);
			this.recordProtocol('out', 'mcp documentation response', { id: mcpDocumentation.id, result: response });
			await this.bridge?.respond(mcpDocumentation.id!, response);
			const summary = mcpDocumentationRequestSummary(mcpDocumentation, this.lastMcpCatalog);
			this.recordTranscript('system', 'Returned MCP documentation to backend', summary, 'completed');
			this.updateStatus(summary);
			return;
		}
		const taskSummary = normalizeTaskSummaryRequest(message);
		if (taskSummary) {
			const response = createTaskSummaryResponse(taskSummary, this.createTaskSummaryInput());
			this.recordProtocol('out', 'task summary response', { id: taskSummary.id, result: response });
			await this.bridge?.respond(taskSummary.id!, response);
			const summary = taskSummaryRequestSummary(taskSummary);
			this.postTaskSummary(response, summary);
			this.recordTranscript('system', 'Returned task summary to backend', summary, 'completed');
			this.updateStatus(summary);
			return;
		}
		const completionStatus = normalizeTaskCompletionStatusRequest(message);
		if (completionStatus) {
			const gate = this.createCurrentDeliveryGate();
			const response = createTaskCompletionStatusResponse(completionStatus, {
				finalReview: gate.finalReview,
				latestCompletion: this.lastTaskCompletionResponse,
			});
			const summary = taskCompletionStatusSummary(response);
			this.recordProtocol('out', 'task completion status response', { id: completionStatus.id, result: response });
			await this.bridge?.respond(completionStatus.id, response);
			this.postTaskCompletionStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned task completion gate status' : 'Task completion gate status unavailable', summary, response.accepted ? 'completed' : response.state === 'blocked' ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}
		const completion = normalizeTaskCompletionRequest(message);
		if (completion) {
			const response = await this.evaluateTaskCompletion(completion);
			this.recordProtocol('out', 'task completion response', { id: message.id!, result: response });
			await this.bridge?.respond(message.id!, response);
			return;
		}
		const backendMessage = normalizeBackendTranscriptMessage(message);
		if (backendMessage) {
			this.recordBackendTranscriptMessage(backendMessage);
			const response = createBackendTranscriptAck(backendMessage);
			this.recordProtocol('out', 'backend transcript message ack', { id: message.id, result: response });
			await this.bridge?.respond(message.id!, response);
			return;
		}
		const workspaceReadStatus = normalizeWorkspaceReadStatusRequest(message);
		if (workspaceReadStatus) {
			const response = this.currentWorkspaceReadStatus(workspaceReadStatus);
			const summary = workspaceReadStatusSummary(response);
			this.recordProtocol('out', 'workspace read evidence status response', { id: workspaceReadStatus.id, result: response });
			await this.bridge?.respond(workspaceReadStatus.id, response);
			this.postWorkspaceReadStatus(response);
			this.recordTranscript('system', 'Returned workspace read evidence status', summary, response.hasEvidence ? 'completed' : 'pending');
			this.updateStatus(summary);
			return;
		}
		const readTool = normalizeWorkspaceReadToolRequest(message);
		if (readTool) {
			const result = await performWorkspaceReadTool(readTool);
			this.recordProtocol('out', 'workspace read tool response', { id: readTool.id, result });
			await this.bridge?.respond(readTool.id, result);
			const summary = workspaceReadToolSummary(result);
			this.recordWorkspaceReadEvidence(createWorkspaceReadEvidenceEvent(readTool, result, summary));
			this.recordTranscript('tool', `Workspace ${readTool.kind}`, summary, result.ok ? 'completed' : 'failed');
			this.updateStatus(summary);
			return;
		}

		const languageContext = normalizeLanguageContextRequest(message);
		if (languageContext) {
			const result = await performLanguageContextRequest(languageContext);
			this.recordProtocol('out', 'language context tool response', { id: languageContext.id, result });
			await this.bridge?.respond(languageContext.id, result);
			const summary = languageContextSummary(result);
			this.recordTranscript('tool', languageContext.kind === 'vscode_references' ? 'References' : 'Workspace symbols', summary, result.ok ? 'completed' : 'failed');
			this.updateStatus(summary);
			return;
		}

		const codeDefinitions = normalizeCodeDefinitionRequest(message);
		if (codeDefinitions) {
			const result = await performCodeDefinitionRequest(codeDefinitions);
			this.recordProtocol('out', 'code definition tool response', { id: codeDefinitions.id, result });
			await this.bridge?.respond(codeDefinitions.id, result);
			const summary = codeDefinitionSummary(result);
			this.recordTranscript('tool', 'Code definitions', summary, result.ok ? 'completed' : 'failed');
			this.updateStatus(summary);
			return;
		}

		const diagnosticsRequest = normalizeDiagnosticsRequest(message);
		if (diagnosticsRequest) {
			const result = await performDiagnosticsRequest(diagnosticsRequest);
			this.recordProtocol('out', 'diagnostics tool response', { id: diagnosticsRequest.id, result });
			await this.bridge?.respond(diagnosticsRequest.id, result);
			const summary = diagnosticsToolSummary(result);
			this.recordTranscript('tool', 'Diagnostics', summary, result.ok ? 'completed' : 'failed');
			this.updateStatus(summary);
			return;
		}

		const gitContext = normalizeGitContextRequest(message);
		if (gitContext) {
			const result = await performGitContextTool(gitContext);
			this.recordProtocol('out', 'git context tool response', { id: gitContext.id, result });
			await this.bridge?.respond(gitContext.id, result);
			const summary = gitContextToolSummary(result);
			this.recordTranscript('tool', `Git ${gitContext.kind}`, summary, result.ok ? 'completed' : 'failed');
			this.updateStatus(summary);
			return;
		}

		const contextRefresh = normalizeContextRefreshRequest(message);
		if (contextRefresh) {
			const prompt = contextRefresh.prompt ?? this.lastPrompt;
			const mode = contextRefresh.mode ?? this.lastMode;
			const context = await collectVibeCodexContext(prompt, mode);
			this.lastContext = context;
			if (contextRefresh.prompt) {
				this.lastPrompt = prompt;
			}
			this.postContext(context);
			const indexStatus = contextRefresh.includeIndexStatus ? createContextIndexStatusResponse({
				id: contextRefresh.id,
				method: 'agent/getContextIndexStatus',
				includeSources: true,
				includeSamples: false,
				maxItems: 0,
				requestedAt: Date.now(),
			}, {
				context,
				workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
				workspaceTrusted: vscode.workspace.isTrusted,
			}) : undefined;
			const response = createContextRefreshResponse(contextRefresh, {
				context,
				prompt,
				mode,
				contextSummary: summarizeContextPack(context),
				...(indexStatus ? { indexStatus } : {}),
				...(contextRefresh.includePromptBlock ? { promptBlock: contextPackForPrompt(context) } : {}),
			});
			const summary = contextRefreshSummary(response);
			this.recordProtocol('out', 'context refresh response', { id: contextRefresh.id, result: response });
			await this.bridge?.respond(contextRefresh.id, response);
			this.recordTranscript('system', 'Refreshed workspace context for backend planning', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const contextIndexStatus = normalizeContextIndexStatusRequest(message);
		if (contextIndexStatus) {
			const response = createContextIndexStatusResponse(contextIndexStatus, {
				context: this.lastContext,
				workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
				workspaceTrusted: vscode.workspace.isTrusted,
			});
			const summary = contextIndexStatusSummary(response);
			this.recordProtocol('out', 'context index status response', { id: contextIndexStatus.id, result: response });
			await this.bridge?.respond(contextIndexStatus.id, response);
			this.postContextIndexStatus(response);
			this.recordTranscript('system', response.available ? 'Returned context index status' : 'Context index status unavailable', summary, response.available ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const symbolIndexStatus = normalizeSymbolIndexStatusRequest(message);
		if (symbolIndexStatus) {
			const response = createSymbolIndexStatusResponse(symbolIndexStatus, this.lastContext);
			const summary = symbolIndexStatusSummary(response);
			this.recordProtocol('out', 'symbol index status response', { id: symbolIndexStatus.id, result: response });
			await this.bridge?.respond(symbolIndexStatus.id, response);
			this.postSymbolIndexStatus(response);
			this.recordTranscript('system', response.available ? 'Returned symbol index status' : 'Symbol index status unavailable', summary, response.available ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const contextStatus = normalizeContextStatusRequest(message);
		if (contextStatus) {
			const response = createContextStatusResponse(contextStatus, this.lastContext);
			const summary = contextStatusSummary(response);
			this.recordProtocol('out', 'context status response', { id: contextStatus.id, result: response });
			await this.bridge?.respond(contextStatus.id, response);
			this.postContextStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned workspace context status' : 'Workspace context status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const previewStatus = normalizePreviewStatusRequest(message);
		if (previewStatus) {
			const response = createPreviewStatusResponse(previewStatus, {
				previewPlan: this.lastPreviewPlan,
				terminalInsights: [...this.terminalInsights.values()],
				pendingBrowserActions: this.browserActions.size,
				hasExecutionAuthorization: !!this.executionAuthorization,
			});
			const summary = previewStatusSummary(response);
			this.recordProtocol('out', 'preview status response', { id: previewStatus.id, result: response });
			await this.bridge?.respond(previewStatus.id, response);
			this.postPreviewStatus(response);
			this.recordTranscript('system', response.available ? 'Returned preview status' : 'Preview status unavailable', summary, response.available ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const browserStatus = normalizeBrowserStatusRequest(message);
		if (browserStatus) {
			const response = createBrowserStatusResponse(browserStatus, {
				pendingActions: [...this.browserActions.values()],
				hasExecutionAuthorization: !!this.executionAuthorization,
			});
			const summary = browserStatusSummary(response);
			this.recordProtocol('out', 'browser status response', { id: browserStatus.id, result: response });
			await this.bridge?.respond(browserStatus.id, response);
			this.postBrowserStatus(response);
			this.recordTranscript('system', 'Returned browser status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const browserActionStatus = normalizeBrowserActionStatusRequest(message);
		if (browserActionStatus) {
			const response = this.currentBrowserActionStatus(browserActionStatus);
			const summary = browserActionStatusSummary(response);
			this.recordProtocol('out', 'browser action status response', { id: browserActionStatus.id, result: response });
			await this.bridge?.respond(browserActionStatus.id, response);
			this.postBrowserActionStatus(response);
			this.recordTranscript('system', 'Returned browser action evidence status', summary, response.counts.pendingActions ? 'pending' : 'completed');
			this.updateStatus(summary);
			return;
		}

		const providerCatalog = normalizeProviderCatalogRequest(message);
		if (providerCatalog) {
			const response = createProviderCatalogResponse(providerCatalog, {
				providers: providerCatalogEntries(),
				selected: this.lastProvider,
			});
			const summary = providerCatalogSummary(response);
			this.recordProtocol('out', 'provider catalog response', { id: providerCatalog.id, result: response });
			await this.bridge?.respond(providerCatalog.id, response);
			this.postProviderCatalog(response);
			this.recordTranscript('system', 'Returned provider catalog', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const providerStatus = normalizeProviderStatusRequest(message);
		if (providerStatus) {
			const provider = providerStatus.mode
				? await providerRuntimeConfig(this.extensionContext.secrets, providerStatus.mode)
				: this.lastProvider ?? await providerRuntimeConfig(this.extensionContext.secrets, this.lastMode);
			const modeRoutes = providerStatus.includeModeRoutes ? await providerModeRouteConfigs(this.extensionContext.secrets) : [];
			const response = createProviderStatusResponse(providerStatus, provider, modeRoutes);
			const summary = providerStatusSummary(response);
			this.recordProtocol('out', 'provider status response', { id: providerStatus.id, result: response });
			await this.bridge?.respond(providerStatus.id, response);
			this.postProviderStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned provider status' : 'Provider status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const capabilityMatrix = normalizeCapabilityMatrixRequest(message);
		if (capabilityMatrix) {
			const response = createCapabilityMatrixResponse(capabilityMatrix, {
				toolCatalog: this.refreshToolCatalog(),
			});
			const summary = capabilityMatrixSummary(response);
			this.recordProtocol('out', 'capability matrix response', { id: capabilityMatrix.id, result: response });
			await this.bridge?.respond(capabilityMatrix.id, response);
			this.postCapabilityMatrix(response);
			this.recordTranscript('system', 'Returned capability matrix', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const toolSchemas = normalizeToolSchemaRequest(message);
		if (toolSchemas) {
			const response = createToolSchemaResponse(toolSchemas, {
				toolCatalog: this.refreshToolCatalog(),
			});
			const summary = toolSchemaSummary(response);
			this.recordProtocol('out', 'tool schema response', { id: toolSchemas.id, result: response });
			await this.bridge?.respond(toolSchemas.id, response);
			this.postToolSchemas(response);
			this.recordTranscript('system', 'Returned tool schemas', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const toolCallStatus = normalizeToolCallStatusRequest(message);
		if (toolCallStatus) {
			const response = createToolCallStatusResponse(toolCallStatus, {
				toolCatalog: this.refreshToolCatalog(),
				hasExecutionAuthorization: !!this.executionAuthorization,
			});
			const summary = toolCallStatusSummary(response);
			this.recordProtocol('out', 'tool-call preflight response', { id: toolCallStatus.id, result: response });
			await this.bridge?.respond(toolCallStatus.id, response);
			this.recordTranscript('system', response.matched ? 'Returned tool-call preflight' : 'Tool-call preflight unknown', summary, response.route === 'call_read_only_tool' ? 'completed' : response.route === 'unknown_tool' || response.route === 'repair_arguments' ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}

		const executionGateStatus = normalizeExecutionGateStatusRequest(message);
		if (executionGateStatus) {
			const response = createExecutionGateStatusResponse(executionGateStatus, {
				plan: this.activePlan,
				authorization: this.executionAuthorization,
				toolCatalog: this.refreshToolCatalog(),
				approvals: [...this.approvalCards.values()],
				activeDiffReview: this.activeDiffReview,
			});
			const summary = executionGateStatusSummary(response);
			this.recordProtocol('out', 'execution gate status response', { id: executionGateStatus.id, result: response });
			await this.bridge?.respond(executionGateStatus.id, response);
			this.postExecutionGateStatus(response);
			this.recordTranscript('system', 'Returned execution gate status', summary, response.ready ? 'completed' : response.blocked ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}

		const guidanceStatus = normalizeGuidanceStatusRequest(message);
		if (guidanceStatus) {
			const response = createGuidanceStatusResponse(guidanceStatus, {
				guidance: this.lastWorkspaceGuidance,
				memoryBank: this.lastMemoryBank,
				customModeCatalog: this.lastCustomModeCatalog,
				ruleProposal: this.lastRuleProposal,
			});
			const summary = guidanceStatusSummary(response);
			this.recordProtocol('out', 'guidance status response', { id: guidanceStatus.id, result: response });
			await this.bridge?.respond(guidanceStatus.id, response);
			this.postGuidanceStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned rules, skills, hooks, and Memory Bank status' : 'Guidance status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const guidanceSelection = normalizeGuidanceSelectionRequest(message);
		if (guidanceSelection) {
			const response = createGuidanceSelectionResponse(guidanceSelection, {
				guidance: this.lastWorkspaceGuidance,
				memoryBank: this.lastMemoryBank,
			});
			const summary = guidanceSelectionSummary(response);
			this.recordProtocol('out', 'guidance selection response', { id: guidanceSelection.id, result: response });
			await this.bridge?.respond(guidanceSelection.id, response);
			this.recordTranscript('system', response.ok ? 'Returned selected guidance context' : 'Guidance selection unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const deliveryBarStatus = normalizeDeliveryBarStatusRequest(message);
		if (deliveryBarStatus) {
			const gate = this.createCurrentDeliveryGate();
			const response = createDeliveryBarStatusResponse(deliveryBarStatus, {
				deliveryBar: gate.deliveryBar,
			});
			const summary = deliveryBarStatusSummary(response);
			this.recordProtocol('out', 'delivery bar status response', { id: deliveryBarStatus.id, result: response });
			await this.bridge?.respond(deliveryBarStatus.id, response);
			this.postDeliveryBarStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned Delivery Bar status' : 'Delivery Bar status unavailable', summary, response.ready ? 'completed' : response.blocked ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}

		const smokeBenchmarkStatus = normalizeSmokeBenchmarkStatusRequest(message);
		if (smokeBenchmarkStatus) {
			const gate = this.createCurrentDeliveryGate();
			const response = createSmokeBenchmarkStatusResponse(smokeBenchmarkStatus, {
				smokeBenchmark: gate.smokeBenchmark,
			});
			const summary = smokeBenchmarkStatusSummary(response);
			this.recordProtocol('out', 'smoke benchmark status response', { id: smokeBenchmarkStatus.id, result: response });
			await this.bridge?.respond(smokeBenchmarkStatus.id, response);
			this.postSmokeBenchmarkStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned Smoke Benchmark status' : 'Smoke Benchmark status unavailable', summary, response.ready ? 'completed' : response.blocked ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}

		const acceptanceCriteriaStatus = normalizeAcceptanceCriteriaStatusRequest(message);
		if (acceptanceCriteriaStatus) {
			const response = createAcceptanceCriteriaStatusResponse(acceptanceCriteriaStatus, {
				verificationPlan: this.lastVerificationPlan,
			});
			const summary = acceptanceCriteriaStatusSummary(response);
			this.recordProtocol('out', 'acceptance criteria status response', { id: acceptanceCriteriaStatus.id, result: response });
			await this.bridge?.respond(acceptanceCriteriaStatus.id, response);
			this.postAcceptanceCriteriaStatus(response);
			this.recordTranscript('system', response.ready ? 'Returned acceptance criteria readiness' : 'Acceptance criteria readiness blocked', summary, response.ready ? 'completed' : response.ok ? 'pending' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const verificationStatus = normalizeVerificationStatusRequest(message);
		if (verificationStatus) {
			const gate = this.createCurrentDeliveryGate();
			const response = createVerificationStatusResponse(verificationStatus, {
				verificationPlan: this.lastVerificationPlan,
				diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
				deliveryBar: gate.deliveryBar,
				smokeBenchmark: gate.smokeBenchmark,
				finalReview: gate.finalReview,
				terminalRuns: [...this.terminalRuns.values()],
			});
			const summary = verificationStatusSummary(response);
			this.recordProtocol('out', 'verification status response', { id: verificationStatus.id, result: response });
			await this.bridge?.respond(verificationStatus.id, response);
			this.postVerificationStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned verification and Delivery Bar status' : 'Verification status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const workflowStatus = normalizeWorkflowStatusRequest(message);
		if (workflowStatus) {
			const gate = this.createCurrentDeliveryGate();
			const response = createWorkflowStatusResponse(workflowStatus, {
				prompt: this.lastPrompt,
				inlinePromptSession: this.lastInlinePromptSession,
				plan: this.activePlan,
				planRevisionHistory: this.planRevisionHistory,
				authorization: this.executionAuthorization,
				verificationPlan: this.lastVerificationPlan,
				diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
				deliveryBar: gate.deliveryBar,
				smokeBenchmark: gate.smokeBenchmark,
				finalReview: gate.finalReview,
				commitHandoff: gate.commitHandoff,
				diffReview: this.activeDiffReview,
				terminalRuns: [...this.terminalRuns.values()],
				taskCheckpointId: this.taskCheckpointId,
				fileCheckpointCount: this.patchCheckpoints.size,
				parallelPlan: this.lastParallelPlan,
				parallelReview: this.lastParallelReview,
				parallelMergeRequest: this.lastParallelMergeRequest,
			});
			const summary = workflowStatusSummary(response);
			this.recordProtocol('out', 'workflow status response', { id: workflowStatus.id, result: response });
			await this.bridge?.respond(workflowStatus.id, response);
			this.postWorkflowStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned workflow lifecycle status' : 'Workflow status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const happyPathStatus = normalizeHappyPathStatusRequest(message);
		if (happyPathStatus) {
			const response = this.currentHappyPathStatus(happyPathStatus);
			const summary = happyPathStatusSummary(response);
			this.recordProtocol('out', 'happy path status response', { id: happyPathStatus.id, result: response });
			await this.bridge?.respond(happyPathStatus.id, response);
			this.postHappyPathStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned Happy Path Proof status' : 'Happy Path Proof unavailable', summary, response.ready ? 'completed' : response.blocked ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}

		const redactionStatus = normalizeRedactionStatusRequest(message);
		if (redactionStatus) {
			const response = createRedactionStatusResponse(redactionStatus);
			const summary = redactionStatusSummary(response);
			this.recordProtocol('out', 'redaction status response', { id: redactionStatus.id, result: response });
			await this.bridge?.respond(redactionStatus.id, response);
			this.postRedactionStatus(response);
			this.recordTranscript('system', 'Returned active token filter status', summary, response.counts.failed ? 'blocked' : 'completed');
			this.updateStatus(summary);
			return;
		}

		const modeStatus = normalizeModeStatusRequest(message);
		if (modeStatus) {
			const response = this.currentModeStatus(modeStatus);
			const summary = modeStatusSummary(response);
			this.recordProtocol('out', 'mode status response', { id: modeStatus.id, result: response });
			await this.bridge?.respond(modeStatus.id, response);
			this.postModeStatus(response);
			this.recordTranscript('system', 'Returned mode readiness status', summary, response.current.readOnly ? 'pending' : response.authorization.activePlanMatches ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const safetyStatus = normalizeSafetyStatusRequest(message);
		if (safetyStatus) {
			const response = this.currentSafetyStatus(safetyStatus);
			const summary = safetyStatusSummary(response);
			this.recordProtocol('out', 'safety status response', { id: safetyStatus.id, result: response });
			await this.bridge?.respond(safetyStatus.id, response);
			this.postSafetyStatus(response);
			this.recordTranscript('system', 'Returned safety and permission status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const planValidation = normalizePlanValidationRequest(message);
		if (planValidation) {
			const response = createPlanValidationResponse(planValidation);
			const summary = planValidationSummary(response);
			this.recordProtocol('out', 'plan validation response', { id: planValidation.id, result: response });
			await this.bridge?.respond(planValidation.id, response);
			this.recordTranscript('plan', response.valid ? 'Validated candidate visual plan' : 'Candidate visual plan needs repair', summary, response.valid ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const planEditStatus = normalizePlanEditStatusRequest(message);
		if (planEditStatus) {
			const response = createPlanEditStatusResponse(planEditStatus, {
				plan: this.activePlan,
			});
			const summary = planEditStatusSummary(response);
			this.recordProtocol('out', 'plan edit status response', { id: planEditStatus.id, result: response });
			await this.bridge?.respond(planEditStatus.id, response);
			this.postPlanEditStatus(response);
			this.recordTranscript('plan', response.ok ? 'Previewed manual visual plan edit' : 'Manual visual plan edit needs repair', summary, response.nextAction === 'submit_manual_edit' || response.nextAction === 'no_change' ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const planStatus = normalizePlanStatusRequest(message);
		if (planStatus) {
			const response = createPlanStatusResponse(planStatus, {
				plan: this.activePlan,
				authorization: this.executionAuthorization,
				history: this.planRevisionHistory,
			});
			const summary = planStatusSummary(response);
			this.recordProtocol('out', 'plan status response', { id: planStatus.id, result: response });
			await this.bridge?.respond(planStatus.id, response);
			this.postPlanStatus(response);
			this.recordTranscript('plan', response.ok ? 'Returned visual plan status' : 'Visual plan status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const planCanvasStatus = normalizePlanCanvasStatusRequest(message);
		if (planCanvasStatus) {
			const response = this.currentPlanCanvasStatus(planCanvasStatus);
			const summary = planCanvasStatusSummary(response);
			this.recordProtocol('out', 'plan canvas status response', { id: planCanvasStatus.id, result: response });
			await this.bridge?.respond(planCanvasStatus.id, response);
			this.postPlanCanvasStatus(response);
			this.recordTranscript('plan', response.ok ? 'Returned Plan Canvas readiness' : 'Plan Canvas readiness unavailable', summary, response.ready ? 'completed' : response.ok ? 'pending' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const planFocusStatus = normalizePlanFocusStatusRequest(message);
		if (planFocusStatus) {
			const response = createPlanFocusStatusResponse(planFocusStatus, {
				plan: this.activePlan,
			});
			const summary = planFocusStatusSummary(response);
			this.recordProtocol('out', 'plan focus status response', { id: planFocusStatus.id, result: response });
			await this.bridge?.respond(planFocusStatus.id, response);
			this.postPlanFocusStatus(response);
			this.recordTranscript('plan', response.ok ? 'Returned visual plan focus status' : 'Visual plan focus status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const parallelStatus = normalizeParallelStatusRequest(message);
		if (parallelStatus) {
			const response = createParallelStatusResponse(parallelStatus, {
				plan: this.lastParallelPlan,
				results: this.parallelResults,
				review: this.lastParallelReview,
			});
			const summary = parallelStatusSummary(response);
			this.recordProtocol('out', 'parallel status response', { id: parallelStatus.id, result: response });
			await this.bridge?.respond(parallelStatus.id, response);
			this.postParallelStatus(response);
			this.recordTranscript('tool', response.ok ? 'Returned parallel agent status' : 'Parallel agent status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const parallelWorktreeStatus = normalizeParallelWorktreeStatusRequest(message);
		if (parallelWorktreeStatus) {
			const response = createParallelWorktreeStatusResponse(parallelWorktreeStatus, {
				plan: this.lastParallelPlan,
				workspaceTrusted: vscode.workspace.isTrusted,
				hasExecutionAuthorization: !!this.executionAuthorization,
				modePolicy: this.lastModePolicy,
			});
			const summary = parallelWorktreeStatusSummary(response);
			this.recordProtocol('out', 'parallel worktree status response', { id: parallelWorktreeStatus.id, result: response });
			await this.bridge?.respond(parallelWorktreeStatus.id, response);
			this.postParallelWorktreeStatus(response);
			this.recordTranscript('tool', response.ok ? 'Returned parallel worktree lifecycle status' : 'Parallel worktree lifecycle unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const parallelLaneExecutionStatus = normalizeParallelLaneExecutionStatusRequest(message);
		if (parallelLaneExecutionStatus) {
			const response = createParallelLaneExecutionStatusResponse(parallelLaneExecutionStatus, {
				plan: this.lastParallelPlan,
				results: this.parallelResults,
				review: this.lastParallelReview,
				activePlan: this.activePlan,
				authorization: this.executionAuthorization,
				workspaceTrusted: vscode.workspace.isTrusted,
				modePolicy: this.lastModePolicy,
			});
			const summary = parallelLaneExecutionStatusSummary(response);
			this.recordProtocol('out', 'parallel lane execution status response', { id: parallelLaneExecutionStatus.id, result: response });
			await this.bridge?.respond(parallelLaneExecutionStatus.id, response);
			this.postParallelLaneExecutionStatus(response);
			this.recordTranscript('tool', response.ok ? 'Returned parallel lane execution status' : 'Parallel lane execution unavailable', summary, response.ok && response.ready ? 'completed' : response.blocked ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}

		const parallelDispatchPlan = normalizeParallelDispatchPlanRequest(message);
		if (parallelDispatchPlan) {
			const response = this.currentParallelDispatchPlan(parallelDispatchPlan);
			const summary = parallelDispatchPlanSummary(response);
			this.recordProtocol('out', 'parallel dispatch plan response', { id: parallelDispatchPlan.id, result: response });
			await this.bridge?.respond(parallelDispatchPlan.id, response);
			this.postParallelDispatchPlan(response);
			this.recordTranscript('tool', response.ok ? 'Returned parallel dispatch plan' : 'Parallel dispatch plan unavailable', summary, response.ready ? 'completed' : response.blocked ? 'blocked' : 'pending');
			this.updateStatus(summary);
			return;
		}

		const parallelLaneDispatch = normalizeParallelLaneDispatchRequest(message);
		if (parallelLaneDispatch) {
			await this.handleParallelLaneDispatchRequest(parallelLaneDispatch);
			return;
		}

		const parallelReviewStatus = normalizeParallelReviewStatusRequest(message);
		if (parallelReviewStatus) {
			const response = createParallelReviewStatusResponse(parallelReviewStatus, {
				plan: this.lastParallelPlan,
				results: this.parallelResults,
				review: this.lastParallelReview,
			});
			const summary = parallelReviewStatusSummary(response);
			this.recordProtocol('out', 'parallel review status response', { id: parallelReviewStatus.id, result: response });
			await this.bridge?.respond(parallelReviewStatus.id, response);
			this.postParallelReviewStatus(response);
			this.recordTranscript('tool', response.ok ? 'Returned parallel judge review status' : 'Parallel judge review unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const parallelMergeStatus = normalizeParallelMergeStatusRequest(message);
		if (parallelMergeStatus) {
			const response = createParallelMergeStatusResponse(parallelMergeStatus, {
				plan: this.lastParallelPlan,
				review: this.lastParallelReview,
				mergeRequest: this.lastParallelMergeRequest,
				diffReview: this.activeDiffReview,
				hasExecutionAuthorization: !!this.executionAuthorization,
			});
			const summary = parallelMergeStatusSummary(response);
			this.recordProtocol('out', 'parallel merge status response', { id: parallelMergeStatus.id, result: response });
			await this.bridge?.respond(parallelMergeStatus.id, response);
			this.postParallelMergeStatus(response);
			this.recordTranscript('tool', response.ok ? 'Returned parallel merge-back status' : 'Parallel merge-back status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const checkpointStatus = normalizeCheckpointStatusRequest(message);
		if (checkpointStatus) {
			const response = createCheckpointStatusResponse(checkpointStatus, {
				taskCheckpointId: this.taskCheckpointId,
				fileCheckpoints: [...this.patchCheckpoints.values()],
				gitCheckpoint: this.taskGitCheckpoint,
				activeReview: this.activeDiffReview,
			});
			const summary = checkpointStatusSummary(response);
			this.recordProtocol('out', 'checkpoint status response', { id: checkpointStatus.id, result: response });
			await this.bridge?.respond(checkpointStatus.id, response);
			this.postCheckpointStatus(response);
			this.recordTranscript('rollback', 'Returned checkpoint and rollback status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const rollbackRestoreStatus = normalizeRollbackRestoreStatusRequest(message);
		if (rollbackRestoreStatus) {
			const response = createRollbackRestoreStatusResponse(rollbackRestoreStatus, {
				taskCheckpointId: this.taskCheckpointId,
				fileCheckpoints: [...this.patchCheckpoints.values()],
				activeReview: this.activeDiffReview,
			});
			const summary = rollbackRestoreStatusSummary(response);
			this.recordProtocol('out', 'rollback restore status response', { id: rollbackRestoreStatus.id, result: response });
			await this.bridge?.respond(rollbackRestoreStatus.id, response);
			this.postRollbackRestoreStatus(response);
			this.recordTranscript('rollback', response.readiness.canRestore ? 'Returned rollback restore readiness' : 'Rollback restore blocked', summary, response.readiness.canRestore ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const commitHandoffStatus = normalizeCommitHandoffStatusRequest(message);
		if (commitHandoffStatus) {
			const gate = this.createCurrentDeliveryGate();
			this.lastCommitHandoff = gate.commitHandoff;
			const response = createCommitHandoffStatusResponse(commitHandoffStatus, gate.commitHandoff);
			const summary = commitHandoffStatusSummary(response);
			this.recordProtocol('out', 'commit handoff status response', { id: commitHandoffStatus.id, result: response });
			await this.bridge?.respond(commitHandoffStatus.id, response);
			this.postCommitHandoffStatus(response);
			this.postAutoCommitStatus(this.currentAutoCommitStatus(undefined, gate));
			this.recordTranscript('system', 'Returned commit handoff status', summary, response.ready ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const autoCommitStatus = normalizeAutoCommitStatusRequest(message);
		if (autoCommitStatus) {
			const gate = this.createCurrentDeliveryGate();
			this.lastCommitHandoff = gate.commitHandoff;
			const response = this.currentAutoCommitStatus(autoCommitStatus, gate);
			const summary = autoCommitStatusSummary(response);
			this.recordProtocol('out', 'auto-commit status response', { id: autoCommitStatus.id, result: response });
			await this.bridge?.respond(autoCommitStatus.id, response);
			this.postAutoCommitStatus(response);
			this.recordTranscript('system', 'Returned auto-commit readiness status', summary, response.ready ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const extensionInstallStatus = normalizeExtensionInstallStatusRequest(message);
		if (extensionInstallStatus) {
			const response = this.currentExtensionInstallStatus(extensionInstallStatus);
			const summary = extensionInstallStatusSummary(response);
			this.recordProtocol('out', 'extension install status response', { id: extensionInstallStatus.id, result: response });
			await this.bridge?.respond(extensionInstallStatus.id, response);
			this.postExtensionInstallStatus(response);
			this.recordTranscript('system', response.ready ? 'Returned extension install readiness' : 'Extension install readiness needs attention', summary, response.ready ? 'completed' : response.state === 'partial' ? 'pending' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const backendLaunchStatus = normalizeBackendLaunchStatusRequest(message);
		if (backendLaunchStatus) {
			const response = this.currentBackendLaunchStatus(backendLaunchStatus);
			const summary = backendLaunchStatusSummary(response);
			this.recordProtocol('out', 'backend launch status response', { id: backendLaunchStatus.id, result: response });
			await this.bridge?.respond(backendLaunchStatus.id, response);
			this.postBackendLaunchStatus(response);
			this.recordTranscript('system', response.ready ? 'Returned backend launch readiness' : 'Backend launch readiness blocked', summary, response.ready ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const protocolStatus = normalizeProtocolStatusRequest(message);
		if (protocolStatus) {
			const response = createProtocolStatusResponse(protocolStatus, {
				bridgeStatus: this.lastBridgeStatus,
				protocolEvents: this.protocolEvents,
			});
			const summary = protocolStatusSummary(response);
			this.recordProtocol('out', 'protocol status response', { id: protocolStatus.id, result: response });
			await this.bridge?.respond(protocolStatus.id, response);
			this.postProtocolStatus(response);
			this.recordTranscript('system', 'Returned protocol status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const runtimeReadinessStatus = normalizeRuntimeReadinessStatusRequest(message);
		if (runtimeReadinessStatus) {
			const response = await this.currentRuntimeReadinessStatus(runtimeReadinessStatus);
			const summary = runtimeReadinessSummary(response);
			this.recordProtocol('out', 'runtime readiness status response', { id: runtimeReadinessStatus.id, result: response });
			await this.bridge?.respond(runtimeReadinessStatus.id, response);
			this.postRuntimeReadinessStatus(response);
			this.recordTranscript('system', response.ready ? 'Returned runtime readiness' : 'Runtime readiness needs attention', summary, response.ready ? 'completed' : response.route.startsWith('inspect_') || response.route === 'connect_backend' ? 'pending' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const clientState = normalizeClientStateRequest(message);
		if (clientState) {
			const response = this.createClientStateResponse(clientState);
			this.recordProtocol('out', 'client state response', { id: clientState.id, result: response });
			await this.bridge?.respond(clientState.id, response);
			const summary = clientStateRequestSummary(clientState);
			this.recordTranscript('system', 'Returned client state to backend', summary);
			this.updateStatus(summary);
			return;
		}

		const inlinePromptStatus = normalizeInlinePromptStatusRequest(message);
		if (inlinePromptStatus) {
			const response = createInlinePromptStatusResponse(inlinePromptStatus, {
				session: this.lastInlinePromptSession,
				activePlan: this.activePlan,
				authorization: this.executionAuthorization,
			});
			const summary = inlinePromptStatusSummary(response);
			this.recordProtocol('out', 'inline prompt status response', { id: inlinePromptStatus.id, result: response });
			await this.bridge?.respond(inlinePromptStatus.id, response);
			this.postInlinePromptStatus(response);
			this.recordTranscript('system', response.active ? 'Returned inline prompt status' : 'Inline prompt status unavailable', summary, response.active ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const sessionHistoryStatus = normalizeSessionHistoryStatusRequest(message);
		if (sessionHistoryStatus) {
			const response = createSessionHistoryStatusResponse(sessionHistoryStatus, {
				history: loadSessionHistory(this.extensionContext.globalState),
				activeSessionId: this.activeSessionId,
			});
			const summary = sessionHistoryStatusSummary(response);
			this.recordProtocol('out', 'session history status response', { id: sessionHistoryStatus.id, result: response });
			await this.bridge?.respond(sessionHistoryStatus.id, response);
			this.postSessionHistoryStatus(response);
			this.recordTranscript('system', 'Returned session history status', summary, 'completed');
			this.updateStatus(summary);
			return;
		}

		const sessionExport = normalizeSessionExportRequest(message);
			if (sessionExport) {
				const response = createSessionExportResponse(sessionExport, {
					history: loadSessionHistory(this.extensionContext.globalState),
					activeSessionId: this.activeSessionId,
			});
			const summary = sessionExportSummary(response);
			this.recordProtocol('out', 'session export response', { id: sessionExport.id, result: response });
			await this.bridge?.respond(sessionExport.id, response);
			this.postSessionExportStatus(response);
			this.recordTranscript('system', response.ok ? 'Returned session export' : 'Session export unavailable', summary, response.ok ? 'completed' : 'blocked');
				this.updateStatus(summary);
				return;
			}

			const userInputStatus = normalizeUserInputStatusRequest(message);
			if (userInputStatus) {
				const response = this.currentUserInputStatus(userInputStatus);
				const summary = userInputStatusSummary(response);
				this.recordProtocol('out', 'user input status response', { id: userInputStatus.id, result: response });
				await this.bridge?.respond(userInputStatus.id, response);
				this.postUserInputStatus(response);
				this.recordTranscript('system', response.counts.pending ? 'Returned pending user input status' : 'Returned empty user input status', summary, response.counts.pending ? 'pending' : 'completed');
				this.updateStatus(summary);
				return;
			}

			const userInputRequest = normalizeUserInputRequest(message);
			if (userInputRequest) {
				this.userInputRequests.set(String(userInputRequest.id), userInputRequest);
				this.postMessage({ type: 'userInputRequest', request: userInputRequest });
				this.postUserInputStatus();
				const importedPlan = planFromPlanModeResponse(userInputRequest);
				if (importedPlan) {
					this.setActivePlan(importedPlan, 'Imported visual plan from Cline Plan Mode response; awaiting developer approval before any mutation.', 'submitted');
					this.recordProtocol('in', 'imported plan_mode_respond visual plan', { id: userInputRequest.id, taskId: importedPlan.taskId, revision: importedPlan.revision, steps: importedPlan.steps.length });
				}
				const summary = userInputRequestSummary(userInputRequest);
				this.recordProtocol('in', 'user input request pending', { id: userInputRequest.id, request: userInputRequest });
			this.recordTranscript('system', userInputRequest.title, summary, 'pending');
			this.notifyApprovalNeeded(userInputRequest.title, userInputRequest.prompt, false);
			this.updateStatus(`${userInputRequest.title}.`);
			return;
		}

		const parallelWorktree = normalizeParallelWorktreeRequest(message);
		if (parallelWorktree) {
			const modeBlock = this.modeBlockReason('tool');
			if (modeBlock) {
				const error = { code: -32003, message: modeBlock, data: { method: message.method, operation: parallelWorktree.operation, mode: this.lastModePolicy.mode } };
				this.recordProtocol('out', 'parallel worktree request blocked by mode policy', { id: parallelWorktree.id, error });
				await this.bridge?.respondError(parallelWorktree.id, error.code, error.message, error.data);
				this.recordTranscript('tool', `Rejected parallel worktree ${parallelWorktree.operation} by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			if (!authorizationMatchesPlan(this.executionAuthorization, this.activePlan)) {
				const messageText = 'Approve the exact visual plan revision before preparing or cleaning backend-orchestrated parallel worktrees.';
				const error = { code: -32007, message: messageText, data: { method: message.method, operation: parallelWorktree.operation } };
				this.recordProtocol('out', 'parallel worktree request missing approved plan', { id: parallelWorktree.id, error, approvedPlan: executionAuthorizationSummary(this.executionAuthorization) });
				await this.bridge?.respondError(parallelWorktree.id, error.code, error.message, error.data);
				this.recordTranscript('tool', `Rejected parallel worktree ${parallelWorktree.operation} before plan execution authorization`, parallelWorktreeRequestSummary(parallelWorktree), 'blocked');
				this.updateStatus(messageText);
				return;
			}
			if (!this.lastParallelPlan) {
				const messageText = 'No parallel agent plan is available.';
				this.recordProtocol('out', 'parallel worktree request missing plan', { id: parallelWorktree.id, error: messageText });
				await this.bridge?.respondError(parallelWorktree.id, -32008, messageText, { method: message.method, operation: parallelWorktree.operation });
				this.recordTranscript('tool', `Rejected parallel worktree ${parallelWorktree.operation} without a parallel plan`, parallelWorktreeRequestSummary(parallelWorktree), 'blocked');
				this.updateStatus(messageText);
				return;
			}
			if (parallelWorktree.taskId && parallelWorktree.taskId !== this.lastParallelPlan.taskId) {
				const messageText = `Parallel worktree request task ${parallelWorktree.taskId} does not match active plan ${this.lastParallelPlan.taskId}.`;
				this.recordProtocol('out', 'parallel worktree request task mismatch', { id: parallelWorktree.id, error: messageText });
				await this.bridge?.respondError(parallelWorktree.id, -32009, messageText, { method: message.method, operation: parallelWorktree.operation, activeTaskId: this.lastParallelPlan.taskId });
				this.recordTranscript('tool', `Rejected parallel worktree ${parallelWorktree.operation} for stale task`, messageText, 'blocked');
				this.updateStatus(messageText);
				return;
			}
			const approval = createParallelWorktreeApprovalCard(parallelWorktree, this.lastParallelPlan);
			this.approvalCards.set(String(approval.id), approval);
			const autoDecision = shouldAutoApproveApproval(approval, this.autoApproveConfig(), !!this.executionAuthorization);
			if (autoDecision.approve) {
				this.recordProtocol('out', 'auto-approved parallel worktree request', { id: approval.id, method: approval.method, operation: approval.parallelWorktreeOperation, reason: autoDecision.reason });
				this.recordTranscript('approval', `Auto-approved ${approval.title}`, autoDecision.reason, 'completed');
				await this.decideApproval(String(approval.id), 'accept');
				return;
			}
			this.postExecutionGateStatus();
			this.postMessage({ type: 'approval', card: approval });
			this.postApprovalStatus();
			this.recordTranscript('approval', `${approval.title} waiting for approval`, approval.detail || approval.description, approval.blocked ? 'blocked' : 'pending');
			this.notifyApprovalNeeded(`${approval.title} waiting for approval`, approval.detail || approval.description, approval.blocked);
			this.updateStatus(`${approval.title} waiting for approval.`);
			return;
		}
		const mcpAction = normalizeMcpActionRequest(message, this.lastMcpCatalog);
		if (mcpAction) {
			const modeBlock = this.modeBlockReason('mcp');
			if (modeBlock) {
				const response = createMcpActionResponse(mcpAction, 'decline');
				this.recordProtocol('out', 'mcp request blocked by mode policy', { id: mcpAction.id, modePolicy: this.lastModePolicy, reason: modeBlock, result: response });
				await this.bridge?.respond(mcpAction.id, response);
				this.recordTranscript('tool', `Blocked ${mcpAction.title} by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			this.mcpActions.set(String(mcpAction.id), mcpAction);
			const autoDecision = shouldAutoApproveMcp(mcpAction, this.autoApproveConfig(), !!this.executionAuthorization);
			if (autoDecision.approve) {
				this.recordProtocol('out', 'auto-approved MCP request', { id: mcpAction.id, reason: autoDecision.reason });
				this.recordTranscript('tool', `Auto-approved ${mcpAction.title}`, autoDecision.reason, 'running');
				await this.decideMcpAction(String(mcpAction.id), 'accept');
				return;
			}
			this.postMessage({ type: 'mcpAction', action: mcpAction });
			this.postMcpStatus();
			this.recordTranscript('tool', `${mcpAction.title} waiting for approval`, mcpAction.detail, mcpAction.blocked ? 'blocked' : 'pending');
			this.notifyApprovalNeeded(`${mcpAction.title} waiting for approval`, mcpAction.detail, mcpAction.blocked);
			this.updateStatus(`${mcpAction.title} waiting for approval.`);
			return;
		}

		const hookAction = normalizeHookActionRequest(message, this.lastWorkspaceGuidance);
		if (hookAction) {
			const modeBlock = this.modeBlockReason('terminal');
			if (modeBlock) {
				const response = createHookActionResponse(hookAction, false);
				this.recordProtocol('out', 'hook action blocked by mode policy', { id: hookAction.id, modePolicy: this.lastModePolicy, reason: modeBlock, result: response });
				await this.bridge?.respond(hookAction.id, response);
				this.recordTranscript('tool', `Blocked hook execution by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			this.hookActions.set(String(hookAction.id), hookAction);
			this.postMessage({ type: 'hookAction', action: hookAction });
			this.recordTranscript('tool', 'Hook execution waiting for approval', hookAction.detail, hookAction.blocked ? 'blocked' : 'pending');
			this.notifyApprovalNeeded('Hook execution waiting for approval', hookAction.detail, hookAction.blocked);
			this.updateStatus('Hook execution waiting for approval.');
			return;
		}

		const diffReviewStatus = normalizeDiffReviewStatusRequest(message);
		if (diffReviewStatus) {
			const response = createDiffReviewStatusResponse(diffReviewStatus, {
				review: this.activeDiffReview,
				taskCheckpointId: this.taskCheckpointId,
				fileCheckpoints: [...this.patchCheckpoints.values()].map(checkpoint => ({ path: checkpoint.path, id: checkpoint.id })),
				gitCheckpoint: this.taskGitCheckpoint,
			});
			const summary = diffReviewStatusSummary(response);
			this.recordProtocol('out', 'diff review status response', { id: diffReviewStatus.id, result: response });
			await this.bridge?.respond(diffReviewStatus.id, response);
			this.postDiffReviewStatus(response);
			this.recordTranscript('diff', response.ok ? 'Returned diff review status' : 'Diff review status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}
		const diffFileStatus = normalizeDiffFileStatusRequest(message);
		if (diffFileStatus) {
			const response = createDiffFileStatusResponse(diffFileStatus, {
				review: this.activeDiffReview,
				taskCheckpointId: this.taskCheckpointId,
				fileCheckpoints: [...this.patchCheckpoints.values()].map(checkpoint => ({ path: checkpoint.path, id: checkpoint.id })),
			});
			const summary = diffFileStatusSummary(response);
			this.recordProtocol('out', 'diff file status response', { id: diffFileStatus.id, result: response });
			await this.bridge?.respond(diffFileStatus.id, response);
			this.postDiffFileStatus(response);
			this.recordTranscript('diff', response.ok ? 'Returned diff file status' : 'Diff file status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const diffReapplyStatus = normalizeDiffReapplyStatusRequest(message);
		if (diffReapplyStatus) {
			const response = createDiffReapplyStatusResponse(diffReapplyStatus, {
				review: this.activeDiffReview,
				taskCheckpointId: this.taskCheckpointId,
				fileCheckpoints: [...this.patchCheckpoints.values()].map(checkpoint => ({ path: checkpoint.path, id: checkpoint.id })),
			});
			const summary = diffReapplyStatusSummary(response);
			this.recordProtocol('out', 'diff reapply status response', { id: diffReapplyStatus.id, result: response });
			await this.bridge?.respond(diffReapplyStatus.id, response);
			this.postDiffReapplyStatus(response);
			this.recordTranscript('diff', response.reapplyReady ? 'Returned diff reapply readiness' : 'Diff reapply needs repair', summary, response.reapplyReady ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const diffValidation = normalizeDiffValidationRequest(message);
		if (diffValidation) {
			const response = createDiffValidationResponse(diffValidation);
			const summary = diffValidationSummary(response);
			this.recordProtocol('out', 'diff validation response', { id: diffValidation.id, result: response });
			await this.bridge?.respond(diffValidation.id, response);
			this.recordTranscript('diff', response.valid ? 'Validated candidate diff' : 'Candidate diff needs repair', summary, response.valid ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const diffReview = normalizeDiffReview(message);
		if (diffReview) {
			const mergeBlocker = this.parallelMergeDiffReviewBlocker(diffReview);
			if (mergeBlocker) {
				this.recordProtocol('out', 'diff review rejected by parallel merge correlation', { id: message.id!, method: message.method, reviewId: diffReview.reviewId, threadId: diffReview.threadId, error: mergeBlocker });
				await this.bridge?.respondError(message.id!, -32007, mergeBlocker, { method: message.method, reviewId: diffReview.reviewId, threadId: diffReview.threadId });
				this.recordTranscript('diff', 'Rejected diff review that does not match selected parallel merge-back lane', mergeBlocker, 'blocked');
				this.postParallelMergeStatus();
				this.updateStatus(mergeBlocker);
				return;
			}
			this.publishDiffReview(diffReview, 'Diff review received from backend request.');
			const response = createDiffReviewResponse(diffReview);
			this.recordProtocol('out', 'diff review response', { id: message.id!, result: response });
			await this.bridge?.respond(message.id!, response);
			return;
		}

		const editToolReview = normalizeEditToolDiffReview(message);
			if (editToolReview) {
				this.publishDiffReview(editToolReview, 'Edit tool call converted into reviewable diff.');
				const response = createEditToolDiffResponse(editToolReview);
				this.recordProtocol('out', 'edit tool diff review response', { id: message.id!, result: response });
				await this.bridge?.respond(message.id!, response);
				return;
			}

			const previewStart = normalizePreviewStartRequest(message);
			if (previewStart) {
				const target = resolvePreviewStartTarget(previewStart, this.lastPreviewPlan);
				if (!target) {
					const response = createPreviewStartResponse({
						request: previewStart,
						previewPlan: this.lastPreviewPlan,
						accepted: false,
						message: 'Preview start requires a detected preview target id, URL, label, or exact command from the current preview plan. Call preview_status first, or use execute_command for arbitrary terminal commands.',
					});
					const summary = previewStartSummary(response);
					this.recordProtocol('out', 'preview start target unavailable', { id: previewStart.id, result: response });
					await this.bridge?.respond(previewStart.id, response);
					this.recordTranscript('terminal', 'Preview start target unavailable', summary, 'blocked');
					this.updateStatus(summary);
					return;
				}
				const commandDecision = evaluateCommandPermission(target.command, this.lastCommandPermissionPolicy);
				const approval = createPreviewStartApprovalCard(previewStart, target, commandDecision);
				const modeBlock = this.modeBlockReason('terminal');
				if (modeBlock) {
					const response = createPreviewStartResponse({ request: previewStart, target, accepted: false, message: modeBlock });
					const summary = previewStartSummary(response);
					this.recordProtocol('out', 'preview start blocked by mode policy', { id: previewStart.id, modePolicy: this.lastModePolicy, reason: modeBlock, result: response });
					await this.bridge?.respond(previewStart.id, response);
					this.recordTranscript('terminal', `Blocked preview start by ${this.lastModePolicy.label} Mode`, summary, 'blocked');
					this.updateStatus(modeBlock);
					return;
				}
				this.approvalCards.set(String(approval.id), approval);
				const autoDecision = shouldAutoApproveApproval(approval, this.autoApproveConfig(), !!this.executionAuthorization);
				if (autoDecision.approve) {
					this.recordProtocol('out', 'auto-approved preview start request', { id: approval.id, method: approval.method, reason: autoDecision.reason });
					this.recordTranscript('approval', `Auto-approved preview start: ${approval.previewLabel}`, autoDecision.reason, 'completed');
					await this.decideApproval(String(approval.id), 'accept');
					return;
				}
				this.postExecutionGateStatus();
				this.postMessage({ type: 'approval', card: approval });
				this.postApprovalStatus();
				this.recordTranscript('approval', 'Start preview waiting for approval', approval.detail || approval.description, approval.blocked ? 'blocked' : 'pending');
				this.notifyApprovalNeeded('Start preview waiting for approval', approval.detail || approval.description, approval.blocked);
				this.updateStatus('Start preview waiting for approval.');
				return;
			}

			const approval = normalizeApprovalRequest(message, this.lastCommandPermissionPolicy);
			if (approval) {
				const modeBlock = this.modeBlockReason(approval.kind);
			if (modeBlock) {
				const response = createApprovalResponse(approval, 'decline');
				this.recordProtocol('out', 'approval request blocked by mode policy', { id: approval.id, method: approval.method, modePolicy: this.lastModePolicy, reason: modeBlock, result: response });
				await this.bridge?.respond(approval.id, response);
				this.recordTranscript('approval', `Blocked ${approval.title} by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			this.approvalCards.set(String(approval.id), approval);
			const autoDecision = shouldAutoApproveApproval(approval, this.autoApproveConfig(), !!this.executionAuthorization);
			if (autoDecision.approve) {
				this.recordProtocol('out', 'auto-approved approval request', { id: approval.id, method: approval.method, reason: autoDecision.reason });
				this.recordTranscript('approval', `Auto-approved ${approval.title}`, autoDecision.reason, 'completed');
				await this.decideApproval(String(approval.id), 'accept');
				return;
			}
			this.postExecutionGateStatus();
			this.postMessage({ type: 'approval', card: approval });
			this.postApprovalStatus();
			this.recordTranscript('approval', `${approval.title} waiting for approval`, approval.detail || approval.description, approval.blocked ? 'blocked' : 'pending');
			this.notifyApprovalNeeded(`${approval.title} waiting for approval`, approval.detail || approval.description, approval.blocked);
			this.updateStatus(`${approval.title} waiting for approval.`);
			return;
		}

		const terminalCommandValidation = normalizeTerminalCommandValidationRequest(message);
		if (terminalCommandValidation) {
			this.lastTerminalCommandValidationRequest = terminalCommandValidation;
			const response = this.currentTerminalCommandValidationStatus(terminalCommandValidation);
			const summary = terminalCommandValidationSummary(response);
			this.recordProtocol('out', 'terminal command validation response', { id: terminalCommandValidation.id, result: response });
			await this.bridge?.respond(terminalCommandValidation.id, response);
			this.postTerminalCommandValidationStatus(response);
			this.recordTranscript('terminal', response.approvalReady ? 'Validated terminal command candidate' : 'Terminal command candidate needs repair', summary, response.approvalReady ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const terminalControl = normalizeTerminalControlRequest(message);
		if (terminalControl) {
			await this.handleTerminalControlRequest(terminalControl);
			return;
		}

		const terminalInsightStatus = normalizeTerminalInsightStatusRequest(message);
		if (terminalInsightStatus) {
			const response = createTerminalInsightStatusResponse(terminalInsightStatus, [...this.terminalInsights.values()]);
			const summary = terminalInsightStatusSummary(response);
			this.recordProtocol('out', 'terminal insight status response', { id: terminalInsightStatus.id, result: response });
			await this.bridge?.respond(terminalInsightStatus.id, response);
			this.postTerminalInsightStatus(response);
			this.recordTranscript('terminal', response.ok ? 'Returned terminal insight status' : 'Terminal insight status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const terminalRemediationStatus = normalizeTerminalRemediationStatusRequest(message);
		if (terminalRemediationStatus) {
			const response = createTerminalRemediationStatusResponse(terminalRemediationStatus, {
				events: this.terminalRemediations,
				activePlan: this.activePlan,
				authorization: this.executionAuthorization,
			});
			const summary = terminalRemediationStatusSummary(response);
			this.recordProtocol('out', 'terminal remediation status response', { id: terminalRemediationStatus.id, result: response });
			await this.bridge?.respond(terminalRemediationStatus.id, response);
			this.postTerminalRemediationStatus(response);
			this.recordTranscript('terminal', response.ok ? 'Returned terminal remediation status' : 'Terminal remediation status unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const terminalOutput = normalizeTerminalOutputRequest(message);
		if (terminalOutput) {
			this.lastTerminalOutputRequest = terminalOutput;
			const runs = [...this.terminalRuns.values()];
			const run = terminalOutput.runId ? this.terminalRuns.get(terminalOutput.runId) : runs[runs.length - 1];
			const response = createTerminalOutputResponse(terminalOutput, run);
			const summary = terminalOutputSummary(response);
			this.recordProtocol('out', 'terminal output response', { id: terminalOutput.id, result: response });
			await this.bridge?.respond(terminalOutput.id, response);
			this.postTerminalOutputStatus(response);
			this.recordTranscript('terminal', response.ok ? 'Returned terminal output' : 'Terminal output unavailable', summary, response.ok ? 'completed' : 'blocked');
			this.updateStatus(summary);
			return;
		}

		const terminalRun = normalizeTerminalRunRequest(message);
		if (terminalRun) {
			const commandDecision = evaluateCommandPermission(terminalRun.commandLine, this.lastCommandPermissionPolicy);
			if (!commandDecision.allowed) {
				const error = { code: -32004, message: commandDecision.reason, data: { method: message.method, commandLine: terminalRun.commandLine, matchedRule: commandDecision.matchedRule } };
				this.recordProtocol('out', 'terminal run blocked by command permissions', { id: message.id!, error, commandPermissionPolicy: this.lastCommandPermissionPolicy });
				await this.bridge?.respondError(message.id!, error.code, error.message, error.data);
				this.recordTranscript('terminal', 'Rejected terminal run by command permissions', `${terminalRun.commandLine}\n${commandDecision.reason}`, 'blocked');
				this.updateStatus(commandDecision.reason);
				return;
			}
			const modeBlock = this.modeBlockReason('terminal');
			if (modeBlock) {
				const error = { code: -32003, message: modeBlock, data: { method: message.method, mode: this.lastModePolicy.mode } };
				this.recordProtocol('out', 'terminal run blocked by mode policy', { id: message.id!, error });
				await this.bridge?.respondError(message.id!, error.code, error.message, error.data);
				this.recordTranscript('terminal', `Rejected terminal run by ${this.lastModePolicy.label} Mode`, terminalRun.commandLine, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			if (!this.executionAuthorization) {
				const error = { code: -32001, message: 'Plan approval is required before terminal execution.', data: { method: message.method } };
				this.recordProtocol('out', 'terminal run rejected before approved plan', { id: message.id!, error });
				await this.bridge?.respondError(message.id!, error.code, error.message, error.data);
				this.recordTranscript('terminal', 'Rejected terminal run before plan execution authorization', terminalRun.commandLine, 'blocked');
				this.updateStatus('Plan approval is required before terminal execution.');
				return;
			}
			try {
				const runId = this.runVisibleTerminal(terminalRun.commandLine, terminalRun.cwd, terminalRun.reason);
				this.trackTerminalRunRequest(runId, { id: message.id!, method: terminalRun.method, requestedAt: Date.now(), ...(terminalRun.verificationCheckId ? { verificationCheckId: terminalRun.verificationCheckId } : {}) });
				const result = attachExecutionAuthorization({ runId, started: true, source: 'externalExtension' }, this.executionAuthorization, true);
				this.recordProtocol('out', 'terminal run response', { id: message.id!, result });
				await this.bridge?.respond(message.id!, result);
				if (terminalRun.verificationCheckId) {
					await this.attachTerminalRunToVerification(runId, terminalRun.verificationCheckId, terminalRun.commandLine, 'backend terminal request');
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				this.recordProtocol('out', 'terminal run rejected by sandbox', { id: message.id!, error: errorMessage });
				await this.bridge?.respondError(message.id!, -32002, errorMessage, { method: message.method });
				this.recordTranscript('terminal', 'Rejected terminal run by workspace sandbox', errorMessage, 'blocked');
				this.updateStatus(errorMessage);
			}
			return;
		}

		const webFetch = normalizeWebFetchRequest(message);
		if (webFetch) {
			const modeBlock = this.modeBlockReason('tool');
			if (modeBlock) {
				const response = createWebFetchResponse(webFetch, false);
				this.recordProtocol('out', 'web fetch blocked by mode policy', { id: webFetch.id, modePolicy: this.lastModePolicy, reason: modeBlock, result: response });
				await this.bridge?.respond(webFetch.id, response);
				this.recordTranscript('tool', `Blocked web fetch by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			this.webFetches.set(String(webFetch.id), webFetch);
			this.postMessage({ type: 'webFetch', request: webFetch });
			this.recordTranscript('tool', 'Web fetch waiting for approval', webFetch.detail, webFetch.blocked ? 'blocked' : 'pending');
			this.notifyApprovalNeeded('Web fetch waiting for approval', webFetch.detail, webFetch.blocked);
			this.updateStatus('Web fetch waiting for approval.');
			return;
		}

		const browserAction = normalizeBrowserActionRequest(message);
		if (browserAction) {
			const modeBlock = this.modeBlockReason('browser');
			if (modeBlock) {
				const response = createBrowserActionResponse(browserAction, false, modeBlock);
				this.recordProtocol('out', 'browser action blocked by mode policy', { id: browserAction.id, modePolicy: this.lastModePolicy, reason: modeBlock, result: response });
				await this.bridge?.respond(browserAction.id, response);
				this.recordBrowserActionEvidence(createBrowserActionEvidenceEvent(browserAction, 'blocked', { responseMessage: modeBlock, reason: modeBlock }));
				this.recordTranscript('tool', `Blocked browser ${browserAction.action} by ${this.lastModePolicy.label} Mode`, modeBlock, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			this.browserActions.set(String(browserAction.id), browserAction);
			this.recordBrowserActionEvidence(createBrowserActionEvidenceEvent(browserAction, 'pending'));
			this.postBrowserStatus();
			this.postPreviewStatus();
			const autoDecision = shouldAutoApproveBrowser(browserAction, this.autoApproveConfig(), !!this.executionAuthorization);
			if (autoDecision.approve) {
				this.recordProtocol('out', 'auto-approved browser action', { id: browserAction.id, action: browserAction.action, reason: autoDecision.reason });
				this.recordTranscript('tool', `Auto-approved browser ${browserAction.action}`, autoDecision.reason, 'running');
				await this.decideBrowserAction(String(browserAction.id), 'accept');
				return;
			}
			this.postMessage({ type: 'browserAction', action: browserAction });
			this.recordTranscript('tool', `${browserAction.title} waiting for approval`, browserAction.detail || browserAction.url, browserAction.supported ? 'pending' : 'blocked');
			this.notifyApprovalNeeded(`${browserAction.title} waiting for approval`, browserAction.detail || browserAction.url, !browserAction.supported);
			this.updateStatus(`${browserAction.title} waiting for approval.`);
			return;
		}

		this.recordProtocol('out', 'unsupported request error', { id: message.id!, error: { code: -32601, message: `Unsupported external Vibe Codex request: ${message.method}`, data: { method: message.method } } });
		await this.bridge?.respondError(message.id!, -32601, `Unsupported external Vibe Codex request: ${message.method}`, { method: message.method });
	}

	private handleBridgeEvent(message: JsonRpcMessage): void {
		const review = normalizeDiffReview(message);
		if (review) {
			const mergeBlocker = this.parallelMergeDiffReviewBlocker(review);
			if (mergeBlocker) {
				this.recordTranscript('diff', 'Ignored diff review that does not match selected parallel merge-back lane', mergeBlocker, 'blocked');
				this.postParallelMergeStatus();
				this.updateStatus(mergeBlocker);
				return;
			}
			this.publishDiffReview(review, 'Diff review received from backend.');
			return;
		}

		const terminalRun = normalizeTerminalRunRequest(message);
		if (terminalRun) {
			const commandDecision = evaluateCommandPermission(terminalRun.commandLine, this.lastCommandPermissionPolicy);
			if (!commandDecision.allowed) {
				this.recordTranscript('terminal', 'Ignored terminal run by command permissions', `${terminalRun.commandLine}\n${commandDecision.reason}`, 'blocked');
				this.updateStatus(commandDecision.reason);
				return;
			}
			const modeBlock = this.modeBlockReason('terminal');
			if (modeBlock) {
				this.recordTranscript('terminal', `Ignored terminal run by ${this.lastModePolicy.label} Mode`, terminalRun.commandLine, 'blocked');
				this.updateStatus(modeBlock);
				return;
			}
			if (!this.executionAuthorization) {
				this.recordTranscript('terminal', 'Ignored terminal run before plan execution authorization', terminalRun.commandLine, 'blocked');
				this.updateStatus('Ignored terminal run because plan approval is required before terminal execution.');
				return;
			}
			try {
				const runId = this.runVisibleTerminal(terminalRun.commandLine, terminalRun.cwd, terminalRun.reason);
				if (terminalRun.id !== undefined) {
					this.trackTerminalRunRequest(runId, { id: terminalRun.id, method: terminalRun.method, requestedAt: Date.now(), ...(terminalRun.verificationCheckId ? { verificationCheckId: terminalRun.verificationCheckId } : {}) });
				}
				if (terminalRun.verificationCheckId) {
					void this.attachTerminalRunToVerification(runId, terminalRun.verificationCheckId, terminalRun.commandLine, 'backend terminal notification');
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.recordTranscript('terminal', 'Ignored terminal run blocked by workspace sandbox', message, 'blocked');
				this.updateStatus(message);
			}
		}
	}

	private publishDiffReview(review: ExternalDiffReview, reason: string): void {
		this.activeDiffReview = review;
		if (this.lastParallelMergeRequest && review.threadId === this.lastParallelMergeRequest.threadId) {
			this.lastParallelMergeDiffReviewId = review.reviewId;
			this.postParallelMergeStatus();
		}
		this.clearStalePatchCheckpoints(review);
		this.postMessage({ type: 'diffReview', review });
		this.postDiffReviewStatus();
		this.postExecutionGateStatus();
		void this.patchActiveSession({
			status: 'diff_review',
			evidence: this.activeEvidence(`${reason} ${review.files.length} file${review.files.length === 1 ? '' : 's'} waiting for review.`),
		});
		this.recordTranscript('diff', `Diff review ready: ${review.files.length} file${review.files.length === 1 ? '' : 's'}`, review.files.map(file => `${file.status}: ${file.path}`).join('\n'), 'pending');
		this.notifyApprovalNeeded('Vibe Codex diff review is ready', `${review.files.length} file${review.files.length === 1 ? '' : 's'} waiting for Accept or Reject.`);
		this.updateStatus(`Diff review ready: ${review.files.length} file${review.files.length === 1 ? '' : 's'}.`);
	}

	private parallelMergeDiffReviewBlocker(review: ExternalDiffReview): string | undefined {
		const mergeRequest = this.lastParallelMergeRequest;
		if (!mergeRequest || this.lastParallelMergeDiffReviewId) {
			return undefined;
		}
		if (!review.threadId) {
			return `Parallel merge-back diff review must include threadId ${mergeRequest.threadId} before it can enter review.`;
		}
		if (review.threadId !== mergeRequest.threadId) {
			return `Parallel merge-back diff review thread ${review.threadId} does not match selected lane ${mergeRequest.threadId}.`;
		}
		return undefined;
	}

	private runVisibleTerminal(commandLine: string, cwd?: string, reason?: string): string {
		const safeCwd = this.resolveTerminalCwd(cwd);
		const run = this.terminalRunner.run(commandLine, safeCwd, reason);
		this.terminalRuns.set(run.id, run);
		this.postTerminalRun(run);
		this.scheduleLongRunningTerminalNotification(run);
		this.recordTranscript('terminal', reason || 'Started terminal run', commandLine, 'running');
		void this.patchActiveSession({
			status: 'terminal',
			evidence: this.activeEvidence(`Started terminal run: ${commandLine}`),
		});
		this.updateStatus(`Started terminal run: ${commandLine}`);
		return run.id;
	}

	private async handleTerminalRunUpdate(run: VibeCodexCapturedTerminalRun): Promise<void> {
		this.terminalRuns.set(run.id, run);
		this.postTerminalRun(run);
		if (run.status === 'running') {
			void this.notifyTerminalOutput(run);
		} else {
			await this.notifyTerminalOutput(run);
		}
		const insight = await this.recordTerminalInsight(createTerminalInsight(run));
		if (run.status === 'running') {
			return;
		}
		this.clearTerminalNotification(run.id);
		this.notifyTerminalCompletion(run);
		const diagnostics = await this.recordDiagnosticsEvidence(run);
		await this.updateDiagnosticsBaselineCheck(diagnostics, run.id);
		await this.recordParallelTerminalResult(run, diagnostics, insight);
		const checkId = this.verificationRunChecks.get(run.id);
		if (checkId) {
			this.verificationRunChecks.delete(run.id);
			const status: VibeCodexVerificationStatus = run.status === 'passed' ? 'passed' : run.status === 'interrupted' ? 'skipped' : 'failed';
			const evidence = terminalRunEvidence(run, diagnostics, insight, { checkId, verificationStatus: status });
			await this.updateVerificationCheck(checkId, status, evidence, run.id);
			await this.notifyTerminalResult(run, diagnostics, insight, { checkId, verificationStatus: status });
			await this.applyTerminalFailureRemediation(run, insight, evidence, { checkId, verificationStatus: status });
			this.recordTranscript('verification', `Verification ${status}: ${run.reason ?? run.commandLine}`, evidence, status === 'failed' ? 'failed' : 'completed');
			this.updateStatus(`Verification ${status}: ${run.commandLine}`);
			return;
		}
		const evidence = terminalRunEvidence(run, diagnostics, insight);
		await this.notifyTerminalResult(run, diagnostics, insight);
		await this.applyTerminalFailureRemediation(run, insight, evidence);
		await this.patchActiveSession({
			status: run.status === 'failed' ? 'error' : 'terminal',
			evidence: this.activeEvidence(evidence),
		});
		this.recordTranscript('terminal', `Terminal ${run.status}: ${run.commandLine}`, evidence, run.status === 'failed' ? 'failed' : 'completed');
	}

	private async recordParallelTerminalResult(run: VibeCodexCapturedTerminalRun, diagnostics: VibeCodexDiagnosticsSnapshot | undefined, insight: VibeCodexTerminalInsight): Promise<void> {
		const request = this.terminalRunRequests.get(run.id);
		if (!request?.parallelTaskId || !request.parallelThreadId || run.status === 'running' || this.reportedParallelTerminalRuns.has(run.id)) {
			return;
		}
		this.reportedParallelTerminalRuns.add(run.id);
		const status: VibeCodexParallelResult['status'] = run.status === 'passed' ? 'completed' : run.status === 'interrupted' ? 'blocked' : 'failed';
		const evidence = redactSensitiveText(terminalRunEvidence(run, diagnostics, insight));
		const result: VibeCodexParallelResult = {
			taskId: redactSensitiveText(request.parallelTaskId),
			threadId: redactSensitiveText(request.parallelThreadId),
			...(request.parallelBranchName ? { branchName: redactSensitiveText(request.parallelBranchName) } : {}),
			...(request.parallelWorktreePath ? { worktreePath: redactSensitiveText(request.parallelWorktreePath) } : {}),
			status,
			summary: redactSensitiveText(`Parallel lane ${request.parallelThreadId} terminal ${run.status}: ${run.reason ?? run.commandLine}`),
			changedFiles: [],
			verification: [evidence],
			risks: status === 'completed' ? [] : [`Terminal run ended with ${run.status}.`],
			producedAt: run.endedAt ?? Date.now(),
		};
		await this.recordParallelResult(result);
		await this.notifyParallelResult(result, {
			expectedBy: request.parallelResultExpectedBy ?? 'dispatch_parallel_lane',
			terminalRunId: run.id,
			terminalStatus: run.status,
		});
	}

	private async notifyParallelResult(result: VibeCodexParallelResult, metadata?: { readonly expectedBy?: string; readonly terminalRunId?: string; readonly terminalStatus?: VibeCodexCapturedTerminalRun['status'] | 'running' }): Promise<void> {
		if (!this.bridge?.connected) {
			return;
		}
		const payload = {
			source: 'externalExtension',
			...(metadata?.expectedBy ? { expectedBy: metadata.expectedBy } : {}),
			...(metadata?.terminalRunId ? { terminalRunId: metadata.terminalRunId } : {}),
			...(metadata?.terminalStatus ? { terminalStatus: metadata.terminalStatus } : {}),
			result,
		};
		this.recordProtocol('out', 'agent/parallelResult', { jsonrpc: '2.0', method: 'agent/parallelResult', params: payload });
		await this.bridge.notify('agent/parallelResult', payload).then(undefined, error => {
			this.recordProtocol('error', 'agent/parallelResult failed', error instanceof Error ? error.message : String(error));
		});
	}

	private async applyTerminalFailureRemediation(run: VibeCodexCapturedTerminalRun, insight: VibeCodexTerminalInsight, evidence: string, verification?: { readonly checkId: string; readonly verificationStatus: VibeCodexVerificationStatus }): Promise<void> {
		if (run.status !== 'failed' || !this.activePlan) {
			return;
		}
		const previousRevision = this.activePlan.revision;
		const redactedEvidence = redactSensitiveText(evidence);
		const remediationReason = insight.findings.find(finding => finding.severity === 'error')?.title ?? `${redactSensitiveText(run.commandLine)} failed`;
		const failedPlan = applyPlanRemediation(this.activePlan, {
			reason: remediationReason,
			evidence: redactedEvidence,
			failedStepHint: verification?.checkId,
		});
		const remediationEvent = createTerminalRemediationEvent({
			taskId: failedPlan.taskId,
			previousRevision,
			plan: failedPlan,
			run,
			insight,
			reason: remediationReason,
			evidence: redactedEvidence,
			...(verification ? { verification } : {}),
		});
		this.terminalRemediations = [remediationEvent, ...this.terminalRemediations.filter(event => event.id !== remediationEvent.id)].slice(0, 24);
		this.setActivePlan(failedPlan, `Terminal failure created remediation plan revision ${failedPlan.revision}.`, 'updated');
		this.postTerminalRemediationStatus();
		const payload = {
			source: 'externalExtension',
			action: 'terminalFailureRemediation',
			taskId: failedPlan.taskId,
			previousRevision,
			revision: failedPlan.revision,
			plan: failedPlan,
			terminalRun: {
				id: run.id,
				commandLine: redactSensitiveText(run.commandLine),
				status: run.status,
				exitCode: run.exitCode,
				signal: run.signal,
				outputTail: redactSensitiveText(run.output.slice(-1600)),
			},
			terminalInsight: {
				summary: redactSensitiveText(insight.summary),
				findings: insight.findings.map(finding => ({
					...finding,
					title: redactSensitiveText(finding.title),
					detail: redactSensitiveText(finding.detail),
				})),
				followUpPrompt: insight.followUpPrompt ? redactSensitiveText(insight.followUpPrompt) : undefined,
			},
			verification,
			remediationStatus: remediationEvent,
		};
		if (this.bridge?.connected) {
			this.recordProtocol('out', 'agent/updatePlan', { jsonrpc: '2.0', method: 'agent/updatePlan', params: payload });
			await this.bridge.notify('agent/updatePlan', payload);
		}
		this.recordTranscript('plan', `Created remediation plan r${failedPlan.revision}`, `Terminal run failed: ${run.commandLine}`, 'pending');
	}

	private async notifyTerminalOutput(run: VibeCodexCapturedTerminalRun): Promise<void> {
		if (!this.bridge?.connected) {
			return;
		}
		const previous = this.terminalOutputStreamStates.get(run.id);
		const outputDeltaLength = previous ? Math.max(0, run.output.length - previous.outputLength) : run.output.length;
		const final = run.status !== 'running';
		const now = Date.now();
		if (!final && previous && outputDeltaLength < terminalOutputStreamMinDeltaChars && now - previous.notifiedAt < terminalOutputStreamMinIntervalMs) {
			return;
		}
		const { notification, state } = createTerminalOutputStreamNotification(run, previous, now);
		if (!final && notification.outputDelta.length === 0 && previous?.status === run.status) {
			return;
		}
		this.terminalOutputStreamStates.set(run.id, state);
		this.recordProtocol('out', 'agent/terminalOutput', { jsonrpc: '2.0', method: 'agent/terminalOutput', params: notification });
		await this.bridge.notify('agent/terminalOutput', notification).then(undefined, error => {
			this.recordProtocol('error', 'agent/terminalOutput failed', error instanceof Error ? error.message : String(error));
		});
	}

	private async notifyTerminalResult(run: VibeCodexCapturedTerminalRun, diagnostics: VibeCodexDiagnosticsSnapshot | undefined, insight: VibeCodexTerminalInsight, verification?: { readonly checkId: string; readonly verificationStatus: VibeCodexVerificationStatus }): Promise<void> {
		if (!this.bridge?.connected) {
			return;
		}
		const request = this.terminalRunRequests.get(run.id);
		if (request) {
			this.terminalRunRequestHistory.set(run.id, request);
			this.terminalRunRequests.delete(run.id);
		}
		const terminalRequest = request ? {
			...request,
			...(request.verificationCheckId ? { verificationCheckId: redactSensitiveText(request.verificationCheckId) } : {}),
			...(request.toolName ? { toolName: redactSensitiveText(request.toolName) } : {}),
			...(request.previewTargetId ? { previewTargetId: redactSensitiveText(request.previewTargetId) } : {}),
			...(request.previewUrl ? { previewUrl: redactSensitiveText(request.previewUrl) } : {}),
			...(request.previewLabel ? { previewLabel: redactSensitiveText(request.previewLabel) } : {}),
			...(request.parallelTaskId ? { parallelTaskId: redactSensitiveText(request.parallelTaskId) } : {}),
			...(request.parallelThreadId ? { parallelThreadId: redactSensitiveText(request.parallelThreadId) } : {}),
			...(request.parallelBranchName ? { parallelBranchName: redactSensitiveText(request.parallelBranchName) } : {}),
			...(request.parallelWorktreePath ? { parallelWorktreePath: redactSensitiveText(request.parallelWorktreePath) } : {}),
			...(request.parallelPromptFocus ? { parallelPromptFocus: redactSensitiveText(request.parallelPromptFocus) } : {}),
			...(request.parallelResultExpectedBy ? { parallelResultExpectedBy: redactSensitiveText(request.parallelResultExpectedBy) } : {}),
		} : undefined;
		const payload = {
			source: 'externalExtension',
			taskId: this.activePlan?.taskId,
			revision: this.activePlan?.revision,
			approvedTaskId: this.executionAuthorization?.taskId,
			approvedRevision: this.executionAuthorization?.revision,
			approvedPlanHash: this.executionAuthorization?.planHash,
			terminalRequest,
			run: {
				id: run.id,
				commandLine: redactSensitiveText(run.commandLine),
				cwd: run.cwd,
				reason: run.reason ? redactSensitiveText(run.reason) : undefined,
				startedAt: run.startedAt,
				endedAt: run.endedAt,
				status: run.status,
				exitCode: run.exitCode,
				signal: run.signal,
				outputTail: redactSensitiveText(run.output.slice(-4000)),
			},
			diagnosticsSummary: diagnostics ? diagnosticsSnapshotSummary(diagnostics) : undefined,
			terminalInsight: {
				summary: redactSensitiveText(insight.summary),
				findings: insight.findings.map(finding => ({
					...finding,
					title: redactSensitiveText(finding.title),
					detail: redactSensitiveText(finding.detail),
				})),
				urls: insight.urls,
				promptBlock: redactSensitiveText(terminalInsightPromptBlock(insight)),
			},
			verification,
			evidence: redactSensitiveText(terminalRunEvidence(run, diagnostics, insight, verification)),
		};
		this.recordProtocol('out', 'agent/terminalResult', { jsonrpc: '2.0', method: 'agent/terminalResult', params: payload });
		await this.bridge.notify('agent/terminalResult', payload).then(() => {
			this.recordTranscript('terminal', `Reported terminal result to backend: ${run.status}`, `${run.id}: ${run.commandLine}`, run.status === 'failed' ? 'failed' : 'completed');
		}, error => {
			this.recordProtocol('error', 'agent/terminalResult failed', error instanceof Error ? error.message : String(error));
		});
	}

	private async recordTerminalInsight(insight: VibeCodexTerminalInsight): Promise<VibeCodexTerminalInsight> {
		if (!insight.findings.length) {
			return insight;
		}
		const signature = terminalInsightSignature(insight);
		if (this.terminalInsightSignatures.get(insight.runId) === signature) {
			return this.terminalInsights.get(insight.runId) ?? insight;
		}
		this.terminalInsightSignatures.set(insight.runId, signature);
		this.terminalInsights.set(insight.runId, insight);
		this.postTerminalInsights();
		this.postMessage({ type: 'terminalInsight', insight });
		const failed = insight.findings.some(finding => finding.severity === 'error');
		this.recordTranscript('terminal', `Terminal insight: ${insight.summary}`, terminalInsightPromptBlock(insight), failed ? 'failed' : insight.status === 'running' ? 'running' : 'completed');
		if (this.bridge?.connected) {
			const payload = {
				source: 'externalExtension',
				taskId: this.activePlan?.taskId,
				revision: this.activePlan?.revision,
				insight,
				promptBlock: terminalInsightPromptBlock(insight),
			};
			try {
				this.recordProtocol('out', 'agent/terminalInsight', { jsonrpc: '2.0', method: 'agent/terminalInsight', params: payload });
				await this.bridge.notify('agent/terminalInsight', payload);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.recordProtocol('error', 'agent/terminalInsight failed', { error: message });
			}
		}
		return insight;
	}

	private async recordDiagnosticsEvidence(run: VibeCodexCapturedTerminalRun): Promise<VibeCodexDiagnosticsSnapshot> {
		const snapshot = collectDiagnosticsSnapshot();
		this.lastDiagnosticsSnapshot = snapshot;
		this.postDeliveryBar();
		const summary = diagnosticsSnapshotSummary(snapshot);
		const payload = {
			source: 'externalExtension',
			runId: run.id,
			commandLine: run.commandLine,
			status: run.status,
			taskId: this.activePlan?.taskId,
			revision: this.activePlan?.revision,
			summary,
			diagnostics: snapshot,
			promptBlock: diagnosticsSnapshotPromptBlock(snapshot),
		};
		this.postMessage({ type: 'diagnosticsEvidence', runId: run.id, commandLine: run.commandLine, status: run.status, summary, snapshot });
		if (this.bridge?.connected) {
			try {
				this.recordProtocol('out', 'agent/diagnosticsEvidence', { jsonrpc: '2.0', method: 'agent/diagnosticsEvidence', params: payload });
				await this.bridge.notify('agent/diagnosticsEvidence', payload);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.recordProtocol('error', 'agent/diagnosticsEvidence failed', { error: message });
			}
		}
		return snapshot;
	}

	private async updateDiagnosticsBaselineCheck(snapshot: VibeCodexDiagnosticsSnapshot, runId: string): Promise<void> {
		const plan = this.lastVerificationPlan;
		const check = plan?.checks.find(candidate => candidate.id === 'diagnostics-baseline');
		if (!plan || !check) {
			return;
		}
		const status = diagnosticsBaselineStatus(snapshot, plan.diagnosticsBaseline);
		const evidence = diagnosticsBaselineEvidence(snapshot, plan.diagnosticsBaseline);
		await this.updateVerificationCheck(check.id, status, evidence, runId);
		this.recordTranscript('verification', `Diagnostics baseline ${status}`, evidence, status === 'failed' ? 'failed' : 'completed');
	}

	private postTerminalRun(run: VibeCodexCapturedTerminalRun): void {
		this.postMessage({ type: 'terminalRun', run: { ...run, proceeded: this.proceededTerminalRuns.has(run.id) } });
		this.postTerminalControlStatus();
		this.postTerminalOutputStatus();
		this.postToolTimelineStatus();
		this.postNotificationStatus();
	}

	private postTerminalControlStatus(response?: VibeCodexTerminalControlResponse): void {
		const status = this.currentTerminalControlStatus(response);
		this.postMessage({
			type: 'terminalControlStatus',
			summary: this.terminalControlStatusSummary(status),
			status,
		});
	}

	private currentTerminalControlStatus(response?: VibeCodexTerminalControlResponse): VibeCodexTerminalControlStatusResponse {
		const runs = [...this.terminalRuns.values()];
		const latestRun = runs[runs.length - 1];
		const selectedRun = response?.runId ? this.terminalRuns.get(response.runId) : latestRun;
		const modeBlock = this.modeBlockReason('terminal');
		const hasAuthorization = !!this.executionAuthorization;
		const blockers = [
			...(!selectedRun ? ['No captured terminal run is available.'] : []),
			...(modeBlock ? [modeBlock] : []),
			...(!hasAuthorization ? ['Exact visual plan approval is required before interrupting or retrying backend terminal runs.'] : []),
		];
		const canControl = !!selectedRun && !modeBlock && hasAuthorization;
		const selectedProceeded = selectedRun ? this.proceededTerminalRuns.has(selectedRun.id) : false;
		return {
			ok: !!selectedRun,
			source: 'externalExtension',
			version: 1,
			...(response ? { response } : {}),
			...(selectedRun ? { selectedRun: this.redactedTerminalRunForStatus(selectedRun) } : {}),
			...(latestRun ? { latestRunId: latestRun.id } : {}),
			counts: {
				total: runs.length,
				running: runs.filter(run => run.status === 'running').length,
				passed: runs.filter(run => run.status === 'passed').length,
				failed: runs.filter(run => run.status === 'failed').length,
				interrupted: runs.filter(run => run.status === 'interrupted').length,
				proceeded: runs.filter(run => this.proceededTerminalRuns.has(run.id)).length,
			},
			actions: {
				canInspectStatus: !!selectedRun,
				canInterrupt: canControl && selectedRun?.status === 'running',
				canRetry: canControl,
				canProceed: !!selectedRun && selectedRun.status === 'running' && !selectedProceeded,
				requiresExactPlanApproval: !hasAuthorization,
				requiresMutationMode: !!modeBlock,
			},
			blockers,
			guardrails: [
				'Terminal control status is read-only and never starts, interrupts, retries, approves plans, changes mode, edits files, or unlocks execution.',
				'Proceed-while-running only records a background handoff for an already-running terminal; interrupt and retry requests still flow through Mode Policy, exact visual-plan authorization, visible terminal evidence, and JSON-RPC protocol diagnostics.',
				'Raw terminal output is intentionally omitted here; use command_output or terminal/output for capped redacted output tails.',
			],
			message: selectedRun
				? `Terminal control readiness for ${selectedRun.id}: ${selectedRun.status}.`
				: 'No captured terminal run is available for control readiness.',
		};
	}

	private redactedTerminalRunForStatus(run: VibeCodexCapturedTerminalRun): VibeCodexTerminalControlStatusResponse['selectedRun'] {
		return {
			id: redactSensitiveText(run.id),
			status: run.status,
			commandLine: redactSensitiveText(run.commandLine),
			...(run.cwd ? { cwd: redactSensitiveText(run.cwd) } : {}),
			...(run.reason ? { reason: redactSensitiveText(run.reason) } : {}),
			startedAt: run.startedAt,
			...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
			...(run.exitCode !== undefined ? { exitCode: run.exitCode } : {}),
			...(run.signal ? { signal: redactSensitiveText(run.signal) } : {}),
			proceeded: this.proceededTerminalRuns.has(run.id),
		};
	}

	private terminalControlStatusSummary(status: VibeCodexTerminalControlStatusResponse): string {
		if (status.response) {
			return `${terminalControlSummary(status.response)} Control ready: interrupt=${status.actions.canInterrupt}, retry=${status.actions.canRetry}, proceed=${status.actions.canProceed}.`;
		}
		return `${status.message} Control ready: interrupt=${status.actions.canInterrupt}, retry=${status.actions.canRetry}, proceed=${status.actions.canProceed}.`;
	}

	private postTerminalOutputStatus(response?: VibeCodexTerminalOutputResponse): void {
		const status = this.currentTerminalOutputStatus(response);
		this.postMessage({
			type: 'terminalOutputStatus',
			summary: this.terminalOutputStatusSummary(status),
			status,
		});
	}

	private currentTerminalOutputStatus(response?: VibeCodexTerminalOutputResponse): VibeCodexTerminalOutputStatusResponse {
		const runs = [...this.terminalRuns.values()];
		const latestRun = runs[runs.length - 1];
		const request = this.lastTerminalOutputRequest ?? {
			id: 'sidebar-terminal-output-status',
			method: 'sidebar/terminalOutputStatus',
			latest: true,
			tailChars: 2000,
			requestedAt: Date.now(),
		};
		const selectedRun = response?.runId
			? this.terminalRuns.get(response.runId)
			: request.runId
				? this.terminalRuns.get(request.runId)
				: latestRun;
		const computedResponse = response ?? createTerminalOutputResponse(request, selectedRun);
		const outputTail = computedResponse.outputTail ?? '';
		return {
			ok: computedResponse.ok,
			source: 'externalExtension',
			version: 1,
			response: computedResponse,
			...(request.runId ? { requestedRunId: redactSensitiveText(request.runId) } : {}),
			latest: request.latest,
			tailChars: request.tailChars,
			...(request.tailLines !== undefined ? { tailLines: request.tailLines } : {}),
			...(latestRun ? { latestRunId: latestRun.id } : {}),
			counts: {
				total: runs.length,
				running: runs.filter(run => run.status === 'running').length,
				completed: runs.filter(run => run.status !== 'running').length,
			},
			...(selectedRun ? { selectedRun: this.redactedTerminalOutputRunForStatus(selectedRun) } : {}),
			output: {
				available: computedResponse.ok && outputTail.length > 0,
				tailLength: outputTail.length,
				truncated: Boolean(computedResponse.truncated),
				...(outputTail ? { tailPreview: outputTail.slice(0, 1600) } : {}),
			},
			guardrails: [
				'Terminal output status is read-only and never starts terminal commands, interrupts or retries runs, creates approval cards, changes verification checks, approves plans, edits files, or unlocks execution.',
				'command_output and terminal/output responses are capped, redacted, and selected from known Vibe Codex terminal runs only.',
				'Use terminal_insight_status for classified failures and terminal_control/status for interrupt or retry readiness.',
			],
			message: computedResponse.ok
				? `Terminal output is available for ${computedResponse.runId ?? 'latest run'} (${outputTail.length} returned characters).`
				: computedResponse.error ?? 'No captured terminal output is available.',
		};
	}

	private redactedTerminalOutputRunForStatus(run: VibeCodexCapturedTerminalRun): VibeCodexTerminalOutputStatusResponse['selectedRun'] {
		return {
			id: redactSensitiveText(run.id),
			status: run.status,
			commandLine: redactSensitiveText(run.commandLine),
			...(run.cwd ? { cwd: redactSensitiveText(run.cwd) } : {}),
			startedAt: run.startedAt,
			...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
			...(run.exitCode !== undefined ? { exitCode: run.exitCode } : {}),
			...(run.signal ? { signal: redactSensitiveText(run.signal) } : {}),
			outputLength: run.output.length,
		};
	}

	private terminalOutputStatusSummary(status: VibeCodexTerminalOutputStatusResponse): string {
		return `${terminalOutputSummary(status.response ?? { ok: false, source: 'externalExtension', error: status.message })} Tail ready: ${status.output.available ? 'yes' : 'no'}; truncated=${status.output.truncated}.`;
	}

	private postTerminalInsights(): void {
		const insights = [...this.terminalInsights.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
		this.postMessage({ type: 'terminalInsights', insights });
		this.postTerminalInsightStatus();
		this.postPreviewStatus();
	}

	private postTerminalInsightStatus(response?: VibeCodexTerminalInsightStatusResponse): void {
		const status = response ?? this.currentTerminalInsightStatus();
		this.postMessage({
			type: 'terminalInsightStatus',
			summary: terminalInsightStatusSummary(status),
			status,
		});
	}

	private currentTerminalInsightStatus(request?: VibeCodexTerminalInsightStatusRequest): VibeCodexTerminalInsightStatusResponse {
		return createTerminalInsightStatusResponse(request ?? {
			id: 'sidebar-terminal-insight-status',
			method: 'sidebar/terminalInsightStatus',
			latest: false,
			includeFindings: true,
			maxFindings: 6,
			requestedAt: Date.now(),
		}, [...this.terminalInsights.values()]);
	}

	private postTerminalRemediationStatus(response?: VibeCodexTerminalRemediationStatusResponse): void {
		const status = response ?? this.currentTerminalRemediationStatus();
		this.postMessage({
			type: 'terminalRemediationStatus',
			summary: terminalRemediationStatusSummary(status),
			status,
		});
	}

	private currentTerminalRemediationStatus(request?: VibeCodexTerminalRemediationStatusRequest): VibeCodexTerminalRemediationStatusResponse {
		return createTerminalRemediationStatusResponse(request ?? {
			id: 'sidebar-terminal-remediation-status',
			method: 'sidebar/terminalRemediationStatus',
			...(this.activePlan?.taskId ? { taskId: this.activePlan.taskId } : {}),
			includePlan: false,
			includeEvidence: false,
			maxEvents: 8,
			requestedAt: Date.now(),
		}, {
			events: this.terminalRemediations,
			activePlan: this.activePlan,
			authorization: this.executionAuthorization,
		});
	}

	private postDeliveryBar(): void {
		const delivery = createDeliveryBarState({
			plan: this.activePlan,
			hasExecutionAuthorization: !!this.executionAuthorization,
			verificationPlan: this.lastVerificationPlan,
			diffReview: this.activeDiffReview,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
			fileCheckpointPaths: [...this.patchCheckpoints.keys()],
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			diagnosticsBaseline: this.lastVerificationPlan?.diagnosticsBaseline,
			parallelPlan: this.lastParallelPlan,
			parallelReview: this.lastParallelReview,
			parallelMergeRequest: this.lastParallelMergeRequest,
		});
		this.postMessage({
			type: 'deliveryBar',
			state: delivery,
		});
		const handoff = this.postCommitHandoff();
		const smoke = this.postSmokeBenchmark(delivery.ready, handoff);
		const finalReview = this.postFinalReview(delivery, smoke, handoff);
		const gate = { deliveryBar: delivery, commitHandoff: handoff, smokeBenchmark: smoke, finalReview };
		this.postWorkflowStatus(this.currentWorkflowStatus(undefined, gate));
		this.postHappyPathStatus(this.currentHappyPathStatus(undefined, gate));
		this.postDeliveryBarStatus(createDeliveryBarStatusResponse({
			id: 'sidebar-delivery-bar-status',
			method: 'sidebar/deliveryBarStatus',
			includeChecks: true,
			includeBlockers: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, { deliveryBar: delivery }));
		this.postVerificationStatus(createVerificationStatusResponse({
			id: 'sidebar-verification-status',
			method: 'sidebar/verificationStatus',
			includeChecks: true,
			includeDiagnostics: true,
			includeTerminalRuns: false,
			includeFinalReview: true,
			requestedAt: Date.now(),
		}, {
			verificationPlan: this.lastVerificationPlan,
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			deliveryBar: delivery,
			smokeBenchmark: smoke,
			finalReview,
			terminalRuns: [...this.terminalRuns.values()],
		}));
		this.postTaskCompletionStatus(createTaskCompletionStatusResponse({
			id: 'sidebar-task-completion-status',
			method: 'sidebar/taskCompletionStatus',
			includeLatest: true,
			includeBlockers: true,
			includeEvidence: true,
			includePromptBlock: false,
			includeResult: false,
			requestedAt: Date.now(),
		}, {
			finalReview,
			latestCompletion: this.lastTaskCompletionResponse,
		}));
	}

	private postDeliveryBarStatus(response?: VibeCodexDeliveryBarStatusResponse): void {
		const status = response ?? this.currentDeliveryBarStatus();
		this.postMessage({
			type: 'deliveryBarStatus',
			summary: deliveryBarStatusSummary(status),
			status,
		});
	}

	private currentDeliveryBarStatus(request?: VibeCodexDeliveryBarStatusRequest): VibeCodexDeliveryBarStatusResponse {
		const gate = this.createCurrentDeliveryGate();
		return createDeliveryBarStatusResponse(request ?? {
			id: 'sidebar-delivery-bar-status',
			method: 'sidebar/deliveryBarStatus',
			includeChecks: true,
			includeBlockers: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			deliveryBar: gate.deliveryBar,
		});
	}

	private postVerificationStatus(response?: VibeCodexVerificationStatusResponse): void {
		const status = response ?? this.currentVerificationStatus();
		this.postMessage({
			type: 'verificationStatus',
			summary: verificationStatusSummary(status),
			status,
		});
		this.postFinalReviewStatus(status.finalReview ? status : undefined);
	}

	private currentVerificationStatus(request?: VibeCodexVerificationStatusRequest): VibeCodexVerificationStatusResponse {
		const gate = this.createCurrentDeliveryGate();
		return createVerificationStatusResponse(request ?? {
			id: 'sidebar-verification-status',
			method: 'sidebar/verificationStatus',
			includeChecks: true,
			includeDiagnostics: true,
			includeTerminalRuns: false,
			includeFinalReview: true,
			requestedAt: Date.now(),
		}, {
			verificationPlan: this.lastVerificationPlan,
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			deliveryBar: gate.deliveryBar,
			smokeBenchmark: gate.smokeBenchmark,
			finalReview: gate.finalReview,
			terminalRuns: [...this.terminalRuns.values()],
		});
	}

	private postFinalReviewStatus(response?: VibeCodexVerificationStatusResponse): void {
		const status = response ?? this.currentFinalReviewStatus();
		this.postMessage({
			type: 'finalReviewStatus',
			summary: verificationStatusSummary(status),
			status,
		});
	}

	private currentFinalReviewStatus(request?: VibeCodexVerificationStatusRequest, gate = this.createCurrentDeliveryGate()): VibeCodexVerificationStatusResponse {
		return createVerificationStatusResponse(request ?? {
			id: 'sidebar-final-review-status',
			method: 'sidebar/finalReviewStatus',
			includeChecks: false,
			includeDiagnostics: false,
			includeTerminalRuns: false,
			includeFinalReview: true,
			requestedAt: Date.now(),
		}, {
			verificationPlan: this.lastVerificationPlan,
			deliveryBar: gate.deliveryBar,
			smokeBenchmark: gate.smokeBenchmark,
			finalReview: gate.finalReview,
		});
	}

	private postTaskCompletionStatus(response?: VibeCodexTaskCompletionStatusResponse): void {
		const status = response ?? this.currentTaskCompletionStatus();
		this.postMessage({
			type: 'taskCompletionStatus',
			summary: taskCompletionStatusSummary(status),
			status,
		});
	}

	private currentTaskCompletionStatus(request?: VibeCodexTaskCompletionStatusRequest): VibeCodexTaskCompletionStatusResponse {
		const gate = this.createCurrentDeliveryGate();
		return createTaskCompletionStatusResponse(request ?? {
			id: 'sidebar-task-completion-status',
			method: 'sidebar/taskCompletionStatus',
			includeLatest: true,
			includeBlockers: true,
			includeEvidence: true,
			includePromptBlock: false,
			includeResult: false,
			requestedAt: Date.now(),
		}, {
			finalReview: gate.finalReview,
			latestCompletion: this.lastTaskCompletionResponse,
		});
	}

	private postCommitHandoff(): VibeCodexCommitHandoff {
		const handoff = createCommitHandoff({
			plan: this.activePlan,
			diffReview: this.activeDiffReview,
			verificationPlan: this.lastVerificationPlan,
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
		});
		this.lastCommitHandoff = handoff;
		this.postMessage({ type: 'commitHandoff', handoff });
		this.postCommitHandoffStatus(this.currentCommitHandoffStatus(undefined, handoff));
		return handoff;
	}

	private postCommitHandoffStatus(response?: VibeCodexCommitHandoffStatusResponse): void {
		const status = response ?? this.currentCommitHandoffStatus();
		this.postMessage({
			type: 'commitHandoffStatus',
			summary: commitHandoffStatusSummary(status),
			status,
		});
	}

	private currentCommitHandoffStatus(request?: VibeCodexCommitHandoffStatusRequest, handoff?: VibeCodexCommitHandoff): VibeCodexCommitHandoffStatusResponse {
		return createCommitHandoffStatusResponse(request ?? {
			id: 'sidebar-commit-handoff-status',
			method: 'sidebar/commitHandoffStatus',
			includeMessage: true,
			includeEvidence: true,
			includeCommands: true,
			requestedAt: Date.now(),
		}, handoff ?? this.lastCommitHandoff ?? this.createCurrentDeliveryGate().commitHandoff);
	}

	private postSmokeBenchmark(deliveryReady: boolean, handoff: VibeCodexCommitHandoff = this.lastCommitHandoff ?? createCommitHandoff({
		plan: this.activePlan,
		diffReview: this.activeDiffReview,
		verificationPlan: this.lastVerificationPlan,
		diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
		taskCheckpointId: this.taskCheckpointId,
		fileCheckpointCount: this.patchCheckpoints.size,
	})): VibeCodexSmokeBenchmarkState {
		const state = createSmokeBenchmarkState({
			inlinePromptSession: this.lastInlinePromptSession,
			plan: this.activePlan,
			planRevisionHistory: this.planRevisionHistory,
			hasExecutionAuthorization: !!this.executionAuthorization,
			parallelPlan: this.lastParallelPlan,
			parallelReview: this.lastParallelReview,
			parallelMergeRequest: this.lastParallelMergeRequest,
			terminalRuns: [...this.terminalRuns.values()],
			verificationPlan: this.lastVerificationPlan,
			diffReview: this.activeDiffReview,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
			commitHandoff: handoff,
			deliveryReady,
		});
		this.postMessage({ type: 'smokeBenchmark', state });
		this.postSmokeBenchmarkStatus(this.currentSmokeBenchmarkStatus(undefined, state));
		return state;
	}

	private postSmokeBenchmarkStatus(response?: VibeCodexSmokeBenchmarkStatusResponse): void {
		const status = response ?? this.currentSmokeBenchmarkStatus();
		this.postMessage({
			type: 'smokeBenchmarkStatus',
			summary: smokeBenchmarkStatusSummary(status),
			status,
		});
	}

	private currentSmokeBenchmarkStatus(request?: VibeCodexSmokeBenchmarkStatusRequest, state?: VibeCodexSmokeBenchmarkState): VibeCodexSmokeBenchmarkStatusResponse {
		return createSmokeBenchmarkStatusResponse(request ?? {
			id: 'sidebar-smoke-benchmark-status',
			method: 'sidebar/smokeBenchmarkStatus',
			includeMilestones: true,
			includeBlockers: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			smokeBenchmark: state ?? this.createCurrentDeliveryGate().smokeBenchmark,
		});
	}

	private postFinalReview(deliveryBar: ReturnType<typeof createDeliveryBarState>, smokeBenchmark: VibeCodexSmokeBenchmarkState, commitHandoff: VibeCodexCommitHandoff): VibeCodexFinalReviewState {
		const review = createFinalReviewState({ deliveryBar, smokeBenchmark, commitHandoff });
		this.postMessage({ type: 'finalReview', review, promptBlock: finalReviewPromptBlock(review) });
		this.postFinalReviewStatus(this.currentFinalReviewStatus(undefined, { deliveryBar, commitHandoff, smokeBenchmark, finalReview: review }));
		this.postAutoCommitStatus(this.currentAutoCommitStatus(undefined, { commitHandoff, finalReview: review }));
		this.notifyFinalReview(review);
		void this.patchActiveSession({ finalReview: review });
		return review;
	}

	private autoCommitEnabled(): boolean {
		return vscode.workspace.getConfiguration('vibeCodex.extension').get<boolean>('autoCommit.enabled', false);
	}

	private currentAutoCommitStatus(
		request?: VibeCodexAutoCommitStatusRequest,
		gate: { readonly commitHandoff: VibeCodexCommitHandoff; readonly finalReview: VibeCodexFinalReviewState } = this.createCurrentDeliveryGate(),
	): VibeCodexAutoCommitStatusResponse {
		return createAutoCommitStatusResponse(request ?? {
			id: 'sidebar-auto-commit-status',
			method: 'sidebar/autoCommitStatus',
			includeCommands: true,
			includeEvidence: false,
			requestedAt: Date.now(),
		}, {
			enabled: this.autoCommitEnabled(),
			workspaceTrusted: vscode.workspace.isTrusted,
			hasExecutionAuthorization: !!this.executionAuthorization,
			modePolicy: this.lastModePolicy,
			commitHandoff: gate.commitHandoff,
			finalReview: gate.finalReview,
		});
	}

	private postAutoCommitStatus(response?: VibeCodexAutoCommitStatusResponse): void {
		const status = response ?? this.currentAutoCommitStatus();
		this.postMessage({
			type: 'autoCommitStatus',
			summary: autoCommitStatusSummary(status),
			response: status,
		});
	}

	private postWorkflowStatus(response?: VibeCodexWorkflowStatusResponse): void {
		const status = response ?? this.currentWorkflowStatus();
		this.postMessage({
			type: 'workflowStatus',
			summary: workflowStatusSummary(status),
			status,
		});
	}

	private currentWorkflowStatus(request?: VibeCodexWorkflowStatusRequest, gate = this.createCurrentDeliveryGate()): VibeCodexWorkflowStatusResponse {
		return createWorkflowStatusResponse(request ?? {
			id: 'sidebar-workflow-status',
			method: 'sidebar/workflowStatus',
			includeMilestones: true,
			includeEvidence: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			prompt: this.lastPrompt,
			inlinePromptSession: this.lastInlinePromptSession,
			plan: this.activePlan,
			planRevisionHistory: this.planRevisionHistory,
			authorization: this.executionAuthorization,
			verificationPlan: this.lastVerificationPlan,
			diagnosticsSnapshot: this.lastDiagnosticsSnapshot,
			deliveryBar: gate.deliveryBar,
			smokeBenchmark: gate.smokeBenchmark,
			finalReview: gate.finalReview,
			commitHandoff: gate.commitHandoff,
			diffReview: this.activeDiffReview,
			terminalRuns: [...this.terminalRuns.values()],
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpointCount: this.patchCheckpoints.size,
			fileCheckpointPaths: [...this.patchCheckpoints.keys()],
			parallelPlan: this.lastParallelPlan,
			parallelReview: this.lastParallelReview,
			parallelMergeRequest: this.lastParallelMergeRequest,
		});
	}

	private postHappyPathStatus(response?: VibeCodexHappyPathStatusResponse): void {
		const status = response ?? this.currentHappyPathStatus();
		this.postMessage({
			type: 'happyPathStatus',
			summary: happyPathStatusSummary(status),
			status,
		});
	}

	private currentHappyPathStatus(request?: VibeCodexHappyPathStatusRequest, gate = this.createCurrentDeliveryGate()): VibeCodexHappyPathStatusResponse {
		const workflowStatus = this.currentWorkflowStatus(undefined, gate);
		const smokeBenchmarkStatus = createSmokeBenchmarkStatusResponse({
			id: 'sidebar-happy-path-smoke-status',
			method: 'sidebar/smokeBenchmarkStatus',
			includeMilestones: true,
			includeBlockers: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			smokeBenchmark: gate.smokeBenchmark,
		});
		const deliveryBarStatus = createDeliveryBarStatusResponse({
			id: 'sidebar-happy-path-delivery-status',
			method: 'sidebar/deliveryBarStatus',
			includeChecks: true,
			includeBlockers: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			deliveryBar: gate.deliveryBar,
		});
		const finalReviewStatus = this.currentFinalReviewStatus(undefined, gate);
		const parallelLaneExecutionStatus = this.currentParallelLaneExecutionStatus({
			id: 'sidebar-happy-path-parallel-lane-status',
			method: 'sidebar/parallelLaneExecutionStatus',
			...(this.lastParallelPlan?.taskId ? { taskId: this.lastParallelPlan.taskId } : {}),
			includeResult: false,
			includePromptBlock: false,
			requestedAt: Date.now(),
		});
		return createHappyPathStatusResponse(request ?? {
			id: 'sidebar-happy-path-status',
			method: 'sidebar/happyPathStatus',
			includeGates: true,
			includeEvidence: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			workflowStatus,
			smokeBenchmarkStatus,
			deliveryBarStatus,
			finalReviewStatus,
			parallelLaneExecutionStatus,
		});
	}

	private notifyFinalReview(review: VibeCodexFinalReviewState): void {
		if (!this.bridge?.connected) {
			return;
		}
		const signature = finalReviewSignature(review);
		if (this.lastSentFinalReviewSignature === signature) {
			return;
		}
		const payload = {
			source: 'externalExtension',
			taskId: this.activePlan?.taskId,
			revision: this.activePlan?.revision,
			review,
			promptBlock: finalReviewPromptBlock(review),
		};
		this.recordProtocol('out', 'agent/finalReview', { jsonrpc: '2.0', method: 'agent/finalReview', params: payload });
		void this.bridge.notify('agent/finalReview', payload).then(() => {
			this.lastSentFinalReviewSignature = signature;
		}, error => {
			this.recordProtocol('error', 'agent/finalReview', error instanceof Error ? error.message : String(error));
		});
	}

	private scheduleLongRunningTerminalNotification(run: VibeCodexCapturedTerminalRun): void {
		this.clearTerminalNotification(run.id);
		const delayMs = longRunningTerminalDelayMs(this.notificationConfig());
		if (!delayMs) {
			return;
		}
		const timer = setTimeout(() => {
			const latest = this.terminalRuns.get(run.id);
			if (!latest || latest.status !== 'running' || this.longRunningTerminalNotifications.has(run.id)) {
				return;
			}
			this.longRunningTerminalNotifications.add(run.id);
			this.postNotificationStatus();
			void vscode.window.showInformationMessage(`Vibe Codex terminal is still running: ${latest.commandLine.slice(0, 140)}`, 'Open Agent', 'Interrupt').then(action => {
				if (action === 'Open Agent') {
					void this.openAgent();
				}
				if (action === 'Interrupt') {
					void this.interruptTerminalRun(run.id);
				}
			});
		}, delayMs);
		this.terminalNotificationTimers.set(run.id, timer);
		this.postNotificationStatus();
	}

	private clearTerminalNotification(runId: string): void {
		const timer = this.terminalNotificationTimers.get(runId);
		if (timer) {
			clearTimeout(timer);
			this.terminalNotificationTimers.delete(runId);
		}
		this.longRunningTerminalNotifications.delete(runId);
		this.postNotificationStatus();
	}

	private notifyTerminalCompletion(run: VibeCodexCapturedTerminalRun): void {
		if (!shouldNotifyTerminalCompletion(this.notificationConfig())) {
			return;
		}
		const label = `Vibe Codex terminal ${run.status}: ${run.commandLine.slice(0, 140)}`;
		const notification = run.status === 'failed'
			? vscode.window.showWarningMessage(label, 'Open Agent', 'Retry')
			: vscode.window.showInformationMessage(label, 'Open Agent', 'Retry');
		void notification.then(action => {
			if (action === 'Open Agent') {
				void this.openAgent();
			}
			if (action === 'Retry') {
				void this.retryTerminalRun(run.id);
			}
		});
	}

	private resolveTerminalCwd(cwd: string | undefined): string | undefined {
		const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!cwd) {
			return root;
		}
		if (/[\u0000\r\n]/.test(cwd)) {
			throw new Error('Invalid terminal working directory.');
		}
		if (!root) {
			return path.resolve(cwd);
		}
		const rootPath = path.resolve(root);
		const candidate = path.isAbsolute(cwd) ? path.resolve(cwd) : path.resolve(rootPath, cwd);
		if (candidate === rootPath || candidate.startsWith(`${rootPath}${path.sep}`)) {
			return candidate;
		}
		throw new Error(`Blocked terminal working directory outside workspace: ${cwd}`);
	}

	private commandFromUri(uri: vscode.Uri): string | undefined {
		const path = uri.path.toLowerCase();
		if (path.includes('login') || path.includes('oauth')) {
			return nativeCommands.login;
		}
		if (path.includes('provider')) {
			return nativeCommands.configureProvider;
		}
		return nativeCommands.openAgent;
	}

	private updateStatus(text: string): void {
		this.postMessage({ type: 'status', text });
	}

	private postApprovalStatus(response?: VibeCodexApprovalStatusResponse): void {
		const status = response ?? this.currentApprovalStatus();
		this.postMessage({
			type: 'approvalStatus',
			summary: approvalStatusSummary(status),
			status,
		});
	}

	private currentApprovalStatus(request?: VibeCodexApprovalStatusRequest): VibeCodexApprovalStatusResponse {
		return createApprovalStatusResponse(request ?? {
			id: 'sidebar-approval-status',
			method: 'sidebar/approvalStatus',
			includeDetails: true,
			requestedAt: Date.now(),
		}, {
			approvals: [...this.approvalCards.values()],
			modePolicy: this.lastModePolicy,
			authorization: this.executionAuthorization,
			});
	}

	private postActionApprovalStatus(response?: VibeCodexActionApprovalStatusResponse): void {
		const status = response ?? this.currentActionApprovalStatus();
		this.postMessage({
			type: 'actionApprovalStatus',
			summary: actionApprovalStatusSummary(status),
			status,
		});
	}

	private currentActionApprovalStatus(request?: VibeCodexActionApprovalStatusRequest): VibeCodexActionApprovalStatusResponse {
		const statusRequest = request ?? {
			id: 'sidebar-action-approval-status',
			method: 'sidebar/actionApprovalStatus',
			kind: 'generic' as const,
			candidateBlocked: false,
			arguments: {},
			includeToolCall: true,
			includeTerminalValidation: true,
			includePromptBlock: true,
			requestedAt: Date.now(),
		};
		return createActionApprovalStatusResponse(statusRequest, {
			modePolicy: this.lastModePolicy,
			autoApproveConfig: this.autoApproveConfig(),
			authorization: this.executionAuthorization,
			activePlan: this.activePlan,
			toolCatalog: this.lastToolCatalog ?? this.refreshToolCatalog(),
			commandPermissionPolicy: this.lastCommandPermissionPolicy,
			workspaceTrusted: vscode.workspace.isTrusted,
			workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
			verificationCheckIds: this.lastVerificationPlan?.checks.map(check => check.id),
		});
	}

	private postUserInputStatus(response?: VibeCodexUserInputStatusResponse): void {
		const status = response ?? this.currentUserInputStatus();
		this.postMessage({
			type: 'userInputStatus',
			summary: userInputStatusSummary(status),
			status,
		});
	}

	private currentUserInputStatus(request?: VibeCodexUserInputStatusRequest): VibeCodexUserInputStatusResponse {
		return createUserInputStatusResponse(request ?? {
			id: 'sidebar-user-input-status',
			method: 'sidebar/userInputStatus',
			includeRequests: true,
			includePromptBlock: false,
			maxRequests: 8,
			requestedAt: Date.now(),
		}, [...this.userInputRequests.values()]);
	}

	private postDiffReviewStatus(response?: VibeCodexDiffReviewStatusResponse): void {
		const status = response ?? this.currentDiffReviewStatus();
		this.postMessage({
			type: 'diffReviewStatus',
			summary: diffReviewStatusSummary(status),
			status,
		});
		this.postDiffFileStatus();
		this.postDiffReapplyStatus();
	}

	private currentDiffReviewStatus(request?: VibeCodexDiffReviewStatusRequest): VibeCodexDiffReviewStatusResponse {
		return createDiffReviewStatusResponse(request ?? {
			id: 'sidebar-diff-review-status',
			method: 'sidebar/diffReviewStatus',
			includePatches: false,
			includeReviewModel: true,
			requestedAt: Date.now(),
		}, {
			review: this.activeDiffReview,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpoints: [...this.patchCheckpoints.values()].map(checkpoint => ({ path: checkpoint.path, id: checkpoint.id })),
			gitCheckpoint: this.taskGitCheckpoint,
		});
	}

	private postDiffFileStatus(response?: VibeCodexDiffFileStatusResponse): void {
		const status = response ?? this.currentDiffFileStatus();
		this.postMessage({
			type: 'diffFileStatus',
			summary: diffFileStatusSummary(status),
			status,
		});
	}

	private currentDiffFileStatus(request?: VibeCodexDiffFileStatusRequest): VibeCodexDiffFileStatusResponse {
		const focusedPath = this.activeDiffReview?.files.find(file => file.status === 'pending')?.path ?? this.activeDiffReview?.files[0]?.path;
		return createDiffFileStatusResponse(request ?? {
			id: 'sidebar-diff-file-status',
			method: 'sidebar/diffFileStatus',
			...(focusedPath ? { path: focusedPath } : {}),
			includePatchPreview: false,
			includeSiblings: true,
			requestedAt: Date.now(),
		}, {
			review: this.activeDiffReview,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpoints: [...this.patchCheckpoints.values()].map(checkpoint => ({ path: checkpoint.path, id: checkpoint.id })),
		});
	}

	private postDiffReapplyStatus(response?: VibeCodexDiffReapplyStatusResponse): void {
		const status = response ?? this.currentDiffReapplyStatus();
		this.postMessage({
			type: 'diffReapplyStatus',
			summary: diffReapplyStatusSummary(status),
			status,
		});
	}

	private currentDiffReapplyStatus(request?: VibeCodexDiffReapplyStatusRequest): VibeCodexDiffReapplyStatusResponse {
		const focusedPath = this.activeDiffReview?.files.find(file => file.status === 'pending')?.path ?? this.activeDiffReview?.files[0]?.path;
		return createDiffReapplyStatusResponse(request ?? {
			id: 'sidebar-diff-reapply-status',
			method: 'sidebar/diffReapplyStatus',
			...(focusedPath ? { path: focusedPath } : {}),
			candidate: undefined,
			candidatePresent: false,
			includeCandidate: false,
			includePatchPreviews: false,
			includeRepairHints: true,
			includeActiveFile: true,
			requestedAt: Date.now(),
		}, {
			review: this.activeDiffReview,
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpoints: [...this.patchCheckpoints.values()].map(checkpoint => ({ path: checkpoint.path, id: checkpoint.id })),
		});
	}

	private activePlanForRenderedAction(action: string, renderedAction: VibeCodexRenderedPlanActionPayload): VibeCodexPlan | undefined {
		if (!this.activePlan) {
			this.updateStatus(`No active visual plan is available to ${action}.`);
			return undefined;
		}
		const expected = renderedPlanIdentity(this.activePlan);
		const received = normalizeRenderedPlanIdentity(renderedAction);
		if (!received || received.taskId !== expected.taskId || received.revision !== expected.revision || received.planHash !== expected.planHash) {
			this.recordProtocol('error', `Ignored stale plan ${action} action`, { expected, received: received ?? null });
			this.postMessage({ type: 'planActionRejected', action, reason: 'stale_rendered_plan', expected, received });
			this.updateStatus(`Ignored stale plan ${action} action; review the current plan ${expected.taskId} r${expected.revision} before continuing.`);
			return undefined;
		}
		return this.activePlan;
	}

	private setActivePlan(plan: VibeCodexPlan, status: string, event: VibeCodexPlanRevisionEvent = 'updated'): void {
		if (!authorizationMatchesPlan(this.executionAuthorization, plan)) {
			this.clearExecutionAuthorization();
		}
		this.activePlan = plan;
		const flow = parseMermaidFlowchart(plan.flowchart, plan.steps);
		this.updateLastValidPlanCanvasGraph(plan, flow);
		this.postMessage({ type: 'plan', plan, planIdentity: renderedPlanIdentity(plan), flow });
		this.postPlanStatus();
		this.postPlanCanvasStatus();
		this.postModeStatus();
		this.postPlanFocusStatus();
		this.postDeliveryBar();
		this.postExecutionGateStatus();
		this.postInlinePromptStatus();
		this.recordPlanRevision(plan, event, status);
		if (event === 'submitted' || event === 'updated' || event === 'restored') {
			this.notifyApprovalNeeded(`Vibe Codex plan r${plan.revision} is ready`, plan.summary);
		}
		this.transcriptEvents = appendTranscriptEvent(this.transcriptEvents, {
			kind: 'plan',
			title: `Plan ${plan.taskId} r${plan.revision}`,
			detail: `${plan.summary}\n\n${status}`,
			status: 'pending',
		});
		this.postTranscript();
		void this.patchActiveSession({ plan, transcript: this.transcriptEvents });
		void this.refreshVerificationPlan(plan.acceptanceCriteria);
		this.updateStatus(status);
	}

	private recordPlanRevision(plan: VibeCodexPlan, event: VibeCodexPlanRevisionEvent, note?: string): void {
		this.planRevisionHistory = appendPlanRevision(this.planRevisionHistory, plan, event, note);
		this.postPlanRevisionHistory();
		this.postPlanStatus();
		this.postPlanCanvasStatus();
		void this.patchActiveSession({ planRevisionHistory: this.planRevisionHistory });
	}

	private postPlanRevisionHistory(): void {
		this.postMessage({
			type: 'planRevisionHistory',
			summary: planRevisionHistorySummary(this.planRevisionHistory),
			history: this.planRevisionHistory,
		});
	}

	private postPlanStatus(response?: VibeCodexPlanStatusResponse): void {
		const status = response ?? this.currentPlanStatus();
		this.postMessage({
			type: 'planStatus',
			summary: planStatusSummary(status),
			status,
		});
	}

	private postPlanCanvasStatus(response?: VibeCodexPlanCanvasStatusResponse): void {
		const status = response ?? this.currentPlanCanvasStatus();
		this.postMessage({
			type: 'planCanvasStatus',
			summary: planCanvasStatusSummary(status),
			status,
		});
	}

	private postPlanEditStatus(response: VibeCodexPlanEditStatusResponse): void {
		this.postMessage({
			type: 'planEditStatus',
			summary: planEditStatusSummary(response),
			status: response,
		});
	}

	private currentPlanStatus(request?: VibeCodexPlanStatusRequest): VibeCodexPlanStatusResponse {
		return createPlanStatusResponse(request ?? {
			id: 'sidebar-plan-status',
			method: 'sidebar/planStatus',
			includeHistory: true,
			includeRenderModel: true,
			requestedAt: Date.now(),
		}, {
			plan: this.activePlan,
			authorization: this.executionAuthorization,
			history: this.planRevisionHistory,
		});
	}

	private currentPlanCanvasStatus(request?: VibeCodexPlanCanvasStatusRequest): VibeCodexPlanCanvasStatusResponse {
		return createPlanCanvasStatusResponse(request ?? {
			id: 'sidebar-plan-canvas-status',
			method: 'sidebar/planCanvasStatus',
			includeFeatures: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			plan: this.activePlan,
			authorization: this.executionAuthorization,
			lastValidGraph: this.lastValidPlanCanvasGraph,
		});
	}

	private updateLastValidPlanCanvasGraph(plan: VibeCodexPlan, flow: ReturnType<typeof parseMermaidFlowchart>): void {
		if (!flow?.valid || !Array.isArray(flow.nodes) || flow.nodes.length === 0) {
			return;
		}
		const identity = renderedPlanIdentity(plan);
		this.lastValidPlanCanvasGraph = {
			taskId: identity.taskId,
			revision: identity.revision,
			planHash: identity.planHash,
			nodes: flow.nodes.length,
			edges: flow.edges.length,
			updatedAt: Date.now(),
		};
	}

	private postPlanFocusStatus(response?: VibeCodexPlanFocusStatusResponse): void {
		const status = response ?? this.currentPlanFocusStatus();
		this.postMessage({
			type: 'planFocusStatus',
			summary: planFocusStatusSummary(status),
			status,
		});
	}

	private currentPlanFocusStatus(request?: VibeCodexPlanFocusStatusRequest): VibeCodexPlanFocusStatusResponse {
		return createPlanFocusStatusResponse(request ?? {
			id: 'sidebar-plan-focus-status',
			method: 'sidebar/planFocusStatus',
			includeBindings: true,
			includeGraph: true,
			includeFiles: true,
			includeRepairHints: true,
			requestedAt: Date.now(),
		}, {
			plan: this.activePlan,
		});
	}

	private restorePlanRevision(snapshotId: string): void {
		const snapshot = this.planRevisionHistory.find(item => item.id === snapshotId);
		if (!snapshot) {
			this.updateStatus(`Plan revision snapshot ${snapshotId} was not found.`);
			return;
		}
		this.clearExecutionAuthorization();
		this.setActivePlan(snapshot.plan, `Restored plan ${snapshot.taskId} r${snapshot.revision} from revision history.`, 'restored');
		this.recordTranscript('plan', `Restored plan ${snapshot.taskId} r${snapshot.revision}`, snapshot.note, 'pending');
	}

	private postContext(context: VibeCodexContextPack): void {
		this.postMessage({
			type: 'contextPack',
			summary: summarizeContextPack(context),
			context: {
				workspaceRoots: context.workspaceRoots,
				promptMentions: context.promptMentions,
				activeEditor: context.activeEditor,
				files: context.files.map(file => ({ path: file.path, kind: file.kind, languageId: file.languageId })),
				searchHits: context.searchHits,
				symbolIndex: context.symbolIndex,
				diagnostics: context.diagnostics,
				ignorePolicy: context.ignorePolicy,
				terminal: context.terminal,
				git: context.git,
			},
		});
		this.postContextStatus();
		this.postContextIndexStatus();
		this.postSymbolIndexStatus();
	}

	private postContextStatus(response?: VibeCodexContextStatusResponse): void {
		const status = response ?? this.currentContextStatus();
		this.postMessage({
			type: 'contextStatus',
			summary: contextStatusSummary(status),
			status,
		});
	}

	private currentContextStatus(request?: VibeCodexContextStatusRequest): VibeCodexContextStatusResponse {
		return createContextStatusResponse(request ?? {
			id: 'sidebar-context-status',
			method: 'sidebar/contextStatus',
			includeMentions: true,
			includeFiles: true,
			includeSearchHits: true,
			includeSymbols: true,
			includeDiagnostics: true,
			includeGit: true,
			requestedAt: Date.now(),
		}, this.lastContext);
	}

	private recordWorkspaceReadEvidence(event: VibeCodexWorkspaceReadEvidenceEvent): void {
		this.workspaceReadEvidence = [...this.workspaceReadEvidence, event].slice(-80);
		this.postWorkspaceReadStatus();
	}

	private postWorkspaceReadStatus(response?: VibeCodexWorkspaceReadStatusResponse): void {
		const status = response ?? this.currentWorkspaceReadStatus();
		this.postMessage({
			type: 'workspaceReadStatus',
			summary: workspaceReadStatusSummary(status),
			status,
		});
	}

	private currentWorkspaceReadStatus(request?: VibeCodexWorkspaceReadStatusRequest): VibeCodexWorkspaceReadStatusResponse {
		return createWorkspaceReadStatusResponse(request ?? {
			id: 'sidebar-workspace-read-status',
			method: 'sidebar/workspaceReadStatus',
			includeEvents: true,
			includeSamples: true,
			includePromptBlock: false,
			maxEvents: 8,
			maxSamples: 5,
			requestedAt: Date.now(),
		}, this.workspaceReadEvidence);
	}

	private postContextIndexStatus(response?: VibeCodexContextIndexStatusResponse): void {
		const status = response ?? this.currentContextIndexStatus();
		this.postMessage({
			type: 'contextIndexStatus',
			summary: contextIndexStatusSummary(status),
			status,
		});
	}

	private currentContextIndexStatus(request?: VibeCodexContextIndexStatusRequest): VibeCodexContextIndexStatusResponse {
		return createContextIndexStatusResponse(request ?? {
			id: 'sidebar-context-index-status',
			method: 'sidebar/contextIndexStatus',
			includeSources: true,
			includeSamples: false,
			maxItems: 8,
			requestedAt: Date.now(),
		}, {
			context: this.lastContext,
			workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
			workspaceTrusted: vscode.workspace.isTrusted,
		});
	}

	private postSymbolIndexStatus(response?: VibeCodexSymbolIndexStatusResponse): void {
		const status = response ?? this.currentSymbolIndexStatus();
		this.postMessage({
			type: 'symbolIndexStatus',
			summary: symbolIndexStatusSummary(status),
			status,
		});
	}

	private currentSymbolIndexStatus(request?: VibeCodexSymbolIndexStatusRequest): VibeCodexSymbolIndexStatusResponse {
		return createSymbolIndexStatusResponse(request ?? {
			id: 'sidebar-symbol-index-status',
			method: 'sidebar/symbolIndexStatus',
			includeEntries: true,
			includePromptBlock: false,
			maxItems: 12,
			requestedAt: Date.now(),
		}, this.lastContext);
	}

	private postInlinePromptSession(session: VibeCodexInlinePromptSession | undefined): void {
		this.postMessage({ type: 'inlinePromptSession', session });
		this.postInlinePromptStatus();
	}

	private postInlinePromptStatus(response?: VibeCodexInlinePromptStatusResponse): void {
		const status = response ?? this.currentInlinePromptStatus();
		this.postMessage({
			type: 'inlinePromptStatus',
			summary: inlinePromptStatusSummary(status),
			status,
		});
	}

	private currentInlinePromptStatus(request?: VibeCodexInlinePromptStatusRequest): VibeCodexInlinePromptStatusResponse {
		return createInlinePromptStatusResponse(request ?? {
			id: 'sidebar-inline-prompt-status',
			method: 'sidebar/inlinePromptStatus',
			includePrompt: false,
			includeContext: false,
			requestedAt: Date.now(),
		}, {
			session: this.lastInlinePromptSession,
			activePlan: this.activePlan,
			authorization: this.executionAuthorization,
		});
	}

	private async postMentionSuggestions(): Promise<void> {
		this.postMessage({
			type: 'mentionSuggestions',
			suggestions: await collectMentionSuggestions(),
		});
	}

	private async postSlashCommandSuggestions(): Promise<void> {
		this.postMessage({
			type: 'slashCommandSuggestions',
			suggestions: await collectSlashCommandSuggestions(),
		});
	}

	private autoApproveConfig(): VibeCodexAutoApproveConfig {
		const config = vscode.workspace.getConfiguration('vibeCodex.extension.autoApprove');
		const maxRisk = config.get<string>('maxRisk', defaultAutoApproveConfig.maxRisk);
		return {
			enabled: config.get<boolean>('enabled', defaultAutoApproveConfig.enabled),
			terminal: config.get<boolean>('terminal', defaultAutoApproveConfig.terminal),
			file: config.get<boolean>('file', defaultAutoApproveConfig.file),
			tool: config.get<boolean>('tool', defaultAutoApproveConfig.tool),
			generic: config.get<boolean>('generic', defaultAutoApproveConfig.generic),
			mcp: config.get<boolean>('mcp', defaultAutoApproveConfig.mcp),
			browser: config.get<boolean>('browser', defaultAutoApproveConfig.browser),
			maxRisk: maxRisk === 'low' || maxRisk === 'high' ? maxRisk : 'medium',
		};
	}

	private postAutoApproveState(): void {
		const config = this.autoApproveConfig();
		this.postMessage({
			type: 'autoApproveState',
			config,
			summary: autoApproveSummary(config),
			authorization: executionAuthorizationSummary(this.executionAuthorization),
		});
		this.postSafetyStatus();
		this.postActionApprovalStatus();
	}

	private notificationConfig(): VibeCodexNotificationConfig {
		const config = vscode.workspace.getConfiguration('vibeCodex.extension.notifications');
		return normalizeNotificationConfig({
			approvals: config.get<boolean>('approvals', defaultNotificationConfig.approvals),
			terminalCompletion: config.get<boolean>('terminalCompletion', defaultNotificationConfig.terminalCompletion),
			longRunningTerminalSeconds: config.get<number>('longRunningTerminalSeconds', defaultNotificationConfig.longRunningTerminalSeconds),
		});
	}

	private notifyApprovalNeeded(title: string, detail?: string, blocked = false): void {
		if (!shouldNotifyApproval(this.notificationConfig())) {
			return;
		}
		const message = `${title}${detail ? `: ${detail.slice(0, 220)}` : ''}`;
		const notification = blocked ? vscode.window.showWarningMessage(message, 'Open Agent') : vscode.window.showInformationMessage(message, 'Open Agent');
		void notification.then(action => {
			if (action === 'Open Agent') {
				void this.openAgent();
			}
		});
	}

	private async toggleAutoApproveSetting(key: string, value: boolean): Promise<void> {
		if (!['enabled', 'terminal', 'file', 'tool', 'generic', 'mcp', 'browser'].includes(key)) {
			this.updateStatus(`Unsupported auto-approve setting: ${key}`);
			return;
		}
		await vscode.workspace.getConfiguration('vibeCodex.extension.autoApprove').update(key, value, vscode.ConfigurationTarget.Global);
		this.postAutoApproveState();
		this.recordTranscript('system', `Auto-approve ${key} ${value ? 'enabled' : 'disabled'}`, autoApproveSummary(this.autoApproveConfig()));
	}

	private async setAutoApproveRisk(value: string): Promise<void> {
		if (value !== 'low' && value !== 'medium' && value !== 'high') {
			this.updateStatus(`Unsupported auto-approve risk: ${value}`);
			return;
		}
		await vscode.workspace.getConfiguration('vibeCodex.extension.autoApprove').update('maxRisk', value, vscode.ConfigurationTarget.Global);
		this.postAutoApproveState();
		this.recordTranscript('system', `Auto-approve max risk set to ${value}`, autoApproveSummary(this.autoApproveConfig()));
	}

	private async postProviderState(): Promise<void> {
		this.postProvider(await providerDisplayConfig(this.extensionContext.secrets, this.lastMode));
	}

	private postProvider(config: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>): void {
		const { apiKey, ...display } = config as VibeCodexProviderRuntimeConfig;
		this.postMessage({ type: 'providerConfig', provider: display });
		this.postProviderStatus(this.currentProviderStatus(undefined, display));
		this.postProviderCatalog(this.currentProviderCatalog(undefined, display));
		void this.postProviderModeRouteStatus(display);
		this.refreshRuntimeReadinessStatus();
	}

	private postProviderStatus(response?: VibeCodexProviderStatusResponse): void {
		const status = response ?? this.currentProviderStatus();
		this.postMessage({
			type: 'providerStatus',
			summary: providerStatusSummary(status),
			status,
		});
	}

	private currentProviderStatus(
		request?: VibeCodexProviderStatusRequest,
		provider?: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>,
		modeRoutes: readonly (VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>)[] = [],
	): VibeCodexProviderStatusResponse {
		return createProviderStatusResponse(request ?? {
			id: 'sidebar-provider-status',
			method: 'sidebar/providerStatus',
			mode: this.lastMode,
			includeCodexConfig: true,
			includeModeRoutes: false,
			requestedAt: Date.now(),
		}, provider ?? this.lastProvider, modeRoutes);
	}

	private async postProviderModeRouteStatus(provider?: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>): Promise<void> {
		const modeRoutes = await providerModeRouteConfigs(this.extensionContext.secrets);
		this.postProviderStatus(this.currentProviderStatus({
			id: 'sidebar-provider-mode-routing-status',
			method: 'sidebar/providerStatus',
			mode: this.lastMode,
			includeCodexConfig: true,
			includeModeRoutes: true,
			requestedAt: Date.now(),
		}, provider ?? this.lastProvider, modeRoutes));
	}

	private postProviderCatalog(response?: VibeCodexProviderCatalogResponse): void {
		const catalog = response ?? this.currentProviderCatalog();
		this.postMessage({
			type: 'providerCatalog',
			summary: providerCatalogSummary(catalog),
			catalog,
		});
	}

	private currentProviderCatalog(request?: VibeCodexProviderCatalogRequest, provider?: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>): VibeCodexProviderCatalogResponse {
		return createProviderCatalogResponse(request ?? {
			id: 'sidebar-provider-catalog',
			method: 'sidebar/providerCatalog',
			includeDefaults: true,
			includeCodexConfig: true,
			requestedAt: Date.now(),
		}, {
			providers: providerCatalogEntries(),
			selected: provider ?? this.lastProvider,
		});
	}

	private postModePolicy(policy: VibeCodexModePolicy): void {
		this.postMessage({
			type: 'modePolicy',
			summary: modePolicySummary(policy),
			policy,
		});
		this.postModeStatus();
		this.postSafetyStatus();
		this.postTerminalCommandValidationStatus();
	}

	private postModeStatus(response?: VibeCodexModeStatusResponse): void {
		const status = response ?? this.currentModeStatus();
		this.postMessage({
			type: 'modeStatus',
			summary: modeStatusSummary(status),
			status,
		});
	}

	private currentModeStatus(request?: VibeCodexModeStatusRequest): VibeCodexModeStatusResponse {
		return createModeStatusResponse(request ?? {
			id: 'sidebar-mode-status',
			method: 'sidebar/modeStatus',
			includeModes: true,
			includeInstructions: false,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			modePolicy: this.lastModePolicy,
			authorization: this.executionAuthorization,
			activePlan: this.activePlan,
		});
	}

	private postCommandPermissionPolicy(policy: VibeCodexCommandPermissionPolicy): void {
		this.postMessage({
			type: 'commandPermissionPolicy',
			summary: commandPermissionSummary(policy),
			policy,
		});
		this.postSafetyStatus();
		this.postTerminalCommandValidationStatus();
	}

	private postTerminalCommandValidationStatus(response?: VibeCodexTerminalCommandValidationResponse): void {
		const status = response ?? (this.lastTerminalCommandValidationRequest ? this.currentTerminalCommandValidationStatus(this.lastTerminalCommandValidationRequest) : this.lastTerminalCommandValidationResponse);
		if (!status) {
			return;
		}
		this.lastTerminalCommandValidationResponse = status;
		this.postMessage({
			type: 'terminalCommandValidationStatus',
			summary: terminalCommandValidationSummary(status),
			status,
		});
	}

	private currentTerminalCommandValidationStatus(request: VibeCodexTerminalCommandValidationRequest): VibeCodexTerminalCommandValidationResponse {
		return createTerminalCommandValidationResponse(request, {
			modePolicy: this.lastModePolicy,
			commandPermissionPolicy: this.lastCommandPermissionPolicy,
			hasExecutionAuthorization: !!this.executionAuthorization,
			workspaceTrusted: vscode.workspace.isTrusted,
			workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
			verificationCheckIds: this.lastVerificationPlan?.checks.map(check => check.id),
		});
	}

	private createParallelPlan(prompt: string, mode: string): VibeCodexParallelPlan {
		return createParallelAgentPlan(prompt, mode, this.workspaceRootPath(), this.parallelThreads());
	}

	private postParallelPlan(plan: VibeCodexParallelPlan): void {
		this.postMessage({
			type: 'parallelPlan',
			summary: parallelPlanSummary(plan),
			plan,
		});
		this.postParallelStatus();
		this.postParallelWorktreeStatus();
		this.postParallelLaneExecutionStatus();
		this.postParallelDispatchPlan();
		this.postParallelReviewStatus();
		this.postDeliveryBar();
		this.postWorkspaceSandboxStatus();
	}

	private postParallelStatus(response?: VibeCodexParallelStatusResponse): void {
		const status = response ?? this.currentParallelStatus();
		this.postMessage({
			type: 'parallelStatus',
			summary: parallelStatusSummary(status),
			status,
		});
	}

	private currentParallelStatus(request?: VibeCodexParallelStatusRequest): VibeCodexParallelStatusResponse {
		return createParallelStatusResponse(request ?? {
			id: 'sidebar-parallel-status',
			method: 'sidebar/parallelStatus',
			...(this.lastParallelPlan?.taskId ? { taskId: this.lastParallelPlan.taskId } : {}),
			includeResults: false,
			requestedAt: Date.now(),
		}, {
			plan: this.lastParallelPlan,
			results: this.parallelResults,
			review: this.lastParallelReview,
		});
	}

	private postParallelWorktreeStatus(response?: VibeCodexParallelWorktreeStatusResponse): void {
		const status = response ?? this.currentParallelWorktreeStatus();
		this.postMessage({
			type: 'parallelWorktreeStatus',
			summary: parallelWorktreeStatusSummary(status),
			status,
		});
	}

	private currentParallelWorktreeStatus(request?: VibeCodexParallelWorktreeStatusRequest): VibeCodexParallelWorktreeStatusResponse {
		return createParallelWorktreeStatusResponse(request ?? {
			id: 'sidebar-parallel-worktree-status',
			method: 'sidebar/parallelWorktreeStatus',
			...(this.lastParallelPlan?.taskId ? { taskId: this.lastParallelPlan.taskId } : {}),
			includeThreads: true,
			requestedAt: Date.now(),
		}, {
			plan: this.lastParallelPlan,
			workspaceTrusted: vscode.workspace.isTrusted,
			hasExecutionAuthorization: !!this.executionAuthorization,
			modePolicy: this.lastModePolicy,
		});
	}

	private postParallelLaneExecutionStatus(response?: VibeCodexParallelLaneExecutionStatusResponse): void {
		const status = response ?? this.currentParallelLaneExecutionStatus();
		this.postMessage({
			type: 'parallelLaneExecutionStatus',
			summary: parallelLaneExecutionStatusSummary(status),
			status,
		});
		this.postHappyPathStatus();
	}

	private postParallelDispatchPlan(response?: VibeCodexParallelDispatchPlanResponse): void {
		const status = response ?? this.currentParallelDispatchPlan();
		this.postMessage({
			type: 'parallelDispatchPlan',
			summary: parallelDispatchPlanSummary(status),
			status,
		});
	}

	private currentParallelDispatchPlan(request?: VibeCodexParallelDispatchPlanRequest): VibeCodexParallelDispatchPlanResponse {
		return createParallelDispatchPlanResponse(request ?? {
			id: 'sidebar-parallel-dispatch-plan',
			method: 'sidebar/parallelDispatchPlan',
			...(this.lastParallelPlan?.taskId ? { taskId: this.lastParallelPlan.taskId } : {}),
			includeLanes: true,
			includePromptBlock: false,
			maxLanes: 8,
			requestedAt: Date.now(),
		}, {
			plan: this.lastParallelPlan,
			results: this.parallelResults,
			review: this.lastParallelReview,
			activePlan: this.activePlan,
			authorization: this.executionAuthorization,
			workspaceTrusted: vscode.workspace.isTrusted,
			modePolicy: this.lastModePolicy,
		});
	}

	private async handleParallelLaneDispatchRequest(request: VibeCodexParallelLaneDispatchRequest): Promise<void> {
		const backendAddressed = !isSidebarRequestMethod(request.method);
		const dispatchStatus = this.currentParallelDispatchPlan({
			id: request.id,
			method: request.method,
			taskId: request.taskId,
			includeLanes: true,
			includePromptBlock: false,
			maxLanes: 8,
			requestedAt: request.requestedAt,
		});
		const lane = dispatchStatus.lanes?.find(candidate => candidate.id === request.threadId);
		const plan = this.lastParallelPlan;
		const thread = plan?.threads.find(candidate => candidate.id === request.threadId);
		const terminalBlock = this.modeBlockReason('terminal');
		const blockers = [
			!dispatchStatus.ready ? dispatchStatus.message : undefined,
			!lane ? `Parallel lane ${request.threadId} is not in the dispatch queue.` : undefined,
			lane && !lane.dispatchable ? `Parallel lane ${request.threadId} is not dispatchable: ${lane.blockers.join('; ') || 'unknown blocker'}.` : undefined,
			!plan ? 'No active parallel plan is available.' : undefined,
			!thread ? `Parallel lane ${request.threadId} is not in the active parallel plan.` : undefined,
			thread && thread.status !== 'materialized' ? `Parallel lane ${request.threadId} is ${thread.status}; prepare worktrees before dispatch.` : undefined,
			request.worktreePath && thread?.worktreePath && request.worktreePath !== thread.worktreePath ? `Requested worktree ${request.worktreePath} does not match active lane worktree ${thread.worktreePath}.` : undefined,
			request.branchName && thread?.branchName && request.branchName !== thread.branchName ? `Requested branch ${request.branchName} does not match active lane branch ${thread.branchName}.` : undefined,
			terminalBlock,
		].filter((value): value is string => !!value);
		if (blockers.length || !plan || !thread) {
			const message = blockers[0] ?? 'Parallel lane dispatch is not ready.';
			this.recordProtocol('out', 'parallel lane dispatch request blocked', { id: request.id, error: message, status: dispatchStatus, requestedThreadId: request.threadId });
			if (backendAddressed) {
				await this.bridge?.respondError(request.id, -32014, message, {
					method: request.method,
					taskId: request.taskId,
					threadId: request.threadId,
					blockers,
					status: dispatchStatus,
				});
			}
			this.postParallelDispatchPlan(dispatchStatus);
			this.postParallelLaneExecutionStatus();
			this.recordTranscript('approval', `Blocked parallel lane dispatch: ${request.threadId}`, blockers.join('\n'), 'blocked');
			this.updateStatus(message);
			return;
		}
		const commandLine = this.createParallelLaneDispatchCommand(request, thread);
		const commandDecision = evaluateCommandPermission(commandLine, this.lastCommandPermissionPolicy);
		const approval = createParallelLaneDispatchApprovalCard(request, plan, thread, commandLine, commandDecision);
		this.approvalCards.set(String(approval.id), approval);
		const autoDecision = shouldAutoApproveApproval(approval, this.autoApproveConfig(), !!this.executionAuthorization);
		if (autoDecision.approve) {
			this.recordProtocol('out', 'auto-approved parallel lane dispatch request', { id: approval.id, method: approval.method, threadId: approval.parallelDispatchThreadId, reason: autoDecision.reason });
			this.recordTranscript('approval', `Auto-approved parallel lane dispatch: ${approval.parallelDispatchThreadId}`, autoDecision.reason, 'completed');
			await this.decideApproval(String(approval.id), 'accept');
			return;
		}
		this.postExecutionGateStatus();
		this.postMessage({ type: 'approval', card: approval });
		this.postApprovalStatus();
		this.postParallelDispatchPlan(dispatchStatus);
		this.postParallelLaneExecutionStatus();
		this.recordTranscript('approval', `${approval.title} waiting for approval`, approval.detail || approval.description, approval.blocked ? 'blocked' : 'pending');
		this.notifyApprovalNeeded(`${approval.title} waiting for approval`, approval.detail || approval.description, approval.blocked);
		this.updateStatus(`${approval.title} waiting for approval.`);
	}

	private createParallelLaneDispatchCommand(request: VibeCodexParallelLaneDispatchRequest, thread: VibeCodexParallelThread): string {
		const parallelPlan = this.lastParallelPlan;
		if (!parallelPlan) {
			throw new Error('No active parallel plan is available for lane dispatch.');
		}
		const prompt = createParallelLaneTerminalPrompt({
			activePlan: this.activePlan,
			parallelPlan,
			thread,
			promptFocus: request.promptFocus ?? thread.promptFocus,
			verificationPlan: this.lastVerificationPlan,
		});
		return [this.codexCommand(), ...this.codexArgs(), prompt].map(shellQuote).join(' ');
	}

	private currentParallelLaneExecutionStatus(request?: VibeCodexParallelLaneExecutionStatusRequest): VibeCodexParallelLaneExecutionStatusResponse {
		return createParallelLaneExecutionStatusResponse(request ?? {
			id: 'sidebar-parallel-lane-execution-status',
			method: 'sidebar/parallelLaneExecutionStatus',
			...(this.lastParallelPlan?.taskId ? { taskId: this.lastParallelPlan.taskId } : {}),
			includeResult: false,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			plan: this.lastParallelPlan,
			results: this.parallelResults,
			review: this.lastParallelReview,
			activePlan: this.activePlan,
			authorization: this.executionAuthorization,
			workspaceTrusted: vscode.workspace.isTrusted,
			modePolicy: this.lastModePolicy,
		});
	}

	private postParallelReviewStatus(response?: VibeCodexParallelReviewStatusResponse): void {
		const status = response ?? this.currentParallelReviewStatus();
		this.postMessage({
			type: 'parallelReviewStatus',
			summary: parallelReviewStatusSummary(status),
			status,
		});
	}

	private currentParallelReviewStatus(request?: VibeCodexParallelReviewStatusRequest): VibeCodexParallelReviewStatusResponse {
		return createParallelReviewStatusResponse(request ?? {
			id: 'sidebar-parallel-review-status',
			method: 'sidebar/parallelReviewStatus',
			...(this.lastParallelPlan?.taskId ? { taskId: this.lastParallelPlan.taskId } : {}),
			includeResults: false,
			includeRanking: true,
			requestedAt: Date.now(),
		}, {
			plan: this.lastParallelPlan,
			results: this.parallelResults,
			review: this.lastParallelReview,
		});
	}

	private async recordParallelResult(result: VibeCodexParallelResult): Promise<void> {
		this.parallelResults = upsertParallelResult(this.parallelResults, result);
		const review = createParallelReview(this.lastParallelPlan, this.parallelResults);
		if (!review) {
			return;
		}
		this.lastParallelReview = review;
		if (this.lastParallelMergeRequest && (this.lastParallelMergeRequest.taskId !== review.taskId || !createParallelMergeRequest(review, this.lastParallelMergeRequest.threadId).mergeReady)) {
			this.lastParallelMergeRequest = undefined;
		}
		this.postParallelReview(review);
		this.postParallelStatus();
		this.postParallelLaneExecutionStatus();
		this.postParallelDispatchPlan();
		this.postParallelReviewStatus();
		this.postParallelMergeStatus();
		const summary = parallelReviewSummary(review);
		await this.patchActiveSession({
			evidence: this.activeEvidence(summary),
		});
		const transcriptStatus = result.status === 'running' ? 'running' : result.status === 'failed' || result.status === 'blocked' ? 'failed' : 'completed';
		this.recordTranscript('tool', `Parallel result: ${result.threadId}`, `${result.summary}\n\n${summary}`, transcriptStatus);
		this.updateStatus(summary);
	}

	private postParallelReview(review: VibeCodexParallelReview): void {
		this.postMessage({
			type: 'parallelReview',
			summary: parallelReviewSummary(review),
			review,
		});
		this.postCheckpointStatus();
		this.postDeliveryBar();
	}

	private postParallelMergeStatus(response?: VibeCodexParallelMergeStatusResponse): void {
		const status = response ?? this.currentParallelMergeStatus();
		this.postMessage({
			type: 'parallelMergeStatus',
			summary: parallelMergeStatusSummary(status),
			status,
		});
		this.postParallelWorktreeStatus();
		this.postParallelLaneExecutionStatus();
		this.postParallelDispatchPlan();
	}

	private currentParallelMergeStatus(request?: VibeCodexParallelMergeStatusRequest): VibeCodexParallelMergeStatusResponse {
		return createParallelMergeStatusResponse(request ?? {
			id: 'ui',
			method: 'parallel/mergeStatus',
			includeReview: true,
			requestedAt: Date.now(),
		}, {
			plan: this.lastParallelPlan,
			review: this.lastParallelReview,
			mergeRequest: this.lastParallelMergeRequest,
			diffReview: this.activeDiffReview,
			hasExecutionAuthorization: !!this.executionAuthorization,
		});
	}

	async requestParallelMerge(threadId: string): Promise<void> {
		if (!this.lastParallelReview) {
			this.updateStatus('No parallel review is available.');
			this.postParallelMergeStatus();
			return;
		}
		if (!this.executionAuthorization) {
			this.recordTranscript('tool', 'Blocked parallel merge-back request before plan execution authorization', threadId, 'blocked');
			this.updateStatus('Plan approval is required before requesting parallel merge-back.');
			this.postParallelMergeStatus();
			return;
		}
		const request = createParallelMergeRequest(this.lastParallelReview, threadId);
		if (!request.mergeReady) {
			this.recordTranscript('tool', `Blocked parallel merge-back for ${threadId}`, parallelReviewSummary(this.lastParallelReview), 'blocked');
			this.updateStatus(`Parallel result ${threadId} is not merge-ready; review blockers before merge-back.`);
			this.postParallelMergeStatus();
			return;
		}
		this.lastParallelMergeRequest = request;
		this.lastParallelMergeDiffReviewId = undefined;
		const payload = attachExecutionAuthorization(request, this.executionAuthorization, true);
		this.recordProtocol('out', 'agent/parallelMergeRequest', { jsonrpc: '2.0', method: 'agent/parallelMergeRequest', params: payload });
		await this.bridge?.notify('agent/parallelMergeRequest', payload);
		this.postParallelMergeStatus();
		await this.patchActiveSession({
			evidence: this.activeEvidence(`Requested parallel merge-back for ${threadId}.`),
		});
		this.recordTranscript('tool', `Requested parallel merge-back for ${threadId}`, 'Waiting for backend diff review before any merge is applied.');
		this.updateStatus(`Requested parallel merge-back for ${threadId}; waiting for diff review.`);
	}

	private async refreshVerificationPlan(acceptanceCriteria: readonly string[]): Promise<void> {
		const criteriaKey = verificationCriteriaKey(acceptanceCriteria);
		if (this.lastVerificationPlan && this.lastVerificationCriteriaKey === criteriaKey) {
			this.postVerificationPlan(this.lastVerificationPlan);
			return;
		}
		this.lastVerificationPlan = await collectVerificationPlan(acceptanceCriteria);
		this.lastVerificationCriteriaKey = criteriaKey;
		this.postVerificationPlan(this.lastVerificationPlan);
		await this.patchActiveSession({ verificationPlan: this.lastVerificationPlan });
	}

	private postVerificationPlan(plan: VibeCodexVerificationPlan): void {
		this.postMessage({
			type: 'verificationPlan',
			summary: verificationPlanSummary(plan),
			plan,
		});
		this.postAcceptanceCriteriaStatus();
		this.postDeliveryBar();
	}

	private postAcceptanceCriteriaStatus(response?: VibeCodexAcceptanceCriteriaStatusResponse): void {
		const status = response ?? this.currentAcceptanceCriteriaStatus();
		this.postMessage({
			type: 'acceptanceCriteriaStatus',
			summary: acceptanceCriteriaStatusSummary(status),
			status,
		});
	}

	private currentAcceptanceCriteriaStatus(request?: VibeCodexAcceptanceCriteriaStatusRequest): VibeCodexAcceptanceCriteriaStatusResponse {
		return createAcceptanceCriteriaStatusResponse(request ?? {
			id: 'sidebar-acceptance-criteria-status',
			method: 'sidebar/acceptanceCriteriaStatus',
			includeCriteria: true,
			includeEvidence: true,
			includePromptBlock: false,
			maxCriteria: 12,
			requestedAt: Date.now(),
		}, {
			verificationPlan: this.lastVerificationPlan,
		});
	}

	private postCustomModeCatalog(catalog: VibeCodexCustomModeCatalog): void {
		this.postMessage({
			type: 'customModeCatalog',
			summary: customModeCatalogSummary(catalog),
			catalog,
		});
		this.postGuidanceStatus();
	}

	private postWorkspaceGuidance(guidance: VibeCodexWorkspaceGuidance): void {
		this.postMessage({
			type: 'workspaceGuidance',
			summary: workspaceGuidanceSummary(guidance),
			guidance,
		});
		this.postGuidanceStatus();
	}

	private createRuleProposalForSlash(prompt: string, slashCommand: VibeCodexSlashCommandContext | undefined, workspaceGuidance: VibeCodexWorkspaceGuidance | undefined): VibeCodexRuleProposal | undefined {
		if (slashCommand?.command !== 'newrule') {
			return undefined;
		}
		return createRuleProposal({ request: prompt, workspaceGuidance });
	}

	private postRuleProposal(proposal: VibeCodexRuleProposal | undefined): void {
		this.postMessage({
			type: 'ruleProposal',
			summary: proposal ? ruleProposalSummary(proposal) : '',
			proposal,
		});
		this.postGuidanceStatus();
	}

	private postSessionRecall(recall: VibeCodexSessionRecall | undefined): void {
		this.postMessage({
			type: 'sessionRecall',
			summary: sessionRecallSummary(recall),
			recall,
		});
	}

	private postDocsContext(context: VibeCodexDocsContext | undefined): void {
		this.postMessage({
			type: 'docsContext',
			summary: docsContextSummary(context),
			context,
		});
	}

	private postMemoryBank(memoryBank: VibeCodexMemoryBank): void {
		this.postMessage({
			type: 'memoryBank',
			summary: memoryBankSummary(memoryBank),
			memoryBank,
		});
		this.postGuidanceStatus();
	}

	private postGuidanceStatus(response?: VibeCodexGuidanceStatusResponse): void {
		const status = response ?? this.currentGuidanceStatus();
		this.postMessage({
			type: 'guidanceStatus',
			summary: guidanceStatusSummary(status),
			status,
		});
	}

	private currentGuidanceStatus(request?: VibeCodexGuidanceStatusRequest): VibeCodexGuidanceStatusResponse {
		return createGuidanceStatusResponse(request ?? {
			id: 'sidebar-guidance-status',
			method: 'sidebar/guidanceStatus',
			includeDocuments: false,
			includeMemoryBank: true,
			includeCustomModes: true,
			includeRuleProposal: true,
			requestedAt: Date.now(),
		}, {
			guidance: this.lastWorkspaceGuidance,
			memoryBank: this.lastMemoryBank,
			customModeCatalog: this.lastCustomModeCatalog,
			ruleProposal: this.lastRuleProposal,
		});
	}

	private postPreviewPlan(plan: VibeCodexPreviewPlan): void {
		this.postMessage({
			type: 'previewPlan',
			summary: previewPlanSummary(plan),
			plan,
		});
		this.postPreviewStatus();
	}

	private postPreviewStatus(response?: VibeCodexPreviewStatusResponse): void {
		const status = response ?? this.currentPreviewStatus();
		this.postMessage({
			type: 'previewStatus',
			summary: previewStatusSummary(status),
			status,
		});
	}

	private currentPreviewStatus(request?: VibeCodexPreviewStatusRequest): VibeCodexPreviewStatusResponse {
		return createPreviewStatusResponse(request ?? {
			id: 'sidebar-preview-status',
			method: 'sidebar/previewStatus',
			includeTargets: true,
			includeInsights: true,
			maxInsights: 8,
			requestedAt: Date.now(),
		}, {
			previewPlan: this.lastPreviewPlan,
			terminalInsights: [...this.terminalInsights.values()],
			pendingBrowserActions: this.browserActions.size,
			hasExecutionAuthorization: !!this.executionAuthorization,
		});
	}

	private postMcpCatalog(catalog: VibeCodexMcpCatalog): void {
		this.postMessage({
			type: 'mcpCatalog',
			summary: mcpCatalogSummary(catalog),
			catalog,
		});
		this.postMcpStatus();
	}

	private postMcpStatus(response?: VibeCodexMcpStatusResponse): void {
		const status = response ?? this.currentMcpStatus();
		this.postMessage({
			type: 'mcpStatus',
			summary: mcpStatusSummary(status),
			status,
		});
	}

	private currentMcpStatus(request?: VibeCodexMcpStatusRequest): VibeCodexMcpStatusResponse {
		return createMcpStatusResponse(request ?? {
			id: 'sidebar-mcp-status',
			method: 'sidebar/mcpStatus',
			includeServers: true,
			includeTools: true,
			requestedAt: Date.now(),
		}, {
			catalog: this.lastMcpCatalog,
			pendingActions: this.mcpActions.size,
			hasExecutionAuthorization: !!this.executionAuthorization,
		});
	}

	private refreshToolCatalog(): VibeCodexToolCatalog {
		const catalog = createToolCatalog({
			modePolicy: this.lastModePolicy,
			hasExecutionAuthorization: !!this.executionAuthorization,
			bridgeConnected: !!this.bridge?.connected,
			mcpCatalog: this.lastMcpCatalog,
			previewPlan: this.lastPreviewPlan,
			parallelPlan: this.lastParallelPlan,
		});
		this.lastToolCatalog = catalog;
		this.postToolCatalog(catalog);
		this.postCapabilityMatrix(createCapabilityMatrixResponse({
			id: 'sidebar',
			method: 'sidebar/capabilityMatrix',
			includeEvidence: false,
			includePlanned: false,
			requestedAt: Date.now(),
		}, { toolCatalog: catalog }));
		return catalog;
	}

	private postToolCatalog(catalog: VibeCodexToolCatalog): void {
		this.postMessage({
			type: 'toolCatalog',
			summary: toolCatalogSummary(catalog),
			catalog,
		});
		this.notifyToolCatalog(catalog);
		this.notifyToolSchemaManifest(catalog);
	}

	private postCapabilityMatrix(matrix: VibeCodexCapabilityMatrixResponse): void {
		this.postMessage({
			type: 'capabilityMatrix',
			summary: capabilityMatrixSummary(matrix),
			matrix,
		});
	}

	private postToolSchemas(response: VibeCodexToolSchemaResponse): void {
		this.postMessage({
			type: 'toolSchemas',
			summary: toolSchemaSummary(response),
			response,
		});
	}

	private postToolTimelineStatus(response?: VibeCodexToolTimelineStatusResponse): void {
		const status = response ?? this.currentToolTimelineStatus();
		this.postMessage({
			type: 'toolTimelineStatus',
			summary: toolTimelineStatusSummary(status),
			status,
		});
	}

	private currentToolTimelineStatus(request?: VibeCodexToolTimelineStatusRequest): VibeCodexToolTimelineStatusResponse {
		return createToolTimelineStatusResponse(request ?? {
			id: 'sidebar-tool-timeline-status',
			method: 'sidebar/toolTimelineStatus',
			includeEvents: true,
			includeLiveState: true,
			includeDetails: false,
			maxEvents: 12,
			requestedAt: Date.now(),
		}, {
			transcriptEvents: this.transcriptEvents,
			approvals: [...this.approvalCards.values()],
			terminalRuns: [...this.terminalRuns.values()],
			activeDiffReview: this.activeDiffReview,
		});
	}

	private postNotificationStatus(response?: VibeCodexNotificationStatusResponse): void {
		const status = response ?? this.currentNotificationStatus();
		this.postMessage({
			type: 'notificationStatus',
			summary: notificationStatusSummary(status),
			status,
		});
	}

	private currentNotificationStatus(request?: VibeCodexNotificationStatusRequest): VibeCodexNotificationStatusResponse {
		return createNotificationStatusResponse(request ?? {
			id: 'sidebar-notification-status',
			method: 'sidebar/notificationStatus',
			includeItems: true,
			includeDetails: false,
			maxItems: 12,
			requestedAt: Date.now(),
		}, {
			config: this.notificationConfig(),
			transcriptEvents: this.transcriptEvents,
			approvals: [...this.approvalCards.values()],
			terminalRuns: [...this.terminalRuns.values()],
			activeDiffReview: this.activeDiffReview,
			activePlan: this.activePlan ? { taskId: this.activePlan.taskId, revision: this.activePlan.revision, summary: this.activePlan.summary } : undefined,
			planAwaitingApproval: this.activePlan ? !authorizationMatchesPlan(this.executionAuthorization, this.activePlan) : false,
			scheduledLongRunningTerminalRunIds: [...this.terminalNotificationTimers.keys()],
			deliveredLongRunningTerminalRunIds: [...this.longRunningTerminalNotifications.values()],
		});
	}

	private postProtocolStatus(response?: VibeCodexProtocolStatusResponse): void {
		const status = response ?? this.currentProtocolStatus();
		this.postMessage({
			type: 'protocolStatus',
			summary: protocolStatusSummary(status),
			status,
		});
		this.refreshRuntimeReadinessStatus();
	}

	private postRuntimeReadinessStatus(response: VibeCodexRuntimeReadinessStatusResponse): void {
		this.postMessage({
			type: 'runtimeReadinessStatus',
			summary: runtimeReadinessSummary(response),
			status: response,
		});
	}

	private refreshRuntimeReadinessStatus(): void {
		void this.currentRuntimeReadinessStatus({
			id: 'sidebar-runtime-readiness-refresh',
			method: 'sidebar/runtimeReadinessStatus',
			includeGates: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}).then(response => {
			this.postRuntimeReadinessStatus(response);
		}, error => {
			this.recordProtocol('error', 'runtime readiness refresh failed', {
				message: error instanceof Error ? error.message : String(error),
			});
		});
	}

	private async currentRuntimeReadinessStatus(request?: VibeCodexRuntimeReadinessStatusRequest): Promise<VibeCodexRuntimeReadinessStatusResponse> {
		const provider = this.lastProvider ?? await providerRuntimeConfig(this.extensionContext.secrets, this.lastMode);
		const providerStatus = this.currentProviderStatus({
			id: 'runtime-provider-status',
			method: 'runtime/providerStatus',
			mode: this.lastMode,
			includeCodexConfig: true,
			includeModeRoutes: false,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, provider);
		const backendLaunchStatus = this.currentBackendLaunchStatus({
			id: 'runtime-backend-launch-status',
			method: 'runtime/backendLaunchStatus',
			includeRoutes: false,
			includePromptBlock: false,
			requestedAt: Date.now(),
		});
		const protocolStatus = this.currentProtocolStatus({
			id: 'runtime-protocol-status',
			method: 'runtime/protocolStatus',
			includeEvents: false,
			maxEvents: 0,
			requestedAt: Date.now(),
		});
		return createRuntimeReadinessStatusResponse(request ?? {
			id: 'sidebar-runtime-readiness-status',
			method: 'sidebar/runtimeReadinessStatus',
			includeGates: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			providerStatus,
			backendLaunchStatus,
			protocolStatus,
		});
	}

	private postExtensionInstallStatus(response?: VibeCodexExtensionInstallStatusResponse): void {
		const status = response ?? this.currentExtensionInstallStatus();
		this.postMessage({
			type: 'extensionInstallStatus',
			summary: extensionInstallStatusSummary(status),
			status,
		});
	}

	private currentExtensionInstallStatus(request?: VibeCodexExtensionInstallStatusRequest): VibeCodexExtensionInstallStatusResponse {
		return createExtensionInstallStatusResponse(request ?? {
			id: 'sidebar-extension-install-status',
			method: 'sidebar/extensionInstallStatus',
			includeFeatures: true,
			includeActivationEvents: true,
			includeCommands: true,
			includeConfiguration: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, this.extensionInstallStatusInput());
	}

	private extensionInstallStatusInput(): VibeCodexExtensionInstallStatusInput {
		const extension = (this.extensionContext as unknown as { readonly extension?: { readonly id?: string; readonly extensionUri?: vscode.Uri; readonly packageJSON?: unknown } }).extension;
		const extensionUri = extension?.extensionUri ?? this.extensionContext.extensionUri;
		return {
			manifest: extension?.packageJSON,
			...(extension?.id ? { extensionId: extension.id } : {}),
			extensionMode: this.extensionModeName(),
			extensionUri: extensionUri.toString(),
			runtimeModuleLoaded: true,
			strictWebviewCsp: true,
			localResourceRootsScoped: true,
		};
	}

	private extensionModeName(): string {
		switch (this.extensionContext.extensionMode) {
			case vscode.ExtensionMode.Development:
				return 'development';
			case vscode.ExtensionMode.Test:
				return 'test';
			default:
				return 'production';
		}
	}

	private postBackendLaunchStatus(response?: VibeCodexBackendLaunchStatusResponse): void {
		const status = response ?? this.currentBackendLaunchStatus();
		this.postMessage({
			type: 'backendLaunchStatus',
			summary: backendLaunchStatusSummary(status),
			status,
		});
		this.refreshRuntimeReadinessStatus();
	}

	private currentBackendLaunchStatus(request?: VibeCodexBackendLaunchStatusRequest): VibeCodexBackendLaunchStatusResponse {
		return createBackendLaunchStatusResponse(request ?? {
			id: 'sidebar-backend-launch-status',
			method: 'sidebar/backendLaunchStatus',
			includeRoutes: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			config: this.currentBackendLaunchConfig(),
			bridgeStatus: this.lastBridgeStatus,
		});
	}

	private currentProtocolStatus(request?: VibeCodexProtocolStatusRequest): VibeCodexProtocolStatusResponse {
		return createProtocolStatusResponse(request ?? {
			id: 'sidebar-protocol-status',
			method: 'sidebar/protocolStatus',
			includeEvents: true,
			maxEvents: 12,
			requestedAt: Date.now(),
		}, {
			bridgeStatus: this.lastBridgeStatus,
			protocolEvents: this.protocolEvents,
			transportConfig: this.currentBridgeTransportConfig(),
		});
	}

	private currentBackendLaunchConfig(): VibeCodexBackendLaunchConfig {
		return {
			selectedTransport: this.bridgeTransport(),
			framing: this.messageFraming(),
			command: this.codexCommand(),
			args: this.appServerArgs(),
			...(this.workspaceRootPath() ? { cwd: this.workspaceRootPath() } : {}),
			...(this.pipePath() ? { pipePath: this.pipePath() } : {}),
			...(this.websocketUrl() ? { websocketUrl: this.websocketUrl() } : {}),
		};
	}

	private currentBridgeTransportConfig(): VibeCodexProtocolTransportConfig {
		return {
			selectedTransport: this.bridgeTransport(),
			framing: this.messageFraming(),
			command: this.codexCommand(),
			args: this.appServerArgs(),
			...(this.workspaceRootPath() ? { cwd: this.workspaceRootPath() } : {}),
			...(this.pipePath() ? { pipePath: this.pipePath() } : {}),
			...(this.websocketUrl() ? { websocketUrl: this.websocketUrl() } : {}),
		};
	}

	private postBrowserStatus(response?: VibeCodexBrowserStatusResponse): void {
		const status = response ?? this.currentBrowserStatus();
		this.postMessage({
			type: 'browserStatus',
			summary: browserStatusSummary(status),
			status,
		});
	}

	private currentBrowserStatus(request?: VibeCodexBrowserStatusRequest): VibeCodexBrowserStatusResponse {
		return createBrowserStatusResponse(request ?? {
			id: 'sidebar-browser-status',
			method: 'sidebar/browserStatus',
			includePendingActions: true,
			maxActions: 12,
			requestedAt: Date.now(),
		}, {
			pendingActions: [...this.browserActions.values()],
			hasExecutionAuthorization: !!this.executionAuthorization,
		});
	}

	private recordBrowserActionEvidence(event: VibeCodexBrowserActionEvidenceEvent): void {
		this.browserActionEvidence = [...this.browserActionEvidence, event].slice(-80);
		this.postBrowserActionStatus();
	}

	private postBrowserActionStatus(response?: VibeCodexBrowserActionStatusResponse): void {
		const status = response ?? this.currentBrowserActionStatus();
		this.postMessage({
			type: 'browserActionStatus',
			summary: browserActionStatusSummary(status),
			status,
		});
	}

	private currentBrowserActionStatus(request?: VibeCodexBrowserActionStatusRequest): VibeCodexBrowserActionStatusResponse {
		return createBrowserActionStatusResponse(request ?? {
			id: 'sidebar-browser-action-status',
			method: 'sidebar/browserActionStatus',
			includeEvents: true,
			includePendingActions: true,
			includePromptBlock: false,
			maxEvents: 12,
			maxPendingActions: 12,
			requestedAt: Date.now(),
		}, {
			events: this.browserActionEvidence,
			pendingActions: [...this.browserActions.values()],
		});
	}

	private postCheckpointStatus(response?: VibeCodexCheckpointStatusResponse): void {
		const status = response ?? this.currentCheckpointStatus();
		this.postMessage({
			type: 'checkpointStatus',
			summary: checkpointStatusSummary(status),
			status,
		});
	}

	private currentCheckpointStatus(request?: VibeCodexCheckpointStatusRequest): VibeCodexCheckpointStatusResponse {
		return createCheckpointStatusResponse(request ?? {
			id: 'sidebar-checkpoint-status',
			method: 'sidebar/checkpointStatus',
			includeFiles: true,
			includeGit: true,
			includeActiveReview: true,
			requestedAt: Date.now(),
		}, {
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpoints: [...this.patchCheckpoints.values()],
			gitCheckpoint: this.taskGitCheckpoint,
			activeReview: this.activeDiffReview,
		});
	}

	private postRollbackRestoreStatus(response?: VibeCodexRollbackRestoreStatusResponse): void {
		const status = response ?? this.currentRollbackRestoreStatus();
		this.postMessage({
			type: 'rollbackRestoreStatus',
			summary: rollbackRestoreStatusSummary(status),
			status,
		});
	}

	private currentRollbackRestoreStatus(request?: VibeCodexRollbackRestoreStatusRequest): VibeCodexRollbackRestoreStatusResponse {
		return createRollbackRestoreStatusResponse(request ?? {
			id: 'sidebar-rollback-restore-status',
			method: 'sidebar/rollbackRestoreStatus',
			target: 'task',
			includeFiles: true,
			includePromptBlock: false,
			maxFiles: 24,
			requestedAt: Date.now(),
		}, {
			taskCheckpointId: this.taskCheckpointId,
			fileCheckpoints: [...this.patchCheckpoints.values()],
			activeReview: this.activeDiffReview,
		});
	}

	private postExecutionGateStatus(response?: VibeCodexExecutionGateStatusResponse): void {
		const status = response ?? this.currentExecutionGateStatus();
		this.postMessage({
			type: 'executionGateStatus',
			summary: executionGateStatusSummary(status),
			status,
		});
		this.postWorkspaceSandboxStatus();
		this.postSafetyStatus();
		this.postBrowserStatus();
		this.postParallelWorktreeStatus();
		this.postParallelDispatchPlan();
	}

	private currentExecutionGateStatus(): VibeCodexExecutionGateStatusResponse {
		return createExecutionGateStatusResponse({
			id: 'sidebar',
			method: 'sidebar/executionGateStatus',
			...(this.activePlan ? { taskId: this.activePlan.taskId, revision: this.activePlan.revision } : {}),
			arguments: {},
			includeToolCall: false,
			includePromptBlock: false,
			requestedAt: Date.now(),
		}, {
			plan: this.activePlan,
			authorization: this.executionAuthorization,
			toolCatalog: this.lastToolCatalog,
			approvals: [...this.approvalCards.values()],
			activeDiffReview: this.activeDiffReview,
		});
	}

	private postWorkspaceSandboxStatus(response?: VibeCodexWorkspaceSandboxStatusResponse): void {
		if (response) {
			this.postMessage({
				type: 'workspaceSandboxStatus',
				summary: workspaceSandboxStatusSummary(response),
				status: response,
			});
			return;
		}
		void this.currentWorkspaceSandboxStatus().then(status => {
			this.postWorkspaceSandboxStatus(status);
		}, error => {
			this.recordProtocol('error', 'workspace sandbox status refresh failed', error instanceof Error ? error.message : String(error));
		});
	}

	private async currentWorkspaceSandboxStatus(): Promise<VibeCodexWorkspaceSandboxStatusResponse> {
		return createWorkspaceSandboxStatusResponse({
			id: 'sidebar-workspace-sandbox-status',
			method: 'sidebar/workspaceSandboxStatus',
			includeRoots: true,
			includeIgnorePolicy: true,
			includePaths: true,
			includeGuardrails: true,
			maxPaths: 24,
			samplePaths: [],
			requestedAt: Date.now(),
		}, {
			workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
			workspaceTrusted: vscode.workspace.isTrusted,
			ignorePolicy: await collectWorkspaceIgnorePolicy(),
			approvals: [...this.approvalCards.values()],
			activeDiffReview: this.activeDiffReview,
			patchCheckpoints: [...this.patchCheckpoints.values()],
		});
	}

	private postSafetyStatus(response?: VibeCodexSafetyStatusResponse): void {
		const status = response ?? this.currentSafetyStatus();
		this.postMessage({
			type: 'safetyStatus',
			summary: safetyStatusSummary(status),
			status,
		});
	}

	private currentSafetyStatus(request?: VibeCodexSafetyStatusRequest): VibeCodexSafetyStatusResponse {
		return createSafetyStatusResponse(request ?? {
			id: 'sidebar-safety-status',
			method: 'sidebar/safetyStatus',
			includePolicies: true,
			includePendingDetails: true,
			requestedAt: Date.now(),
		}, {
			modePolicy: this.lastModePolicy,
			commandPermissionPolicy: this.lastCommandPermissionPolicy,
			autoApproveConfig: this.autoApproveConfig(),
			authorization: this.executionAuthorization,
			activePlan: this.activePlan,
			workspaceTrusted: vscode.workspace.isTrusted,
			workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
			pending: {
				approvals: this.approvalCards.size,
				browserActions: this.browserActions.size,
				mcpActions: this.mcpActions.size,
				webFetches: this.webFetches.size,
				hookActions: this.hookActions.size,
				userInputRequests: this.userInputRequests.size,
				diffFiles: this.activeDiffReview?.files.filter(file => file.status === 'pending').length ?? 0,
			},
			pendingDetails: [
				...pendingSafetyItems(this.approvalCards.values(), 'approval'),
				...pendingSafetyItems(this.browserActions.values(), 'browser'),
				...pendingSafetyItems(this.mcpActions.values(), 'mcp'),
				...pendingSafetyItems(this.webFetches.values(), 'web'),
				...pendingSafetyItems(this.hookActions.values(), 'hook'),
			],
		});
	}

	private postRedactionStatus(response?: VibeCodexRedactionStatusResponse): void {
		const status = response ?? this.currentRedactionStatus();
		this.postMessage({
			type: 'redactionStatus',
			summary: redactionStatusSummary(status),
			status,
		});
	}

	private currentRedactionStatus(): VibeCodexRedactionStatusResponse {
		return createRedactionStatusResponse({
			id: 'sidebar-redaction-status',
			method: 'sidebar/redactionStatus',
			includeSamples: true,
			includePromptBlock: false,
			requestedAt: Date.now(),
		});
	}

	private notifyToolCatalog(catalog: VibeCodexToolCatalog): void {
		if (!this.bridge?.connected) {
			return;
		}
		const signature = toolCatalogSignature(catalog);
		if (this.lastSentToolCatalogSignature === signature) {
			return;
		}
		const payload = {
			source: 'externalExtension',
			taskId: this.activePlan?.taskId,
			revision: this.activePlan?.revision,
			catalog,
			summary: toolCatalogSummary(catalog),
			promptBlock: toolCatalogPromptBlock(catalog),
		};
		this.recordProtocol('out', 'agent/toolCatalog', { jsonrpc: '2.0', method: 'agent/toolCatalog', params: payload });
		void this.bridge.notify('agent/toolCatalog', payload).then(() => {
			this.lastSentToolCatalogSignature = signature;
		}, error => {
			this.recordProtocol('error', 'agent/toolCatalog', error instanceof Error ? error.message : String(error));
		});
	}

	private notifyToolSchemaManifest(catalog: VibeCodexToolCatalog): void {
		if (!this.bridge?.connected) {
			return;
		}
		const signature = `${toolCatalogSignature(catalog)}:toolSchemaManifest:v1`;
		if (this.lastSentToolSchemaManifestSignature === signature) {
			return;
		}
		const payload = createToolSchemaManifestPayload({
			toolCatalog: catalog,
			taskId: this.activePlan?.taskId,
			revision: this.activePlan?.revision,
			includeUnavailable: true,
		});
		this.recordProtocol('out', 'agent/toolSchemaManifest', { jsonrpc: '2.0', method: 'agent/toolSchemaManifest', params: payload });
		void this.bridge.notify('agent/toolSchemaManifest', payload).then(() => {
			this.lastSentToolSchemaManifestSignature = signature;
		}, error => {
			this.recordProtocol('error', 'agent/toolSchemaManifest', error instanceof Error ? error.message : String(error));
		});
	}

	private async ensureTaskCheckpoint(): Promise<void> {
		if (!this.taskCheckpointId) {
			this.taskCheckpointId = `task-checkpoint-${Date.now().toString(36)}`;
			this.taskGitCheckpoint = await createWorkspaceGitCheckpoint(this.activePlan?.taskId ?? this.activeSessionId ?? this.taskCheckpointId);
			const detail = [
				`Task checkpoint: ${this.taskCheckpointId}`,
				gitCheckpointSummary(this.taskGitCheckpoint),
			].filter(Boolean).join('\n');
			this.postTaskCheckpointState();
			void this.patchActiveSession({
				evidence: this.activeEvidence([
					`Created task checkpoint ${this.taskCheckpointId} before first accepted diff.`,
					gitCheckpointSummary(this.taskGitCheckpoint),
				].filter(Boolean).join(' ')),
			});
			this.recordTranscript('rollback', 'Created task checkpoint before first accepted diff', detail);
		}
	}

	private resetTaskCheckpoint(): void {
		this.taskCheckpointId = undefined;
		this.taskGitCheckpoint = undefined;
		this.patchCheckpoints.clear();
		this.postTaskCheckpointState();
	}

	private clearExecutionAuthorization(): void {
		this.executionAuthorization = undefined;
		this.postAutoApproveState();
		this.refreshToolCatalog();
		this.postDeliveryBar();
		this.postParallelMergeStatus();
		this.postPlanStatus();
		this.postPlanCanvasStatus();
		this.postModeStatus();
		this.postExecutionGateStatus();
		this.postTerminalRemediationStatus();
		this.postTerminalCommandValidationStatus();
		this.postInlinePromptStatus();
		this.postPreviewStatus();
	}

	private postTaskCheckpointState(): void {
		this.postMessage({
			type: 'taskCheckpoint',
			checkpoint: this.taskCheckpointId ? {
				id: this.taskCheckpointId,
				fileCount: this.patchCheckpoints.size,
				paths: [...this.patchCheckpoints.keys()],
				git: this.taskGitCheckpoint,
			} : undefined,
		});
		this.postDeliveryBar();
		this.postRollbackRestoreStatus();
	}

	private async startSession(seed: Parameters<typeof createSessionSnapshot>[0]): Promise<void> {
		const snapshot = createSessionSnapshot(seed);
		this.activeSessionId = snapshot.id;
		this.transcriptEvents = snapshot.transcript;
		this.postTranscript();
		const history = await saveSessionSnapshot(this.extensionContext.globalState, snapshot);
		this.postSessionHistory(history);
	}

	private async patchActiveSession(patch: Parameters<typeof updateSessionSnapshot>[2]): Promise<void> {
		const history = await updateSessionSnapshot(this.extensionContext.globalState, this.activeSessionId, patch);
		this.postSessionHistory(history);
	}

	private postSessionHistory(history: readonly VibeCodexSessionSnapshot[] = loadSessionHistory(this.extensionContext.globalState)): void {
		this.postMessage({
			type: 'sessionHistory',
			activeSessionId: this.activeSessionId,
			history: history.map(snapshot => ({
				id: snapshot.id,
				createdAt: snapshot.createdAt,
				updatedAt: snapshot.updatedAt,
				mode: snapshot.mode,
				prompt: snapshot.prompt,
				status: snapshot.status,
				modePolicy: snapshot.modePolicy,
				commandPermissionPolicy: snapshot.commandPermissionPolicy,
				slashCommand: snapshot.slashCommand,
				plan: snapshot.plan,
				planRevisionHistory: snapshot.planRevisionHistory,
				inlinePromptSession: snapshot.inlinePromptSession,
				provider: snapshot.provider,
				parallelPlan: snapshot.parallelPlan,
				verificationPlan: snapshot.verificationPlan,
				customModeCatalog: snapshot.customModeCatalog,
				sessionRecall: snapshot.sessionRecall,
				docsContext: snapshot.docsContext,
				workspaceGuidance: snapshot.workspaceGuidance,
				ruleProposal: snapshot.ruleProposal,
				memoryBank: snapshot.memoryBank,
				previewPlan: snapshot.previewPlan,
				mcpCatalog: snapshot.mcpCatalog,
				toolCatalog: snapshot.toolCatalog,
				finalReview: snapshot.finalReview,
				transcript: snapshot.transcript,
				evidence: snapshot.evidence,
			})),
		});
		this.postChatTabs(history);
		this.postSessionHistoryStatus(this.currentSessionHistoryStatus(undefined, history));
	}

	private postChatTabs(history: readonly VibeCodexSessionSnapshot[] = loadSessionHistory(this.extensionContext.globalState)): void {
		const state = createChatTabs(history, this.activeSessionId);
		this.postMessage({
			type: 'chatTabs',
			summary: chatTabsSummary(state),
			state,
		});
	}

	private postSessionHistoryStatus(response?: VibeCodexSessionHistoryStatusResponse): void {
		const status = response ?? this.currentSessionHistoryStatus();
		this.postMessage({
			type: 'sessionHistoryStatus',
			summary: sessionHistoryStatusSummary(status),
			status,
		});
	}

	private currentSessionHistoryStatus(request?: VibeCodexSessionHistoryStatusRequest, history: readonly VibeCodexSessionSnapshot[] = loadSessionHistory(this.extensionContext.globalState)): VibeCodexSessionHistoryStatusResponse {
		return createSessionHistoryStatusResponse(request ?? {
			id: 'sidebar-session-history-status',
			method: 'sidebar/sessionHistoryStatus',
			includeDetails: true,
			includeTranscriptTail: false,
			maxSessions: 8,
			requestedAt: Date.now(),
		}, {
			history,
			activeSessionId: this.activeSessionId,
		});
	}

	private recordTranscript(kind: VibeCodexTranscriptKind, title: string, detail?: string, status: VibeCodexTranscriptStatus = 'completed'): void {
		this.transcriptEvents = appendTranscriptEvent(this.transcriptEvents, { kind, title, detail, status });
		this.postTranscript();
		this.postToolTimelineStatus();
		this.postNotificationStatus();
		void this.patchActiveSession({ transcript: this.transcriptEvents });
	}

	private recordBackendTranscriptMessage(message: VibeCodexBackendTranscriptMessage): void {
		this.transcriptEvents = upsertTranscriptEvent(this.transcriptEvents, message.transcriptId, {
			kind: message.kind,
			title: message.title,
			detail: message.detail,
			status: message.status,
		}, message.append);
		this.postTranscript();
		this.postToolTimelineStatus();
		this.postNotificationStatus();
		void this.patchActiveSession({ transcript: this.transcriptEvents });
		this.updateStatus(backendTranscriptMessageSummary(message));
	}

	private postTranscript(): void {
		this.postMessage({
			type: 'transcript',
			events: this.transcriptEvents,
		});
	}

	private recordProtocol(direction: VibeCodexProtocolDirection, label: string, payload?: unknown): void {
		this.protocolEvents = appendProtocolEvent(this.protocolEvents, createProtocolEvent(direction, label, payload));
		this.postProtocolDiagnostics();
		this.postProtocolStatus();
	}

	private postProtocolDiagnostics(): void {
		this.postMessage({
			type: 'protocolDiagnostics',
			events: this.protocolEvents,
		});
	}

	private postRestoredSessionReadiness(): void {
		this.postAutoApproveState();
		this.refreshToolCatalog();
		this.postPlanStatus();
			this.postPlanCanvasStatus();
			this.postPlanFocusStatus();
			this.postModeStatus();
			this.postInlinePromptStatus();
			this.postApprovalStatus();
			this.postUserInputStatus();
		this.postDiffReviewStatus();
		this.postCheckpointStatus();
		this.postRollbackRestoreStatus();
		this.postExecutionGateStatus();
		this.postWorkspaceSandboxStatus();
		this.postSafetyStatus();
		this.postToolTimelineStatus();
		this.postNotificationStatus();
		this.postTerminalCommandValidationStatus();
		this.postTerminalControlStatus();
		this.postTerminalOutputStatus();
		this.postTerminalInsightStatus();
		this.postTerminalRemediationStatus();
		this.postContextStatus();
		this.postContextIndexStatus();
		this.postSymbolIndexStatus();
		this.postParallelStatus();
		this.postParallelWorktreeStatus();
		this.postParallelLaneExecutionStatus();
		this.postParallelDispatchPlan();
		this.postParallelReviewStatus();
		this.postParallelMergeStatus();
		this.postPreviewStatus();
		this.postBrowserStatus();
		this.postMcpStatus();
		this.postGuidanceStatus();
		this.postAcceptanceCriteriaStatus();
		this.postDeliveryBar();
		this.postSessionHistoryStatus();
		if (!this.lastProvider) {
			void this.postProviderState();
		}
	}

	private async restoreSession(sessionId: string): Promise<void> {
		const snapshot = loadSessionHistory(this.extensionContext.globalState).find(item => item.id === sessionId);
		if (!snapshot) {
			this.updateStatus(`Session ${sessionId} was not found.`);
			return;
		}
		this.resetTransientSessionStateForRestore();
		this.postMessage({ type: 'chatReset' });
		this.activeSessionId = snapshot.id;
		this.lastMode = snapshot.mode;
		this.lastModePolicy = snapshot.modePolicy ?? modePolicyFor(snapshot.mode);
		this.lastCommandPermissionPolicy = snapshot.commandPermissionPolicy ?? this.commandPermissionPolicy();
		this.lastPrompt = snapshot.prompt;
		this.lastSlashCommand = snapshot.slashCommand;
		this.transcriptEvents = snapshot.transcript;
		this.postTranscript();
		this.postModePolicy(this.lastModePolicy);
		this.postCommandPermissionPolicy(this.lastCommandPermissionPolicy);
		this.activePlan = snapshot.plan;
		const restoredPlan = this.activePlan;
		if (restoredPlan) {
			const flow = parseMermaidFlowchart(restoredPlan.flowchart, restoredPlan.steps);
			this.updateLastValidPlanCanvasGraph(restoredPlan, flow);
			this.postMessage({ type: 'plan', plan: restoredPlan, planIdentity: renderedPlanIdentity(restoredPlan), flow });
		}
		this.planRevisionHistory = snapshot.planRevisionHistory;
		this.postPlanRevisionHistory();
		this.lastInlinePromptSession = snapshot.inlinePromptSession;
		this.postInlinePromptSession(snapshot.inlinePromptSession);
		this.lastParallelPlan = snapshot.parallelPlan;
		if (this.lastParallelPlan) {
			this.postParallelPlan(this.lastParallelPlan);
		}
		this.lastVerificationPlan = snapshot.verificationPlan;
		if (this.lastVerificationPlan) {
			this.lastVerificationCriteriaKey = verificationCriteriaKey(this.lastVerificationPlan.acceptanceCriteria);
			this.postVerificationPlan(this.lastVerificationPlan);
		}
		this.lastCustomModeCatalog = snapshot.customModeCatalog;
		if (this.lastCustomModeCatalog) {
			this.postCustomModeCatalog(this.lastCustomModeCatalog);
		}
		this.lastWorkspaceGuidance = snapshot.workspaceGuidance;
		if (this.lastWorkspaceGuidance) {
			this.postWorkspaceGuidance(this.lastWorkspaceGuidance);
		}
		this.lastRuleProposal = snapshot.ruleProposal;
		this.postRuleProposal(snapshot.ruleProposal);
		this.lastSessionRecall = snapshot.sessionRecall;
		this.postSessionRecall(snapshot.sessionRecall);
		this.lastDocsContext = snapshot.docsContext;
		this.postDocsContext(snapshot.docsContext);
		this.lastMemoryBank = snapshot.memoryBank;
		if (this.lastMemoryBank) {
			this.postMemoryBank(this.lastMemoryBank);
		}
		this.lastPreviewPlan = snapshot.previewPlan;
		if (this.lastPreviewPlan) {
			this.postPreviewPlan(this.lastPreviewPlan);
		}
		this.lastMcpCatalog = snapshot.mcpCatalog;
		if (this.lastMcpCatalog) {
			this.postMcpCatalog(this.lastMcpCatalog);
		}
		this.lastToolCatalog = snapshot.toolCatalog;
		if (this.lastToolCatalog) {
			this.postToolCatalog(this.lastToolCatalog);
		}
		this.lastProvider = snapshot.provider as VibeCodexProviderRuntimeConfig | undefined;
		if (this.lastProvider) {
			this.postProvider(this.lastProvider);
		}
		this.postRestoredSessionReadiness();
		this.postMessage({ type: 'sessionRestored', session: snapshot });
		this.postSessionHistory();
		this.recordTranscript('system', `Restored session ${snapshot.id}`, 'Live approvals, execution authorization, diff reviews, terminal evidence, and rollback handles were cleared before restoring saved planning context.', 'completed');
		this.updateStatus(`Restored session ${snapshot.id}; live execution gates were reset.`);
	}

	private async exportSession(sessionId: string): Promise<void> {
		const history = loadSessionHistory(this.extensionContext.globalState);
		const snapshot = history.find(item => item.id === sessionId);
		if (!snapshot) {
			this.updateStatus(`Session ${sessionId} was not found.`);
			this.postSessionExportStatus(createSessionExportResponse(this.manualSessionExportRequest(sessionId), {
				history,
				activeSessionId: this.activeSessionId,
			}));
			return;
		}
		await exportSessionSnapshot(snapshot);
		this.postSessionExportStatus(createSessionExportResponse(this.manualSessionExportRequest(sessionId), {
			history,
			activeSessionId: this.activeSessionId,
		}));
		this.updateStatus(`Exported session ${snapshot.id}.`);
	}

	private postSessionExportStatus(response: VibeCodexSessionExportResponse): void {
		this.postMessage({
			type: 'sessionExportStatus',
			summary: sessionExportSummary(response),
			response,
		});
	}

	private manualSessionExportRequest(sessionId: string): VibeCodexSessionExportRequest {
		return {
			id: 'sidebar-session-export',
			method: 'sidebar/sessionExport',
			...(sessionId ? { sessionId } : {}),
			active: !sessionId,
			maxChars: 20000,
			requestedAt: Date.now(),
		};
	}

	private activeEvidence(item: string): readonly string[] {
		const snapshot = loadSessionHistory(this.extensionContext.globalState).find(candidate => candidate.id === this.activeSessionId);
		return [...(snapshot?.evidence ?? []), item].slice(-20);
	}

	private previewTarget(id: string): VibeCodexPreviewTarget | undefined {
		return this.lastPreviewPlan?.previews.find(target => target.id === id);
	}

	private async restoreCheckpointForPath(path: string): Promise<boolean> {
		const checkpoint = this.patchCheckpoints.get(path);
		if (!checkpoint) {
			return false;
		}
		await restoreExternalPatchCheckpoint(checkpoint);
		this.patchCheckpoints.delete(path);
		return true;
	}

	private clearStalePatchCheckpoints(review: ExternalDiffReview): void {
		const livePaths = new Set(review.files.map(file => file.path));
		for (const path of this.patchCheckpoints.keys()) {
			if (!livePaths.has(path)) {
				this.patchCheckpoints.delete(path);
			}
		}
		this.postTaskCheckpointState();
	}

	private postMessage(message: unknown): void {
		void this.view?.webview.postMessage(message);
	}

	private renderHtml(webview: vscode.Webview): string {
		const nonce = createNonce();
		const codexCommand = escapeHtml(vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('codexCommand', 'codex'));
		const transport = escapeHtml(vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('transport', 'stdio'));
		const messageFraming = escapeHtml(vscode.workspace.getConfiguration('vibeCodex.extension').get<string>('messageFraming', 'ndjson'));
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style nonce="${nonce}">
		body { padding: 14px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); background: var(--vscode-sideBar-background); }
		h2 { margin: 0 0 8px; font-size: 16px; }
		p { color: var(--vscode-descriptionForeground); line-height: 1.45; }
		label { display: block; margin: 10px 0 4px; color: var(--vscode-descriptionForeground); }
		select, textarea, input { box-sizing: border-box; width: 100%; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); }
		select { height: 28px; }
		input { height: 28px; padding: 4px 7px; }
		textarea { min-height: 112px; resize: vertical; padding: 7px; }
		.actions { display: grid; gap: 8px; margin: 14px 0; }
		button { width: 100%; text-align: left; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 7px 9px; cursor: pointer; }
		button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
		button:disabled { opacity: .55; cursor: default; }
		code { color: var(--vscode-textPreformat-foreground); }
		.status { min-height: 18px; color: var(--vscode-descriptionForeground); }
		.ok { color: var(--vscode-testing-iconPassed); }
		.plan { border-top: 1px solid var(--vscode-sideBarSectionHeader-border); margin-top: 14px; padding-top: 12px; }
		.plan h3 { font-size: 13px; margin: 12px 0 6px; }
		.plan-summary { font-weight: 600; }
		.plan-strategy, .plan-list { color: var(--vscode-descriptionForeground); }
		.plan-list { margin: 0; padding-left: 18px; }
		.plan-list li { margin: 5px 0; cursor: default; }
		.plan-list li.active { color: var(--vscode-foreground); }
		.plan-step-edit { display: grid; grid-template-columns: minmax(74px, .7fr) minmax(120px, 2fr) auto; gap: 6px; align-items: center; }
		.plan-step-edit button { width: auto; white-space: nowrap; }
		.plan-step-files { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 4px; }
		.plan-step-files.active { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
		.plan-step-file { width: auto; max-width: 100%; overflow-wrap: anywhere; border: 1px solid var(--vscode-input-border); }
		.flow-status { margin: 6px 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
		.flow-status.warning { color: var(--vscode-editorWarning-foreground); }
		.flow svg { width: 100%; max-width: 100%; height: auto; display: block; background: var(--vscode-editor-background); border: 1px solid var(--vscode-input-border); }
		.flow [data-node] { cursor: pointer; }
		.mermaid-source { max-height: 140px; overflow: auto; white-space: pre-wrap; background: var(--vscode-textCodeBlock-background); padding: 8px; }
		.mention-picker { display: grid; gap: 4px; margin: 4px 0 8px; }
		.mention-picker[hidden] { display: none; }
		.mention-item { width: 100%; text-align: left; border: 1px solid var(--vscode-input-border); background: var(--vscode-sideBar-background); color: var(--vscode-foreground); padding: 6px 7px; cursor: pointer; }
		.mention-item:first-child { border-color: var(--vscode-focusBorder); }
		.mention-detail { color: var(--vscode-descriptionForeground); font-size: 11px; margin-left: 6px; }
		.toggle-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; color: var(--vscode-descriptionForeground); }
		.toggle-row input { width: auto; height: auto; }
		.inline-select { width: auto; min-width: 110px; }
		.panel { border-top: 1px solid var(--vscode-sideBarSectionHeader-border); margin-top: 14px; padding-top: 12px; }
		.card { border: 1px solid var(--vscode-input-border); background: var(--vscode-sideBar-background); padding: 9px; margin: 8px 0; }
		.card-title { font-weight: 600; }
		.card-detail, .diff-code { white-space: pre-wrap; color: var(--vscode-descriptionForeground); }
		.card-actions { display: flex; gap: 6px; margin-top: 8px; }
		.card-actions button { width: auto; flex: 1; }
		.chat-tabs { display: grid; gap: 6px; }
		.chat-tab { width: 100%; text-align: left; border: 1px solid var(--vscode-input-border); background: var(--vscode-sideBar-background); color: var(--vscode-foreground); padding: 7px; cursor: pointer; }
		.chat-tab.active { border-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
		.chat-tab-meta { color: var(--vscode-descriptionForeground); font-size: 11px; margin-top: 3px; }
		.risk-blocked { color: var(--vscode-errorForeground); }
		.diff-code { max-height: 180px; overflow: auto; background: var(--vscode-textCodeBlock-background); padding: 8px; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
		.badge { float: right; color: var(--vscode-descriptionForeground); }
		.transcript-list { display: grid; gap: 7px; }
		.transcript-item { border-left: 3px solid var(--vscode-input-border); padding: 6px 8px; background: var(--vscode-sideBar-background); }
		.transcript-item.pending, .transcript-item.running { border-left-color: var(--vscode-focusBorder); }
		.transcript-item.blocked, .transcript-item.failed { border-left-color: var(--vscode-errorForeground); }
		.transcript-meta { color: var(--vscode-descriptionForeground); font-size: 11px; margin-bottom: 3px; text-transform: uppercase; }
		.transcript-title { font-weight: 600; }
		.transcript-detail { margin-top: 4px; white-space: pre-wrap; color: var(--vscode-descriptionForeground); }
	</style>
</head>
<body>
	<h2>Vibe Codex</h2>
	<p>Use the native VibeCode build for the complete bridge. External VS Code installs can still connect to Codex app-server, render a visual plan, approve it, or fall back to the CLI terminal.</p>
	<label for="mode">Mode</label>
	<select id="mode">
		<option value="plan">Plan</option>
		<option value="ask">Ask</option>
		<option value="manual">Manual</option>
		<option value="act">Act</option>
		<option value="agent" selected>Agent</option>
		<option value="debug">Debug</option>
		<option value="review">Review</option>
		<option value="custom">Custom</option>
	</select>
	<label for="prompt">Task</label>
	<textarea id="prompt" placeholder="Describe the change or question"></textarea>
	<div class="mention-picker" data-mention-picker hidden></div>
	<div class="actions">
		<button data-command="startTask">Start visual plan</button>
		<button class="secondary" data-command="newChatSession">New chat</button>
		<button class="secondary" data-command="queueTask">Queue on Task Board</button>
		<button class="secondary" data-command="connectBackend">Connect app-server</button>
		<button class="secondary" data-command="restartBackend">Restart app-server</button>
		<button class="secondary" data-command="disconnectBackend">Disconnect app-server</button>
		<button class="secondary" data-command="approvePlan" data-approve disabled>Approve & execute plan</button>
		<button class="secondary" data-command="runTerminal">Run in terminal</button>
		<button class="secondary" data-command="open">Open native agent</button>
		<button class="secondary" data-command="login">Login</button>
		<button class="secondary" data-command="configure">Configure provider</button>
		<button class="secondary" data-command="provider">Select provider</button>
		<button class="secondary" data-command="model">Select model</button>
		<button class="secondary" data-command="modeModel">Select mode model</button>
		<button class="secondary" data-command="clearProviderCredentials">Clear credentials</button>
	</div>
	<p>External bridge: <code>${transport}</code> · <code>${messageFraming}</code> · <code>${codexCommand}</code></p>
	<section class="panel" data-backend hidden>
		<h3>Backend</h3>
		<div class="card-detail" data-backend-status></div>
	</section>
	<section class="panel" data-transcript hidden>
		<h3>Transcript</h3>
		<div class="transcript-list" data-transcript-list></div>
	</section>
	<section class="panel" data-task-summary hidden>
		<h3>Task Summary Handoff</h3>
		<div class="card-detail" data-task-summary-summary></div>
		<div data-task-summary-cards></div>
		<div data-task-summary-sections></div>
		<pre class="diff-code" data-task-summary-markdown></pre>
		<div data-task-summary-guardrails></div>
	</section>
		<section class="panel" data-tool-timeline-status hidden>
			<h3>Tool Timeline</h3>
			<div class="card-detail" data-tool-timeline-summary></div>
			<div data-tool-timeline-live></div>
			<div data-tool-timeline-events></div>
		</section>
		<section class="panel" data-notification-status hidden>
			<h3>Attention Status</h3>
			<div class="card-detail" data-notification-summary></div>
			<div data-notification-cards></div>
			<div data-notification-items></div>
		</section>
		<section class="panel" data-chat-tabs hidden>
		<h3>Chat Tabs</h3>
		<div class="card-detail" data-chat-tabs-summary></div>
		<div class="chat-tabs" data-chat-tabs-list></div>
	</section>
	<section class="panel" data-history hidden>
		<h3>History</h3>
		<div data-history-list></div>
	</section>
	<section class="panel" data-session-history-status hidden>
		<h3>Session History Readiness</h3>
		<div class="card-detail" data-session-history-status-summary></div>
		<div data-session-history-status-cards></div>
		<div data-session-history-status-list></div>
	</section>
	<section class="panel" data-session-export-status hidden>
		<h3>Session Export Readiness</h3>
		<div class="card-detail" data-session-export-summary></div>
		<div data-session-export-cards></div>
		<pre class="diff-code" data-session-export-preview></pre>
		<div data-session-export-guardrails></div>
	</section>
	<section class="panel" data-session-recall hidden>
		<h3>Session Recall</h3>
		<div class="card-detail" data-session-recall-summary></div>
		<div data-session-recall-list></div>
	</section>
	<section class="panel" data-task-board hidden>
		<h3>Task Board</h3>
		<div class="card-detail" data-task-board-summary></div>
		<div data-task-board-list></div>
	</section>
		<section class="panel" data-task-board-status hidden>
			<h3>Task Board Readiness</h3>
			<div class="card-detail" data-task-board-status-summary></div>
			<div data-task-board-status-cards></div>
			<div data-task-board-status-list></div>
		</section>
		<section class="panel" data-task-start-status hidden>
			<h3>Task Start Readiness</h3>
			<div class="card-detail" data-task-start-status-summary></div>
			<div data-task-start-status-cards></div>
		</section>
	<section class="panel" data-external-intake-status hidden>
		<h3>External Intake</h3>
		<div class="card-detail" data-external-intake-summary></div>
		<div data-external-intake-counts></div>
		<div data-external-intake-routes></div>
	</section>
	<section class="panel" data-connector-schedule-status hidden>
		<h3>Connector & Scheduled Intake</h3>
		<div class="card-detail" data-connector-schedule-summary></div>
		<div data-connector-schedule-counts></div>
		<div data-connector-schedule-routes></div>
		<div data-connector-schedule-cards></div>
	</section>
	<section class="panel" data-runtime-readiness-status hidden>
		<h3>Runtime Readiness</h3>
		<div class="card-detail" data-runtime-readiness-summary></div>
		<div data-runtime-readiness-cards></div>
		<div data-runtime-readiness-gates></div>
	</section>
	<section class="panel" data-backend-launch-status hidden>
		<h3>Backend Launch Readiness</h3>
		<div class="card-detail" data-backend-launch-status-summary></div>
		<div data-backend-launch-status-cards></div>
		<div data-backend-launch-status-routes></div>
	</section>
	<section class="panel" data-protocol-status hidden>
		<h3>Protocol Health</h3>
		<div class="card-detail" data-protocol-status-summary></div>
		<div data-protocol-status-cards></div>
		<div data-protocol-status-events></div>
	</section>
	<section class="panel" data-extension-install-status hidden>
		<h3>Extension Install Readiness</h3>
		<div class="card-detail" data-extension-install-summary></div>
		<div data-extension-install-cards></div>
		<div data-extension-install-features></div>
	</section>
	<section class="panel" data-protocol hidden>
		<h3>Protocol</h3>
		<div data-protocol-list></div>
	</section>
	<section class="panel" data-provider hidden>
		<h3>Provider</h3>
		<div class="card-detail" data-provider-summary></div>
	</section>
	<section class="panel" data-provider-status hidden>
		<h3>Provider Readiness</h3>
		<div class="card-detail" data-provider-status-summary></div>
		<div data-provider-status-cards></div>
		<div data-provider-mode-routes></div>
	</section>
	<section class="panel" data-provider-catalog hidden>
		<h3>Provider Catalog</h3>
		<div class="card-detail" data-provider-catalog-summary></div>
		<div data-provider-catalog-cards></div>
		<div data-provider-catalog-list></div>
	</section>
	<section class="panel" data-mode-policy hidden>
		<h3>Mode Policy</h3>
		<div class="card-detail" data-mode-policy-summary></div>
	</section>
	<section class="panel" data-mode-status hidden>
		<h3>Mode Readiness</h3>
		<div class="card-detail" data-mode-status-summary></div>
		<div data-mode-status-cards></div>
		<div data-mode-status-modes></div>
	</section>
	<section class="panel" data-safety-status hidden>
		<h3>Safety Overview</h3>
		<div class="card-detail" data-safety-summary></div>
		<div data-safety-cards></div>
		<div data-safety-pending></div>
	</section>
	<section class="panel" data-command-permissions hidden>
		<h3>Command Permissions</h3>
		<div class="card-detail" data-command-permissions-summary></div>
		<div data-command-permissions-list></div>
	</section>
	<section class="panel" data-terminal-command-validation-status hidden>
		<h3>Command Validation Readiness</h3>
		<div class="card-detail" data-terminal-command-validation-summary></div>
		<div data-terminal-command-validation-cards></div>
	</section>
	<section class="panel" data-workspace-sandbox-status hidden>
		<h3>Workspace Sandbox</h3>
		<div class="card-detail" data-workspace-sandbox-summary></div>
		<div data-workspace-sandbox-counts></div>
		<div data-workspace-sandbox-paths></div>
	</section>
	<section class="panel" data-redaction-status hidden>
		<h3>Redaction Status</h3>
		<div class="card-detail" data-redaction-summary></div>
		<div data-redaction-counts></div>
		<div data-redaction-filters></div>
	</section>
	<section class="panel" data-execution-gate-status hidden>
		<h3>Execution Gate</h3>
		<div class="card-detail" data-execution-gate-status-summary></div>
		<div data-execution-gate-status-list></div>
	</section>
	<section class="panel" data-action-approval-status hidden>
		<h3>Action Approval Route</h3>
		<div class="card-detail" data-action-approval-status-summary></div>
		<div data-action-approval-status-cards></div>
	</section>
	<section class="panel" data-tool-catalog hidden>
		<h3>Tool Catalog</h3>
		<div class="card-detail" data-tool-catalog-summary></div>
		<div data-tool-catalog-list></div>
	</section>
	<section class="panel" data-capability-matrix hidden>
		<h3>Capability Matrix</h3>
		<div class="card-detail" data-capability-matrix-summary></div>
		<div data-capability-matrix-list></div>
	</section>
	<section class="panel" data-tool-schemas hidden>
		<h3>Tool Schemas</h3>
		<div class="card-detail" data-tool-schemas-summary></div>
		<div data-tool-schemas-list></div>
	</section>
	<section class="panel" data-auto-approve hidden>
		<h3>Auto-Approve</h3>
		<div class="card-detail" data-auto-approve-summary></div>
		<div data-auto-approve-controls></div>
	</section>
	<div class="status" data-status></div>
	<section class="panel" data-approvals hidden>
		<h3>Approvals</h3>
		<div data-approval-list></div>
	</section>
	<section class="panel" data-approval-status hidden>
		<h3>Approval Readiness</h3>
		<div class="card-detail" data-approval-status-summary></div>
		<div data-approval-status-cards></div>
		<div data-approval-status-list></div>
	</section>
		<section class="panel" data-user-input hidden>
			<h3>User Input</h3>
			<div data-user-input-list></div>
		</section>
		<section class="panel" data-user-input-status hidden>
			<h3>User Input Readiness</h3>
			<div class="card-detail" data-user-input-status-summary></div>
			<div data-user-input-status-list></div>
		</section>
		<section class="panel" data-browser-actions hidden>
			<h3>Browser Actions</h3>
		<div data-browser-action-list></div>
	</section>
	<section class="panel" data-browser-status hidden>
		<h3>Browser Readiness</h3>
		<div class="card-detail" data-browser-status-summary></div>
		<div data-browser-status-cards></div>
		<div data-browser-status-actions></div>
	</section>
	<section class="panel" data-browser-action-status hidden>
		<h3>Browser Action Evidence</h3>
		<div class="card-detail" data-browser-action-status-summary></div>
		<div data-browser-action-status-cards></div>
		<div data-browser-action-status-events></div>
	</section>
	<section class="panel" data-mcp-actions hidden>
		<h3>MCP Requests</h3>
		<div data-mcp-action-list></div>
	</section>
	<section class="panel" data-mcp-status hidden>
		<h3>MCP Readiness</h3>
		<div class="card-detail" data-mcp-status-summary></div>
		<div data-mcp-status-cards></div>
		<div data-mcp-status-servers></div>
	</section>
	<section class="panel" data-web-fetches hidden>
		<h3>Web Fetch</h3>
		<div data-web-fetch-list></div>
	</section>
	<section class="panel" data-hook-actions hidden>
		<h3>Hook Requests</h3>
		<div data-hook-action-list></div>
	</section>
	<section class="panel" data-context hidden>
		<h3>Context</h3>
		<div class="card-detail" data-context-summary></div>
		<div data-context-files></div>
		<div data-context-search></div>
		<div data-context-symbols></div>
		<div data-context-git></div>
	</section>
	<section class="panel" data-context-status hidden>
		<h3>Context Readiness</h3>
		<div class="card-detail" data-context-status-summary></div>
		<div data-context-status-cards></div>
		<div data-context-status-details></div>
	</section>
	<section class="panel" data-workspace-read-status hidden>
		<h3>Workspace Read Evidence</h3>
		<div class="card-detail" data-workspace-read-status-summary></div>
		<div data-workspace-read-status-cards></div>
		<div data-workspace-read-status-events></div>
	</section>
	<section class="panel" data-context-index-status hidden>
		<h3>Context Index</h3>
		<div class="card-detail" data-context-index-summary></div>
		<div data-context-index-sources></div>
		<div data-context-index-blockers></div>
	</section>
	<section class="panel" data-symbol-index-status hidden>
		<h3>Symbol Index</h3>
		<div class="card-detail" data-symbol-index-summary></div>
		<div data-symbol-index-cards></div>
		<div data-symbol-index-entries></div>
	</section>
	<section class="panel" data-docs-context hidden>
		<h3>Docs Context</h3>
		<div class="card-detail" data-docs-summary></div>
		<div data-docs-list></div>
	</section>
	<section class="panel" data-inline-prompt hidden>
		<h3>Inline Prompt</h3>
		<div class="card-detail" data-inline-summary></div>
		<div data-inline-plan-steps></div>
		<div data-inline-acceptance></div>
		<pre class="diff-code" data-inline-selection hidden></pre>
	</section>
	<section class="panel" data-inline-prompt-status hidden>
		<h3>Inline Prompt Readiness</h3>
		<div class="card-detail" data-inline-prompt-status-summary></div>
		<div data-inline-prompt-status-cards></div>
		<div data-inline-prompt-status-details></div>
	</section>
	<section class="panel" data-parallel hidden>
		<h3>Parallel Agents</h3>
		<div class="card-detail" data-parallel-summary></div>
		<div class="card-actions">
			<button data-command="prepareParallelWorktrees" data-prepare-worktrees disabled>Prepare worktrees</button>
			<button class="secondary" data-command="cleanupParallelWorktrees" data-cleanup-worktrees disabled>Cleanup worktrees</button>
		</div>
		<div data-parallel-list></div>
		<div data-parallel-review></div>
		<div data-parallel-merge></div>
	</section>
	<section class="panel" data-parallel-worktree-status hidden>
		<h3>Parallel Worktree Readiness</h3>
		<div class="card-detail" data-parallel-worktree-summary></div>
		<div data-parallel-worktree-cards></div>
		<div data-parallel-worktree-lanes></div>
	</section>
	<section class="panel" data-parallel-lane-execution-status hidden>
		<h3>Parallel Lane Execution Readiness</h3>
		<div class="card-detail" data-parallel-lane-execution-summary></div>
		<div data-parallel-lane-execution-cards></div>
		<div data-parallel-lane-execution-lane></div>
	</section>
	<section class="panel" data-parallel-dispatch-plan-status hidden>
		<h3>Parallel Dispatch Plan</h3>
		<div class="card-detail" data-parallel-dispatch-plan-summary></div>
		<div data-parallel-dispatch-plan-cards></div>
		<div data-parallel-dispatch-plan-lanes></div>
	</section>
	<section class="panel" data-parallel-status hidden>
		<h3>Parallel Agent Readiness</h3>
		<div class="card-detail" data-parallel-status-summary></div>
		<div data-parallel-status-cards></div>
		<div data-parallel-status-lanes></div>
	</section>
	<section class="panel" data-parallel-review-status hidden>
		<h3>Parallel Review Readiness</h3>
		<div class="card-detail" data-parallel-review-status-summary></div>
		<div data-parallel-review-status-cards></div>
		<div data-parallel-review-status-lanes></div>
	</section>
	<section class="panel" data-parallel-merge-status hidden>
		<h3>Parallel Merge Readiness</h3>
		<div class="card-detail" data-parallel-merge-status-summary></div>
		<div data-parallel-merge-status-cards></div>
		<div data-parallel-merge-status-review></div>
	</section>
	<section class="panel" data-verification hidden>
		<h3>Verification</h3>
		<div class="card-detail" data-verification-summary></div>
		<div data-verification-list></div>
	</section>
	<section class="panel" data-verification-status hidden>
		<h3>Verification Readiness</h3>
		<div class="card-detail" data-verification-status-summary></div>
		<div data-verification-status-cards></div>
		<div data-verification-status-checks></div>
	</section>
	<section class="panel" data-acceptance-criteria-status hidden>
		<h3>Acceptance Criteria Readiness</h3>
		<div class="card-detail" data-acceptance-criteria-summary></div>
		<div data-acceptance-criteria-cards></div>
		<div data-acceptance-criteria-list></div>
	</section>
	<section class="panel" data-custom-modes hidden>
		<h3>Custom Modes</h3>
		<div class="card-detail" data-custom-modes-summary></div>
		<div data-custom-modes-list></div>
	</section>
	<section class="panel" data-delivery-bar hidden>
		<h3>Delivery Bar</h3>
		<div class="card-detail" data-delivery-summary></div>
		<div data-delivery-list></div>
	</section>
	<section class="panel" data-delivery-bar-status hidden>
		<h3>Delivery Bar Readiness</h3>
		<div class="card-detail" data-delivery-bar-status-summary></div>
		<div data-delivery-bar-status-cards></div>
		<div data-delivery-bar-status-checks></div>
	</section>
	<section class="panel" data-smoke-benchmark hidden>
		<h3>Smoke Benchmark</h3>
		<div class="card-detail" data-smoke-summary></div>
		<div data-smoke-list></div>
	</section>
	<section class="panel" data-smoke-benchmark-status hidden>
		<h3>Smoke Benchmark Readiness</h3>
		<div class="card-detail" data-smoke-benchmark-status-summary></div>
		<div data-smoke-benchmark-status-cards></div>
		<div data-smoke-benchmark-status-milestones></div>
	</section>
	<section class="panel" data-workflow-status hidden>
		<h3>Workflow Proof</h3>
		<div class="card-detail" data-workflow-summary></div>
		<div data-workflow-counts></div>
		<div data-workflow-readiness></div>
		<div data-workflow-list></div>
		<div data-workflow-evidence></div>
		<div data-workflow-guardrails></div>
	</section>
	<section class="panel" data-happy-path-status hidden>
		<h3>Happy Path Proof</h3>
		<div class="card-detail" data-happy-path-summary></div>
		<div data-happy-path-cards></div>
		<div data-happy-path-gates></div>
		<div data-happy-path-evidence></div>
	</section>
	<section class="panel" data-final-review hidden>
		<h3>Final Review</h3>
		<div class="card-detail" data-final-review-summary></div>
		<div data-final-review-list></div>
	</section>
	<section class="panel" data-final-review-status hidden>
		<h3>Final Review Readiness</h3>
		<div class="card-detail" data-final-review-status-summary></div>
		<div data-final-review-status-cards></div>
		<div data-final-review-status-items></div>
		<div data-final-review-status-evidence></div>
	</section>
	<section class="panel" data-task-completion-gate hidden>
		<h3>Completion Gate</h3>
		<div class="card-detail" data-task-completion-summary></div>
		<div class="card-detail" data-task-completion-counts></div>
		<div data-task-completion-blockers></div>
		<div data-task-completion-evidence></div>
	</section>
	<section class="panel" data-task-completion-status hidden>
		<h3>Completion Readiness</h3>
		<div class="card-detail" data-task-completion-status-summary></div>
		<div data-task-completion-status-cards></div>
		<div data-task-completion-status-blockers></div>
	</section>
	<section class="panel" data-commit-handoff hidden>
		<h3>Commit Handoff</h3>
		<div class="card-detail" data-commit-summary></div>
		<div class="card-actions">
			<button data-command="copyCommitMessage" data-copy-commit disabled>Copy message</button>
			<button class="secondary" data-command="openSourceControl">Open SCM</button>
			<button class="secondary" data-command="runGitStatus">Git status</button>
		</div>
		<pre class="diff-code" data-commit-message></pre>
		<div data-commit-evidence></div>
	</section>
	<section class="panel" data-commit-handoff-status hidden>
		<h3>Commit Handoff Readiness</h3>
		<div class="card-detail" data-commit-handoff-status-summary></div>
		<div data-commit-handoff-status-cards></div>
		<div data-commit-handoff-status-files></div>
	</section>
	<section class="panel" data-auto-commit-status hidden>
		<h3>Auto-Commit Readiness</h3>
		<div class="card-detail" data-auto-commit-summary></div>
		<div data-auto-commit-cards></div>
		<div data-auto-commit-blockers></div>
		<div data-auto-commit-evidence></div>
		<div data-auto-commit-commands></div>
	</section>
	<section class="panel" data-guidance hidden>
		<h3>Rules / Skills / Hooks</h3>
		<div class="card-detail" data-guidance-summary></div>
		<div data-guidance-list></div>
	</section>
	<section class="panel" data-guidance-status hidden>
		<h3>Guidance Readiness</h3>
		<div class="card-detail" data-guidance-status-summary></div>
		<div data-guidance-status-cards></div>
		<div data-guidance-status-list></div>
	</section>
	<section class="panel" data-rule-proposal hidden>
		<h3>Rule Proposal</h3>
		<div class="card-detail" data-rule-proposal-summary></div>
		<div data-rule-proposal-body></div>
	</section>
	<section class="panel" data-memory-bank hidden>
		<h3>Memory Bank</h3>
		<div class="card-detail" data-memory-bank-summary></div>
		<div data-memory-bank-list></div>
	</section>
	<section class="panel" data-preview hidden>
		<h3>Preview</h3>
		<div class="card-detail" data-preview-summary></div>
		<div data-preview-list></div>
	</section>
	<section class="panel" data-preview-status hidden>
		<h3>Preview Readiness</h3>
		<div class="card-detail" data-preview-status-summary></div>
		<div data-preview-status-cards></div>
		<div data-preview-status-list></div>
	</section>
	<section class="panel" data-mcp hidden>
		<h3>MCP Servers</h3>
		<div class="card-detail" data-mcp-summary></div>
		<div data-mcp-list></div>
	</section>
	<section class="plan" data-plan hidden>
		<div class="plan-summary" data-plan-summary></div>
		<label for="plan-feedback">Plan feedback</label>
		<textarea id="plan-feedback" data-plan-feedback placeholder="Request changes before approval"></textarea>
		<div class="card-actions">
			<button class="secondary" data-command="refinePlan" data-refine disabled>Refine plan</button>
			<button class="secondary" data-command="rejectPlan" data-reject disabled>Reject plan</button>
		</div>
		<h3>Flow</h3>
		<div class="flow-status" data-flow-status></div>
		<div class="flow" data-flow></div>
		<h3>Checklist</h3>
		<ol class="plan-list" data-steps></ol>
		<h3>Revisions</h3>
		<div class="card-detail" data-plan-revisions-summary></div>
		<div data-plan-revisions></div>
		<h3>Strategy</h3>
		<p class="plan-strategy" data-strategy></p>
		<h3>Risks</h3>
		<ul class="plan-list" data-risks></ul>
		<h3>Acceptance</h3>
		<ul class="plan-list" data-acceptance></ul>
		<h3>Mermaid</h3>
		<pre class="mermaid-source" data-mermaid></pre>
	</section>
	<section class="panel" data-plan-status hidden>
		<h3>Plan Readiness</h3>
		<div class="card-detail" data-plan-status-summary></div>
		<div data-plan-status-cards></div>
		<div data-plan-status-details></div>
	</section>
	<section class="panel" data-plan-canvas-status hidden>
		<h3>Plan Canvas Readiness</h3>
		<div class="card-detail" data-plan-canvas-summary></div>
		<div data-plan-canvas-cards></div>
		<div data-plan-canvas-features></div>
	</section>
	<section class="panel" data-plan-edit-status hidden>
		<h3>Plan Edit Preview</h3>
		<div class="card-detail" data-plan-edit-summary></div>
		<div data-plan-edit-cards></div>
		<div data-plan-edit-details></div>
	</section>
	<section class="panel" data-plan-focus-status hidden>
		<h3>Visual Plan Focus</h3>
		<div class="card-detail" data-plan-focus-summary></div>
		<div data-plan-focus-cards></div>
		<div data-plan-focus-bindings></div>
	</section>
	<section class="panel" data-diff hidden>
		<h3>Diff Review</h3>
		<div class="card-actions">
			<button data-command="acceptAllDiffs" data-accept-all-diffs disabled>Accept all</button>
			<button class="secondary" data-command="rejectAllDiffs" data-reject-all-diffs disabled>Reject all</button>
			<button class="secondary" data-command="restoreTaskCheckpoint" data-restore-task disabled>Restore task checkpoint</button>
		</div>
		<div class="card-detail" data-task-checkpoint></div>
		<div data-diff-list></div>
	</section>
	<section class="panel" data-diff-review-status hidden>
		<h3>Diff Review Readiness</h3>
		<div class="card-detail" data-diff-review-status-summary></div>
		<div data-diff-review-status-cards></div>
		<div data-diff-review-status-files></div>
	</section>
	<section class="panel" data-diff-file-status hidden>
		<h3>Diff File Readiness</h3>
		<div class="card-detail" data-diff-file-status-summary></div>
		<div data-diff-file-status-cards></div>
		<div data-diff-file-status-siblings></div>
	</section>
	<section class="panel" data-diff-reapply-status hidden>
		<h3>Diff Reapply Readiness</h3>
		<div class="card-detail" data-diff-reapply-status-summary></div>
		<div data-diff-reapply-status-cards></div>
		<div data-diff-reapply-status-details></div>
	</section>
	<section class="panel" data-checkpoint-status hidden>
		<h3>Checkpoint Readiness</h3>
		<div class="card-detail" data-checkpoint-status-summary></div>
		<div data-checkpoint-status-cards></div>
		<div data-checkpoint-status-files></div>
	</section>
	<section class="panel" data-rollback-restore-status hidden>
		<h3>Rollback Restore Readiness</h3>
		<div class="card-detail" data-rollback-restore-summary></div>
		<div data-rollback-restore-cards></div>
		<div data-rollback-restore-files></div>
	</section>
	<section class="panel" data-terminal hidden>
		<h3>Terminal Evidence</h3>
		<div data-terminal-list></div>
	</section>
	<section class="panel" data-terminal-output-status hidden>
		<h3>Terminal Output Readiness</h3>
		<div class="card-detail" data-terminal-output-status-summary></div>
		<div data-terminal-output-status-cards></div>
	</section>
	<section class="panel" data-terminal-control-status hidden>
		<h3>Terminal Control Readiness</h3>
		<div class="card-detail" data-terminal-control-status-summary></div>
		<div data-terminal-control-status-cards></div>
	</section>
	<section class="panel" data-terminal-insights hidden>
		<h3>Terminal Insights</h3>
		<div data-terminal-insight-list></div>
	</section>
	<section class="panel" data-terminal-insight-status hidden>
		<h3>Terminal Insight Readiness</h3>
		<div class="card-detail" data-terminal-insight-status-summary></div>
		<div data-terminal-insight-status-cards></div>
		<div data-terminal-insight-status-list></div>
	</section>
	<section class="panel" data-terminal-remediation-status hidden>
		<h3>Terminal Remediation Readiness</h3>
		<div class="card-detail" data-terminal-remediation-status-summary></div>
		<div data-terminal-remediation-status-cards></div>
		<div data-terminal-remediation-status-list></div>
	</section>
	<section class="panel" data-diagnostics-evidence hidden>
		<h3>Diagnostics Evidence</h3>
		<div class="card-detail" data-diagnostics-summary></div>
		<div data-diagnostics-list></div>
	</section>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		let activePlan = undefined;
		let activePlanIdentity = undefined;
			let activeFlow = undefined;
			let lastValidFlow = undefined;
			let lastValidFlowTaskId = undefined;
			let lastPlanFocusEventKey = '';
			let planRevisionHistory = [];
		let mentionSuggestions = [];
		let slashCommandSuggestions = [];
		const approvals = new Map();
		const userInputRequests = new Map();
		const browserActions = new Map();
		const mcpActions = new Map();
		const webFetches = new Map();
		const hookActions = new Map();
		const terminalRuns = [];
		let terminalInsights = [];
		const diagnosticsEvidence = [];
		const promptInput = document.getElementById('prompt');
		const mentionPicker = document.querySelector('[data-mention-picker]');
		promptInput.addEventListener('input', renderMentionPicker);
		promptInput.addEventListener('focus', () => vscode.postMessage({ command: 'refreshMentions' }));
		promptInput.addEventListener('keydown', event => {
			if (mentionPicker.hidden) {
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				hideMentionPicker();
			}
			if (event.key === 'Tab' || event.key === 'Enter') {
				const first = mentionPicker.querySelector('[data-mention-insert]');
				if (first) {
					event.preventDefault();
					insertCompletion(first.dataset.mentionInsert);
				}
			}
		});
		for (const button of document.querySelectorAll('button[data-command]')) {
			button.addEventListener('click', () => {
				const command = button.dataset.command;
				if (command === 'startTask' || command === 'runTerminal' || command === 'queueTask') {
					vscode.postMessage({
						command,
						mode: document.getElementById('mode').value,
						prompt: promptInput.value
					});
					return;
				}
				if (command === 'refinePlan' || command === 'rejectPlan') {
					vscode.postMessage(Object.assign(planActionPayload(command), {
						command,
						feedback: document.querySelector('[data-plan-feedback]').value
					}));
					return;
				}
				if (command === 'approvePlan') {
					vscode.postMessage(planActionPayload(command));
					return;
				}
				vscode.postMessage({ command });
			});
		}
		window.addEventListener('message', event => {
			if (event.data?.type === 'status') {
				document.querySelector('[data-status]').textContent = event.data.text || '';
			}
			if (event.data?.type === 'backendStatus') {
				renderBackendStatus(event.data.status);
			}
			if (event.data?.type === 'plan') {
				activePlan = event.data.plan;
				activePlanIdentity = event.data.planIdentity;
				activeFlow = event.data.flow;
				renderPlan(activePlan, activeFlow);
			}
			if (event.data?.type === 'planRevisionHistory') {
				planRevisionHistory = event.data.history || [];
				renderPlanRevisionHistory(event.data.summary || '');
			}
			if (event.data?.type === 'planStatus') {
				renderPlanStatus(event.data);
			}
			if (event.data?.type === 'planCanvasStatus') {
				renderPlanCanvasStatus(event.data);
			}
			if (event.data?.type === 'planEditStatus') {
				renderPlanEditStatus(event.data);
			}
			if (event.data?.type === 'planFocusStatus') {
				renderPlanFocusStatus(event.data);
			}
			if (event.data?.type === 'planApproved') {
				document.querySelector('[data-approve]').disabled = true;
				document.querySelector('[data-refine]').disabled = true;
				document.querySelector('[data-reject]').disabled = true;
			}
			if (event.data?.type === 'planRefinementRequested') {
				document.querySelector('[data-approve]').disabled = true;
			}
			if (event.data?.type === 'planApprovalBlocked') {
				document.querySelector('[data-approve]').disabled = true;
				document.querySelector('[data-status]').textContent = 'Plan approval blocked: ' + ((event.data.validationErrors || []).join('; ') || 'validation failed');
			}
			if (event.data?.type === 'planRejected') {
				document.querySelector('[data-approve]').disabled = true;
			}
			if (event.data?.type === 'approval') {
				approvals.set(String(event.data.card.id), event.data.card);
				renderApprovals();
			}
			if (event.data?.type === 'approvalRemoved') {
				approvals.delete(String(event.data.id));
				renderApprovals();
			}
			if (event.data?.type === 'approvalStatus') {
				renderApprovalStatus(event.data);
			}
			if (event.data?.type === 'userInputRequest') {
				userInputRequests.set(String(event.data.request.id), event.data.request);
				renderUserInputRequests();
			}
				if (event.data?.type === 'userInputRequestRemoved') {
					userInputRequests.delete(String(event.data.id));
					renderUserInputRequests();
				}
				if (event.data?.type === 'userInputStatus') {
					renderUserInputStatus(event.data);
				}
				if (event.data?.type === 'browserAction') {
				browserActions.set(String(event.data.action.id), event.data.action);
				renderBrowserActions();
			}
			if (event.data?.type === 'browserActionRemoved') {
				browserActions.delete(String(event.data.id));
				renderBrowserActions();
			}
			if (event.data?.type === 'browserStatus') {
				renderBrowserStatus(event.data);
			}
			if (event.data?.type === 'browserActionStatus') {
				renderBrowserActionStatus(event.data);
			}
			if (event.data?.type === 'mcpAction') {
				mcpActions.set(String(event.data.action.id), event.data.action);
				renderMcpActions();
			}
			if (event.data?.type === 'mcpActionRemoved') {
				mcpActions.delete(String(event.data.id));
				renderMcpActions();
			}
			if (event.data?.type === 'webFetch') {
				webFetches.set(String(event.data.request.id), event.data.request);
				renderWebFetches();
			}
			if (event.data?.type === 'webFetchRemoved') {
				webFetches.delete(String(event.data.id));
				renderWebFetches();
			}
			if (event.data?.type === 'hookAction') {
				hookActions.set(String(event.data.action.id), event.data.action);
				renderHookActions();
			}
			if (event.data?.type === 'hookActionRemoved') {
				hookActions.delete(String(event.data.id));
				renderHookActions();
			}
			if (event.data?.type === 'diffReview') {
				renderDiffReview(event.data.review);
			}
			if (event.data?.type === 'diffReviewStatus') {
				renderDiffReviewStatus(event.data);
			}
			if (event.data?.type === 'diffFileStatus') {
				renderDiffFileStatus(event.data);
			}
			if (event.data?.type === 'diffReapplyStatus') {
				renderDiffReapplyStatus(event.data);
			}
			if (event.data?.type === 'taskCheckpoint') {
				renderTaskCheckpoint(event.data.checkpoint);
			}
			if (event.data?.type === 'checkpointStatus') {
				renderCheckpointStatus(event.data);
			}
			if (event.data?.type === 'rollbackRestoreStatus') {
				renderRollbackRestoreStatus(event.data);
			}
			if (event.data?.type === 'terminalRun') {
				const run = event.data.run;
				const index = terminalRuns.findIndex(candidate => candidate.id === run.id);
				if (index >= 0) {
					terminalRuns[index] = run;
				} else {
					terminalRuns.unshift(run);
				}
				renderTerminalRuns();
			}
			if (event.data?.type === 'terminalInsights') {
				terminalInsights = event.data.insights || [];
				renderTerminalInsights();
			}
			if (event.data?.type === 'terminalControlStatus') {
				renderTerminalControlStatus(event.data);
			}
			if (event.data?.type === 'terminalOutputStatus') {
				renderTerminalOutputStatus(event.data);
			}
			if (event.data?.type === 'terminalInsightStatus') {
				renderTerminalInsightStatus(event.data);
			}
			if (event.data?.type === 'terminalRemediationStatus') {
				renderTerminalRemediationStatus(event.data);
			}
			if (event.data?.type === 'terminalInsight') {
				const insight = event.data.insight;
				const index = terminalInsights.findIndex(candidate => candidate.runId === insight.runId);
				if (index >= 0) {
					terminalInsights[index] = insight;
				} else {
					terminalInsights.unshift(insight);
				}
				renderTerminalInsights();
			}
			if (event.data?.type === 'diagnosticsEvidence') {
				diagnosticsEvidence.unshift(event.data);
				renderDiagnosticsEvidence();
			}
			if (event.data?.type === 'contextPack') {
				renderContextPack(event.data);
			}
			if (event.data?.type === 'contextStatus') {
				renderContextStatus(event.data);
			}
			if (event.data?.type === 'workspaceReadStatus') {
				renderWorkspaceReadStatus(event.data);
			}
			if (event.data?.type === 'contextIndexStatus') {
				renderContextIndexStatus(event.data);
			}
			if (event.data?.type === 'symbolIndexStatus') {
				renderSymbolIndexStatus(event.data);
			}
			if (event.data?.type === 'docsContext') {
				renderDocsContext(event.data);
			}
			if (event.data?.type === 'inlinePromptSession') {
				renderInlinePromptSession(event.data.session);
			}
			if (event.data?.type === 'inlinePromptStatus') {
				renderInlinePromptStatus(event.data);
			}
			if (event.data?.type === 'mentionSuggestions') {
				mentionSuggestions = event.data.suggestions || [];
				renderMentionPicker();
			}
			if (event.data?.type === 'slashCommandSuggestions') {
				slashCommandSuggestions = event.data.suggestions || [];
				renderMentionPicker();
			}
			if (event.data?.type === 'providerConfig') {
				renderProviderConfig(event.data.provider);
			}
			if (event.data?.type === 'providerStatus') {
				renderProviderStatus(event.data);
			}
			if (event.data?.type === 'providerCatalog') {
				renderProviderCatalog(event.data);
			}
				if (event.data?.type === 'modePolicy') {
					renderModePolicy(event.data);
				}
				if (event.data?.type === 'modeStatus') {
					renderModeStatus(event.data);
				}
				if (event.data?.type === 'safetyStatus') {
					renderSafetyStatus(event.data);
				}
				if (event.data?.type === 'modeChanged') {
					const mode = document.getElementById('mode');
					if (mode && event.data.mode) {
						mode.value = event.data.mode;
					}
					if (event.data.summary) {
						document.querySelector('[data-status]').textContent = event.data.summary.split('\\n')[0];
					}
				}
				if (event.data?.type === 'commandPermissionPolicy') {
					renderCommandPermissions(event.data);
				}
				if (event.data?.type === 'terminalCommandValidationStatus') {
					renderTerminalCommandValidationStatus(event.data);
				}
			if (event.data?.type === 'workspaceSandboxStatus') {
				renderWorkspaceSandboxStatus(event.data);
			}
			if (event.data?.type === 'redactionStatus') {
				renderRedactionStatus(event.data);
			}
			if (event.data?.type === 'executionGateStatus') {
				renderExecutionGateStatus(event.data);
			}
			if (event.data?.type === 'actionApprovalStatus') {
				renderActionApprovalStatus(event.data);
			}
		if (event.data?.type === 'toolCatalog') {
			renderToolCatalog(event.data);
		}
			if (event.data?.type === 'capabilityMatrix') {
				renderCapabilityMatrix(event.data);
			}
			if (event.data?.type === 'toolSchemas') {
				renderToolSchemas(event.data);
			}
			if (event.data?.type === 'autoApproveState') {
				renderAutoApproveState(event.data);
			}
			if (event.data?.type === 'parallelPlan') {
				renderParallelPlan(event.data);
			}
			if (event.data?.type === 'parallelStatus') {
				renderParallelStatus(event.data);
			}
			if (event.data?.type === 'parallelReview') {
				renderParallelReview(event.data);
			}
			if (event.data?.type === 'parallelMergeStatus') {
				renderParallelMergeStatus(event.data);
				renderParallelMergeReadiness(event.data);
			}
			if (event.data?.type === 'parallelReviewStatus') {
				renderParallelReviewStatus(event.data);
			}
			if (event.data?.type === 'parallelWorktreeStatus') {
				renderParallelWorktreeStatus(event.data);
			}
			if (event.data?.type === 'parallelLaneExecutionStatus') {
				renderParallelLaneExecutionStatus(event.data);
			}
			if (event.data?.type === 'parallelDispatchPlan') {
				renderParallelDispatchPlanStatus(event.data);
			}
			if (event.data?.type === 'verificationPlan') {
				renderVerificationPlan(event.data);
			}
			if (event.data?.type === 'verificationStatus') {
				renderVerificationStatus(event.data);
			}
			if (event.data?.type === 'acceptanceCriteriaStatus') {
				renderAcceptanceCriteriaStatus(event.data);
			}
			if (event.data?.type === 'customModeCatalog') {
				renderCustomModes(event.data);
			}
			if (event.data?.type === 'deliveryBar') {
				renderDeliveryBar(event.data.state);
			}
			if (event.data?.type === 'deliveryBarStatus') {
				renderDeliveryBarStatus(event.data);
			}
			if (event.data?.type === 'smokeBenchmark') {
				renderSmokeBenchmark(event.data.state);
			}
			if (event.data?.type === 'smokeBenchmarkStatus') {
				renderSmokeBenchmarkStatus(event.data);
			}
			if (event.data?.type === 'workflowStatus') {
				renderWorkflowStatus(event.data.status);
			}
			if (event.data?.type === 'happyPathStatus') {
				renderHappyPathStatus(event.data);
			}
			if (event.data?.type === 'finalReview') {
				renderFinalReview(event.data.review);
			}
			if (event.data?.type === 'finalReviewStatus') {
				renderFinalReviewStatus(event.data);
			}
			if (event.data?.type === 'taskCompletionGate') {
				renderTaskCompletionGate(event.data);
			}
			if (event.data?.type === 'taskCompletionStatus') {
				renderTaskCompletionStatus(event.data);
			}
			if (event.data?.type === 'commitHandoff') {
				renderCommitHandoff(event.data.handoff);
			}
			if (event.data?.type === 'commitHandoffStatus') {
				renderCommitHandoffStatus(event.data);
			}
			if (event.data?.type === 'autoCommitStatus') {
				renderAutoCommitStatus(event.data);
			}
			if (event.data?.type === 'workspaceGuidance') {
				renderWorkspaceGuidance(event.data);
			}
			if (event.data?.type === 'guidanceStatus') {
				renderGuidanceStatus(event.data);
			}
			if (event.data?.type === 'ruleProposal') {
				renderRuleProposal(event.data);
			}
			if (event.data?.type === 'memoryBank') {
				renderMemoryBank(event.data);
			}
			if (event.data?.type === 'previewPlan') {
				renderPreviewPlan(event.data);
			}
			if (event.data?.type === 'previewStatus') {
				renderPreviewStatus(event.data);
			}
			if (event.data?.type === 'mcpCatalog') {
				renderMcpCatalog(event.data);
			}
			if (event.data?.type === 'mcpStatus') {
				renderMcpStatus(event.data);
			}
			if (event.data?.type === 'sessionHistory') {
				renderSessionHistory(event.data);
			}
			if (event.data?.type === 'sessionHistoryStatus') {
				renderSessionHistoryStatus(event.data);
			}
			if (event.data?.type === 'sessionExportStatus') {
				renderSessionExportStatus(event.data);
			}
			if (event.data?.type === 'chatTabs') {
				renderChatTabs(event.data);
			}
			if (event.data?.type === 'sessionRecall') {
				renderSessionRecall(event.data);
			}
			if (event.data?.type === 'chatReset') {
				clearActiveChatUi();
			}
			if (event.data?.type === 'taskBoard') {
				renderTaskBoard(event.data);
			}
				if (event.data?.type === 'taskBoardStatus') {
					renderTaskBoardStatus(event.data);
				}
				if (event.data?.type === 'taskStartStatus') {
					renderTaskStartStatus(event.data);
				}
				if (event.data?.type === 'externalIntakeStatus') {
					renderExternalIntakeStatus(event.data);
				}
				if (event.data?.type === 'connectorScheduleStatus') {
					renderConnectorScheduleStatus(event.data);
				}
			if (event.data?.type === 'sessionRestored') {
				restoreSessionInputs(event.data.session);
			}
			if (event.data?.type === 'transcript') {
				renderTranscript(event.data.events || []);
			}
			if (event.data?.type === 'taskSummary') {
				renderTaskSummary(event.data);
			}
				if (event.data?.type === 'toolTimelineStatus') {
					renderToolTimelineStatus(event.data);
				}
				if (event.data?.type === 'notificationStatus') {
					renderNotificationStatus(event.data);
				}
				if (event.data?.type === 'runtimeReadinessStatus') {
					renderRuntimeReadinessStatus(event.data);
				}
				if (event.data?.type === 'backendLaunchStatus') {
					renderBackendLaunchStatus(event.data);
				}
				if (event.data?.type === 'protocolStatus') {
					renderProtocolStatus(event.data);
				}
				if (event.data?.type === 'extensionInstallStatus') {
					renderExtensionInstallStatus(event.data);
				}
			if (event.data?.type === 'protocolDiagnostics') {
				renderProtocolDiagnostics(event.data.events || []);
			}
		});
		function renderTranscript(events) {
			const section = document.querySelector('[data-transcript]');
			const list = document.querySelector('[data-transcript-list]');
			section.hidden = events.length === 0;
			list.textContent = '';
			for (const event of events.slice(0, 18)) {
				const item = document.createElement('div');
				item.className = 'transcript-item ' + (event.status || 'completed');
				const meta = document.createElement('div');
				meta.className = 'transcript-meta';
				meta.textContent = event.kind + ' · ' + (event.status || 'completed') + ' · ' + new Date(event.timestamp).toLocaleTimeString();
				const title = document.createElement('div');
				title.className = 'transcript-title';
				title.textContent = event.title || '';
				item.appendChild(meta);
				item.appendChild(title);
				if (event.detail) {
					const detail = document.createElement('div');
					detail.className = 'transcript-detail';
					detail.textContent = String(event.detail).slice(0, 1200);
					item.appendChild(detail);
				}
				list.appendChild(item);
			}
		}
		function renderTaskSummary(message) {
			const response = message.response || {};
			const sectionNames = Array.isArray(response.sections) ? response.sections : [];
			const guardrailItems = Array.isArray(response.guardrails) ? response.guardrails : [];
			const section = document.querySelector('[data-task-summary]');
			const summary = document.querySelector('[data-task-summary-summary]');
			const cards = document.querySelector('[data-task-summary-cards]');
			const sections = document.querySelector('[data-task-summary-sections]');
			const markdown = document.querySelector('[data-task-summary-markdown]');
			const guardrails = document.querySelector('[data-task-summary-guardrails]');
			section.hidden = !response.ok;
			cards.textContent = '';
			sections.textContent = '';
			markdown.textContent = '';
			guardrails.textContent = '';
			if (!response.ok) {
				summary.textContent = '';
				return;
			}
			const generatedAt = response.generatedAt ? new Date(response.generatedAt).toLocaleTimeString() : 'unknown';
			summary.textContent = [
				message.summary || response.summary || '',
				'Purpose: ' + (response.purpose || 'Condense the active task.'),
				response.taskId ? 'Task: ' + response.taskId : undefined,
				response.sessionId ? 'Session: ' + response.sessionId : undefined,
				'Generated: ' + generatedAt,
				'Truncated: ' + String(Boolean(response.truncated))
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Cline Context Compaction', response.truncated ? 'truncated' : 'complete', [
				'Method: ' + (response.method || 'unknown'),
				'Mode: ' + (response.mode || 'unknown'),
				'Status: ' + (response.status || 'unknown'),
				'Max characters: ' + (response.maxChars ?? 'unknown'),
				'Markdown characters: ' + String(response.markdown ? String(response.markdown).length : 0)
			].join('\\n'), Boolean(response.truncated));
			addStatusCard(cards, 'Read-Only Handoff', 'safe', response.note || 'This summary is read-only handoff context and does not approve a plan or unlock mutation.', false);
			for (const name of sectionNames.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card-detail';
				item.textContent = name;
				sections.appendChild(item);
			}
			markdown.textContent = String(response.markdown || '').slice(0, 4000);
			if (guardrailItems.length) {
				addStatusCard(guardrails, 'Task Summary Guardrails', String(guardrailItems.length), guardrailItems.slice(0, 6).join('\\n'), false);
			}
		}
		function renderToolTimelineStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-tool-timeline-status]');
			const summary = document.querySelector('[data-tool-timeline-summary]');
			const live = document.querySelector('[data-tool-timeline-live]');
			const eventsList = document.querySelector('[data-tool-timeline-events]');
			const counts = status.counts || {};
			const liveState = status.liveState || {};
			const events = Array.isArray(status.events) ? status.events : [];
			const approvals = Array.isArray(liveState.approvals) ? liveState.approvals : [];
			const terminalRuns = Array.isArray(liveState.terminalRuns) ? liveState.terminalRuns : [];
			const diffReview = liveState.diffReview;
			section.hidden = !status.ok;
			live.textContent = '';
			eventsList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Events: ' + (counts.returnedEvents || 0) + '/' + (counts.timelineEvents || 0),
				'Approvals: ' + (counts.approvals || 0),
				'Running terminals: ' + (counts.runningTerminalRuns || 0),
				'Pending diff files: ' + (counts.pendingDiffFiles || 0)
			].filter(Boolean).join('\\n');
			const liveCards = [
				{
					title: 'Approvals',
					badge: String(counts.approvals || approvals.length || 0),
					blocked: (counts.blockedApprovals || 0) > 0 || (counts.approvals || approvals.length || 0) > 0,
					detail: approvals.length ? approvals.slice(0, 6).map(approval => [
						approval.title || approval.id,
						approval.kind,
						approval.risk ? 'risk=' + approval.risk : undefined,
						approval.blocked ? 'blocked' : undefined
					].filter(Boolean).join(' - ')).join('\\n') : 'No pending approval cards.'
				},
				{
					title: 'Terminal Runs',
					badge: String(counts.runningTerminalRuns || 0) + ' running',
					blocked: (counts.runningTerminalRuns || 0) > 0,
					detail: terminalRuns.length ? terminalRuns.slice(0, 6).map(run => [
						run.commandLine || run.id,
						run.status,
						run.exitCode !== undefined ? 'exit=' + run.exitCode : undefined
					].filter(Boolean).join(' - ')).join('\\n') : 'No captured terminal runs.'
				},
				{
					title: 'Diff Review',
					badge: String(counts.pendingDiffFiles || 0) + ' pending',
					blocked: (counts.pendingDiffFiles || 0) > 0,
					detail: diffReview ? [
						'Review: ' + diffReview.reviewId,
						'Files: ' + diffReview.files,
						'Pending: ' + diffReview.pending,
						'Accepted: ' + diffReview.accepted,
						'Rejected: ' + diffReview.rejected
					].join('\\n') : 'No active diff review.'
				}
			];
			for (const card of liveCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				live.appendChild(item);
			}
			for (const event of events.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = event.title || event.id || 'Tool event';
				const badge = document.createElement('span');
				badge.className = event.status === 'blocked' || event.status === 'failed' ? 'badge risk-blocked' : 'badge';
				badge.textContent = [event.kind, event.status].filter(Boolean).join(' - ');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : undefined,
					event.detail
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				eventsList.appendChild(item);
			}
		}
		function renderNotificationStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-notification-status]');
			const summary = document.querySelector('[data-notification-summary]');
			const cards = document.querySelector('[data-notification-cards]');
			const itemsList = document.querySelector('[data-notification-items]');
			const config = status.config || {};
			const counts = status.counts || {};
			const items = Array.isArray(status.items) ? status.items : [];
			const enabledChannels = Array.isArray(status.enabledChannels) ? status.enabledChannels : [];
			const disabledChannels = Array.isArray(status.disabledChannels) ? status.disabledChannels : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = !status.ok;
			cards.textContent = '';
			itemsList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Developer attention: ' + (counts.waitingOnDeveloper || 0),
				'Runtime waits: ' + (counts.waitingOnRuntime || 0),
				'Pending approvals: ' + (counts.pendingApprovals || 0),
				'Running terminals: ' + (counts.runningTerminalRuns || 0)
			].filter(Boolean).join('\\n');
			const overviewCards = [
				{
					title: 'Attention Queue',
					badge: String(counts.attentionItems || 0),
					blocked: (counts.waitingOnDeveloper || 0) > 0 || (counts.blockedApprovals || 0) > 0,
					detail: [
						'Returned: ' + (counts.returnedItems || 0),
						'Waiting on developer: ' + (counts.waitingOnDeveloper || 0),
						'Waiting on runtime: ' + (counts.waitingOnRuntime || 0),
						'Recent waiting events: ' + (counts.recentWaitingEvents || 0)
					].join('\\n')
				},
				{
					title: 'Pending Gates',
					badge: String((counts.pendingApprovals || 0) + (counts.pendingDiffFiles || 0)),
					blocked: (counts.pendingApprovals || 0) > 0 || (counts.pendingDiffFiles || 0) > 0,
					detail: [
						'Approvals: ' + (counts.pendingApprovals || 0),
						'Blocked approvals: ' + (counts.blockedApprovals || 0),
						'Diff files: ' + (counts.pendingDiffFiles || 0),
						'Running terminals: ' + (counts.runningTerminalRuns || 0)
					].join('\\n')
				},
				{
					title: 'Notification Channels',
					badge: String(enabledChannels.length) + ' enabled',
					blocked: false,
					detail: [
						'Enabled: ' + (enabledChannels.length ? enabledChannels.join(', ') : 'none'),
						'Disabled: ' + (disabledChannels.length ? disabledChannels.join(', ') : 'none'),
						'Approval notifications: ' + Boolean(config.approvals),
						'Terminal completion: ' + Boolean(config.terminalCompletion),
						'Long-running terminal: ' + (config.longRunningTerminalSeconds || 0) + 's'
					].join('\\n')
				},
				{
					title: 'Long-Running Terminals',
					badge: String(counts.scheduledLongRunningTerminalNotifications || 0) + ' scheduled',
					blocked: (counts.runningTerminalRuns || 0) > 0,
					detail: [
						'Delay ms: ' + (config.longRunningTerminalDelayMs || 0),
						'Scheduled: ' + (counts.scheduledLongRunningTerminalNotifications || 0),
						'Delivered: ' + (counts.deliveredLongRunningTerminalNotifications || 0)
					].join('\\n')
				}
			];
			for (const card of overviewCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const attention of items.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = attention.title || attention.id || 'Attention item';
				const badge = document.createElement('span');
				badge.className = attention.blocked || attention.status === 'blocked' ? 'badge risk-blocked' : 'badge';
				badge.textContent = [attention.owner, attention.kind, attention.status].filter(Boolean).join(' - ');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					attention.requestedAt ? new Date(attention.requestedAt).toLocaleTimeString() : undefined,
					attention.risk ? 'Risk: ' + attention.risk : undefined,
					attention.detail
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				itemsList.appendChild(item);
			}
			if (guardrails.length) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'Attention Guardrails';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = String(guardrails.length);
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = guardrails.slice(0, 5).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				itemsList.appendChild(item);
			}
		}
		function renderRuntimeReadinessStatus(message) {
			const status = message.status || {};
			const provider = status.provider || {};
			const backend = status.backend || {};
			const protocol = status.protocol || {};
			const counts = status.counts || {};
			const gates = Array.isArray(status.gates) ? status.gates : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const warnings = Array.isArray(status.warnings) ? status.warnings : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-runtime-readiness-status]');
			const summary = document.querySelector('[data-runtime-readiness-summary]');
			const cards = document.querySelector('[data-runtime-readiness-cards]');
			const gateList = document.querySelector('[data-runtime-readiness-gates]');
			section.hidden = !status.ok && gates.length === 0;
			cards.textContent = '';
			gateList.textContent = '';
			if (section.hidden) {
				summary.textContent = '';
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Route: ' + (status.route || 'unknown'),
				'Ready for Plan Mode: ' + String(Boolean(status.ready)),
				'Mutation locked: ' + String(Boolean(status.mutationLocked)),
				'Gates: ' + (counts.passed ?? 0) + '/' + (counts.gates ?? gates.length) + ' passed',
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Startup Route', status.ready ? 'ready_for_plan' : (status.route || 'blocked'), [
				'Ready: ' + String(Boolean(status.ready)),
				'Mutation locked: ' + String(Boolean(status.mutationLocked)),
				'Pending gates: ' + (counts.pending ?? 0),
				'Failed gates: ' + (counts.failed ?? 0),
				'Missing gates: ' + (counts.missing ?? 0)
			].join('\\n'), !status.ready);
			addStatusCard(cards, 'Provider / Model', provider.ready ? 'ready' : 'blocked', [
				provider.label || provider.provider || 'Provider has not been inspected.',
				provider.model ? 'Model: ' + provider.model : 'Model: provider default',
				provider.local ? 'Local/open-source capable' : undefined,
				provider.openAiCompatible ? 'OpenAI-compatible API' : undefined,
				provider.apiKeyConfigured ? 'Credentials: configured via ' + (provider.apiKeyStorage || 'configured') : 'Credentials: not configured or not required'
			].filter(Boolean).join('\\n'), provider.ready === false);
			addStatusCard(cards, 'Backend Bridge', backend.connected ? 'connected' : backend.launchReady ? 'launch-ready' : 'blocked', [
				'Transport: ' + (backend.selectedTransport || 'unknown'),
				'Framing: ' + (backend.framing || 'unknown'),
				'Launch ready: ' + String(Boolean(backend.launchReady)),
				'Connected: ' + String(Boolean(backend.connected)),
				backend.bridgeState ? 'State: ' + backend.bridgeState : undefined
			].filter(Boolean).join('\\n'), !backend.launchReady || !backend.connected);
			addStatusCard(cards, 'Protocol / Handshake', protocol.available && protocol.handshakeReady && protocol.backendAccepted ? 'ready' : 'blocked', [
				'Available: ' + String(Boolean(protocol.available)),
				'Health: ' + (protocol.health || 'unknown'),
				'Handshake: ' + (protocol.handshake || 'unknown'),
				'Transport ready: ' + String(Boolean(protocol.transportReady)),
				'Handshake ready: ' + String(Boolean(protocol.handshakeReady)),
				'Backend accepted: ' + String(Boolean(protocol.backendAccepted)),
				'Errors: ' + (protocol.errors ?? 0),
				'Pending requests: ' + (protocol.pendingRequests ?? 0)
			].join('\\n'), !protocol.available || !protocol.handshakeReady || !protocol.backendAccepted || (protocol.errors ?? 0) > 0);
			if (blockers.length) {
				addStatusCard(cards, 'Runtime Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			if (warnings.length) {
				addStatusCard(cards, 'Runtime Warnings', String(warnings.length), warnings.slice(0, 6).join('\\n'), false);
			}
			if (guardrails.length) {
				addStatusCard(cards, 'Read-Only Runtime Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n'), false);
			}
			for (const gate of gates.slice(0, 8)) {
				addStatusCard(gateList, gate.title || gate.id || 'Runtime gate', gate.status || 'unknown', gate.detail || '', gate.status !== 'passed');
			}
		}
		function renderBackendLaunchStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-backend-launch-status]');
			const summary = document.querySelector('[data-backend-launch-status-summary]');
			const cards = document.querySelector('[data-backend-launch-status-cards]');
			const routesList = document.querySelector('[data-backend-launch-status-routes]');
			const selectedRoute = status.selectedRoute || {};
			const routes = Array.isArray(status.routes) ? status.routes : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const warnings = Array.isArray(status.warnings) ? status.warnings : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = !status.ok;
			cards.textContent = '';
			routesList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Selected: ' + (status.selectedTransport || 'unknown') + '/' + (status.framing || 'unknown'),
				'Bridge: ' + (status.connected ? 'connected' : (status.bridgeState || 'unavailable')),
				'Handshake: ' + (status.handshake || 'unknown'),
				status.nextAction
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Selected Backend Route', status.ready ? 'ready' : 'blocked', [
				'Transport: ' + (selectedRoute.transport || status.selectedTransport || 'unknown'),
				'Mode: ' + (selectedRoute.mode || 'unknown'),
				selectedRoute.endpoint ? 'Endpoint: ' + selectedRoute.endpoint : undefined,
				selectedRoute.detail,
				blockers.length ? 'Blockers:\\n' + blockers.join('\\n') : 'No launch blockers.',
				warnings.length ? 'Warnings:\\n' + warnings.join('\\n') : undefined
			].filter(Boolean).join('\\n'), Boolean(status.blocked));
			addStatusCard(cards, 'Bridge Runtime State', status.connected ? 'connected' : 'not connected', [
				'State: ' + (status.bridgeState || 'unavailable'),
				'Handshake: ' + (status.handshake || 'unknown'),
				'Ready to connect: ' + String(Boolean(status.ready)),
				'Prompt block: ' + (status.promptBlock ? 'available to backend' : 'not requested')
			].join('\\n'), !status.ready);
			if (guardrails.length) {
				addStatusCard(cards, 'Read-Only Launch Guardrails', String(guardrails.length), guardrails.slice(0, 6).join('\\n'), false);
			}
			for (const route of routes.slice(0, 3)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = (route.selected ? 'Selected ' : '') + String(route.transport || 'route');
				const badge = document.createElement('span');
				badge.className = route.ready ? 'badge' : 'badge risk-blocked';
				badge.textContent = route.ready ? 'ready' : 'blocked';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				const routeBlockers = Array.isArray(route.blockers) ? route.blockers : [];
				const routeWarnings = Array.isArray(route.warnings) ? route.warnings : [];
				detail.textContent = [
					'Mode: ' + (route.mode || 'unknown'),
					route.endpoint ? 'Endpoint: ' + route.endpoint : undefined,
					route.detail,
					routeBlockers.length ? 'Blockers:\\n' + routeBlockers.join('\\n') : 'No configuration blockers.',
					routeWarnings.length ? 'Warnings:\\n' + routeWarnings.join('\\n') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				routesList.appendChild(item);
			}
		}
		function renderExtensionInstallStatus(message) {
			const status = message.status || {};
			const manifest = status.manifest || {};
			const counts = status.counts || {};
			const features = Array.isArray(status.features) ? status.features : [];
			const activationEvents = Array.isArray(status.activationEvents) ? status.activationEvents : [];
			const commands = Array.isArray(status.commands) ? status.commands : [];
			const configurationKeys = Array.isArray(status.configurationKeys) ? status.configurationKeys : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const warnings = Array.isArray(status.warnings) ? status.warnings : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-extension-install-status]');
			const summary = document.querySelector('[data-extension-install-summary]');
			const cards = document.querySelector('[data-extension-install-cards]');
			const list = document.querySelector('[data-extension-install-features]');
			section.hidden = !status.ok && features.length === 0;
			cards.textContent = '';
			list.textContent = '';
			if (section.hidden) {
				summary.textContent = '';
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'State: ' + (status.state || 'unknown'),
				manifest.extensionId ? 'Extension: ' + manifest.extensionId : undefined,
				manifest.version ? 'Version: ' + manifest.version : undefined,
				manifest.installCommand ? 'Install: ' + manifest.installCommand : undefined,
				status.nextAction
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'VSIX Manifest', status.ready ? 'ready' : (status.state || 'blocked'), [
				'Publisher/name: ' + [manifest.publisher, manifest.name].filter(Boolean).join('.') || 'unknown',
				'Display: ' + (manifest.displayName || 'unknown'),
				'Main: ' + (manifest.main || 'unknown'),
				'Extension kind: ' + ((manifest.extensionKind || []).join(', ') || 'unknown'),
				'Mode: ' + (manifest.extensionMode || 'unknown'),
				'URI: ' + (manifest.extensionUri || 'unknown')
			].join('\\n'), !status.ready);
			addStatusCard(cards, 'Activation / Commands / Config', String(counts.readyFeatures ?? 0) + '/' + String(counts.features ?? 0), [
				'Activation events: ' + (counts.activationEvents ?? activationEvents.length),
				'Commands: ' + (counts.commands ?? commands.length),
				'Configuration keys: ' + (counts.configurationKeys ?? configurationKeys.length),
				blockers.length ? 'Blockers:\\n' + blockers.slice(0, 8).join('\\n') : 'No install blockers.',
				warnings.length ? 'Warnings:\\n' + warnings.slice(0, 6).join('\\n') : undefined
			].filter(Boolean).join('\\n'), blockers.length > 0);
			if (activationEvents.length) {
				addStatusCard(cards, 'Activation Routes', String(activationEvents.length), activationEvents.slice(0, 18).join('\\n'), false);
			}
			if (commands.length) {
				addStatusCard(cards, 'Command Surface', String(commands.length), commands.slice(0, 18).join('\\n'), false);
			}
			if (configurationKeys.length) {
				addStatusCard(cards, 'Configuration Surface', String(configurationKeys.length), configurationKeys.slice(0, 18).join('\\n'), false);
			}
			if (guardrails.length) {
				addStatusCard(cards, 'Read-Only Install Guardrails', String(guardrails.length), guardrails.slice(0, 6).join('\\n'), false);
			}
			for (const feature of features.slice(0, 14)) {
				addStatusCard(list, feature.title || feature.id || 'Install feature', feature.ready ? 'ready' : 'blocked', feature.detail || '', !feature.ready);
			}
		}
		function renderProtocolStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-protocol-status]');
			const summary = document.querySelector('[data-protocol-status-summary]');
			const cards = document.querySelector('[data-protocol-status-cards]');
			const eventsList = document.querySelector('[data-protocol-status-events]');
			const counts = status.counts || {};
				const health = status.health || {};
				const handshakeCapabilities = status.handshakeCapabilities || {};
				const handshakeGroups = Array.isArray(handshakeCapabilities.groups) ? handshakeCapabilities.groups : [];
				const handshakeCoverage = handshakeCapabilities.coverage || {};
				const handshakeGuardrails = Array.isArray(handshakeCapabilities.guardrails) ? handshakeCapabilities.guardrails : [];
				const transportReadiness = status.transportReadiness || {};
			const transportRoutes = Array.isArray(transportReadiness.routes) ? transportReadiness.routes : [];
			const transportGuardrails = Array.isArray(transportReadiness.guardrails) ? transportReadiness.guardrails : [];
			const methods = Array.isArray(status.methods) ? status.methods : [];
			const events = Array.isArray(status.events) ? status.events : [];
			section.hidden = !status.ok;
			cards.textContent = '';
			eventsList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Bridge: ' + (status.bridgeAvailable ? 'available' : 'unavailable'),
					'Health: ' + (health.state || 'unknown'),
					'Handshake: ' + (health.handshake || 'unknown'),
					handshakeCapabilities.client ? 'Handshake capabilities: ' + (handshakeCapabilities.advertisedCapabilities ?? 0) + ' advertised, backend ' + (handshakeCapabilities.backendAccepted ? 'accepted' : (handshakeCapabilities.backendHandshake || 'unknown')) : undefined,
					handshakeCoverage.totalCapabilities !== undefined ? 'Handshake contract: ' + (handshakeCoverage.complete ? 'complete' : 'needs attention') + ' (' + (handshakeCoverage.groupedCapabilities ?? 0) + '/' + (handshakeCoverage.totalCapabilities ?? 0) + ' grouped)' : undefined,
					'Transport: ' + (health.transport || transportReadiness.selectedTransport || 'unknown') + '/' + (health.framing || transportReadiness.framing || 'unknown'),
					transportReadiness.selectedTransport ? 'Configured route: ' + transportReadiness.selectedTransport + ' - ' + (transportReadiness.ready ? 'ready' : 'blocked') : undefined
			].filter(Boolean).join('\\n');
			const healthCards = [
				{
					title: 'Bridge Health',
					badge: health.state || 'unknown',
					blocked: !status.bridgeAvailable || health.stale || health.state === 'error',
					detail: [
						'Pending requests: ' + (counts.pendingRequests || 0),
						health.oldestPendingMs !== undefined ? 'Oldest pending: ' + health.oldestPendingMs + 'ms' : undefined,
						health.lastMessageAt ? 'Last message: ' + new Date(health.lastMessageAt).toLocaleTimeString() : undefined,
						health.lastSendAt ? 'Last send: ' + new Date(health.lastSendAt).toLocaleTimeString() : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Event Counts',
					badge: String(counts.totalEvents || 0),
					blocked: (counts.error || 0) > 0,
					detail: [
						'Returned: ' + (counts.returnedEvents || 0),
						'In: ' + (counts.in || 0),
						'Out: ' + (counts.out || 0),
						'Status: ' + (counts.status || 0),
						'Errors: ' + (counts.error || 0)
					].join('\\n')
				},
				{
					title: 'Methods',
					badge: String(methods.length),
					blocked: false,
					detail: methods.length ? methods.slice(0, 16).join('\\n') : 'No JSON-RPC methods recorded yet.'
				}
			];
			for (const card of healthCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			if (handshakeCapabilities.client) {
				addStatusCard(cards, 'Bridge Handshake Capabilities', handshakeCapabilities.backendAccepted ? 'accepted' : (handshakeCapabilities.backendHandshake || 'unknown'), [
					'Client: ' + handshakeCapabilities.client + ' v' + (handshakeCapabilities.version || 1),
					'Advertised capabilities: ' + (handshakeCapabilities.advertisedCapabilities ?? 0),
					'Supported transports: ' + (Array.isArray(handshakeCapabilities.supportedTransports) ? handshakeCapabilities.supportedTransports.join(', ') : 'stdio, pipe, websocket'),
					'Required groups: ' + (Array.isArray(handshakeCapabilities.requiredCapabilities) ? handshakeCapabilities.requiredCapabilities.join(', ') : 'unknown'),
						Array.isArray(handshakeCapabilities.missingRequired) && handshakeCapabilities.missingRequired.length ? 'Missing required: ' + handshakeCapabilities.missingRequired.join(', ') : 'Required capability groups are advertised.'
					].filter(Boolean).join('\\n'), !handshakeCapabilities.ready || handshakeCapabilities.backendHandshake === 'failed');
					if (handshakeCoverage.totalCapabilities !== undefined) {
						addStatusCard(cards, 'Handshake Contract Coverage', handshakeCoverage.complete ? 'complete' : 'partial', [
							'Advertised capabilities: ' + (handshakeCoverage.totalCapabilities ?? 0),
							'Grouped capabilities: ' + (handshakeCoverage.groupedCapabilities ?? 0),
							'Critical groups: ' + (handshakeCoverage.criticalGroupCount ?? 0),
							'Optional groups: ' + (handshakeCoverage.optionalGroupCount ?? 0),
							'Route samples: ' + (handshakeCoverage.methodCount ?? 0),
							Array.isArray(handshakeCoverage.ungroupedCapabilities) && handshakeCoverage.ungroupedCapabilities.length ? 'Ungrouped:\\n' + handshakeCoverage.ungroupedCapabilities.slice(0, 8).join('\\n') : 'No ungrouped capabilities.',
							Array.isArray(handshakeCoverage.duplicateCapabilities) && handshakeCoverage.duplicateCapabilities.length ? 'Duplicates:\\n' + handshakeCoverage.duplicateCapabilities.slice(0, 8).join('\\n') : undefined,
							Array.isArray(handshakeCoverage.unknownGroupedCapabilities) && handshakeCoverage.unknownGroupedCapabilities.length ? 'Unknown grouped:\\n' + handshakeCoverage.unknownGroupedCapabilities.slice(0, 8).join('\\n') : undefined
						].filter(Boolean).join('\\n'), !handshakeCoverage.complete);
					}
					for (const group of handshakeGroups.slice(0, 8)) {
						addStatusCard(cards, String(group.title || group.id || 'Handshake Group'), group.critical ? 'required' : 'optional', [
						'Group id: ' + (group.id || 'unknown'),
						'Advertised capabilities: ' + (group.advertisedCapabilities ?? 0),
						'Available: ' + String(Boolean(group.available)),
						Array.isArray(group.methods) && group.methods.length ? 'Routes:\\n' + group.methods.slice(0, 8).join('\\n') : undefined
					].filter(Boolean).join('\\n'), Boolean(group.critical) && !group.available);
				}
				if (handshakeGuardrails.length) {
					addStatusCard(cards, 'Read-Only Handshake Guardrails', String(handshakeGuardrails.length), handshakeGuardrails.slice(0, 6).join('\\n'), false);
				}
			}
			if (transportReadiness.selectedTransport) {
				addStatusCard(cards, 'Bridge Transport Readiness', transportReadiness.ready ? 'ready' : 'blocked', [
					'Selected: ' + transportReadiness.selectedTransport,
					'Framing: ' + (transportReadiness.framing || 'unknown'),
					'Supported: ' + (Array.isArray(transportReadiness.supportedTransports) ? transportReadiness.supportedTransports.join(', ') : 'stdio, pipe, websocket'),
					Array.isArray(transportReadiness.blockers) && transportReadiness.blockers.length ? 'Blockers:\\n' + transportReadiness.blockers.join('\\n') : 'Selected transport configuration is ready.'
				].filter(Boolean).join('\\n'), !transportReadiness.ready);
				for (const route of transportRoutes.slice(0, 3)) {
					addStatusCard(cards, (route.selected ? 'Selected ' : '') + String(route.transport || 'transport') + ' Route', route.ready ? 'ready' : 'blocked', [
						route.endpoint ? 'Endpoint: ' + route.endpoint : undefined,
						route.detail,
						Array.isArray(route.blockers) && route.blockers.length ? 'Blockers:\\n' + route.blockers.join('\\n') : 'No configuration blockers.'
					].filter(Boolean).join('\\n'), !route.ready || (route.selected && !route.ready));
				}
				if (transportGuardrails.length) {
					addStatusCard(cards, 'Read-Only Transport Guardrails', String(transportGuardrails.length), transportGuardrails.slice(0, 6).join('\\n'), false);
				}
			}
			for (const event of events.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = event.label || event.method || event.id || 'Protocol event';
				const badge = document.createElement('span');
				badge.className = event.direction === 'error' ? 'badge risk-blocked' : 'badge';
				badge.textContent = event.direction || 'event';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : undefined,
					event.method ? 'Method: ' + event.method : undefined,
					event.payloadPreview !== undefined ? 'Payload preview: ' + (typeof event.payloadPreview === 'string' ? event.payloadPreview : JSON.stringify(event.payloadPreview, null, 2)) : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				eventsList.appendChild(item);
			}
		}
		function renderProtocolDiagnostics(events) {
			const section = document.querySelector('[data-protocol]');
			const list = document.querySelector('[data-protocol-list]');
			section.hidden = events.length === 0;
			list.textContent = '';
			for (const event of events.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = event.direction + ' · ' + event.label;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = new Date(event.timestamp).toLocaleTimeString();
				title.appendChild(badge);
				const detail = document.createElement('pre');
				detail.className = 'diff-code';
				detail.textContent = event.payload ? JSON.stringify(event.payload, null, 2) : '';
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderBackendStatus(status) {
			const section = document.querySelector('[data-backend]');
			const detail = document.querySelector('[data-backend-status]');
			section.hidden = !status;
			if (!status) {
				detail.textContent = '';
				return;
			}
			detail.textContent = [
				status.state ? 'State: ' + status.state : undefined,
				status.label,
				status.detail,
				status.transport ? 'Transport: ' + status.transport : undefined,
				status.framing ? 'Framing: ' + status.framing : undefined,
				status.handshake ? 'Handshake: ' + status.handshake : undefined,
				typeof status.pendingRequests === 'number' ? 'Pending requests: ' + status.pendingRequests : undefined,
				status.health?.state ? 'Health: ' + status.health.state : undefined,
				status.health?.oldestPendingMs !== undefined ? 'Oldest pending: ' + Math.round(status.health.oldestPendingMs / 1000) + 's' : undefined,
				status.health?.lastMessageAt ? 'Last message: ' + new Date(status.health.lastMessageAt).toLocaleTimeString() : undefined,
				status.health?.lastSendAt ? 'Last send: ' + new Date(status.health.lastSendAt).toLocaleTimeString() : undefined
			].filter(Boolean).join('\\n');
		}
		function renderMentionPicker() {
			const active = activeCompletionQuery();
			mentionPicker.textContent = '';
			if (!active) {
				hideMentionPicker();
				return;
			}
			const query = active.query.toLowerCase();
			const candidates = active.kind === 'slash' ? slashCommandSuggestions : mentionSuggestions;
			const matches = candidates
				.filter(item => {
					const label = String(item.label || '').toLowerCase();
					const insert = String(item.insertText || '').toLowerCase();
					return !query || label.includes(query) || insert.includes(query);
				})
				.slice(0, 8);
			if (!matches.length) {
				hideMentionPicker();
				return;
			}
			for (const suggestion of matches) {
				const item = document.createElement('button');
				item.type = 'button';
				item.className = 'mention-item';
				item.dataset.mentionInsert = suggestion.insertText;
				item.textContent = suggestion.label;
				const detail = document.createElement('span');
				detail.className = 'mention-detail';
				detail.textContent = suggestion.kind + ' · ' + suggestion.detail;
				item.appendChild(detail);
				item.addEventListener('click', () => insertCompletion(suggestion.insertText));
				mentionPicker.appendChild(item);
			}
			mentionPicker.hidden = false;
		}
		function activeCompletionQuery() {
			const cursor = promptInput.selectionStart ?? promptInput.value.length;
			const before = promptInput.value.slice(0, cursor);
			const match = before.match(/(^|\\s)@([^\\s@]*)$/);
			if (match) {
				return {
					kind: 'mention',
					start: cursor - match[2].length - 1,
					end: cursor,
					query: match[2] || ''
				};
			}
			const lineStart = before.lastIndexOf('\\n') + 1;
			const line = before.slice(lineStart);
			const slash = line.match(/^\\/([^\\s/]*)$/);
			if (slash) {
				return {
					kind: 'slash',
					start: lineStart,
					end: cursor,
					query: slash[1] || ''
				};
			}
			return undefined;
		}
		function insertCompletion(insertText) {
			const active = activeCompletionQuery();
			if (!active || !insertText) {
				return;
			}
			const before = promptInput.value.slice(0, active.start);
			const after = promptInput.value.slice(active.end);
			promptInput.value = before + insertText + ' ' + after;
			const cursor = before.length + insertText.length + 1;
			promptInput.setSelectionRange(cursor, cursor);
			promptInput.focus();
			hideMentionPicker();
		}
		function hideMentionPicker() {
			mentionPicker.hidden = true;
			mentionPicker.textContent = '';
		}
		function renderChatTabs(message) {
			const section = document.querySelector('[data-chat-tabs]');
			const summary = document.querySelector('[data-chat-tabs-summary]');
			const list = document.querySelector('[data-chat-tabs-list]');
			const tabs = message.state?.tabs || [];
			section.hidden = tabs.length === 0;
			summary.textContent = message.summary || '';
			list.textContent = '';
			for (const tab of tabs) {
				const item = document.createElement('button');
				item.type = 'button';
				item.className = 'chat-tab' + (tab.active ? ' active' : '');
				item.dataset.sessionId = tab.id;
				item.textContent = tab.title || 'Untitled chat';
				const meta = document.createElement('div');
				meta.className = 'chat-tab-meta';
				meta.textContent = [
					tab.mode + ' · ' + tab.status,
					new Date(tab.updatedAt).toLocaleString(),
					tab.taskId ? tab.taskId + ' r' + tab.revision : undefined
				].filter(Boolean).join(' · ');
				item.appendChild(meta);
				item.addEventListener('click', () => vscode.postMessage({ command: 'restoreSession', sessionId: tab.id }));
				list.appendChild(item);
			}
			const actions = document.createElement('div');
			actions.className = 'card-actions';
			const newChat = document.createElement('button');
			newChat.textContent = 'New chat';
			newChat.addEventListener('click', () => vscode.postMessage({ command: 'newChatSession' }));
			const exportActive = document.createElement('button');
			exportActive.className = 'secondary';
			exportActive.textContent = 'Export active';
			const active = tabs.find(tab => tab.active);
			exportActive.disabled = !active;
			exportActive.addEventListener('click', () => {
				if (active) {
					vscode.postMessage({ command: 'exportSession', sessionId: active.id });
				}
			});
			actions.appendChild(newChat);
			actions.appendChild(exportActive);
			list.appendChild(actions);
		}
		function clearActiveChatUi() {
			promptInput.value = '';
			activePlan = undefined;
			activeFlow = undefined;
			lastValidFlow = undefined;
			lastValidFlowTaskId = undefined;
			planRevisionHistory = [];
			approvals.clear();
			userInputRequests.clear();
			browserActions.clear();
			mcpActions.clear();
			webFetches.clear();
			hookActions.clear();
			terminalRuns.splice(0, terminalRuns.length);
			terminalInsights = [];
			diagnosticsEvidence.splice(0, diagnosticsEvidence.length);
			for (const selector of [
				'[data-plan]',
				'[data-task-summary]',
				'[data-plan-status]',
				'[data-plan-edit-status]',
				'[data-plan-focus-status]',
				'[data-task-board-status]',
				'[data-task-start-status]',
				'[data-external-intake-status]',
				'[data-connector-schedule-status]',
					'[data-approvals]',
					'[data-approval-status]',
					'[data-user-input]',
					'[data-user-input-status]',
					'[data-browser-actions]',
				'[data-browser-action-status]',
				'[data-mcp-actions]',
				'[data-web-fetches]',
				'[data-hook-actions]',
				'[data-diff]',
				'[data-terminal]',
				'[data-terminal-output-status]',
				'[data-terminal-control-status]',
				'[data-terminal-command-validation-status]',
				'[data-action-approval-status]',
				'[data-terminal-insights]',
				'[data-terminal-insight-status]',
				'[data-terminal-remediation-status]',
				'[data-diagnostics-evidence]',
				'[data-context-status]',
				'[data-workspace-read-status]',
				'[data-context-index-status]',
				'[data-symbol-index-status]',
				'[data-diff-review-status]',
				'[data-diff-file-status]',
				'[data-diff-reapply-status]',
				'[data-checkpoint-status]',
				'[data-rollback-restore-status]',
				'[data-inline-prompt]',
				'[data-inline-prompt-status]',
				'[data-parallel-worktree-status]',
				'[data-parallel-lane-execution-status]',
				'[data-parallel-dispatch-plan-status]',
				'[data-parallel-status]',
				'[data-parallel-review-status]',
				'[data-parallel-merge-status]',
				'[data-verification-status]',
				'[data-acceptance-criteria-status]',
				'[data-delivery-bar-status]',
				'[data-task-completion-status]',
				'[data-rule-proposal]',
				'[data-session-recall]',
				'[data-session-history-status]',
				'[data-session-export-status]',
				'[data-docs-context]',
				'[data-final-review]',
				'[data-final-review-status]',
				'[data-task-completion-gate]',
				'[data-workflow-status]',
				'[data-commit-handoff]',
				'[data-commit-handoff-status]',
				'[data-auto-commit-status]',
				'[data-guidance-status]',
				'[data-preview-status]'
			]) {
				const element = document.querySelector(selector);
				if (element) {
					element.hidden = true;
				}
			}
			document.querySelector('[data-flow]').textContent = '';
			document.querySelector('[data-steps]').textContent = '';
			document.querySelector('[data-diff-list]').textContent = '';
			document.querySelector('[data-task-checkpoint]').textContent = '';
			document.querySelector('[data-approve]').disabled = true;
			document.querySelector('[data-refine]').disabled = true;
			document.querySelector('[data-reject]').disabled = true;
			renderTranscript([]);
			renderPlanRevisionHistory('');
			renderTaskCheckpoint(undefined);
		}
		function renderSessionHistory(message) {
			const section = document.querySelector('[data-history]');
			const list = document.querySelector('[data-history-list]');
			section.hidden = !message.history?.length;
			list.textContent = '';
			for (const session of (message.history || []).slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = session.mode + ' · ' + new Date(session.updatedAt).toLocaleString();
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = session.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = (session.prompt || '').slice(0, 220);
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const restore = document.createElement('button');
				restore.textContent = 'Restore';
				restore.addEventListener('click', () => vscode.postMessage({ command: 'restoreSession', sessionId: session.id }));
				const exportButton = document.createElement('button');
				exportButton.className = 'secondary';
				exportButton.textContent = 'Export';
				exportButton.addEventListener('click', () => vscode.postMessage({ command: 'exportSession', sessionId: session.id }));
				actions.appendChild(restore);
				actions.appendChild(exportButton);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderSessionHistoryStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const tabs = Array.isArray(status.tabs) ? status.tabs : [];
			const sessions = Array.isArray(status.sessions) ? status.sessions : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-session-history-status]');
			const summary = document.querySelector('[data-session-history-status-summary]');
			const cards = document.querySelector('[data-session-history-status-cards]');
			const list = document.querySelector('[data-session-history-status-list]');
			section.hidden = false;
			cards.textContent = '';
			list.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Sessions: ' + (counts.sessions ?? sessions.length),
				'Returned: ' + (counts.returnedSessions ?? sessions.length),
				'Tabs: ' + (counts.tabs ?? tabs.length),
				'Active sessions: ' + (counts.activeSessions ?? 0),
				'Transcript events: ' + (counts.transcriptEvents ?? 0),
				'Completed: ' + (counts.completed ?? 0),
				'Blocked/error: ' + ((counts.blocked ?? 0) + (counts.error ?? 0))
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Chat Tabs', String(counts.tabs ?? tabs.length), tabs.length ? tabs.slice(0, 8).map(tab => [
				(tab.active ? '* ' : '') + (tab.title || tab.promptPreview || tab.id || 'session'),
				tab.status ? 'Status: ' + tab.status : undefined,
				tab.mode ? 'Mode: ' + tab.mode : undefined,
				tab.revision !== undefined ? 'Plan r' + tab.revision : undefined
			].filter(Boolean).join('\\n')).join('\\n\\n') : 'No chat tabs are available yet.', tabs.length === 0);
			addStatusCard(cards, 'Session Continuity Counts', String(counts.sessions ?? sessions.length), [
				'Planning: ' + (counts.planning ?? 0),
				'Approved: ' + (counts.approved ?? 0),
				'Terminal: ' + (counts.terminal ?? 0),
				'Diff review: ' + (counts.diffReview ?? 0),
				'Rollback: ' + (counts.rollback ?? 0),
				'Completed: ' + (counts.completed ?? 0),
				'Blocked: ' + (counts.blocked ?? 0),
				'Error: ' + (counts.error ?? 0)
			].join('\\n'), false);
			addStatusCard(cards, 'Read-Only Session Guardrails', String(guardrails.length), guardrails.length ? guardrails.slice(0, 6).join('\\n') : 'Session history status is read-only and never restores, exports, deletes, or treats old plans as approval.', false);
			for (const session of sessions.slice(0, 8)) {
				addStatusCard(list, (session.active ? 'Active · ' : '') + (session.mode || 'session') + ' · ' + (session.status || 'unknown'), session.active ? 'active' : (session.status || 'stored'), [
					session.promptPreview,
					session.planSummary ? 'Plan: ' + session.planSummary : undefined,
					session.taskId ? 'Task: ' + session.taskId : undefined,
					session.revision !== undefined ? 'Revision: ' + session.revision : undefined,
					session.provider ? 'Provider: ' + [session.provider.label, session.provider.model, session.provider.modelSource].filter(Boolean).join(' / ') : undefined,
					'Transcript events: ' + (session.transcriptEventCount ?? 0),
					'Evidence: ' + (session.evidenceCount ?? 0),
					'Plan revisions: ' + (session.planRevisionCount ?? 0),
					session.lastEvent ? 'Last event: ' + session.lastEvent.kind + '/' + session.lastEvent.status + ' · ' + session.lastEvent.title : undefined,
					Array.isArray(session.transcriptTail) && session.transcriptTail.length ? 'Transcript tail: ' + session.transcriptTail.map(event => event.kind + '/' + event.status + ': ' + event.title).join('\\n') : undefined
				].filter(Boolean).join('\\n'), false);
			}
		}
		function renderSessionExportStatus(message) {
			const response = message.response || {};
			const counts = response.counts || {};
			const guardrails = Array.isArray(response.guardrails) ? response.guardrails : [];
			const section = document.querySelector('[data-session-export-status]');
			const summary = document.querySelector('[data-session-export-summary]');
			const cards = document.querySelector('[data-session-export-cards]');
			const preview = document.querySelector('[data-session-export-preview]');
			const guardrailList = document.querySelector('[data-session-export-guardrails]');
			section.hidden = !response;
			cards.textContent = '';
			preview.textContent = '';
			guardrailList.textContent = '';
			if (!response) {
				summary.textContent = '';
				return;
			}
			const markdown = typeof response.markdown === 'string' ? response.markdown : '';
			summary.textContent = [
				message.summary || response.message || '',
				response.ok ? 'Export: ready' : 'Export: unavailable',
				response.sessionId ? 'Session: ' + response.sessionId : undefined,
				response.activeSessionId ? 'Active session: ' + response.activeSessionId : undefined,
				'Selected active: ' + String(Boolean(response.selectedActive)),
				'Returned chars: ' + (counts.returnedChars ?? markdown.length) + '/' + (counts.markdownChars ?? markdown.length),
				'Truncated: ' + String(Boolean(response.truncated)),
				'Sessions available: ' + (counts.sessions ?? 0)
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Session Export Result', response.ok ? 'ready' : 'blocked', [
				response.message,
				'Max chars: ' + (response.maxChars ?? 0),
				'Generated: ' + (response.generatedAt ? new Date(response.generatedAt).toLocaleString() : 'unknown')
			].filter(Boolean).join('\\n'), !response.ok);
			addStatusCard(cards, 'Export Contents', String(counts.returnedChars ?? markdown.length), [
				'Transcript events: ' + (counts.transcriptEvents ?? 0),
				'Evidence items: ' + (counts.evidenceItems ?? 0),
				'Plan revisions: ' + (counts.planRevisions ?? 0),
				'Markdown chars: ' + (counts.markdownChars ?? markdown.length),
				'Returned chars: ' + (counts.returnedChars ?? markdown.length),
				response.truncated ? 'Client cap truncated the Markdown.' : 'Markdown returned within cap.'
			].join('\\n'), false);
			if (markdown) {
				preview.textContent = markdown.length > 4000 ? markdown.slice(0, 4000).trimEnd() + '\\n\\n[Sidebar preview truncated]' : markdown;
			}
			addStatusCard(guardrailList, 'Read-Only Session Export Guardrails', String(guardrails.length), guardrails.length ? guardrails.slice(0, 6).join('\\n') : 'Session export is read-only and never restores sessions, deletes history, approves old plans, or mutates files.', false);
		}
		function renderSessionRecall(message) {
			const section = document.querySelector('[data-session-recall]');
			const summary = document.querySelector('[data-session-recall-summary]');
			const list = document.querySelector('[data-session-recall-list]');
			const recall = message.recall;
			const entries = recall?.entries || [];
			section.hidden = entries.length === 0;
			summary.textContent = message.summary || '';
			list.textContent = '';
			for (const entry of entries.slice(0, 6)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = entry.mode + ' · ' + new Date(entry.updatedAt).toLocaleString();
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = entry.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					entry.prompt,
					entry.planSummary ? 'Plan: ' + entry.planSummary : undefined,
					entry.matchedTerms?.length ? 'Matched: ' + entry.matchedTerms.join(', ') : undefined,
					entry.files?.length ? 'Files: ' + entry.files.join(', ') : undefined,
					entry.finalReview ? 'Final review: ' + entry.finalReview : undefined,
					entry.evidence?.length ? 'Evidence:\\n' + entry.evidence.slice(0, 3).join('\\n') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderTaskBoard(message) {
			const section = document.querySelector('[data-task-board]');
			const summary = document.querySelector('[data-task-board-summary]');
			const list = document.querySelector('[data-task-board-list]');
			const cards = (message.board?.cards || []).filter(card => card.status !== 'archived');
			section.hidden = cards.length === 0;
			summary.textContent = message.summary || '';
			list.textContent = '';
			for (const card of cards.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.status === 'blocked' ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.mode + ' · ' + card.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					card.prompt,
					card.source ? 'Source: ' + card.source : undefined,
					card.dependsOn?.length ? 'Depends on: ' + card.dependsOn.join(', ') : undefined,
					card.parallelThreads > 1 ? 'Parallel lanes: ' + card.parallelThreads : undefined,
					card.branchName ? 'Branch: ' + card.branchName : undefined,
					card.worktreePath ? 'Worktree: ' + card.worktreePath : undefined,
					card.evidence?.length ? 'Evidence:\\n' + card.evidence.slice(0, 4).join('\\n') : undefined
				].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const start = document.createElement('button');
				start.textContent = 'Start';
				start.disabled = !(card.status === 'ready' || card.status === 'queued');
				start.addEventListener('click', () => vscode.postMessage({ command: 'startTaskBoardCard', id: card.id }));
				const complete = document.createElement('button');
				complete.className = 'secondary';
				complete.textContent = 'Complete';
				complete.disabled = card.status === 'completed';
				complete.addEventListener('click', () => vscode.postMessage({ command: 'setTaskBoardStatus', id: card.id, status: 'completed' }));
				const block = document.createElement('button');
				block.className = 'secondary';
				block.textContent = 'Block';
				block.disabled = card.status === 'blocked';
				block.addEventListener('click', () => vscode.postMessage({ command: 'setTaskBoardStatus', id: card.id, status: 'blocked' }));
				const queueAfter = document.createElement('button');
				queueAfter.className = 'secondary';
				queueAfter.textContent = 'Queue after';
				queueAfter.addEventListener('click', () => vscode.postMessage({
					command: 'queueTaskAfter',
					id: card.id,
					mode: document.getElementById('mode').value,
					prompt: promptInput.value
				}));
				const archive = document.createElement('button');
				archive.className = 'secondary';
				archive.textContent = 'Archive';
				archive.addEventListener('click', () => vscode.postMessage({ command: 'archiveTaskBoardCard', id: card.id }));
				actions.appendChild(start);
				actions.appendChild(complete);
				actions.appendChild(block);
				actions.appendChild(queueAfter);
				actions.appendChild(archive);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderTaskBoardStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-task-board-status]');
			const summary = document.querySelector('[data-task-board-status-summary]');
			const cards = document.querySelector('[data-task-board-status-cards]');
			const list = document.querySelector('[data-task-board-status-list]');
			section.hidden = !status || (status.cards || []).length === 0;
			cards.textContent = '';
			list.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			const intake = status.intake || {};
			const sourceCounts = status.sourceCounts || {};
			summary.textContent = [
				message.summary || status.message || '',
				'Ready/queued/running/blocked: ' + (counts.ready ?? 0) + '/' + (counts.queued ?? 0) + '/' + (counts.running ?? 0) + '/' + (counts.blocked ?? 0),
				'External/delegated intake: ' + (intake.external ?? 0) + '/' + (intake.delegated ?? 0),
				status.nextReadyCard ? 'Next ready: ' + status.nextReadyCard.id + ' - ' + status.nextReadyCard.title : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Queue State', String((status.cards || []).length), [
				'Ready ids: ' + ((status.readyCardIds || []).join(', ') || 'none'),
				'Running ids: ' + ((status.runningCardIds || []).join(', ') || 'none'),
				'Blocked ids: ' + ((status.blockedCardIds || []).join(', ') || 'none'),
				'Completed: ' + (counts.completed ?? 0),
				'Archived visible: ' + (counts.archived ?? 0)
			].join('\\n'), (counts.blocked || 0) > 0);
			addStatusCard(cards, 'Intake Sources', String(intake.total ?? 0), [
				'URI: ' + (sourceCounts.uri ?? 0),
				'Connector: ' + (sourceCounts.connector ?? 0),
				'Scheduled: ' + (sourceCounts.scheduled ?? 0),
				'Headless: ' + (sourceCounts.headless ?? 0),
				'Delegated: ' + (sourceCounts.delegated ?? 0),
				'Sidebar: ' + (sourceCounts.sidebar ?? 0)
			].join('\\n'), false);
			addStatusCard(cards, 'Task Board Guardrails', String((status.guardrails || []).length), (status.guardrails || []).slice(0, 4).join('\\n'), false);
				for (const card of (status.cards || []).slice(0, 12)) {
					addStatusCard(list, card.title || card.id, (card.ready ? 'ready' : 'blocked') + ' - ' + card.status, [
						'Mode: ' + card.mode,
						'Source: ' + card.source,
					'Parallel lanes: ' + (card.parallelThreads || 1),
					card.dependsOn?.length ? 'Depends on: ' + card.dependsOn.join(', ') : undefined,
					card.blockers?.length ? 'Blockers: ' + card.blockers.join('; ') : undefined,
					card.promptPreview
					].filter(Boolean).join('\\n'), !card.ready || card.status === 'blocked');
				}
			}
			function renderTaskStartStatus(message) {
				const status = message.status || {};
				const section = document.querySelector('[data-task-start-status]');
				const summary = document.querySelector('[data-task-start-status-summary]');
				const cards = document.querySelector('[data-task-start-status-cards]');
				const readiness = status.readiness || {};
				const selected = status.selectedCard;
				const nextReady = status.nextReadyCard;
				section.hidden = !status.readiness && !selected && !nextReady;
				cards.textContent = '';
				summary.textContent = [
					message.summary || status.message || '',
					'Route: ' + (readiness.route || 'unknown'),
					'Start allowed: ' + String(Boolean(readiness.startAllowed)),
					nextReady ? 'Next ready: ' + nextReady.id + ' - ' + nextReady.title : undefined
				].filter(Boolean).join('\\n');
				addStatusCard(cards, 'Planning Start Gate', readiness.startAllowed ? 'ready' : (readiness.route || 'blocked'), [
					'Begins Plan only: ' + String(readiness.beginsPlanOnly !== false),
					'Requires visual plan approval: ' + String(readiness.requiresVisualPlanApproval !== false),
					'Mutation locked: ' + String(readiness.mutationLocked !== false),
					readiness.nextAction ? 'Next action: ' + readiness.nextAction : undefined,
					Array.isArray(readiness.blockers) && readiness.blockers.length ? 'Blockers:\\n' + readiness.blockers.join('\\n') : 'No start blockers.'
				].filter(Boolean).join('\\n'), !readiness.startAllowed);
				if (selected) {
					addStatusCard(cards, selected.title || selected.id, selected.status || 'selected', [
						'Card id: ' + selected.id,
						'Mode: ' + selected.mode,
						'Source: ' + selected.source,
						'Parallel lanes: ' + (selected.parallelThreads || 1),
						Array.isArray(selected.dependsOn) && selected.dependsOn.length ? 'Depends on: ' + selected.dependsOn.join(', ') : undefined,
						selected.promptPreview
					].filter(Boolean).join('\\n'), !readiness.startAllowed);
				}
				if (status.planningHandoff) {
					addStatusCard(cards, 'Planning Handoff', status.planningHandoff.command || 'startTaskBoardCard', [
						'Card id: ' + status.planningHandoff.cardId,
						'Mode: ' + status.planningHandoff.mode,
						'Parallel lanes: ' + (status.planningHandoff.parallelThreads || 1),
						'Source: ' + status.planningHandoff.source
					].filter(Boolean).join('\\n'), false);
				}
				if (Array.isArray(status.guardrails) && status.guardrails.length) {
					addStatusCard(cards, 'Task Start Guardrails', String(status.guardrails.length), status.guardrails.slice(0, 5).join('\\n'), false);
				}
			}
			function renderExternalIntakeStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-external-intake-status]');
			const summary = document.querySelector('[data-external-intake-summary]');
			const counts = document.querySelector('[data-external-intake-counts]');
			const routes = document.querySelector('[data-external-intake-routes]');
			const queue = status.queue || {};
			const intake = queue.intake || {};
			const triggers = Array.isArray(status.triggers) ? status.triggers : [];
			section.hidden = !status.enabled && !triggers.length;
			counts.textContent = '';
			routes.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Limits: ' + ((status.limits?.minParallelThreads ?? 1) + '-' + (status.limits?.maxParallelThreads ?? 8)) + ' lanes',
				status.limits?.startRequestBeginsPlanOnly ? 'start=true opens Plan Mode only' : undefined,
				status.entrypoints?.authorities?.length ? 'Authorities: ' + status.entrypoints.authorities.join(', ') : undefined
			].filter(Boolean).join('\\n');
			const countCard = document.createElement('div');
			countCard.className = 'card';
			const countTitle = document.createElement('div');
			countTitle.className = 'card-title';
			countTitle.textContent = 'Queued Intake';
			const countBadge = document.createElement('span');
			countBadge.className = intake.total ? 'badge risk-blocked' : 'badge';
			countBadge.textContent = String(intake.total ?? 0);
			countTitle.appendChild(countBadge);
			const countDetail = document.createElement('div');
			countDetail.className = 'card-detail';
			countDetail.textContent = [
				'External: ' + (intake.external ?? 0),
				'Delegated: ' + (intake.delegated ?? 0),
				'URI: ' + (intake.uri ?? 0),
				'Connector: ' + (intake.connector ?? 0),
				'Scheduled: ' + (intake.scheduled ?? 0),
				'Headless: ' + (intake.headless ?? 0),
				(queue.readyCardIds || []).length ? 'Ready: ' + queue.readyCardIds.join(', ') : undefined,
				(queue.runningCardIds || []).length ? 'Running: ' + queue.runningCardIds.join(', ') : undefined,
				(queue.blockedCardIds || []).length ? 'Blocked: ' + queue.blockedCardIds.join(', ') : undefined
			].filter(Boolean).join('\\n');
			countCard.appendChild(countTitle);
			countCard.appendChild(countDetail);
			counts.appendChild(countCard);
			for (const trigger of triggers.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = trigger.label || trigger.triggerKind;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = trigger.triggerKind || 'intake';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					trigger.startBehavior,
					trigger.routes?.length ? 'Routes: ' + trigger.routes.join(', ') : undefined,
					trigger.aliases?.length ? 'Aliases: ' + trigger.aliases.join(', ') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				routes.appendChild(item);
			}
		}
		function renderConnectorScheduleStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-connector-schedule-status]');
			const summary = document.querySelector('[data-connector-schedule-summary]');
			const counts = document.querySelector('[data-connector-schedule-counts]');
			const routes = document.querySelector('[data-connector-schedule-routes]');
			const cards = document.querySelector('[data-connector-schedule-cards]');
			const queue = status.queue || {};
			const routeList = Array.isArray(status.routes) ? status.routes : [];
			const channelGroups = Array.isArray(status.channelGroups) ? status.channelGroups : [];
			section.hidden = !status.enabled && !routeList.length;
			counts.textContent = '';
			routes.textContent = '';
			cards.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.family ? 'Family: ' + status.family : undefined,
				channelGroups.length ? 'Channels: ' + channelGroups.map(group => group.label + ' (' + (group.channels || []).join(', ') + ')').join('; ') : undefined,
				status.nextAction
			].filter(Boolean).join('\\n');
			const countCard = document.createElement('div');
			countCard.className = 'card';
			const countTitle = document.createElement('div');
			countTitle.className = 'card-title';
			countTitle.textContent = 'Connector Queue';
			const countBadge = document.createElement('span');
			countBadge.className = queue.total ? 'badge risk-blocked' : 'badge';
			countBadge.textContent = String(queue.total ?? 0);
			countTitle.appendChild(countBadge);
			const countDetail = document.createElement('div');
			countDetail.className = 'card-detail';
			countDetail.textContent = [
				'Connector: ' + (queue.connector ?? 0),
				'Scheduled: ' + (queue.scheduled ?? 0),
				'Headless: ' + (queue.headless ?? 0),
				'Returned cards: ' + (queue.returnedCards ?? 0),
				(queue.readyCardIds || []).length ? 'Ready: ' + queue.readyCardIds.join(', ') : undefined,
				(queue.runningCardIds || []).length ? 'Running: ' + queue.runningCardIds.join(', ') : undefined,
				(queue.blockedCardIds || []).length ? 'Blocked: ' + queue.blockedCardIds.join(', ') : undefined
			].filter(Boolean).join('\\n');
			countCard.appendChild(countTitle);
			countCard.appendChild(countDetail);
			counts.appendChild(countCard);
			for (const route of routeList.slice(0, 6)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = route.label || route.family;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = route.family || 'intake';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					route.startBehavior,
					route.controllerBoundary,
					(route.routes || []).length ? 'Routes: ' + route.routes.join(', ') : undefined,
					(route.aliases || []).length ? 'Aliases: ' + route.aliases.join(', ') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				routes.appendChild(item);
			}
			for (const card of (queue.cards || []).slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title || card.id;
				const badge = document.createElement('span');
				badge.className = card.ready ? 'badge risk-ok' : card.status === 'blocked' ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.source + ' / ' + card.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					'Mode: ' + (card.mode || 'agent'),
					'Parallel lanes: ' + (card.parallelThreads || 1),
					(card.dependsOn || []).length ? 'Depends on: ' + card.dependsOn.join(', ') : undefined,
					(card.blockers || []).length ? 'Blockers: ' + card.blockers.join('; ') : undefined,
					card.promptPreview
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			if (Array.isArray(status.guardrails) && status.guardrails.length) {
				addStatusCard(cards, 'Connector Guardrails', String(status.guardrails.length), status.guardrails.slice(0, 5).join('\\n'), false);
			}
		}
		function restoreSessionInputs(session) {
			document.getElementById('mode').value = session.mode || 'agent';
			document.getElementById('prompt').value = session.prompt || '';
			if (session.plan) {
				renderPlan(session.plan, activeFlow);
			}
			if (session.planRevisionHistory) {
				planRevisionHistory = session.planRevisionHistory;
				renderPlanRevisionHistory('');
			}
			if (session.modePolicy) {
				renderModePolicy({ summary: '', policy: session.modePolicy });
			}
			if (session.commandPermissionPolicy) {
				renderCommandPermissions({ summary: '', policy: session.commandPermissionPolicy });
			}
			renderInlinePromptSession(session.inlinePromptSession);
			if (session.verificationPlan) {
				renderVerificationPlan({ summary: '', plan: session.verificationPlan });
			}
			if (session.customModeCatalog) {
				renderCustomModes({ summary: '', catalog: session.customModeCatalog });
			}
			renderSessionRecall({ summary: '', recall: session.sessionRecall });
			renderDocsContext({ summary: '', context: session.docsContext });
			if (session.workspaceGuidance) {
				renderWorkspaceGuidance({ summary: '', guidance: session.workspaceGuidance });
			}
			renderRuleProposal({ summary: '', proposal: session.ruleProposal });
			if (session.memoryBank) {
				renderMemoryBank({ summary: '', memoryBank: session.memoryBank });
			}
			if (session.previewPlan) {
				renderPreviewPlan({ summary: '', plan: session.previewPlan });
			}
			if (session.mcpCatalog) {
				renderMcpCatalog({ summary: '', catalog: session.mcpCatalog });
			}
			renderTranscript(session.transcript || []);
		}
		function renderProviderConfig(provider) {
			const section = document.querySelector('[data-provider]');
			const summary = document.querySelector('[data-provider-summary]');
			section.hidden = false;
			const codexConfig = provider.codexConfig || {};
			const codexProviders = Array.isArray(codexConfig.modelProviders) ? codexConfig.modelProviders : [];
			const lines = [
				provider.label || provider.provider,
				provider.mode ? 'Mode route: ' + provider.mode : undefined,
				provider.model ? 'Model: ' + provider.model : undefined,
				provider.modelRouting?.source ? 'Model source: ' + provider.modelRouting.source : undefined,
				provider.modelRouting?.modeModel ? 'Mode override: ' + provider.modelRouting.modeModel : undefined,
				provider.baseUrl ? 'Base URL: ' + provider.baseUrl : undefined,
				provider.apiKeyConfigured ? 'Credential source: ' + (provider.apiKeyStorage || 'configured') : 'Credentials: not configured',
				codexConfig.found ? 'Codex config: ' + (codexConfig.configPath || '~/.codex/config.toml') : 'Codex config: not found',
				codexConfig.authJsonPresent ? 'Codex auth: available' : undefined,
				codexConfig.modelProvider ? 'Codex provider: ' + codexConfig.modelProvider : undefined,
				codexConfig.approvalPolicy ? 'Approval policy: ' + codexConfig.approvalPolicy : undefined,
				codexConfig.sandboxMode ? 'Sandbox: ' + codexConfig.sandboxMode : undefined,
				typeof codexConfig.networkAccess === 'boolean' ? 'Network in workspace-write: ' + String(codexConfig.networkAccess) : undefined,
				codexConfig.projectTrust ? 'Project trust: ' + codexConfig.projectTrust : undefined,
				codexProviders.length ? 'Codex model providers: ' + codexProviders.map(provider => provider.id + (provider.envKeyConfigured ? ' (env ready)' : '')).join(', ') : undefined
			].filter(Boolean);
			summary.textContent = lines.join('\\n');
		}
		function renderProviderStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-provider-status]');
			const summary = document.querySelector('[data-provider-status-summary]');
			const cards = document.querySelector('[data-provider-status-cards]');
			const modeRoutes = document.querySelector('[data-provider-mode-routes]');
			const codexConfig = status.codexConfig || {};
			const routing = status.modelRouting || {};
			const routes = Array.isArray(status.modeRoutes) ? status.modeRoutes : [];
			const routeCounts = status.counts || {};
			section.hidden = false;
			cards.textContent = '';
			modeRoutes.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Provider: ' + (status.label || status.provider || 'unknown'),
				status.mode ? 'Mode route: ' + status.mode : undefined,
				status.model ? 'Model: ' + status.model : undefined,
				status.modelSource ? 'Model source: ' + status.modelSource : undefined,
				status.baseUrl ? 'Base URL: ' + status.baseUrl : 'Base URL: provider default',
				status.apiKeyConfigured ? 'Credentials: configured' : 'Credentials: not configured',
				status.apiKeyStorage ? 'Credential source: ' + status.apiKeyStorage : undefined,
				codexConfig.found ? 'Codex config: ' + (codexConfig.configPath || '~/.codex/config.toml') : 'Codex config: not found',
				routes.length ? 'Mode routes: ' + routes.length + ' · overrides: ' + (routeCounts.modeOverrides ?? routes.filter(route => route.modelSource === 'modeModels').length) : undefined
			].filter(Boolean).join('\\n');
			const statusCards = [
				{
					title: 'Selected Provider',
					badge: status.ok ? (status.provider || 'ready') : 'missing',
					blocked: !status.ok,
					detail: [
						status.label || status.provider || 'No provider status is available yet.',
						status.model ? 'Model: ' + status.model : 'Model: provider default',
						status.mode ? 'Mode: ' + status.mode : undefined,
						status.baseUrl ? 'Base URL: ' + status.baseUrl : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Credentials',
					badge: status.apiKeyConfigured ? 'configured' : 'not configured',
					blocked: !status.ok,
					detail: [
						'Storage: ' + (status.apiKeyStorage || 'none'),
						'Raw API keys are never posted to the webview.',
						codexConfig.authJsonPresent ? 'Codex auth: available' : undefined,
						codexConfig.envKeyCount !== undefined ? 'Configured env keys: ' + codexConfig.envKeyCount : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Model Routing',
					badge: status.modelSource || routing.source || 'unknown',
					blocked: !status.ok,
					detail: [
						routing.mode ? 'Mode: ' + routing.mode : undefined,
						routing.modeModel ? 'Mode override: ' + routing.modeModel : undefined,
						routing.globalModel ? 'Global model: ' + routing.globalModel : undefined,
						routing.effectiveModel ? 'Effective model: ' + routing.effectiveModel : undefined
					].filter(Boolean).join('\\n') || 'Provider default routing.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			if (routes.length) {
				addStatusCard(modeRoutes, 'Provider Mode Routing Matrix', String(routes.length), [
					'Mode overrides: ' + (routeCounts.modeOverrides ?? routes.filter(route => route.modelSource === 'modeModels').length),
					'Credential-ready routes: ' + (routeCounts.credentialReadyRoutes ?? routes.filter(route => route.apiKeyConfigured).length),
					'Base URL-ready routes: ' + (routeCounts.baseUrlReadyRoutes ?? routes.filter(route => route.baseUrl).length),
					'Plan/Ask/Review can use reasoning models while Act/Agent/Debug use faster local or OpenAI-compatible routes.'
				].join('\\n'), false);
				for (const route of routes.slice(0, 8)) {
					addStatusCard(modeRoutes, route.mode ? route.mode + ' Mode' : 'Mode route', route.modelSource || 'unspecified', [
						'Provider: ' + (route.label || route.provider || 'unknown'),
						route.model ? 'Model: ' + route.model : 'Model: provider default',
						route.modelRouting?.modeModel ? 'Mode override: ' + route.modelRouting.modeModel : undefined,
						route.modelRouting?.globalModel ? 'Global model: ' + route.modelRouting.globalModel : undefined,
						route.baseUrl ? 'Base URL: ' + route.baseUrl : 'Base URL: provider default',
						route.apiKeyConfigured ? 'Credentials: configured via ' + (route.apiKeyStorage || 'configured') : 'Credentials: not configured'
					].filter(Boolean).join('\\n'), !route.model && route.modelSource === 'unspecified');
				}
				const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
				if (guardrails.length) {
					addStatusCard(modeRoutes, 'Read-Only Provider Routing Guardrails', String(guardrails.length), guardrails.slice(0, 6).join('\\n'), false);
				}
			}
		}
		function renderProviderCatalog(message) {
			const catalog = message.catalog || {};
			const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
			const counts = catalog.counts || {};
			const selected = catalog.selected || {};
			const section = document.querySelector('[data-provider-catalog]');
			const summary = document.querySelector('[data-provider-catalog-summary]');
			const cards = document.querySelector('[data-provider-catalog-cards]');
			const list = document.querySelector('[data-provider-catalog-list]');
			section.hidden = false;
			cards.textContent = '';
			list.textContent = '';
			summary.textContent = [
				message.summary || catalog.message || '',
				'Providers: ' + (counts.total ?? providers.length),
				'OpenAI-compatible: ' + (counts.openAiCompatible ?? providers.filter(provider => provider.openAiCompatible).length),
				'Local: ' + (counts.local ?? providers.filter(provider => provider.local).length),
				'API-key recommended: ' + (counts.apiKeyRecommended ?? providers.filter(provider => provider.apiKeyRecommended).length),
				'Base URL required: ' + (counts.baseUrlRequired ?? providers.filter(provider => provider.baseUrlRequired).length),
				selected.label ? 'Selected: ' + selected.label + (selected.model ? ' / ' + selected.model : '') : undefined,
				selected.apiKeyConfigured !== undefined ? 'Selected credentials: ' + (selected.apiKeyConfigured ? 'configured' : 'not configured') : undefined
			].filter(Boolean).join('\\n');
			const guardrails = Array.isArray(catalog.guardrails) ? catalog.guardrails : [];
			const catalogCards = [
				{
					title: 'Catalog Coverage',
					badge: String(counts.total ?? providers.length),
					blocked: providers.length === 0,
					detail: [
						'OpenAI-compatible: ' + (counts.openAiCompatible ?? 0),
						'Local/open-source: ' + (counts.local ?? 0),
						'Custom base URL capable: ' + providers.filter(provider => provider.defaultBaseUrl || provider.baseUrlRequired || provider.id === 'custom').length
					].join('\\n')
				},
				{
					title: 'Selected Readiness',
					badge: selected.provider || 'none',
					blocked: !selected.provider,
					detail: [
						selected.label || 'No selected provider yet.',
						selected.model ? 'Model: ' + selected.model : 'Model: provider default',
						selected.baseUrl ? 'Base URL: ' + selected.baseUrl : undefined,
						selected.apiKeyStorage ? 'Credential source: ' + selected.apiKeyStorage : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Provider catalog is read-only.'
				}
			];
			for (const card of catalogCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const provider of providers.slice(0, 24)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = provider.label || provider.id || 'Provider';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = provider.local ? 'local' : provider.openAiCompatible ? 'openai-compatible' : 'native';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					provider.description,
					provider.defaultModel ? 'Default model: ' + provider.defaultModel : undefined,
					provider.defaultBaseUrl ? 'Default base URL: ' + provider.defaultBaseUrl : undefined,
					provider.apiKeyRecommended ? 'API key recommended' : 'API key optional',
					provider.baseUrlRequired ? 'Base URL required' : 'Base URL optional',
					provider.openAiCompatible ? 'OpenAI-compatible API' : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderModePolicy(message) {
			const section = document.querySelector('[data-mode-policy]');
			const summary = document.querySelector('[data-mode-policy-summary]');
			const policy = message.policy || {};
			section.hidden = false;
			summary.textContent = [
				message.summary || '',
				policy.readOnly ? 'Read-only: yes' : 'Read-only: no',
				Array.isArray(policy.allowedActions) && policy.allowedActions.length ? 'Allowed after approval: ' + policy.allowedActions.join(', ') : undefined,
				Array.isArray(policy.blockedActions) && policy.blockedActions.length ? 'Blocked: ' + policy.blockedActions.join(', ') : undefined
			].filter(Boolean).join('\\n');
		}
		function renderModeStatus(message) {
			const status = message.status || {};
			const current = status.current || {};
			const authorization = status.authorization || {};
			const modes = Array.isArray(status.modes) ? status.modes : [];
			const section = document.querySelector('[data-mode-status]');
			const summary = document.querySelector('[data-mode-status-summary]');
			const cards = document.querySelector('[data-mode-status-cards]');
			const list = document.querySelector('[data-mode-status-modes]');
			section.hidden = !status.ok;
			cards.textContent = '';
			list.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Current: ' + (current.label || current.mode || 'unknown') + (current.readOnly ? ' (read-only)' : ' (execution-capable)'),
				'Plan authorization: ' + (authorization.activePlanMatches ? 'matches active plan' : authorization.approved ? 'stale/mismatched' : 'not approved'),
				status.nextAction
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Current Mode', current.readOnly ? 'read-only' : 'execution', [
				current.description,
				current.requiresVisualPlan ? 'Visual plan required' : 'Visual plan optional',
				current.requiresPlanApproval ? 'Exact plan approval required for mutation' : 'Plan approval not required for mutation',
				current.allowedActions?.length ? 'Allowed: ' + current.allowedActions.join(', ') : 'No mutating actions allowed',
				current.blockedActions?.length ? 'Blocked: ' + current.blockedActions.join(', ') : undefined
			].filter(Boolean).join('\\n'), Boolean(current.readOnly));
			addStatusCard(cards, 'Authorization', authorization.activePlanMatches ? 'ready' : 'locked', [
				authorization.summary,
				authorization.taskId ? 'Task: ' + authorization.taskId + ' r' + authorization.revision : undefined,
				authorization.planHash ? 'Plan hash: ' + authorization.planHash : undefined
			].filter(Boolean).join('\\n'), !authorization.activePlanMatches && Boolean(current.requiresPlanApproval));
			for (const mode of modes.slice(0, 8)) {
				addStatusCard(list, mode.label || mode.mode, mode.readOnly ? 'read-only' : 'execution', [
					mode.description,
					mode.allowedActions?.length ? 'Allowed: ' + mode.allowedActions.join(', ') : 'No mutating actions',
					mode.blockedActions?.length ? 'Blocked: ' + mode.blockedActions.join(', ') : undefined
				].filter(Boolean).join('\\n'), Boolean(mode.readOnly));
			}
		}
		function renderSafetyStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-safety-status]');
			const summary = document.querySelector('[data-safety-summary]');
			const cards = document.querySelector('[data-safety-cards]');
			const pendingList = document.querySelector('[data-safety-pending]');
			const mode = status.mode || {};
			const authorization = status.executionAuthorization || {};
			const commands = status.commandPermissions || {};
			const autoApprove = status.autoApprove || {};
			const workspace = status.workspace || {};
			const pending = status.pending || {};
			const pendingDetails = Array.isArray(status.pendingDetails) ? status.pendingDetails : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = !status.ok;
			cards.textContent = '';
			pendingList.textContent = '';
			const pendingTotal = (pending.approvals || 0) + (pending.browserActions || 0) + (pending.mcpActions || 0) + (pending.webFetches || 0) + (pending.hookActions || 0) + (pending.userInputRequests || 0) + (pending.diffFiles || 0);
			summary.textContent = [
				message.summary || status.message || '',
				'Mode: ' + (mode.label || mode.mode || 'unknown') + (mode.readOnly ? ' (read-only)' : ''),
				'Plan authorization: ' + (authorization.approved ? authorization.summary || 'approved' : 'not approved'),
				'Workspace trust: ' + (workspace.trusted ? 'trusted' : 'untrusted'),
				'Pending safety items: ' + pendingTotal
			].filter(Boolean).join('\\n');
			const overviewCards = [
				{
					title: 'Plan Gate',
					badge: authorization.approved && authorization.activePlanMatches ? 'ready' : 'blocked',
					blocked: !authorization.approved || !authorization.activePlanMatches,
					detail: [
						authorization.summary || 'No approved plan revision.',
						mode.requiresVisualPlan ? 'Visual plan required' : 'Visual plan optional',
						mode.requiresPlanApproval ? 'Exact revision approval required' : 'Plan approval optional'
					].join('\\n')
				},
				{
					title: 'Command Policy',
					badge: (commands.denyRuleCount || 0) + ' deny',
					blocked: false,
					detail: [
						commands.summary || '',
						'Default allow: ' + Boolean(commands.defaultAllow),
						'Allow rules: ' + (commands.allowRuleCount || 0),
						'Deny rules: ' + (commands.denyRuleCount || 0)
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Auto-Approve',
					badge: autoApprove.enabled ? 'enabled' : 'disabled',
					blocked: autoApprove.enabled,
					detail: [
						autoApprove.summary || '',
						'Max risk: ' + (autoApprove.maxRisk || 'medium'),
						Array.isArray(autoApprove.targets) && autoApprove.targets.length ? 'Targets: ' + autoApprove.targets.join(', ') : 'Targets: none'
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Workspace',
					badge: workspace.trusted ? 'trusted' : 'blocked',
					blocked: !workspace.trusted,
					detail: [
						'Write sandbox: ' + (workspace.writeSandbox || 'workspace-roots-only'),
						'Roots: ' + (Array.isArray(workspace.roots) ? workspace.roots.length : 0),
						'Path traversal blocked: ' + Boolean(workspace.pathTraversalBlocked),
						'Symlink traversal blocked: ' + Boolean(workspace.symlinkTraversalBlocked)
					].join('\\n')
				}
			];
			for (const card of overviewCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			const pendingCard = document.createElement('div');
			pendingCard.className = 'card';
			const pendingTitle = document.createElement('div');
			pendingTitle.className = 'card-title';
			pendingTitle.textContent = 'Pending Gates';
			const pendingBadge = document.createElement('span');
			pendingBadge.className = pendingTotal ? 'badge risk-blocked' : 'badge';
			pendingBadge.textContent = String(pendingTotal);
			pendingTitle.appendChild(pendingBadge);
			const pendingDetail = document.createElement('div');
			pendingDetail.className = 'card-detail';
			pendingDetail.textContent = [
				'Approvals: ' + (pending.approvals || 0),
				'Browser: ' + (pending.browserActions || 0),
				'MCP: ' + (pending.mcpActions || 0),
				'Web fetch: ' + (pending.webFetches || 0),
				'Hooks: ' + (pending.hookActions || 0),
				'User input: ' + (pending.userInputRequests || 0),
				'Diff files: ' + (pending.diffFiles || 0)
			].join('\\n');
			pendingCard.appendChild(pendingTitle);
			pendingCard.appendChild(pendingDetail);
			pendingList.appendChild(pendingCard);
			for (const itemStatus of pendingDetails.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = itemStatus.title || itemStatus.id || 'Pending safety item';
				const badge = document.createElement('span');
				badge.className = itemStatus.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = itemStatus.kind || 'pending';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = itemStatus.risk ? 'Risk: ' + itemStatus.risk : 'Awaiting user decision.';
				item.appendChild(title);
				item.appendChild(detail);
				pendingList.appendChild(item);
			}
			if (guardrails.length) {
				const guardrailCard = document.createElement('div');
				guardrailCard.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'Safety Guardrails';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = String(guardrails.length);
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = guardrails.slice(0, 5).join('\\n');
				guardrailCard.appendChild(title);
				guardrailCard.appendChild(detail);
				pendingList.appendChild(guardrailCard);
			}
		}
		function renderCommandPermissions(message) {
			const section = document.querySelector('[data-command-permissions]');
			const summary = document.querySelector('[data-command-permissions-summary]');
			const list = document.querySelector('[data-command-permissions-list]');
			const policy = message.policy || {};
			section.hidden = false;
			summary.textContent = message.summary || [
				policy.defaultAllow ? 'Terminal commands allowed by default' : 'Terminal commands blocked by default',
				(policy.sources || []).length ? 'Sources: ' + policy.sources.join(', ') : 'Sources: built-in defaults only'
			].filter(Boolean).join('\\n');
			list.textContent = '';
			for (const group of [
				['Allow', policy.allow || []],
				['Deny', policy.deny || []]
			]) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = group[0] + ' rules';
				const badge = document.createElement('span');
				badge.className = group[0] === 'Deny' && group[1].length ? 'badge risk-blocked' : 'badge';
				badge.textContent = String(group[1].length);
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = group[1].length ? group[1].join('\\n') : 'No explicit ' + group[0].toLowerCase() + ' rules.';
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderTerminalCommandValidationStatus(message) {
			const status = message.status || {};
			const classification = status.classification || {};
			const policy = status.policy || {};
			const mode = status.mode || {};
			const authorization = status.authorization || {};
			const workspace = status.workspace || {};
			const cwdSafety = workspace.cwdSafety || {};
			const verification = status.verification || {};
			const validationErrors = Array.isArray(status.validationErrors) ? status.validationErrors : [];
			const warnings = Array.isArray(status.warnings) ? status.warnings : [];
			const repairHints = Array.isArray(status.repairHints) ? status.repairHints : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-terminal-command-validation-status]');
			const summary = document.querySelector('[data-terminal-command-validation-summary]');
			const cards = document.querySelector('[data-terminal-command-validation-cards]');
			section.hidden = !status.candidatePresent && !status.commandLine;
			cards.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				status.commandLine ? 'Command: ' + status.commandLine : undefined,
				status.cwd ? 'cwd: ' + status.cwd : undefined,
				status.reason ? 'Reason: ' + status.reason : undefined,
				'Risk: ' + (status.risk || 'unknown'),
				'Approval ready: ' + String(Boolean(status.approvalReady)),
				'Execution ready: ' + String(Boolean(status.executionReady))
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Command Classification', classification.kind || 'unknown', [
				'Verification likely: ' + String(Boolean(classification.verificationLikely)),
				'Long running: ' + String(Boolean(classification.longRunningLikely)),
				'Network likely: ' + String(Boolean(classification.networkLikely)),
				'Writes workspace: ' + String(Boolean(classification.writesWorkspaceLikely))
			].join('\\n'), status.risk === 'high' || status.risk === 'blocked');
			addStatusCard(cards, 'Permission Decision', policy.blocked ? 'blocked' : policy.allowed ? 'allowed' : 'review', [
				'Allowed: ' + String(Boolean(policy.allowed)),
				'Blocked: ' + String(Boolean(policy.blocked)),
				'Dangerous pattern: ' + String(Boolean(policy.dangerous)),
				policy.reason,
				policy.matchedRule ? 'Matched rule: ' + policy.matchedRule : undefined
			].filter(Boolean).join('\\n'), Boolean(policy.blocked || policy.dangerous));
			addStatusCard(cards, 'Mode And Plan Gate', status.executionReady ? 'ready' : status.approvalReady ? 'approval-ready' : 'locked', [
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				'Terminal allowed: ' + String(Boolean(mode.terminalAllowed)),
				mode.blockReason,
				'Has exact plan authorization: ' + String(Boolean(authorization.hasExecutionAuthorization)),
				'Authorization required before run: ' + String(Boolean(authorization.requiredBeforeRun)),
				'Authorization blocks execution: ' + String(Boolean(authorization.blocksExecution))
			].filter(Boolean).join('\\n'), !status.executionReady);
			addStatusCard(cards, 'Workspace Cwd Safety', cwdSafety.state || 'unknown', [
				'Workspace trusted: ' + String(Boolean(workspace.trusted)),
				'Safe cwd: ' + String(Boolean(cwdSafety.safe)),
				'Workspace rooted: ' + String(Boolean(cwdSafety.workspaceRooted)),
				cwdSafety.cwd ? 'Requested cwd: ' + cwdSafety.cwd : undefined,
				cwdSafety.effectiveCwd ? 'Effective cwd: ' + cwdSafety.effectiveCwd : undefined,
				Array.isArray(cwdSafety.errors) && cwdSafety.errors.length ? 'Errors:\\n' + cwdSafety.errors.slice(0, 4).join('\\n') : undefined,
				Array.isArray(cwdSafety.warnings) && cwdSafety.warnings.length ? 'Warnings:\\n' + cwdSafety.warnings.slice(0, 4).join('\\n') : undefined
			].filter(Boolean).join('\\n'), !cwdSafety.safe);
			addStatusCard(cards, 'Verification Linkage', verification.requested ? (verification.known ? 'known' : 'unknown') : 'none', [
				'Requested: ' + String(Boolean(verification.requested)),
				verification.checkId ? 'Check: ' + verification.checkId : undefined,
				verification.known !== undefined ? 'Known check: ' + String(Boolean(verification.known)) : undefined,
				verification.warning
			].filter(Boolean).join('\\n') || 'No verification check linked.', Boolean(verification.warning));
			addStatusCard(cards, 'Validation Blockers', String(validationErrors.length), validationErrors.slice(0, 6).join('\\n') || 'No validation errors reported.', validationErrors.length > 0 || Boolean(status.blocked));
			if (warnings.length || repairHints.length) {
				addStatusCard(cards, 'Warnings And Repair Hints', String(warnings.length + repairHints.length), [
					...warnings.slice(0, 5),
					...repairHints.slice(0, 6)
				].join('\\n') || 'No repair hints reported.', warnings.length > 0);
			}
			addStatusCard(cards, 'Read-Only Command Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Terminal command validation is read-only.', false);
		}
		function renderWorkspaceSandboxStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-workspace-sandbox-status]');
			const summary = document.querySelector('[data-workspace-sandbox-summary]');
			const counts = document.querySelector('[data-workspace-sandbox-counts]');
			const paths = document.querySelector('[data-workspace-sandbox-paths]');
			const countState = status.counts || {};
			const guards = status.guards || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const pathChecks = Array.isArray(status.paths) ? status.paths : [];
			section.hidden = !status.ok;
			counts.textContent = '';
			paths.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.ready ? 'Ready for gated workspace mutation.' : 'Blocked until sandbox issues are resolved.',
				'Workspace trust: ' + (status.workspaceTrusted ? 'trusted' : 'untrusted'),
				'Roots: ' + (countState.workspaceRoots ?? 0),
				'Ignore rules: ' + (countState.ignoreRules ?? 0),
				(status.roots || []).length ? 'Root paths:\\n' + status.roots.join('\\n') : undefined
			].filter(Boolean).join('\\n');
			const countCard = document.createElement('div');
			countCard.className = 'card';
			const countTitle = document.createElement('div');
			countTitle.className = 'card-title';
			countTitle.textContent = 'Coverage';
			const countBadge = document.createElement('span');
			countBadge.className = (countState.blockedPaths ?? 0) > 0 || !status.ready ? 'badge risk-blocked' : 'badge';
			countBadge.textContent = (countState.blockedPaths ?? 0) + ' blocked';
			countTitle.appendChild(countBadge);
			const countDetail = document.createElement('div');
			countDetail.className = 'card-detail';
			countDetail.textContent = [
				'Pending approval paths: ' + (countState.pendingApprovalPaths ?? 0),
				'Active diff paths: ' + (countState.activeDiffPaths ?? 0),
				'Checkpoint paths: ' + (countState.checkpointPaths ?? 0),
				'Returned path checks: ' + (countState.returnedPaths ?? 0),
				'Ignore sources: ' + (countState.ignoreSources ?? 0),
				'Guards: parent traversal=' + Boolean(guards.rejectsParentTraversal) + ', ignored paths=' + Boolean(guards.rejectsIgnoredPaths) + ', symlink-on-mutation=' + Boolean(guards.symlinkTraversalCheckedOnMutation) + ', checkpoints=' + Boolean(guards.checkpointsBeforeWrites) + ', atomic rollback=' + Boolean(guards.atomicDiffRollback)
			].join('\\n');
			countCard.appendChild(countTitle);
			countCard.appendChild(countDetail);
			counts.appendChild(countCard);
			if (blockers.length) {
				const blockerCard = document.createElement('div');
				blockerCard.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'Blockers';
				const badge = document.createElement('span');
				badge.className = 'badge risk-blocked';
				badge.textContent = String(blockers.length);
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = blockers.slice(0, 8).join('\\n');
				blockerCard.appendChild(title);
				blockerCard.appendChild(detail);
				counts.appendChild(blockerCard);
			}
			for (const path of pathChecks.slice(0, 16)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = path.path || 'workspace path';
				const badge = document.createElement('span');
				badge.className = path.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = (path.source || 'sample') + ' - ' + (path.status || 'unknown');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					path.workspaceRelative ? 'Workspace-relative' : 'Absolute/external candidate',
					path.ignored ? 'Ignored by workspace policy' : undefined,
					path.reason ? 'Reason: ' + path.reason : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				paths.appendChild(item);
			}
		}
		function renderRedactionStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-redaction-status]');
			const summary = document.querySelector('[data-redaction-summary]');
			const counts = document.querySelector('[data-redaction-counts]');
			const filtersList = document.querySelector('[data-redaction-filters]');
			const countState = status.counts || {};
			const filters = Array.isArray(status.filters) ? status.filters : [];
			const samples = Array.isArray(status.sampleResults) ? status.sampleResults : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = !status.ok;
			counts.textContent = '';
			filtersList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.enabled ? 'Active token filters are enabled.' : 'Active token filters are disabled.',
				'Filters: ' + (countState.filters ?? filters.length),
				'Synthetic samples: ' + (countState.samples ?? samples.length),
				'Passed: ' + (countState.passed ?? 0),
				'Failed: ' + (countState.failed ?? 0)
			].filter(Boolean).join('\\n');
			const coverageCard = document.createElement('div');
			coverageCard.className = 'card';
			const coverageTitle = document.createElement('div');
			coverageTitle.className = 'card-title';
			coverageTitle.textContent = 'Self-Test Coverage';
			const coverageBadge = document.createElement('span');
			coverageBadge.className = (countState.failed ?? 0) > 0 ? 'badge risk-blocked' : 'badge';
			coverageBadge.textContent = (countState.failed ?? 0) + ' failed';
			coverageTitle.appendChild(coverageBadge);
			const categories = filters.reduce((acc, filter) => {
				const category = filter.category || 'filter';
				acc[category] = (acc[category] || 0) + 1;
				return acc;
			}, {});
			const coverageDetail = document.createElement('div');
			coverageDetail.className = 'card-detail';
			coverageDetail.textContent = [
				Object.keys(categories).length ? 'Categories: ' + Object.keys(categories).sort().map(category => category + '=' + categories[category]).join(', ') : 'Categories: none',
				'Raw secrets scanned: no',
				'Prompt block returned: ' + (status.promptBlock ? 'yes' : 'no')
			].join('\\n');
			coverageCard.appendChild(coverageTitle);
			coverageCard.appendChild(coverageDetail);
			counts.appendChild(coverageCard);
			if (samples.length) {
				const sampleCard = document.createElement('div');
				sampleCard.className = 'card';
				const sampleTitle = document.createElement('div');
				sampleTitle.className = 'card-title';
				sampleTitle.textContent = 'Synthetic Samples';
				const sampleBadge = document.createElement('span');
				sampleBadge.className = samples.some(sample => sample.leaked || !sample.redacted) ? 'badge risk-blocked' : 'badge';
				sampleBadge.textContent = String(samples.length);
				sampleTitle.appendChild(sampleBadge);
				const sampleDetail = document.createElement('div');
				sampleDetail.className = 'card-detail';
				sampleDetail.textContent = samples.slice(0, 8).map(sample => [
					sample.id + ': ' + (sample.redacted && !sample.leaked ? 'redacted' : 'needs attention'),
					sample.markers && sample.markers.length ? 'markers=' + sample.markers.join(', ') : undefined,
					sample.outputPreview ? 'preview=' + sample.outputPreview : undefined
				].filter(Boolean).join(' - ')).join('\\n');
				sampleCard.appendChild(sampleTitle);
				sampleCard.appendChild(sampleDetail);
				counts.appendChild(sampleCard);
			}
			for (const filter of filters.slice(0, 16)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = filter.label || filter.id || 'Redaction filter';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = filter.category || 'filter';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = Array.isArray(filter.protects) && filter.protects.length ? filter.protects.join('\\n') : 'No protected patterns reported.';
				item.appendChild(title);
				item.appendChild(detail);
				filtersList.appendChild(item);
			}
			if (guardrails.length) {
				const guardrailCard = document.createElement('div');
				guardrailCard.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'Guardrails';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = String(guardrails.length);
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = guardrails.slice(0, 4).join('\\n');
				guardrailCard.appendChild(title);
				guardrailCard.appendChild(detail);
				filtersList.appendChild(guardrailCard);
			}
		}
		function renderExecutionGateStatus(message) {
			const section = document.querySelector('[data-execution-gate-status]');
			const summary = document.querySelector('[data-execution-gate-status-summary]');
			const list = document.querySelector('[data-execution-gate-status-list]');
			const status = message.status || {};
			const plan = status.plan || {};
			const pending = status.pending || {};
			const request = status.request || {};
			const gates = Array.isArray(status.gates) ? status.gates : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			section.hidden = false;
			summary.textContent = [
				message.summary || status.message || '',
				'Route: ' + (status.route || 'unknown'),
				status.ready ? 'Ready for next step' : status.blocked ? 'Blocked' : 'Waiting',
				plan.available ? 'Plan: ' + plan.taskId + ' r' + plan.revision + (plan.approved ? ' approved' : ' awaiting approval') : 'Plan: unavailable',
				request.toolName ? 'Tool: ' + request.toolName : undefined,
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			list.textContent = '';
			const pendingCard = document.createElement('div');
			pendingCard.className = 'card';
			const pendingTitle = document.createElement('div');
			pendingTitle.className = 'card-title';
			pendingTitle.textContent = 'Pending Work';
			const pendingBadge = document.createElement('span');
			pendingBadge.className = pending.approvals || pending.pendingDiffFiles ? 'badge risk-blocked' : 'badge';
			pendingBadge.textContent = String((pending.approvals || 0) + (pending.pendingDiffFiles || 0));
			pendingTitle.appendChild(pendingBadge);
			const pendingDetail = document.createElement('div');
			pendingDetail.className = 'card-detail';
			pendingDetail.textContent = [
				'Approvals: ' + (pending.approvals ?? 0),
				'Matching tool approvals: ' + (pending.approvalForTool ?? 0),
				'Diff files: ' + (pending.diffFiles ?? 0),
				'Pending diff files: ' + (pending.pendingDiffFiles ?? 0),
				'Accepted diff files: ' + (pending.acceptedDiffFiles ?? 0),
				'Rejected diff files: ' + (pending.rejectedDiffFiles ?? 0)
			].join('\\n');
			pendingCard.appendChild(pendingTitle);
			pendingCard.appendChild(pendingDetail);
			list.appendChild(pendingCard);
			if (blockers.length) {
				const blockerCard = document.createElement('div');
				blockerCard.className = 'card';
				const blockerTitle = document.createElement('div');
				blockerTitle.className = 'card-title';
				blockerTitle.textContent = 'Blockers';
				const blockerBadge = document.createElement('span');
				blockerBadge.className = 'badge risk-blocked';
				blockerBadge.textContent = String(blockers.length);
				blockerTitle.appendChild(blockerBadge);
				const blockerDetail = document.createElement('div');
				blockerDetail.className = 'card-detail';
				blockerDetail.textContent = blockers.join('\\n');
				blockerCard.appendChild(blockerTitle);
				blockerCard.appendChild(blockerDetail);
				list.appendChild(blockerCard);
			}
			for (const gate of gates) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = gate.label || gate.id;
				const badge = document.createElement('span');
				badge.className = gate.status === 'ready' || gate.status === 'not_applicable' ? 'badge' : 'badge risk-blocked';
				badge.textContent = gate.status || 'unknown';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [gate.id, gate.detail].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderActionApprovalStatus(message) {
			const section = document.querySelector('[data-action-approval-status]');
			const summary = document.querySelector('[data-action-approval-status-summary]');
			const cards = document.querySelector('[data-action-approval-status-cards]');
			const status = message.status || {};
			const request = status.request || {};
			const mode = status.mode || {};
			const authorization = status.authorization || {};
			const autoApprove = status.autoApprove || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			section.hidden = false;
			cards.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Route: ' + (status.route || 'unknown'),
				'Action: ' + (status.kind || 'generic') + ' · risk ' + (status.risk || 'unknown'),
				request.toolName ? 'Tool: ' + request.toolName : undefined,
				request.commandLine ? 'Command: ' + request.commandLine : undefined,
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Route', status.ready ? (status.canAutoApprove ? 'auto' : status.canPrompt ? 'prompt' : 'ready') : 'blocked', [
				status.message || '',
				'Can prompt: ' + Boolean(status.canPrompt),
				'Can auto-approve: ' + Boolean(status.canAutoApprove)
			].join('\\n'), !status.ready);
			addStatusCard(cards, 'Mode Gate', mode.allowed ? 'allowed' : 'blocked', [
				(mode.label || mode.mode || 'unknown') + (mode.readOnly ? ' (read-only)' : ''),
				'Action class: ' + (mode.action || 'generic'),
				mode.blockReason
			].filter(Boolean).join('\\n'), !mode.allowed);
			addStatusCard(cards, 'Plan Gate', authorization.activePlanMatches ? 'approved' : 'locked', [
				authorization.summary || 'No approved plan revision.',
				authorization.requiredBeforeMutation ? 'Exact visual plan approval required' : 'No plan approval required for this action'
			].join('\\n'), !authorization.activePlanMatches && authorization.requiredBeforeMutation);
			addStatusCard(cards, 'Auto-Approve', autoApprove.approved ? 'approved' : autoApprove.enabled ? 'not eligible' : 'disabled', [
				autoApprove.summary || '',
				'Target: ' + (autoApprove.target || 'generic'),
				autoApprove.reason || ''
			].filter(Boolean).join('\\n'), autoApprove.enabled && !autoApprove.approved && status.route !== 'prompt_user');
			if (blockers.length) {
				addStatusCard(cards, 'Blockers', String(blockers.length), blockers.join('\\n'), true);
			}
		}
		function renderToolCatalog(message) {
			const section = document.querySelector('[data-tool-catalog]');
			const summary = document.querySelector('[data-tool-catalog-summary]');
			const list = document.querySelector('[data-tool-catalog-list]');
			const catalog = message.catalog || {};
			const tools = catalog.tools || [];
			section.hidden = false;
			summary.textContent = [
				message.summary || '',
				catalog.executionAuthorized ? 'Plan authorization: approved' : 'Plan authorization: locked',
				catalog.bridgeConnected ? 'Backend bridge: connected' : 'Backend bridge: not connected'
			].filter(Boolean).join('\\n');
			list.textContent = '';
			for (const tool of tools) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = tool.title || tool.id;
				const badge = document.createElement('span');
				badge.className = tool.available ? 'badge' : 'badge risk-blocked';
				badge.textContent = (tool.category || 'tool') + ' · ' + (tool.available ? 'available' : 'blocked');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					tool.id,
					tool.detail,
					tool.requiresApproval ? 'Approval required' : 'Read-only/no approval',
					tool.requiresPlanApproval ? 'Plan approval required' : undefined,
					tool.blockedReason ? 'Blocked: ' + tool.blockedReason : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderCapabilityMatrix(message) {
			const section = document.querySelector('[data-capability-matrix]');
			const summary = document.querySelector('[data-capability-matrix-summary]');
			const list = document.querySelector('[data-capability-matrix-list]');
			const matrix = message.matrix || {};
			const capabilities = matrix.capabilities || [];
			const counts = matrix.counts || {};
			section.hidden = false;
			summary.textContent = [
				message.summary || matrix.message || '',
				'Implemented: ' + (counts.implemented ?? 0) + '/' + (counts.total ?? capabilities.length),
				'Runtime available now: ' + (counts.runtimeAvailable ?? 0),
				matrix.requestedSource ? 'Filtered source: ' + matrix.requestedSource : undefined
			].filter(Boolean).join('\\n');
			list.textContent = '';
			for (const capability of capabilities) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = capability.title || capability.id;
				const badge = document.createElement('span');
				badge.className = capability.status === 'implemented' && capability.runtimeAvailable ? 'badge' : 'badge risk-blocked';
				badge.textContent = (capability.status || 'unknown') + ' · ' + (capability.runtimeAvailable ? 'available' : 'locked');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					capability.id,
					Array.isArray(capability.sources) && capability.sources.length ? 'Sources: ' + capability.sources.join(', ') : undefined,
					Array.isArray(capability.toolCatalogIds) && capability.toolCatalogIds.length ? 'Tools: ' + capability.toolCatalogIds.join(', ') : undefined,
					Array.isArray(capability.missingToolCatalogIds) && capability.missingToolCatalogIds.length ? 'Missing tools: ' + capability.missingToolCatalogIds.join(', ') : undefined,
					Array.isArray(capability.blockedReasons) && capability.blockedReasons.length ? 'Runtime locks: ' + capability.blockedReasons.join('\\n') : undefined,
					Array.isArray(capability.evidence) && capability.evidence.length ? 'Evidence:\\n' + capability.evidence.join('\\n') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderToolSchemas(message) {
			const section = document.querySelector('[data-tool-schemas]');
			const summary = document.querySelector('[data-tool-schemas-summary]');
			const list = document.querySelector('[data-tool-schemas-list]');
			const response = message.response || {};
			const schemas = response.schemas || [];
			const counts = response.counts || {};
			section.hidden = false;
			summary.textContent = [
				message.summary || response.message || '',
				'Format: ' + (response.format || 'openai'),
				response.category ? 'Category: ' + response.category : undefined,
				'Available: ' + (counts.available ?? 0) + '/' + (counts.total ?? schemas.length)
			].filter(Boolean).join('\\n');
			list.textContent = '';
			for (const schema of schemas) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = schema.name || schema.title;
				const badge = document.createElement('span');
				badge.className = schema.available ? 'badge' : 'badge risk-blocked';
				badge.textContent = (schema.category || 'tool') + ' · ' + (schema.available ? 'available' : 'locked');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					schema.title,
					schema.description,
					'Catalog: ' + schema.toolCatalogId,
					Array.isArray(schema.aliases) && schema.aliases.length ? 'Aliases: ' + schema.aliases.join(', ') : undefined,
					schema.requiresApproval ? 'Approval required' : 'Read-only/no approval',
					schema.requiresPlanApproval ? 'Plan approval required' : undefined,
					schema.mutatesWorkspace ? 'Workspace mutation requested through review/approval gates' : undefined,
					schema.blockedReason ? 'Blocked: ' + schema.blockedReason : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderAutoApproveState(message) {
			const section = document.querySelector('[data-auto-approve]');
			const summary = document.querySelector('[data-auto-approve-summary]');
			const controls = document.querySelector('[data-auto-approve-controls]');
			const config = message.config || {};
			section.hidden = false;
			summary.textContent = [
				message.summary || '',
				message.authorization || 'No approved plan authorization yet.'
			].filter(Boolean).join('\\n');
			controls.textContent = '';
			for (const item of [
				['enabled', 'Enable auto-approve'],
				['terminal', 'Terminal approvals'],
				['file', 'File change approvals'],
				['tool', 'Tool approvals'],
				['generic', 'Generic approvals'],
				['mcp', 'MCP requests'],
				['browser', 'Browser open/navigate']
			]) {
				const row = document.createElement('label');
				row.className = 'toggle-row';
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = Boolean(config[item[0]]);
				checkbox.addEventListener('change', () => vscode.postMessage({ command: 'toggleAutoApprove', key: item[0], value: checkbox.checked }));
				row.appendChild(checkbox);
				row.appendChild(document.createTextNode(item[1]));
				controls.appendChild(row);
			}
			const riskRow = document.createElement('label');
			riskRow.className = 'toggle-row';
			riskRow.appendChild(document.createTextNode('Max risk'));
			const select = document.createElement('select');
			select.className = 'inline-select';
			for (const risk of ['low', 'medium', 'high']) {
				const option = document.createElement('option');
				option.value = risk;
				option.textContent = risk;
				option.selected = config.maxRisk === risk;
				select.appendChild(option);
			}
			select.addEventListener('change', () => vscode.postMessage({ command: 'setAutoApproveRisk', value: select.value }));
			riskRow.appendChild(select);
			controls.appendChild(riskRow);
		}
		function renderParallelWorktreeStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-parallel-worktree-status]');
			const summary = document.querySelector('[data-parallel-worktree-summary]');
			const cards = document.querySelector('[data-parallel-worktree-cards]');
			const lanesList = document.querySelector('[data-parallel-worktree-lanes]');
			const counts = status.counts || {};
			const readiness = status.readiness || {};
			const mode = status.mode || {};
			const root = status.root || {};
			const lanes = Array.isArray(status.lanes) ? status.lanes : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const blockers = Array.isArray(readiness.blockedReasons) ? readiness.blockedReasons : [];
			section.hidden = false;
			cards.textContent = '';
			lanesList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Task: ' + (status.taskId || status.activeTaskId || 'none'),
				'Enabled: ' + String(Boolean(status.enabled)),
				'Workspace trusted: ' + String(Boolean(status.workspaceTrusted)),
				'Plan authorization: ' + (status.hasPlanAuthorization ? 'approved' : 'required'),
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				'Lanes: ' + (counts.requestedThreads ?? 0) + '/' + (counts.maxThreads ?? 8),
				'Prepare: ' + (readiness.canPrepare ? 'ready' : 'blocked'),
				'Cleanup: ' + (readiness.canCleanup ? 'ready' : 'blocked'),
				blockers.length ? 'Blockers: ' + blockers.join('; ') : undefined
			].filter(Boolean).join('\\n');
			const statusCards = [
				{
					title: 'Lifecycle Gate',
					badge: readiness.canPrepare ? 'prepare ready' : 'blocked',
					blocked: !readiness.canPrepare,
					detail: [
						'Prepare: ' + String(Boolean(readiness.canPrepare)),
						'Cleanup: ' + String(Boolean(readiness.canCleanup)),
						'Available: ' + String(Boolean(status.available)),
						'Enabled: ' + String(Boolean(status.enabled)),
						blockers.length ? blockers.join('\\n') : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Isolation Root',
					badge: root.worktreeRootUnderWorkspace ? 'safe' : 'blocked',
					blocked: !root.worktreeRootUnderWorkspace,
					detail: [
						root.isolation ? 'Isolation: ' + root.isolation : undefined,
						root.baseWorkspaceRoot ? 'Workspace: ' + root.baseWorkspaceRoot : undefined,
						root.worktreeRoot ? 'Worktree root: ' + root.worktreeRoot : undefined,
						'Root under workspace: ' + String(Boolean(root.worktreeRootUnderWorkspace))
					].filter(Boolean).join('\\n') || 'No worktree root is available.'
				},
				{
					title: 'Lane Counts',
					badge: String(counts.requestedThreads ?? 0),
					blocked: (counts.unsafe || 0) > 0 || (counts.failed || 0) > 0,
					detail: [
						'Pending: ' + (counts.pending ?? 0),
						'Materialized: ' + (counts.materialized ?? 0),
						'Failed: ' + (counts.failed ?? 0),
						'Skipped: ' + (counts.skipped ?? 0),
						'Cleaned: ' + (counts.cleaned ?? 0),
						'Unsafe: ' + (counts.unsafe ?? 0)
					].join('\\n')
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Parallel worktree status is read-only.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const lane of lanes.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = lane.id || 'lane';
				const badge = document.createElement('span');
				const laneBlocked = Array.isArray(lane.blockers) && lane.blockers.length > 0;
				badge.className = laneBlocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = (lane.status || 'pending') + (laneBlocked ? ' blocked' : '');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					'Role: ' + (lane.role || 'worker'),
					lane.branchName ? 'Branch: ' + lane.branchName : undefined,
					lane.worktreePath ? 'Path: ' + lane.worktreePath : undefined,
					'Branch safe: ' + String(Boolean(lane.branchSafe)),
					'Path safe: ' + String(Boolean(lane.pathSafe)),
					'Under worktree root: ' + String(Boolean(lane.pathUnderWorktreeRoot)),
					lane.statusDetail,
					laneBlocked ? 'Blockers: ' + lane.blockers.join('; ') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				lanesList.appendChild(item);
			}
		}
		function renderParallelLaneExecutionStatus(message) {
			const status = message.status || {};
			const lane = status.lane || {};
			const counts = status.counts || {};
			const mode = status.mode || {};
			const review = status.review || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-parallel-lane-execution-status]');
			const summary = document.querySelector('[data-parallel-lane-execution-summary]');
			const cards = document.querySelector('[data-parallel-lane-execution-cards]');
			const laneContainer = document.querySelector('[data-parallel-lane-execution-lane]');
			section.hidden = !status.ok && !status.taskId && !status.activeTaskId && !status.message;
			cards.textContent = '';
			laneContainer.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Task: ' + (status.taskId || status.activeTaskId || 'none'),
				'Selected lane: ' + (status.selectedThreadId || status.requestedThreadId || 'auto'),
				'Route: ' + (status.route || 'unknown'),
				'Ready: ' + String(Boolean(status.ready)),
				'Workspace trusted: ' + String(Boolean(status.workspaceTrusted)),
				'Plan authorization: ' + (status.hasExecutionAuthorization ? 'approved' : 'required'),
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				blockers.length ? 'Blockers: ' + blockers.join('; ') : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Dispatch Route', status.route || 'unknown', [
				'Ready: ' + String(Boolean(status.ready)),
				'Blocked: ' + String(Boolean(status.blocked)),
				'Next: ' + (status.nextAction || 'none')
			].join('\\n'), !status.ready && status.route !== 'wait_for_result' && status.route !== 'review_reported_result');
			addStatusCard(cards, 'Mode And Plan Gate', status.hasExecutionAuthorization && mode.allowsToolRequests ? 'ready' : 'locked', [
				'Authorization: ' + (status.hasExecutionAuthorization ? 'exact plan approved' : 'missing or stale'),
				'Authorization summary: ' + (status.authorizationSummary || 'none'),
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				'Allows tool requests: ' + String(Boolean(mode.allowsToolRequests)),
				'Read-only: ' + String(Boolean(mode.readOnly))
			].join('\\n'), !status.hasExecutionAuthorization || !mode.allowsToolRequests);
			addStatusCard(cards, 'Lane Coverage', (counts.results ?? 0) + '/' + (counts.threads ?? 0), [
				'Materialized: ' + (counts.materialized ?? 0),
				'Pending: ' + (counts.pending ?? 0),
				'Running results: ' + (counts.runningResults ?? 0),
				'Completed results: ' + (counts.completedResults ?? 0),
				'Failed/blocked results: ' + ((counts.failedResults ?? 0) + (counts.blockedResults ?? 0)),
				'Missing results: ' + (counts.missingResults ?? 0)
			].join('\\n'), (counts.failed ?? 0) > 0 || (counts.failedResults ?? 0) > 0 || (counts.blockedResults ?? 0) > 0);
			addStatusCard(cards, 'Judge Review Link', review.recommendedThreadId || 'pending', [
				'Recommended lane: ' + (review.recommendedThreadId || 'none'),
				'Merge ready: ' + String(Boolean(review.mergeReady)),
				'Review result count: ' + (review.resultCount ?? 0),
				Array.isArray(review.blockers) && review.blockers.length ? 'Review blockers: ' + review.blockers.join('; ') : undefined
			].filter(Boolean).join('\\n') || 'No judge review is available yet.', Boolean(review.blockers && review.blockers.length));
			addStatusCard(cards, 'Read-Only Lane Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Lane execution status is read-only.', false);
			if (blockers.length) {
				addStatusCard(cards, 'Lane Dispatch Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			if (lane.id) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = lane.id;
				const badge = document.createElement('span');
				const laneBlocked = Array.isArray(lane.blockers) && lane.blockers.length > 0;
				badge.className = laneBlocked || !lane.dispatchable && status.route !== 'review_reported_result' && status.route !== 'wait_for_result' ? 'badge risk-blocked' : 'badge';
				badge.textContent = [
					lane.threadStatus || 'unknown',
					lane.resultStatus ? 'result ' + lane.resultStatus : undefined,
					lane.dispatchable ? 'dispatchable' : undefined
				].filter(Boolean).join(' · ');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					'Role: ' + (lane.role || 'worker'),
					lane.promptFocus,
					lane.branchName ? 'Branch: ' + lane.branchName : undefined,
					lane.worktreePath ? 'Worktree: ' + lane.worktreePath : undefined,
					'Materialized: ' + String(Boolean(lane.materialized)),
					'Branch safe: ' + String(Boolean(lane.branchSafe)),
					'Path safe: ' + String(Boolean(lane.pathSafe)),
					lane.statusDetail,
					lane.resultSummary,
					Array.isArray(lane.changedFiles) && lane.changedFiles.length ? 'Changed files: ' + lane.changedFiles.slice(0, 8).join(', ') : undefined,
					lane.verificationCount !== undefined ? 'Verification count: ' + lane.verificationCount : undefined,
					lane.riskCount !== undefined ? 'Risk count: ' + lane.riskCount : undefined,
					laneBlocked ? 'Lane blockers: ' + lane.blockers.join('; ') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				if (lane.dispatchable && dispatch.method) {
					const actions = document.createElement('div');
					actions.className = 'card-actions';
					const launch = document.createElement('button');
					launch.className = 'secondary';
					launch.textContent = 'Launch lane';
					launch.addEventListener('click', () => vscode.postMessage({
						command: 'dispatchParallelLane',
						taskId: dispatch.taskId || status.taskId || status.activeTaskId,
						threadId: dispatch.threadId || lane.id,
						worktreePath: dispatch.worktreePath || lane.worktreePath,
						branchName: dispatch.branchName || lane.branchName,
						promptFocus: dispatch.promptFocus || lane.promptFocus
					}));
					actions.appendChild(launch);
					item.appendChild(actions);
				}
				laneContainer.appendChild(item);
			}
		}
		function renderParallelDispatchPlanStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const mode = status.mode || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const lanes = Array.isArray(status.lanes) ? status.lanes : [];
			const queue = Array.isArray(status.dispatchQueue) ? status.dispatchQueue : [];
			const section = document.querySelector('[data-parallel-dispatch-plan-status]');
			const summary = document.querySelector('[data-parallel-dispatch-plan-summary]');
			const cards = document.querySelector('[data-parallel-dispatch-plan-cards]');
			const laneContainer = document.querySelector('[data-parallel-dispatch-plan-lanes]');
			section.hidden = !status.ok && !status.taskId && !status.activeTaskId && !status.message;
			cards.textContent = '';
			laneContainer.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Task: ' + (status.taskId || status.activeTaskId || 'none'),
				'Route: ' + (status.route || 'unknown'),
				'Dispatch queue: ' + queue.length,
				'Ready: ' + String(Boolean(status.ready)),
				'Workspace trusted: ' + String(Boolean(status.workspaceTrusted)),
				'Plan authorization: ' + (status.hasExecutionAuthorization ? 'approved' : 'required'),
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				blockers.length ? 'Blockers: ' + blockers.join('; ') : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Dispatch Queue', status.route || 'unknown', [
				'Ready: ' + String(Boolean(status.ready)),
				'Blocked: ' + String(Boolean(status.blocked)),
				'Queued lanes: ' + queue.length,
				'Next: ' + (status.nextAction || 'none')
			].join('\\n'), !status.ready && status.route !== 'wait_for_results' && status.route !== 'review_results');
			addStatusCard(cards, 'Mode And Plan Gate', status.hasExecutionAuthorization && mode.allowsToolRequests ? 'ready' : 'locked', [
				'Authorization: ' + (status.hasExecutionAuthorization ? 'exact plan approved' : 'missing or stale'),
				'Authorization summary: ' + (status.authorizationSummary || 'none'),
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				'Allows tool requests: ' + String(Boolean(mode.allowsToolRequests)),
				'Read-only: ' + String(Boolean(mode.readOnly))
			].join('\\n'), !status.hasExecutionAuthorization || !mode.allowsToolRequests);
			addStatusCard(cards, 'Lane Counts', (counts.dispatchable ?? 0) + '/' + (counts.threads ?? 0), [
				'Materialized: ' + (counts.materialized ?? 0),
				'Pending: ' + (counts.pending ?? 0),
				'Dispatchable: ' + (counts.dispatchable ?? 0),
				'Running results: ' + (counts.runningResults ?? 0),
				'Completed results: ' + (counts.completedResults ?? 0),
				'Failed/blocked results: ' + ((counts.failedResults ?? 0) + (counts.blockedResults ?? 0)),
				'Missing results: ' + (counts.missingResults ?? 0),
				'Returned lanes: ' + (counts.returnedLanes ?? lanes.length)
			].join('\\n'), (counts.failedResults ?? 0) > 0 || (counts.blockedResults ?? 0) > 0 || status.blocked);
			if (queue.length) {
				addStatusCard(cards, 'Backend Dispatch Contract', 'agent/dispatchParallelLane', queue.slice(0, 8).map(item => [
					item.threadId + ' -> ' + item.worktreePath,
					'Branch: ' + item.branchName,
					'Result: ' + (item.expectedResultMethod || 'agent/parallelResult')
				].join('\\n')).join('\\n\\n'), false);
			}
			if (blockers.length) {
				addStatusCard(cards, 'Dispatch Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			addStatusCard(cards, 'Read-Only Dispatch Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Parallel dispatch plan status is read-only.', false);
			for (const lane of lanes.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = lane.id || 'lane';
				const badge = document.createElement('span');
				const laneBlocked = Array.isArray(lane.blockers) && lane.blockers.length > 0;
				badge.className = lane.dispatchable && !laneBlocked ? 'badge' : 'badge risk-blocked';
				badge.textContent = [
					lane.status || 'unknown',
					lane.resultStatus ? 'result ' + lane.resultStatus : undefined,
					lane.dispatchable ? 'queued' : 'not queued'
				].filter(Boolean).join(' · ');
				title.appendChild(badge);
				const dispatch = lane.dispatchRequest || {};
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					'Role: ' + (lane.role || 'worker'),
					lane.promptFocus,
					lane.branchName ? 'Branch: ' + lane.branchName : undefined,
					lane.worktreePath ? 'Worktree: ' + lane.worktreePath : undefined,
					'Materialized: ' + String(Boolean(lane.materialized)),
					'Branch safe: ' + String(Boolean(lane.branchSafe)),
					'Path safe: ' + String(Boolean(lane.pathSafe)),
					dispatch.method ? 'Dispatch method: ' + dispatch.method : undefined,
					dispatch.expectedResultMethod ? 'Expected result: ' + dispatch.expectedResultMethod : undefined,
					lane.statusDetail,
					laneBlocked ? 'Lane blockers: ' + lane.blockers.join('; ') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				laneContainer.appendChild(item);
			}
		}
		function renderParallelStatus(message) {
			const status = message.status || {};
			const threads = Array.isArray(status.threads) ? status.threads : [];
			const results = Array.isArray(status.results) ? status.results : [];
			const review = status.review || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const section = document.querySelector('[data-parallel-status]');
			const summary = document.querySelector('[data-parallel-status-summary]');
			const cards = document.querySelector('[data-parallel-status-cards]');
			const lanesList = document.querySelector('[data-parallel-status-lanes]');
			section.hidden = !status.ok && !status.taskId && !status.activeTaskId && !status.message;
			cards.textContent = '';
			lanesList.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			const laneCount = status.requestedThreads ?? threads.length ?? status.resultCount ?? 0;
			summary.textContent = [
				message.summary || status.message || '',
				'Task: ' + (status.taskId || status.activeTaskId || 'none'),
				'Enabled: ' + String(Boolean(status.enabled)),
				'Isolation: ' + (status.isolation || 'unknown'),
				'Review/Merge: ' + (status.reviewStrategy || 'unknown') + ' / ' + (status.mergeStrategy || 'unknown'),
				'Results: ' + (status.resultCount ?? 0) + '/' + laneCount,
				status.recommendedThreadId ? 'Recommended lane: ' + status.recommendedThreadId : 'Recommended lane: none',
				'Merge ready: ' + String(Boolean(status.mergeReady))
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Parallel Contract', status.enabled ? 'enabled' : 'disabled', [
				'Requested lanes: ' + (status.requestedThreads ?? 0),
				'Max lanes: ' + (status.maxThreads ?? 8),
				'Isolation: ' + (status.isolation || 'unknown'),
				'Review strategy: ' + (status.reviewStrategy || 'unknown'),
				'Merge strategy: ' + (status.mergeStrategy || 'unknown')
			].join('\\n'), !status.enabled);
			addStatusCard(cards, 'Result Coverage', (status.resultCount ?? 0) + '/' + laneCount, [
				'Thread summaries: ' + threads.length,
				'Raw results returned: ' + results.length,
				'Review result count: ' + (review.resultCount ?? 0)
			].join('\\n'), (status.resultCount ?? 0) < laneCount);
			addStatusCard(cards, 'Judge And Merge', status.mergeReady ? 'ready' : 'blocked', [
				status.recommendedThreadId ? 'Recommended: ' + status.recommendedThreadId : 'No recommended lane yet.',
				review.createdAt ? 'Review created: ' + new Date(review.createdAt).toLocaleTimeString() : undefined,
				'Review merge ready: ' + String(Boolean(review.mergeReady)),
				'Blockers: ' + blockers.length
			].filter(Boolean).join('\\n'), !status.mergeReady);
			addStatusCard(cards, 'Read-Only Agent Guardrails', 'safe', [
				'Parallel status is read-only and never prepares, cleans, merges, selects lanes, applies diffs, stages, writes, deletes, or mutates worktrees.',
				'Use Parallel Worktree Readiness for lifecycle gates, Parallel Review Readiness for judge rankings, and Parallel Merge Status for selected-lane merge-back readiness.',
				'Merge-back must still return through normal review-first diff cards and checkpoint rollback coverage.'
			].join('\\n'), false);
			if (blockers.length) {
				addStatusCard(cards, 'Parallel Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			for (const thread of threads.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = thread.id || 'lane';
				const badge = document.createElement('span');
				const blocked = thread.resultStatus === 'failed' || thread.resultStatus === 'blocked' || (thread.riskCount ?? 0) > 0;
				badge.className = blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = [
					thread.resultStatus || thread.status || 'pending',
					thread.resultScore !== undefined ? 'score ' + thread.resultScore : undefined,
					thread.id === status.recommendedThreadId ? 'recommended' : undefined
				].filter(Boolean).join(' · ');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					'Role: ' + (thread.role || 'worker'),
					thread.branchName ? 'Branch: ' + thread.branchName : undefined,
					thread.worktreePath ? 'Worktree: ' + thread.worktreePath : undefined,
					thread.statusDetail,
					thread.resultSummary,
					Array.isArray(thread.changedFiles) && thread.changedFiles.length ? 'Files: ' + thread.changedFiles.slice(0, 8).join(', ') : undefined,
					thread.verificationCount !== undefined ? 'Verification count: ' + thread.verificationCount : undefined,
					thread.riskCount !== undefined ? 'Risk count: ' + thread.riskCount : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				lanesList.appendChild(item);
			}
		}
		function renderParallelReviewStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const missingThreads = Array.isArray(status.missingThreads) ? status.missingThreads : [];
			const ranking = Array.isArray(status.ranking) ? status.ranking : [];
			const results = Array.isArray(status.results) ? status.results : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-parallel-review-status]');
			const summary = document.querySelector('[data-parallel-review-status-summary]');
			const cards = document.querySelector('[data-parallel-review-status-cards]');
			const lanesList = document.querySelector('[data-parallel-review-status-lanes]');
			section.hidden = !status.ok && !status.taskId && !status.activeTaskId && !status.message;
			cards.textContent = '';
			lanesList.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Task: ' + (status.taskId || status.activeTaskId || 'none'),
				'Review source: ' + (status.reviewSource || 'missing'),
				'Plan available: ' + String(Boolean(status.hasPlan)),
				'Review available: ' + String(Boolean(status.hasReview)),
				'Results: ' + (status.resultCount ?? 0) + '/' + (status.expectedThreadCount ?? 0),
				status.recommendedThreadId ? 'Recommended lane: ' + status.recommendedThreadId : 'Recommended lane: none',
				'Merge ready: ' + String(Boolean(status.mergeReady))
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Lane Result Counts', String(status.resultCount ?? 0), [
				'Completed: ' + (counts.completed ?? 0),
				'Running: ' + (counts.running ?? 0),
				'Failed: ' + (counts.failed ?? 0),
				'Blocked: ' + (counts.blocked ?? 0),
				'Missing: ' + (counts.missing ?? missingThreads.length)
			].join('\\n'), (counts.failed ?? 0) > 0 || (counts.blocked ?? 0) > 0 || (counts.missing ?? 0) > 0);
			addStatusCard(cards, 'Judge Recommendation', status.recommendedThreadId || 'none', [
				'Merge ready: ' + String(Boolean(status.mergeReady)),
				'Review source: ' + (status.reviewSource || 'missing'),
				'Ranking returned: ' + ranking.length,
				'Results returned: ' + results.length
			].join('\\n'), !status.recommendedThreadId || !status.mergeReady);
			addStatusCard(cards, 'Merge Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n') || 'No merge blockers reported.', blockers.length > 0 || !status.mergeReady);
			if (missingThreads.length) {
				addStatusCard(cards, 'Missing Lanes', String(missingThreads.length), missingThreads.slice(0, 12).join('\\n'), true);
			}
			addStatusCard(cards, 'Read-Only Review Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Parallel review status is read-only.', false);
			const visibleLanes = ranking.length ? ranking : results.map((result, index) => ({
				rank: index + 1,
				threadId: result.threadId,
				resultStatus: result.status,
				score: result.score,
				summary: result.summary,
				changedFiles: result.changedFiles || [],
				verificationCount: (result.verification || []).length,
				riskCount: (result.risks || []).length,
				mergeCandidate: result.threadId === status.recommendedThreadId,
				blocked: result.status === 'failed' || result.status === 'blocked' || (result.risks || []).length > 0,
				rationale: result.risks || []
			}));
			for (const lane of visibleLanes.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = '#' + (lane.rank ?? '?') + ' ' + (lane.threadId || 'lane');
				const badge = document.createElement('span');
				badge.className = lane.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = (lane.mergeCandidate ? 'recommended · ' : '') + (lane.resultStatus || 'unknown') + (lane.score !== undefined ? ' · ' + lane.score : '');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					lane.summary,
					lane.role ? 'Role: ' + lane.role : undefined,
					lane.threadStatus ? 'Thread status: ' + lane.threadStatus : undefined,
					lane.branchName ? 'Branch: ' + lane.branchName : undefined,
					lane.worktreePath ? 'Worktree: ' + lane.worktreePath : undefined,
					Array.isArray(lane.changedFiles) && lane.changedFiles.length ? 'Files: ' + lane.changedFiles.slice(0, 8).join(', ') : undefined,
					'Verification count: ' + (lane.verificationCount ?? 0),
					'Risk count: ' + (lane.riskCount ?? 0),
					Array.isArray(lane.rationale) && lane.rationale.length ? 'Rationale:\\n' + lane.rationale.slice(0, 6).join('\\n') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				lanesList.appendChild(item);
			}
		}
		function renderParallelPlan(message) {
			const section = document.querySelector('[data-parallel]');
			const summary = document.querySelector('[data-parallel-summary]');
			const list = document.querySelector('[data-parallel-list]');
			const prepare = document.querySelector('[data-prepare-worktrees]');
			const cleanup = document.querySelector('[data-cleanup-worktrees]');
			const plan = message.plan || {};
			section.hidden = false;
			summary.textContent = message.summary || '';
			prepare.disabled = !plan.enabled;
			cleanup.disabled = !plan.enabled || !(plan.threads || []).some(thread => thread.status === 'materialized' || thread.status === 'failed');
			list.textContent = '';
			for (const thread of (plan.threads || []).slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card-detail';
				item.textContent = thread.id + ' [' + thread.role + '] ' + (thread.status || 'pending') + '\\n' + thread.branchName + (thread.worktreePath ? '\\n' + thread.worktreePath : '') + (thread.statusDetail ? '\\n' + thread.statusDetail : '');
				list.appendChild(item);
			}
		}
		function renderParallelReview(message) {
			const section = document.querySelector('[data-parallel]');
			const reviewContainer = document.querySelector('[data-parallel-review]');
			const review = message.review || {};
			section.hidden = false;
			reviewContainer.textContent = '';
			const summary = document.createElement('div');
			summary.className = 'card-detail';
			summary.textContent = message.summary || '';
			reviewContainer.appendChild(summary);
			for (const result of (review.results || []).slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = result.threadId;
				const badge = document.createElement('span');
				badge.className = result.status === 'failed' || result.status === 'blocked' ? 'badge risk-blocked' : 'badge';
				badge.textContent = (review.recommendedThreadId === result.threadId ? 'recommended · ' : '') + (result.status || 'completed') + (result.score !== undefined ? ' · score ' + result.score : '');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					result.summary,
					result.changedFiles?.length ? 'Files: ' + result.changedFiles.join(', ') : undefined,
					result.verification?.length ? 'Verification: ' + result.verification.join('; ') : undefined,
					result.risks?.length ? 'Risks: ' + result.risks.join('; ') : undefined
				].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const merge = document.createElement('button');
				merge.textContent = 'Request merge-back';
				merge.disabled = !(review.mergeReady && review.recommendedThreadId === result.threadId);
				merge.addEventListener('click', () => vscode.postMessage({ command: 'requestParallelMerge', threadId: result.threadId }));
				actions.appendChild(merge);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				reviewContainer.appendChild(item);
			}
		}
		function renderParallelMergeStatus(message) {
			const section = document.querySelector('[data-parallel]');
			const container = document.querySelector('[data-parallel-merge]');
			const status = message.status || {};
			const diffHandoff = status.diffHandoff || {};
			section.hidden = false;
			container.textContent = '';
			const item = document.createElement('div');
			item.className = 'card';
			const title = document.createElement('div');
			title.className = 'card-title';
			title.textContent = 'Merge-back status';
			const badge = document.createElement('span');
			badge.className = status.mergeReady ? 'badge' : 'badge risk-blocked';
			badge.textContent = status.mergeReady ? 'ready' : 'blocked';
			title.appendChild(badge);
			const detail = document.createElement('div');
			detail.className = 'card-detail';
			detail.textContent = [
				message.summary,
				status.selectedThreadId ? 'Selected: ' + status.selectedThreadId : 'Selected: none',
				status.recommendedThreadId ? 'Recommended: ' + status.recommendedThreadId : undefined,
				'Plan authorization: ' + (status.hasPlanAuthorization ? 'present' : 'missing'),
				diffHandoff.nextRoute ? 'Diff handoff: ' + diffHandoff.nextRoute : undefined,
				status.selectedResult ? 'Selected result: ' + status.selectedResult.summary : undefined,
				status.selectedResult?.changedFiles?.length ? 'Files: ' + status.selectedResult.changedFiles.join(', ') : undefined,
				status.blockers?.length ? 'Blockers: ' + status.blockers.join('; ') : undefined
			].filter(Boolean).join('\\n');
			item.appendChild(title);
			item.appendChild(detail);
			container.appendChild(item);
		}
		function renderParallelMergeReadiness(message) {
			const status = message.status || {};
			const selectedResult = status.selectedResult || {};
			const review = status.review || {};
			const diffHandoff = status.diffHandoff || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const selectedFiles = Array.isArray(selectedResult.changedFiles) ? selectedResult.changedFiles : [];
			const reviewBlockers = Array.isArray(review.blockers) ? review.blockers : [];
			const expectedResponses = Array.isArray(diffHandoff.expectedResponseMethods) ? diffHandoff.expectedResponseMethods : [];
			const handoffGuardrails = Array.isArray(diffHandoff.guardrails) ? diffHandoff.guardrails : [];
			const section = document.querySelector('[data-parallel-merge-status]');
			const summary = document.querySelector('[data-parallel-merge-status-summary]');
			const cards = document.querySelector('[data-parallel-merge-status-cards]');
			const reviewList = document.querySelector('[data-parallel-merge-status-review]');
			section.hidden = !status.ok && !status.taskId && !status.activeTaskId && !status.message;
			cards.textContent = '';
			reviewList.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			const selectedThread = status.selectedThreadId || 'none';
			const recommendedThread = status.recommendedThreadId || 'none';
			const laneAligned = Boolean(status.selectedThreadId && status.recommendedThreadId && status.selectedThreadId === status.recommendedThreadId);
			summary.textContent = [
				message.summary || status.message || '',
				'Task: ' + (status.taskId || status.activeTaskId || 'none'),
				'Selected lane: ' + selectedThread,
				'Recommended lane: ' + recommendedThread,
				'Approved plan authorization: ' + (status.hasPlanAuthorization ? 'present' : 'missing'),
				'Merge requested: ' + String(Boolean(status.mergeRequested)),
				'Merge ready: ' + String(Boolean(status.mergeReady)),
				diffHandoff.nextRoute ? 'Diff handoff: ' + diffHandoff.nextRoute : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Selected/Recommended Lane Alignment', laneAligned ? 'aligned' : 'blocked', [
				'Selected: ' + selectedThread,
				'Recommended: ' + recommendedThread,
				status.selectedAt ? 'Selected at: ' + new Date(status.selectedAt).toLocaleTimeString() : undefined,
				laneAligned ? 'The selected lane matches the judge recommendation.' : 'Merge-back waits until a selected lane matches the judge recommendation.'
			].filter(Boolean).join('\\n'), !laneAligned);
			addStatusCard(cards, 'Approved Plan Authorization', status.hasPlanAuthorization ? 'present' : 'missing', [
				'Exact rendered visual plan approval is required before merge-back.',
				'Plan authorization: ' + (status.hasPlanAuthorization ? 'present' : 'missing'),
				'Review merge ready: ' + String(Boolean(status.reviewMergeReady))
			].join('\\n'), !status.hasPlanAuthorization);
			addStatusCard(cards, 'Selected Result Coverage', selectedResult.threadId || 'missing', [
				selectedResult.summary || 'No selected result summary is available.',
				'Result status: ' + (selectedResult.status || 'missing'),
				'Changed files: ' + selectedFiles.length,
				'Verification count: ' + (selectedResult.verificationCount ?? 0),
				'Risk count: ' + (selectedResult.riskCount ?? 0)
			].join('\\n'), !selectedResult.threadId || selectedResult.status === 'failed' || selectedResult.status === 'blocked' || (selectedResult.riskCount ?? 0) > 0);
			addStatusCard(cards, 'Review Merge Gate', status.reviewMergeReady ? 'ready' : 'blocked', [
				'Review result count: ' + (review.resultCount ?? 0),
				review.recommendedThreadId ? 'Review recommended: ' + review.recommendedThreadId : 'No review recommendation yet.',
				review.createdAt ? 'Review created: ' + new Date(review.createdAt).toLocaleTimeString() : undefined,
				reviewBlockers.length ? 'Review blockers: ' + reviewBlockers.join('; ') : 'No review blockers reported.'
			].filter(Boolean).join('\\n'), !status.reviewMergeReady || reviewBlockers.length > 0);
			addStatusCard(cards, 'Diff Handoff', diffHandoff.nextRoute || (status.mergeReady ? 'review-first' : 'waiting'), [
				'Review-first: ' + String(diffHandoff.reviewFirst !== false),
				'Waiting for backend diff review: ' + String(Boolean(diffHandoff.waitingForDiffReview)),
				diffHandoff.receivedReviewId ? 'Received diff review: ' + diffHandoff.receivedReviewId : undefined,
				'Expected request: ' + (diffHandoff.expectedRequestMethod || 'agent/parallelMergeRequest'),
				expectedResponses.length ? 'Expected responses: ' + expectedResponses.join(', ') : undefined,
				'Normal diff review required: ' + String(diffHandoff.normalDiffReviewRequired !== false),
				'Checkpoint required: ' + String(diffHandoff.checkpointRequired !== false),
				'Accept/Reject required: ' + String(diffHandoff.acceptRejectRequired !== false),
				handoffGuardrails.length ? handoffGuardrails.join('\\n') : 'Merge-back requests must return a normal diff review before any file changes are applied.',
				'This readiness view does not apply patches or merge worktrees.'
			].filter(Boolean).join('\\n'), !status.mergeReady || !['await_backend_diff_review', 'await_diff_acceptance'].includes(diffHandoff.nextRoute));
			addStatusCard(cards, 'Read-Only Merge Guardrails', 'safe', [
				'Parallel merge status is read-only and never requests merge-back, applies diffs, stages, writes, deletes, checks out branches, or mutates worktrees.',
				'Use the Request merge-back action only after judge review, visual-plan authorization, and selected-result coverage are present.',
				'Lane output still enters normal diff review and checkpoint restore before final acceptance.'
			].join('\\n'), false);
			if (blockers.length) {
				addStatusCard(cards, 'Merge Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			if (selectedResult.threadId) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = selectedResult.threadId;
				const badge = document.createElement('span');
				const blocked = selectedResult.status === 'failed' || selectedResult.status === 'blocked' || (selectedResult.riskCount ?? 0) > 0;
				badge.className = blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = (selectedResult.status || 'unknown') + (selectedResult.score !== undefined ? ' · score ' + selectedResult.score : '');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					selectedResult.summary,
					selectedFiles.length ? 'Files: ' + selectedFiles.slice(0, 12).join(', ') : undefined,
					'Verification count: ' + (selectedResult.verificationCount ?? 0),
					'Risk count: ' + (selectedResult.riskCount ?? 0)
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				reviewList.appendChild(item);
			}
		}
		function renderVerificationPlan(message) {
			const section = document.querySelector('[data-verification]');
			const summary = document.querySelector('[data-verification-summary]');
			const list = document.querySelector('[data-verification-list]');
			const plan = message.plan || {};
			section.hidden = false;
			summary.textContent = message.summary || [
				(plan.checks || []).length + ' verification checks',
				plan.diagnosticsBaseline ? 'Diagnostics baseline: ' + plan.diagnosticsBaseline.error + ' error, ' + plan.diagnosticsBaseline.warning + ' warning' : ''
			].filter(Boolean).join('\\n');
			list.textContent = '';
			for (const check of (plan.checks || []).slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = check.label;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = (check.required ? 'required' : 'optional') + ' · ' + check.kind + ' · ' + (check.status || 'pending');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [check.command || check.source || '', check.evidence].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				if (check.command) {
					const run = document.createElement('button');
					run.textContent = 'Run';
					run.addEventListener('click', () => vscode.postMessage({ command: 'runVerificationCheck', checkId: check.id }));
					actions.appendChild(run);
				}
				for (const status of ['passed', 'failed', 'skipped']) {
					const button = document.createElement('button');
					button.className = 'secondary';
					button.textContent = status.charAt(0).toUpperCase() + status.slice(1);
					button.addEventListener('click', () => vscode.postMessage({ command: 'recordVerificationCheck', checkId: check.id, status }));
					actions.appendChild(button);
				}
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderVerificationStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-verification-status]');
			const summary = document.querySelector('[data-verification-status-summary]');
			const cards = document.querySelector('[data-verification-status-cards]');
			const checksList = document.querySelector('[data-verification-status-checks]');
			section.hidden = !status;
			cards.textContent = '';
			checksList.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			const delivery = status.deliveryBar || {};
			const smoke = status.smokeBenchmark || {};
			const finalReview = status.finalReview || {};
			summary.textContent = [
				message.summary || status.message || '',
				'Required verification: ' + (counts.passed ?? 0) + '/' + (counts.required ?? 0) + ' passed',
				'Failed/running/pending: ' + (counts.failed ?? 0) + '/' + (counts.running ?? 0) + '/' + (counts.pending ?? 0),
				'Delivery Bar: ' + (delivery.ready ? 'ready' : delivery.blocked ? 'blocked' : delivery.summary ? 'pending' : 'unknown'),
				'Smoke Benchmark: ' + (smoke.ready ? 'ready' : smoke.summary ? 'pending' : 'unknown'),
				'Final Review: ' + (finalReview.decision || 'unknown')
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Verification Checks', (counts.passed ?? 0) + '/' + (counts.required ?? 0), [
				'Total: ' + (counts.total ?? 0),
				'Required: ' + (counts.required ?? 0),
				'Pending: ' + (counts.pending ?? 0),
				'Running: ' + (counts.running ?? 0),
				'Failed: ' + (counts.failed ?? 0),
				'Skipped: ' + (counts.skipped ?? 0)
			].join('\\n'), (counts.failed || 0) > 0 || (counts.pending || 0) > 0 || (counts.running || 0) > 0);
			addStatusCard(cards, 'Delivery Gates', delivery.ready ? 'ready' : delivery.blocked ? 'blocked' : 'pending', [
				delivery.summary,
				smoke.summary,
				finalReview.summary,
				finalReview.nextAction ? 'Next: ' + finalReview.nextAction : undefined
			].filter(Boolean).join('\\n'), !delivery.ready || finalReview.decision === 'block');
			addStatusCard(cards, 'Read-Only Guardrails', String((status.guardrails || []).length), (status.guardrails || []).slice(0, 4).join('\\n'), false);
			if (status.diagnosticsSnapshot) {
				addStatusCard(cards, 'Diagnostics Snapshot', String(status.diagnosticsSnapshot.errors || 0) + ' errors', [
					'Warnings: ' + (status.diagnosticsSnapshot.warnings || 0),
					status.diagnosticsSnapshot.summary
				].filter(Boolean).join('\\n'), (status.diagnosticsSnapshot.errors || 0) > 0);
			}
			for (const check of (status.checks || []).slice(0, 12)) {
				addStatusCard(checksList, check.label || check.id || 'Verification check', (check.required ? 'required' : 'optional') + ' - ' + (check.status || 'pending'), [
					check.command || check.source,
					check.evidence
				].filter(Boolean).join('\\n'), check.required && check.status !== 'passed');
			}
		}
		function renderAcceptanceCriteriaStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-acceptance-criteria-status]');
			const summary = document.querySelector('[data-acceptance-criteria-summary]');
			const cards = document.querySelector('[data-acceptance-criteria-cards]');
			const list = document.querySelector('[data-acceptance-criteria-list]');
			const counts = status.counts || {};
			const criteria = Array.isArray(status.criteria) ? status.criteria : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = !status.ok && !criteria.length && !blockers.length;
			cards.textContent = '';
			list.textContent = '';
			if (section.hidden) {
				summary.textContent = '';
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Ready: ' + String(Boolean(status.ready)),
				'Coverage: ' + (counts.covered ?? 0) + '/' + (counts.total ?? 0),
				'Required passed: ' + (counts.passed ?? 0) + '/' + (counts.required ?? 0),
				'Blocking: ' + (counts.blocking ?? blockers.length),
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Criteria Gate', status.ready ? 'ready' : status.coverageComplete ? 'covered' : 'missing', [
				status.summary,
				'Coverage complete: ' + String(Boolean(status.coverageComplete)),
				'Missing: ' + (counts.missing ?? 0),
				'Pending/running/failed/skipped: ' + [counts.pending ?? 0, counts.running ?? 0, counts.failed ?? 0, counts.skipped ?? 0].join('/')
			].filter(Boolean).join('\\n'), !status.ready);
			addStatusCard(cards, 'Read-Only Guardrails', String(guardrails.length), guardrails.slice(0, 4).join('\\n'), false);
			if (blockers.length) {
				addStatusCard(cards, 'Blocking Criteria', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			for (const item of criteria.slice(0, 12)) {
				addStatusCard(list, item.criterion || item.label || 'Acceptance criterion', (item.required ? 'required' : 'optional') + ' - ' + (item.status || 'missing'), [
					item.checkId ? 'Check: ' + item.checkId : 'No linked verification check.',
					item.label,
					item.source,
					item.lastRunId ? 'Run: ' + item.lastRunId : undefined,
					item.evidence,
					Array.isArray(item.blockers) && item.blockers.length ? 'Blockers: ' + item.blockers.join('\\n') : undefined
				].filter(Boolean).join('\\n'), item.required && item.status !== 'passed');
			}
		}
		function renderCustomModes(message) {
			const section = document.querySelector('[data-custom-modes]');
			const summary = document.querySelector('[data-custom-modes-summary]');
			const list = document.querySelector('[data-custom-modes-list]');
			const catalog = message.catalog || {};
			const modes = catalog.modes || [];
			section.hidden = modes.length === 0;
			summary.textContent = message.summary || (modes.length ? modes.length + ' custom modes indexed.' : '');
			list.textContent = '';
			for (const mode of modes.slice(0, 16)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = mode.name || mode.slug;
				const badge = document.createElement('span');
				badge.className = mode.readOnly ? 'badge' : 'badge ok';
				badge.textContent = (mode.readOnly ? 'read-only' : 'plan-gated tools') + ' · ' + mode.slug;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					'Source: ' + mode.source,
					(mode.groups || []).length ? 'Groups: ' + mode.groups.join(', ') : undefined,
					mode.whenToUse ? 'When: ' + mode.whenToUse : undefined,
					mode.roleDefinition,
					mode.customInstructions
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderDeliveryBar(state) {
			const section = document.querySelector('[data-delivery-bar]');
			const summary = document.querySelector('[data-delivery-summary]');
			const list = document.querySelector('[data-delivery-list]');
			section.hidden = !state;
			list.textContent = '';
			summary.textContent = state ? state.summary : '';
			if (!state) {
				return;
			}
			for (const check of state.checks || []) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = check.title;
				const badge = document.createElement('span');
				badge.className = check.status === 'failed' ? 'badge risk-blocked' : 'badge';
				badge.textContent = (check.required ? 'required' : 'optional') + ' · ' + check.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = check.detail || '';
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderDeliveryBarStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-delivery-bar-status]');
			const summary = document.querySelector('[data-delivery-bar-status-summary]');
			const cards = document.querySelector('[data-delivery-bar-status-cards]');
			const checksList = document.querySelector('[data-delivery-bar-status-checks]');
			section.hidden = !status;
			cards.textContent = '';
			checksList.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			summary.textContent = [
				message.summary || status.message || '',
				'State: ' + (status.state || 'unknown'),
				'Ready: ' + String(Boolean(status.ready)),
				'Blocked: ' + String(Boolean(status.blocked)),
				'Required checks: ' + (counts.passed ?? 0) + '/' + (counts.required ?? 0) + ' passed',
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Delivery Bar Gate', status.ready ? 'ready' : status.blocked ? 'blocked' : status.state || 'pending', [
				status.summary,
				'Blocking required checks: ' + (counts.blocking ?? 0),
				'Optional checks: ' + (counts.optional ?? 0),
				'Failed: ' + (counts.failed ?? 0),
				'Skipped: ' + (counts.skipped ?? 0)
			].filter(Boolean).join('\\n'), !status.ready);
			addStatusCard(cards, 'Status Counts', String(counts.total ?? 0), [
				'Required: ' + (counts.required ?? 0),
				'Passed: ' + (counts.passed ?? 0),
				'Pending: ' + (counts.pending ?? 0),
				'Failed: ' + (counts.failed ?? 0),
				'Skipped: ' + (counts.skipped ?? 0)
			].join('\\n'), (counts.blocking || 0) > 0);
			addStatusCard(cards, 'Delivery Guardrails', String((status.guardrails || []).length), (status.guardrails || []).slice(0, 4).join('\\n'), false);
			const blockers = status.blockers || [];
			if (blockers.length) {
				addStatusCard(checksList, 'Required Blockers', String(blockers.length), blockers.slice(0, 8).map(check => [
					check.title + ' - ' + check.status,
					check.detail
				].filter(Boolean).join(' - ')).join('\\n'), true);
			}
			for (const check of (status.checks || []).slice(0, 12)) {
				addStatusCard(checksList, check.title || check.id || 'Delivery check', (check.required ? 'required' : 'optional') + ' - ' + (check.status || 'pending'), check.detail || '', check.required && check.status !== 'passed');
			}
		}
		function renderSmokeBenchmark(state) {
			const section = document.querySelector('[data-smoke-benchmark]');
			const summary = document.querySelector('[data-smoke-summary]');
			const list = document.querySelector('[data-smoke-list]');
			section.hidden = !state;
			list.textContent = '';
			summary.textContent = state ? state.summary : '';
			if (!state) {
				return;
			}
			for (const milestone of state.milestones || []) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = milestone.title;
				const badge = document.createElement('span');
				badge.className = milestone.status === 'failed' ? 'badge risk-blocked' : 'badge';
				badge.textContent = (milestone.required ? 'required' : 'optional') + ' · ' + milestone.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = milestone.evidence || '';
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderSmokeBenchmarkStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-smoke-benchmark-status]');
			const summary = document.querySelector('[data-smoke-benchmark-status-summary]');
			const cards = document.querySelector('[data-smoke-benchmark-status-cards]');
			const list = document.querySelector('[data-smoke-benchmark-status-milestones]');
			const counts = status.counts || {};
			const milestones = Array.isArray(status.milestones) ? status.milestones : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = !status.ok;
			cards.textContent = '';
			list.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'State: ' + (status.state || 'unknown'),
				'Required milestones: ' + (counts.passed ?? 0) + '/' + (counts.required ?? 0) + ' passed',
				'Blocking: ' + (counts.blocking ?? blockers.length),
				'Next: ' + (status.nextAction || '')
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Smoke Benchmark Gate', status.ready ? 'ready' : status.blocked ? 'blocked' : 'pending', [
				status.summary,
				'Total: ' + (counts.total ?? 0),
				'Required: ' + (counts.required ?? 0),
				'Optional: ' + (counts.optional ?? 0),
				'Passed/pending/failed/skipped: ' + [counts.passed ?? 0, counts.pending ?? 0, counts.failed ?? 0, counts.skipped ?? 0].join('/')
			].filter(Boolean).join('\\n'), !status.ready);
			addStatusCard(cards, 'Completion Guardrail', status.promptBlock ? 'prompt-ready' : 'read-only', [
				'Smoke status is advisory until Delivery Bar, Commit Handoff, Final Review, and task completion gates pass.',
				status.promptBlock ? 'Backend prompt block is available.' : 'Sidebar status is local-only.',
				guardrails.slice(0, 3).join('\\n')
			].filter(Boolean).join('\\n'), false);
			if (blockers.length) {
				addStatusCard(cards, 'Blocking Milestones', String(blockers.length), blockers.slice(0, 8).map(milestone => [
					milestone.title || milestone.id || 'Milestone',
					milestone.status || 'pending',
					milestone.evidence || ''
				].filter(Boolean).join(' - ')).join('\\n'), true);
			}
			for (const milestone of milestones.slice(0, 12)) {
				addStatusCard(list, milestone.title || milestone.id || 'Smoke milestone', (milestone.required ? 'required' : 'optional') + ' - ' + (milestone.status || 'pending'), milestone.evidence || '', milestone.required && milestone.status !== 'passed');
			}
		}
		function renderWorkflowStatus(status) {
			const section = document.querySelector('[data-workflow-status]');
			const summary = document.querySelector('[data-workflow-summary]');
			const counts = document.querySelector('[data-workflow-counts]');
			const readinessCards = document.querySelector('[data-workflow-readiness]');
			const list = document.querySelector('[data-workflow-list]');
			const evidence = document.querySelector('[data-workflow-evidence]');
			const guardrails = document.querySelector('[data-workflow-guardrails]');
			section.hidden = !status;
			readinessCards.textContent = '';
			list.textContent = '';
			evidence.textContent = '';
			guardrails.textContent = '';
			counts.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const readiness = status.readiness || {};
			const guardrailItems = Array.isArray(status.guardrails) ? status.guardrails : [];
			const stage = status.stage || 'unknown';
			summary.textContent = [
				'Stage: ' + stage,
				status.summary,
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			const countState = status.counts || {};
			counts.textContent = [
				'Milestones: ' + (countState.completedMilestones ?? 0) + ' complete, ' + (countState.pendingMilestones ?? 0) + ' pending, ' + ((countState.failedMilestones ?? 0) + (countState.blockedMilestones ?? 0)) + ' blocked/failed',
				'Verification: ' + (countState.passedRequiredVerificationChecks ?? 0) + '/' + (countState.requiredVerificationChecks ?? 0) + ' required checks passed',
				'Diffs: ' + (countState.acceptedDiffFiles ?? 0) + '/' + (countState.diffFiles ?? 0) + ' accepted; ' + (countState.pendingDiffFiles ?? 0) + ' pending',
				'Terminals: ' + (countState.terminalRuns ?? 0) + ' total; ' + (countState.runningTerminalRuns ?? 0) + ' running'
			].join('\\n');
			const workflowReadinessOrder = [
				['Native Prompt', readiness.prompt],
				['Visual Plan', readiness.visualPlan],
				['Exact Plan Approval', readiness.approvedPlan],
				['Approval-Gated Execution', readiness.execution],
				['Terminal/Test Verification', readiness.terminalVerification],
				['Diff Review', readiness.diffReview],
				['Rollback Checkpoint', readiness.rollbackCheckpoint],
				['Parallel Merge', readiness.parallelMerge],
				['Final Review', readiness.finalReview]
			];
			for (const [label, item] of workflowReadinessOrder) {
				if (!item) {
					continue;
				}
				const blocked = !item.ready && item.status !== 'skipped' && item.status !== 'completed';
				addStatusCard(readinessCards, label, item.status || (item.ready ? 'ready' : 'pending'), item.detail || '', blocked);
			}
			addStatusCard(readinessCards, 'Workflow Proof Readiness', stage, [
				'Next action: ' + (status.nextAction || 'unknown'),
				'Complete stage is informational until task completion is explicitly accepted.',
				'Milestones, evidence, terminal output, diagnostics, and file paths are redacted and bounded.'
			].join('\\n'), stage === 'blocked');
			for (const milestone of (status.milestones || []).slice(0, 14)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = milestone.title || milestone.id;
				const badge = document.createElement('span');
				badge.className = milestone.status === 'blocked' || milestone.status === 'failed' ? 'badge risk-blocked' : 'badge';
				badge.textContent = (milestone.required ? 'required' : 'optional') + ' · ' + milestone.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					milestone.detail,
					Array.isArray(milestone.evidence) && milestone.evidence.length ? 'Evidence: ' + milestone.evidence.slice(0, 2).join('\\n') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
			if (Array.isArray(status.evidence) && status.evidence.length) {
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = 'Lifecycle evidence:\\n' + status.evidence.slice(0, 8).join('\\n');
				evidence.appendChild(detail);
			}
			if (guardrailItems.length) {
				addStatusCard(guardrails, 'Read-Only Workflow Guardrails', String(guardrailItems.length), guardrailItems.slice(0, 6).join('\\n'), false);
			}
		}
		function renderHappyPathStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-happy-path-status]');
			const summary = document.querySelector('[data-happy-path-summary]');
			const cards = document.querySelector('[data-happy-path-cards]');
			const gates = document.querySelector('[data-happy-path-gates]');
			const evidence = document.querySelector('[data-happy-path-evidence]');
			const gateItems = Array.isArray(status.gates) ? status.gates : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const evidenceItems = Array.isArray(status.evidence) ? status.evidence : [];
			const counts = status.counts || {};
			section.hidden = !status.ok && gateItems.length === 0;
			cards.textContent = '';
			gates.textContent = '';
			evidence.textContent = '';
			if (section.hidden) {
				summary.textContent = '';
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Route: ' + (status.route || 'unknown'),
				'Ready: ' + String(Boolean(status.ready)),
				'Required gates: ' + (counts.ready ?? 0) + '/' + (counts.required ?? 0),
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Dispatch Route', status.route || 'unknown', [
				status.summary,
				'Blocked: ' + String(Boolean(status.blocked)),
				'Pending/blocked/failed: ' + [counts.pending ?? 0, counts.blocked ?? 0, counts.failed ?? 0].join('/'),
				'Skipped optional gates: ' + (counts.skipped ?? 0)
			].filter(Boolean).join('\\n'), status.blocked || status.route === 'blocked');
			addStatusCard(cards, 'Minimum Delivery Proof', status.ready ? 'ready' : 'pending', [
				'Native prompt -> visual plan -> approval -> parallel-safe execution -> terminal verification -> diff review -> rollback -> commit handoff -> Final Review.',
				'Task completion remains gated by task_completion_status or attempt_completion.'
			].join('\\n'), !status.ready);
			if (blockers.length) {
				addStatusCard(cards, 'Route Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			if (guardrails.length) {
				addStatusCard(cards, 'Read-Only Proof Guardrails', String(guardrails.length), guardrails.slice(0, 6).join('\\n'), false);
			}
			for (const gate of gateItems.slice(0, 14)) {
				addStatusCard(gates, gate.title || gate.id || 'Happy path gate', (gate.required ? 'required' : 'optional') + ' - ' + (gate.status || 'pending'), [
					'Route: ' + (gate.route || 'unknown'),
					gate.detail,
					Array.isArray(gate.evidence) && gate.evidence.length ? 'Evidence: ' + gate.evidence.slice(0, 2).join('\\n') : undefined
				].filter(Boolean).join('\\n'), gate.required && !gate.ready && gate.status !== 'skipped');
			}
			if (evidenceItems.length) {
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = 'Happy Path evidence:\\n' + evidenceItems.slice(0, 8).join('\\n');
				evidence.appendChild(detail);
			}
		}
		function renderFinalReview(review) {
			const section = document.querySelector('[data-final-review]');
			const summary = document.querySelector('[data-final-review-summary]');
			const list = document.querySelector('[data-final-review-list]');
			section.hidden = !review;
			list.textContent = '';
			summary.textContent = review ? review.summary + '\\n' + (review.nextAction || '') : '';
			if (!review) {
				return;
			}
			for (const itemState of review.items || []) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = itemState.title;
				const badge = document.createElement('span');
				badge.className = itemState.status === 'blocked' ? 'badge risk-blocked' : 'badge';
				badge.textContent = (itemState.required ? 'required' : 'optional') + ' · ' + itemState.status;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = itemState.detail || '';
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderFinalReviewStatus(message) {
			const status = message.status || {};
			const review = status.finalReview || {};
			const items = Array.isArray(review.items) ? review.items : [];
			const evidenceItems = Array.isArray(review.evidence) ? review.evidence : [];
			const guardrailItems = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-final-review-status]');
			const summary = document.querySelector('[data-final-review-status-summary]');
			const cards = document.querySelector('[data-final-review-status-cards]');
			const list = document.querySelector('[data-final-review-status-items]');
			const evidence = document.querySelector('[data-final-review-status-evidence]');
			section.hidden = !status.ok && !review.summary;
			cards.textContent = '';
			list.textContent = '';
			evidence.textContent = '';
			if (section.hidden) {
				summary.textContent = '';
				return;
			}
			const blocked = review.decision !== 'pass' || !review.ready;
			summary.textContent = [
				message.summary || status.summary || review.summary || '',
				'Decision: ' + (review.decision || 'unknown'),
				'Ready: ' + String(Boolean(review.ready)),
				'Next: ' + (review.nextAction || 'Resolve final-review blockers before completion.')
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Strict Final Review Gate', blocked ? 'blocked' : 'pass', [
				'Completion must not be reported unless this decision is pass.',
				'Ready: ' + String(Boolean(review.ready)),
				'Blocked: ' + String(Boolean(review.blocked)),
				'Item count: ' + items.length
			].join('\\n'), blocked);
			addStatusCard(cards, 'Prompt Block Readiness', status.finalReviewPromptBlock ? 'available' : 'missing', [
				'The backend receives a redacted final-review prompt block when requested.',
				'Prompt block is not an approval token and cannot accept completion.',
				'Verification checks returned: ' + (status.counts?.total ?? 0)
			].join('\\n'), !status.finalReviewPromptBlock);
			if (status.deliveryBar) {
				addStatusCard(cards, 'Delivery Bar Link', status.deliveryBar.ready ? 'ready' : status.deliveryBar.blocked ? 'blocked' : 'pending', status.deliveryBar.summary || '', !status.deliveryBar.ready);
			}
			if (status.smokeBenchmark) {
				addStatusCard(cards, 'Smoke Benchmark Link', status.smokeBenchmark.ready ? 'ready' : 'blocked', status.smokeBenchmark.summary || '', !status.smokeBenchmark.ready);
			}
			if (guardrailItems.length) {
				addStatusCard(cards, 'Read-Only Final Review Guardrails', String(guardrailItems.length), guardrailItems.slice(0, 6).join('\\n'), false);
			}
			for (const itemState of items.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = itemState.title || itemState.id || 'Final Review item';
				const badge = document.createElement('span');
				badge.className = itemState.status === 'blocked' ? 'badge risk-blocked' : 'badge';
				badge.textContent = (itemState.required ? 'required' : 'optional') + ' · ' + (itemState.status || 'pending');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = itemState.detail || '';
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
			if (evidenceItems.length) {
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = 'Final Review evidence:\\n' + evidenceItems.slice(0, 8).join('\\n');
				evidence.appendChild(detail);
			}
		}
		function renderTaskCompletionGate(message) {
			const response = message?.response;
			const section = document.querySelector('[data-task-completion-gate]');
			const summary = document.querySelector('[data-task-completion-summary]');
			const counts = document.querySelector('[data-task-completion-counts]');
			const blockers = document.querySelector('[data-task-completion-blockers]');
			const evidence = document.querySelector('[data-task-completion-evidence]');
			section.hidden = !response;
			blockers.textContent = '';
			evidence.textContent = '';
			counts.textContent = '';
			if (!response) {
				summary.textContent = '';
				return;
			}
			const badge = response.accepted ? 'accepted' : 'blocked';
			summary.textContent = [
				'Decision: ' + response.decision + ' · ' + response.completionKind + ' · ' + badge,
				response.message,
				message.summary,
				response.nextAction ? 'Next: ' + response.nextAction : undefined
			].filter(Boolean).join('\\n');
			const gate = response.gate || {};
			counts.textContent = [
				'Final Review: ' + (gate.decision || 'unknown') + (gate.ready ? ' ready' : ' not ready'),
				'Required: ' + (gate.passed ?? 0) + '/' + (gate.required ?? 0) + ' passed; ' + (gate.pending ?? 0) + ' pending; ' + (gate.blocked ?? 0) + ' blocked',
				(gate.pendingIds || []).length ? 'Pending ids: ' + gate.pendingIds.join(', ') : undefined,
				(gate.blockerIds || []).length ? 'Blocked ids: ' + gate.blockerIds.join(', ') : undefined
			].filter(Boolean).join('\\n');
			for (const blocker of (response.blockers || []).slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'Completion blocker';
				const status = document.createElement('span');
				status.className = 'badge risk-blocked';
				status.textContent = 'required';
				title.appendChild(status);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = blocker;
				item.appendChild(title);
				item.appendChild(detail);
				blockers.appendChild(item);
			}
			if (Array.isArray(gate.evidence) && gate.evidence.length) {
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = 'Gate evidence:\\n' + gate.evidence.slice(0, 8).join('\\n');
				evidence.appendChild(detail);
			}
		}
		function renderTaskCompletionStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-task-completion-status]');
			const summary = document.querySelector('[data-task-completion-status-summary]');
			const cards = document.querySelector('[data-task-completion-status-cards]');
			const blockersList = document.querySelector('[data-task-completion-status-blockers]');
			section.hidden = !status;
			cards.textContent = '';
			blockersList.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const gate = status.gate || {};
			const latest = status.latest || {};
			summary.textContent = [
				message.summary || status.message || '',
				'State: ' + (status.state || 'unknown'),
				'Ready: ' + String(Boolean(status.ready)),
				'Accepted: ' + String(Boolean(status.accepted)),
				'Final Review: ' + (gate.decision || 'unknown') + (gate.ready ? ' ready' : ' not ready'),
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Final Review Gate', gate.ready ? 'ready' : gate.decision || 'blocked', [
				'Required: ' + (gate.passed ?? 0) + '/' + (gate.required ?? 0) + ' passed',
				'Pending: ' + (gate.pending ?? 0),
				'Blocked: ' + (gate.blocked ?? 0),
				(gate.pendingIds || []).length ? 'Pending ids: ' + gate.pendingIds.join(', ') : undefined,
				(gate.blockerIds || []).length ? 'Blocked ids: ' + gate.blockerIds.join(', ') : undefined
			].filter(Boolean).join('\\n'), !gate.ready);
			addStatusCard(cards, 'Latest Completion Attempt', status.latestAttempt ? (latest.accepted ? 'accepted' : latest.decision || 'blocked') : 'none', [
				latest.completionKind ? 'Kind: ' + latest.completionKind : 'No attempt has been made.',
				latest.message,
				latest.nextAction ? 'Next: ' + latest.nextAction : undefined,
				latest.advisoryReason ? 'Advisory: ' + latest.advisoryReason : undefined
			].filter(Boolean).join('\\n'), status.latestAttempt && !latest.accepted);
			addStatusCard(cards, 'Completion Guardrails', String((status.guardrails || []).length), (status.guardrails || []).slice(0, 4).join('\\n'), false);
			const blockers = status.blockers || [];
			if (blockers.length) {
				addStatusCard(blockersList, 'Completion Blockers', String(blockers.length), blockers.slice(0, 10).join('\\n'), true);
			}
			if ((status.evidence || []).length) {
				addStatusCard(blockersList, 'Completion Evidence', String(status.evidence.length), status.evidence.slice(0, 8).join('\\n'), false);
			}
		}
		function renderCommitHandoff(handoff) {
			const section = document.querySelector('[data-commit-handoff]');
			const summary = document.querySelector('[data-commit-summary]');
			const message = document.querySelector('[data-commit-message]');
			const evidence = document.querySelector('[data-commit-evidence]');
			const copy = document.querySelector('[data-copy-commit]');
			section.hidden = !handoff;
			evidence.textContent = '';
			if (!handoff) {
				summary.textContent = '';
				message.textContent = '';
				copy.disabled = true;
				return;
			}
			copy.disabled = !handoff.message;
			summary.textContent = [
				handoff.summary,
				handoff.ready ? 'Ready for SCM review.' : (handoff.blockers || []).join('\\n')
			].filter(Boolean).join('\\n');
			message.textContent = handoff.message || '';
			const detail = document.createElement('div');
			detail.className = 'card';
			const title = document.createElement('div');
			title.className = 'card-title';
			title.textContent = 'Evidence and commands';
			const body = document.createElement('div');
			body.className = 'card-detail';
			body.textContent = [
				...(handoff.evidence || []),
				'Commands:',
				...(handoff.commands || [])
			].join('\\n');
			detail.appendChild(title);
			detail.appendChild(body);
			evidence.appendChild(detail);
		}
		function renderCommitHandoffStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const acceptedFiles = Array.isArray(status.acceptedFiles) ? status.acceptedFiles : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const evidence = Array.isArray(status.evidence) ? status.evidence : [];
			const commands = Array.isArray(status.commands) ? status.commands : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-commit-handoff-status]');
			const summary = document.querySelector('[data-commit-handoff-status-summary]');
			const cards = document.querySelector('[data-commit-handoff-status-cards]');
			const files = document.querySelector('[data-commit-handoff-status-files]');
			section.hidden = !status.ok && acceptedFiles.length === 0 && blockers.length === 0;
			cards.textContent = '';
			files.textContent = '';
			summary.textContent = [
				message.summary || status.summary || '',
				status.ready ? 'Ready for SCM review.' : 'Commit handoff blocked.',
				'Accepted files: ' + (counts.acceptedFiles ?? acceptedFiles.length),
				'Blockers: ' + (counts.blockers ?? blockers.length),
				'Evidence: ' + (counts.evidence ?? evidence.length),
				'Commands: ' + (counts.commands ?? commands.length),
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Commit Readiness', status.ready ? 'ready' : 'blocked', [
				status.summary,
				status.nextAction
			].filter(Boolean).join('\\n'), !status.ready);
			addStatusCard(cards, 'Accepted Files', String(counts.acceptedFiles ?? acceptedFiles.length), acceptedFiles.length ? acceptedFiles.slice(0, 12).join('\\n') : 'No accepted file paths are ready for handoff yet.', acceptedFiles.length === 0);
			addStatusCard(cards, 'Prepared Message', status.message ? 'available' : 'missing', status.message || 'No commit message is prepared yet.', !status.message);
			addStatusCard(cards, 'Read-only Guardrails', String(guardrails.length), guardrails.length ? guardrails.slice(0, 5).join('\\n') : 'Commit handoff status never stages or commits files.', false);
			if (blockers.length) {
				addStatusCard(files, 'Blockers', String(blockers.length), blockers.slice(0, 12).join('\\n'), true);
			}
			if (evidence.length) {
				addStatusCard(files, 'Evidence', String(evidence.length), evidence.slice(0, 10).join('\\n'), false);
			}
			if (commands.length) {
				addStatusCard(files, 'Prepared Commands', String(commands.length), commands.slice(0, 8).join('\\n'), false);
			}
			for (const file of acceptedFiles.slice(0, 12)) {
				addStatusCard(files, file, 'accepted', 'Included in commit handoff for human SCM review.', false);
			}
		}
		function renderAutoCommitStatus(message) {
			const response = message.response || {};
			const section = document.querySelector('[data-auto-commit-status]');
			const summary = document.querySelector('[data-auto-commit-summary]');
			const cards = document.querySelector('[data-auto-commit-cards]');
			const blockers = document.querySelector('[data-auto-commit-blockers]');
			const evidence = document.querySelector('[data-auto-commit-evidence]');
			const commands = document.querySelector('[data-auto-commit-commands]');
			section.hidden = !response;
			cards.textContent = '';
			blockers.textContent = '';
			evidence.textContent = '';
			commands.textContent = '';
			if (!response) {
				summary.textContent = '';
				return;
			}
			const counts = response.counts || {};
			const mode = response.mode || {};
			const finalReview = response.finalReview || {};
			const handoff = response.commitHandoff || {};
			const blockerList = Array.isArray(response.blockers) ? response.blockers : [];
			const commandList = Array.isArray(response.commands) ? response.commands : [];
			const evidenceList = Array.isArray(response.evidence) ? response.evidence : [];
			const guardrails = Array.isArray(response.guardrails) ? response.guardrails : [];
			summary.textContent = [
				message.summary || '',
				response.enabled ? 'Opt-in setting: enabled' : 'Opt-in setting: disabled',
				response.ready ? 'Ready for explicit commit approval.' : 'Blocked from auto-commit.',
				'Workspace trust: ' + (response.workspaceTrusted ? 'trusted' : 'untrusted'),
				'Plan authorization: ' + (response.hasPlanAuthorization ? 'approved' : 'missing'),
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				'Final Review: ' + (finalReview.decision || 'unknown') + (finalReview.ready ? ' ready' : ' not ready'),
				'Commit Handoff: ' + (handoff.ready ? 'ready' : 'not ready') + ' · ' + (counts.acceptedFiles ?? 0) + ' accepted file' + ((counts.acceptedFiles ?? 0) === 1 ? '' : 's'),
				response.nextAction ? 'Next: ' + response.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Auto-Commit Execution Plan', response.ready ? 'ready' : 'blocked', [
				response.enabled ? 'Opt-in setting is enabled.' : 'Opt-in setting is disabled.',
				response.workspaceTrusted ? 'Workspace is trusted.' : 'Workspace is not trusted.',
				response.hasPlanAuthorization ? 'Exact visual plan revision is approved.' : 'Exact visual plan revision is not approved.',
				response.nextAction
			].filter(Boolean).join('\\n'), !response.ready);
			addStatusCard(cards, 'Mode / Plan Locks', mode.allowsTerminalRequests && response.hasPlanAuthorization ? 'clear' : 'locked', [
				'Mode: ' + (mode.label || mode.mode || 'unknown'),
				mode.readOnly ? 'Read-only mode is active.' : 'Mode permits mutation after approval gates.',
				mode.allowsTerminalRequests ? 'Terminal requests can be offered through approval.' : 'Terminal requests are blocked by mode policy.',
				response.hasPlanAuthorization ? 'Plan approval token exists.' : 'Plan approval token is missing.'
			].join('\\n'), !mode.allowsTerminalRequests || !response.hasPlanAuthorization);
			addStatusCard(cards, 'Final Review Gate', finalReview.ready && finalReview.decision === 'pass' ? 'pass' : 'blocked', [
				'Decision: ' + (finalReview.decision || 'unknown'),
				finalReview.ready ? 'Final Review is ready.' : 'Final Review is not ready.',
				finalReview.summary
			].filter(Boolean).join('\\n'), !(finalReview.ready && finalReview.decision === 'pass'));
			addStatusCard(cards, 'Commit Handoff Gate', handoff.ready ? 'ready' : 'blocked', [
				handoff.summary,
				'Accepted files: ' + (counts.acceptedFiles ?? 0)
			].filter(Boolean).join('\\n'), !handoff.ready);
			addStatusCard(cards, 'Read-Only Auto-Commit Guardrails', String(guardrails.length), guardrails.length ? guardrails.slice(0, 6).join('\\n') : 'Auto-commit readiness never stages, commits, pushes, creates branches, opens PRs, restores, deletes, writes, or merges files.', false);
			if (blockerList.length) {
				addStatusCard(blockers, 'Blockers', String(blockerList.length), blockerList.slice(0, 12).join('\\n'), true);
			}
			if (evidenceList.length) {
				addStatusCard(evidence, 'Auto-Commit Evidence', String(evidenceList.length), evidenceList.slice(0, 10).join('\\n'), false);
			}
			if (commandList.length) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'Prepared Git Commands';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = String(commandList.length);
				title.appendChild(badge);
				const detail = document.createElement('pre');
				detail.className = 'diff-code';
				detail.textContent = commandList.join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				commands.appendChild(item);
			}
		}
		function renderWorkspaceGuidance(message) {
			const section = document.querySelector('[data-guidance]');
			const summary = document.querySelector('[data-guidance-summary]');
			const list = document.querySelector('[data-guidance-list]');
			const guidance = message.guidance || {};
			const rules = guidance.rules || [];
			const skills = guidance.skills || [];
			const hooks = guidance.hooks || [];
			section.hidden = rules.length === 0 && skills.length === 0 && hooks.length === 0;
			summary.textContent = message.summary || [
				rules.length + ' rule files',
				skills.length + ' skills',
				hooks.length + ' hook manifests'
			].join('\\n');
			list.textContent = '';
			for (const itemData of [
				...rules.map(rule => ({ title: rule.path, badge: 'rule · ' + rule.kind, detail: rule.text })),
				...skills.map(skill => ({ title: skill.name, badge: 'skill', detail: skill.path + (skill.description ? '\\n' + skill.description : '') })),
				...hooks.map(hook => ({ title: hook.path, badge: 'hook manifest · ' + hook.kind, detail: (hook.entries || []).join('\\n') || hook.text }))
			].slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = itemData.title;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = itemData.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = (itemData.detail || '').slice(0, 900);
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderGuidanceStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const section = document.querySelector('[data-guidance-status]');
			const summary = document.querySelector('[data-guidance-status-summary]');
			const cards = document.querySelector('[data-guidance-status-cards]');
			const list = document.querySelector('[data-guidance-status-list]');
			const rules = Array.isArray(status.rules) ? status.rules : [];
			const skills = Array.isArray(status.skills) ? status.skills : [];
			const hooks = Array.isArray(status.hooks) ? status.hooks : [];
			const memoryDocs = Array.isArray(status.memoryBankDocuments) ? status.memoryBankDocuments : [];
			section.hidden = false;
			cards.textContent = '';
			list.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Rules: ' + (counts.rules ?? rules.length),
				'Skills: ' + (counts.skills ?? skills.length),
				'Hooks: ' + (counts.hooks ?? hooks.length),
				'Memory Bank: ' + (counts.memoryBankDocuments ?? memoryDocs.length),
				'Custom modes: ' + (counts.customModes ?? 0),
				status.ruleProposalSummary ? 'Rule proposal: ready' : 'Rule proposal: none'
			].filter(Boolean).join('\\n');
			const statusCards = [
				{
					title: 'Guidance Sources',
					badge: String((counts.rules ?? 0) + (counts.skills ?? 0) + (counts.hooks ?? 0)),
					blocked: !status.ok,
					detail: [
						status.guidanceSummary,
						'Rules: ' + (counts.rules ?? 0),
						'Skills: ' + (counts.skills ?? 0),
						'Hook manifests: ' + (counts.hooks ?? 0)
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Memory Bank',
					badge: String(counts.memoryBankDocuments ?? 0),
					blocked: false,
					detail: status.memoryBankSummary || 'No Memory Bank status has been collected yet.'
				},
				{
					title: 'Custom Modes',
					badge: String(counts.customModes ?? 0),
					blocked: false,
					detail: status.customModeSummary || 'No custom mode catalog has been collected yet.'
				},
				{
					title: 'Rule Proposal',
					badge: status.ruleProposalSummary ? 'ready' : 'none',
					blocked: false,
					detail: status.ruleProposalSummary || 'No /newrule proposal is active.'
				},
				{
					title: 'Read-only Guardrails',
					badge: 'locked',
					blocked: false,
					detail: 'Guidance status never executes hooks, writes rule files, approves plans, unlocks tools, or mutates workspace files.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const itemData of [
				...rules.map(item => ({ title: item.path || item.title || 'rule', badge: item.kind || 'rule', detail: item.textPreview || item.text || '' })),
				...skills.map(item => ({ title: item.name || item.path || 'skill', badge: item.kind || 'skill', detail: [item.description, item.path, item.textPreview].filter(Boolean).join('\\n') })),
				...hooks.map(item => ({ title: item.path || 'hook manifest', badge: item.kind || 'hook', detail: ((item.entries || []).join('\\n') || item.textPreview || item.text || '') })),
				...memoryDocs.map(item => ({ title: item.title || item.path || 'Memory Bank document', badge: item.kind || 'memory', detail: item.textPreview || item.text || '' }))
			].slice(0, 16)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = itemData.title;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = itemData.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = (itemData.detail || '').slice(0, 900);
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderRuleProposal(message) {
			const section = document.querySelector('[data-rule-proposal]');
			const summary = document.querySelector('[data-rule-proposal-summary]');
			const body = document.querySelector('[data-rule-proposal-body]');
			const proposal = message.proposal;
			section.hidden = !proposal;
			body.textContent = '';
			if (!proposal) {
				summary.textContent = '';
				return;
			}
			summary.textContent = message.summary || [
				proposal.targetPath,
				proposal.operation,
				proposal.targetKind
			].filter(Boolean).join(' · ');
			const target = document.createElement('div');
			target.className = 'card';
			const targetTitle = document.createElement('div');
			targetTitle.className = 'card-title';
			targetTitle.textContent = proposal.title || 'Workspace rule proposal';
			const targetBadge = document.createElement('span');
			targetBadge.className = proposal.targetExists ? 'badge' : 'badge ok';
			targetBadge.textContent = proposal.operation || 'create';
			targetTitle.appendChild(targetBadge);
			const targetDetail = document.createElement('div');
			targetDetail.className = 'card-detail';
			targetDetail.textContent = [
				'Target: ' + proposal.targetPath,
				'Kind: ' + proposal.targetKind,
				'Request: ' + proposal.request,
				proposal.rationale
			].filter(Boolean).join('\\n');
			target.appendChild(targetTitle);
			target.appendChild(targetDetail);
			body.appendChild(target);
			const text = document.createElement('pre');
			text.className = 'diff-code';
			text.textContent = proposal.proposedText || '';
			body.appendChild(text);
			const criteria = document.createElement('div');
			criteria.className = 'card-detail';
			criteria.textContent = [
				'Acceptance criteria:',
				...(proposal.acceptanceCriteria || []).map(item => '- ' + item),
				...(proposal.warnings || []).length ? '\\nWarnings:' : undefined,
				...(proposal.warnings || []).map(item => '- ' + item)
			].filter(Boolean).join('\\n');
			body.appendChild(criteria);
		}
		function renderMemoryBank(message) {
			const section = document.querySelector('[data-memory-bank]');
			const summary = document.querySelector('[data-memory-bank-summary]');
			const list = document.querySelector('[data-memory-bank-list]');
			const memoryBank = message.memoryBank || {};
			const documents = memoryBank.documents || [];
			section.hidden = documents.length === 0;
			summary.textContent = message.summary || (documents.length ? documents.length + ' Memory Bank documents loaded.' : 'No Memory Bank documents found.');
			list.textContent = '';
			for (const documentData of documents.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = documentData.title || documentData.path;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = [documentData.kind || 'memory', documentData.truncated ? 'truncated' : undefined].filter(Boolean).join(' · ');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [documentData.path, (documentData.text || '').slice(0, 900)].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderPreviewPlan(message) {
			const section = document.querySelector('[data-preview]');
			const summary = document.querySelector('[data-preview-summary]');
			const list = document.querySelector('[data-preview-list]');
			const plan = message.plan || {};
			const previews = plan.previews || [];
			section.hidden = previews.length === 0;
			summary.textContent = message.summary || (previews.length + ' preview target' + (previews.length === 1 ? '' : 's'));
			list.textContent = '';
			for (const preview of previews.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = preview.label;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = preview.url;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = preview.command + '\\n' + preview.source;
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const start = document.createElement('button');
				start.textContent = 'Start preview';
				start.addEventListener('click', () => vscode.postMessage({ command: 'startPreview', id: preview.id }));
				const open = document.createElement('button');
				open.className = 'secondary';
				open.textContent = 'Open panel';
				open.addEventListener('click', () => vscode.postMessage({ command: 'openPreview', id: preview.id, url: preview.url }));
				actions.appendChild(start);
				actions.appendChild(open);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderPreviewStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const approval = status.approval || {};
			const targets = Array.isArray(status.targets) ? status.targets : [];
			const urls = Array.isArray(status.localUrls) ? status.localUrls : [];
			const insights = Array.isArray(status.insights) ? status.insights : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-preview-status]');
			const summary = document.querySelector('[data-preview-status-summary]');
			const cards = document.querySelector('[data-preview-status-cards]');
			const list = document.querySelector('[data-preview-status-list]');
			section.hidden = !status.available && !counts.pendingBrowserActions;
			summary.textContent = '';
			cards.textContent = '';
			list.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				status.requestedUrl ? 'Requested URL: ' + status.requestedUrl + ' (' + (status.requestedUrlKnown ? 'known' : 'unknown') + ')' : undefined,
				status.detectedAt ? 'Detected: ' + new Date(status.detectedAt).toLocaleString() : undefined,
				'Execution authorization: ' + String(Boolean(approval.hasExecutionAuthorization)),
				'Pending browser approvals: ' + (counts.pendingBrowserActions ?? 0)
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Preview Targets', String(counts.targets ?? targets.length), [
				'Returned targets: ' + (counts.returnedTargets ?? targets.length),
				targets.length ? targets.map(target => (target.label || target.id) + ' -> ' + target.url).slice(0, 6).join('\\n') : 'No detected preview target yet.'
			].join('\\n'), (counts.targets ?? 0) === 0);
			addStatusCard(cards, 'Loopback URLs', String(counts.terminalUrls ?? urls.length), urls.length ? urls.slice(0, 8).join('\\n') : 'No localhost URL has been detected from preview plans or terminal insights yet.', false);
			addStatusCard(cards, 'Terminal Insights', String(counts.returnedInsights ?? insights.length) + '/' + String(counts.insights ?? insights.length), [
				'Running insights: ' + (counts.runningInsights ?? 0),
				insights.length ? insights.map(insight => [
					insight.runId || 'run',
					insight.status || 'unknown',
					insight.summary || '',
					(insight.urls || []).join(', ')
				].filter(Boolean).join(' - ')).slice(0, 6).join('\\n') : 'No terminal insight samples returned.'
			].join('\\n'), false);
			addStatusCard(cards, 'Approval Gates', approval.hasExecutionAuthorization ? 'authorized' : 'locked', [
				'Start requires approval: ' + String(Boolean(approval.startRequiresApproval)),
				'Open/navigate requires approval: ' + String(Boolean(approval.openNavigateRequiresApproval)),
				'Pending browser actions: ' + (approval.pendingBrowserActions ?? counts.pendingBrowserActions ?? 0)
			].join('\\n'), !approval.hasExecutionAuthorization);
			addStatusCard(cards, 'Read-Only Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Preview status is read-only.', false);
			for (const target of targets.slice(0, 8)) {
				addStatusCard(list, target.label || target.id || 'Preview target', target.status || 'target', [
					target.url,
					target.command ? 'Command: ' + target.command : undefined,
					target.cwd ? 'CWD: ' + target.cwd : undefined,
					target.source ? 'Source: ' + target.source : undefined
				].filter(Boolean).join('\\n'), false);
			}
			for (const insight of insights.slice(0, 6)) {
				addStatusCard(list, 'Terminal Insight ' + (insight.runId || ''), insight.status || 'insight', [
					insight.commandLine,
					insight.summary,
					(insight.urls || []).length ? 'URLs: ' + insight.urls.join(', ') : undefined,
					(insight.findingKinds || []).length ? 'Findings: ' + insight.findingKinds.join(', ') : undefined
				].filter(Boolean).join('\\n'), insight.status === 'failed');
			}
		}
		function renderMcpCatalog(message) {
			const section = document.querySelector('[data-mcp]');
			const summary = document.querySelector('[data-mcp-summary]');
			const list = document.querySelector('[data-mcp-list]');
			const catalog = message.catalog || {};
			const servers = catalog.servers || [];
			section.hidden = servers.length === 0;
			summary.textContent = message.summary || (servers.length + ' MCP server' + (servers.length === 1 ? '' : 's'));
			list.textContent = '';
			for (const server of servers.slice(0, 16)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = server.name;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = (server.disabled ? 'disabled · ' : '') + server.transport;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				const lines = [
					server.source,
					server.command ? 'Command: ' + server.command + (server.args?.length ? ' ' + server.args.join(' ') : '') : undefined,
					server.url ? 'URL: ' + server.url : undefined,
					server.envKeys?.length ? 'Env keys: ' + server.envKeys.join(', ') : undefined,
					server.headerKeys?.length ? 'Header keys: ' + server.headerKeys.join(', ') : undefined,
					server.autoApprove?.length ? 'Auto approve: ' + server.autoApprove.join(', ') : undefined
				].filter(Boolean);
				detail.textContent = lines.join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderMcpStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-mcp-status]');
			const summary = document.querySelector('[data-mcp-status-summary]');
			const cards = document.querySelector('[data-mcp-status-cards]');
			const serversList = document.querySelector('[data-mcp-status-servers]');
			const counts = status.counts || {};
			const approval = status.approval || {};
			const transports = status.transports || {};
			const servers = Array.isArray(status.servers) ? status.servers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const requested = status.requestedServer;
			section.hidden = !status.ok;
			cards.textContent = '';
			serversList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.available ? 'Workspace MCP catalog available.' : 'Workspace MCP catalog unavailable.',
				'Servers: ' + (counts.servers || 0) + ' total, ' + (counts.enabled || 0) + ' enabled, ' + (counts.disabled || 0) + ' disabled',
				'Pending MCP approvals: ' + (counts.pendingActions || approval.pendingActions || 0),
				'Execution authorization: ' + (approval.hasExecutionAuthorization ? 'available' : 'not approved')
			].filter(Boolean).join('\\n');
			const overviewCards = [
				{
					title: 'Catalog',
					badge: status.available ? 'available' : 'missing',
					blocked: !status.available,
					detail: [
						'Sources: ' + (Array.isArray(status.sources) && status.sources.length ? status.sources.join('\\n') : 'none'),
						'Returned servers: ' + (counts.returnedServers || 0),
						'Unknown requested servers: ' + (counts.requestedUnknownServers || 0)
					].join('\\n')
				},
				{
					title: 'Approval Gate',
					badge: (approval.pendingActions || 0) + ' pending',
					blocked: (approval.pendingActions || 0) > 0 || !approval.hasExecutionAuthorization,
					detail: [
						'Tool calls require approval: ' + Boolean(approval.requiredForToolCalls),
						'Approved plan: ' + Boolean(approval.hasExecutionAuthorization),
						'Pending MCP requests: ' + (approval.pendingActions || 0)
					].join('\\n')
				},
				{
					title: 'Transports',
					badge: String((transports.stdio || 0) + (transports.http || 0) + (transports.sse || 0) + (transports.unknown || 0)),
					blocked: false,
					detail: [
						'stdio: ' + (transports.stdio || 0),
						'http: ' + (transports.http || 0),
						'sse: ' + (transports.sse || 0),
						'unknown: ' + (transports.unknown || 0)
					].join('\\n')
				}
			];
			if (requested) {
				overviewCards.push({
					title: 'Requested Server',
					badge: requested.found ? 'found' : 'blocked',
					blocked: !requested.found || requested.disabled,
					detail: [
						requested.name,
						'Scope: ' + requested.scope,
						requested.disabled ? 'Disabled' : undefined,
						requested.guidance
					].filter(Boolean).join('\\n')
				});
			}
			for (const card of overviewCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const server of servers.slice(0, 16)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = server.name || 'MCP server';
				const badge = document.createElement('span');
				badge.className = server.disabled ? 'badge risk-blocked' : 'badge';
				badge.textContent = (server.disabled ? 'disabled - ' : '') + (server.transport || 'unknown');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					server.source,
					server.command ? 'Command: ' + server.command + (server.args && server.args.length ? ' ' + server.args.join(' ') : '') : undefined,
					server.url ? 'URL: ' + server.url : undefined,
					server.envKeys && server.envKeys.length ? 'Env keys: ' + server.envKeys.join(', ') : undefined,
					server.headerKeys && server.headerKeys.length ? 'Header keys: ' + server.headerKeys.join(', ') : undefined,
					server.autoApprove && server.autoApprove.length ? 'Auto-approve hints: ' + server.autoApprove.join(', ') : undefined,
					server.timeoutMs ? 'Timeout: ' + server.timeoutMs + 'ms' : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				serversList.appendChild(item);
			}
			if (guardrails.length) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'MCP Guardrails';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = String(guardrails.length);
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = guardrails.slice(0, 5).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				serversList.appendChild(item);
			}
		}
		function addStatusCard(container, titleText, badgeText, detailText, blocked) {
			const item = document.createElement('div');
			item.className = 'card';
			const title = document.createElement('div');
			title.className = 'card-title';
			title.textContent = titleText;
			const badge = document.createElement('span');
			badge.className = blocked ? 'badge risk-blocked' : 'badge';
			badge.textContent = badgeText;
			title.appendChild(badge);
			const detail = document.createElement('div');
			detail.className = 'card-detail';
			detail.textContent = detailText || '';
			item.appendChild(title);
			item.appendChild(detail);
			container.appendChild(item);
			return item;
		}
		function renderContextStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-context-status]');
			const summary = document.querySelector('[data-context-status-summary]');
			const cards = document.querySelector('[data-context-status-cards]');
			const details = document.querySelector('[data-context-status-details]');
			section.hidden = !status;
			cards.textContent = '';
			details.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			const ready = status.state === 'ready' && status.ok;
			summary.textContent = [
				message.summary || status.summary || status.message || '',
				'State: ' + (status.state || 'unknown'),
				'Mode: ' + (status.mode || 'not gathered'),
				'Workspace roots: ' + (counts.workspaceRoots ?? (status.workspaceRoots || []).length ?? 0),
				'Terminal metadata: ' + (counts.terminalKnown ? 'known' : 'missing')
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Context Pack', ready ? 'ready' : 'empty', [
				'Files: ' + (counts.files ?? 0) + ' total, ' + (counts.filesWithText ?? 0) + ' with text',
				'Search hits: ' + (counts.searchHits ?? 0),
				'Symbols: ' + (counts.symbols ?? 0),
				'Diagnostics: ' + (counts.diagnostics ?? 0) + ' (' + (counts.diagnosticErrors ?? 0) + ' errors)',
				'Git changes: ' + (counts.gitChanges ?? 0)
			].join('\\n'), !ready);
			addStatusCard(cards, 'Context Sources', String((counts.mentions ?? 0) + (counts.files ?? 0) + (counts.searchHits ?? 0)), [
				'Mentions: ' + (counts.mentions ?? 0),
				'Ignore rules: ' + (counts.ignoreRules ?? 0),
				'Git repositories: ' + (counts.gitRepositories ?? 0),
				'Recent commits: ' + (counts.recentCommits ?? 0)
			].join('\\n'), false);
			addStatusCard(cards, 'Read-Only Guardrails', String((status.guardrails || []).length), (status.guardrails || []).slice(0, 4).join('\\n'), false);
			const detailGroups = [
				['Files', status.files || [], item => item.path + ' - ' + item.kind + (item.hasText ? ' - text cached' : ' - path only')],
				['Search Hits', status.searchHits || [], item => item.path + ' - score ' + Math.round(item.score || 0)],
				['Symbol Samples', status.symbolSamples || [], item => item.name + ' - ' + item.kind + ' - ' + item.path],
				['Diagnostics', status.diagnostics || [], item => item.severity + ' - ' + item.path + ' - ' + item.message],
				['Git', status.git || [], item => (item.branch || item.head || item.root) + ' - ' + item.changes + ' changes']
			];
			for (const [titleText, items, formatter] of detailGroups) {
				if (!items.length) {
					continue;
				}
				addStatusCard(details, titleText, String(items.length), items.slice(0, 8).map(formatter).join('\\n'), false);
			}
		}
		function renderWorkspaceReadStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-workspace-read-status]');
			const summary = document.querySelector('[data-workspace-read-status-summary]');
			const cards = document.querySelector('[data-workspace-read-status-cards]');
			const eventsList = document.querySelector('[data-workspace-read-status-events]');
			section.hidden = !status;
			cards.textContent = '';
			eventsList.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			const readiness = status.readiness || {};
			const events = Array.isArray(status.events) ? status.events : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			summary.textContent = [
				message.summary || status.message || '',
				'State: ' + (status.state || 'unknown'),
				status.filterKind ? 'Filter: ' + status.filterKind : undefined,
				'Cached events: ' + (status.filteredEvents ?? 0) + ' shown of ' + (status.totalEvents ?? 0),
				'Search evidence: ' + (readiness.hasSearchEvidence ? 'yes' : 'no'),
				'Semantic evidence: ' + (readiness.hasSemanticEvidence ? 'yes' : 'no'),
				readiness.latestFailure ? 'Latest failure: ' + readiness.latestFailure : undefined,
				status.nextAction
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Evidence Counts', status.hasEvidence ? 'ready' : 'empty', [
				'Successful: ' + (counts.successful ?? 0),
				'Failed: ' + (counts.failed ?? 0),
				'Truncated: ' + (counts.truncated ?? 0),
				'File read results: ' + (counts.files ?? 0),
				'Directory entries: ' + (counts.entries ?? 0),
				'Search hits: ' + (counts.hits ?? 0)
			].join('\\n'), !status.hasEvidence);
			addStatusCard(cards, 'Tool Mix', String(counts.total ?? 0), [
				'read_file: ' + (counts.readFile ?? 0),
				'list_dir: ' + (counts.listDir ?? 0),
				'search_files: ' + (counts.searchFiles ?? 0),
				'semantic_search: ' + (counts.semanticSearch ?? 0)
			].join('\\n'), false);
			if (guardrails.length) {
				addStatusCard(cards, 'Cached-Only Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n'), false);
			}
			for (const event of events.slice(0, 8)) {
				const samples = event.samples || {};
				const files = Array.isArray(samples.files) ? samples.files : [];
				const entries = Array.isArray(samples.entries) ? samples.entries : [];
				const hits = Array.isArray(samples.hits) ? samples.hits : [];
				const eventCounts = event.counts || {};
				const sampleLines = [
					event.query ? 'Query: ' + event.query : undefined,
					event.path ? 'Path: ' + event.path : undefined,
					event.paths && event.paths.length ? 'Paths: ' + event.paths.join(', ') : undefined,
					'Counts: ' + (eventCounts.files ?? 0) + ' files, ' + (eventCounts.entries ?? 0) + ' entries, ' + (eventCounts.hits ?? 0) + ' hits',
					event.summary,
					event.error ? 'Error: ' + event.error : undefined,
					files.length ? 'Files:\\n' + files.slice(0, 4).map(file => file.path + ' (' + file.textLength + ' chars' + (file.truncated ? ', truncated' : '') + ')').join('\\n') : undefined,
					entries.length ? 'Entries:\\n' + entries.slice(0, 4).map(entry => entry.type + ' - ' + entry.path).join('\\n') : undefined,
					hits.length ? 'Hits:\\n' + hits.slice(0, 4).map(hit => hit.path + ':' + hit.line + ' - ' + hit.preview).join('\\n') : undefined
				].filter(Boolean);
				addStatusCard(eventsList, event.kind, event.ok ? 'ok' : 'failed', sampleLines.join('\\n'), !event.ok);
			}
		}
		function renderContextIndexStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-context-index-status]');
			const summary = document.querySelector('[data-context-index-summary]');
			const sourcesList = document.querySelector('[data-context-index-sources]');
			const blockersList = document.querySelector('[data-context-index-blockers]');
			section.hidden = !status;
			sourcesList.textContent = '';
			blockersList.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			const readiness = status.readiness || {};
			summary.textContent = [
				message.summary || status.message || '',
				readiness.readyForPlanning ? 'Ready for visual planning.' : 'Not ready for visual planning.',
				'Fresh gather needed: ' + String(Boolean(readiness.needsFreshGather)),
				'Stale: ' + String(Boolean(readiness.stale)),
				'Files/search/symbols: ' + (counts.files ?? 0) + '/' + (counts.searchHits ?? 0) + '/' + (counts.symbols ?? 0),
				'Diagnostics/git: ' + (counts.diagnostics ?? 0) + '/' + (counts.gitRepositories ?? 0)
			].filter(Boolean).join('\\n');
			for (const source of (status.sources || []).slice(0, 12)) {
				addStatusCard(sourcesList, source.title || source.id, source.ready ? 'ready' : 'missing', [
					'Count: ' + (source.count ?? 0),
					'Stale: ' + String(Boolean(source.stale)),
					source.detail,
					source.blockedReason ? 'Blocked: ' + source.blockedReason : undefined
				].filter(Boolean).join('\\n'), !source.ready || source.stale);
			}
			const blockers = [
				...(readiness.blockingReasons || []).map(item => 'Blocker: ' + item),
				...(readiness.missingSources || []).map(item => 'Missing source: ' + item),
			];
			if (blockers.length) {
				addStatusCard(blockersList, 'Planning Blockers', String(blockers.length), blockers.slice(0, 12).join('\\n'), true);
			}
			if ((status.guardrails || []).length) {
				addStatusCard(blockersList, 'Index Guardrails', String(status.guardrails.length), status.guardrails.slice(0, 4).join('\\n'), false);
			}
		}
		function renderSymbolIndexStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-symbol-index-status]');
			const summary = document.querySelector('[data-symbol-index-summary]');
			const cards = document.querySelector('[data-symbol-index-cards]');
			const entriesList = document.querySelector('[data-symbol-index-entries]');
			section.hidden = !status;
			cards.textContent = '';
			entriesList.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			summary.textContent = [
				message.summary || status.message || '',
				'Available: ' + String(Boolean(status.available)),
				status.query ? 'Query: ' + status.query : undefined,
				status.path ? 'Path: ' + status.path : undefined,
				status.kind ? 'Kind: ' + status.kind : undefined,
				status.truncated ? 'Results are capped.' : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Symbol Coverage', status.available ? 'ready' : 'missing', [
				'Matched: ' + (counts.matched ?? 0) + '/' + (counts.total ?? 0),
				'Returned: ' + (counts.returned ?? 0),
				'Files: ' + (counts.files ?? 0),
				'Kinds: ' + (counts.kinds ?? 0)
			].join('\\n'), !status.available);
			if ((status.kindCounts || []).length) {
				addStatusCard(cards, 'Kind Counts', String(status.kindCounts.length), status.kindCounts.slice(0, 10).map(item => item.kind + ': ' + item.count).join('\\n'), false);
			}
			if ((status.guardrails || []).length) {
				addStatusCard(cards, 'Symbol Guardrails', String(status.guardrails.length), status.guardrails.slice(0, 4).join('\\n'), false);
			}
			for (const symbol of (status.entries || []).slice(0, 12)) {
				const item = addStatusCard(entriesList, symbol.name || 'Symbol', symbol.kind || 'symbol', [
					symbol.path,
					symbol.range,
					symbol.containerName ? 'In: ' + symbol.containerName : undefined
				].filter(Boolean).join('\\n'), false);
				if (symbol.path) {
					const actions = document.createElement('div');
					actions.className = 'card-actions';
					const open = document.createElement('button');
					open.className = 'secondary';
					open.textContent = 'Open';
					open.addEventListener('click', () => vscode.postMessage({ command: 'openWorkspacePath', path: symbol.path }));
					actions.appendChild(open);
					item.appendChild(actions);
				}
			}
		}
		function renderContextPack(message) {
			const section = document.querySelector('[data-context]');
			const summary = document.querySelector('[data-context-summary]');
			const files = document.querySelector('[data-context-files]');
			const search = document.querySelector('[data-context-search]');
			const symbols = document.querySelector('[data-context-symbols]');
			const git = document.querySelector('[data-context-git]');
			section.hidden = false;
			summary.textContent = message.summary || '';
			files.textContent = '';
			for (const file of (message.context?.files || []).slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = file.path;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = file.kind;
				title.appendChild(badge);
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const open = document.createElement('button');
				open.className = 'secondary';
				open.textContent = 'Open';
				open.addEventListener('click', () => vscode.postMessage({ command: 'openWorkspacePath', path: file.path }));
				actions.appendChild(open);
				item.appendChild(title);
				item.appendChild(actions);
				files.appendChild(item);
			}
			search.textContent = '';
			const hits = message.context?.searchHits || [];
			if (hits.length) {
				const heading = document.createElement('div');
				heading.className = 'card-title';
				heading.textContent = 'Search hits';
				search.appendChild(heading);
			}
			for (const hit of hits.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = hit.path;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = String(Math.round(hit.score || 0));
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					hit.matchedTerms?.length ? 'Matched: ' + hit.matchedTerms.join(', ') : undefined,
					hit.snippet
				].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const open = document.createElement('button');
				open.className = 'secondary';
				open.textContent = 'Open';
				open.addEventListener('click', () => vscode.postMessage({ command: 'openWorkspacePath', path: hit.path }));
				actions.appendChild(open);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				search.appendChild(item);
			}
			symbols.textContent = '';
			const symbolEntries = message.context?.symbolIndex?.entries || [];
			if (symbolEntries.length) {
				const heading = document.createElement('div');
				heading.className = 'card-title';
				heading.textContent = 'Symbols';
				symbols.appendChild(heading);
			}
			for (const symbol of symbolEntries.slice(0, 12)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = symbol.name;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = symbol.kind || 'symbol';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					symbol.path + ':' + symbol.range,
					symbol.containerName ? 'In: ' + symbol.containerName : undefined
				].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const open = document.createElement('button');
				open.className = 'secondary';
				open.textContent = 'Open';
				open.addEventListener('click', () => vscode.postMessage({ command: 'openWorkspacePath', path: symbol.path }));
				actions.appendChild(open);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				symbols.appendChild(item);
			}
			git.textContent = '';
			for (const repository of (message.context?.git?.repositories || []).slice(0, 4)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = repository.branch || repository.head || repository.root;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = (repository.changes?.length || 0) + ' changes';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				const commits = (repository.recentCommits || []).slice(0, 5).map(commit => commit.hash + ' ' + (commit.date ? commit.date + ' ' : '') + commit.subject);
				detail.textContent = [
					repository.root,
					repository.remotes?.length ? 'Remotes: ' + repository.remotes.join(', ') : undefined,
					repository.changes?.length ? 'Changes: ' + repository.changes.slice(0, 12).join(', ') : undefined,
					commits.length ? 'Recent commits:\\n' + commits.join('\\n') : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				git.appendChild(item);
			}
		}
		function renderDocsContext(message) {
			const section = document.querySelector('[data-docs-context]');
			const summary = document.querySelector('[data-docs-summary]');
			const list = document.querySelector('[data-docs-list]');
			const docs = message.context?.documents || [];
			section.hidden = docs.length === 0;
			summary.textContent = message.summary || '';
			list.textContent = '';
			for (const doc of docs.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = doc.title || doc.path;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = doc.kind + (doc.truncated ? ' · truncated' : '');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					doc.path,
					doc.matchedTerms?.length ? 'Matched: ' + doc.matchedTerms.join(', ') : undefined,
					String(Math.round(doc.score || 0))
				].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const open = document.createElement('button');
				open.className = 'secondary';
				open.textContent = 'Open';
				open.addEventListener('click', () => vscode.postMessage({ command: 'openWorkspacePath', path: doc.path }));
				actions.appendChild(open);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderInlinePromptSession(session) {
			const section = document.querySelector('[data-inline-prompt]');
			const summary = document.querySelector('[data-inline-summary]');
			const steps = document.querySelector('[data-inline-plan-steps]');
			const acceptance = document.querySelector('[data-inline-acceptance]');
			const selection = document.querySelector('[data-inline-selection]');
			section.hidden = !session;
			summary.textContent = '';
			steps.textContent = '';
			acceptance.textContent = '';
			selection.textContent = '';
			selection.hidden = true;
			if (!session) {
				return;
			}
			summary.textContent = [
				session.instruction,
				session.file ? 'File: ' + session.file : undefined,
				session.range ? 'Range: ' + session.range : undefined,
				'Selection: ' + session.selectionKind,
				session.languageId ? 'Language: ' + session.languageId : undefined
			].filter(Boolean).join('\\n');
			const stepsCard = document.createElement('div');
			stepsCard.className = 'card';
			const stepsTitle = document.createElement('div');
			stepsTitle.className = 'card-title';
			stepsTitle.textContent = 'Required plan steps';
			const stepsDetail = document.createElement('div');
			stepsDetail.className = 'card-detail';
			stepsDetail.textContent = (session.requiredPlanSteps || []).map((step, index) => (index + 1) + '. ' + step).join('\\n');
			stepsCard.appendChild(stepsTitle);
			stepsCard.appendChild(stepsDetail);
			steps.appendChild(stepsCard);
			const acceptanceCard = document.createElement('div');
			acceptanceCard.className = 'card';
			const acceptanceTitle = document.createElement('div');
			acceptanceTitle.className = 'card-title';
			acceptanceTitle.textContent = 'Acceptance criteria';
			const acceptanceDetail = document.createElement('div');
			acceptanceDetail.className = 'card-detail';
			acceptanceDetail.textContent = (session.acceptanceCriteria || []).map(item => '- ' + item).join('\\n');
			acceptanceCard.appendChild(acceptanceTitle);
			acceptanceCard.appendChild(acceptanceDetail);
			acceptance.appendChild(acceptanceCard);
			if (session.selectedText || session.contextBefore || session.contextAfter) {
				selection.hidden = false;
				selection.textContent = [
					session.contextBefore ? 'Before (' + session.contextBeforeRange + '):\\n' + session.contextBefore : undefined,
					session.selectedText ? 'Selected' + (session.selectedTextTruncated ? ' (truncated)' : '') + ':\\n' + session.selectedText : undefined,
					session.contextAfter ? 'After (' + session.contextAfterRange + '):\\n' + session.contextAfter : undefined
				].filter(Boolean).join('\\n\\n');
			}
		}
		function renderInlinePromptStatus(message) {
			const status = message.status || {};
			const session = status.session || {};
			const counts = status.counts || {};
			const auth = status.executionAuthorization || {};
			const plan = status.activePlan || {};
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-inline-prompt-status]');
			const summary = document.querySelector('[data-inline-prompt-status-summary]');
			const cards = document.querySelector('[data-inline-prompt-status-cards]');
			const details = document.querySelector('[data-inline-prompt-status-details]');
			const exactPlanMatch = Boolean(auth.approved && auth.activePlanMatches);
			section.hidden = !status.active && !plan.taskId && !auth.approved;
			summary.textContent = '';
			cards.textContent = '';
			details.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				status.active ? 'Inline prompt active.' : 'No inline prompt session active.',
				session.file ? 'Target: ' + session.file : undefined,
				session.range ? 'Range: ' + session.range : undefined,
				plan.taskId ? 'Active plan: ' + plan.taskId + ' r' + plan.revision : undefined,
				'Plan approved: ' + (exactPlanMatch ? 'yes' : 'no'),
				'Required plan steps: ' + (counts.requiredPlanSteps ?? 0),
				'Acceptance criteria: ' + (counts.acceptanceCriteria ?? 0)
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Inline Target', session.file || 'workspace', [
				session.range ? 'Range: ' + session.range : undefined,
				session.languageId ? 'Language: ' + session.languageId : undefined,
				session.selectionKind ? 'Selection: ' + session.selectionKind : undefined,
				session.selectedTextTruncated ? 'Selected text was truncated before planning.' : undefined
			].filter(Boolean).join('\\n') || 'No active editor selection is attached.', !status.active);
			addStatusCard(cards, 'Plan Requirements', String((counts.requiredPlanSteps ?? 0) + (counts.acceptanceCriteria ?? 0)), [
				'Required steps: ' + (counts.requiredPlanSteps ?? 0),
				'Acceptance criteria: ' + (counts.acceptanceCriteria ?? 0),
				plan.summary ? 'Plan summary: ' + plan.summary : undefined
			].filter(Boolean).join('\\n'), status.active && (counts.requiredPlanSteps ?? 0) === 0);
			addStatusCard(cards, 'Selection / Context Sizes', String(counts.selectedTextChars ?? 0) + ' selected chars', [
				'Selected text chars: ' + (counts.selectedTextChars ?? 0),
				'Before context chars: ' + (counts.contextBeforeChars ?? 0),
				'After context chars: ' + (counts.contextAfterChars ?? 0),
				'Prompt/context text is redacted and omitted unless the backend explicitly requested it.'
			].join('\\n'), false);
			addStatusCard(cards, 'Exact Plan Authorization', exactPlanMatch ? 'matched' : auth.approved ? 'stale' : 'missing', [
				auth.approved ? 'Approved revision: ' + auth.taskId + ' r' + auth.revision : 'No approved execution authorization.',
				auth.approved ? 'Active plan matches: ' + String(Boolean(auth.activePlanMatches)) : undefined,
				'Inline execution still requires the normal visual plan approval gates.'
			].filter(Boolean).join('\\n'), !exactPlanMatch);
			addStatusCard(cards, 'Read-Only Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Inline prompt status is read-only.', false);
			if ((session.requiredPlanSteps || []).length) {
				addStatusCard(details, 'Required Plan Steps', String(session.requiredPlanSteps.length), session.requiredPlanSteps.map((step, index) => (index + 1) + '. ' + step).join('\\n'), false);
			}
			if ((session.acceptanceCriteria || []).length) {
				addStatusCard(details, 'Acceptance Criteria', String(session.acceptanceCriteria.length), session.acceptanceCriteria.map(item => '- ' + item).join('\\n'), false);
			}
			if (session.prompt || session.selectedText || session.contextBefore || session.contextAfter) {
				addStatusCard(details, 'Returned Context Preview', 'redacted', [
					session.prompt ? 'Prompt:\\n' + session.prompt : undefined,
					session.contextBefore ? 'Before:\\n' + session.contextBefore : undefined,
					session.selectedText ? 'Selected:\\n' + session.selectedText : undefined,
					session.contextAfter ? 'After:\\n' + session.contextAfter : undefined
				].filter(Boolean).join('\\n\\n').slice(0, 1600), false);
			}
		}
		function renderPlan(plan, flow) {
			document.querySelector('[data-plan]').hidden = false;
			document.querySelector('[data-approve]').disabled = false;
			document.querySelector('[data-refine]').disabled = false;
			document.querySelector('[data-reject]').disabled = false;
			document.querySelector('[data-plan-summary]').textContent = 'Revision ' + plan.revision + ': ' + plan.summary;
			document.querySelector('[data-strategy]').textContent = plan.strategy || '';
			document.querySelector('[data-mermaid]').textContent = plan.flowchart || '';
			renderList(document.querySelector('[data-risks]'), plan.risks || []);
			renderList(document.querySelector('[data-acceptance]'), plan.acceptanceCriteria || []);
			renderSteps(plan);
			renderFlow(plan, flow);
		}
		function renderPlanRevisionHistory(summaryText) {
			const summary = document.querySelector('[data-plan-revisions-summary]');
			const list = document.querySelector('[data-plan-revisions]');
			summary.textContent = summaryText || (planRevisionHistory.length ? planRevisionHistory.length + ' revision snapshot' + (planRevisionHistory.length === 1 ? '' : 's') + ' recorded.' : 'No plan revisions recorded yet.');
			list.textContent = '';
			for (const snapshot of planRevisionHistory.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = 'Revision ' + snapshot.revision + ': ' + (snapshot.summary || snapshot.taskId);
				const badge = document.createElement('span');
				badge.className = snapshot.event === 'approved' ? 'badge' : snapshot.event === 'rejected' ? 'badge risk-blocked' : 'badge';
				badge.textContent = snapshot.event + ' · ' + new Date(snapshot.capturedAt).toLocaleTimeString();
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [snapshot.note, snapshot.plan?.strategy ? snapshot.plan.strategy.slice(0, 260) : undefined].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const restore = document.createElement('button');
				restore.className = 'secondary';
				restore.textContent = 'Restore';
				restore.addEventListener('click', () => vscode.postMessage({ command: 'restorePlanRevision', id: snapshot.id }));
				actions.appendChild(restore);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderPlanStatus(message) {
			const status = message.status || {};
			const renderStatus = status.renderStatus || {};
			const renderModel = status.renderModel || {};
			const nodes = Array.isArray(renderModel.nodes) ? renderModel.nodes : [];
			const edges = Array.isArray(renderModel.edges) ? renderModel.edges : [];
			const checklist = Array.isArray(renderModel.checklist) ? renderModel.checklist : [];
			const bindings = Array.isArray(renderModel.highlightBindings) ? renderModel.highlightBindings : [];
			const validationErrors = Array.isArray(status.validationErrors) ? status.validationErrors : [];
			const renderErrors = Array.isArray(renderStatus.errors) ? renderStatus.errors : [];
			const missingFlowNodeIds = Array.isArray(renderStatus.missingFlowNodeIds) ? renderStatus.missingFlowNodeIds : [];
			const duplicateFlowNodeIds = Array.isArray(renderStatus.duplicateFlowNodeIds) ? renderStatus.duplicateFlowNodeIds : [];
			const unlinkedNodeIds = Array.isArray(renderStatus.unlinkedNodeIds) ? renderStatus.unlinkedNodeIds : [];
			const history = Array.isArray(status.history) ? status.history : [];
			const section = document.querySelector('[data-plan-status]');
			const summary = document.querySelector('[data-plan-status-summary]');
			const cards = document.querySelector('[data-plan-status-cards]');
			const details = document.querySelector('[data-plan-status-details]');
			section.hidden = !status.ok && !renderStatus.available && !status.historySummary;
			summary.textContent = '';
			cards.textContent = '';
			details.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				status.taskId ? 'Task: ' + status.taskId + ' r' + status.revision : 'No active visual plan',
				'Schema valid: ' + String(Boolean(status.valid)),
				'Approval ready: ' + String(Boolean(status.approvalReady)),
				'Approved exact revision: ' + String(Boolean(status.approved)),
				'Mutation ready: ' + String(Boolean(status.mutationReady)),
				status.historySummary ? 'History: ' + status.historySummary : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Schema Gate', status.valid ? 'valid' : 'blocked', validationErrors.length ? validationErrors.slice(0, 6).join('\\n') : 'Plan schema is valid for rendering and approval.', !status.valid);
			addStatusCard(cards, 'Graph Render', renderStatus.graphValid ? 'render-ready' : renderStatus.fallbackRequired ? 'fallback' : 'blocked', [
				renderStatus.message || '',
				'Safe Mermaid: ' + String(Boolean(renderStatus.safeMermaid)),
				'Direction: ' + (renderStatus.direction || 'unknown'),
				'Nodes: ' + (renderStatus.nodeCount ?? 0),
				'Edges: ' + (renderStatus.edgeCount ?? 0),
				renderErrors.length ? 'Errors:\\n' + renderErrors.slice(0, 6).join('\\n') : undefined
			].filter(Boolean).join('\\n'), !renderStatus.graphValid || Boolean(renderStatus.fallbackRequired));
			addStatusCard(cards, 'Checklist Links', String(renderStatus.linkedStepCount ?? 0) + '/' + String(renderStatus.stepCount ?? 0), [
				missingFlowNodeIds.length ? 'Missing flow nodes: ' + missingFlowNodeIds.slice(0, 8).join(', ') : 'No missing checklist flow nodes.',
				duplicateFlowNodeIds.length ? 'Duplicate flow nodes: ' + duplicateFlowNodeIds.slice(0, 8).join(', ') : undefined,
				unlinkedNodeIds.length ? 'Unlinked graph nodes: ' + unlinkedNodeIds.slice(0, 8).join(', ') : undefined
			].filter(Boolean).join('\\n'), missingFlowNodeIds.length > 0 || duplicateFlowNodeIds.length > 0);
			addStatusCard(cards, 'Execution Authorization', status.mutationReady ? 'ready' : status.approved ? 'approved' : 'locked', [
				status.approvalBlockedReason ? 'Approval blocker: ' + status.approvalBlockedReason : undefined,
				status.approvedTaskId ? 'Approved task: ' + status.approvedTaskId + ' r' + status.approvedRevision : 'No exact approved plan revision yet.',
				status.approvedPlanHash ? 'Approved planHash: ' + status.approvedPlanHash : undefined,
				status.authorizationSummary || ''
			].filter(Boolean).join('\\n'), !status.mutationReady);
			addStatusCard(cards, 'Render Model', renderModel.source || 'none', [
				'Nodes returned: ' + nodes.length,
				'Edges returned: ' + edges.length,
				'Checklist returned: ' + checklist.length,
				'Highlight bindings: ' + bindings.length,
				renderModel.fallbackReason ? 'Fallback: ' + renderModel.fallbackReason : undefined
			].filter(Boolean).join('\\n'), renderModel.source === 'none');
			if (checklist.length) {
				addStatusCard(details, 'Checklist Render Model', String(checklist.length), checklist.slice(0, 10).map(step => [
					step.id,
					step.status,
					step.linked ? 'linked' : 'unlinked',
					step.flowNodeId,
					step.title
				].filter(Boolean).join(' - ')).join('\\n'), false);
			}
			if (bindings.length) {
				addStatusCard(details, 'Highlight Bindings', String(bindings.length), bindings.slice(0, 10).map(binding => [
					binding.flowNodeId,
					binding.nodeId ? 'node=' + binding.nodeId : undefined,
					(binding.stepIds || []).length ? 'steps=' + binding.stepIds.join(',') : undefined
				].filter(Boolean).join(' - ')).join('\\n'), false);
			}
			if (history.length) {
				addStatusCard(details, 'Returned Revision History', String(history.length), history.slice(0, 8).map(item => [
					'r' + item.revision,
					item.event,
					item.summary || item.taskId,
					item.note
				].filter(Boolean).join(' - ')).join('\\n'), false);
			}
		}
		function renderPlanCanvasStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const features = Array.isArray(status.features) ? status.features : [];
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-plan-canvas-status]');
			const summary = document.querySelector('[data-plan-canvas-summary]');
			const cards = document.querySelector('[data-plan-canvas-cards]');
			const list = document.querySelector('[data-plan-canvas-features]');
			section.hidden = !status.ok && features.length === 0;
			cards.textContent = '';
			list.textContent = '';
			if (section.hidden) {
				summary.textContent = '';
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Route: ' + (status.route || 'unknown'),
				'Graph source: ' + (status.graphSource || 'none'),
				'Renderer features: ' + (counts.readyFeatures ?? 0) + '/' + (counts.features ?? 0),
				'Graph/checklist links: ' + (counts.linkedSteps ?? 0) + '/' + (counts.steps ?? 0),
				status.nextAction ? 'Next: ' + status.nextAction : undefined
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Canvas Route', status.route || 'unknown', [
				'Ready: ' + String(Boolean(status.ready)),
				'Approval locked: ' + String(Boolean(status.approvalLocked)),
				status.taskId ? 'Plan: ' + status.taskId + ' r' + status.revision : 'No active visual plan',
				status.planHash ? 'Plan hash: ' + status.planHash : undefined
			].filter(Boolean).join('\\n'), !status.ready);
			addStatusCard(cards, 'Offline Renderer', status.graphSource || 'none', [
				'Local SVG rendering from parsed Mermaid model.',
				'No runtime Mermaid CDN import.',
				'Last-valid graph retention and checklist fallback are available.'
			].join('\\n'), status.graphSource === 'none');
			addStatusCard(cards, 'Binding Coverage', String(counts.linkedSteps ?? 0) + '/' + String(counts.steps ?? 0), [
				'Nodes: ' + (counts.nodes ?? 0),
				'Edges: ' + (counts.edges ?? 0),
				'Missing flow nodes: ' + (counts.missingFlowNodeIds ?? 0),
				'Duplicate flow nodes: ' + (counts.duplicateFlowNodeIds ?? 0)
			].join('\\n'), (counts.missingFlowNodeIds ?? 0) > 0 || (counts.duplicateFlowNodeIds ?? 0) > 0);
			if (blockers.length) {
				addStatusCard(cards, 'Canvas Blockers', String(blockers.length), blockers.slice(0, 8).join('\\n'), true);
			}
			if (guardrails.length) {
				addStatusCard(cards, 'Read-Only Canvas Guardrails', String(guardrails.length), guardrails.slice(0, 6).join('\\n'), false);
			}
			for (const feature of features.slice(0, 12)) {
				addStatusCard(list, feature.title || feature.id || 'Canvas feature', feature.ready ? 'ready' : 'blocked', feature.detail || '', !feature.ready);
			}
		}
		function renderPlanEditStatus(message) {
			const status = message.status || {};
			const render = status.render || {};
			const requestedEdit = status.requestedEdit || {};
			const changes = status.changes || {};
			const validationErrors = Array.isArray(status.validationErrors) ? status.validationErrors : [];
			const editErrors = Array.isArray(status.editErrors) ? status.editErrors : [];
			const repairHints = Array.isArray(status.repairHints) ? status.repairHints : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-plan-edit-status]');
			const summary = document.querySelector('[data-plan-edit-summary]');
			const cards = document.querySelector('[data-plan-edit-cards]');
			const details = document.querySelector('[data-plan-edit-details]');
			section.hidden = false;
			summary.textContent = '';
			cards.textContent = '';
			details.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.taskId ? 'Task: ' + status.taskId + ' r' + status.currentRevision : 'No active visual plan',
				status.prospectiveRevision ? 'Prospective revision: r' + status.prospectiveRevision : undefined,
				status.editedPlanIdentity?.planHash ? 'Prospective planHash: ' + status.editedPlanIdentity.planHash : undefined,
				status.stepId ? 'Step: ' + status.stepId : undefined,
				'Changed: ' + String(Boolean(status.changed)),
				'Approval ready after edit: ' + String(Boolean(status.approvalReady)),
				'Next action: ' + (status.nextAction || 'unknown')
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Manual Edit Gate', status.nextAction || 'unknown', [
				'Active plan available: ' + String(Boolean(status.activePlanAvailable)),
				'Edit present: ' + String(Boolean(status.editPresent)),
				'Mutation locked: ' + String(Boolean(status.mutationLocked)),
				editErrors.length ? 'Edit errors:\\n' + editErrors.slice(0, 6).join('\\n') : 'No edit errors.'
			].join('\\n'), !status.ok || status.nextAction === 'repair_edit' || status.nextAction === 'wait_for_plan');
			addStatusCard(cards, 'Changed Fields', status.changed ? 'changed' : 'unchanged', [
				'Title changed: ' + String(Boolean(changes.titleChanged)),
				'Status changed: ' + String(Boolean(changes.statusChanged)),
				requestedEdit.title ? 'Requested title: ' + requestedEdit.title : undefined,
				requestedEdit.status ? 'Requested status: ' + requestedEdit.status : undefined
			].filter(Boolean).join('\\n') || 'No changed fields detected.', !status.changed && status.nextAction !== 'no_change');
			addStatusCard(cards, 'Schema / Graph', status.valid ? 'valid' : 'blocked', [
				'Safe Mermaid: ' + String(Boolean(render.safeMermaid)),
				'Nodes: ' + (render.nodeCount ?? 0),
				'Edges: ' + (render.edgeCount ?? 0),
				'Checklist linked: ' + (render.linkedStepCount ?? 0) + '/' + (render.stepCount ?? 0),
				validationErrors.length ? 'Validation errors:\\n' + validationErrors.slice(0, 6).join('\\n') : undefined
			].filter(Boolean).join('\\n'), !status.valid);
			addStatusCard(cards, 'Revision Identity', status.editedPlanIdentity?.planHash ? 'ready' : 'missing', [
				status.previousPlanIdentity?.planHash ? 'Previous: ' + status.previousPlanIdentity.planHash : undefined,
				status.editedPlanIdentity?.planHash ? 'Edited: ' + status.editedPlanIdentity.planHash : undefined,
				'Current revision: ' + (status.currentRevision ?? 'none'),
				'Prospective revision: ' + (status.prospectiveRevision ?? 'none')
			].filter(Boolean).join('\\n'), !status.editedPlanIdentity?.planHash);
			if (repairHints.length) {
				addStatusCard(details, 'Repair Hints', String(repairHints.length), repairHints.slice(0, 8).join('\\n'), status.nextAction === 'repair_edit' || status.nextAction === 'wait_for_plan');
			}
			if (guardrails.length) {
				addStatusCard(details, 'Read-Only Guardrails', String(guardrails.length), guardrails.slice(0, 6).join('\\n'), false);
			}
		}
		function renderList(container, items) {
			container.textContent = '';
			for (const item of items) {
				const li = document.createElement('li');
				li.textContent = item;
				container.appendChild(li);
			}
		}
		function renderPlanFocusStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-plan-focus-status]');
			const summary = document.querySelector('[data-plan-focus-summary]');
			const cards = document.querySelector('[data-plan-focus-cards]');
			const bindingsList = document.querySelector('[data-plan-focus-bindings]');
			const counts = status.counts || {};
			const focus = status.focus || {};
			const target = status.target || {};
			const bindings = Array.isArray(status.bindings) ? status.bindings : [];
			const repairHints = Array.isArray(status.repairHints) ? status.repairHints : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = false;
			cards.textContent = '';
			bindingsList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.taskId ? 'Task: ' + status.taskId + ' r' + status.revision : 'No active visual plan',
				'Valid: ' + String(Boolean(status.valid)),
				'Bindings linked: ' + (counts.linkedBindings ?? 0) + '/' + (counts.bindings ?? 0),
				'Graph nodes: ' + (counts.graphNodes ?? 0),
				'Checklist steps: ' + (counts.steps ?? 0),
				focus.requestedBy ? 'Focus target: ' + focus.requestedBy : undefined,
				focus.flowNodeId ? 'Flow node: ' + focus.flowNodeId : undefined,
				focus.stepIds?.length ? 'Steps: ' + focus.stepIds.join(', ') : undefined
			].filter(Boolean).join('\\n');
			const statusCards = [
				{
					title: 'Binding Coverage',
					badge: (counts.linkedBindings ?? 0) + '/' + (counts.bindings ?? 0),
					blocked: (counts.missingGraphNodes || 0) > 0 || (counts.duplicateFlowNodeIds || 0) > 0 || !status.valid,
					detail: [
						'Missing graph nodes: ' + (counts.missingGraphNodes ?? 0),
						'Duplicate flow node ids: ' + (counts.duplicateFlowNodeIds ?? 0),
						'Graph edges: ' + (counts.graphEdges ?? 0),
						Array.isArray(status.validationErrors) && status.validationErrors.length ? 'Validation: ' + status.validationErrors.join('; ') : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Focus Target',
					badge: focus.matched ? 'matched' : focus.available ? 'unmatched' : 'none',
					blocked: !focus.matched,
					detail: [
						target.stepId ? 'Requested step: ' + target.stepId : undefined,
						target.flowNodeId ? 'Requested flow node: ' + target.flowNodeId : undefined,
						target.file ? 'Requested file: ' + target.file : undefined,
						'Graph node present: ' + String(Boolean(focus.graphNodePresent)),
						'Checklist linked: ' + String(Boolean(focus.checklistLinked)),
						focus.message
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Repair Hints',
					badge: String(repairHints.length),
					blocked: repairHints.length > 0 && !focus.matched,
					detail: repairHints.length ? repairHints.join('\\n') : 'Plan focus bindings are ready.'
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Plan focus status is read-only.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const binding of bindings.slice(0, 16)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = binding.flowNodeId || binding.nodeId || 'flow node';
				const badge = document.createElement('span');
				badge.className = binding.graphNodePresent ? 'badge' : 'badge risk-blocked';
				badge.textContent = binding.graphNodePresent ? 'linked' : 'missing node';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				const statuses = binding.statuses || {};
				detail.textContent = [
					binding.stepIds?.length ? 'Steps: ' + binding.stepIds.join(', ') : undefined,
					binding.stepTitles?.length ? 'Titles: ' + binding.stepTitles.join('; ') : undefined,
					binding.files?.length ? 'Files: ' + binding.files.join(', ') : undefined,
					'Statuses: pending=' + (statuses.pending || 0) + ', in_progress=' + (statuses.in_progress || 0) + ', completed=' + (statuses.completed || 0) + ', blocked=' + (statuses.blocked || 0) + ', failed=' + (statuses.failed || 0)
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				bindingsList.appendChild(item);
			}
		}
		function renderSteps(plan) {
			const container = document.querySelector('[data-steps]');
			container.textContent = '';
			for (const step of plan.steps || []) {
				const li = document.createElement('li');
					li.dataset.node = step.flowNodeId;
					li.dataset.stepId = step.id;
					li.tabIndex = 0;
					li.addEventListener('mouseenter', () => activatePlanFocus(step.flowNodeId, 'checklistHover', step.id));
					li.addEventListener('mouseleave', () => clearPlanFocus('checklistHover'));
					li.addEventListener('focusin', () => activatePlanFocus(step.flowNodeId, 'checklistFocus', step.id));
					li.addEventListener('focusout', () => clearPlanFocus('checklistFocus'));
				const row = document.createElement('div');
				row.className = 'plan-step-edit';
				const status = document.createElement('select');
				for (const option of ['pending', 'in_progress', 'completed', 'blocked', 'failed']) {
					const item = document.createElement('option');
					item.value = option;
					item.textContent = option.replace('_', ' ');
					item.selected = step.status === option;
					status.appendChild(item);
				}
				const title = document.createElement('input');
				title.value = step.title;
				title.setAttribute('aria-label', 'Plan step title');
				const apply = document.createElement('button');
				apply.className = 'secondary';
				apply.textContent = 'Apply';
				const submit = () => submitPlanStepEdit(step, title, status);
				status.addEventListener('change', submit);
				title.addEventListener('keydown', event => {
					if (event.key === 'Enter') {
						event.preventDefault();
						submit();
					}
				});
				apply.addEventListener('click', submit);
				row.appendChild(status);
				row.appendChild(title);
				row.appendChild(apply);
				li.appendChild(row);
				const files = Array.isArray(step.files) ? step.files.filter(file => typeof file === 'string' && file.trim()).slice(0, 12) : [];
				if (files.length) {
					const fileRow = document.createElement('div');
					fileRow.className = 'plan-step-files';
					fileRow.dataset.node = step.flowNodeId;
					fileRow.setAttribute('aria-label', 'Related files for ' + step.id);
					fileRow.addEventListener('mouseenter', () => activatePlanFocus(step.flowNodeId, 'relatedFileHover', step.id, files[0]));
					fileRow.addEventListener('mouseleave', () => clearPlanFocus('relatedFileHover'));
					fileRow.addEventListener('focusin', event => {
						const target = event.target;
						const file = target && target.dataset ? target.dataset.file : files[0];
						activatePlanFocus(step.flowNodeId, 'relatedFileFocus', step.id, file);
					});
					fileRow.addEventListener('focusout', () => clearPlanFocus('relatedFileFocus'));
					for (const file of files) {
						const button = document.createElement('button');
						button.className = 'secondary plan-step-file';
						button.textContent = file;
						button.title = 'Open ' + file;
						button.dataset.file = file;
						button.addEventListener('mouseenter', () => activatePlanFocus(step.flowNodeId, 'relatedFileHover', step.id, file));
						button.addEventListener('focus', () => activatePlanFocus(step.flowNodeId, 'relatedFileFocus', step.id, file));
						button.addEventListener('click', event => {
							event.stopPropagation();
							activatePlanFocus(step.flowNodeId, 'relatedFileClick', step.id, file);
							vscode.postMessage({ command: 'openWorkspacePath', path: file });
						});
						fileRow.appendChild(button);
					}
					if (Array.isArray(step.files) && step.files.length > files.length) {
						const more = document.createElement('span');
						more.className = 'mention-detail';
						more.textContent = '+' + (step.files.length - files.length) + ' more';
						fileRow.appendChild(more);
					}
					li.appendChild(fileRow);
				}
				container.appendChild(li);
			}
		}
		function submitPlanStepEdit(step, title, status) {
			const nextTitle = title.value.trim();
			if (!nextTitle) {
				title.value = step.title;
				return;
			}
			vscode.postMessage(Object.assign(planActionPayload('editPlanStep'), {
				command: 'editPlanStep',
				stepId: step.id,
				title: nextTitle,
				status: status.value
			}));
		}
		function planActionPayload(command) {
			return Object.assign({ command }, activePlanIdentity || {});
		}
		function renderFlow(plan, flow) {
			const container = document.querySelector('[data-flow]');
			const status = document.querySelector('[data-flow-status]');
			container.textContent = '';
			if (flow && flow.valid && Array.isArray(flow.nodes) && flow.nodes.length) {
				lastValidFlow = flow;
				lastValidFlowTaskId = plan.taskId;
				status.className = 'flow-status';
				status.textContent = 'Graph rendered from validated Mermaid for revision ' + plan.revision + '.';
				renderParsedFlow(container, plan, flow);
				return;
			}
			if (lastValidFlow && lastValidFlowTaskId === plan.taskId) {
				status.className = 'flow-status warning';
				status.textContent = 'Latest Mermaid is invalid; keeping the last valid graph while checklist edits continue. ' + flowErrors(flow);
				renderParsedFlow(container, plan, lastValidFlow);
				return;
			}
			status.className = 'flow-status warning';
			status.textContent = 'Mermaid is invalid; rendering a checklist-derived fallback graph. ' + flowErrors(flow);
			renderStepFlow(container, plan);
		}
		function flowErrors(flow) {
			const errors = flow && Array.isArray(flow.errors) ? flow.errors.filter(Boolean) : [];
			return errors.length ? errors.slice(0, 3).join(' ') : '';
		}
		function renderParsedFlow(container, plan, flow) {
			const nodes = flow.nodes || [];
			const edges = flow.edges || [];
			const horizontal = flow.direction === 'LR' || flow.direction === 'RL';
			const width = horizontal ? Math.max(540, nodes.length * 210 + 32) : 540;
			const height = horizontal ? 180 : Math.max(120, nodes.length * 78 + 28);
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
			const stepStatus = new Map((plan.steps || []).map(step => [step.flowNodeId, step.status]));
			const positions = new Map();
			for (let index = 0; index < nodes.length; index++) {
				const node = nodes[index];
				const x = horizontal ? 18 + index * 210 : 18;
				const y = horizontal ? 54 : 22 + index * 78;
				positions.set(node.id, { x, y, cx: x + 126, cy: y + 26 });
			}
			for (const edge of edges) {
				const from = positions.get(edge.from);
				const to = positions.get(edge.to);
				if (!from || !to) {
					continue;
				}
				const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
				line.setAttribute('x1', String(from.cx));
				line.setAttribute('y1', String(from.cy));
				line.setAttribute('x2', String(to.cx));
				line.setAttribute('y2', String(to.cy));
				line.setAttribute('stroke', 'var(--vscode-editorWidget-border)');
				line.setAttribute('stroke-width', '2');
				svg.appendChild(line);
				if (edge.label) {
					const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
					label.setAttribute('x', String((from.cx + to.cx) / 2));
					label.setAttribute('y', String((from.cy + to.cy) / 2 - 6));
					label.setAttribute('text-anchor', 'middle');
					label.setAttribute('fill', 'var(--vscode-descriptionForeground)');
					label.setAttribute('font-size', '11');
					label.textContent = edge.label.slice(0, 32);
					svg.appendChild(label);
				}
			}
			for (const node of nodes) {
				const position = positions.get(node.id);
				if (!position) {
					continue;
				}
					const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
					group.dataset.node = node.id;
					group.addEventListener('mouseenter', () => activatePlanFocus(node.id, 'graphHover'));
					group.addEventListener('mouseleave', () => clearPlanFocus('graphHover'));
					group.addEventListener('click', () => {
						focusStepForNode(node.id);
						activatePlanFocus(node.id, 'graphClick');
					});
				const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
				rect.setAttribute('x', String(position.x));
				rect.setAttribute('y', String(position.y));
				rect.setAttribute('width', '252');
				rect.setAttribute('height', '52');
				rect.setAttribute('rx', '6');
				rect.setAttribute('fill', statusFill(stepStatus.get(node.id) || 'pending'));
				rect.setAttribute('stroke', 'var(--vscode-input-border)');
				rect.setAttribute('stroke-width', '1.5');
				const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
				label.setAttribute('x', String(position.x + 14));
				label.setAttribute('y', String(position.y + 31));
				label.setAttribute('fill', 'var(--vscode-foreground)');
				label.setAttribute('font-size', '13');
				label.textContent = node.id + '  ' + node.label.slice(0, 44);
				group.appendChild(rect);
				group.appendChild(label);
				svg.appendChild(group);
			}
			container.appendChild(svg);
		}
		function renderStepFlow(container, plan) {
			const steps = plan.steps || [];
			const height = Math.max(120, steps.length * 78 + 28);
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 540 ' + height);
			for (let index = 0; index < steps.length - 1; index++) {
				const y1 = 48 + index * 78;
				const y2 = 48 + (index + 1) * 78;
				const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
				line.setAttribute('x1', '270');
				line.setAttribute('y1', String(y1 + 22));
				line.setAttribute('x2', '270');
				line.setAttribute('y2', String(y2 - 22));
				line.setAttribute('stroke', 'var(--vscode-editorWidget-border)');
				line.setAttribute('stroke-width', '2');
				svg.appendChild(line);
			}
			for (let index = 0; index < steps.length; index++) {
				const step = steps[index];
				const y = 22 + index * 78;
					const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
					group.dataset.node = step.flowNodeId;
					group.addEventListener('mouseenter', () => activatePlanFocus(step.flowNodeId, 'fallbackGraphHover', step.id));
					group.addEventListener('mouseleave', () => clearPlanFocus('fallbackGraphHover'));
					group.addEventListener('click', () => {
						focusStepForNode(step.flowNodeId);
						activatePlanFocus(step.flowNodeId, 'fallbackGraphClick', step.id);
					});
				const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
				rect.setAttribute('x', '18');
				rect.setAttribute('y', String(y));
				rect.setAttribute('width', '504');
				rect.setAttribute('height', '52');
				rect.setAttribute('rx', '6');
				rect.setAttribute('fill', statusFill(step.status));
				rect.setAttribute('stroke', 'var(--vscode-input-border)');
				rect.setAttribute('stroke-width', '1.5');
				const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
				label.setAttribute('x', '34');
				label.setAttribute('y', String(y + 31));
				label.setAttribute('fill', 'var(--vscode-foreground)');
				label.setAttribute('font-size', '13');
				label.textContent = step.flowNodeId + '  ' + step.title.slice(0, 72);
				group.appendChild(rect);
				group.appendChild(label);
				svg.appendChild(group);
			}
			container.appendChild(svg);
		}
		function highlightNode(nodeId) {
			for (const item of document.querySelectorAll('[data-node]')) {
				const active = nodeId && item.dataset.node === nodeId;
				item.classList.toggle('active', Boolean(active));
				const rect = item.querySelector ? item.querySelector('rect') : undefined;
				if (rect) {
					rect.setAttribute('stroke-width', active ? '3' : '1.5');
					rect.setAttribute('stroke', active ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-border)');
					}
				}
			}
			function activatePlanFocus(flowNodeId, source, stepId, file) {
				highlightNode(flowNodeId);
				emitPlanFocus(flowNodeId, source, true, stepId, file);
			}
			function clearPlanFocus(source) {
				highlightNode(undefined);
				emitPlanFocus(undefined, source, false, undefined, undefined);
			}
			function emitPlanFocus(flowNodeId, source, active, stepId, file) {
				const key = [active ? '1' : '0', source || '', flowNodeId || '', stepId || '', file || ''].join('|');
				if (key === lastPlanFocusEventKey) {
					return;
				}
				lastPlanFocusEventKey = key;
				vscode.postMessage(Object.assign(planActionPayload('planFocusChanged'), {
					command: 'planFocusChanged',
					source: source || 'unknown',
					active: Boolean(active),
					...(flowNodeId ? { flowNodeId } : {}),
					...(stepId ? { stepId } : {}),
					...(file ? { file } : {})
				}));
			}
			function focusStepForNode(nodeId) {
				if (!nodeId) {
					return;
			}
			highlightNode(nodeId);
			let step = undefined;
			for (const candidate of document.querySelectorAll('[data-steps] [data-node]')) {
				if (candidate.dataset.node === nodeId) {
					step = candidate;
					break;
				}
			}
			if (!step) {
				return;
			}
			step.scrollIntoView({ block: 'nearest' });
			const input = step.querySelector('input, select, button');
			if (input && typeof input.focus === 'function') {
				input.focus();
			} else if (typeof step.focus === 'function') {
				step.focus();
			}
		}
		function statusGlyph(status) {
			if (status === 'completed') { return '[x]'; }
			if (status === 'in_progress') { return '[>]'; }
			if (status === 'failed') { return '[!]'; }
			if (status === 'blocked') { return '[-]'; }
			return '[ ]';
		}
		function statusFill(status) {
			if (status === 'completed') { return 'rgba(45, 164, 78, .18)'; }
			if (status === 'in_progress') { return 'rgba(88, 166, 255, .18)'; }
			if (status === 'failed') { return 'rgba(248, 81, 73, .18)'; }
			if (status === 'blocked') { return 'rgba(187, 128, 9, .18)'; }
			return 'var(--vscode-editor-background)';
		}
		function renderApprovals() {
			const section = document.querySelector('[data-approvals]');
			const list = document.querySelector('[data-approval-list]');
			section.hidden = approvals.size === 0;
			list.textContent = '';
			for (const card of approvals.values()) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.risk;
				title.appendChild(badge);
				const desc = document.createElement('p');
				desc.textContent = card.description || '';
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail || '';
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const accept = document.createElement('button');
				accept.textContent = 'Accept';
				accept.disabled = Boolean(card.blocked);
				accept.addEventListener('click', () => vscode.postMessage({ command: 'approvalDecision', id: String(card.id), decision: 'accept' }));
				const decline = document.createElement('button');
				decline.className = 'secondary';
				decline.textContent = 'Decline';
				decline.addEventListener('click', () => vscode.postMessage({ command: 'approvalDecision', id: String(card.id), decision: 'decline' }));
				actions.appendChild(accept);
				actions.appendChild(decline);
				item.appendChild(title);
				item.appendChild(desc);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderApprovalStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-approval-status]');
			const summary = document.querySelector('[data-approval-status-summary]');
			const cards = document.querySelector('[data-approval-status-cards]');
			const list = document.querySelector('[data-approval-status-list]');
			section.hidden = !status || (status.total || 0) === 0;
			cards.textContent = '';
			list.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			summary.textContent = [
				message.summary || status.message || '',
				'Pending approvals: ' + (status.total ?? 0),
				'Actionable: ' + (status.actionable ?? 0),
				'Blocked: ' + (status.blocked ?? 0)
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Approval Gate', (status.actionable ?? 0) + ' actionable', [
				'Terminal: ' + (counts.terminal ?? 0),
				'File: ' + (counts.file ?? 0),
				'Tool: ' + (counts.tool ?? 0),
				'Generic: ' + (counts.generic ?? 0)
			].join('\\n'), (status.blocked || 0) > 0);
			addStatusCard(cards, 'Approval Guardrails', String((status.guardrails || []).length), (status.guardrails || []).slice(0, 4).join('\\n'), false);
			for (const approval of (status.approvals || []).slice(0, 10)) {
				addStatusCard(list, approval.title || approval.id, (approval.canAccept ? 'actionable' : 'blocked') + ' - ' + (approval.risk || 'risk'), [
					approval.description,
					approval.kind ? 'Kind: ' + approval.kind : undefined,
					approval.toolName ? 'Tool: ' + approval.toolName : undefined,
					approval.commandLine ? 'Command: ' + approval.commandLine : undefined,
					approval.paths?.length ? 'Paths: ' + approval.paths.join(', ') : undefined,
					approval.blockedReasons?.length ? 'Blocked: ' + approval.blockedReasons.join('; ') : undefined,
					approval.detail
				].filter(Boolean).join('\\n'), !approval.canAccept);
			}
		}
			function renderUserInputRequests() {
				const section = document.querySelector('[data-user-input]');
				const list = document.querySelector('[data-user-input-list]');
				section.hidden = userInputRequests.size === 0;
			list.textContent = '';
			for (const request of userInputRequests.values()) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = request.title || 'User input requested';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = request.kind || 'question';
				title.appendChild(badge);
				const prompt = document.createElement('p');
				prompt.textContent = request.prompt || '';
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = request.detail || '';
				const suggestions = document.createElement('div');
				suggestions.className = 'card-actions';
				const suggestionChoices = request.suggestionChoices || (request.suggestions || []).map((suggestion, index) => ({ index, label: suggestion, value: suggestion }));
				for (const suggestion of suggestionChoices) {
					const button = document.createElement('button');
					button.className = 'secondary';
					button.textContent = suggestion.label || suggestion.value || '';
					if (suggestion.description) {
						button.title = suggestion.description;
					}
					button.addEventListener('click', () => vscode.postMessage({ command: 'userInputResponse', id: String(request.id), answer: suggestion.value || suggestion.label || '', selectedSuggestionIndex: suggestion.index }));
					suggestions.appendChild(button);
				}
				const input = document.createElement('textarea');
				input.placeholder = request.placeholder || 'Reply to Codex...';
				input.rows = 3;
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const send = document.createElement('button');
				send.textContent = 'Send response';
				send.addEventListener('click', () => vscode.postMessage({ command: 'userInputResponse', id: String(request.id), answer: input.value }));
				const cancel = document.createElement('button');
				cancel.className = 'secondary';
				cancel.textContent = 'Cancel';
				cancel.addEventListener('click', () => vscode.postMessage({ command: 'userInputResponse', id: String(request.id), cancelled: true }));
				actions.appendChild(send);
				actions.appendChild(cancel);
				item.appendChild(title);
				item.appendChild(prompt);
				if (request.detail) {
					item.appendChild(detail);
				}
				if (suggestionChoices.length) {
					item.appendChild(suggestions);
				}
				item.appendChild(input);
				item.appendChild(actions);
					list.appendChild(item);
				}
			}
			function renderUserInputStatus(message) {
				const status = message.status || {};
				const counts = status.counts || {};
				const requests = Array.isArray(status.requests) ? status.requests : [];
				const section = document.querySelector('[data-user-input-status]');
				const summary = document.querySelector('[data-user-input-status-summary]');
				const list = document.querySelector('[data-user-input-status-list]');
				section.hidden = (counts.pending || 0) === 0;
				list.textContent = '';
				summary.textContent = [
					message.summary || status.message || '',
					'Pending: ' + (counts.pending ?? 0),
					'Questions: ' + (counts.questions ?? 0),
					'Plan feedback: ' + (counts.planFeedback ?? 0),
					status.nextAction
				].filter(Boolean).join('\\n');
				for (const request of requests.slice(0, 8)) {
					addStatusCard(list, request.title || 'User input requested', request.kind || 'question', [
						request.prompt,
						request.detail,
						request.suggestions?.length ? 'Suggestions: ' + request.suggestions.join(', ') : undefined,
						'Request id: ' + request.id
					].filter(Boolean).join('\\n'), request.kind === 'plan_feedback');
				}
				if (counts.truncated) {
					addStatusCard(list, 'More user input requests', 'truncated', 'Additional pending requests are hidden by the current maxRequests cap.', false);
				}
			}
			function renderBrowserStatus(message) {
				const status = message.status || {};
			const section = document.querySelector('[data-browser-status]');
			const summary = document.querySelector('[data-browser-status-summary]');
			const cards = document.querySelector('[data-browser-status-cards]');
			const actionsList = document.querySelector('[data-browser-status-actions]');
			const controller = status.controller || {};
			const capabilities = status.capabilities || {};
			const approval = status.approval || {};
			const counts = status.counts || {};
			const pendingActions = Array.isArray(status.pendingActions) ? status.pendingActions : [];
			const supportedActions = Array.isArray(capabilities.supportedActions) ? capabilities.supportedActions : [];
			const nativeRequiredActions = Array.isArray(capabilities.nativeRequiredActions) ? capabilities.nativeRequiredActions : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = false;
			cards.textContent = '';
			actionsList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Controller: ' + (controller.nativeControllerAvailable ? 'native available' : 'external VSIX'),
				'Pending actions: ' + (counts.pendingActions ?? 0),
				'Supported pending: ' + (counts.supportedPendingActions ?? 0),
				'Native-required pending: ' + (counts.nativeRequiredPendingActions ?? 0),
				'Plan authorization: ' + (approval.hasExecutionAuthorization ? 'approved' : 'required'),
				'Safe URL required: ' + String(Boolean(capabilities.safeUrlRequired)),
				'Loopback preview panel: ' + String(Boolean(capabilities.loopbackPreviewPanel))
			].filter(Boolean).join('\\n');
			const statusCards = [
				{
					title: 'Controller',
					badge: controller.nativeControllerAvailable ? 'native' : 'extension',
					blocked: false,
					detail: [
						controller.externalExtension ? 'External extension controller: yes' : undefined,
						controller.nativeControllerAvailable ? 'Native controller is available.' : 'Native controller is not available in the standalone VSIX.',
						nativeRequiredActions.length ? 'Native-required: ' + nativeRequiredActions.join(', ') : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Approval Gate',
					badge: approval.hasExecutionAuthorization ? 'authorized' : 'locked',
					blocked: !approval.hasExecutionAuthorization,
					detail: [
						'Exact plan approval required: ' + String(Boolean(approval.exactPlanApprovalRequired)),
						'Explicit approval required: ' + String(Boolean(approval.explicitUserApprovalRequired)),
						'Pending browser actions: ' + (approval.pendingActions ?? counts.pendingActions ?? 0)
					].join('\\n')
				},
				{
					title: 'Supported Actions',
					badge: String(supportedActions.length),
					blocked: supportedActions.length === 0,
					detail: [
						supportedActions.length ? 'Standalone VSIX: ' + supportedActions.join(', ') : 'No standalone browser actions reported.',
						Array.isArray(capabilities.supportedUrlSchemes) && capabilities.supportedUrlSchemes.length ? 'URL schemes: ' + capabilities.supportedUrlSchemes.join(', ') : undefined,
						'Safe HTTP(S) URLs only.'
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Browser status is read-only.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const action of pendingActions) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = action.title || action.action || 'Browser action';
				const badge = document.createElement('span');
				badge.className = action.supported ? 'badge' : 'badge risk-blocked';
				badge.textContent = action.supported ? action.action || 'supported' : 'native required';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					action.detail,
					action.url ? 'URL: ' + action.url : undefined,
					action.selector ? 'Selector: ' + action.selector : undefined,
					action.textPreview ? 'Text: ' + action.textPreview : undefined,
					action.requestedAt ? 'Requested: ' + new Date(action.requestedAt).toLocaleTimeString() : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				actionsList.appendChild(item);
			}
		}
		function renderBrowserActionStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-browser-action-status]');
			const summary = document.querySelector('[data-browser-action-status-summary]');
			const cards = document.querySelector('[data-browser-action-status-cards]');
			const eventsList = document.querySelector('[data-browser-action-status-events]');
			const counts = status.counts || {};
			const controller = status.controller || {};
			const capabilities = status.capabilities || {};
			const events = Array.isArray(status.events) ? status.events : [];
			const pendingActions = Array.isArray(status.pendingActions) ? status.pendingActions : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = !status.ok && events.length === 0 && pendingActions.length === 0;
			cards.textContent = '';
			eventsList.textContent = '';
			if (section.hidden) {
				summary.textContent = '';
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				'Controller: ' + (controller.nativeControllerAvailable ? 'native available' : 'external VSIX handoff'),
				'Pending: ' + (counts.pendingActions ?? 0),
				'Started: ' + (counts.started ?? 0),
				'Native-required handoffs: ' + (counts.nativeRequired ?? 0),
				status.nextAction
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Action Evidence', String(counts.events ?? 0), [
				'Started open/navigate: ' + (counts.openNavigateStarted ?? 0),
				'Declined: ' + (counts.declined ?? 0),
				'Blocked: ' + (counts.blocked ?? 0),
				'Native required: ' + (counts.nativeRequired ?? 0)
			].join('\\n'), Boolean(counts.blocked || counts.nativeRequired));
			addStatusCard(cards, 'Pending Browser Actions', String(counts.pendingActions ?? 0), [
				'Supported pending: ' + (counts.supportedPendingActions ?? 0),
				'Native-required pending: ' + (counts.nativeRequiredPendingActions ?? 0)
			].join('\\n'), Boolean(counts.nativeRequiredPendingActions));
			addStatusCard(cards, 'Controller Boundary', controller.nativeControllerAvailable ? 'native' : 'handoff', [
				'External extension: ' + String(Boolean(controller.externalExtension)),
				'Supported in VSIX: ' + ((capabilities.supportedActions || []).join(', ') || 'none'),
				'Native required: ' + ((capabilities.nativeRequiredActions || []).join(', ') || 'none'),
				'Safe URL required: ' + String(Boolean(capabilities.safeUrlRequired))
			].join('\\n'), !controller.nativeControllerAvailable);
			if (guardrails.length) {
				addStatusCard(cards, 'Read-Only Browser Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n'), false);
			}
			for (const event of [...pendingActions, ...events].slice(0, 12)) {
				addStatusCard(eventsList, event.action || 'browser action', event.state || (event.supported ? 'pending' : 'native_required'), [
					event.url ? 'URL: ' + event.url : undefined,
					event.selector ? 'Selector: ' + event.selector : undefined,
					event.textPreview ? 'Text: ' + event.textPreview : undefined,
					event.reason ? 'Reason: ' + event.reason : undefined,
					event.responseMessage ? 'Response: ' + event.responseMessage : undefined,
					event.detail,
					event.recordedAt ? 'Recorded: ' + new Date(event.recordedAt).toLocaleTimeString() : undefined
				].filter(Boolean).join('\\n'), event.state === 'blocked' || event.state === 'native_required' || event.nativeControllerRequired);
			}
		}
		function renderBrowserActions() {
			const section = document.querySelector('[data-browser-actions]');
			const list = document.querySelector('[data-browser-action-list]');
			section.hidden = browserActions.size === 0;
			list.textContent = '';
			for (const action of browserActions.values()) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = action.title;
				const badge = document.createElement('span');
				badge.className = action.supported ? 'badge' : 'badge risk-blocked';
				badge.textContent = action.supported ? action.action : 'native required';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = action.detail || '';
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const accept = document.createElement('button');
				accept.textContent = 'Accept';
				accept.disabled = !action.supported;
				accept.addEventListener('click', () => vscode.postMessage({ command: 'browserActionDecision', id: String(action.id), decision: 'accept' }));
				const decline = document.createElement('button');
				decline.className = 'secondary';
				decline.textContent = 'Decline';
				decline.addEventListener('click', () => vscode.postMessage({ command: 'browserActionDecision', id: String(action.id), decision: 'decline' }));
				actions.appendChild(accept);
				actions.appendChild(decline);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderMcpActions() {
			const section = document.querySelector('[data-mcp-actions]');
			const list = document.querySelector('[data-mcp-action-list]');
			section.hidden = mcpActions.size === 0;
			list.textContent = '';
			for (const action of mcpActions.values()) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = action.title;
				const badge = document.createElement('span');
				badge.className = action.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = action.risk;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = action.detail || [action.serverName, action.toolName, action.resourceUri].filter(Boolean).join('\\n');
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const accept = document.createElement('button');
				accept.textContent = 'Approve';
				accept.disabled = Boolean(action.blocked);
				accept.addEventListener('click', () => vscode.postMessage({ command: 'mcpActionDecision', id: String(action.id), decision: 'accept' }));
				const decline = document.createElement('button');
				decline.className = 'secondary';
				decline.textContent = 'Decline';
				decline.addEventListener('click', () => vscode.postMessage({ command: 'mcpActionDecision', id: String(action.id), decision: 'decline' }));
				actions.appendChild(accept);
				actions.appendChild(decline);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderWebFetches() {
			const section = document.querySelector('[data-web-fetches]');
			const list = document.querySelector('[data-web-fetch-list]');
			section.hidden = webFetches.size === 0;
			list.textContent = '';
			for (const request of webFetches.values()) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = request.title || 'Web fetch approval';
				const badge = document.createElement('span');
				badge.className = request.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = request.risk || 'medium';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = request.detail || request.url || '';
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const accept = document.createElement('button');
				accept.textContent = 'Approve fetch';
				accept.disabled = Boolean(request.blocked);
				accept.addEventListener('click', () => vscode.postMessage({ command: 'webFetchDecision', id: String(request.id), decision: 'accept' }));
				const decline = document.createElement('button');
				decline.className = 'secondary';
				decline.textContent = 'Decline';
				decline.addEventListener('click', () => vscode.postMessage({ command: 'webFetchDecision', id: String(request.id), decision: 'decline' }));
				actions.appendChild(accept);
				actions.appendChild(decline);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderDiffReview(review) {
			const section = document.querySelector('[data-diff]');
			const list = document.querySelector('[data-diff-list]');
			const acceptAll = document.querySelector('[data-accept-all-diffs]');
			const rejectAll = document.querySelector('[data-reject-all-diffs]');
			section.hidden = false;
			const files = review.files || [];
			acceptAll.disabled = files.length === 0 || files.every(file => file.status === 'accepted');
			rejectAll.disabled = files.length === 0 || files.every(file => file.status === 'rejected');
			list.textContent = '';
			for (const file of files) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = file.path;
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = file.status;
				title.appendChild(badge);
				const code = document.createElement('pre');
				code.className = 'diff-code';
				code.textContent = file.patch || '';
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const preview = document.createElement('button');
				preview.className = 'secondary';
				preview.textContent = 'Open diff';
				preview.addEventListener('click', () => vscode.postMessage({ command: 'openDiffPreview', path: file.path }));
				const accept = document.createElement('button');
				accept.textContent = 'Accept file';
				accept.disabled = file.status === 'accepted';
				accept.addEventListener('click', () => vscode.postMessage({ command: 'diffDecision', path: file.path, status: 'accepted' }));
				const reject = document.createElement('button');
				reject.className = 'secondary';
				reject.textContent = 'Reject file';
				reject.disabled = file.status === 'rejected';
				reject.addEventListener('click', () => vscode.postMessage({ command: 'diffDecision', path: file.path, status: 'rejected' }));
				actions.appendChild(preview);
				actions.appendChild(accept);
				actions.appendChild(reject);
				if (file.status === 'accepted') {
					const restore = document.createElement('button');
					restore.className = 'secondary';
					restore.textContent = 'Restore checkpoint';
					restore.addEventListener('click', () => vscode.postMessage({ command: 'restoreDiff', path: file.path }));
					actions.appendChild(restore);
				}
				item.appendChild(title);
				item.appendChild(code);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderDiffReviewStatus(message) {
			const status = message.status;
			const section = document.querySelector('[data-diff-review-status]');
			const summary = document.querySelector('[data-diff-review-status-summary]');
			const cards = document.querySelector('[data-diff-review-status-cards]');
			const filesList = document.querySelector('[data-diff-review-status-files]');
			section.hidden = !status || !status.ok;
			cards.textContent = '';
			filesList.textContent = '';
			if (!status) {
				summary.textContent = '';
				return;
			}
			const counts = status.counts || {};
			const checkpoint = status.checkpoint || {};
			const model = status.reviewModel || {};
			const totals = model.totals || {};
			const coverage = model.checkpointCoverage || {};
			const actions = model.actions || {};
			summary.textContent = [
				message.summary || status.message || '',
				status.reviewId ? 'Review: ' + status.reviewId : undefined,
				'Pending/accepted/rejected: ' + (counts.pending ?? 0) + '/' + (counts.accepted ?? 0) + '/' + (counts.rejected ?? 0),
				'Checkpoints: ' + (checkpoint.fileCheckpointCount ?? 0),
				'Atomic apply: ' + String(Boolean(model.atomicApply)),
				'Restore ready: ' + String(Boolean(coverage.restoreReady))
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Review Counts', String((totals.files ?? (status.files || []).length) || 0), [
				'Pending: ' + (counts.pending ?? 0),
				'Accepted: ' + (counts.accepted ?? 0),
				'Rejected: ' + (counts.rejected ?? 0),
				'Additions: ' + (totals.additions ?? 0),
				'Deletions: ' + (totals.deletions ?? 0),
				'Hunks: ' + (totals.hunks ?? 0),
				'SEARCH/REPLACE: ' + (totals.searchReplace ?? 0)
			].join('\\n'), (counts.pending || 0) > 0);
			addStatusCard(cards, 'Checkpoint Coverage', (coverage.acceptedWithCheckpoint ?? 0) + '/' + (counts.accepted ?? 0), [
				'Task checkpoint: ' + (checkpoint.taskCheckpointId || coverage.taskCheckpointId || 'none'),
				'File checkpoints: ' + (checkpoint.fileCheckpointCount ?? coverage.fileCheckpointCount ?? 0),
				'Accepted without checkpoint: ' + (coverage.acceptedWithoutCheckpoint ?? 0),
				'Restore task checkpoint: ' + String(Boolean(actions.canRestoreTaskCheckpoint))
			].join('\\n'), (coverage.acceptedWithoutCheckpoint || 0) > 0);
			addStatusCard(cards, 'Diff Guardrails', String((status.guardrails || []).length), (status.guardrails || []).slice(0, 4).join('\\n'), false);
			const files = model.files || status.files || [];
			for (const file of files.slice(0, 12)) {
				addStatusCard(filesList, file.path || 'Diff file', file.status || 'pending', [
					file.kind ? 'Kind: ' + file.kind : undefined,
					'Checkpoint: ' + (file.hasCheckpoint ? (file.checkpointId || 'yes') : 'missing'),
					typeof file.additions === 'number' ? 'Additions: ' + file.additions : undefined,
					typeof file.deletions === 'number' ? 'Deletions: ' + file.deletions : undefined,
					typeof file.hunks === 'number' ? 'Hunks: ' + file.hunks : undefined,
					file.actions ? 'Actions: open=' + Boolean(file.actions.canOpenDiff) + ', accept=' + Boolean(file.actions.canAccept) + ', reject=' + Boolean(file.actions.canReject) + ', restore=' + Boolean(file.actions.canRestoreCheckpoint) : undefined,
					file.patchPreview
				].filter(Boolean).join('\\n'), file.status === 'pending' || (file.status === 'accepted' && !file.hasCheckpoint));
			}
		}
		function renderDiffFileStatus(message) {
			const status = message.status || {};
			const file = status.file || {};
			const counts = status.counts || {};
			const checkpoint = status.checkpoint || {};
			const actions = file.actions || {};
			const stats = file.stats || {};
			const siblings = Array.isArray(status.siblings) ? status.siblings : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-diff-file-status]');
			const summary = document.querySelector('[data-diff-file-status-summary]');
			const cards = document.querySelector('[data-diff-file-status-cards]');
			const siblingsList = document.querySelector('[data-diff-file-status-siblings]');
			section.hidden = !status.ok && !status.reviewId && !siblings.length;
			summary.textContent = '';
			cards.textContent = '';
			siblingsList.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				status.reviewId ? 'Review: ' + status.reviewId : undefined,
				status.requestedPath ? 'Requested: ' + status.requestedPath : undefined,
				file.path ? 'Focused file: ' + file.path : undefined,
				'Found: ' + String(Boolean(status.found)),
				'Next: ' + (status.nextAction || 'No next action reported.')
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Focused File', file.path || 'none', [
				'Status: ' + (file.status || 'unavailable'),
				'Kind: ' + (file.kind || 'unknown'),
				'Additions: ' + (stats.additions ?? 0),
				'Deletions: ' + (stats.deletions ?? 0),
				'Hunks: ' + (stats.hunks ?? 0),
				'SEARCH/REPLACE: ' + (stats.replacements ?? 0)
			].join('\\n'), !status.found || file.status === 'pending');
			addStatusCard(cards, 'Review Counts', (counts.pending ?? 0) + '/' + (counts.accepted ?? 0) + '/' + (counts.rejected ?? 0), [
				'Pending: ' + (counts.pending ?? 0),
				'Accepted: ' + (counts.accepted ?? 0),
				'Rejected: ' + (counts.rejected ?? 0),
				'Sibling files: ' + siblings.length
			].join('\\n'), (counts.pending ?? 0) > 0);
			addStatusCard(cards, 'Checkpoint Coverage', checkpoint.restoreReady ? 'restore-ready' : 'missing', [
				'Task checkpoint: ' + (checkpoint.taskCheckpointId || 'none'),
				'File checkpoints: ' + (checkpoint.fileCheckpointCount ?? 0),
				'Focused file checkpoint: ' + (file.hasCheckpoint ? (file.checkpointId || 'yes') : 'missing'),
				'Can restore focused checkpoint: ' + String(Boolean(actions.canRestoreCheckpoint))
			].join('\\n'), file.status === 'accepted' && !file.hasCheckpoint);
			addStatusCard(cards, 'Available Actions', [
				actions.canAccept ? 'accept' : undefined,
				actions.canReject ? 'reject' : undefined,
				actions.canOpenDiff ? 'open' : undefined,
				actions.canRestoreCheckpoint ? 'restore' : undefined
			].filter(Boolean).join(', ') || 'none', [
				'Open diff: ' + String(Boolean(actions.canOpenDiff)),
				'Accept file: ' + String(Boolean(actions.canAccept)),
				'Reject file: ' + String(Boolean(actions.canReject)),
				'Accept all: ' + String(Boolean(actions.canAcceptAll)),
				'Reject all: ' + String(Boolean(actions.canRejectAll)),
				'Requires exact plan approval for accept: ' + String(Boolean(actions.requiresPlanApprovalForAccept))
			].join('\\n'), !actions.canOpenDiff);
			addStatusCard(cards, 'Read-Only Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Diff file status is read-only.', false);
			for (const sibling of siblings.slice(0, 16)) {
				addStatusCard(siblingsList, sibling, sibling === file.path ? 'focused' : 'sibling', sibling === file.path ? 'This is the focused file for backend diff_file_status.' : 'Available active diff review path.', false);
			}
			if (file.patchPreview || file.proposedTextPreview) {
				addStatusCard(siblingsList, 'Patch Preview', 'redacted', [file.patchPreview, file.proposedTextPreview].filter(Boolean).join('\\n\\n').slice(0, 1800), false);
			}
		}
		function renderDiffReapplyStatus(message) {
			const status = message.status || {};
			const activeReview = status.activeReview || {};
			const activeFile = status.activeFile || {};
			const candidate = status.candidate || {};
			const counts = candidate.counts || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const repairHints = Array.isArray(candidate.repairHints) ? candidate.repairHints : [];
			const validationErrors = Array.isArray(candidate.validationErrors) ? candidate.validationErrors : [];
			const warnings = Array.isArray(candidate.warnings) ? candidate.warnings : [];
			const paths = Array.isArray(candidate.paths) ? candidate.paths : [];
			const siblings = Array.isArray(activeReview.siblings) ? activeReview.siblings : [];
			const section = document.querySelector('[data-diff-reapply-status]');
			const summary = document.querySelector('[data-diff-reapply-status-summary]');
			const cards = document.querySelector('[data-diff-reapply-status-cards]');
			const details = document.querySelector('[data-diff-reapply-status-details]');
			section.hidden = !activeReview.available && !candidate.present && !status.targetPath;
			summary.textContent = '';
			cards.textContent = '';
			details.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				status.targetPath ? 'Target: ' + status.targetPath : undefined,
				'Route: ' + (status.route || 'provide_candidate'),
				'Reapply ready: ' + String(Boolean(status.reapplyReady)),
				'Next: ' + (status.nextAction || 'Provide a candidate diff payload.')
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Active Review', activeReview.available ? 'available' : 'missing', [
				'Review: ' + (activeReview.reviewId || 'none'),
				'Files: ' + (activeReview.files ?? 0),
				'Pending/accepted/rejected: ' + (activeReview.pending ?? 0) + '/' + (activeReview.accepted ?? 0) + '/' + (activeReview.rejected ?? 0),
				'Target matched: ' + String(Boolean(activeReview.matched))
			].join('\\n'), !activeReview.available || (activeReview.available && !activeReview.matched));
			addStatusCard(cards, 'Active File', activeFile.path || 'none', [
				'Status: ' + (activeFile.status || 'unavailable'),
				'Kind: ' + (activeFile.kind || 'unknown'),
				'Checkpoint: ' + (activeFile.hasCheckpoint ? (activeFile.checkpointId || 'yes') : 'missing')
			].join('\\n'), activeFile.status === 'accepted' && !activeFile.hasCheckpoint);
			addStatusCard(cards, 'Candidate Diff', candidate.present ? (candidate.valid ? 'valid' : 'invalid') : 'missing', [
				'Review ready: ' + String(Boolean(candidate.reviewReady)),
				'Paths: ' + (paths.length ? paths.join(', ') : 'none'),
				'Files: ' + (counts.files ?? 0),
				'Valid/invalid files: ' + (counts.validFiles ?? 0) + '/' + (counts.invalidFiles ?? 0),
				'Whole/unified/search-replace: ' + (counts.wholeFile ?? 0) + '/' + (counts.unifiedDiff ?? 0) + '/' + (counts.searchReplace ?? 0),
				'Duplicate paths: ' + (counts.duplicatePaths ?? 0),
				validationErrors.length ? 'Errors:\\n' + validationErrors.slice(0, 6).join('\\n') : undefined,
				warnings.length ? 'Warnings:\\n' + warnings.slice(0, 4).join('\\n') : undefined
			].filter(Boolean).join('\\n'), !candidate.present || !candidate.valid);
			addStatusCard(cards, 'Route Decision', status.route || 'blocked', [
				'Reapply ready: ' + String(Boolean(status.reapplyReady)),
				blockers.length ? 'Blockers:\\n' + blockers.slice(0, 8).join('\\n') : 'No blockers reported.',
				status.nextAction || ''
			].filter(Boolean).join('\\n'), !status.reapplyReady);
			addStatusCard(cards, 'Read-Only Reapply Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Diff reapply status is read-only.', false);
			if (repairHints.length) {
				addStatusCard(details, 'Repair Hints', String(repairHints.length), repairHints.slice(0, 8).join('\\n'), false);
			}
			if (siblings.length) {
				addStatusCard(details, 'Active Review Siblings', String(siblings.length), siblings.slice(0, 16).join('\\n'), false);
			}
			if (Array.isArray(candidate.files) && candidate.files.length) {
				addStatusCard(details, 'Candidate Files', String(candidate.files.length), candidate.files.slice(0, 8).map(file => [
					file.path || 'unknown',
					file.kind || 'unknown',
					file.valid === false ? 'invalid' : 'candidate',
					file.pathSafety ? 'path=' + file.pathSafety : undefined,
					typeof file.replacementCount === 'number' ? 'replacements=' + file.replacementCount : undefined
				].filter(Boolean).join(' - ')).join('\\n'), false);
			}
		}
		function renderHookActions() {
			const section = document.querySelector('[data-hook-actions]');
			const list = document.querySelector('[data-hook-action-list]');
			section.hidden = hookActions.size === 0;
			list.textContent = '';
			for (const action of hookActions.values()) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = action.title || 'Hook execution approval';
				const badge = document.createElement('span');
				badge.className = action.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = action.risk || 'medium';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = action.detail || action.commandLine || '';
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const accept = document.createElement('button');
				accept.textContent = 'Run hook';
				accept.disabled = Boolean(action.blocked);
				accept.addEventListener('click', () => vscode.postMessage({ command: 'hookActionDecision', id: String(action.id), decision: 'accept' }));
				const decline = document.createElement('button');
				decline.className = 'secondary';
				decline.textContent = 'Decline';
				decline.addEventListener('click', () => vscode.postMessage({ command: 'hookActionDecision', id: String(action.id), decision: 'decline' }));
				actions.appendChild(accept);
				actions.appendChild(decline);
				item.appendChild(title);
				item.appendChild(detail);
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderCheckpointStatus(message) {
			const status = message.status || {};
			const section = document.querySelector('[data-checkpoint-status]');
			const summary = document.querySelector('[data-checkpoint-status-summary]');
			const cards = document.querySelector('[data-checkpoint-status-cards]');
			const filesList = document.querySelector('[data-checkpoint-status-files]');
			const coverage = status.reviewCoverage || {};
			const git = status.gitCheckpoint || {};
			const files = Array.isArray(status.files) ? status.files : [];
			const paths = Array.isArray(status.paths) ? status.paths : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			section.hidden = false;
			cards.textContent = '';
			filesList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'State: ' + (status.state || 'none'),
				'Task checkpoint: ' + (status.taskCheckpointId || 'none'),
				'Restore available: ' + (status.restoreAvailable ? 'yes' : 'no'),
				'File checkpoints: ' + (status.fileCheckpointCount ?? paths.length),
				coverage.active ? 'Rollback coverage: ' + (coverage.acceptedWithCheckpoint ?? 0) + '/' + (coverage.acceptedFiles ?? 0) + ' accepted files' : 'No active diff review coverage required',
				git.branchName ? 'Git checkpoint: ' + git.branchName : git.skippedReason ? 'Git checkpoint skipped: ' + git.skippedReason : undefined
			].filter(Boolean).join('\\n');
			const statusCards = [
				{
					title: 'Restore Gate',
					badge: status.restoreAvailable ? 'available' : 'none',
					blocked: !status.restoreAvailable,
					detail: [
						'State: ' + (status.state || 'none'),
						status.taskCheckpointId ? 'Task checkpoint: ' + status.taskCheckpointId : 'No task checkpoint yet.',
						'File checkpoint count: ' + (status.fileCheckpointCount ?? paths.length)
					].join('\\n')
				},
				{
					title: 'Diff Coverage',
					badge: coverage.complete ? 'complete' : coverage.active ? 'partial' : 'inactive',
					blocked: Boolean(coverage.active && !coverage.complete),
					detail: [
						'Active review: ' + String(Boolean(coverage.active)),
						coverage.reviewId ? 'Review: ' + coverage.reviewId : undefined,
						'Accepted with checkpoint: ' + (coverage.acceptedWithCheckpoint ?? 0),
						'Accepted files: ' + (coverage.acceptedFiles ?? 0),
						Array.isArray(coverage.missingCheckpointPaths) && coverage.missingCheckpointPaths.length ? 'Missing checkpoints: ' + coverage.missingCheckpointPaths.join(', ') : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Git Checkpoint',
					badge: git.branchName ? 'branch' : git.skippedReason ? 'skipped' : 'none',
					blocked: Boolean(git.skippedReason),
					detail: [
						git.branchName ? 'Branch: ' + git.branchName : undefined,
						git.created !== undefined ? 'Created: ' + String(Boolean(git.created)) : undefined,
						git.skippedReason ? 'Skipped: ' + git.skippedReason : undefined,
						git.error ? 'Error: ' + git.error : undefined
					].filter(Boolean).join('\\n') || 'No git checkpoint metadata yet.'
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Checkpoint status is read-only.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			const visibleFiles = files.length ? files : paths.map(path => ({ path }));
			for (const file of visibleFiles.slice(0, 24)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = file.path || 'Checkpoint file';
				const badge = document.createElement('span');
				badge.className = 'badge';
				badge.textContent = file.existed === false ? 'created' : file.id ? 'checkpoint' : 'path';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					file.id ? 'Checkpoint: ' + file.id : undefined,
					file.existed !== undefined ? 'Existed before edit: ' + String(Boolean(file.existed)) : undefined,
					file.createdAt ? 'Created: ' + new Date(file.createdAt).toLocaleTimeString() : undefined
				].filter(Boolean).join('\\n') || 'Checkpoint path only.';
				item.appendChild(title);
				item.appendChild(detail);
				filesList.appendChild(item);
			}
		}
		function renderRollbackRestoreStatus(message) {
			const status = message.status || {};
			const readiness = status.readiness || {};
			const coverage = status.coverage || {};
			const task = status.taskCheckpoint || {};
			const selectedFile = status.file || {};
			const files = Array.isArray(status.files) ? status.files : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
			const missing = Array.isArray(coverage.missingCheckpointPaths) ? coverage.missingCheckpointPaths : [];
			const section = document.querySelector('[data-rollback-restore-status]');
			const summary = document.querySelector('[data-rollback-restore-summary]');
			const cards = document.querySelector('[data-rollback-restore-cards]');
			const filesList = document.querySelector('[data-rollback-restore-files]');
			section.hidden = false;
			cards.textContent = '';
			filesList.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				'Target: ' + (status.target?.kind || 'task') + (status.target?.path ? ' · ' + status.target.path : ''),
				'Route: ' + (readiness.route || 'none'),
				'Can restore: ' + (readiness.canRestore ? 'yes' : 'no'),
				coverage.activeReview ? 'Accepted checkpoint coverage: ' + (coverage.acceptedWithCheckpoint ?? 0) + '/' + (coverage.acceptedFiles ?? 0) : 'No active review coverage required',
				blockers.length ? 'Blockers: ' + blockers.join(', ') : undefined
			].filter(Boolean).join('\\n');
			const statusCards = [
				{
					title: 'Restore Route',
					badge: readiness.route || 'none',
					blocked: !readiness.canRestore,
					detail: [
						'Developer action required: ' + String(Boolean(readiness.requiresDeveloperAction)),
						'Mutation locked: ' + String(Boolean(readiness.mutationLocked)),
						readiness.nextAction ? 'Next: ' + readiness.nextAction : undefined,
						blockers.length ? 'Blockers: ' + blockers.join('\\n') : undefined
					].filter(Boolean).join('\\n') || 'No restore route is available yet.'
				},
				{
					title: 'Task Checkpoint',
					badge: task.restoreAvailable ? 'available' : 'none',
					blocked: !task.restoreAvailable,
					detail: [
						task.id ? 'Checkpoint: ' + task.id : 'No task checkpoint yet.',
						'File checkpoints: ' + (task.fileCheckpointCount ?? files.length ?? 0)
					].join('\\n')
				},
				{
					title: 'Coverage',
					badge: coverage.complete ? 'complete' : coverage.activeReview ? 'repair' : 'idle',
					blocked: Boolean(coverage.activeReview && !coverage.complete),
					detail: [
						'Active review: ' + String(Boolean(coverage.activeReview)),
						coverage.reviewId ? 'Review: ' + coverage.reviewId : undefined,
						'Accepted with checkpoint: ' + (coverage.acceptedWithCheckpoint ?? 0),
						'Accepted files: ' + (coverage.acceptedFiles ?? 0),
						missing.length ? 'Missing checkpoints: ' + missing.join(', ') : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Restore readiness is read-only.'
				}
			];
			if (selectedFile.path) {
				statusCards.splice(1, 0, {
					title: 'Focused File',
					badge: selectedFile.canRestore ? 'ready' : 'blocked',
					blocked: !selectedFile.canRestore,
					detail: [
						selectedFile.path,
						selectedFile.checkpointId ? 'Checkpoint: ' + selectedFile.checkpointId : undefined,
						selectedFile.activeReviewStatus ? 'Review status: ' + selectedFile.activeReviewStatus : undefined,
						Array.isArray(selectedFile.blockers) && selectedFile.blockers.length ? 'Blockers: ' + selectedFile.blockers.join('\\n') : undefined
					].filter(Boolean).join('\\n')
				});
			}
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = String(card.badge);
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const file of files.slice(0, 24)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = file.path || 'Checkpoint file';
				const badge = document.createElement('span');
				badge.className = file.canRestore ? 'badge' : 'badge risk-blocked';
				badge.textContent = file.canRestore ? 'ready' : 'blocked';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					file.checkpointId ? 'Checkpoint: ' + file.checkpointId : undefined,
					file.activeReviewStatus ? 'Review status: ' + file.activeReviewStatus : undefined,
					file.existed !== undefined ? 'Existed before edit: ' + String(Boolean(file.existed)) : undefined,
					Array.isArray(file.blockers) && file.blockers.length ? 'Blockers: ' + file.blockers.join('\\n') : undefined
				].filter(Boolean).join('\\n') || 'Checkpoint ready.';
				item.appendChild(title);
				item.appendChild(detail);
				filesList.appendChild(item);
			}
		}
		function renderTaskCheckpoint(checkpoint) {
			const button = document.querySelector('[data-restore-task]');
			const detail = document.querySelector('[data-task-checkpoint]');
			const count = checkpoint?.fileCount || 0;
			button.disabled = count === 0;
			const git = checkpoint?.git?.branchName
				? 'Git: ' + checkpoint.git.branchName + (checkpoint.git.created ? '' : ' (existing)')
				: checkpoint?.git?.skippedReason ? 'Git skipped: ' + checkpoint.git.skippedReason : undefined;
			detail.textContent = checkpoint ? [
				checkpoint.id + ' · ' + count + ' accepted file checkpoint' + (count === 1 ? '' : 's'),
				git
			].filter(Boolean).join('\\n') : '';
		}
		function renderTerminalRuns() {
			const section = document.querySelector('[data-terminal]');
			const list = document.querySelector('[data-terminal-list]');
			section.hidden = terminalRuns.length === 0;
			list.textContent = '';
			for (const run of terminalRuns.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = run.commandLine;
				const badge = document.createElement('span');
				badge.className = run.status === 'failed' ? 'badge risk-blocked' : 'badge';
				badge.textContent = run.status || 'running';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					run.reason,
					run.cwd,
					run.exitCode !== undefined ? 'Exit: ' + run.exitCode : undefined,
					run.signal ? 'Signal: ' + run.signal : undefined
				].filter(Boolean).join('\\n');
				const output = document.createElement('pre');
				output.className = 'diff-code';
				output.textContent = run.output || '';
				const actions = document.createElement('div');
				actions.className = 'card-actions';
				const interrupt = document.createElement('button');
				interrupt.className = 'secondary';
				interrupt.textContent = 'Interrupt';
				interrupt.disabled = run.status !== 'running';
				interrupt.addEventListener('click', () => vscode.postMessage({ command: 'interruptTerminalRun', id: run.id }));
				const retry = document.createElement('button');
				retry.textContent = 'Retry';
				retry.addEventListener('click', () => vscode.postMessage({ command: 'retryTerminalRun', id: run.id }));
				const proceed = document.createElement('button');
				proceed.className = 'secondary';
				proceed.textContent = run.proceeded ? 'Proceeding' : 'Proceed';
				proceed.disabled = run.status !== 'running' || Boolean(run.proceeded);
				proceed.addEventListener('click', () => vscode.postMessage({ command: 'proceedTerminalRun', id: run.id }));
				actions.appendChild(interrupt);
				actions.appendChild(proceed);
				actions.appendChild(retry);
				item.appendChild(title);
				item.appendChild(detail);
				if (run.output) {
					item.appendChild(output);
				}
				item.appendChild(actions);
				list.appendChild(item);
			}
		}
		function renderTerminalControlStatus(message) {
			const status = message.status || {};
			const run = status.selectedRun || {};
			const counts = status.counts || {};
			const actions = status.actions || {};
			const response = status.response || {};
			const blockers = Array.isArray(status.blockers) ? status.blockers : [];
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-terminal-control-status]');
			const summary = document.querySelector('[data-terminal-control-status-summary]');
			const cards = document.querySelector('[data-terminal-control-status-cards]');
			section.hidden = !status.ok && (counts.total ?? 0) === 0 && !response.action;
			cards.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				run.id ? 'Selected run: ' + run.id : undefined,
				status.latestRunId ? 'Latest run: ' + status.latestRunId : undefined,
				response.action ? 'Last backend action: ' + response.action + (response.retryRunId ? ' -> ' + response.retryRunId : '') : undefined,
				'Runs: ' + (counts.total ?? 0) + ' total, ' + (counts.running ?? 0) + ' running, ' + (counts.failed ?? 0) + ' failed, ' + (counts.proceeded ?? 0) + ' proceeded'
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Selected Run', run.status || 'missing', [
				run.commandLine || 'No selected terminal run.',
				run.cwd ? 'cwd: ' + run.cwd : undefined,
				run.reason,
				run.proceeded ? 'Proceeding while running: yes' : undefined,
				run.exitCode !== undefined ? 'Exit: ' + run.exitCode : undefined,
				run.signal ? 'Signal: ' + run.signal : undefined
			].filter(Boolean).join('\\n'), !status.ok || run.status === 'failed');
			addStatusCard(cards, 'Control Actions', [
				actions.canInterrupt ? 'interrupt' : undefined,
				actions.canProceed ? 'proceed' : undefined,
				actions.canRetry ? 'retry' : undefined,
				actions.canInspectStatus ? 'status' : undefined
			].filter(Boolean).join(', ') || 'none', [
				'Inspect status: ' + String(Boolean(actions.canInspectStatus)),
				'Interrupt: ' + String(Boolean(actions.canInterrupt)),
				'Proceed while running: ' + String(Boolean(actions.canProceed)),
				'Retry: ' + String(Boolean(actions.canRetry)),
				'Requires exact plan approval: ' + String(Boolean(actions.requiresExactPlanApproval)),
				'Blocked by mode policy: ' + String(Boolean(actions.requiresMutationMode))
			].join('\\n'), !actions.canInterrupt && !actions.canRetry && !actions.canProceed);
			addStatusCard(cards, 'Backend Response', response.action || 'none', [
				response.message,
				response.runId ? 'Run: ' + response.runId : undefined,
				response.status ? 'Status: ' + response.status : undefined,
				response.retryRunId ? 'Retry run: ' + response.retryRunId : undefined,
				response.proceeded !== undefined ? 'Proceeded: ' + String(Boolean(response.proceeded)) : undefined
			].filter(Boolean).join('\\n') || 'No terminal control response has been received yet.', response.ok === false);
			addStatusCard(cards, 'Run Counts', String(counts.total ?? 0), [
				'Running: ' + (counts.running ?? 0),
				'Passed: ' + (counts.passed ?? 0),
				'Failed: ' + (counts.failed ?? 0),
				'Interrupted: ' + (counts.interrupted ?? 0),
				'Proceeded: ' + (counts.proceeded ?? 0)
			].join('\\n'), (counts.failed ?? 0) > 0);
			addStatusCard(cards, 'Control Blockers', String(blockers.length), blockers.slice(0, 6).join('\\n') || 'No terminal control blockers reported.', blockers.length > 0);
			addStatusCard(cards, 'Read-Only Control Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Terminal control status is read-only.', false);
		}
		function renderTerminalOutputStatus(message) {
			const status = message.status || {};
			const response = status.response || {};
			const run = status.selectedRun || {};
			const counts = status.counts || {};
			const output = status.output || {};
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const section = document.querySelector('[data-terminal-output-status]');
			const summary = document.querySelector('[data-terminal-output-status-summary]');
			const cards = document.querySelector('[data-terminal-output-status-cards]');
			section.hidden = !status.ok && (counts.total ?? 0) === 0 && !response.error;
			cards.textContent = '';
			summary.textContent = '';
			if (section.hidden) {
				return;
			}
			summary.textContent = [
				message.summary || status.message || '',
				run.id ? 'Selected run: ' + run.id : undefined,
				status.latestRunId ? 'Latest run: ' + status.latestRunId : undefined,
				status.requestedRunId ? 'Requested run: ' + status.requestedRunId : undefined,
				'Tail: ' + (status.tailChars ?? 0) + ' chars' + (status.tailLines ? ', ' + status.tailLines + ' lines' : ''),
				'Output available: ' + String(Boolean(output.available)),
				'Truncated: ' + String(Boolean(output.truncated))
			].filter(Boolean).join('\\n');
			addStatusCard(cards, 'Selected Run', run.status || response.status || 'missing', [
				run.commandLine || response.commandLine || 'No selected terminal run.',
				run.cwd || response.cwd ? 'cwd: ' + (run.cwd || response.cwd) : undefined,
				'Output length: ' + (run.outputLength ?? 0),
				run.exitCode !== undefined || response.exitCode !== undefined ? 'Exit: ' + (run.exitCode ?? response.exitCode) : undefined,
				run.signal || response.signal ? 'Signal: ' + (run.signal || response.signal) : undefined
			].filter(Boolean).join('\\n'), !status.ok || run.status === 'failed' || response.ok === false);
			addStatusCard(cards, 'Output Tail', output.available ? String(output.tailLength ?? 0) + ' chars' : 'missing', [
				'Response ok: ' + String(Boolean(response.ok)),
				'Tail length: ' + (output.tailLength ?? 0),
				'Truncated: ' + String(Boolean(output.truncated)),
				response.error,
				output.tailPreview ? 'Preview:\\n' + output.tailPreview : undefined
			].filter(Boolean).join('\\n'), !output.available || Boolean(response.error));
			addStatusCard(cards, 'Request Limits', status.latest ? 'latest' : 'specific', [
				'Latest fallback: ' + String(Boolean(status.latest)),
				status.requestedRunId ? 'Requested: ' + status.requestedRunId : 'No explicit run requested.',
				'Tail chars: ' + (status.tailChars ?? 0),
				status.tailLines ? 'Tail lines: ' + status.tailLines : 'No line cap requested.'
			].join('\\n'), false);
			addStatusCard(cards, 'Run Counts', String(counts.total ?? 0), [
				'Running: ' + (counts.running ?? 0),
				'Completed: ' + (counts.completed ?? 0)
			].join('\\n'), (counts.total ?? 0) === 0);
			addStatusCard(cards, 'Read-Only Output Guardrails', String(guardrails.length), guardrails.slice(0, 5).join('\\n') || 'Terminal output status is read-only.', false);
		}
		function renderTerminalInsights() {
			const section = document.querySelector('[data-terminal-insights]');
			const list = document.querySelector('[data-terminal-insight-list]');
			section.hidden = terminalInsights.length === 0;
			list.textContent = '';
			for (const insight of terminalInsights.slice(0, 8)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = insight.commandLine;
				const hasError = (insight.findings || []).some(finding => finding.severity === 'error');
				const badge = document.createElement('span');
				badge.className = hasError ? 'badge risk-blocked' : 'badge';
				badge.textContent = insight.status + ' · ' + (insight.findings || []).length + ' insight' + ((insight.findings || []).length === 1 ? '' : 's');
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					insight.summary,
					(insight.urls || []).length ? 'URLs: ' + insight.urls.join(', ') : undefined,
					...(insight.findings || []).slice(0, 6).map(finding => finding.kind + ' · ' + finding.title + '\\n' + finding.detail),
					insight.followUpPrompt ? 'Follow-up prompt:\\n' + insight.followUpPrompt.slice(0, 1200) : undefined
				].filter(Boolean).join('\\n\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderTerminalInsightStatus(message) {
			const status = message.status || {};
			const counts = status.counts || {};
			const insights = status.insight ? [status.insight] : Array.isArray(status.insights) ? status.insights : [];
			const knownRunIds = Array.isArray(status.knownRunIds) ? status.knownRunIds : [];
			const section = document.querySelector('[data-terminal-insight-status]');
			const summary = document.querySelector('[data-terminal-insight-status-summary]');
			const cards = document.querySelector('[data-terminal-insight-status-cards]');
			const list = document.querySelector('[data-terminal-insight-status-list]');
			section.hidden = !status.ok && insights.length === 0 && knownRunIds.length === 0 && !status.requestedRunId;
			cards.textContent = '';
			list.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.selectedRunId ? 'Selected run: ' + status.selectedRunId : undefined,
				status.latestRunId ? 'Latest run: ' + status.latestRunId : undefined,
				'Known runs: ' + knownRunIds.length,
				'Returned insights: ' + (status.total ?? insights.length),
				'Findings: ' + (counts.error ?? 0) + ' error, ' + (counts.warning ?? 0) + ' warning, ' + (counts.info ?? 0) + ' info'
			].filter(Boolean).join('\\n');
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const statusCards = [
				{
					title: 'Finding Counts',
					badge: String((counts.error ?? 0) + (counts.warning ?? 0) + (counts.info ?? 0)),
					blocked: (counts.error ?? 0) > 0 || !status.ok,
					detail: [
						'Errors: ' + (counts.error ?? 0),
						'Warnings: ' + (counts.warning ?? 0),
						'Info: ' + (counts.info ?? 0),
						status.requestedRunId ? 'Requested: ' + status.requestedRunId : undefined
					].filter(Boolean).join('\\n')
				},
				{
					title: 'Run Coverage',
					badge: String(knownRunIds.length),
					blocked: knownRunIds.length === 0,
					detail: knownRunIds.length ? knownRunIds.slice(0, 12).join('\\n') : 'No terminal insights have been classified yet.'
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Terminal insight status is read-only.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const insight of insights.slice(0, 10)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = insight.commandLine || insight.runId || 'Terminal insight';
				const findingCounts = insight.findingCounts || {};
				const badge = document.createElement('span');
				badge.className = (findingCounts.error || 0) > 0 ? 'badge risk-blocked' : 'badge';
				badge.textContent = insight.status + ' · ' + ((findingCounts.error || 0) + (findingCounts.warning || 0) + (findingCounts.info || 0)) + ' findings';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				const findings = Array.isArray(insight.findings) ? insight.findings : [];
				detail.textContent = [
					insight.summary,
					insight.runId ? 'Run: ' + insight.runId : undefined,
					Array.isArray(insight.findingKinds) && insight.findingKinds.length ? 'Kinds: ' + insight.findingKinds.join(', ') : undefined,
					Array.isArray(insight.urls) && insight.urls.length ? 'URLs: ' + insight.urls.join(', ') : undefined,
					insight.followUpPromptAvailable ? 'Follow-up prompt available' : 'No follow-up prompt',
					...findings.slice(0, 6).map(finding => finding.severity + ' · ' + finding.kind + ' · ' + finding.title + '\\n' + finding.detail)
				].filter(Boolean).join('\\n\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderTerminalRemediationStatus(message) {
			const status = message.status || {};
			const events = Array.isArray(status.events) ? status.events : [];
			const selected = status.selectedEvent;
			const visibleEvents = selected ? [selected, ...events.filter(event => event.id !== selected.id)] : events;
			const section = document.querySelector('[data-terminal-remediation-status]');
			const summary = document.querySelector('[data-terminal-remediation-status-summary]');
			const cards = document.querySelector('[data-terminal-remediation-status-cards]');
			const list = document.querySelector('[data-terminal-remediation-status-list]');
			section.hidden = !status.ok && visibleEvents.length === 0 && !status.requestedRunId && !status.activeTaskId;
			cards.textContent = '';
			list.textContent = '';
			summary.textContent = [
				message.summary || status.message || '',
				status.activeTaskId ? 'Active task: ' + status.activeTaskId + ' r' + status.activeRevision : undefined,
				'Events: ' + (status.returned ?? visibleEvents.length) + '/' + (status.total ?? visibleEvents.length),
				'Execution authorization: ' + (status.hasExecutionAuthorization ? 'present' : 'missing'),
				'Authorization matches active plan: ' + String(Boolean(status.authorizationMatchesActivePlan)),
				'Mutation locked: ' + String(Boolean(status.mutationLocked))
			].filter(Boolean).join('\\n');
			const guardrails = Array.isArray(status.guardrails) ? status.guardrails : [];
			const statusCards = [
				{
					title: 'Remediation Events',
					badge: String(status.total ?? visibleEvents.length),
					blocked: !status.ok && visibleEvents.length === 0,
					detail: [
						status.latestEventId ? 'Latest: ' + status.latestEventId : undefined,
						status.requestedRunId ? 'Requested run: ' + status.requestedRunId : undefined,
						status.requestedTaskId ? 'Requested task: ' + status.requestedTaskId : undefined
					].filter(Boolean).join('\\n') || 'No terminal remediation events are available yet.'
				},
				{
					title: 'Execution Lock',
					badge: status.mutationLocked ? 'locked' : 'unlocked',
					blocked: Boolean(status.mutationLocked),
					detail: [
						'Has authorization: ' + String(Boolean(status.hasExecutionAuthorization)),
						'Matches active plan: ' + String(Boolean(status.authorizationMatchesActivePlan)),
						status.mutationLocked ? 'Approve the exact remediation plan revision before mutation resumes.' : 'No remediation lock is active.'
					].join('\\n')
				},
				{
					title: 'Guardrails',
					badge: String(guardrails.length),
					blocked: false,
					detail: guardrails.length ? guardrails.join('\\n') : 'Terminal remediation status is read-only.'
				}
			];
			for (const card of statusCards) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = card.title;
				const badge = document.createElement('span');
				badge.className = card.blocked ? 'badge risk-blocked' : 'badge';
				badge.textContent = card.badge;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = card.detail;
				item.appendChild(title);
				item.appendChild(detail);
				cards.appendChild(item);
			}
			for (const eventData of visibleEvents.slice(0, 10)) {
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = eventData.commandLine || eventData.id || 'Terminal remediation';
				const badge = document.createElement('span');
				badge.className = eventData.errorCount ? 'badge risk-blocked' : 'badge';
				badge.textContent = 'r' + eventData.previousRevision + ' -> r' + eventData.revision;
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					eventData.reason,
					eventData.insightSummary,
					'Run: ' + eventData.runId,
					'Status: ' + eventData.status + (eventData.exitCode !== undefined ? ' exit ' + eventData.exitCode : ''),
					Array.isArray(eventData.findingKinds) && eventData.findingKinds.length ? 'Finding kinds: ' + eventData.findingKinds.join(', ') : undefined,
					Array.isArray(eventData.failedStepIds) && eventData.failedStepIds.length ? 'Failed steps: ' + eventData.failedStepIds.join(', ') : undefined,
					Array.isArray(eventData.remediationStepIds) && eventData.remediationStepIds.length ? 'Remediation steps: ' + eventData.remediationStepIds.join(', ') : undefined,
					eventData.verification ? 'Verification: ' + eventData.verification.checkId + ' -> ' + eventData.verification.verificationStatus : undefined
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
		function renderDiagnosticsEvidence() {
			const section = document.querySelector('[data-diagnostics-evidence]');
			const summary = document.querySelector('[data-diagnostics-summary]');
			const list = document.querySelector('[data-diagnostics-list]');
			section.hidden = diagnosticsEvidence.length === 0;
			list.textContent = '';
			const latest = diagnosticsEvidence[0]?.snapshot;
			summary.textContent = latest
				? latest.total + ' total · ' + latest.errors + ' errors · ' + latest.warnings + ' warnings · ' + latest.information + ' information · ' + latest.hints + ' hints'
				: '';
			for (const entry of diagnosticsEvidence.slice(0, 6)) {
				const snapshot = entry.snapshot || {};
				const item = document.createElement('div');
				item.className = 'card';
				const title = document.createElement('div');
				title.className = 'card-title';
				title.textContent = entry.commandLine || entry.runId || 'Diagnostics snapshot';
				const badge = document.createElement('span');
				badge.className = snapshot.errors ? 'badge risk-blocked' : 'badge';
				badge.textContent = (entry.status || 'completed') + ' · ' + (snapshot.total || 0) + ' diagnostics';
				title.appendChild(badge);
				const detail = document.createElement('div');
				detail.className = 'card-detail';
				detail.textContent = [
					entry.summary,
					(snapshot.sample || []).slice(0, 8).map(problem => problem.path + ':' + problem.range + ' ' + problem.severity + ': ' + problem.message).join('\\n')
				].filter(Boolean).join('\\n');
				item.appendChild(title);
				item.appendChild(detail);
				list.appendChild(item);
			}
		}
	</script>
</body>
</html>`;
	}
}

function isWebviewCommandMessage(value: unknown): value is { readonly command: string; readonly mode?: string; readonly prompt?: string; readonly feedback?: unknown; readonly id?: unknown; readonly decision?: unknown; readonly answer?: unknown; readonly cancelled?: unknown; readonly selectedSuggestionIndex?: unknown; readonly path?: unknown; readonly status?: unknown; readonly sessionId?: unknown; readonly url?: unknown; readonly stepId?: unknown; readonly flowNodeId?: unknown; readonly file?: unknown; readonly source?: unknown; readonly active?: unknown; readonly title?: unknown; readonly checkId?: unknown; readonly threadId?: unknown; readonly worktreePath?: unknown; readonly branchName?: unknown; readonly promptFocus?: unknown; readonly key?: unknown; readonly value?: unknown; readonly taskId?: unknown; readonly revision?: unknown; readonly planHash?: unknown } {
	return typeof value === 'object' && value !== null && typeof (value as { readonly command?: unknown }).command === 'string';
}

function pendingSafetyItems(values: Iterable<unknown>, fallbackKind: string): readonly { readonly id: string; readonly kind: string; readonly title: string; readonly risk?: string; readonly blocked?: boolean }[] {
	const items: { readonly id: string; readonly kind: string; readonly title: string; readonly risk?: string; readonly blocked?: boolean }[] = [];
	for (const value of values) {
		if (typeof value !== 'object' || value === null) {
			continue;
		}
		const record = value as Record<string, unknown>;
		const id = typeof record.id === 'string' || typeof record.id === 'number' ? String(record.id) : `${fallbackKind}-${items.length + 1}`;
		const kind = typeof record.kind === 'string' ? record.kind : typeof record.action === 'string' ? record.action : fallbackKind;
		const title = typeof record.title === 'string'
			? record.title
			: typeof record.toolName === 'string'
				? record.toolName
				: typeof record.url === 'string'
					? record.url
					: kind;
		items.push({
			id: redactSensitiveText(id),
			kind: redactSensitiveText(kind),
			title: redactSensitiveText(title),
			...(typeof record.risk === 'string' ? { risk: redactSensitiveText(record.risk) } : {}),
			...(typeof record.blocked === 'boolean' ? { blocked: record.blocked } : {}),
		});
	}
	return items.slice(0, 40);
}

async function collectMentionSuggestions(): Promise<readonly VibeCodexMentionSuggestion[]> {
	const suggestions = new Map<string, VibeCodexMentionSuggestion>();
	for (const suggestion of builtinMentionSuggestions()) {
		suggestions.set(suggestion.insertText, suggestion);
	}
	const active = vscode.window.activeTextEditor?.document.uri;
	if (active?.scheme === 'file') {
		const activePath = vscode.workspace.asRelativePath(active, false);
		if (activePath && activePath !== active.fsPath) {
			suggestions.set(`@${activePath}`, {
				label: `@${activePath}`,
				insertText: `@${activePath}`,
				kind: 'file',
				detail: 'active editor',
			});
		}
	}
	const files = await vscode.workspace.findFiles('**/*', mentionSuggestionExclude, maxMentionSuggestionFiles);
	const folders = new Set<string>();
	for (const uri of files) {
		const relative = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
		if (!relative || relative === uri.fsPath || relative.endsWith('/')) {
			continue;
		}
		for (const folder of parentFolders(relative)) {
			if (folders.size >= maxMentionSuggestionFolders) {
				break;
			}
			folders.add(folder);
		}
		suggestions.set(`@${relative}`, {
			label: `@${relative}`,
			insertText: `@${relative}`,
			kind: 'file',
			detail: 'workspace file',
		});
	}
	for (const folder of folders) {
		suggestions.set(`@${folder}/`, {
			label: `@${folder}/`,
			insertText: `@${folder}/`,
			kind: 'folder',
			detail: 'workspace folder',
		});
	}
	return [...suggestions.values()].slice(0, 120);
}

async function collectSlashCommandSuggestions(): Promise<readonly VibeCodexSlashCommandSuggestion[]> {
	const suggestions = new Map<string, VibeCodexSlashCommandSuggestion>();
	for (const suggestion of builtinSlashCommandSuggestions()) {
		suggestions.set(suggestion.insertText, suggestion);
	}
	const workflowFiles = await vscode.workspace.findFiles(slashWorkflowInclude, mentionSuggestionExclude, maxSlashWorkflowSuggestions);
	const workflowPaths = workflowFiles
		.map(uri => vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/'))
		.filter(relative => relative && !relative.endsWith('/'));
	for (const suggestion of createWorkflowSlashSuggestions(workflowPaths)) {
		suggestions.set(suggestion.insertText, suggestion);
	}
	return [...suggestions.values()].slice(0, 80);
}

function isAllowedSlashWorkflowPath(relativePath: string): boolean {
	const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
	return normalized.startsWith('.cline/workflows/')
		|| normalized.startsWith('.clinerules/workflows/')
		|| normalized.startsWith('.vibecodex/workflows/')
		|| normalized.startsWith('.cursor/rules/workflows/')
		|| /^\.github\/workflows\/vibecodex-[^/]+$/i.test(normalized);
}

function builtinMentionSuggestions(): readonly VibeCodexMentionSuggestion[] {
	return [
		{ label: '@workspace', insertText: '@workspace', kind: 'workspace', detail: 'workspace layout and file references' },
		{ label: '@git', insertText: '@git', kind: 'git', detail: 'branch, dirty paths, recent commits' },
		{ label: '@diagnostics', insertText: '@diagnostics', kind: 'diagnostics', detail: 'current VS Code problems' },
		{ label: '@terminal', insertText: '@terminal', kind: 'terminal', detail: 'active terminal metadata' },
		{ label: '@symbols', insertText: '@symbols', kind: 'symbols', detail: 'symbol-oriented planning hint' },
		{ label: '@docs', insertText: '@docs', kind: 'docs', detail: 'documentation planning hint' },
		{ label: '@chat', insertText: '@chat', kind: 'chat', detail: 'previous chat/session context hint' },
	];
}

function parentFolders(relativePath: string): readonly string[] {
	const parts = relativePath.split('/').filter(Boolean);
	const folders: string[] = [];
	for (let index = 1; index < parts.length; index++) {
		folders.push(parts.slice(0, index).join('/'));
	}
	return folders;
}

function createInitialTranscript(mode: string, prompt: string, systemDetail: string, context?: VibeCodexContextPack, provider?: VibeCodexProviderRuntimeConfig, modePolicy?: VibeCodexModePolicy, commandPermissionPolicy?: VibeCodexCommandPermissionPolicy, parallelPlan?: VibeCodexParallelPlan, verificationPlan?: VibeCodexVerificationPlan, customModeCatalog?: VibeCodexCustomModeCatalog, sessionRecall?: VibeCodexSessionRecall, docsContext?: VibeCodexDocsContext, workspaceGuidance?: VibeCodexWorkspaceGuidance, ruleProposal?: VibeCodexRuleProposal, memoryBank?: VibeCodexMemoryBank, previewPlan?: VibeCodexPreviewPlan, mcpCatalog?: VibeCodexMcpCatalog, toolCatalog?: VibeCodexToolCatalog, slashCommand?: VibeCodexSlashCommandContext): readonly VibeCodexTranscriptEvent[] {
	const timestamp = Date.now();
	return [
		createTranscriptEvent({
			kind: 'system',
			title: systemDetail,
			detail: [
				slashCommand ? `Slash command: ${slashCommandSummary(slashCommand)}` : undefined,
				provider ? `Provider: ${provider.label}${provider.model ? ` / ${provider.model}` : ''}` : undefined,
				modePolicy ? modePolicySummary(modePolicy) : undefined,
				commandPermissionPolicy ? commandPermissionSummary(commandPermissionPolicy) : undefined,
				context ? summarizeContextPack(context) : undefined,
				parallelPlan ? parallelPlanSummary(parallelPlan) : undefined,
				verificationPlan ? verificationPlanSummary(verificationPlan) : undefined,
				customModeCatalog ? customModeCatalogSummary(customModeCatalog) : undefined,
				sessionRecall ? sessionRecallSummary(sessionRecall) : undefined,
				docsContext ? docsContextSummary(docsContext) : undefined,
				workspaceGuidance ? workspaceGuidanceSummary(workspaceGuidance) : undefined,
				ruleProposal ? ruleProposalSummary(ruleProposal) : undefined,
				memoryBank ? memoryBankSummary(memoryBank) : undefined,
				previewPlan ? previewPlanSummary(previewPlan) : undefined,
				mcpCatalog ? mcpCatalogSummary(mcpCatalog) : undefined,
				toolCatalog ? toolCatalogSummary(toolCatalog) : undefined,
			].filter(Boolean).join('\n'),
		}, timestamp + 1),
		createTranscriptEvent({
			kind: 'user',
			title: `${modeLabel(mode)} task`,
			detail: prompt || '(empty prompt)',
		}, timestamp),
	];
}

function normalizeVerificationStatusMessage(value: unknown): VibeCodexVerificationStatus {
	switch (value) {
		case 'passed':
		case 'failed':
		case 'skipped':
			return value;
		default:
			return 'skipped';
	}
}

function normalizeTaskBoardStatusMessage(value: unknown): VibeCodexTaskBoardStatus {
	switch (value) {
		case 'queued':
		case 'ready':
		case 'running':
		case 'completed':
		case 'blocked':
		case 'archived':
			return value;
		default:
			return 'blocked';
	}
}

function terminalRunEvidence(run: VibeCodexCapturedTerminalRun, diagnostics?: VibeCodexDiagnosticsSnapshot, insight?: VibeCodexTerminalInsight, verification?: { readonly checkId: string; readonly verificationStatus: VibeCodexVerificationStatus }): string {
	const lines = [
		`Command: ${run.commandLine}`,
		run.cwd ? `Cwd: ${run.cwd}` : undefined,
		`Status: ${run.status}`,
		run.exitCode !== undefined ? `Exit: ${run.exitCode}` : undefined,
		run.signal ? `Signal: ${run.signal}` : undefined,
		verification ? `Verification check: ${verification.checkId} -> ${verification.verificationStatus}` : undefined,
		run.output ? `Output:\n${run.output.slice(-4000)}` : undefined,
		diagnostics ? `Diagnostics:\n${diagnosticsSnapshotSummary(diagnostics)}` : undefined,
		insight?.findings.length ? `Terminal insights:\n${terminalInsightPromptBlock(insight)}` : undefined,
	].filter(Boolean);
	return lines.join('\n');
}

function isSidebarRequestMethod(method: string): boolean {
	return method.startsWith('sidebar/');
}

function bridgeStatusText(status: ExternalBridgeStatus): string {
	const suffix = [
		status.transport ? `transport=${status.transport}` : undefined,
		status.framing ? `framing=${status.framing}` : undefined,
		status.handshake && status.handshake !== 'unknown' ? `handshake=${status.handshake}` : undefined,
		status.pendingRequests ? `pending=${status.pendingRequests}` : undefined,
		status.health?.state ? `health=${status.health.state}` : undefined,
		status.health?.oldestPendingMs !== undefined ? `oldest=${Math.round(status.health.oldestPendingMs / 1000)}s` : undefined,
	].filter(Boolean).join(' ');
	return `${status.label}${status.detail ? `: ${status.detail}` : ''}${suffix ? ` (${suffix})` : ''}`;
}

function previewPanelHtml(webview: vscode.Webview, url: string, label: string): string {
	const nonce = createNonce();
	const origin = safeOrigin(url);
	const frameSrc = origin ? `${origin} ${webview.cspSource}` : webview.cspSource;
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${frameSrc}; style-src ${webview.cspSource} 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(label)}</title>
	<style nonce="${nonce}">
		html, body, iframe { width: 100%; height: 100%; margin: 0; padding: 0; border: 0; background: var(--vscode-editor-background); }
		.banner { box-sizing: border-box; height: 28px; padding: 6px 10px; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-input-border); font-family: var(--vscode-font-family); font-size: 12px; }
		iframe { height: calc(100% - 28px); }
	</style>
</head>
<body>
	<div class="banner">${escapeHtml(label)} · ${escapeHtml(url)}</div>
	<iframe title="${escapeHtml(label)}" src="${escapeHtml(url)}"></iframe>
</body>
</html>`;
}

function safeOrigin(url: string): string | undefined {
	return url.match(/^(https?:\/\/[^/]+)/)?.[1];
}

function isLoopbackUrl(url: string): boolean {
	return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?(?:\/|$)/.test(url);
}

function createNonce(): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 32; i++) {
		nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
	}
	return nonce;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&': return '&amp;';
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '"': return '&quot;';
			case '\'': return '&#39;';
			default: return ch;
		}
	});
}

function createTerminalTaskPrompt(mode: string, prompt: string, context?: VibeCodexContextPack, provider?: VibeCodexProviderRuntimeConfig, modePolicy?: VibeCodexModePolicy, commandPermissionPolicy?: VibeCodexCommandPermissionPolicy, parallelPlan?: VibeCodexParallelPlan, verificationPlan?: VibeCodexVerificationPlan, customModeCatalog?: VibeCodexCustomModeCatalog, sessionRecall?: VibeCodexSessionRecall, docsContext?: VibeCodexDocsContext, workspaceGuidance?: VibeCodexWorkspaceGuidance, ruleProposal?: VibeCodexRuleProposal, memoryBank?: VibeCodexMemoryBank, previewPlan?: VibeCodexPreviewPlan, mcpCatalog?: VibeCodexMcpCatalog, toolCatalog?: VibeCodexToolCatalog, taskBoard?: VibeCodexTaskBoard, slashCommand?: VibeCodexSlashCommandContext): string {
	const normalizedMode = normalizeMode(mode);
	const body = prompt.trim();
	const instruction = terminalModeInstruction(normalizedMode);
	const sections = [instruction];
	if (slashCommand) {
		sections.push(`Slash command workflow:\nHonor this Cline-compatible slash command while preserving Vibe Codex visual planning, approval authorization, diff review, and rollback gates. If workflowContent.text is present, treat it as bounded read-only workflow instructions loaded from the workspace file.\n\`\`\`json\n${slashCommandPromptBlock(slashCommand)}\n\`\`\``);
	}
	if (provider) {
		sections.push(`Provider configuration:\n\`\`\`json\n${providerPromptBlock(provider)}\n\`\`\``);
	}
	if (modePolicy) {
		sections.push(`Mode policy:\nThese action permissions are enforced by the Vibe Codex extension bridge. Do not request blocked actions.\n\`\`\`json\n${modePolicyPromptBlock(modePolicy)}\n\`\`\``);
	}
	if (commandPermissionPolicy) {
		sections.push(`Command permission policy:\nTerminal commands must match this policy in addition to the approved visual plan. Do not request denied commands.\n\`\`\`json\n${commandPermissionPromptBlock(commandPermissionPolicy)}\n\`\`\``);
	}
	if (parallelPlan) {
		sections.push(`Parallel agent isolation contract:\n\`\`\`json\n${parallelPlanPromptBlock(parallelPlan)}\n\`\`\``);
	}
	if (verificationPlan) {
		sections.push(`Verification gate:\nRun or explicitly justify each required check before final review.\n\`\`\`json\n${verificationPlanPromptBlock(verificationPlan)}\n\`\`\``);
	}
	if (customModeCatalog && customModeCatalog.modes.length) {
		sections.push(`Workspace custom modes:\nHonor the selected custom mode when applicable, but preserve Vibe Codex visual planning, approval, diff review, verification, and rollback gates.\n\`\`\`json\n${customModeCatalogPromptBlock(customModeCatalog)}\n\`\`\``);
	}
	if (sessionRecall && sessionRecall.entries.length) {
		sections.push(`Previous chat/session recall:\nUse this as read-only continuity context. It is not approval for the current task and must not override current workspace context.\n\`\`\`json\n${sessionRecallPromptBlock(sessionRecall)}\n\`\`\``);
	}
	if (docsContext && docsContext.documents.length) {
		sections.push(`Project documentation context:\nUse these docs as read-only planning input. Documentation edits still require the approved visual plan and normal diff review.\n\`\`\`json\n${docsContextPromptBlock(docsContext)}\n\`\`\``);
	}
	if (workspaceGuidance) {
		sections.push(`Workspace rules, skills, and hook manifests:\nTreat hooks as read-only context unless an explicit approval flow asks to execute them.\n\`\`\`json\n${workspaceGuidancePromptBlock(workspaceGuidance)}\n\`\`\``);
	}
	if (ruleProposal) {
		sections.push(`Workspace rule proposal draft:\nTreat this /newrule draft as planning context. Show the target file and proposed text in the visual plan, then use normal diff review after approval.\n\`\`\`json\n${ruleProposalPromptBlock(ruleProposal)}\n\`\`\``);
	}
	if (memoryBank && memoryBank.documents.length) {
		sections.push(`Memory Bank:\nUse these long-lived project notes as read-only planning context. Propose Memory Bank updates only through the normal visual plan and diff review gates.\n\`\`\`json\n${memoryBankPromptBlock(memoryBank)}\n\`\`\``);
	}
	if (previewPlan) {
		sections.push(`Preview targets:\nUse these only through visible terminal handoff or explicit preview controls.\n\`\`\`json\n${previewPlanPromptBlock(previewPlan)}\n\`\`\``);
	}
	if (mcpCatalog) {
		sections.push(`MCP server catalog:\nTreat this as redacted workspace MCP context. Invoke MCP tools only through explicit approval-aware backend tool calls.\n\`\`\`json\n${mcpCatalogPromptBlock(mcpCatalog)}\n\`\`\``);
	}
	if (toolCatalog) {
		sections.push(`Client tool catalog:\nUse only tools marked available, and preserve approval/plan authorization requirements for every mutating call.\n\`\`\`json\n${toolCatalogPromptBlock(toolCatalog)}\n\`\`\``);
	}
	if (taskBoard && taskBoard.cards.some(card => card.status !== 'archived')) {
		sections.push(`Task Board coordination state:\nUse this as Cline-style queued/dependent task context. Do not mark dependent work complete without verification evidence.\n\`\`\`json\n${taskBoardPromptBlock(taskBoard)}\n\`\`\``);
	}
	if (context) {
		sections.push(`Workspace context:\n\`\`\`json\n${contextPackForPrompt(context)}\n\`\`\``);
	}
	if (body) {
		sections.push(body);
	}
	return sections.join('\n\n');
}

function createParallelLaneTerminalPrompt(input: { readonly activePlan?: VibeCodexPlan; readonly parallelPlan: VibeCodexParallelPlan; readonly thread: VibeCodexParallelThread; readonly promptFocus: string; readonly verificationPlan?: VibeCodexVerificationPlan }): string {
	const sections = [
		`Vibe Codex parallel lane ${input.thread.id} (${input.thread.role}).`,
		[
			'You are running inside an isolated git worktree for one approved parallel lane.',
			'Work only in the current cwd/worktree. Do not write to the base workspace or sibling lane worktrees.',
			'Use the approved visual plan as the contract. Do not change scope without reporting a blocker.',
			'When finished, report lane evidence through agent/parallelResult if the backend bridge is available; terminal completion will be captured as fallback evidence.',
			'Do not merge back, stage, commit, clean worktrees, or accept/reject diffs from this lane.',
		].join(' '),
		`Lane focus:\n${input.promptFocus}`,
		`Parallel isolation contract:\n\`\`\`json\n${parallelPlanPromptBlock(input.parallelPlan)}\n\`\`\``,
		`Selected lane:\n\`\`\`json\n${JSON.stringify({
			id: input.thread.id,
			role: input.thread.role,
			branchName: input.thread.branchName,
			worktreePath: input.thread.worktreePath,
			status: input.thread.status,
			promptFocus: input.thread.promptFocus,
			expectedResultMethod: 'agent/parallelResult',
		}, null, 2)}\n\`\`\``,
	];
	if (input.activePlan) {
		sections.push(`Approved visual plan:\n${planToPrompt(input.activePlan)}`);
	}
	if (input.verificationPlan) {
		sections.push(`Verification gate:\nRun or explicitly justify lane-relevant checks and include evidence in the parallel result.\n\`\`\`json\n${verificationPlanPromptBlock(input.verificationPlan)}\n\`\`\``);
	}
	return sections.join('\n\n');
}

function terminalProviderEnv(provider: VibeCodexProviderRuntimeConfig): Record<string, string> {
	const env: Record<string, string> = {
		VIBECODEX_PROVIDER: provider.provider,
	};
	if (provider.model) {
		env.VIBECODEX_MODEL = provider.model;
	}
	if (provider.mode) {
		env.VIBECODEX_MODE = provider.mode;
	}
	if (provider.modelRouting.source) {
		env.VIBECODEX_MODEL_SOURCE = provider.modelRouting.source;
	}
	if (provider.baseUrl) {
		env.VIBECODEX_BASE_URL = provider.baseUrl;
		if (isOpenAiCompatibleProvider(provider.provider)) {
			env.OPENAI_BASE_URL = provider.baseUrl;
		}
		if (provider.provider === 'azure') {
			env.AZURE_OPENAI_ENDPOINT = provider.baseUrl;
		}
	}
	if (provider.codexConfig.configPath) {
		env.VIBECODEX_CODEX_CONFIG_PATH = provider.codexConfig.configPath;
	}
	if (provider.codexConfig.modelProvider) {
		env.VIBECODEX_CODEX_MODEL_PROVIDER = provider.codexConfig.modelProvider;
	}
	if (provider.codexConfig.projectTrust) {
		env.VIBECODEX_CODEX_PROJECT_TRUST = provider.codexConfig.projectTrust;
	}
	if (provider.apiKey) {
		env.VIBECODEX_API_KEY = provider.apiKey;
		if (isOpenAiCompatibleProvider(provider.provider)) {
			env.OPENAI_API_KEY = provider.apiKey;
		}
		assignProviderApiKeyEnv(env, provider);
	}
	return env;
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

function assignProviderApiKeyEnv(env: Record<string, string>, provider: VibeCodexProviderRuntimeConfig): void {
	if (!provider.apiKey) {
		return;
	}
	switch (provider.provider) {
		case 'anthropic':
			env.ANTHROPIC_API_KEY = provider.apiKey;
			break;
		case 'gemini':
			env.GEMINI_API_KEY = provider.apiKey;
			env.GOOGLE_API_KEY = provider.apiKey;
			break;
		case 'bedrock':
			env.BEDROCK_API_KEY = provider.apiKey;
			break;
		case 'openrouter':
			env.OPENROUTER_API_KEY = provider.apiKey;
			break;
		case 'vercel':
			env.VERCEL_AI_GATEWAY_API_KEY = provider.apiKey;
			env.AI_GATEWAY_API_KEY = provider.apiKey;
			break;
		case 'azure':
			env.AZURE_OPENAI_API_KEY = provider.apiKey;
			break;
		case 'vertex':
			env.VERTEX_API_KEY = provider.apiKey;
			env.GOOGLE_API_KEY = provider.apiKey;
			break;
		case 'cerebras':
			env.CEREBRAS_API_KEY = provider.apiKey;
			break;
		case 'groq':
			env.GROQ_API_KEY = provider.apiKey;
			break;
		case 'mistral':
			env.MISTRAL_API_KEY = provider.apiKey;
			break;
		case 'xai':
			env.XAI_API_KEY = provider.apiKey;
			break;
	}
}

function normalizeMode(mode: string): string {
	return normalizeVibeCodexMode(mode);
}

function modeFromNativeCommand(command: string): string | undefined {
	if (command === nativeCommands.planMode) {
		return 'plan';
	}
	if (command === nativeCommands.askMode) {
		return 'ask';
	}
	if (command === nativeCommands.manualMode) {
		return 'manual';
	}
	if (command === nativeCommands.actMode) {
		return 'act';
	}
	if (command === nativeCommands.agentMode) {
		return 'agent';
	}
	if (command === nativeCommands.debugMode) {
		return 'debug';
	}
	if (command === nativeCommands.reviewMode) {
		return 'review';
	}
	if (command === nativeCommands.customMode) {
		return 'custom';
	}
	return undefined;
}

function delegatedTaskEvidence(request: VibeCodexDelegatedTaskRequest): readonly string[] {
	return [
		`Delegated by backend method ${request.method}.`,
		request.parentTaskId ? `Parent task: ${request.parentTaskId}.` : undefined,
		request.dependsOn.length ? `Depends on: ${request.dependsOn.join(', ')}.` : undefined,
		`Mode: ${normalizeMode(request.mode)}.`,
		`Parallel lanes: ${request.parallelThreads}.`,
		request.subagentCount ? `Subagent lanes requested: ${request.subagentCount}.` : undefined,
		request.subtaskCount ? `Subtasks requested: ${request.subtaskCount}.` : undefined,
		request.reason ? `Reason: ${request.reason}` : undefined,
	].filter((value): value is string => !!value);
}

function externalTaskEvidence(intake: VibeCodexExternalTaskIntake): readonly string[] {
	return [
		externalTaskIntakeSummary(intake),
		`Trigger: ${intake.triggerKind}.`,
		`Source: ${intake.source}.`,
		intake.sourceId ? `Source id: ${intake.sourceId}.` : undefined,
		intake.originalUri ? `Original URI: ${intake.originalUri}` : undefined,
	].filter((value): value is string => !!value);
}

function modeLabel(mode: string): string {
	const normalizedMode = normalizeMode(mode);
	return normalizedMode.charAt(0).toUpperCase() + normalizedMode.slice(1);
}

function verificationCriteriaKey(criteria: readonly string[]): string {
	return criteria.map(item => item.trim()).filter(Boolean).join('\n');
}

function extractThreadId(value: unknown): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	const direct = stringValue(value.threadId);
	if (direct) {
		return direct;
	}
	if (isRecord(value.thread)) {
		return stringValue(value.thread.id);
	}
	return undefined;
}

function terminalModeInstruction(mode: string): string {
	switch (normalizeMode(mode)) {
		case 'ask':
			return 'Vibe Codex Ask Mode: answer the question using the current workspace context. Do not modify files unless explicitly asked.';
		case 'plan':
			return 'Vibe Codex Plan Mode: create a structured plan with a Mermaid flowchart and checklist. Do not modify files before approval.';
		case 'manual':
			return 'Vibe Codex Manual Mode: prepare explicit tool, file, and terminal proposals for user-directed execution. Do not perform autonomous multi-step actions.';
		case 'act':
			return 'Vibe Codex Act Mode: implement the approved plan, show diffs, and run relevant checks before summarizing.';
		case 'debug':
			return 'Vibe Codex Debug Mode: reproduce the issue, inspect diagnostics, propose the fix, and verify with focused checks.';
		case 'review':
			return 'Vibe Codex Review Mode: review the current changes for bugs, regressions, missing tests, and safety risks.';
		case 'custom':
			return 'Vibe Codex Custom Mode: follow the workspace/user-defined mode instructions while preserving visual planning, approvals, diffs, verification, and rollback.';
		default:
			return 'Vibe Codex Agent Mode: operate agentically with planning, approval-aware edits, terminal checks, diffs, and rollback notes.';
	}
}

function shellQuote(value: string): string {
	if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
		return value;
	}
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function normalizeRenderedPlanIdentity(value: VibeCodexRenderedPlanActionPayload): VibeCodexRenderedPlanIdentity | undefined {
	const taskId = stringValue(value.taskId);
	const revision = numberValue(value.revision);
	const planHash = stringValue(value.planHash);
	if (!taskId || revision === undefined || !Number.isInteger(revision) || !planHash) {
		return undefined;
	}
	return { taskId, revision, planHash };
}
