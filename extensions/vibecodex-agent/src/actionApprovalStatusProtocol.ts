/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VibeCodexAutoApproveConfig, autoApproveSummary, shouldAutoApproveApproval, shouldAutoApproveBrowser, shouldAutoApproveMcp } from './autoApprove';
import type { VibeCodexCommandPermissionPolicy } from './commandPermissions';
import { authorizationMatchesPlan, executionAuthorizationSummary, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { modeAllowsAction, type VibeCodexModePolicy, type VibeCodexSensitiveAction } from './modePolicy';
import type { VibeCodexPlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import { createTerminalCommandValidationResponse, type VibeCodexTerminalCommandValidationResponse } from './terminalCommandValidationProtocol';
import type { VibeCodexToolCatalog } from './toolCatalog';
import { createToolCallStatusResponse, type VibeCodexToolCallStatusResponse } from './toolCallStatusProtocol';

export type VibeCodexActionApprovalKind = 'terminal' | 'file' | 'tool' | 'browser' | 'mcp' | 'web' | 'diff' | 'generic';
export type VibeCodexActionApprovalRoute =
	| 'call_read_only'
	| 'auto_approve'
	| 'prompt_user'
	| 'approve_plan_first'
	| 'switch_mode'
	| 'repair_request'
	| 'blocked';
export type VibeCodexActionApprovalRisk = 'low' | 'medium' | 'high' | 'blocked';

export interface VibeCodexActionApprovalStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: VibeCodexActionApprovalKind;
	readonly toolName?: string;
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly risk?: VibeCodexActionApprovalRisk;
	readonly candidateBlocked: boolean;
	readonly arguments: Record<string, unknown>;
	readonly includeToolCall: boolean;
	readonly includeTerminalValidation: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexActionApprovalStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly route: VibeCodexActionApprovalRoute;
	readonly ready: boolean;
	readonly canPrompt: boolean;
	readonly canAutoApprove: boolean;
	readonly kind: VibeCodexActionApprovalKind;
	readonly risk: VibeCodexActionApprovalRisk;
	readonly request: {
		readonly toolName?: string;
		readonly commandLine?: string;
		readonly cwd?: string;
		readonly reason?: string;
	};
	readonly mode: {
		readonly mode: string;
		readonly label: string;
		readonly readOnly: boolean;
		readonly action: VibeCodexSensitiveAction;
		readonly allowed: boolean;
		readonly blockReason?: string;
	};
	readonly authorization: {
		readonly approved: boolean;
		readonly activePlanMatches: boolean;
		readonly summary: string;
		readonly requiredBeforeMutation: boolean;
	};
	readonly autoApprove: {
		readonly enabled: boolean;
		readonly target: string;
		readonly eligible: boolean;
		readonly approved: boolean;
		readonly reason: string;
		readonly summary: string;
	};
	readonly toolCall?: VibeCodexToolCallStatusResponse;
	readonly terminalValidation?: VibeCodexTerminalCommandValidationResponse;
	readonly blockers: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexActionApprovalStatusInput {
	readonly modePolicy: VibeCodexModePolicy;
	readonly autoApproveConfig: VibeCodexAutoApproveConfig;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly activePlan?: VibeCodexPlan;
	readonly toolCatalog?: VibeCodexToolCatalog;
	readonly commandPermissionPolicy?: VibeCodexCommandPermissionPolicy;
	readonly workspaceTrusted?: boolean;
	readonly workspaceRoots?: readonly string[];
	readonly verificationCheckIds?: readonly string[];
}

const actionApprovalStatusMethods = new Set([
	'agent/getActionApprovalStatus',
	'agent/actionApprovalStatus',
	'action/approvalStatus',
	'approval/actionStatus',
	'approval/routeStatus',
	'autoApprove/status',
	'cline/actionStatus',
	'vibecodex/actionApprovalStatus',
]);

const actionApprovalStatusToolNames = new Set([
	'action_approval_status',
	'auto_approve_status',
	'autoapproval_status',
	'approval_route_status',
	'yolo_status',
	'cline_action_status',
]);

const terminalToolNames = new Set(['execute_command', 'terminal', 'bash', 'shell', 'run_command', 'run_commands', 'run_in_terminal']);
const fileToolNames = new Set(['write_file', 'write_to_file', 'edit_file', 'replace_in_file', 'apply_patch', 'patch_file', 'remove_file', 'delete_file']);
const browserToolNames = new Set(['browser_action', 'browser_open', 'open_browser', 'navigate_browser', 'browser_navigate']);
const mcpToolNames = new Set(['use_mcp_tool', 'access_mcp_resource', 'mcp_call', 'mcp_tool']);
const webToolNames = new Set(['fetch_web_content', 'web_fetch', 'web_search', 'search_web']);
const diffToolNames = new Set(['accept_diff', 'reject_diff', 'accept_file', 'reject_file', 'diff_accept', 'diff_reject']);

export function normalizeActionApprovalStatusRequest(message: JsonRpcMessage): VibeCodexActionApprovalStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const directParams = parseMaybeJson(message.params);
	const payload = isRecord(directParams) ? directParams : {};
	const args = argumentRecord(payload);
	if (!actionApprovalStatusMethods.has(message.method) && !isActionApprovalStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const toolName = stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(payload.targetTool)
		?? stringValue(payload.target_tool)
		?? stringValue(payload.actionTool)
		?? stringValue(payload.action_tool)
		?? stringValue(args.targetTool)
		?? stringValue(args.target_tool)
		?? stringValue(args.actionTool)
		?? stringValue(args.action_tool)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name);
	const commandLine = extractCommandLine(directParams, payload, args);
	const kind = normalizeKind(stringValue(payload.kind)
		?? stringValue(payload.actionKind)
		?? stringValue(payload.action_kind)
		?? stringValue(args.kind)
		?? stringValue(args.actionKind)
		?? stringValue(args.action_kind), toolName, commandLine);
	const cwd = stringValue(payload.cwd)
		?? stringValue(payload.workingDirectory)
		?? stringValue(payload.working_directory)
		?? stringValue(args.cwd)
		?? stringValue(args.workingDirectory)
		?? stringValue(args.working_directory);
	const reason = stringValue(payload.reason)
		?? stringValue(payload.description)
		?? stringValue(args.reason)
		?? stringValue(args.description);
	const risk = normalizeRisk(stringValue(payload.risk) ?? stringValue(args.risk));
	const candidateBlocked = booleanValue(payload.blocked)
		?? booleanValue(payload.candidateBlocked)
		?? booleanValue(payload.candidate_blocked)
		?? booleanValue(args.blocked)
		?? booleanValue(args.candidateBlocked)
		?? booleanValue(args.candidate_blocked)
		?? false;
	return {
		id: message.id,
		method: message.method,
		kind,
		...(toolName ? { toolName: redactSensitiveText(toolName) } : {}),
		...(commandLine ? { commandLine } : {}),
		...(cwd ? { cwd } : {}),
		...(reason ? { reason } : {}),
		...(risk ? { risk } : {}),
		candidateBlocked,
		arguments: redactSensitiveValue(extractCandidateArguments(payload, args)) as Record<string, unknown>,
		includeToolCall: booleanValue(payload.includeToolCall)
			?? booleanValue(payload.include_tool_call)
			?? booleanValue(args.includeToolCall)
			?? booleanValue(args.include_tool_call)
			?? true,
		includeTerminalValidation: booleanValue(payload.includeTerminalValidation)
			?? booleanValue(payload.include_terminal_validation)
			?? booleanValue(args.includeTerminalValidation)
			?? booleanValue(args.include_terminal_validation)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createActionApprovalStatusResponse(request: VibeCodexActionApprovalStatusRequest, input: VibeCodexActionApprovalStatusInput): VibeCodexActionApprovalStatusResponse {
	const activePlanMatches = authorizationMatchesPlan(input.authorization, input.activePlan);
	const action = sensitiveActionForKind(request.kind);
	const modeAllowed = modeAllowsAction(input.modePolicy, action);
	const modeBlockReason = modeAllowed ? undefined : `${input.modePolicy.label} Mode blocks ${action} requests.`;
	const toolCall = request.toolName ? createToolCallStatusResponse({
		id: request.id,
		method: request.method,
		toolName: request.toolName,
		arguments: request.arguments,
		includeSchema: request.includeToolCall,
		includeRepairHints: true,
		requestedAt: request.requestedAt,
	}, {
		toolCatalog: input.toolCatalog,
		hasExecutionAuthorization: activePlanMatches,
	}) : undefined;
	const terminalValidation = request.kind === 'terminal' && request.commandLine ? createTerminalCommandValidationResponse({
		id: request.id,
		method: request.method,
		commandLine: request.commandLine,
		commandPresent: true,
		...(request.cwd ? { cwd: request.cwd } : {}),
		...(request.reason ? { reason: request.reason } : {}),
		includeCommand: true,
		includeRepairHints: true,
		requestedAt: request.requestedAt,
	}, {
		modePolicy: input.modePolicy,
		commandPermissionPolicy: input.commandPermissionPolicy,
		hasExecutionAuthorization: activePlanMatches,
		workspaceTrusted: input.workspaceTrusted,
		workspaceRoots: input.workspaceRoots,
		verificationCheckIds: input.verificationCheckIds,
	}) : undefined;
	const risk = effectiveRisk(request, toolCall, terminalValidation);
	const autoDecision = autoApproveDecision(request, input.autoApproveConfig, activePlanMatches, risk);
	const route = determineRoute({
		request,
		toolCall,
		terminalValidation,
		modeAllowed,
		activePlanMatches,
		autoApproved: autoDecision.approve,
		risk,
	});
	const blockers = actionApprovalBlockers({
		request,
		toolCall,
		terminalValidation,
		modeBlockReason,
		activePlanMatches,
		route,
		autoDecisionReason: autoDecision.reason,
	});
	const ready = route === 'call_read_only' || route === 'auto_approve' || route === 'prompt_user';
	const responseWithoutPrompt = {
		ok: route !== 'repair_request' && route !== 'blocked',
		source: 'externalExtension' as const,
		version: 1 as const,
		route,
		ready,
		canPrompt: route === 'prompt_user',
		canAutoApprove: route === 'auto_approve',
		kind: request.kind,
		risk,
		request: {
			...(request.toolName ? { toolName: redactSensitiveText(request.toolName) } : {}),
			...(request.commandLine ? { commandLine: redactSensitiveText(request.commandLine) } : {}),
			...(request.cwd ? { cwd: redactSensitiveText(request.cwd) } : {}),
			...(request.reason ? { reason: redactSensitiveText(request.reason) } : {}),
		},
		mode: {
			mode: input.modePolicy.mode,
			label: input.modePolicy.label,
			readOnly: input.modePolicy.readOnly,
			action,
			allowed: modeAllowed,
			...(modeBlockReason ? { blockReason: modeBlockReason } : {}),
		},
		authorization: {
			approved: !!input.authorization,
			activePlanMatches,
			summary: executionAuthorizationSummary(input.authorization),
			requiredBeforeMutation: input.modePolicy.requiresPlanApproval,
		},
		autoApprove: {
			enabled: input.autoApproveConfig.enabled,
			target: autoApproveTargetForKind(request.kind),
			eligible: autoDecision.reason !== 'Diff review decisions are always explicit developer actions.',
			approved: autoDecision.approve,
			reason: redactSensitiveText(autoDecision.reason),
			summary: autoApproveSummary(input.autoApproveConfig),
		},
		...(request.includeToolCall && toolCall ? { toolCall } : {}),
		...(request.includeTerminalValidation && terminalValidation ? { terminalValidation } : {}),
		blockers,
		nextAction: nextActionForRoute(route, blockers),
		guardrails: actionApprovalGuardrails,
		message: actionApprovalMessage(route, request.kind, risk, blockers),
	};
	return {
		...responseWithoutPrompt,
		...(request.includePromptBlock ? { promptBlock: actionApprovalPromptBlock(responseWithoutPrompt) } : {}),
	} as VibeCodexActionApprovalStatusResponse;
}

export function actionApprovalStatusSummary(response: VibeCodexActionApprovalStatusResponse): string {
	return `${response.message} Next: ${response.nextAction}`;
}

const actionApprovalGuardrails = [
	'Action approval status is read-only and never accepts approvals, auto-approves requests, runs tools, opens browsers, calls MCP, accepts diffs, approves plans, or mutates workspace files.',
	'Auto-approve readiness is advisory; concrete execution still flows through the normal bridge response path with exact visual-plan authorization and visible policy enforcement.',
	'Plan, Ask, Manual, and Review modes remain read-only even when auto-approve is enabled.',
	'Diff accept/reject decisions are never auto-approved by this route status and must stay explicit developer actions.',
	'Tool names, command lines, cwd values, reasons, arguments, blockers, and prompt blocks are redacted before returning to the backend.',
];

function determineRoute(input: {
	readonly request: VibeCodexActionApprovalStatusRequest;
	readonly toolCall?: VibeCodexToolCallStatusResponse;
	readonly terminalValidation?: VibeCodexTerminalCommandValidationResponse;
	readonly modeAllowed: boolean;
	readonly activePlanMatches: boolean;
	readonly autoApproved: boolean;
	readonly risk: VibeCodexActionApprovalRisk;
}): VibeCodexActionApprovalRoute {
	if (input.toolCall?.route === 'call_read_only_tool') {
		return 'call_read_only';
	}
	const terminalHardBlocked = !!input.terminalValidation?.blocked && !input.terminalValidation.authorization.blocksExecution;
	if (input.request.candidateBlocked || input.risk === 'blocked' || terminalHardBlocked || input.toolCall?.route === 'unknown_tool') {
		return input.toolCall?.route === 'unknown_tool' ? 'repair_request' : 'blocked';
	}
	if (input.toolCall && (!input.toolCall.matched || !input.toolCall.validation.valid || input.toolCall.route === 'repair_arguments')) {
		return 'repair_request';
	}
	if (input.terminalValidation && (!input.terminalValidation.valid || !input.terminalValidation.approvalReady)) {
		return input.terminalValidation.mode.terminalAllowed ? 'blocked' : 'switch_mode';
	}
	if (!input.modeAllowed) {
		return 'switch_mode';
	}
	if (input.request.kind === 'diff') {
		return 'prompt_user';
	}
	if (!input.activePlanMatches) {
		return 'approve_plan_first';
	}
	if (input.autoApproved) {
		return 'auto_approve';
	}
	return 'prompt_user';
}

function actionApprovalBlockers(input: {
	readonly request: VibeCodexActionApprovalStatusRequest;
	readonly toolCall?: VibeCodexToolCallStatusResponse;
	readonly terminalValidation?: VibeCodexTerminalCommandValidationResponse;
	readonly modeBlockReason?: string;
	readonly activePlanMatches: boolean;
	readonly route: VibeCodexActionApprovalRoute;
	readonly autoDecisionReason: string;
}): readonly string[] {
	const blockers = [
		input.request.candidateBlocked ? 'Candidate request was marked blocked by the caller.' : undefined,
		input.modeBlockReason,
		!input.activePlanMatches && input.route === 'approve_plan_first' ? 'Exact visual plan revision is not approved or no longer matches the active plan.' : undefined,
		input.toolCall && (!input.toolCall.matched || !input.toolCall.validation.valid || input.toolCall.route === 'unknown_tool' || input.toolCall.route === 'repair_arguments') ? input.toolCall.message : undefined,
		input.terminalValidation && (!input.terminalValidation.valid || !input.terminalValidation.approvalReady) ? input.terminalValidation.message : undefined,
		input.route === 'prompt_user' && input.autoDecisionReason ? input.autoDecisionReason : undefined,
	];
	return blockers.filter((value): value is string => !!value).map(redactSensitiveText);
}

function effectiveRisk(request: VibeCodexActionApprovalStatusRequest, toolCall: VibeCodexToolCallStatusResponse | undefined, terminalValidation: VibeCodexTerminalCommandValidationResponse | undefined): VibeCodexActionApprovalRisk {
	if (request.candidateBlocked || terminalValidation?.risk === 'blocked') {
		return 'blocked';
	}
	if (terminalValidation?.risk) {
		return terminalValidation.risk;
	}
	if (request.risk) {
		return request.risk;
	}
	if (toolCall?.classification.mutatesWorkspace || request.kind === 'file' || request.kind === 'diff') {
		return 'high';
	}
	if (request.kind === 'terminal' || request.kind === 'browser' || request.kind === 'mcp' || request.kind === 'web') {
		return 'medium';
	}
	return 'low';
}

function autoApproveDecision(request: VibeCodexActionApprovalStatusRequest, config: VibeCodexAutoApproveConfig, hasExecutionAuthorization: boolean, risk: VibeCodexActionApprovalRisk): { readonly approve: boolean; readonly reason: string } {
	if (request.kind === 'diff') {
		return { approve: false, reason: 'Diff review decisions are always explicit developer actions.' };
	}
	if (request.kind === 'browser') {
		return shouldAutoApproveBrowser({ supported: !request.candidateBlocked }, config, hasExecutionAuthorization);
	}
	if (request.kind === 'mcp') {
		return shouldAutoApproveMcp({ risk, blocked: request.candidateBlocked || risk === 'blocked' }, config, hasExecutionAuthorization);
	}
	return shouldAutoApproveApproval({
		kind: autoApproveTargetForKind(request.kind),
		risk,
		blocked: request.candidateBlocked || risk === 'blocked',
	}, config, hasExecutionAuthorization);
}

function nextActionForRoute(route: VibeCodexActionApprovalRoute, blockers: readonly string[]): string {
	switch (route) {
		case 'call_read_only':
			return 'Call the read-only client tool handler; no approval or mutation token is needed.';
		case 'auto_approve':
			return 'Return the concrete approval response through the normal bridge path and keep transcript/tool-timeline evidence visible.';
		case 'prompt_user':
			return 'Show the visible approval card or explicit diff decision and wait for the developer response.';
		case 'approve_plan_first':
			return 'Submit or refine the visual plan, then wait for the exact rendered revision approval before requesting this action.';
		case 'switch_mode':
			return blockers[0] ?? 'Switch to Act, Agent, Debug, or an execution-capable Custom mode after visual plan approval.';
		case 'repair_request':
			return blockers[0] ?? 'Repair the candidate action arguments and retry action_approval_status.';
		case 'blocked':
			return blockers[0] ?? 'Do not request this action; it is blocked by client safety policy.';
	}
}

function actionApprovalMessage(route: VibeCodexActionApprovalRoute, kind: VibeCodexActionApprovalKind, risk: VibeCodexActionApprovalRisk, blockers: readonly string[]): string {
	if (route === 'call_read_only') {
		return 'Requested tool is read-only and can be routed without approval.';
	}
	if (route === 'auto_approve') {
		return `${kind} action is eligible for configured auto-approval at ${risk} risk.`;
	}
	if (route === 'prompt_user') {
		return `${kind} action is ready for explicit developer approval at ${risk} risk.`;
	}
	return `${kind} action is ${route.replace(/_/g, ' ')}${blockers.length ? `: ${blockers[0]}` : '.'}`;
}

function actionApprovalPromptBlock(response: Omit<VibeCodexActionApprovalStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'action_approval_status',
		route: response.route,
		ready: response.ready,
		canPrompt: response.canPrompt,
		canAutoApprove: response.canAutoApprove,
		kind: response.kind,
		risk: response.risk,
		mode: response.mode,
		authorization: response.authorization,
		autoApprove: response.autoApprove,
		blockers: response.blockers,
		nextAction: response.nextAction,
		guardrails: response.guardrails,
	}), null, 2);
}

