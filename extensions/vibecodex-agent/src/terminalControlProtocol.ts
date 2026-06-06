/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';

export type VibeCodexTerminalControlAction = 'interrupt' | 'retry' | 'status' | 'proceed';

export interface VibeCodexTerminalControlRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly action: VibeCodexTerminalControlAction;
	readonly runId?: string;
	readonly latest: boolean;
	readonly reason?: string;
	readonly requestedAt: number;
}

export interface VibeCodexTerminalControlResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly action: VibeCodexTerminalControlAction;
	readonly runId?: string;
	readonly retryRunId?: string;
	readonly proceeded?: boolean;
	readonly status?: VibeCodexCapturedTerminalRun['status'];
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly startedAt?: number;
	readonly endedAt?: number;
	readonly exitCode?: number;
	readonly signal?: string;
	readonly message: string;
}

const terminalControlMethods = new Set([
	'agent/terminalControl',
	'agent/controlTerminal',
	'terminal/control',
	'cline/terminal_control',
]);

const terminalInterruptMethods = new Set([
	'agent/interruptTerminal',
	'terminal/interrupt',
	'terminal/stop',
]);

const terminalRetryMethods = new Set([
	'agent/retryTerminal',
	'terminal/retry',
]);

const terminalStatusMethods = new Set([
	'agent/terminalStatus',
	'terminal/status',
]);

const terminalProceedMethods = new Set([
	'agent/proceedTerminal',
	'agent/proceedWhileTerminalRuns',
	'terminal/proceed',
	'terminal/continue',
	'terminal/proceedWhileRunning',
	'terminal/continueWhileRunning',
]);

const interruptToolNames = new Set(['interrupt_terminal', 'terminal_interrupt', 'stop_terminal', 'stop_command', 'cancel_command']);
const retryToolNames = new Set(['retry_terminal', 'terminal_retry', 'retry_command']);
const statusToolNames = new Set(['terminal_status', 'get_terminal_status']);
const proceedToolNames = new Set(['proceed_terminal', 'terminal_proceed', 'continue_terminal', 'proceed_while_running', 'continue_while_running', 'proceed_command']);

export function normalizeTerminalControlRequest(message: JsonRpcMessage): VibeCodexTerminalControlRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	const action = terminalControlAction(message.method, payload, args);
	if (!action) {
		return undefined;
	}
	const runId = stringValue(payload.runId)
		?? stringValue(payload.run_id)
		?? stringValue(payload.terminalId)
		?? stringValue(payload.terminal_id)
		?? stringValue(payload.commandId)
		?? stringValue(payload.command_id)
		?? stringValue(args.runId)
		?? stringValue(args.run_id)
		?? stringValue(args.terminalId)
		?? stringValue(args.terminal_id)
		?? stringValue(args.commandId)
		?? stringValue(args.command_id);
	const reason = stringValue(payload.reason)
		?? stringValue(args.reason)
		?? stringValue(payload.description)
		?? stringValue(args.description);
	return {
		id: message.id,
		method: message.method,
		action,
		...(runId ? { runId: redactSensitiveText(runId) } : {}),
		latest: booleanValue(payload.latest) ?? booleanValue(args.latest) ?? !runId,
		...(reason ? { reason: redactSensitiveText(reason) } : {}),
		requestedAt: Date.now(),
	};
}

export function createTerminalControlResponse(
	request: VibeCodexTerminalControlRequest,
	run: VibeCodexCapturedTerminalRun | undefined,
	result?: { readonly retryRunId?: string; readonly message?: string },
	proceeded?: boolean,
): VibeCodexTerminalControlResponse {
	if (!run) {
		return {
			ok: false,
			source: 'externalExtension',
			action: request.action,
			...(request.runId ? { runId: request.runId } : {}),
			message: request.runId ? `No captured terminal run found for ${request.runId}.` : 'No captured terminal runs are available.',
		};
	}
	return {
		ok: true,
		source: 'externalExtension',
		action: request.action,
		runId: run.id,
		...(result?.retryRunId ? { retryRunId: result.retryRunId } : {}),
		...(proceeded !== undefined ? { proceeded } : {}),
		status: run.status,
		commandLine: redactSensitiveText(run.commandLine),
		...(run.cwd ? { cwd: redactSensitiveText(run.cwd) } : {}),
		...(run.reason ? { reason: redactSensitiveText(run.reason) } : {}),
		startedAt: run.startedAt,
		...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
		...(run.exitCode !== undefined ? { exitCode: run.exitCode } : {}),
		...(run.signal ? { signal: run.signal } : {}),
		message: result?.message ?? terminalControlDefaultMessage(request, run, result?.retryRunId),
	};
}

export function terminalControlSummary(response: VibeCodexTerminalControlResponse): string {
	if (!response.ok) {
		return response.message;
	}
	if (response.retryRunId) {
		return `Retried terminal run ${response.runId} as ${response.retryRunId}.`;
	}
	if (response.action === 'proceed') {
		return response.proceeded
			? `Proceeding while terminal run ${response.runId} continues.`
			: `Proceed request inspected terminal run ${response.runId}: ${response.status ?? 'unknown'}.`;
	}
	return `${response.action} terminal run ${response.runId}: ${response.status ?? 'unknown'}.`;
}

function terminalControlDefaultMessage(request: VibeCodexTerminalControlRequest, run: VibeCodexCapturedTerminalRun, retryRunId: string | undefined): string {
	if (request.action === 'retry') {
		return retryRunId ? `Retried terminal run ${run.id} as ${retryRunId}.` : `Terminal run ${run.id} is ready to retry.`;
	}
	if (request.action === 'interrupt') {
		return `Interrupted terminal run ${run.id}.`;
	}
	if (request.action === 'proceed') {
		return run.status === 'running'
			? `Terminal run ${run.id} will continue streaming in the background; the agent may proceed.`
			: `Terminal run ${run.id} is ${run.status}; proceed was not needed.`;
	}
	return `Terminal run ${run.id} status is ${run.status}.`;
}

function terminalControlAction(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): VibeCodexTerminalControlAction | undefined {
	if (terminalInterruptMethods.has(method)) {
		return 'interrupt';
	}
	if (terminalRetryMethods.has(method)) {
		return 'retry';
	}
	if (terminalStatusMethods.has(method)) {
		return 'status';
	}
	if (terminalProceedMethods.has(method)) {
		return 'proceed';
	}
	if (!terminalControlMethods.has(method) && method !== 'item/tool/call') {
		return undefined;
	}
	const action = normalizeActionName(stringValue(payload.action) ?? stringValue(args.action) ?? stringValue(payload.operation) ?? stringValue(args.operation));
	if (action === 'interrupt' || action === 'stop' || action === 'cancel') {
		return 'interrupt';
	}
	if (action === 'retry' || action === 'rerun' || action === 'restart') {
		return 'retry';
	}
	if (action === 'status' || action === 'inspect') {
		return 'status';
	}
	if (action === 'proceed' || action === 'continue' || action === 'background' || action === 'detach' || action === 'proceed_while_running' || action === 'continue_while_running') {
		return 'proceed';
	}
	if (method !== 'item/tool/call') {
		return undefined;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	if (interruptToolNames.has(tool)) {
		return 'interrupt';
	}
	if (retryToolNames.has(tool)) {
		return 'retry';
	}
	if (statusToolNames.has(tool)) {
		return 'status';
	}
	if (proceedToolNames.has(tool)) {
		return 'proceed';
	}
	return undefined;
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function normalizeActionName(value: string | undefined): string | undefined {
	return value?.toLowerCase().replace(/[\s-]+/g, '_');
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
