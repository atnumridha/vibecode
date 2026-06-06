/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExternalApprovalCard, ExternalDiffReview } from './executionProtocol';
import { authorizationMatchesPlan, executionAuthorizationSummary, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexPlan } from './planProtocol';
import { validatePlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexToolCatalog } from './toolCatalog';
import { createToolCallStatusResponse, type VibeCodexToolCallStatusResponse } from './toolCallStatusProtocol';

export type VibeCodexExecutionGateRoute =
	| 'run_read_only_tool'
	| 'submit_visual_plan'
	| 'repair_plan'
	| 'approve_exact_plan'
	| 'repair_tool_call'
	| 'request_user_approval'
	| 'submit_diff_review'
	| 'await_diff_review'
	| 'ready_for_mutation_request'
	| 'blocked';

export interface VibeCodexExecutionGateStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly taskId?: string;
	readonly revision?: number;
	readonly toolName?: string;
	readonly arguments: Record<string, unknown>;
	readonly includeToolCall: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexExecutionGateStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly route: VibeCodexExecutionGateRoute;
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly mutationLocked: boolean;
	readonly request: {
		readonly taskId?: string;
		readonly revision?: number;
		readonly toolName?: string;
	};
	readonly plan: {
		readonly available: boolean;
		readonly taskId?: string;
		readonly revision?: number;
		readonly valid: boolean;
		readonly validationErrors: readonly string[];
		readonly requestedMatchesActive: boolean;
		readonly approved: boolean;
		readonly mutationReady: boolean;
		readonly authorizationSummary: string;
	};
	readonly toolCall?: VibeCodexToolCallStatusResponse;
	readonly pending: {
		readonly approvals: number;
		readonly approvalForTool: number;
		readonly diffFiles: number;
		readonly pendingDiffFiles: number;
		readonly acceptedDiffFiles: number;
		readonly rejectedDiffFiles: number;
	};
	readonly gates: readonly {
		readonly id: string;
		readonly label: string;
		readonly status: 'ready' | 'pending' | 'blocked' | 'not_applicable';
		readonly detail?: string;
	}[];
	readonly blockers: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexExecutionGateStatusInput {
	readonly plan?: VibeCodexPlan;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly toolCatalog?: VibeCodexToolCatalog;
	readonly approvals?: readonly ExternalApprovalCard[];
	readonly activeDiffReview?: ExternalDiffReview;
}

const executionGateStatusMethods = new Set([
	'agent/getExecutionGateStatus',
	'agent/executionGateStatus',
	'execution/gateStatus',
	'execution/gate/status',
	'gate/executionStatus',
	'vibecodex/executionGateStatus',
]);

const executionGateStatusToolNames = new Set([
	'execution_gate_status',
	'mutation_gate_status',
	'approval_gate_status',
	'execution_readiness_status',
	'mutation_readiness_status',
]);

