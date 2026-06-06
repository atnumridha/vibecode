/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VibeCodexCommandPermissionPolicy, commandPermissionPromptBlock, commandPermissionSummary } from './commandPermissions';
import { VibeCodexCustomModeCatalog, customModeCatalogPromptBlock, customModeCatalogSummary } from './customModes';
import { VibeCodexDocsContext, docsContextPromptBlock, docsContextSummary } from './docsContext';
import { VibeCodexFinalReviewState, finalReviewPromptBlock } from './finalReview';
import { VibeCodexInlinePromptSession } from './inlinePromptSession';
import { VibeCodexMemoryBank, memoryBankSummary } from './memoryBank';
import { VibeCodexModePolicy, modePolicyFor, modePolicySummary } from './modePolicy';
import { VibeCodexMcpCatalog, mcpCatalogSummary } from './mcpCatalog';
import { VibeCodexParallelPlan, parallelPlanSummary } from './multiAgent';
import { VibeCodexPlanRevisionSnapshot, planRevisionHistoryMarkdown, sanitizePlanRevisionHistory } from './planHistory';
import { VibeCodexPlan } from './planProtocol';
import { VibeCodexPreviewPlan, previewPlanSummary } from './previewPlan';
import { VibeCodexProviderRuntimeConfig } from './providerConfig';
import { VibeCodexRuleProposal, ruleProposalMarkdown, ruleProposalPromptBlock, ruleProposalSummary } from './ruleProposal';
import { VibeCodexSessionRecall, sessionRecallPromptBlock, sessionRecallSummary } from './sessionRecall';
import { VibeCodexSlashCommandContext, slashCommandPromptBlock, slashCommandSummary } from './slashCommands';
import { VibeCodexToolCatalog, toolCatalogPromptBlock, toolCatalogSummary } from './toolCatalog';
import { VibeCodexTranscriptEvent, sanitizeTranscriptEvents, transcriptMarkdown } from './transcript';
import { VibeCodexVerificationPlan, verificationPlanSummary } from './verificationPlan';
import { VibeCodexWorkspaceGuidance, workspaceGuidanceSummary } from './workspaceGuidance';

export type VibeCodexSessionStatus = 'planning' | 'approved' | 'terminal' | 'diff_review' | 'rollback' | 'blocked' | 'completed' | 'error';

export interface VibeCodexSessionSnapshot {
	readonly id: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly mode: string;
	readonly prompt: string;
	readonly status: VibeCodexSessionStatus;
	readonly modePolicy?: VibeCodexModePolicy;
	readonly commandPermissionPolicy?: VibeCodexCommandPermissionPolicy;
	readonly slashCommand?: VibeCodexSlashCommandContext;
	readonly plan?: VibeCodexPlan;
	readonly planRevisionHistory: readonly VibeCodexPlanRevisionSnapshot[];
	readonly inlinePromptSession?: VibeCodexInlinePromptSession;
	readonly contextSummary?: string;
	readonly provider?: Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>;
	readonly parallelPlan?: VibeCodexParallelPlan;
	readonly verificationPlan?: VibeCodexVerificationPlan;
	readonly customModeCatalog?: VibeCodexCustomModeCatalog;
	readonly sessionRecall?: VibeCodexSessionRecall;
	readonly docsContext?: VibeCodexDocsContext;
	readonly workspaceGuidance?: VibeCodexWorkspaceGuidance;
	readonly ruleProposal?: VibeCodexRuleProposal;
	readonly memoryBank?: VibeCodexMemoryBank;
	readonly previewPlan?: VibeCodexPreviewPlan;
	readonly mcpCatalog?: VibeCodexMcpCatalog;
	readonly toolCatalog?: VibeCodexToolCatalog;
	readonly finalReview?: VibeCodexFinalReviewState;
	readonly transcript: readonly VibeCodexTranscriptEvent[];
	readonly evidence: readonly string[];
}

