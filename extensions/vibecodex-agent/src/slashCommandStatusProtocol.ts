/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';
import type { VibeCodexSlashCommandContext, VibeCodexSlashCommandSuggestion } from './slashCommands';
import { slashCommandSummary } from './slashCommands';

export interface VibeCodexSlashCommandStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeBuiltins: boolean;
	readonly includeWorkflows: boolean;
	readonly includeLastCommand: boolean;
	readonly includeDetails: boolean;
	readonly maxWorkflows: number;
	readonly requestedAt: number;
}

export interface VibeCodexSlashCommandStatusEntry {
	readonly label: string;
	readonly insertText: string;
	readonly commandId: string;
	readonly detail?: string;
	readonly workflowPath?: string;
}

export interface VibeCodexSlashCommandStatusLastCommand {
	readonly command: string;
	readonly label: string;
	readonly route: string;
	readonly modeOverride?: string;
	readonly planningDepth: string;
	readonly requiresVisualPlan: boolean;
	readonly readOnlyBeforeApproval: boolean;
	readonly workflowPath?: string;
	readonly workflowContentState?: 'none' | 'loaded' | 'loaded_truncated' | 'unavailable';
	readonly summary: string;
}

export interface VibeCodexSlashCommandStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly counts: {
		readonly totalSuggestions: number;
		readonly builtins: number;
		readonly workflows: number;
		readonly returnedBuiltins: number;
		readonly returnedWorkflows: number;
		readonly lastCommandPresent: boolean;
	};
	readonly builtins?: readonly VibeCodexSlashCommandStatusEntry[];
	readonly workflows?: readonly VibeCodexSlashCommandStatusEntry[];
	readonly lastCommand?: VibeCodexSlashCommandStatusLastCommand;
	readonly allowedWorkflowRoots: readonly string[];
	readonly limits: {
		readonly maxWorkflowSuggestions: number;
		readonly maxWorkflowContentBytes: number;
		readonly returnedWorkflowLimit: number;
	};
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexSlashCommandStatusInput {
	readonly suggestions: readonly VibeCodexSlashCommandSuggestion[];
	readonly lastCommand?: VibeCodexSlashCommandContext;
	readonly maxWorkflowSuggestions: number;
	readonly maxWorkflowContentBytes: number;
}

const slashCommandStatusMethods = new Set([
	'agent/getSlashCommandStatus',
	'agent/slashCommandStatus',
	'slash/status',
	'slashCommands/status',
	'slash/commandsStatus',
	'workflowSlash/status',
	'vibecodex/slashCommandStatus',
]);

const slashCommandStatusToolNames = new Set([
	'slash_status',
	'slash_command_status',
	'slash_commands_status',
	'workflow_slash_status',
	'slash_workflow_status',
	'workflow_command_status',
]);

const defaultMaxWorkflows = 20;
const maxWorkflowLimit = 80;

const allowedWorkflowRoots = [
	'.cline/workflows/',
	'.clinerules/workflows/',
	'.vibecodex/workflows/',
	'.cursor/rules/workflows/',
	'.github/workflows/vibecodex-*',
];

export function normalizeSlashCommandStatusRequest(message: JsonRpcMessage): VibeCodexSlashCommandStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!slashCommandStatusMethods.has(message.method) && !isSlashCommandStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeBuiltins: booleanValue(payload.includeBuiltins)
			?? booleanValue(payload.include_builtins)
			?? booleanValue(args.includeBuiltins)
			?? booleanValue(args.include_builtins)
			?? true,
		includeWorkflows: booleanValue(payload.includeWorkflows)
			?? booleanValue(payload.include_workflows)
			?? booleanValue(args.includeWorkflows)
			?? booleanValue(args.include_workflows)
			?? true,
		includeLastCommand: booleanValue(payload.includeLastCommand)
			?? booleanValue(payload.include_last_command)
			?? booleanValue(args.includeLastCommand)
			?? booleanValue(args.include_last_command)
			?? true,
		includeDetails: booleanValue(payload.includeDetails)
			?? booleanValue(payload.include_details)
			?? booleanValue(args.includeDetails)
			?? booleanValue(args.include_details)
			?? false,
		maxWorkflows: clampNumber(
			numberValue(payload.maxWorkflows)
				?? numberValue(payload.max_workflows)
				?? numberValue(args.maxWorkflows)
				?? numberValue(args.max_workflows)
				?? defaultMaxWorkflows,
			1,
			maxWorkflowLimit,
		),
		requestedAt: Date.now(),
	};
}