export function normalizeExecutionGateStatusRequest(message: JsonRpcMessage): VibeCodexExecutionGateStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const directParams = parseMaybeJson(message.params);
	const payload = isRecord(directParams) ? directParams : {};
	const outerArgs = outerArgumentRecord(payload);
	const statusToolCall = isExecutionGateStatusToolCall(message.method, payload, outerArgs);
	if (!executionGateStatusMethods.has(message.method) && !statusToolCall) {
		return undefined;
	}
	const toolName = statusToolCall
		? stringValue(outerArgs.tool)
			?? stringValue(outerArgs.name)
			?? stringValue(outerArgs.toolName)
			?? stringValue(outerArgs.tool_name)
			?? stringValue(outerArgs.targetTool)
			?? stringValue(outerArgs.target_tool)
		: stringValue(payload.tool)
			?? stringValue(payload.name)
			?? stringValue(payload.toolName)
			?? stringValue(payload.tool_name)
			?? stringValue(payload.targetTool)
			?? stringValue(payload.target_tool)
			?? stringValue(outerArgs.tool)
			?? stringValue(outerArgs.name)
			?? stringValue(outerArgs.toolName)
			?? stringValue(outerArgs.tool_name);
	const taskId = stringValue(payload.taskId)
		?? stringValue(payload.task_id)
		?? stringValue(outerArgs.taskId)
		?? stringValue(outerArgs.task_id);
	const revision = numberValue(payload.revision)
		?? numberValue(payload.planRevision)
		?? numberValue(payload.plan_revision)
		?? numberValue(outerArgs.revision)
		?? numberValue(outerArgs.planRevision)
		?? numberValue(outerArgs.plan_revision);
	const callArguments = extractCallArguments(payload, outerArgs, statusToolCall);
	return {
		id: message.id,
		method: message.method,
		...(taskId ? { taskId: redactSensitiveText(taskId) } : {}),
		...(revision !== undefined ? { revision } : {}),
		...(toolName ? { toolName: redactSensitiveText(toolName) } : {}),
		arguments: redactSensitiveValue(callArguments) as Record<string, unknown>,
		includeToolCall: booleanValue(payload.includeToolCall)
			?? booleanValue(payload.include_tool_call)
			?? booleanValue(outerArgs.includeToolCall)
			?? booleanValue(outerArgs.include_tool_call)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(outerArgs.includePromptBlock)
			?? booleanValue(outerArgs.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createExecutionGateStatusResponse(request: VibeCodexExecutionGateStatusRequest, input: VibeCodexExecutionGateStatusInput): VibeCodexExecutionGateStatusResponse {
	const planValidation = input.plan ? validatePlan(input.plan) : { valid: false, errors: ['No active visual plan is available.'] };
	const requestedMatchesActive = requestedPlanMatchesActive(request, input.plan);
	const approved = authorizationMatchesPlan(input.authorization, input.plan);
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
		hasExecutionAuthorization: approved,
	}) : undefined;
	const pending = pendingSummary(input.approvals ?? [], input.activeDiffReview, toolCall?.schemaSummary?.name ?? request.toolName);
	const route = determineRoute(request, {
		plan: input.plan,
		planValid: planValidation.valid,
		requestedMatchesActive,
		approved,
		toolCall,
		pendingDiffFiles: pending.pendingDiffFiles,
	});
	const blockers = gateBlockers(route, planValidation.errors, requestedMatchesActive, toolCall);
	const ready = route === 'run_read_only_tool' || route === 'request_user_approval' || route === 'submit_diff_review' || route === 'ready_for_mutation_request';
	const blocked = route === 'submit_visual_plan' || route === 'repair_plan' || route === 'approve_exact_plan' || route === 'repair_tool_call' || route === 'blocked';
	const responseToolName = request.toolName ? toolCall?.matched === false ? 'unknown_tool' : redactSensitiveText(request.toolName) : undefined;
	const gates = createGateList({
		plan: input.plan,
		planValid: planValidation.valid,
		planErrors: planValidation.errors,
		requestedMatchesActive,
		approved,
		toolCall,
		pending,
		route,
		authorizationSummary: executionAuthorizationSummary(input.authorization),
	});
	const nextAction = nextActionFor(route, toolCall, blockers);
	const mutationLocked = mutationLockedForRoute(route, !!input.plan && planValidation.valid && approved);
	const responseWithoutPrompt = {
		ok: true,
		source: 'externalExtension' as const,
		version: 1 as const,
		route,
		ready,
		blocked,
		mutationLocked,
		request: {
			...(request.taskId ? { taskId: request.taskId } : {}),
			...(request.revision !== undefined ? { revision: request.revision } : {}),
			...(responseToolName ? { toolName: responseToolName } : {}),
		},
		plan: {
			available: !!input.plan,
			...(input.plan ? { taskId: redactSensitiveText(input.plan.taskId), revision: input.plan.revision } : {}),
			valid: planValidation.valid,
			validationErrors: redactSensitiveValue(planValidation.errors) as readonly string[],
			requestedMatchesActive,
			approved,
			mutationReady: !!input.plan && planValidation.valid && approved,
			authorizationSummary: executionAuthorizationSummary(input.authorization),
		},
		...(request.includeToolCall && toolCall ? { toolCall } : {}),
		pending,
		gates,
		blockers,
		nextAction,
		guardrails: [
			'Execution gate status is read-only and never approves plans, creates approval cards, runs terminals, submits diffs, accepts diffs, restores checkpoints, or mutates files.',
			'Readiness is only a routing decision; mutating work still flows through exact visual-plan authorization, visible user approvals, diff review, workspace sandbox checks, and checkpoints.',
			'mutationLocked=true means no mutating terminal, file, browser, MCP, web, diff, checkpoint, or parallel-worktree action may proceed from this gate response.',
			'Approval tokens and raw tool arguments are not returned; all summaries, blockers, and prompt blocks are redacted.',
		],
		message: executionGateStatusMessage(route, responseToolName, blockers),
	};
	const response: VibeCodexExecutionGateStatusResponse = {
		...responseWithoutPrompt,
		...(request.includePromptBlock ? { promptBlock: executionGatePromptBlock(responseWithoutPrompt) } : {}),
	};
	return redactSensitiveValue(response) as VibeCodexExecutionGateStatusResponse;
}