function sensitiveActionForKind(kind: VibeCodexActionApprovalKind): VibeCodexSensitiveAction {
	switch (kind) {
		case 'terminal':
			return 'terminal';
		case 'file':
			return 'file';
		case 'browser':
			return 'browser';
		case 'mcp':
			return 'mcp';
		case 'diff':
			return 'diff';
		case 'tool':
		case 'web':
			return 'tool';
		default:
			return 'generic';
	}
}

function autoApproveTargetForKind(kind: VibeCodexActionApprovalKind): 'terminal' | 'file' | 'tool' | 'generic' | 'mcp' | 'browser' {
	switch (kind) {
		case 'terminal':
		case 'file':
		case 'tool':
		case 'generic':
		case 'mcp':
		case 'browser':
			return kind;
		case 'web':
			return 'tool';
		case 'diff':
			return 'file';
	}
}

function normalizeKind(value: string | undefined, toolName: string | undefined, commandLine: string | undefined): VibeCodexActionApprovalKind {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'terminal' || normalized === 'file' || normalized === 'tool' || normalized === 'browser' || normalized === 'mcp' || normalized === 'web' || normalized === 'diff' || normalized === 'generic') {
		return normalized;
	}
	const tool = toolName?.trim().toLowerCase();
	if (commandLine || (tool && terminalToolNames.has(tool))) {
		return 'terminal';
	}
	if (tool && fileToolNames.has(tool)) {
		return 'file';
	}
	if (tool && browserToolNames.has(tool)) {
		return 'browser';
	}
	if (tool && mcpToolNames.has(tool)) {
		return 'mcp';
	}
	if (tool && webToolNames.has(tool)) {
		return 'web';
	}
	if (tool && diffToolNames.has(tool)) {
		return 'diff';
	}
	return tool ? 'tool' : 'generic';
}

