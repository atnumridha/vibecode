/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexAutoApproveConfig } from './autoApprove';
import type { VibeCodexCommandPermissionPolicy } from './commandPermissions';
import { authorizationMatchesPlan, executionAuthorizationSummary, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexModePolicy } from './modePolicy';
import type { VibeCodexPlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexSafetyStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includePolicies: boolean;
	readonly includePendingDetails: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexSafetyPendingCounts {
	readonly approvals: number;
	readonly browserActions: number;
	readonly mcpActions: number;
	readonly webFetches: number;
	readonly hookActions: number;
	readonly userInputRequests: number;
	readonly diffFiles: number;
}

export interface VibeCodexSafetyPendingItem {
	readonly id: string;
	readonly kind: string;
	readonly title: string;
	readonly risk?: string;
	readonly blocked?: boolean;
}

export interface VibeCodexSafetyWorkspaceStatus {
	readonly trusted: boolean;
	readonly roots: readonly string[];
	readonly writeSandbox: 'workspace-roots-only';
	readonly shellFreeGit: boolean;
	readonly pathTraversalBlocked: boolean;
	readonly symlinkTraversalBlocked: boolean;
}

export interface VibeCodexSafetyStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly mode: {
		readonly mode: string;
		readonly label: string;
		readonly readOnly: boolean;
		readonly requiresVisualPlan: boolean;
		readonly requiresPlanApproval: boolean;
		readonly allowedActions: readonly string[];
		readonly blockedActions: readonly string[];
	};
	readonly executionAuthorization: {
		readonly approved: boolean;
		readonly summary: string;
		readonly taskId?: string;
		readonly revision?: number;
		readonly planHash?: string;
		readonly activePlanMatches: boolean;
	};
	readonly commandPermissions: {
		readonly defaultAllow: boolean;
		readonly allowRuleCount: number;
		readonly denyRuleCount: number;
		readonly sources: readonly string[];
		readonly allow?: readonly string[];
		readonly deny?: readonly string[];
		readonly summary: string;
	};
	readonly autoApprove: {
		readonly enabled: boolean;
		readonly maxRisk: string;
		readonly targets: readonly string[];
		readonly summary: string;
	};
	readonly workspace: VibeCodexSafetyWorkspaceStatus;
	readonly pending: VibeCodexSafetyPendingCounts;
	readonly pendingDetails?: readonly VibeCodexSafetyPendingItem[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexSafetyStatusInput {
	readonly modePolicy: VibeCodexModePolicy;
	readonly commandPermissionPolicy: VibeCodexCommandPermissionPolicy;
	readonly autoApproveConfig: VibeCodexAutoApproveConfig;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly activePlan?: VibeCodexPlan;
	readonly workspaceTrusted: boolean;
	readonly workspaceRoots: readonly string[];
	readonly pending: VibeCodexSafetyPendingCounts;
	readonly pendingDetails?: readonly VibeCodexSafetyPendingItem[];
}

const safetyStatusMethods = new Set([
	'agent/getSafetyStatus',
	'agent/safetyStatus',
	'safety/status',
	'permissions/status',
	'sandbox/status',
	'vibecodex/safetyStatus',
]);

const safetyStatusToolNames = new Set([
	'safety_status',
	'get_safety_status',
	'permission_status',
	'permissions_status',
	'command_permissions_status',
	'sandbox_status',
]);

export function normalizeSafetyStatusRequest(message: JsonRpcMessage): VibeCodexSafetyStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!safetyStatusMethods.has(message.method) && !isSafetyStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includePolicies: booleanValue(payload.includePolicies)
			?? booleanValue(payload.include_policies)
			?? booleanValue(args.includePolicies)
			?? booleanValue(args.include_policies)
			?? false,
		includePendingDetails: booleanValue(payload.includePendingDetails)
			?? booleanValue(payload.include_pending_details)
			?? booleanValue(args.includePendingDetails)
			?? booleanValue(args.include_pending_details)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createSafetyStatusResponse(request: VibeCodexSafetyStatusRequest, input: VibeCodexSafetyStatusInput): VibeCodexSafetyStatusResponse {
	const approved = !!input.authorization;
	const activePlanMatches = authorizationMatchesPlan(input.authorization, input.activePlan);
	return {
		ok: true,
		source: 'externalExtension',
		mode: {
			mode: input.modePolicy.mode,
			label: input.modePolicy.label,
			readOnly: input.modePolicy.readOnly,
			requiresVisualPlan: input.modePolicy.requiresVisualPlan,
			requiresPlanApproval: input.modePolicy.requiresPlanApproval,
			allowedActions: input.modePolicy.allowedActions,
			blockedActions: input.modePolicy.blockedActions,
		},
		executionAuthorization: {
			approved,
			summary: executionAuthorizationSummary(input.authorization),
			...(input.authorization ? { taskId: input.authorization.taskId, revision: input.authorization.revision, planHash: input.authorization.planHash } : {}),
			activePlanMatches,
		},
		commandPermissions: {
			defaultAllow: input.commandPermissionPolicy.defaultAllow,
			allowRuleCount: input.commandPermissionPolicy.allow.length,
			denyRuleCount: input.commandPermissionPolicy.deny.length,
			sources: redactSensitiveValue(input.commandPermissionPolicy.sources) as readonly string[],
			...(request.includePolicies ? { allow: redactSensitiveValue(input.commandPermissionPolicy.allow) as readonly string[], deny: redactSensitiveValue(input.commandPermissionPolicy.deny) as readonly string[] } : {}),
			summary: commandPermissionSummaryLocal(input.commandPermissionPolicy),
		},
		autoApprove: {
			enabled: input.autoApproveConfig.enabled,
			maxRisk: input.autoApproveConfig.maxRisk,
			targets: autoApproveTargets(input.autoApproveConfig),
			summary: autoApproveSummaryLocal(input.autoApproveConfig),
		},
		workspace: {
			trusted: input.workspaceTrusted,
			roots: input.workspaceRoots.map(root => redactSensitiveText(root)),
			writeSandbox: 'workspace-roots-only',
			shellFreeGit: true,
			pathTraversalBlocked: true,
			symlinkTraversalBlocked: true,
		},
		pending: input.pending,
		...(request.includePendingDetails ? { pendingDetails: redactSensitiveValue(input.pendingDetails ?? []) as readonly VibeCodexSafetyPendingItem[] } : {}),
		guardrails: [
			'Read-only modes block terminal, file, tool, browser, MCP, and diff-acceptance requests.',
			'Mutating requests require the exact approved visual plan revision.',
			'Terminal commands must pass built-in dangerous command checks and allow/deny policy.',
			'Workspace writes, deletes, diffs, checkpoints, and parallel worktrees are constrained to trusted workspace roots.',
			'Workspace file reads, diff preview/apply, deletes, and checkpoint restores reject symlink traversal inside workspace roots.',
			'Auto-approve is disabled by default and never bypasses plan authorization or blocked requests.',
			'This safety status response never exposes raw approval tokens, API keys, command output secrets, or file contents.',
		],
		message: `Safety status: ${input.modePolicy.label} Mode, ${approved ? 'approved plan available' : 'no approved plan'}, ${input.commandPermissionPolicy.deny.length} deny rule${input.commandPermissionPolicy.deny.length === 1 ? '' : 's'}, auto-approve ${input.autoApproveConfig.enabled ? 'enabled' : 'disabled'}.`,
	};
}

export function safetyStatusSummary(response: VibeCodexSafetyStatusResponse): string {
	return `${response.message} Pending approvals: ${response.pending.approvals}; pending diffs: ${response.pending.diffFiles}; workspace trusted: ${response.workspace.trusted ? 'yes' : 'no'}.`;
}

function autoApproveTargets(config: VibeCodexAutoApproveConfig): readonly string[] {
	return [
		config.terminal ? 'terminal' : undefined,
		config.file ? 'file' : undefined,
		config.tool ? 'tool' : undefined,
		config.generic ? 'generic' : undefined,
		config.mcp ? 'mcp' : undefined,
		config.browser ? 'browser' : undefined,
	].filter((value): value is string => !!value);
}

function autoApproveSummaryLocal(config: VibeCodexAutoApproveConfig): string {
	const targets = autoApproveTargets(config);
	return `${config.enabled ? 'Enabled' : 'Disabled'}; max risk ${config.maxRisk}; ${targets.length ? targets.join(', ') : 'no targets enabled'}.`;
}

function commandPermissionSummaryLocal(policy: VibeCodexCommandPermissionPolicy): string {
	const sources = policy.sources.map(source => redactSensitiveText(source));
	return [
		`Terminal commands are ${policy.defaultAllow ? 'allowed by default' : 'blocked by default'}.`,
		`${policy.allow.length} allow rule${policy.allow.length === 1 ? '' : 's'}.`,
		`${policy.deny.length} deny rule${policy.deny.length === 1 ? '' : 's'}.`,
		sources.length ? `Sources: ${sources.join(', ')}.` : 'Sources: built-in defaults only.',
	].join(' ');
}

function isSafetyStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return safetyStatusToolNames.has(tool);
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
