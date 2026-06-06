/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexDiagnosticsBaselineLike, VibeCodexDiagnosticsSnapshot } from './diagnosticsEvidence';
import type { VibeCodexDiffFileStatusResponse } from './diffFileStatusProtocol';
import type { VibeCodexDiffReapplyStatusResponse } from './diffReapplyStatusProtocol';
import type { VibeCodexDiffValidationResponse } from './diffValidationProtocol';
import type { VibeCodexExecutionGateStatusResponse } from './executionGateStatusProtocol';
import type { VibeCodexAutoCommitStatusResponse } from './autoCommitStatusProtocol';
import type { ExternalDiffReview } from './executionProtocol';
import type { VibeCodexBackendLaunchStatusResponse } from './backendLaunchStatusProtocol';
import type { VibeCodexBrowserActionStatusResponse } from './browserActionStatusProtocol';
import type { VibeCodexBrowserStatusResponse } from './browserStatusProtocol';
import type { VibeCodexCommitHandoffStatusResponse } from './commitHandoffStatusProtocol';
import type { VibeCodexExtensionInstallStatusResponse } from './extensionInstallStatusProtocol';
import type { VibeCodexExternalIntakeStatusResponse } from './externalIntakeStatusProtocol';
import type { VibeCodexGuidanceSelectionResponse } from './guidanceSelectionProtocol';
import type { VibeCodexGuidanceStatusResponse } from './guidanceStatusProtocol';
import type { VibeCodexInlinePromptStatusResponse } from './inlinePromptStatusProtocol';
import type { VibeCodexMcpStatusResponse } from './mcpStatusProtocol';
import type { VibeCodexModeStatusResponse } from './modeStatusProtocol';
import type { VibeCodexParallelPlan } from './multiAgent';
import type { VibeCodexParallelMergeRequest, VibeCodexParallelReview } from './parallelReview';
import type { VibeCodexAcceptanceCriteriaStatusResponse } from './acceptanceCriteriaStatusProtocol';
import type { VibeCodexPlanCanvasStatusResponse } from './planCanvasStatusProtocol';
import type { VibeCodexPlanEditStatusResponse } from './planEditStatusProtocol';
import type { VibeCodexPlanFocusStatusResponse } from './planFocusStatusProtocol';
import type { VibeCodexPlan } from './planProtocol';
import type { VibeCodexPlanStatusResponse } from './planStatusProtocol';
import type { VibeCodexPreviewStatusResponse } from './previewStatusProtocol';
import type { VibeCodexProtocolStatusResponse } from './protocolStatusProtocol';
import type { VibeCodexProviderCatalogResponse } from './providerCatalogProtocol';
import type { VibeCodexProviderStatusResponse } from './providerStatusProtocol';
import { redactSensitiveText } from './secretFilters';
import type { VibeCodexSafetyStatusResponse } from './safetyStatusProtocol';
import type { VibeCodexSessionExportResponse } from './sessionExportProtocol';
import type { VibeCodexSessionHistoryStatusResponse } from './sessionHistoryStatusProtocol';
import type { VibeCodexSlashCommandStatusResponse } from './slashCommandStatusProtocol';
import type { VibeCodexTerminalCommandValidationResponse } from './terminalCommandValidationProtocol';
import type { VibeCodexTerminalControlResponse } from './terminalControlProtocol';
import type { VibeCodexTerminalRemediationStatusResponse } from './terminalRemediationStatusProtocol';
import type { VibeCodexTaskCompletionStatusResponse } from './taskCompletionStatusProtocol';
import type { VibeCodexTaskStartStatusResponse } from './taskStartStatusProtocol';
import type { VibeCodexToolTimelineStatusResponse } from './toolTimelineStatusProtocol';
import type { VibeCodexVerificationPlan } from './verificationPlan';
import type { VibeCodexWebFetchRequest } from './webFetchProtocol';
import type { VibeCodexWorkspaceSandboxStatusResponse } from './workspaceSandboxStatusProtocol';

export type VibeCodexDeliveryBarStatus = 'passed' | 'pending' | 'failed' | 'skipped';

export interface VibeCodexDeliveryBarCheck {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexDeliveryBarStatus;
	readonly required: boolean;
	readonly detail: string;
}

export interface VibeCodexDeliveryBarState {
	readonly version: 1;
	readonly updatedAt: number;
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly summary: string;
	readonly checks: readonly VibeCodexDeliveryBarCheck[];
}

export interface VibeCodexDeliveryBarInput {
	readonly plan?: Pick<VibeCodexPlan, 'taskId' | 'revision' | 'summary'>;
	readonly hasExecutionAuthorization: boolean;
	readonly verificationPlan?: VibeCodexVerificationPlan;
	readonly diffReview?: ExternalDiffReview;
	readonly diffValidationStatus?: VibeCodexDiffValidationResponse;
	readonly diffFileStatus?: VibeCodexDiffFileStatusResponse;
	readonly diffReapplyStatus?: VibeCodexDiffReapplyStatusResponse;
	readonly taskCheckpointId?: string;
	readonly fileCheckpointCount: number;
	readonly fileCheckpointPaths?: readonly string[];
	readonly diagnosticsSnapshot?: VibeCodexDiagnosticsSnapshot;
	readonly diagnosticsBaseline?: VibeCodexDiagnosticsBaselineLike;
	readonly backendLaunchStatus?: VibeCodexBackendLaunchStatusResponse;
	readonly protocolStatus?: VibeCodexProtocolStatusResponse;
	readonly extensionInstallStatus?: VibeCodexExtensionInstallStatusResponse;
	readonly inlinePromptStatus?: VibeCodexInlinePromptStatusResponse;
	readonly modeStatus?: VibeCodexModeStatusResponse;
	readonly taskStartStatus?: VibeCodexTaskStartStatusResponse;
	readonly externalIntakeStatus?: VibeCodexExternalIntakeStatusResponse;
	readonly sessionHistoryStatus?: VibeCodexSessionHistoryStatusResponse;
	readonly sessionExportStatus?: VibeCodexSessionExportResponse;
	readonly providerCatalogStatus?: VibeCodexProviderCatalogResponse;
	readonly providerStatus?: VibeCodexProviderStatusResponse;
	readonly planCanvasStatus?: VibeCodexPlanCanvasStatusResponse;
	readonly planStatus?: VibeCodexPlanStatusResponse;
	readonly planEditStatus?: VibeCodexPlanEditStatusResponse;
	readonly planFocusStatus?: VibeCodexPlanFocusStatusResponse;
	readonly acceptanceCriteriaStatus?: VibeCodexAcceptanceCriteriaStatusResponse;
	readonly guidanceStatus?: VibeCodexGuidanceStatusResponse;
	readonly guidanceSelection?: VibeCodexGuidanceSelectionResponse;
	readonly slashCommandStatus?: VibeCodexSlashCommandStatusResponse;
	readonly terminalCommandValidationStatus?: VibeCodexTerminalCommandValidationResponse;
	readonly executionGateStatus?: VibeCodexExecutionGateStatusResponse;
	readonly safetyStatus?: VibeCodexSafetyStatusResponse;
	readonly workspaceSandboxStatus?: VibeCodexWorkspaceSandboxStatusResponse;
	readonly terminalControlStatus?: VibeCodexTerminalControlResponse;
	readonly terminalRemediationStatus?: VibeCodexTerminalRemediationStatusResponse;
	readonly commitHandoffStatus?: VibeCodexCommitHandoffStatusResponse;
	readonly autoCommitStatus?: VibeCodexAutoCommitStatusResponse;
	readonly taskCompletionStatus?: VibeCodexTaskCompletionStatusResponse;
	readonly browserStatus?: VibeCodexBrowserStatusResponse;
	readonly browserActionStatus?: VibeCodexBrowserActionStatusResponse;
	readonly previewStatus?: VibeCodexPreviewStatusResponse;
	readonly mcpStatus?: VibeCodexMcpStatusResponse;
	readonly webFetchRequest?: VibeCodexWebFetchRequest;
	readonly toolTimelineStatus?: VibeCodexToolTimelineStatusResponse;
	readonly parallelPlan?: VibeCodexParallelPlan;
	readonly parallelReview?: VibeCodexParallelReview;
	readonly parallelMergeRequest?: VibeCodexParallelMergeRequest;
}