function normalizeRisk(value: string | undefined): VibeCodexActionApprovalRisk | undefined {
	switch (value?.trim().toLowerCase()) {
		case 'low':
		case 'medium':
		case 'high':
		case 'blocked':
			return value.trim().toLowerCase() as VibeCodexActionApprovalRisk;
		default:
			return undefined;
	}
}

function extractCommandLine(directParams: unknown, payload: Record<string, unknown>, args: Record<string, unknown>): string | undefined {
	if (typeof directParams === 'string') {
		return directParams;
	}
	const direct = stringValue(payload.command)
		?? stringValue(payload.cmd)
		?? stringValue(payload.commandLine)
		?? stringValue(payload.command_line)
		?? stringValue(payload.shellCommand)
		?? stringValue(payload.shell_command)
		?? stringValue(args.command)
		?? stringValue(args.cmd)
		?? stringValue(args.commandLine)
		?? stringValue(args.command_line)
		?? stringValue(args.shellCommand)
		?? stringValue(args.shell_command);
	if (direct) {
		return direct;
	}
	const commands = arrayOfStrings(payload.commands) ?? arrayOfStrings(args.commands);
	return commands?.length ? commands.join(' && ') : undefined;
}

function extractCandidateArguments(payload: Record<string, unknown>, args: Record<string, unknown>): Record<string, unknown> {
	const wrapper = firstRecord(payload.arguments, payload.args, payload.input, payload.toolArguments, payload.tool_arguments);
	if (wrapper) {
		const wrapperTool = stringValue(wrapper.targetTool)
			?? stringValue(wrapper.target_tool)
			?? stringValue(wrapper.actionTool)
			?? stringValue(wrapper.action_tool)
			?? stringValue(wrapper.toolName)
			?? stringValue(wrapper.tool_name);
		if (wrapperTool) {
			return firstRecord(wrapper.arguments, wrapper.args, wrapper.input, wrapper.toolArguments, wrapper.tool_arguments, wrapper.params) ?? omitWrapperControlKeys(wrapper);
		}
	}
	const nested = firstRecord(args.arguments, args.args, args.input, args.toolArguments, args.tool_arguments, args.params);
	const candidate = nested ?? firstRecord(payload.arguments, payload.args, payload.input, payload.toolArguments, payload.tool_arguments) ?? args;
	const result: Record<string, unknown> = {};
	const controlKeys = new Set([
		'kind',
		'actionKind',
		'action_kind',
		'tool',
		'name',
		'toolName',
		'tool_name',
		'targetTool',
		'target_tool',
		'actionTool',
		'action_tool',
		'includeToolCall',
		'include_tool_call',
		'includeTerminalValidation',
		'include_terminal_validation',
		'includePromptBlock',
		'include_prompt_block',
		'risk',
		'blocked',
		'candidateBlocked',
		'candidate_blocked',
	]);
	for (const [key, value] of Object.entries(candidate)) {
		if (!controlKeys.has(key)) {
			result[key] = value;
		}
	}
	return result;
}