export function createSlashCommandStatusResponse(request: VibeCodexSlashCommandStatusRequest, input: VibeCodexSlashCommandStatusInput): VibeCodexSlashCommandStatusResponse {
	const builtins = input.suggestions.filter(suggestion => suggestion.commandId !== 'workflow');
	const workflows = input.suggestions.filter(suggestion => suggestion.commandId === 'workflow');
	const returnedBuiltins = builtins.map(suggestion => statusEntry(suggestion, request.includeDetails));
	const returnedWorkflows = workflows.slice(0, request.maxWorkflows).map(suggestion => statusEntry(suggestion, request.includeDetails));
	return {
		ok: true,
		source: 'externalExtension',
		counts: {
			totalSuggestions: input.suggestions.length,
			builtins: builtins.length,
			workflows: workflows.length,
			returnedBuiltins: request.includeBuiltins ? returnedBuiltins.length : 0,
			returnedWorkflows: request.includeWorkflows ? returnedWorkflows.length : 0,
			lastCommandPresent: input.lastCommand !== undefined,
		},
		...(request.includeBuiltins ? { builtins: returnedBuiltins } : {}),
		...(request.includeWorkflows ? { workflows: returnedWorkflows } : {}),
		...(request.includeLastCommand && input.lastCommand ? { lastCommand: lastCommandStatus(input.lastCommand) } : {}),
		allowedWorkflowRoots,
		limits: {
			maxWorkflowSuggestions: input.maxWorkflowSuggestions,
			maxWorkflowContentBytes: input.maxWorkflowContentBytes,
			returnedWorkflowLimit: request.maxWorkflows,
		},
		guardrails: [
			'Slash command status is read-only and never executes slash commands, creates task-board cards, creates rule proposals, loads workflow file text, approves plans, runs tools, accepts diffs, restores checkpoints, or mutates files.',
			'Workflow paths are discovered only from approved workflow roots and returned as redacted planning metadata.',
			'Workflow file content and unbounded prompt text are intentionally omitted; use the normal prompt path to run a slash command through visual planning.',
			'Every slash command still requires visual plan approval, execution authorization, diff review, and rollback gates before mutation.',
		],
		message: `${builtins.length} built-in slash command${builtins.length === 1 ? '' : 's'}; ${workflows.length} workflow slash command${workflows.length === 1 ? '' : 's'} discovered; last command ${input.lastCommand ? 'present' : 'absent'}.`,
	};
}

export function slashCommandStatusSummary(response: VibeCodexSlashCommandStatusResponse): string {
	return `${response.counts.returnedBuiltins}/${response.counts.builtins} built-in slash commands and ${response.counts.returnedWorkflows}/${response.counts.workflows} workflow slash commands returned.`;
}

function statusEntry(suggestion: VibeCodexSlashCommandSuggestion, includeDetails: boolean): VibeCodexSlashCommandStatusEntry {
	return {
		label: redactSensitiveText(suggestion.label),
		insertText: redactSensitiveText(suggestion.insertText),
		commandId: redactSensitiveText(suggestion.commandId),
		...(includeDetails ? { detail: redactSensitiveText(suggestion.detail) } : {}),
		...(suggestion.workflowPath ? { workflowPath: redactSensitiveText(suggestion.workflowPath) } : {}),
	};
}

function lastCommandStatus(command: VibeCodexSlashCommandContext): VibeCodexSlashCommandStatusLastCommand {
	return {
		command: redactSensitiveText(command.command),
		label: redactSensitiveText(command.label),
		route: redactSensitiveText(command.route),
		...(command.modeOverride ? { modeOverride: redactSensitiveText(command.modeOverride) } : {}),
		planningDepth: redactSensitiveText(command.planningDepth),
		requiresVisualPlan: command.requiresVisualPlan,
		readOnlyBeforeApproval: command.readOnlyBeforeApproval,
		...(command.workflowPath ? { workflowPath: redactSensitiveText(command.workflowPath) } : {}),
		workflowContentState: workflowContentState(command),
		summary: redactSensitiveText(slashCommandSummary(command)),
	};
}

function workflowContentState(command: VibeCodexSlashCommandContext): VibeCodexSlashCommandStatusLastCommand['workflowContentState'] {
	if (!command.workflowContent) {
		return 'none';
	}
	if (command.workflowContent.error) {
		return 'unavailable';
	}
	if (command.workflowContent.truncated) {
		return 'loaded_truncated';
	}
	return command.workflowContent.text ? 'loaded' : 'none';
}

function isSlashCommandStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return slashCommandStatusToolNames.has(tool);
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

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