export interface VibeCodexSessionSeed {
	readonly mode: string;
	readonly prompt: string;
	readonly modePolicy?: VibeCodexModePolicy;
	readonly commandPermissionPolicy?: VibeCodexCommandPermissionPolicy;
	readonly plan?: VibeCodexPlan;
	readonly contextSummary?: string;
	readonly provider?: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>;
	readonly parallelPlan?: VibeCodexParallelPlan;
	readonly verificationPlan?: VibeCodexVerificationPlan;
	readonly customModeCatalog?: VibeCodexCustomModeCatalog;
	readonly sessionRecall?: VibeCodexSessionRecall;
	readonly docsContext?: VibeCodexDocsContext;
	readonly workspaceGuidance?: VibeCodexWorkspaceGuidance;
	readonly ruleProposal?: VibeCodexRuleProposal;
	readonly memoryBank?: VibeCodexMemoryBank;
	readonly previewPlan?: VibeCodexPreviewPlan;
	readonly mcpCatalog?: VibeCodexMcpCatalog;
	readonly toolCatalog?: VibeCodexToolCatalog;
	readonly finalReview?: VibeCodexFinalReviewState;
	readonly transcript?: readonly VibeCodexTranscriptEvent[];
	readonly status?: VibeCodexSessionStatus;
	readonly slashCommand?: VibeCodexSlashCommandContext;
	readonly evidence?: readonly string[];
	readonly planRevisionHistory?: readonly VibeCodexPlanRevisionSnapshot[];
	readonly inlinePromptSession?: VibeCodexInlinePromptSession;
}

const historyKey = 'vibecodex.sessionHistory';
const maxSessionHistory = 30;

export function createSessionSnapshot(seed: VibeCodexSessionSeed): VibeCodexSessionSnapshot {
	const now = Date.now();
	return {
		id: `session-${now.toString(36)}-${hashText(`${seed.mode}:${seed.prompt}`).slice(0, 8)}`,
		createdAt: now,
		updatedAt: now,
		mode: seed.mode,
		prompt: seed.prompt,
		status: seed.status ?? 'planning',
		modePolicy: seed.modePolicy ?? modePolicyFor(seed.mode),
		...(seed.commandPermissionPolicy ? { commandPermissionPolicy: seed.commandPermissionPolicy } : {}),
		...(seed.slashCommand ? { slashCommand: seed.slashCommand } : {}),
		...(seed.plan ? { plan: seed.plan } : {}),
		planRevisionHistory: sanitizePlanRevisionHistory(seed.planRevisionHistory ?? []),
		...(seed.inlinePromptSession ? { inlinePromptSession: seed.inlinePromptSession } : {}),
		...(seed.contextSummary ? { contextSummary: seed.contextSummary } : {}),
		...(seed.provider ? { provider: redactedProvider(seed.provider) } : {}),
		...(seed.parallelPlan ? { parallelPlan: seed.parallelPlan } : {}),
		...(seed.verificationPlan ? { verificationPlan: seed.verificationPlan } : {}),
		...(seed.customModeCatalog ? { customModeCatalog: seed.customModeCatalog } : {}),
		...(seed.sessionRecall ? { sessionRecall: seed.sessionRecall } : {}),
		...(seed.docsContext ? { docsContext: seed.docsContext } : {}),
		...(seed.workspaceGuidance ? { workspaceGuidance: seed.workspaceGuidance } : {}),
		...(seed.ruleProposal ? { ruleProposal: seed.ruleProposal } : {}),
		...(seed.memoryBank ? { memoryBank: seed.memoryBank } : {}),
		...(seed.previewPlan ? { previewPlan: seed.previewPlan } : {}),
		...(seed.mcpCatalog ? { mcpCatalog: seed.mcpCatalog } : {}),
		...(seed.toolCatalog ? { toolCatalog: seed.toolCatalog } : {}),
		...(seed.finalReview ? { finalReview: seed.finalReview } : {}),
		transcript: sanitizeTranscriptEvents(seed.transcript ?? []),
		evidence: seed.evidence ?? [],
	};
}