export function createDeliveryBarState(input: VibeCodexDeliveryBarInput): VibeCodexDeliveryBarState {
	const checks = [
		planCheck(input.plan),
		nativePromptSurfaceCheck(input),
		modeReadinessCheck(input.modeStatus),
		bridgeCheck(input.backendLaunchStatus, input.protocolStatus),
		planCanvasCheck(input.planCanvasStatus),
		planInteractionCheck(input),
		guidanceCheck(input.guidanceStatus, input.guidanceSelection, input.slashCommandStatus),
		approvalCheck(input.plan, input.hasExecutionAuthorization),
		executionSafetyCheck(input),
		toolSurfaceCheck(input),
		verificationCheck(input.verificationPlan),
		diagnosticsCheck(input.diagnosticsSnapshot, input.diagnosticsBaseline),
		diffReviewCheck(input.diffReview),
		diffProtocolCheck(input.diffValidationStatus, input.diffFileStatus, input.diffReapplyStatus),
		checkpointCheck(input.diffReview, input.taskCheckpointId, input.fileCheckpointCount, input.fileCheckpointPaths),
		parallelCheck(input.parallelPlan, input.parallelReview, input.parallelMergeRequest, input.hasExecutionAuthorization),
		completionHandoffCheck(input.commitHandoffStatus, input.autoCommitStatus, input.taskCompletionStatus),
	];
	const required = checks.filter(check => check.required);
	const blocked = required.some(check => check.status === 'failed');
	const ready = required.length > 0 && required.every(check => check.status === 'passed');
	return {
		version: 1,
		updatedAt: Date.now(),
		ready,
		blocked,
		summary: deliveryBarSummary(checks, ready, blocked),
		checks,
	};
}

export function deliveryBarSummary(checks: readonly VibeCodexDeliveryBarCheck[], ready: boolean, blocked: boolean): string {
	const passed = checks.filter(check => check.status === 'passed').length;
	const pending = checks.filter(check => check.status === 'pending').length;
	const failed = checks.filter(check => check.status === 'failed').length;
	if (ready) {
		return `Delivery bar ready: ${passed} passed, ${pending} pending, ${failed} failed.`;
	}
	if (blocked) {
		return `Delivery bar blocked: ${passed} passed, ${pending} pending, ${failed} failed.`;
	}
	return `Delivery bar pending: ${passed} passed, ${pending} pending, ${failed} failed.`;
}

function planCheck(plan: VibeCodexDeliveryBarInput['plan']): VibeCodexDeliveryBarCheck {
	return {
		id: 'visual-plan',
		title: 'Visual plan',
		required: true,
		status: plan ? 'passed' : 'pending',
		detail: plan ? `${plan.taskId} r${plan.revision}: ${plan.summary}` : 'No visual plan has been submitted yet.',
	};
}

function nativePromptSurfaceCheck(input: VibeCodexDeliveryBarInput): VibeCodexDeliveryBarCheck {
	if (!input.extensionInstallStatus && !input.inlinePromptStatus && !input.taskStartStatus && !input.externalIntakeStatus && !input.sessionHistoryStatus && !input.sessionExportStatus && !input.providerCatalogStatus && !input.providerStatus) {
		return {
			id: 'native-prompt-surface',
			title: 'Native prompt surface',
			required: false,
			status: 'skipped',
			detail: 'No extension install, inline prompt, task intake, session history/export, or provider status has been requested yet.',
		};
	}
	const blockers = nativePromptSurfaceBlockers(input);
	const pending = nativePromptSurfacePending(input);
	const ready = blockers.length === 0 && pending.length === 0;
	const evidenceCount = [
		input.extensionInstallStatus,
		input.inlinePromptStatus,
		input.taskStartStatus,
		input.externalIntakeStatus,
		input.sessionHistoryStatus,
		input.sessionExportStatus,
		input.providerCatalogStatus,
		input.providerStatus,
	].filter(Boolean).length;
	return {
		id: 'native-prompt-surface',
		title: 'Native prompt surface',
		required: true,
		status: ready ? 'passed' : blockers.length ? 'failed' : 'pending',
		detail: ready
			? `${evidenceCount} prompt-surface status${evidenceCount === 1 ? '' : 'es'} prove installable VSIX entrypoints, Ctrl/Cmd+K context, task intake, chat history/export, and provider/model routing.`
			: [...blockers, ...pending].slice(0, 4).map(redactSensitiveText).join('; '),
	};
}

