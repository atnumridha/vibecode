/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCommitHandoff } from './commitHandoff';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexCommitHandoffStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeMessage: boolean;
	readonly includeEvidence: boolean;
	readonly includeCommands: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexCommitHandoffStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly ready: boolean;
	readonly summary: string;
	readonly acceptedFiles: readonly string[];
	readonly blockers: readonly string[];
	readonly counts: {
		readonly acceptedFiles: number;
		readonly blockers: number;
		readonly evidence: number;
		readonly commands: number;
	};
	readonly message?: string;
	readonly evidence?: readonly string[];
	readonly commands?: readonly string[];
	readonly nextAction: string;
	readonly guardrails: readonly string[];
}

const commitHandoffStatusMethods = new Set([
	'agent/getCommitHandoffStatus',
	'agent/commitHandoffStatus',
	'agent/getCommitStatus',
	'agent/commitStatus',
	'commit/handoffStatus',
	'commit/status',
	'handoff/commitStatus',
	'vibecodex/commitHandoffStatus',
]);

const commitHandoffStatusToolNames = new Set([
	'commit_handoff_status',
	'get_commit_handoff_status',
	'commit_status',
	'git_handoff_status',
	'workspace_commit_status',
]);

export function normalizeCommitHandoffStatusRequest(message: JsonRpcMessage): VibeCodexCommitHandoffStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!commitHandoffStatusMethods.has(message.method) && !isCommitHandoffStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeMessage: booleanValue(payload.includeMessage)
			?? booleanValue(payload.include_message)
			?? booleanValue(args.includeMessage)
			?? booleanValue(args.include_message)
			?? true,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? false,
		includeCommands: booleanValue(payload.includeCommands)
			?? booleanValue(payload.include_commands)
			?? booleanValue(args.includeCommands)
			?? booleanValue(args.include_commands)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createCommitHandoffStatusResponse(request: VibeCodexCommitHandoffStatusRequest, handoff: VibeCodexCommitHandoff): VibeCodexCommitHandoffStatusResponse {
	const acceptedFiles = redactSensitiveValue(handoff.acceptedFiles) as readonly string[];
	const blockers = redactSensitiveValue(handoff.blockers) as readonly string[];
	const evidence = redactSensitiveValue(handoff.evidence) as readonly string[];
	const commands = handoff.commands.map(command => redactSensitiveText(command));
	return {
		ok: true,
		source: 'externalExtension',
		ready: handoff.ready,
		summary: redactSensitiveText(handoff.summary),
		acceptedFiles,
		blockers,
		counts: {
			acceptedFiles: acceptedFiles.length,
			blockers: blockers.length,
			evidence: evidence.length,
			commands: commands.length,
		},
		...(request.includeMessage ? { message: redactSensitiveText(handoff.message) } : {}),
		...(request.includeEvidence ? { evidence } : {}),
		...(request.includeCommands ? { commands } : {}),
		nextAction: handoff.ready
			? 'Open Source Control or run the prepared git commands manually after human review.'
			: blockers[0] ?? 'Resolve commit handoff blockers before preparing a workspace commit.',
		guardrails: [
			'Commit handoff status is read-only and never stages, commits, branches, restores, deletes, writes, or merges files.',
			'Prepared git commands are informational only; execution must happen through explicit user action or an approved terminal request.',
			'Commit messages, paths, blockers, evidence, and commands are redacted before they are returned to the backend.',
			'Final task completion still requires Final Review to pass; commit handoff readiness alone does not mark delivery complete.',
		],
	};
}

export function commitHandoffStatusSummary(response: VibeCodexCommitHandoffStatusResponse): string {
	return response.ready
		? `${response.summary} ${response.counts.acceptedFiles} accepted file${response.counts.acceptedFiles === 1 ? '' : 's'} ready.`
		: `${response.summary} ${response.counts.blockers} blocker${response.counts.blockers === 1 ? '' : 's'}.`;
}

function isCommitHandoffStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return commitHandoffStatusToolNames.has(tool);
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