function omitWrapperControlKeys(value: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const controlKeys = new Set([
		'kind',
		'actionKind',
		'action_kind',
		'tool',
		'name',
		'toolName',
		'targetTool',
		'target_tool',
		'actionTool',
		'action_tool',
		'includeToolCall',
		'include_tool_call',
		'includeTerminalValidation',
		'include_terminal_validation',
		'includePromptBlock',
		'include_prompt_block',
		'risk',
		'blocked',
		'candidateBlocked',
		'candidate_blocked',
	]);
	for (const [key, entry] of Object.entries(value)) {
		if (!controlKeys.has(key)) {
			result[key] = entry;
		}
	}
	return result;
}

function isActionApprovalStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? '').toLowerCase();
	return actionApprovalStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	const parsed = parseMaybeJson(args);
	if (!isRecord(parsed)) {
		return {};
	}
	const nested = parseMaybeJson(parsed.arguments ?? parsed.args ?? parsed.input);
	return isRecord(nested) ? { ...parsed, ...nested } : parsed;
}

function firstRecord(...values: readonly unknown[]): Record<string, unknown> | undefined {
	for (const value of values) {
		const parsed = parseMaybeJson(value);
		if (isRecord(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const text = value.trim();
	if (!text || !/^[\[{"]/.test(text)) {
		return value;
	}
	try {
		return JSON.parse(text);
	} catch {
		return value;
	}
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

function arrayOfStrings(value: unknown): readonly string[] | undefined {
	return Array.isArray(value) && value.every(item => typeof item === 'string') ? value.map(item => item.trim()).filter(Boolean) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