export function executionGateStatusSummary(response: VibeCodexExecutionGateStatusResponse): string {
	return response.message;
}

function determineRoute(request: VibeCodexExecutionGateStatusRequest, input: {
	readonly plan?: VibeCodexPlan;
	readonly planValid: boolean;
	readonly requestedMatchesActive: boolean;
	readonly approved: boolean;
	readonly toolCall?: VibeCodexToolCallStatusResponse;
	readonly pendingDiffFiles: number;
}): VibeCodexExecutionGateRoute {
	if (input.toolCall && (!input.toolCall.matched || !input.toolCall.validation.valid || input.toolCall.route === 'unknown_tool' || input.toolCall.route === 'repair_arguments')) {
		return 'repair_tool_call';
	}
	if (input.toolCall?.route === 'call_read_only_tool') {
		return 'run_read_only_tool';
	}
	if (!input.plan) {
		return 'submit_visual_plan';
	}
	if (!input.planValid) {
		return 'repair_plan';
	}
	if (!input.requestedMatchesActive) {
		return 'approve_exact_plan';
	}
	if (!input.approved) {
		return 'approve_exact_plan';
	}
	if (!request.toolName) {
		return 'ready_for_mutation_request';
	}
	if (input.toolCall?.catalogTool && !input.toolCall.catalogTool.available && input.toolCall.classification.modeBlocked) {
		return 'blocked';
	}
	if (isFileReviewTool(input.toolCall)) {
		return input.pendingDiffFiles > 0 ? 'await_diff_review' : 'submit_diff_review';
	}
	if (input.toolCall?.classification.approvalRequired || input.toolCall?.route === 'request_approval' || input.toolCall?.route === 'approve_plan_first') {
		return 'request_user_approval';
	}
	return 'ready_for_mutation_request';
}

