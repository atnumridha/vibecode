/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexDiagnosticsSnapshot } from './diagnosticsEvidence';
import type { ExternalDiffReview } from './executionProtocol';
import type { VibeCodexPlan } from './planProtocol';
import type { VibeCodexVerificationPlan } from './verificationPlan';

export interface VibeCodexCommitHandoff {
	readonly version: 1;
	readonly createdAt: number;
	readonly ready: boolean;
	readonly summary: string;
	readonly message: string;
	readonly acceptedFiles: readonly string[];
	readonly blockers: readonly string[];
	readonly evidence: readonly string[];
	readonly commands: readonly string[];
}

export interface VibeCodexCommitHandoffInput {
	readonly plan?: Pick<VibeCodexPlan, 'taskId' | 'revision' | 'summary'>;
	readonly diffReview?: ExternalDiffReview;
	readonly verificationPlan?: VibeCodexVerificationPlan;
	readonly diagnosticsSnapshot?: VibeCodexDiagnosticsSnapshot;
	readonly taskCheckpointId?: string;
	readonly fileCheckpointCount: number;
}

const maxCommitSubjectLength = 72;

export function createCommitHandoff(input: VibeCodexCommitHandoffInput): VibeCodexCommitHandoff {
	const acceptedFiles = input.diffReview?.files.filter(file => file.status === 'accepted').map(file => file.path) ?? [];
	const pendingDiffs = input.diffReview?.files.filter(file => file.status === 'pending').map(file => file.path) ?? [];
	const rejectedFiles = input.diffReview?.files.filter(file => file.status === 'rejected').map(file => file.path) ?? [];
	const failedRequiredChecks = input.verificationPlan?.checks.filter(check => check.required && check.status === 'failed').map(check => check.label) ?? [];
	const pendingRequiredChecks = input.verificationPlan?.checks.filter(check => check.required && (check.status === 'pending' || check.status === 'running')).map(check => check.label) ?? [];
	const checkpointMissing = acceptedFiles.length > 0 && (!input.taskCheckpointId || input.fileCheckpointCount < acceptedFiles.length);
	const diagnosticsFailed = !!input.diagnosticsSnapshot && !!input.verificationPlan && input.diagnosticsSnapshot.errors > input.verificationPlan.diagnosticsBaseline.error;
	const blockers = [
		acceptedFiles.length ? undefined : 'No accepted diff files are ready for commit handoff.',
		pendingDiffs.length ? `Pending diff decisions: ${pendingDiffs.join(', ')}` : undefined,
		failedRequiredChecks.length ? `Failed required checks: ${failedRequiredChecks.join(', ')}` : undefined,
		pendingRequiredChecks.length ? `Pending required checks: ${pendingRequiredChecks.join(', ')}` : undefined,
		diagnosticsFailed ? 'Post-run diagnostics exceed the plan-time error baseline.' : undefined,
		checkpointMissing ? 'Accepted files do not have complete rollback checkpoint coverage.' : undefined,
	].filter((value): value is string => !!value);
	const ready = blockers.length === 0;
	const message = createCommitMessage(input.plan, acceptedFiles, rejectedFiles);
	return {
		version: 1,
		createdAt: Date.now(),
		ready,
		summary: ready ? `Commit handoff ready for ${acceptedFiles.length} accepted file${acceptedFiles.length === 1 ? '' : 's'}.` : `Commit handoff pending: ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}.`,
		message,
		acceptedFiles,
		blockers,
		evidence: commitEvidence(input, acceptedFiles, rejectedFiles),
		commands: commitCommands(acceptedFiles, message),
	};
}

function createCommitMessage(plan: VibeCodexCommitHandoffInput['plan'], acceptedFiles: readonly string[], rejectedFiles: readonly string[]): string {
	const subject = capSubject(plan?.summary ? `Vibe Codex: ${plan.summary}` : acceptedFiles.length ? `Vibe Codex: update ${acceptedFiles[0]}` : 'Vibe Codex: agent changes');
	return [
		subject,
		'',
		plan ? `Plan: ${plan.taskId} r${plan.revision}` : undefined,
		acceptedFiles.length ? `Accepted files:\n${acceptedFiles.map(path => `- ${path}`).join('\n')}` : undefined,
		rejectedFiles.length ? `Rejected files:\n${rejectedFiles.map(path => `- ${path}`).join('\n')}` : undefined,
	].filter((value): value is string => !!value).join('\n');
}

function commitEvidence(input: VibeCodexCommitHandoffInput, acceptedFiles: readonly string[], rejectedFiles: readonly string[]): readonly string[] {
	const required = input.verificationPlan?.checks.filter(check => check.required) ?? [];
	const passed = required.filter(check => check.status === 'passed');
	return [
		`${acceptedFiles.length} accepted file${acceptedFiles.length === 1 ? '' : 's'} and ${rejectedFiles.length} rejected file${rejectedFiles.length === 1 ? '' : 's'}.`,
		input.taskCheckpointId ? `Rollback checkpoint: ${input.taskCheckpointId} (${input.fileCheckpointCount} file checkpoint${input.fileCheckpointCount === 1 ? '' : 's'}).` : 'Rollback checkpoint: none.',
		input.verificationPlan ? `Verification: ${passed.length}/${required.length} required checks passed.` : 'Verification: no plan available.',
		input.diagnosticsSnapshot ? `Diagnostics: ${input.diagnosticsSnapshot.errors} errors, ${input.diagnosticsSnapshot.warnings} warnings after latest run.` : 'Diagnostics: no post-run snapshot available.',
	];
}

function commitCommands(acceptedFiles: readonly string[], message: string): readonly string[] {
	return [
		'git status --short',
		'git diff --stat',
		acceptedFiles.length ? `git add -- ${acceptedFiles.map(shellQuote).join(' ')}` : undefined,
		acceptedFiles.length ? `git commit -m ${shellQuote(subjectFromMessage(message))}` : undefined,
	].filter((value): value is string => !!value);
}

function capSubject(value: string): string {
	return value.length > maxCommitSubjectLength ? value.slice(0, maxCommitSubjectLength - 1).trimEnd() : value;
}

function subjectFromMessage(message: string): string {
	return message.split(/\r?\n/, 1)[0] || 'Vibe Codex: agent changes';
}

function shellQuote(value: string): string {
	return /^[A-Za-z0-9_./:@%+=,-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}