function nativePromptSurfaceBlockers(input: VibeCodexDeliveryBarInput): readonly string[] {
	const blockers: string[] = [];
	const install = input.extensionInstallStatus;
	if (install) {
		if (!install.ready || install.state !== 'ready') {
			blockers.push(install.blockers[0] ?? install.message);
		}
		const missingFeatures = ['inline-shortcut', 'menu-entrypoints', 'mode-entrypoints', 'sidebar-view', 'provider-backend-config', 'webview-security']
			.filter(id => install.features?.find(feature => feature.id === id)?.ready !== true);
		if (missingFeatures.length) {
			blockers.push(`Extension install features not ready: ${missingFeatures.join(', ')}.`);
		}
	}
	const inlinePrompt = input.inlinePromptStatus;
	if (inlinePrompt) {
		if (!inlinePrompt.active) {
			blockers.push('No active Ctrl/Cmd+K inline prompt session is available.');
		}
		if (inlinePrompt.active && (inlinePrompt.counts.requiredPlanSteps === 0 || inlinePrompt.counts.acceptanceCriteria === 0)) {
			blockers.push('Inline prompt session is missing required visual-plan steps or acceptance criteria.');
		}
	}
	const taskStart = input.taskStartStatus;
	if (taskStart) {
		if (!taskStart.readiness.beginsPlanOnly || !taskStart.readiness.requiresVisualPlanApproval || !taskStart.readiness.mutationLocked) {
			blockers.push('Task start readiness does not preserve plan-only mutation lock semantics.');
		}
		if (taskStart.readiness.route === 'blocked' || taskStart.readiness.route === 'not_found' || taskStart.readiness.route === 'empty_board') {
			blockers.push(taskStart.readiness.blockers[0] ?? taskStart.readiness.nextAction);
		}
	}
	const intake = input.externalIntakeStatus;
	if (intake) {
		if (!intake.enabled || !intake.limits.startRequestBeginsPlanOnly || intake.limits.maxParallelThreads !== 8 || !intake.limits.promptRequired) {
			blockers.push('External intake limits do not preserve prompt-required, plan-only, max-8-thread routing.');
		}
		if (!intake.triggers.length || !intake.entrypoints.routes.length) {
			blockers.push('External intake routes are unavailable.');
		}
	}
	const sessions = input.sessionHistoryStatus;
	if (sessions) {
		if (sessions.counts.tabs === 0 || sessions.counts.sessions === 0) {
			blockers.push('Session history has no visible chat tab or stored session.');
		}
		if (sessions.counts.activeSessions === 0) {
			blockers.push('Session history has no active session.');
		}
	}
	const sessionExport = input.sessionExportStatus;
	if (sessionExport) {
		if (!sessionExport.ok) {
			blockers.push(sessionExport.message);
		}
		if (!sessionExport.selectedActive) {
			blockers.push('Session export does not target the active chat session.');
		}
		if (!sessionExport.markdown || sessionExport.counts.returnedChars === 0 || sessionExport.counts.markdownChars === 0) {
			blockers.push('Session export did not return redacted Markdown.');
		}
		if (!sessionExport.guardrails.some(line => /never.*approv/i.test(line))) {
			blockers.push('Session export guardrails do not state old sessions never approve current tasks.');
		}
	}
	const providerCatalog = input.providerCatalogStatus;
	if (providerCatalog) {
		if (providerCatalog.counts.total === 0 || providerCatalog.counts.openAiCompatible === 0 || providerCatalog.counts.local === 0) {
			blockers.push('Provider catalog does not expose both OpenAI-compatible and local provider choices.');
		}
	}
	const provider = input.providerStatus;
	if (provider) {
		if (!provider.ok || provider.ready === false) {
			blockers.push(provider.blockers?.[0] ?? provider.message);
		}
		if (!provider.model || !provider.modelSource) {
			blockers.push('Provider status is missing effective model routing.');
		}
	}
	return blockers;
}

function nativePromptSurfacePending(input: VibeCodexDeliveryBarInput): readonly string[] {
	const pending: string[] = [];
	const inlinePrompt = input.inlinePromptStatus;
	if (inlinePrompt?.active && inlinePrompt.executionAuthorization.approved && !inlinePrompt.executionAuthorization.activePlanMatches) {
		pending.push('Inline prompt authorization does not match the active visual plan revision.');
	}
	const taskStart = input.taskStartStatus;
	if (taskStart && !taskStart.readiness.startAllowed && !['blocked', 'not_found', 'empty_board'].includes(taskStart.readiness.route)) {
		pending.push(taskStart.readiness.nextAction);
	}
	const sessions = input.sessionHistoryStatus;
	if (sessions && sessions.counts.planning + sessions.counts.approved + sessions.counts.terminal + sessions.counts.diffReview + sessions.counts.rollback === 0 && sessions.counts.completed === 0) {
		pending.push('Session history is available but has no planning, approved, execution, review, rollback, or completed session state yet.');
	}
	if (input.sessionExportStatus?.truncated) {
		pending.push('Session export is available but truncated by the requested character cap.');
	}
	return pending;
}