function createGateList(input: {
	readonly plan?: VibeCodexPlan;
	readonly planValid: boolean;
	readonly planErrors: readonly string[];
	readonly requestedMatchesActive: boolean;
	readonly approved: boolean;
	readonly toolCall?: VibeCodexToolCallStatusResponse;
	readonly pending: VibeCodexExecutionGateStatusResponse['pending'];
	readonly route: VibeCodexExecutionGateRoute;
	readonly authorizationSummary: string;
}): VibeCodexExecutionGateStatusResponse['gates'] {
	return [
		{
			id: 'visual_plan',
			label: 'Visual plan',
			status: !input.plan ? 'blocked' : input.planValid ? 'ready' : 'blocked',
			detail: !input.plan ? 'No active visual plan is available.' : input.planValid ? `${input.plan.taskId} r${input.plan.revision}` : input.planErrors[0],
		},
		{
			id: 'exact_plan_approval',
			label: 'Exact plan approval',
			status: !input.plan || !input.planValid ? 'not_applicable' : input.approved && input.requestedMatchesActive ? 'ready' : 'pending',
			detail: input.approved ? input.authorizationSummary : 'Approve the exact rendered visual plan revision before mutation.',
		},
		{
			id: 'tool_schema',
			label: 'Tool schema',
			status: !input.toolCall ? 'not_applicable' : input.toolCall.matched && input.toolCall.validation.valid ? 'ready' : 'blocked',
			detail: input.toolCall ? input.toolCall.message : undefined,
		},
		{
			id: 'user_approval',
			label: 'User approval',
			status: input.route === 'request_user_approval' ? 'pending' : input.pending.approvals > 0 ? 'pending' : input.toolCall?.classification.approvalRequired ? 'pending' : 'not_applicable',
			detail: input.pending.approvalForTool > 0 ? `${input.pending.approvalForTool} pending approval(s) match this tool.` : input.toolCall?.classification.approvalRequired ? 'A visible approval card is required before execution.' : undefined,
		},
		{
			id: 'diff_review',
			label: 'Diff review',
			status: input.route === 'submit_diff_review' ? 'pending' : input.route === 'await_diff_review' ? 'pending' : input.pending.diffFiles > 0 ? 'pending' : 'not_applicable',
			detail: input.pending.diffFiles > 0 ? `${input.pending.pendingDiffFiles} pending, ${input.pending.acceptedDiffFiles} accepted, ${input.pending.rejectedDiffFiles} rejected.` : undefined,
		},
	];
}

function gateBlockers(route: VibeCodexExecutionGateRoute, planErrors: readonly string[], requestedMatchesActive: boolean, toolCall: VibeCodexToolCallStatusResponse | undefined): readonly string[] {
	if (route === 'submit_visual_plan') {
		return ['Submit a structured visual plan before requesting mutating execution.'];
	}
	if (route === 'repair_plan') {
		return planErrors.length ? redactSensitiveValue(planErrors) as readonly string[] : ['Repair the visual plan before approval.'];
	}
	if (route === 'approve_exact_plan') {
		return [
			...(requestedMatchesActive ? [] : ['Requested task/revision does not match the active visual plan.']),
			'Approve the exact rendered visual plan revision before mutation.',
		];
	}
	if (route === 'repair_tool_call') {
		return toolCall?.validation.repairHints?.length
			? redactSensitiveValue(toolCall.validation.repairHints) as readonly string[]
			: ['Use agent/toolSchemaManifest or tool_call_status to repair the proposed tool call.'];
	}
	if (route === 'blocked') {
		return [toolCall?.catalogTool?.blockedReason ?? toolCall?.nextAction ?? 'The current Mode Policy or client state blocks this tool.'];
	}
	return [];
}

function nextActionFor(route: VibeCodexExecutionGateRoute, toolCall: VibeCodexToolCallStatusResponse | undefined, blockers: readonly string[]): string {
	if (blockers[0]) {
		return blockers[0];
	}
	if (route === 'run_read_only_tool') {
		return 'Call the read-only tool handler; no visual-plan approval or mutation gate is needed.';
	}
	if (route === 'submit_diff_review') {
		return 'Submit the proposed file change through the diff review tool path; wait for developer acceptance before workspace writes.';
	}
	if (route === 'await_diff_review') {
		return 'Wait for the developer to accept, reject, repair, or restore the active diff review.';
	}
	if (route === 'request_user_approval') {
		return toolCall?.nextAction ?? 'Create the visible approval request and wait for the developer decision.';
	}
	if (route === 'ready_for_mutation_request') {
		return 'Exact visual-plan authorization is present; send the concrete mutation request through its normal gated handler.';
	}
	return 'Inspect plan_status, tool_call_status, and approval_status before requesting execution.';
}

function pendingSummary(approvals: readonly ExternalApprovalCard[], review: ExternalDiffReview | undefined, toolName: string | undefined): VibeCodexExecutionGateStatusResponse['pending'] {
	const normalizedTool = toolName?.toLowerCase();
	const approvalForTool = normalizedTool
		? approvals.filter(approval => approval.toolName?.toLowerCase() === normalizedTool).length
		: 0;
	const files = review?.files ?? [];
	return {
		approvals: approvals.length,
		approvalForTool,
		diffFiles: files.length,
		pendingDiffFiles: files.filter(file => file.status === 'pending').length,
		acceptedDiffFiles: files.filter(file => file.status === 'accepted').length,
		rejectedDiffFiles: files.filter(file => file.status === 'rejected').length,
	};
}

