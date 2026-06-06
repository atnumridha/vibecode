/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCommitHandoff } from './commitHandoff';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexFinalReviewState } from './finalReview';
import type { VibeCodexModePolicy } from './modePolicy';
import { modeAllowsAction } from './modePolicy';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexAutoCommitStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeCommands: boolean;
	readonly includeEvidence: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexAutoCommitStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly enabled: boolean;
	readonly ready: boolean;
	readonly workspaceTrusted: boolean;
	readonly hasPlanAuthorization: boolean;
	readonly mode: {
		readonly mode: string;
		readonly label: string;
		readonly readOnly: boolean;
		readonly allowsTerminalRequests: boolean;
	};
	readonly finalReview: {
		readonly ready: boolean;
		readonly decision: VibeCodexFinalReviewState['decision'];
		readonly summary: string;
	};
	readonly commitHandoff: {
		readonly ready: boolean;
		readonly summary: string;
		readonly acceptedFiles: readonly string[];
	};
	readonly counts: {
		readonly acceptedFiles: number;
		readonly blockers: number;
		readonly evidence: number;
		readonly commands: number;
	};
	readonly blockers: readonly string[];
	readonly commands?: readonly string[];
	readonly evidence?: readonly string[];
	readonly nextAction: string;
	readonly guardrails: readonly string[];
}

export interface VibeCodexAutoCommitStatusInput {
	readonly enabled: boolean;
	readonly workspaceTrusted: boolean;
	readonly hasExecutionAuthorization: boolean;
	readonly modePolicy: VibeCodexModePolicy;
	readonly commitHandoff: VibeCodexCommitHandoff;
	readonly finalReview: VibeCodexFinalReviewState;
}

const autoCommitStatusMethods = new Set([
	'agent/getAutoCommitStatus',
	'agent/autoCommitStatus',
	'commit/autoStatus',
	'autoCommit/status',
	'git/autoCommitStatus',
	'vibecodex/autoCommitStatus',
]);

const autoCommitStatusToolNames = new Set([
	'auto_commit_status',
	'auto_commit_readiness',
	'get_auto_commit_status',
	'git_auto_commit_status',
	'workspace_auto_commit_status',
]);

export function normalizeAutoCommitStatusRequest(message: JsonRpcMessage): VibeCodexAutoCommitStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!autoCommitStatusMethods.has(message.method) && !isAutoCommitStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeCommands: booleanValue(payload.includeCommands)
			?? booleanValue(payload.include_commands)
			?? booleanValue(args.includeCommands)
			?? booleanValue(args.include_commands)
			?? true,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createAutoCommitStatusResponse(request: VibeCodexAutoCommitStatusRequest, input: VibeCodexAutoCommitStatusInput): VibeCodexAutoCommitStatusResponse {
	const commands = input.commitHandoff.commands.map(command => redactSensitiveText(command));
	const evidence = redactSensitiveValue([
		...input.commitHandoff.evidence,
		...input.finalReview.evidence,
	]) as readonly string[];
	const blockers = autoCommitBlockers(input, commands).map(redactSensitiveText);
	const ready = blockers.length === 0;
	return {
		ok: true,
		source: 'externalExtension',
		enabled: input.enabled,
		ready,
		workspaceTrusted: input.workspaceTrusted,
		hasPlanAuthorization: input.hasExecutionAuthorization,
		mode: {
			mode: input.modePolicy.mode,
			label: input.modePolicy.label,
			readOnly: input.modePolicy.readOnly,
			allowsTerminalRequests: modeAllowsAction(input.modePolicy, 'terminal'),
		},
		finalReview: {
			ready: input.finalReview.ready,
			decision: input.finalReview.decision,
			summary: redactSensitiveText(input.finalReview.summary),
		},
		commitHandoff: {
			ready: input.commitHandoff.ready,
			summary: redactSensitiveText(input.commitHandoff.summary),
			acceptedFiles: redactSensitiveValue(input.commitHandoff.acceptedFiles) as readonly string[],
		},
		counts: {
			acceptedFiles: input.commitHandoff.acceptedFiles.length,
			blockers: blockers.length,
			evidence: evidence.length,
			commands: commands.length,
		},
		blockers,
		...(request.includeCommands ? { commands } : {}),
		...(request.includeEvidence ? { evidence } : {}),
		nextAction: ready
			? 'Auto-commit can be offered as a separate explicit approval or visible terminal request; this status response does not run it.'
			: blockers[0] ?? 'Resolve auto-commit blockers before offering commit automation.',
		guardrails: [
			'Auto-commit status is read-only and never stages, commits, pushes, creates branches, opens PRs, restores, deletes, writes, or merges files.',
			'Auto-commit is disabled by default and cannot become ready until the workspace is trusted, the exact visual plan revision is approved, Commit Handoff is ready, and Final Review passes.',
			'Prepared git commands are informational only; execution must happen through explicit user action or an approved terminal request.',
			'Auto-push and Auto-PR remain separate future automation gates and must not be inferred from auto-commit readiness.',
		],
	};
}

export function autoCommitStatusSummary(response: VibeCodexAutoCommitStatusResponse): string {
	return response.ready
		? `Auto-commit readiness: ready for ${response.counts.acceptedFiles} accepted file${response.counts.acceptedFiles === 1 ? '' : 's'}.`
		: `Auto-commit readiness blocked: ${response.counts.blockers} blocker${response.counts.blockers === 1 ? '' : 's'}.`;
}

function autoCommitBlockers(input: VibeCodexAutoCommitStatusInput, commands: readonly string[]): readonly string[] {
	const hasGitAdd = commands.some(command => /^git add\b/.test(command));
	const hasGitCommit = commands.some(command => /^git commit\b/.test(command));
	return [
		input.enabled ? undefined : 'Auto-commit is disabled by setting vibeCodex.extension.autoCommit.enabled.',
		input.workspaceTrusted ? undefined : 'Workspace is not trusted; auto-commit automation is blocked.',
		input.hasExecutionAuthorization ? undefined : 'Approve the exact visual plan revision before auto-commit can be offered.',
		modeAllowsAction(input.modePolicy, 'terminal') ? undefined : `${input.modePolicy.label} Mode blocks terminal requests required for git commit automation.`,
		input.commitHandoff.ready ? undefined : 'Commit Handoff is not ready.',
		input.finalReview.ready && input.finalReview.decision === 'pass' ? undefined : 'Final Review has not passed.',
		input.commitHandoff.acceptedFiles.length ? undefined : 'No accepted files are ready for commit automation.',
		hasGitAdd ? undefined : 'Prepared git add command is missing from Commit Handoff.',
		hasGitCommit ? undefined : 'Prepared git commit command is missing from Commit Handoff.',
	].filter((value): value is string => !!value);
}

function isAutoCommitStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return autoCommitStatusToolNames.has(tool);
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