export function loadSessionHistory(state: vscode.Memento): readonly VibeCodexSessionSnapshot[] {
	const stored = state.get<unknown>(historyKey, []);
	if (!Array.isArray(stored)) {
		return [];
	}
	return stored
		.filter(isSessionSnapshot)
		.map(snapshot => ({
			...snapshot,
			modePolicy: snapshot.modePolicy ?? modePolicyFor(snapshot.mode),
			planRevisionHistory: sanitizePlanRevisionHistory(snapshot.planRevisionHistory ?? []),
			transcript: sanitizeTranscriptEvents(snapshot.transcript ?? []),
		}))
		.slice(0, maxSessionHistory);
}

export async function saveSessionSnapshot(state: vscode.Memento, snapshot: VibeCodexSessionSnapshot): Promise<readonly VibeCodexSessionSnapshot[]> {
	const existing = loadSessionHistory(state).filter(item => item.id !== snapshot.id);
	const next = [{ ...snapshot, updatedAt: Date.now() }, ...existing].slice(0, maxSessionHistory);
	await state.update(historyKey, next);
	return next;
}

export async function updateSessionSnapshot(state: vscode.Memento, id: string | undefined, patch: Partial<Omit<VibeCodexSessionSnapshot, 'id' | 'createdAt' | 'updatedAt'>>): Promise<readonly VibeCodexSessionSnapshot[]> {
	if (!id) {
		return loadSessionHistory(state);
	}
	const history = loadSessionHistory(state);
	const current = history.find(item => item.id === id);
	if (!current) {
		return history;
	}
	return saveSessionSnapshot(state, {
		...current,
		...patch,
		...(patch.provider ? { provider: redactedProvider(patch.provider) } : {}),
		planRevisionHistory: sanitizePlanRevisionHistory(patch.planRevisionHistory ?? current.planRevisionHistory ?? []),
		transcript: sanitizeTranscriptEvents(patch.transcript ?? current.transcript),
		evidence: patch.evidence ?? current.evidence,
	});
}

export async function exportSessionSnapshot(snapshot: VibeCodexSessionSnapshot): Promise<void> {
	const document = await vscode.workspace.openTextDocument({
		language: 'markdown',
		content: sessionSnapshotMarkdown(snapshot),
	});
	await vscode.window.showTextDocument(document, { preview: false });
}

