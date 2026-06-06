/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';
import type { VibeCodexCapturedTerminalRun } from './terminalRunner';

export interface VibeCodexTerminalOutputRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly runId?: string;
	readonly latest: boolean;
	readonly tailChars: number;
	readonly tailLines?: number;
	readonly requestedAt: number;
}

export interface VibeCodexTerminalOutputResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly runId?: string;
	readonly status?: VibeCodexCapturedTerminalRun['status'];
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly startedAt?: number;
	readonly endedAt?: number;
	readonly exitCode?: number;
	readonly signal?: string;
	readonly outputTail?: string;
	readonly truncated?: boolean;
	readonly error?: string;
}

export interface VibeCodexTerminalOutputStreamState {
	readonly runId: string;
	readonly outputLength: number;
	readonly status: VibeCodexCapturedTerminalRun['status'];
	readonly sequence: number;
	readonly notifiedAt: number;
}

export interface VibeCodexTerminalOutputStreamNotification {
	readonly source: 'externalExtension';
	readonly runId: string;
	readonly status: VibeCodexCapturedTerminalRun['status'];
	readonly commandLine: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly startedAt: number;
	readonly endedAt?: number;
	readonly exitCode?: number;
	readonly signal?: string;
	readonly sequence: number;
	readonly outputLength: number;
	readonly outputDelta: string;
	readonly outputTail: string;
	readonly deltaTruncated: boolean;
	readonly tailTruncated: boolean;
	readonly final: boolean;
}

const terminalOutputMethods = new Set([
	'agent/getTerminalOutput',
	'agent/terminalOutput',
	'terminal/output',
	'terminal/getOutput',
	'command_output',
	'cline/command_output',
]);

const terminalOutputToolNames = new Set([
	'command_output',
	'terminal_output',
	'get_terminal_output',
	'read_terminal_output',
]);

const defaultTailChars = 4000;
const maxTailChars = 16000;
const maxTailLines = 400;
const defaultDeltaChars = 4000;

export function normalizeTerminalOutputRequest(message: JsonRpcMessage): VibeCodexTerminalOutputRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!terminalOutputMethods.has(message.method) && !isTerminalOutputToolCall(message.method, payload, args)) {
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
	const tailChars = clampNumber(
		numberValue(payload.tailChars)
			?? numberValue(payload.tail_chars)
			?? numberValue(payload.maxChars)
			?? numberValue(payload.max_chars)
			?? numberValue(args.tailChars)
			?? numberValue(args.tail_chars)
			?? numberValue(args.maxChars)
			?? numberValue(args.max_chars)
			?? defaultTailChars,
		1,
		maxTailChars,
	);
	const tailLines = numberValue(payload.tailLines)
		?? numberValue(payload.tail_lines)
		?? numberValue(args.tailLines)
		?? numberValue(args.tail_lines);
	return {
		id: message.id,
		method: message.method,
		...(runId ? { runId } : {}),
		latest: booleanValue(payload.latest) ?? booleanValue(args.latest) ?? !runId,
		tailChars,
		...(tailLines !== undefined ? { tailLines: clampNumber(tailLines, 1, maxTailLines) } : {}),
		requestedAt: Date.now(),
	};
}

export function createTerminalOutputResponse(request: VibeCodexTerminalOutputRequest, run: VibeCodexCapturedTerminalRun | undefined): VibeCodexTerminalOutputResponse {
	if (!run) {
		return {
			ok: false,
			source: 'externalExtension',
			...(request.runId ? { runId: request.runId } : {}),
			error: request.runId ? `No captured terminal run found for ${request.runId}.` : 'No captured terminal runs are available.',
		};
	}
	const outputTail = terminalOutputTail(run.output, request.tailChars, request.tailLines);
	return {
		ok: true,
		source: 'externalExtension',
		runId: run.id,
		status: run.status,
		commandLine: redactSensitiveText(run.commandLine),
		...(run.cwd ? { cwd: redactSensitiveText(run.cwd) } : {}),
		startedAt: run.startedAt,
		...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
		...(run.exitCode !== undefined ? { exitCode: run.exitCode } : {}),
		...(run.signal ? { signal: run.signal } : {}),
		outputTail: redactSensitiveText(outputTail),
		truncated: outputTail.length < run.output.length,
	};
}

export function terminalOutputSummary(response: VibeCodexTerminalOutputResponse): string {
	if (!response.ok) {
		return response.error ?? 'Terminal output request failed.';
	}
	return `Returned ${response.outputTail?.length ?? 0} characters from ${response.status ?? 'unknown'} terminal run ${response.runId ?? 'unknown'}.`;
}

export function createTerminalOutputStreamNotification(
	run: VibeCodexCapturedTerminalRun,
	previous?: VibeCodexTerminalOutputStreamState,
	now = Date.now(),
	tailChars = defaultTailChars,
	deltaChars = defaultDeltaChars,
): { readonly notification: VibeCodexTerminalOutputStreamNotification; readonly state: VibeCodexTerminalOutputStreamState } {
	const outputLength = run.output.length;
	const rawDelta = previous && outputLength >= previous.outputLength
		? run.output.slice(previous.outputLength)
		: run.output;
	const deltaLimit = clampNumber(deltaChars, 1, maxTailChars);
	const tailLimit = clampNumber(tailChars, 1, maxTailChars);
	const deltaTruncated = rawDelta.length > deltaLimit;
	const outputDelta = deltaTruncated ? rawDelta.slice(rawDelta.length - deltaLimit) : rawDelta;
	const tailTruncated = run.output.length > tailLimit;
	const outputTail = run.output.length > tailLimit ? run.output.slice(run.output.length - tailLimit) : run.output;
	const sequence = (previous?.sequence ?? 0) + 1;
	const state: VibeCodexTerminalOutputStreamState = {
		runId: run.id,
		outputLength,
		status: run.status,
		sequence,
		notifiedAt: now,
	};
	return {
		state,
		notification: {
			source: 'externalExtension',
			runId: run.id,
			status: run.status,
			commandLine: redactSensitiveText(run.commandLine),
			...(run.cwd ? { cwd: redactSensitiveText(run.cwd) } : {}),
			...(run.reason ? { reason: redactSensitiveText(run.reason) } : {}),
			startedAt: run.startedAt,
			...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
			...(run.exitCode !== undefined ? { exitCode: run.exitCode } : {}),
			...(run.signal ? { signal: run.signal } : {}),
			sequence,
			outputLength,
			outputDelta: redactSensitiveText(outputDelta),
			outputTail: redactSensitiveText(outputTail),
			deltaTruncated,
			tailTruncated,
			final: run.status !== 'running',
		},
	};
}

function terminalOutputTail(output: string, tailChars: number, tailLines: number | undefined): string {
	const byChars = output.length > tailChars ? output.slice(output.length - tailChars) : output;
	if (!tailLines) {
		return byChars;
	}
	const lines = byChars.split(/\r?\n/);
	return lines.slice(Math.max(0, lines.length - tailLines)).join('\n');
}

function isTerminalOutputToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return terminalOutputToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function numberValue(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(number) ? number : undefined;
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
