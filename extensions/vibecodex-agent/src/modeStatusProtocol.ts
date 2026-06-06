/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { authorizationMatchesPlan, executionAuthorizationSummary, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { modePolicyFor, modePolicyPromptBlock, type VibeCodexModePolicy, vibeCodexModes } from './modePolicy';
import type { VibeCodexPlan } from './planProtocol';
import { redactSensitiveValue } from './secretFilters';

export interface VibeCodexModeStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeModes: boolean;
	readonly includeInstructions: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexModeStatusPolicy {
	readonly mode: string;
	readonly label: string;
	readonly description: string;
	readonly readOnly: boolean;
	readonly requiresVisualPlan: boolean;
	readonly requiresPlanApproval: boolean;
	readonly allowedActions: readonly string[];
	readonly blockedActions: readonly string[];
	readonly instructions?: readonly string[];
}

export interface VibeCodexModeStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly current: VibeCodexModeStatusPolicy;
	readonly modes?: readonly VibeCodexModeStatusPolicy[];
	readonly authorization: {
		readonly approved: boolean;
		readonly activePlanMatches: boolean;
		readonly summary: string;
		readonly taskId?: string;
		readonly revision?: number;
		readonly planHash?: string;
	};
	readonly counts: {
		readonly modes: number;
		readonly readOnlyModes: number;
		readonly executionModes: number;
		readonly allowedActions: number;
		readonly blockedActions: number;
	};
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexModeStatusInput {
	readonly modePolicy: VibeCodexModePolicy;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly activePlan?: VibeCodexPlan;
}

const modeStatusMethods = new Set([
	'agent/getModeStatus',
	'agent/modeStatus',
	'mode/status',
	'modePolicy/status',
	'policy/modeStatus',
	'vibecodex/modeStatus',
]);

const modeStatusToolNames = new Set([
	'mode_status',
	'get_mode_status',
	'mode_policy_status',
	'current_mode',
	'agent_mode_status',
	'mode_readiness',
]);

export function normalizeModeStatusRequest(message: JsonRpcMessage): VibeCodexModeStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!modeStatusMethods.has(message.method) && !isModeStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeModes: booleanValue(payload.includeModes)
			?? booleanValue(payload.include_modes)
			?? booleanValue(args.includeModes)
			?? booleanValue(args.include_modes)
			?? true,
		includeInstructions: booleanValue(payload.includeInstructions)
			?? booleanValue(payload.include_instructions)
			?? booleanValue(args.includeInstructions)
			?? booleanValue(args.include_instructions)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createModeStatusResponse(request: VibeCodexModeStatusRequest, input: VibeCodexModeStatusInput): VibeCodexModeStatusResponse {
	const current = modeStatusPolicy(input.modePolicy, request.includeInstructions);
	const modes = vibeCodexModes.map(mode => modeStatusPolicy(modePolicyFor(mode), request.includeInstructions));
	const activePlanMatches = authorizationMatchesPlan(input.authorization, input.activePlan);
	const approved = !!input.authorization;
	const executionModes = modes.filter(mode => !mode.readOnly).length;
	const responseWithoutPrompt: Omit<VibeCodexModeStatusResponse, 'promptBlock'> = {
		ok: true,
		source: 'externalExtension',
		current,
		...(request.includeModes ? { modes } : {}),
		authorization: {
			approved,
			activePlanMatches,
			summary: executionAuthorizationSummary(input.authorization),
			...(input.authorization ? { taskId: input.authorization.taskId, revision: input.authorization.revision, planHash: input.authorization.planHash } : {}),
		},
		counts: {
			modes: modes.length,
			readOnlyModes: modes.length - executionModes,
			executionModes,
			allowedActions: current.allowedActions.length,
			blockedActions: current.blockedActions.length,
		},
		nextAction: modeNextAction(input.modePolicy, approved, activePlanMatches),
		guardrails: [
			'Mode status is read-only and never switches modes, approves plans, creates approvals, runs tools, accepts diffs, or mutates files.',
			'Actual mode changes must come from explicit sidebar/command-palette user actions, not from status requests.',
			'Execution-capable modes still require exact visual-plan authorization before mutating tools can run.',
			'Approval tokens are never included; only taskId, revision, planHash, and match state are returned.',
		],
		message: `Mode status: ${input.modePolicy.label} Mode is ${input.modePolicy.readOnly ? 'read-only' : 'execution-capable'}; ${activePlanMatches ? 'exact plan approval matches' : approved ? 'approved plan does not match active plan' : 'no approved plan'}.`,
	};
	return {
		...responseWithoutPrompt,
		...(request.includePromptBlock ? { promptBlock: modeStatusPromptBlock(responseWithoutPrompt) } : {}),
	};
}

export function modeStatusSummary(response: VibeCodexModeStatusResponse): string {
	return `${response.message} Modes: ${response.counts.modes}; read-only: ${response.counts.readOnlyModes}; execution-capable: ${response.counts.executionModes}.`;
}

function modeStatusPolicy(policy: VibeCodexModePolicy, includeInstructions: boolean): VibeCodexModeStatusPolicy {
	return {
		mode: policy.mode,
		label: policy.label,
		description: policy.description,
		readOnly: policy.readOnly,
		requiresVisualPlan: policy.requiresVisualPlan,
		requiresPlanApproval: policy.requiresPlanApproval,
		allowedActions: policy.allowedActions,
		blockedActions: policy.blockedActions,
		...(includeInstructions ? { instructions: policy.instructions } : {}),
	};
}

function modeNextAction(policy: VibeCodexModePolicy, approved: boolean, activePlanMatches: boolean): string {
	if (policy.readOnly) {
		return `${policy.label} Mode is read-only. Continue gathering context, answering, reviewing, or refining the visual plan without mutating tools.`;
	}
	if (policy.requiresPlanApproval && !activePlanMatches) {
		return approved
			? 'Re-approve the exact active visual plan revision before requesting terminal, file, browser, MCP, tool, or diff-acceptance actions.'
			: 'Submit and approve the exact visual plan revision before requesting terminal, file, browser, MCP, tool, or diff-acceptance actions.';
	}
	return 'Execution-capable mode is available. Continue using visible approval, diff review, sandbox, and checkpoint gates for every sensitive action.';
}

function modeStatusPromptBlock(response: Omit<VibeCodexModeStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		currentMode: response.current,
		authorization: response.authorization,
		nextAction: response.nextAction,
		availableModes: response.modes,
		guardrails: response.guardrails,
		modePolicy: modePolicyPromptBlock(modePolicyFor(response.current.mode)),
		note: 'Use this read-only mode readiness block to choose Ask/Plan/Act/Agent routing. Do not treat it as mode-switch or plan approval.',
	}), null, 2);
}

function isModeStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return modeStatusToolNames.has(tool);
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