export function sessionSnapshotMarkdown(snapshot: VibeCodexSessionSnapshot): string {
	return [
		`# Vibe Codex Session ${snapshot.id}`,
		'',
		`- Mode: ${snapshot.mode}`,
		`- Status: ${snapshot.status}`,
		`- Created: ${new Date(snapshot.createdAt).toISOString()}`,
		`- Updated: ${new Date(snapshot.updatedAt).toISOString()}`,
		snapshot.provider ? `- Provider: ${snapshot.provider.label}${snapshot.provider.model ? ` / ${snapshot.provider.model}` : ''}` : undefined,
		snapshot.modePolicy ? `- Mode policy: ${snapshot.modePolicy.label}${snapshot.modePolicy.readOnly ? ' (read-only)' : ''}` : undefined,
		snapshot.commandPermissionPolicy ? `- Command permissions: ${commandPermissionSummary(snapshot.commandPermissionPolicy)}` : undefined,
		snapshot.slashCommand ? `- Slash command: ${slashCommandSummary(snapshot.slashCommand)}` : undefined,
		snapshot.parallelPlan ? `- Parallel: ${snapshot.parallelPlan.requestedThreads} lane(s), ${snapshot.parallelPlan.isolation}` : undefined,
		snapshot.customModeCatalog ? `- Custom modes: ${snapshot.customModeCatalog.modes.length}` : undefined,
		snapshot.sessionRecall ? `- Session recall: ${sessionRecallSummary(snapshot.sessionRecall)}` : undefined,
		snapshot.docsContext ? `- Docs context: ${docsContextSummary(snapshot.docsContext)}` : undefined,
		'',
		'## Prompt',
		'',
		snapshot.prompt || '(empty prompt)',
		snapshot.modePolicy ? `\n## Mode Policy\n\n${modePolicySummary(snapshot.modePolicy)}` : undefined,
		snapshot.commandPermissionPolicy ? `\n## Command Permissions\n\n${commandPermissionSummary(snapshot.commandPermissionPolicy)}\n\n\`\`\`json\n${commandPermissionPromptBlock(snapshot.commandPermissionPolicy)}\n\`\`\`` : undefined,
		snapshot.slashCommand ? `\n## Slash Command\n\n\`\`\`json\n${slashCommandPromptBlock(snapshot.slashCommand)}\n\`\`\`` : undefined,
		snapshot.contextSummary ? `\n## Context\n\n${snapshot.contextSummary}` : undefined,
		snapshot.inlinePromptSession ? `\n## Inline Prompt\n\n- File: ${snapshot.inlinePromptSession.file ?? 'workspace'}\n- Range: ${snapshot.inlinePromptSession.range ?? 'n/a'}\n- Selection: ${snapshot.inlinePromptSession.selectionKind}\n\nInstruction:\n\n${snapshot.inlinePromptSession.instruction}\n\nRequired plan steps:\n${snapshot.inlinePromptSession.requiredPlanSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\nAcceptance criteria:\n${snapshot.inlinePromptSession.acceptanceCriteria.map(item => `- ${item}`).join('\n')}` : undefined,
		snapshot.plan ? `\n## Plan\n\nRevision ${snapshot.plan.revision}: ${snapshot.plan.summary}\n\n${snapshot.plan.strategy}\n\n\`\`\`mermaid\n${snapshot.plan.flowchart}\n\`\`\`\n\n${snapshot.plan.steps.map(step => `- [${step.status === 'completed' ? 'x' : ' '}] ${step.id}: ${step.title}`).join('\n')}` : undefined,
		snapshot.planRevisionHistory.length ? `\n## Plan Revision History\n\n${planRevisionHistoryMarkdown(snapshot.planRevisionHistory)}` : undefined,
		snapshot.verificationPlan ? `\n## Verification\n\n${verificationPlanSummary(snapshot.verificationPlan)}\n\n${snapshot.verificationPlan.checks.map(check => `- [${check.status === 'passed' ? 'x' : ' '}] ${check.label} (${check.status})${check.command ? `\n  \`${check.command}\`` : ''}${check.evidence ? `\n  ${check.evidence}` : ''}`).join('\n')}` : undefined,
		snapshot.customModeCatalog ? `\n## Custom Modes\n\n${customModeCatalogSummary(snapshot.customModeCatalog)}\n\n${snapshot.customModeCatalog.modes.map(mode => `- ${mode.name} (\`${mode.slug}\`) from ${mode.source}${mode.readOnly ? '\n  read-only' : '\n  execution-capable after plan approval'}${mode.whenToUse ? `\n  ${mode.whenToUse}` : ''}`).join('\n')}\n\n\`\`\`json\n${customModeCatalogPromptBlock(snapshot.customModeCatalog)}\n\`\`\`` : undefined,
		snapshot.sessionRecall ? `\n## Session Recall\n\n${sessionRecallSummary(snapshot.sessionRecall)}\n\n${snapshot.sessionRecall.entries.map(entry => `- ${entry.mode} / ${entry.status}: ${entry.prompt}${entry.planSummary ? `\n  Plan: ${entry.planSummary}` : ''}${entry.files.length ? `\n  Files: ${entry.files.join(', ')}` : ''}`).join('\n')}\n\n\`\`\`json\n${sessionRecallPromptBlock(snapshot.sessionRecall)}\n\`\`\`` : undefined,
		snapshot.docsContext ? `\n## Docs Context\n\n${docsContextSummary(snapshot.docsContext)}\n\n${snapshot.docsContext.documents.map(document => `- ${document.title} (${document.kind})\n  ${document.path}${document.truncated ? '\n  truncated' : ''}`).join('\n')}\n\n\`\`\`json\n${docsContextPromptBlock(snapshot.docsContext)}\n\`\`\`` : undefined,
		snapshot.workspaceGuidance ? `\n## Rules, Skills, And Hooks\n\n${workspaceGuidanceSummary(snapshot.workspaceGuidance)}\n\n${[
			...snapshot.workspaceGuidance.rules.map(rule => `- Rule: ${rule.path} (${rule.kind})`),
			...snapshot.workspaceGuidance.skills.map(skill => `- Skill: ${skill.name} (${skill.path})`),
			...snapshot.workspaceGuidance.hooks.map(hook => `- Hook manifest: ${hook.path} (${hook.kind})`),
		].join('\n')}` : undefined,
		snapshot.ruleProposal ? `\n## Rule Proposal\n\n${ruleProposalSummary(snapshot.ruleProposal)}\n\n${ruleProposalMarkdown(snapshot.ruleProposal)}\n\n\`\`\`json\n${ruleProposalPromptBlock(snapshot.ruleProposal)}\n\`\`\`` : undefined,
		snapshot.memoryBank ? `\n## Memory Bank\n\n${memoryBankSummary(snapshot.memoryBank)}\n\n${snapshot.memoryBank.documents.map(document => `- ${document.title} (${document.kind})\n  ${document.path}${document.truncated ? '\n  truncated' : ''}`).join('\n')}` : undefined,
		snapshot.previewPlan ? `\n## Previews\n\n${previewPlanSummary(snapshot.previewPlan)}\n\n${snapshot.previewPlan.previews.map(preview => `- ${preview.label}: \`${preview.command}\` -> ${preview.url}`).join('\n')}` : undefined,
		snapshot.mcpCatalog ? `\n## MCP Servers\n\n${mcpCatalogSummary(snapshot.mcpCatalog)}\n\n${snapshot.mcpCatalog.servers.map(server => `- ${server.name} (${server.transport}${server.disabled ? ', disabled' : ''}) from ${server.source}${server.command ? `\n  \`${server.command}${server.args?.length ? ` ${server.args.join(' ')}` : ''}\`` : ''}${server.url ? `\n  ${server.url}` : ''}`).join('\n')}` : undefined,
		snapshot.toolCatalog ? `\n## Tool Catalog\n\n${toolCatalogSummary(snapshot.toolCatalog)}\n\n\`\`\`json\n${toolCatalogPromptBlock(snapshot.toolCatalog)}\n\`\`\`` : undefined,
		snapshot.parallelPlan ? `\n## Parallel Agents\n\n${parallelPlanSummary(snapshot.parallelPlan)}\n\n${snapshot.parallelPlan.threads.map(thread => `- ${thread.id} (${thread.role}): ${thread.branchName}${thread.worktreePath ? ` -> ${thread.worktreePath}` : ''}`).join('\n')}` : undefined,
		snapshot.finalReview ? `\n## Final Review\n\n${snapshot.finalReview.summary}\n\nDecision: ${snapshot.finalReview.decision}\n\n${snapshot.finalReview.items.map(item => `- [${item.status === 'passed' ? 'x' : ' '}] ${item.title} (${item.status})\n  ${item.detail}`).join('\n')}\n\n\`\`\`json\n${finalReviewPromptBlock(snapshot.finalReview)}\n\`\`\`` : undefined,
		snapshot.transcript.length ? `\n## Transcript\n\n${transcriptMarkdown(snapshot.transcript)}` : undefined,
		snapshot.evidence.length ? `\n## Evidence\n\n${snapshot.evidence.map(item => `- ${item}`).join('\n')}` : undefined,
		'',
	].filter((value): value is string => value !== undefined).join('\n');
}

function redactedProvider(provider: VibeCodexProviderRuntimeConfig | Omit<VibeCodexProviderRuntimeConfig, 'apiKey'>): Omit<VibeCodexProviderRuntimeConfig, 'apiKey'> {
	const { apiKey, ...display } = provider as VibeCodexProviderRuntimeConfig;
	return display;
}

function isSessionSnapshot(value: unknown): value is VibeCodexSessionSnapshot {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Partial<VibeCodexSessionSnapshot>;
	return typeof candidate.id === 'string'
		&& typeof candidate.createdAt === 'number'
		&& typeof candidate.updatedAt === 'number'
		&& typeof candidate.mode === 'string'
		&& typeof candidate.prompt === 'string'
		&& typeof candidate.status === 'string'
		&& (candidate.planRevisionHistory === undefined || Array.isArray(candidate.planRevisionHistory))
		&& Array.isArray(candidate.evidence);
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}
