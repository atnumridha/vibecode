/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexWorkspaceGuidance } from './workspaceGuidance';

export type VibeCodexRuleTargetKind = 'agent' | 'cline' | 'cursor' | 'codex' | 'vibecodex';
export type VibeCodexRuleOperation = 'create' | 'append';

export interface VibeCodexRuleProposal {
	readonly version: 1;
	readonly createdAt: number;
	readonly request: string;
	readonly title: string;
	readonly targetPath: string;
	readonly targetKind: VibeCodexRuleTargetKind;
	readonly targetExists: boolean;
	readonly operation: VibeCodexRuleOperation;
	readonly proposedText: string;
	readonly rationale: string;
	readonly acceptanceCriteria: readonly string[];
	readonly warnings: readonly string[];
	readonly existingRulePaths: readonly string[];
}

export interface VibeCodexRuleProposalInput {
	readonly request: string;
	readonly workspaceGuidance?: VibeCodexWorkspaceGuidance;
}

const maxRequestLength = 1200;
const maxTitleLength = 80;
const maxProposedTextLength = 1800;

export function createRuleProposal(input: VibeCodexRuleProposalInput): VibeCodexRuleProposal {
	const request = redactSensitiveText((input.request || 'Draft a new workspace rule proposal.').trim()).slice(0, maxRequestLength);
	const existingRulePaths = (input.workspaceGuidance?.rules ?? []).map(rule => normalizePath(rule.path)).filter((path): path is string => !!path);
	const target = chooseRuleTarget(request, existingRulePaths);
	const title = titleFromRequest(request);
	const targetExists = existingRulePaths.includes(target.path);
	const operation: VibeCodexRuleOperation = targetExists ? 'append' : 'create';
	const proposedText = capText([
		`## ${title}`,
		'',
		`- Intent: ${sentenceFromRequest(request)}`,
		`- Applies to: ${target.kind} workspace guidance in \`${target.path}\`.`,
		'- Safety: Any implementation work that follows this rule must still use Vibe Codex visual planning, exact-revision approval, diff review, verification evidence, and rollback checkpoints before mutation.',
	].join('\n'));
	const warnings = [
		target.warning,
		targetExists ? 'The target rule file already exists; the backend should propose an append or focused edit rather than overwrite it.' : undefined,
		existingRulePaths.length === 0 ? 'No existing workspace rule files were indexed; this proposal creates the first Vibe Codex rule file.' : undefined,
	].filter((value): value is string => !!value);
	return {
		version: 1,
		createdAt: Date.now(),
		request,
		title,
		targetPath: target.path,
		targetKind: target.kind,
		targetExists,
		operation,
		proposedText,
		rationale: `Drafted from /newrule so the rule text is visible in Plan Mode before any file write. Target selection prefers explicit rule paths, then matching existing Cline/Cursor/Codex/VibeCodex guidance, then .vibecodex/rules/vibecodex-agent.md.`,
		acceptanceCriteria: [
			'The visual plan names the target rule file and whether it will be created or edited.',
			'The proposed rule text is shown to the developer before any file mutation.',
			'The final rule change is delivered as a normal diff review with checkpoint rollback support.',
		],
		warnings,
		existingRulePaths: existingRulePaths.slice(0, 20),
	};
}

export function ruleProposalSummary(proposal: VibeCodexRuleProposal): string {
	return `Rule proposal targets ${proposal.targetPath} (${proposal.operation}, ${proposal.targetKind}). ${proposal.existingRulePaths.length} existing rule file${proposal.existingRulePaths.length === 1 ? '' : 's'} indexed.`;
}

export function ruleProposalPromptBlock(proposal: VibeCodexRuleProposal): string {
	return JSON.stringify(redactSensitiveValue({
		version: proposal.version,
		request: proposal.request,
		title: proposal.title,
		targetPath: proposal.targetPath,
		targetKind: proposal.targetKind,
		targetExists: proposal.targetExists,
		operation: proposal.operation,
		proposedText: proposal.proposedText,
		rationale: proposal.rationale,
		acceptanceCriteria: proposal.acceptanceCriteria,
		warnings: proposal.warnings,
		existingRulePaths: proposal.existingRulePaths,
		note: 'This /newrule draft is planning context only. Do not write rule files until the exact visual plan revision is approved and the change is shown as a diff review.',
	}), null, 2);
}