function requestedPlanMatchesActive(request: VibeCodexExecutionGateStatusRequest, plan: VibeCodexPlan | undefined): boolean {
	if (!plan) {
		return false;
	}
	if (request.taskId && request.taskId !== plan.taskId) {
		return false;
	}
	if (request.revision !== undefined && request.revision !== plan.revision) {
		return false;
	}
	return true;
}

function isFileReviewTool(toolCall: VibeCodexToolCallStatusResponse | undefined): boolean {
	const catalogId = toolCall?.schema?.toolCatalogId ?? toolCall?.catalogTool?.id ?? '';
	const category = toolCall?.classification.category ?? '';
	return category === 'file' || catalogId.startsWith('file.') || catalogId === 'diff.accept';
}

function executionGateStatusMessage(route: VibeCodexExecutionGateRoute, toolName: string | undefined, blockers: readonly string[]): string {
	const label = toolName ? redactSensitiveText(toolName) : 'execution gate';
	if (blockers.length) {
		return `${label} route=${route}; blocked by ${blockers[0]}`;
	}
	if (route === 'run_read_only_tool') {
		return `${label} route=${route}; read-only tool can run without mutation approval.`;
	}
	if (route === 'submit_diff_review') {
		return `${label} route=${route}; submit a review-first diff.`;
	}
	if (route === 'request_user_approval') {
		return `${label} route=${route}; visible user approval is required.`;
	}
	return `${label} route=${route}.`;
}

function executionGatePromptBlock(response: Omit<VibeCodexExecutionGateStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		route: response.route,
		ready: response.ready,
		blocked: response.blocked,
		mutationLocked: response.mutationLocked,
		request: response.request,
		plan: response.plan,
		pending: response.pending,
		gates: response.gates,
		blockers: response.blockers,
		nextAction: response.nextAction,
		note: 'This gate status does not execute or approve any tool call.',
	}), null, 2);
}

function mutationLockedForRoute(route: VibeCodexExecutionGateRoute, mutationReady: boolean): boolean {
	if (route === 'run_read_only_tool') {
		return false;
	}
	return !mutationReady;
}

function extractCallArguments(payload: Record<string, unknown>, outerArgs: Record<string, unknown>, statusToolCall: boolean): Record<string, unknown> {
	if (statusToolCall) {
		const nested = firstRecord(outerArgs.arguments, outerArgs.args, outerArgs.input, outerArgs.toolArguments, outerArgs.tool_arguments, outerArgs.params);
		return nested ?? omitControlKeys(outerArgs);
	}
	return firstRecord(payload.arguments, payload.args, payload.input, payload.toolArguments, payload.tool_arguments, payload.params) ?? {};
}

function omitControlKeys(value: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const controlKeys = new Set([
		'tool',
		'name',
		'toolName',
		'tool_name',
		'targetTool',
		'target_tool',
		'taskId',
		'task_id',
		'revision',
		'planRevision',
		'plan_revision',
		'includeToolCall',
		'include_tool_call',
		'includePromptBlock',
		'include_prompt_block',
	]);
	for (const [key, entry] of Object.entries(value)) {
		if (!controlKeys.has(key)) {
			result[key] = entry;
		}
	}
	return result;
}

function isExecutionGateStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name)
		?? '').toLowerCase();
	return executionGateStatusToolNames.has(tool);
}

function outerArgumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	return isRecord(args) ? args : {};
}

function firstRecord(...values: readonly unknown[]): Record<string, unknown> | undefined {
	for (const value of values) {
		if (isRecord(value)) {
			return value;
		}
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

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isInteger(value)) {
		return value;
	}
	if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
		return Number(value.trim());
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