function modeReadinessCheck(status: VibeCodexModeStatusResponse | undefined): VibeCodexDeliveryBarCheck {
	if (!status) {
		return {
			id: 'mode-readiness',
			title: 'Mode readiness',
			required: false,
			status: 'skipped',
			detail: 'No mode readiness status has been requested yet.',
		};
	}
	const requiredModes = ['plan', 'ask', 'manual', 'act', 'agent', 'debug', 'review', 'custom'];
	const availableModes = new Set((status.modes ?? []).map(mode => mode.mode));
	const missingModes = requiredModes.filter(mode => !availableModes.has(mode));
	const blockers = [
		missingModes.length ? `Mode matrix is missing: ${missingModes.join(', ')}.` : undefined,
		status.counts.modes < requiredModes.length ? `Mode matrix has only ${status.counts.modes}/${requiredModes.length} modes.` : undefined,
		status.counts.readOnlyModes < 4 || status.counts.executionModes < 4 ? `Mode matrix must expose four read-only and four execution-capable modes; got ${status.counts.readOnlyModes}/${status.counts.executionModes}.` : undefined,
		!status.current.requiresVisualPlan ? `${status.current.label} Mode does not require a visual plan.` : undefined,
		status.current.readOnly ? `${status.current.label} Mode is read-only; switch to Act, Agent, Debug, or Custom before final execution readiness.` : undefined,
		!status.current.readOnly && !status.current.requiresPlanApproval ? `${status.current.label} Mode does not require exact plan approval before mutation.` : undefined,
		!status.current.readOnly && status.current.allowedActions.length === 0 ? `${status.current.label} Mode has no execution actions available.` : undefined,
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const pending = [
		!status.authorization.approved || !status.authorization.activePlanMatches ? status.nextAction : undefined,
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const ready = blockers.length === 0 && pending.length === 0;
	return {
		id: 'mode-readiness',
		title: 'Mode readiness',
		required: true,
		status: ready ? 'passed' : blockers.length ? 'failed' : 'pending',
		detail: ready
			? `${status.current.label} Mode is execution-capable with exact approved visual-plan authorization; all ${requiredModes.length} standard modes are available.`
			: [...blockers, ...pending].slice(0, 4).join('; '),
	};
}

function approvalCheck(plan: VibeCodexDeliveryBarInput['plan'], hasExecutionAuthorization: boolean): VibeCodexDeliveryBarCheck {
	return {
		id: 'approved-plan',
		title: 'Approved plan revision',
		required: true,
		status: hasExecutionAuthorization ? 'passed' : plan ? 'pending' : 'pending',
		detail: hasExecutionAuthorization ? 'Exact plan revision is authorized for execution.' : 'Approve the rendered plan revision before tool, file, terminal, MCP, browser, or diff execution.',
	};
}

function bridgeCheck(backendLaunchStatus: VibeCodexBackendLaunchStatusResponse | undefined, protocolStatus: VibeCodexProtocolStatusResponse | undefined): VibeCodexDeliveryBarCheck {
	if (!backendLaunchStatus && !protocolStatus) {
		return {
			id: 'bridge',
			title: 'Codex app-server bridge',
			required: false,
			status: 'skipped',
			detail: 'No backend launch or protocol health status has been requested yet.',
		};
	}
	const launchReady = backendLaunchStatus?.ready ?? true;
	const connected = backendLaunchStatus?.connected ?? protocolStatus?.bridgeAvailable ?? false;
	const transportReady = protocolStatus?.transportReadiness?.ready ?? true;
	const localHandshakeContractReady = !protocolStatus || (protocolStatus.handshakeCapabilities.missingRequired.length === 0 && protocolStatus.handshakeCapabilities.coverage.complete);
	const handshakeAccepted = !protocolStatus || protocolStatus.health.handshake === 'ok' || protocolStatus.handshakeCapabilities.backendAccepted;
	const protocolHealthy = !protocolStatus || (!protocolStatus.health.stale && protocolStatus.counts.error === 0 && protocolStatus.health.state !== 'unknown');
	const blockers = [
		launchReady ? undefined : backendLaunchStatus?.blockers[0] ?? 'Backend launch route is blocked.',
		transportReady ? undefined : protocolStatus?.transportReadiness?.blockers[0] ?? 'Selected protocol transport route is blocked.',
		localHandshakeContractReady ? undefined : 'Local handshake capability contract is incomplete.',
		handshakeAccepted ? undefined : `Backend handshake is ${protocolStatus?.health.handshake ?? 'unknown'}.`,
		protocolHealthy ? undefined : 'Protocol health is stale, unknown, or has recorded errors.',
		connected ? undefined : 'Codex app-server bridge is not connected yet.',
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const ready = blockers.length === 0;
	return {
		id: 'bridge',
		title: 'Codex app-server bridge',
		required: true,
		status: ready ? 'passed' : connected && launchReady && transportReady && localHandshakeContractReady && handshakeAccepted ? 'pending' : 'failed',
		detail: ready
			? `JSON-RPC bridge connected over ${protocolStatus?.health.transport ?? backendLaunchStatus?.selectedTransport ?? 'configured transport'}/${protocolStatus?.health.framing ?? backendLaunchStatus?.framing ?? 'configured framing'} with accepted handshake.`
			: blockers.slice(0, 3).join('; '),
	};
}

function planCanvasCheck(status: VibeCodexPlanCanvasStatusResponse | undefined): VibeCodexDeliveryBarCheck {
	if (!status) {
		return {
			id: 'plan-canvas',
			title: 'Visual planning canvas',
			required: false,
			status: 'skipped',
			detail: 'No Plan Canvas readiness status has been requested yet.',
		};
	}
	const passed = status.ready && status.graphSource === 'validated_mermaid' && !status.approvalLocked && status.counts.missingFlowNodeIds === 0 && status.counts.duplicateFlowNodeIds === 0;
	const failed = status.route === 'repair_schema' || status.route === 'repair_mermaid' || status.route === 'repair_bindings';
	return {
		id: 'plan-canvas',
		title: 'Visual planning canvas',
		required: true,
		status: passed ? 'passed' : failed ? 'failed' : 'pending',
		detail: passed
			? `Plan Canvas rendered ${status.counts.nodes} graph node${status.counts.nodes === 1 ? '' : 's'} and ${status.counts.steps} linked checklist step${status.counts.steps === 1 ? '' : 's'} from validated Mermaid.`
			: status.blockers[0] ? redactSensitiveText(status.blockers[0]) : `Plan Canvas route is ${status.route}.`,
	};
}

function planInteractionCheck(input: VibeCodexDeliveryBarInput): VibeCodexDeliveryBarCheck {
	if (!input.planStatus && !input.planEditStatus && !input.planFocusStatus && !input.acceptanceCriteriaStatus) {
		return {
			id: 'plan-interaction',
			title: 'Plan interaction',
			required: false,
			status: 'skipped',
			detail: 'No plan status, manual edit preview, graph focus binding, or acceptance criteria readiness has been requested yet.',
		};
	}
	const blockers = planInteractionBlockers(input);
	const pending = planInteractionPending(input);
	const ready = blockers.length === 0 && pending.length === 0;
	const evidenceCount = [
		input.planStatus,
		input.planEditStatus,
		input.planFocusStatus,
		input.acceptanceCriteriaStatus,
	].filter(Boolean).length;
	return {
		id: 'plan-interaction',
		title: 'Plan interaction',
		required: true,
		status: ready ? 'passed' : blockers.length ? 'failed' : 'pending',
		detail: ready
			? `${evidenceCount} visual-plan interaction status${evidenceCount === 1 ? '' : 'es'} prove exact revision status, manual edit preview, graph/checklist focus binding, and acceptance criteria coverage.`
			: [...blockers, ...pending].slice(0, 4).map(redactSensitiveText).join('; '),
	};
}

function planInteractionBlockers(input: VibeCodexDeliveryBarInput): readonly string[] {
	const blockers: string[] = [];
	const status = input.planStatus;
	if (status) {
		if (!status.ok || !status.valid || !status.renderStatus.available || !status.renderStatus.safeMermaid || !status.renderStatus.graphValid) {
			blockers.push(status.validationErrors?.[0] ?? status.renderStatus.errors[0] ?? status.approvalBlockedReason ?? status.message);
		}
		if (status.renderStatus.fallbackRequired || status.renderStatus.linkedStepCount !== status.renderStatus.stepCount || status.renderStatus.missingFlowNodeIds.length || status.renderStatus.duplicateFlowNodeIds.length) {
			blockers.push(status.renderStatus.message);
		}
		if (!status.approvalReady) {
			blockers.push(status.approvalBlockedReason ?? 'Plan is not ready for approval.');
		}
	}
	const edit = input.planEditStatus;
	if (edit) {
		if (!edit.ok || !edit.activePlanAvailable || !edit.editPresent || !edit.valid || edit.editErrors.length || edit.validationErrors.length) {
			blockers.push(edit.editErrors[0] ?? edit.validationErrors[0] ?? edit.message);
		}
		if (!edit.mutationLocked) {
			blockers.push('Manual plan edit status did not preserve mutation lock.');
		}
		if (!edit.changed || !edit.approvalReady || edit.nextAction !== 'submit_manual_edit') {
			blockers.push(edit.message);
		}
		if ((edit.prospectiveRevision ?? 0) <= (edit.currentRevision ?? 0)) {
			blockers.push('Manual plan edit preview did not produce a newer prospective revision.');
		}
		if (!edit.render.safeMermaid || edit.render.linkedStepCount !== edit.render.stepCount) {
			blockers.push('Manual plan edit preview is not graph-linked for every checklist step.');
		}
	}
	const focus = input.planFocusStatus;
	if (focus) {
		if (!focus.ok || !focus.valid || !focus.focus.available || !focus.focus.matched || !focus.focus.graphNodePresent || !focus.focus.checklistLinked) {
			blockers.push(focus.validationErrors[0] ?? focus.focus.message ?? focus.message);
		}
		if (focus.counts.missingGraphNodes > 0 || focus.counts.duplicateFlowNodeIds > 0 || focus.counts.linkedBindings !== focus.counts.bindings) {
			blockers.push(`Plan focus bindings incomplete: ${focus.counts.linkedBindings}/${focus.counts.bindings} linked.`);
		}
	}
	const acceptance = input.acceptanceCriteriaStatus;
	if (acceptance) {
		if (!acceptance.ok) {
			blockers.push(acceptance.blockers[0] ?? acceptance.message);
		}
		if (!acceptance.coverageComplete || acceptance.counts.missing > 0) {
			blockers.push(acceptance.blockers[0] ?? acceptance.summary);
		}
		if (acceptance.counts.failed > 0 || acceptance.counts.blocking > 0 && acceptance.blockers.length > 0) {
			blockers.push(acceptance.blockers[0] ?? acceptance.message);
		}
	}
	return blockers;
}

function planInteractionPending(input: VibeCodexDeliveryBarInput): readonly string[] {
	const pending: string[] = [];
	const status = input.planStatus;
	if (status?.ok && status.valid && status.approvalReady && (!status.approved || !status.mutationReady)) {
		pending.push('Visual plan is render-ready but the exact revision is not approved for mutation yet.');
	}
	const acceptance = input.acceptanceCriteriaStatus;
	if (acceptance?.ok && acceptance.coverageComplete && !acceptance.ready && acceptance.blockers.length === 0) {
		pending.push(acceptance.nextAction);
	}
	if (acceptance?.ok && acceptance.counts.running > 0) {
		pending.push('Acceptance criteria checks are still running.');
	}
	if (acceptance?.ok && acceptance.counts.pending > 0) {
		pending.push(acceptance.nextAction);
	}
	return pending;
}

function guidanceCheck(guidanceStatus: VibeCodexGuidanceStatusResponse | undefined, guidanceSelection: VibeCodexGuidanceSelectionResponse | undefined, slashCommandStatus: VibeCodexSlashCommandStatusResponse | undefined): VibeCodexDeliveryBarCheck {
	if (!guidanceStatus && !guidanceSelection && !slashCommandStatus) {
		return {
			id: 'guidance',
			title: 'Rules, skills, and workflows',
			required: false,
			status: 'skipped',
			detail: 'No Cline/Cursor/Codex guidance context has been requested for this task.',
		};
	}
	const documents = (guidanceStatus?.counts.rules ?? 0)
		+ (guidanceStatus?.counts.skills ?? 0)
		+ (guidanceStatus?.counts.memoryBankDocuments ?? 0)
		+ (guidanceStatus?.counts.customModes ?? 0);
	const hooks = guidanceStatus?.counts.hooks ?? 0;
	const selected = guidanceSelection?.counts.selected ?? 0;
	const workflows = slashCommandStatus?.counts.workflows ?? 0;
	const failed = guidanceStatus?.ok === false || guidanceSelection?.ok === false;
	const empty = !!guidanceStatus && documents + hooks === 0 && !selected && workflows === 0;
	const passed = !failed && !empty;
	return {
		id: 'guidance',
		title: 'Rules, skills, and workflows',
		required: true,
		status: passed ? 'passed' : failed ? 'failed' : 'pending',
		detail: passed
			? `${documents} guidance document${documents === 1 ? '' : 's'}, ${hooks} read-only hook manifest${hooks === 1 ? '' : 's'}, ${selected} selected item${selected === 1 ? '' : 's'}, and ${workflows} workflow slash command${workflows === 1 ? '' : 's'} are available before execution.`
			: 'Guidance context is requested but no rule, skill, hook, Memory Bank, custom mode, or workflow evidence is available yet.',
	};
}

function executionSafetyCheck(input: VibeCodexDeliveryBarInput): VibeCodexDeliveryBarCheck {
	if (!input.terminalCommandValidationStatus && !input.executionGateStatus && !input.safetyStatus && !input.workspaceSandboxStatus && !input.terminalControlStatus && !input.terminalRemediationStatus) {
		return {
			id: 'execution-safety',
			title: 'Execution safety',
			required: false,
			status: 'skipped',
			detail: 'No command validation, execution gate, safety, sandbox, terminal control, or remediation status has been requested yet.',
		};
	}
	const blockers = executionSafetyBlockers(input);
	const pending = executionSafetyPending(input);
	const ready = blockers.length === 0 && pending.length === 0;
	const evidenceCount = [
		input.terminalCommandValidationStatus,
		input.executionGateStatus,
		input.safetyStatus,
		input.workspaceSandboxStatus,
		input.terminalControlStatus,
		input.terminalRemediationStatus,
	].filter(Boolean).length;
	return {
		id: 'execution-safety',
		title: 'Execution safety',
		required: true,
		status: ready ? 'passed' : pending.length ? 'pending' : 'failed',
		detail: ready
			? `${evidenceCount} execution safety status${evidenceCount === 1 ? '' : 'es'} prove command validation, mutation routing, workspace sandboxing, terminal control, and remediation locks where present.`
			: [...blockers, ...pending].slice(0, 4).map(redactSensitiveText).join('; '),
	};
}

function executionSafetyBlockers(input: VibeCodexDeliveryBarInput): readonly string[] {
	const blockers: string[] = [];
	const command = input.terminalCommandValidationStatus;
	if (command) {
		if (!command.valid || command.policy.dangerous || command.policy.blocked || !command.workspace.cwdSafety.safe) {
			blockers.push(command.validationErrors[0] ?? command.policy.reason ?? command.workspace.cwdSafety.errors[0] ?? 'Terminal command candidate is not safe to approve.');
		}
		if (!command.approvalReady && !command.authorization.blocksExecution) {
			blockers.push(command.message);
		}
	}
	const gate = input.executionGateStatus;
	if (gate) {
		const routeReady = gate.route === 'request_user_approval' || gate.route === 'ready_for_mutation_request' || gate.route === 'submit_diff_review' || gate.route === 'await_diff_review' || gate.route === 'run_read_only_tool';
		if (!routeReady || gate.blocked || !gate.plan.valid) {
			blockers.push(gate.blockers[0] ?? gate.message);
		}
	}
	const safety = input.safetyStatus;
	if (safety) {
		if (safety.mode.readOnly) {
			blockers.push(`${safety.mode.label} Mode is read-only; switch to Act, Agent, Debug, or Custom before execution.`);
		}
		if (!safety.workspace.trusted) {
			blockers.push('Workspace is not trusted; execution and checkpoint automation are blocked.');
		}
		if (safety.workspace.writeSandbox !== 'workspace-roots-only' || !safety.workspace.pathTraversalBlocked || !safety.workspace.symlinkTraversalBlocked) {
			blockers.push('Workspace sandbox guardrails are incomplete.');
		}
	}
	const sandbox = input.workspaceSandboxStatus;
	if (sandbox) {
		if (!sandbox.workspaceTrusted || sandbox.counts.workspaceRoots === 0 || sandbox.counts.blockedPaths > 0 || !sandbox.ready) {
			blockers.push(sandbox.blockers[0] ?? sandbox.message);
		}
		if (!sandbox.guards.workspaceRootRequired || !sandbox.guards.rejectsParentTraversal || !sandbox.guards.rejectsUnsupportedSchemes || !sandbox.guards.rejectsIgnoredPaths || !sandbox.guards.symlinkTraversalCheckedOnMutation || !sandbox.guards.checkpointsBeforeWrites || !sandbox.guards.atomicDiffRollback) {
			blockers.push('Workspace sandbox guard contract is incomplete.');
		}
	}
	const control = input.terminalControlStatus;
	if (control && !control.ok) {
		blockers.push(control.message);
	}
	const remediation = input.terminalRemediationStatus;
	if (remediation && remediation.total > 0 && !remediation.ok) {
		blockers.push(remediation.message);
	}
	if (remediation?.mutationLocked) {
		blockers.push('Terminal remediation revised the visual plan; approve the exact updated revision before continuing execution.');
	}
	return blockers;
}

function executionSafetyPending(input: VibeCodexDeliveryBarInput): readonly string[] {
	const pending: string[] = [];
	const command = input.terminalCommandValidationStatus;
	if (command && command.valid && command.approvalReady && !command.executionReady) {
		pending.push(command.authorization.blocksExecution
			? 'Terminal command is approval-ready, but execution is waiting on exact visual-plan authorization.'
			: command.message);
	}
	const gate = input.executionGateStatus;
	if (gate) {
		if (!gate.plan.approved || !gate.plan.mutationReady || gate.route === 'approve_exact_plan' || gate.route === 'submit_visual_plan') {
			pending.push(gate.nextAction);
		} else if (gate.route === 'await_diff_review' && gate.pending.pendingDiffFiles > 0) {
			pending.push(gate.nextAction);
		}
	}
	const safety = input.safetyStatus;
	if (safety && (!safety.executionAuthorization.approved || !safety.executionAuthorization.activePlanMatches)) {
		pending.push('Safety status is waiting for the exact active visual plan revision approval.');
	}
	const remediation = input.terminalRemediationStatus;
	if (remediation && remediation.total > 0 && !remediation.authorizationMatchesActivePlan) {
		pending.push('Terminal remediation evidence is waiting for authorization to match the active plan revision.');
	}
	return pending;
}

function toolSurfaceCheck(input: VibeCodexDeliveryBarInput): VibeCodexDeliveryBarCheck {
	if (!input.browserStatus && !input.browserActionStatus && !input.previewStatus && !input.mcpStatus && !input.webFetchRequest && !input.toolTimelineStatus) {
		return {
			id: 'tool-surface',
			title: 'Tool surface',
			required: false,
			status: 'skipped',
			detail: 'No browser, preview, MCP, web fetch, or tool timeline status has been requested yet.',
		};
	}
	const blockers = toolSurfaceBlockers(input);
	const pending = toolSurfacePending(input);
	const ready = blockers.length === 0 && pending.length === 0;
	const evidenceCount = [
		input.browserStatus,
		input.browserActionStatus,
		input.previewStatus,
		input.mcpStatus,
		input.webFetchRequest,
		input.toolTimelineStatus,
	].filter(Boolean).length;
	return {
		id: 'tool-surface',
		title: 'Tool surface',
		required: true,
		status: ready ? 'passed' : blockers.length ? 'failed' : 'pending',
		detail: ready
			? `${evidenceCount} external tool status${evidenceCount === 1 ? '' : 'es'} prove browser, preview, MCP, web fetch, and timeline visibility with approval gates intact.`
			: [...blockers, ...pending].slice(0, 4).map(redactSensitiveText).join('; '),
	};
}

function toolSurfaceBlockers(input: VibeCodexDeliveryBarInput): readonly string[] {
	const blockers: string[] = [];
	const browser = input.browserStatus;
	if (browser) {
		if (!browser.approval.hasExecutionAuthorization) {
			blockers.push('Browser actions require the exact visual-plan authorization before execution.');
		}
		if (!browser.capabilities.safeUrlRequired || !browser.capabilities.loopbackPreviewPanel) {
			blockers.push('Browser capability guardrails are incomplete.');
		}
		if (browser.counts.nativeRequiredPendingActions > 0) {
			blockers.push('Pending browser actions require the bundled native browser controller.');
		}
	}
	const browserAction = input.browserActionStatus;
	if (browserAction) {
		if (!browserAction.capabilities.safeUrlRequired) {
			blockers.push('Browser action safety policy does not require safe URLs.');
		}
		if (browserAction.counts.blocked > 0) {
			blockers.push(`${browserAction.counts.blocked} browser action event${browserAction.counts.blocked === 1 ? '' : 's'} blocked.`);
		}
	}
	const preview = input.previewStatus;
	if (preview) {
		if (!preview.ok || !preview.available) {
			blockers.push(preview.message);
		}
		if (!preview.approval.hasExecutionAuthorization) {
			blockers.push('Preview start/open actions require exact visual-plan authorization.');
		}
	}
	const mcp = input.mcpStatus;
	if (mcp) {
		if (!mcp.ok || !mcp.available) {
			blockers.push(mcp.message);
		}
		if (!mcp.approval.hasExecutionAuthorization) {
			blockers.push('MCP tool/resource calls require exact visual-plan authorization.');
		}
		if (mcp.counts.requestedUnknownServers > 0) {
			blockers.push('Requested MCP server is unknown or global; mirror it into workspace MCP config first.');
		}
	}
	const webFetch = input.webFetchRequest;
	if (webFetch && (!webFetch.supported || webFetch.blocked)) {
		blockers.push(webFetch.detail || 'Web fetch request is blocked by URL safety policy.');
	}
	const timeline = input.toolTimelineStatus;
	if (timeline) {
		if (timeline.counts.blockedApprovals > 0) {
			blockers.push(`${timeline.counts.blockedApprovals} approval${timeline.counts.blockedApprovals === 1 ? '' : 's'} blocked in tool timeline.`);
		}
		if (timeline.counts.failed > 0) {
			blockers.push(`${timeline.counts.failed} tool timeline event${timeline.counts.failed === 1 ? '' : 's'} failed.`);
		}
	}
	return blockers;
}

function toolSurfacePending(input: VibeCodexDeliveryBarInput): readonly string[] {
	const pending: string[] = [];
	const browser = input.browserStatus;
	if (browser && browser.counts.supportedPendingActions > 0) {
		pending.push(`${browser.counts.supportedPendingActions} supported browser action${browser.counts.supportedPendingActions === 1 ? '' : 's'} awaiting visible approval.`);
	}
	const browserAction = input.browserActionStatus;
	if (browserAction && browserAction.counts.pendingActions > 0) {
		pending.push(browserAction.nextAction);
	}
	const preview = input.previewStatus;
	if (preview && preview.counts.pendingBrowserActions > 0) {
		pending.push(`${preview.counts.pendingBrowserActions} preview browser approval${preview.counts.pendingBrowserActions === 1 ? '' : 's'} pending.`);
	}
	const mcp = input.mcpStatus;
	if (mcp && mcp.counts.pendingActions > 0) {
		pending.push(`${mcp.counts.pendingActions} MCP approval${mcp.counts.pendingActions === 1 ? '' : 's'} pending.`);
	}
	const timeline = input.toolTimelineStatus;
	if (timeline) {
		if (timeline.counts.approvals > 0) {
			pending.push(`${timeline.counts.approvals} pending approval${timeline.counts.approvals === 1 ? '' : 's'} visible in tool timeline.`);
		}
		if (timeline.counts.runningTerminalRuns > 0) {
			pending.push(`${timeline.counts.runningTerminalRuns} terminal run${timeline.counts.runningTerminalRuns === 1 ? '' : 's'} still running.`);
		}
		if (timeline.counts.pendingDiffFiles > 0) {
			pending.push(`${timeline.counts.pendingDiffFiles} diff file${timeline.counts.pendingDiffFiles === 1 ? '' : 's'} pending review.`);
		}
	}
	return pending;
}

function verificationCheck(plan: VibeCodexVerificationPlan | undefined): VibeCodexDeliveryBarCheck {
	if (!plan) {
		return {
			id: 'verification',
			title: 'Verification checks',
			required: true,
			status: 'pending',
			detail: 'No verification gate has been generated yet.',
		};
	}
	const required = plan.checks.filter(check => check.required);
	const failed = required.filter(check => check.status === 'failed');
	const running = required.filter(check => check.status === 'running');
	const pending = required.filter(check => check.status === 'pending');
	const skipped = required.filter(check => check.status === 'skipped');
	const status: VibeCodexDeliveryBarStatus = failed.length ? 'failed' : running.length || pending.length ? 'pending' : 'passed';
	return {
		id: 'verification',
		title: 'Verification checks',
		required: true,
		status,
		detail: `${required.length} required check${required.length === 1 ? '' : 's'}; ${failed.length} failed, ${running.length} running, ${pending.length} pending, ${skipped.length} skipped.`,
	};
}

function diagnosticsCheck(snapshot: VibeCodexDiagnosticsSnapshot | undefined, baseline: VibeCodexDiagnosticsBaselineLike | undefined): VibeCodexDeliveryBarCheck {
	if (!snapshot || !baseline) {
		return {
			id: 'diagnostics',
			title: 'Diagnostics evidence',
			required: true,
			status: 'pending',
			detail: 'No post-run diagnostics evidence has been captured yet.',
		};
	}
	const failed = snapshot.errors > baseline.error;
	return {
		id: 'diagnostics',
		title: 'Diagnostics evidence',
		required: true,
		status: failed ? 'failed' : 'passed',
		detail: `${snapshot.errors} error${snapshot.errors === 1 ? '' : 's'} after run vs ${baseline.error} at plan time; ${snapshot.warnings} warning${snapshot.warnings === 1 ? '' : 's'}.`,
	};
}

function diffReviewCheck(review: ExternalDiffReview | undefined): VibeCodexDeliveryBarCheck {
	if (!review) {
		return {
			id: 'diff-review',
			title: 'Diff confirmation',
			required: true,
			status: 'pending',
			detail: 'No diff review has been received yet.',
		};
	}
	const pending = review.files.filter(file => file.status === 'pending');
	const accepted = review.files.filter(file => file.status === 'accepted');
	const rejected = review.files.filter(file => file.status === 'rejected');
	return {
		id: 'diff-review',
		title: 'Diff confirmation',
		required: true,
		status: pending.length ? 'pending' : 'passed',
		detail: `${review.files.length} file${review.files.length === 1 ? '' : 's'}; ${accepted.length} accepted, ${rejected.length} rejected, ${pending.length} pending.`,
	};
}

function diffProtocolCheck(validation: VibeCodexDiffValidationResponse | undefined, fileStatus: VibeCodexDiffFileStatusResponse | undefined, reapplyStatus: VibeCodexDiffReapplyStatusResponse | undefined): VibeCodexDeliveryBarCheck {
	if (!validation && !fileStatus && !reapplyStatus) {
		return {
			id: 'diff-protocol',
			title: 'Atomic diff protocol',
			required: false,
			status: 'skipped',
			detail: 'No diff validation, focused file status, or reapply readiness has been requested yet.',
		};
	}
	const validationReady = validation ? validation.reviewReady && validation.valid && validation.counts.invalidFiles === 0 && validation.counts.duplicatePaths === 0 : true;
	const fileReady = fileStatus ? fileStatus.ok && fileStatus.found && !!fileStatus.file && fileStatus.file.actions.canOpenDiff && fileStatus.file.actions.requiresPlanApprovalForAccept : true;
	const reapplyReady = reapplyStatus ? reapplyStatus.reapplyReady && (reapplyStatus.route === 'replace_pending_review_file' || reapplyStatus.route === 'submit_new_review' || reapplyStatus.route === 'submit_revised_review_file') : true;
	const blockers = [
		validationReady ? undefined : validation?.validationErrors[0] ?? 'Candidate diff payload is not review-ready.',
		fileReady ? undefined : fileStatus?.message ?? 'Focused diff file status is unavailable.',
		reapplyReady ? undefined : reapplyStatus?.blockers[0] ?? 'Diff reapply route is not ready.',
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const ready = blockers.length === 0;
	return {
		id: 'diff-protocol',
		title: 'Atomic diff protocol',
		required: true,
		status: ready ? 'passed' : 'failed',
		detail: ready
			? `${validation?.counts.files ?? 0} candidate file${validation?.counts.files === 1 ? '' : 's'} validated, focused diff file is reviewable, and ${reapplyStatus ? `reapply route ${reapplyStatus.route}` : 'normal review route'} is safe.`
			: blockers.slice(0, 3).join('; '),
	};
}

function checkpointCheck(review: ExternalDiffReview | undefined, taskCheckpointId: string | undefined, fileCheckpointCount: number, fileCheckpointPaths: readonly string[] | undefined): VibeCodexDeliveryBarCheck {
	const acceptedFiles = review?.files.filter(file => file.status === 'accepted') ?? [];
	if (!acceptedFiles.length) {
		return {
			id: 'rollback',
			title: 'Rollback checkpoint',
			required: false,
			status: 'skipped',
			detail: 'No accepted diff files require rollback checkpoints yet.',
		};
	}
	const checkpointPathSet = fileCheckpointPaths ? new Set(fileCheckpointPaths.map(normalizePath)) : undefined;
	const missingCheckpointPaths = checkpointPathSet
		? acceptedFiles
			.filter(file => !checkpointPathSet.has(normalizePath(file.path)))
			.map(file => redactSensitiveText(file.path))
		: [];
	const countCoversAccepted = fileCheckpointCount >= acceptedFiles.length;
	const pathCoverageReady = checkpointPathSet ? missingCheckpointPaths.length === 0 : countCoversAccepted;
	const passed = !!taskCheckpointId && countCoversAccepted && pathCoverageReady;
	return {
		id: 'rollback',
		title: 'Rollback checkpoint',
		required: true,
		status: passed ? 'passed' : 'failed',
		detail: passed
			? `${taskCheckpointId} covers ${fileCheckpointCount} accepted file checkpoint${fileCheckpointCount === 1 ? '' : 's'} with path-accurate rollback coverage.`
			: missingCheckpointPaths.length
				? `Accepted files missing checkpoint coverage: ${missingCheckpointPaths.join(', ')}.`
				: `${acceptedFiles.length} accepted file${acceptedFiles.length === 1 ? '' : 's'} need checkpoint coverage.`,
	};
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\.\/+/, '').toLowerCase();
}

function parallelCheck(plan: VibeCodexParallelPlan | undefined, review: VibeCodexParallelReview | undefined, mergeRequest: VibeCodexParallelMergeRequest | undefined, hasExecutionAuthorization: boolean): VibeCodexDeliveryBarCheck {
	if (!plan || plan.requestedThreads <= 1) {
		return {
			id: 'parallel',
			title: 'Parallel merge readiness',
			required: false,
			status: 'skipped',
			detail: 'Single-lane task does not require parallel merge review.',
		};
	}
	if (!review) {
		return {
			id: 'parallel',
			title: 'Parallel merge readiness',
			required: true,
			status: 'pending',
			detail: `${plan.requestedThreads} lanes requested; waiting for judge review.`,
		};
	}
	if (!review.mergeReady) {
		return {
			id: 'parallel',
			title: 'Parallel merge readiness',
			required: true,
			status: review.blockers.length ? 'failed' : 'pending',
			detail: review.blockers.slice(0, 4).join('; ') || 'Waiting for completed parallel results.',
		};
	}
	if (!hasExecutionAuthorization) {
		return {
			id: 'parallel',
			title: 'Parallel merge readiness',
			required: true,
			status: 'pending',
			detail: `Recommended lane ${review.recommendedThreadId} is ready; approve the exact visual plan before merge-back can be selected.`,
		};
	}
	if (!mergeRequest) {
		return {
			id: 'parallel',
			title: 'Parallel merge readiness',
			required: true,
			status: 'pending',
			detail: `Recommended lane ${review.recommendedThreadId} is ready; request merge-back so the backend returns a normal diff review.`,
		};
	}
	const selectedRecommended = mergeRequest.threadId === review.recommendedThreadId;
	const ready = mergeRequest.mergeReady && selectedRecommended;
	return {
		id: 'parallel',
		title: 'Parallel merge readiness',
		required: true,
		status: ready ? 'passed' : mergeRequest.blockers.length || !selectedRecommended ? 'failed' : 'pending',
		detail: ready
			? `Selected recommended lane ${mergeRequest.threadId} for merge-back; waiting for backend diff review before workspace merge.`
			: mergeRequest.blockers.slice(0, 4).join('; ') || `Selected lane ${mergeRequest.threadId} does not match recommended lane ${review.recommendedThreadId}.`,
	};
}

function completionHandoffCheck(commitHandoff: VibeCodexCommitHandoffStatusResponse | undefined, autoCommit: VibeCodexAutoCommitStatusResponse | undefined, completion: VibeCodexTaskCompletionStatusResponse | undefined): VibeCodexDeliveryBarCheck {
	if (!commitHandoff && !autoCommit && !completion) {
		return {
			id: 'completion-handoff',
			title: 'Completion handoff',
			required: false,
			status: 'skipped',
			detail: 'No commit handoff, auto-commit policy, or task completion status has been requested yet.',
		};
	}
	const commitReady = commitHandoff ? commitHandoff.ready && commitHandoff.counts.acceptedFiles > 0 && commitHandoff.counts.blockers === 0 : false;
	const autoReady = autoCommit ? autoCommit.ready || !autoCommit.enabled : true;
	const completionReady = completion ? (completion.ready && completion.gate.ready && completion.gate.decision === 'pass') || (completion.accepted && completion.state === 'accepted') : false;
	const blockers = [
		commitReady ? undefined : commitHandoff?.blockers[0] ?? 'Commit handoff is not ready.',
		autoReady ? undefined : autoCommit?.blockers[0] ?? 'Auto-commit policy is not ready.',
		completionReady ? undefined : completion?.blockers?.[0] ?? completion?.nextAction ?? 'Task completion gate is not ready.',
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const pending = [
		commitHandoff && !commitReady && commitHandoff.blockers.length === 0 ? commitHandoff.nextAction : undefined,
		autoCommit && !autoReady && autoCommit.blockers.length === 0 ? autoCommit.nextAction : undefined,
		completion && !completionReady && completion.gate.pending > 0 ? completion.nextAction : undefined,
	].filter((item): item is string => !!item).map(redactSensitiveText);
	const ready = blockers.length === 0 && pending.length === 0;
	return {
		id: 'completion-handoff',
		title: 'Completion handoff',
		required: true,
		status: ready ? 'passed' : blockers.length ? 'failed' : 'pending',
		detail: ready
			? `${commitHandoff?.counts.acceptedFiles ?? 0} accepted file${commitHandoff?.counts.acceptedFiles === 1 ? '' : 's'} ready for commit handoff; auto-commit ${autoCommit?.enabled ? 'ready' : 'disabled/safe'}; task completion ${completion?.state ?? 'ready'}.`
			: [...blockers, ...pending].slice(0, 4).join('; '),
	};
}