export function ruleProposalMarkdown(proposal: VibeCodexRuleProposal): string {
	return [
		`Target: ${proposal.targetPath} (${proposal.operation}, ${proposal.targetKind})`,
		'',
		'Proposed text:',
		'',
		proposal.proposedText,
		'',
		'Acceptance criteria:',
		...proposal.acceptanceCriteria.map(item => `- ${item}`),
		proposal.warnings.length ? '\nWarnings:' : undefined,
		...proposal.warnings.map(item => `- ${item}`),
	].filter((value): value is string => value !== undefined).join('\n');
}

function chooseRuleTarget(request: string, existingRulePaths: readonly string[]): { readonly path: string; readonly kind: VibeCodexRuleTargetKind; readonly warning?: string } {
	const explicitPath = extractExplicitRulePath(request);
	if (explicitPath) {
		return { path: explicitPath, kind: kindForPath(explicitPath) };
	}
	const unsafePath = request.match(/(?:^|\s)(?:\/|[A-Za-z]:|(?:\.\.\/)+)[^\s]*/)?.[0]?.trim();
	const lower = request.toLowerCase();
	const preferredKind = lower.includes('agents.md') || lower.includes('agent rule')
		? 'agent'
		: lower.includes('cline')
			? 'cline'
			: lower.includes('cursor')
				? 'cursor'
				: lower.includes('codex')
					? 'codex'
					: 'vibecodex';
	const existing = existingRulePaths.find(path => kindForPath(path) === preferredKind);
	const fallback = existing ?? defaultPathForKind(preferredKind);
	return {
		path: fallback,
		kind: kindForPath(fallback),
		...(unsafePath ? { warning: `Ignored unsafe or absolute rule path hint: ${unsafePath}` } : {}),
	};
}

function extractExplicitRulePath(request: string): string | undefined {
	const match = request.match(/(?:^|\s)(AGENTS\.md|CLAUDE\.md|\.clinerules(?:\/[^\s]+)?|\.cursorrules|\.cursor\/rules\/[^\s]+|\.codex\/[^\s]+\.md|\.vibecodex\/rules\/[^\s]+)/i);
	return normalizePath(match?.[1]);
}

function normalizePath(path: string | undefined): string | undefined {
	const normalized = path?.trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
	if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
		return undefined;
	}
	const segments = normalized.split('/');
	if (segments.some(segment => !segment || segment === '..')) {
		return undefined;
	}
	if (!/^[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._@+-]+)*$/.test(normalized)) {
		return undefined;
	}
	return normalized;
}

function kindForPath(path: string): VibeCodexRuleTargetKind {
	const lower = path.toLowerCase();
	if (lower.endsWith('agents.md') || lower.endsWith('claude.md')) {
		return 'agent';
	}
	if (lower.includes('.clinerules')) {
		return 'cline';
	}
	if (lower.includes('.cursor/') || lower.endsWith('.cursorrules')) {
		return 'cursor';
	}
	if (lower.includes('.codex/')) {
		return 'codex';
	}
	return 'vibecodex';
}

function defaultPathForKind(kind: VibeCodexRuleTargetKind): string {
	switch (kind) {
		case 'agent':
			return 'AGENTS.md';
		case 'cline':
			return '.clinerules/vibecodex-agent.md';
		case 'cursor':
			return '.cursor/rules/vibecodex-agent.md';
		case 'codex':
			return '.codex/rules/vibecodex-agent.md';
		default:
			return '.vibecodex/rules/vibecodex-agent.md';
	}
}

function titleFromRequest(request: string): string {
	const cleaned = request
		.replace(/`[^`]+`/g, '')
		.replace(/\b(?:draft|create|add|write|new|workspace|rule|proposal|for|to)\b/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	const title = cleaned || 'Workspace guidance rule';
	return title.length > maxTitleLength ? `${title.slice(0, maxTitleLength - 1)}...` : title;
}

function sentenceFromRequest(request: string): string {
	const cleaned = request
		.replace(/^\/newrule\s+/i, '')
		.replace(/\s+/g, ' ')
		.trim();
	const sentence = cleaned || 'Preserve the approved Vibe Codex planning, verification, diff review, and rollback workflow for workspace changes.';
	return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function capText(value: string): string {
	return value.length <= maxProposedTextLength ? value : `${value.slice(0, maxProposedTextLength - 12)}\n[truncated]`;
}
