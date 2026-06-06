/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type VibeCodexSlashCommandId = 'deep-planning' | 'newtask' | 'smol' | 'newrule' | 'compact' | 'plan' | 'act' | 'ask' | 'debug' | 'review' | 'workflow';
export type VibeCodexSlashCommandRoute = 'startTask' | 'queueTask' | 'runTerminal';
export type VibeCodexSlashPlanningDepth = 'standard' | 'deep' | 'compact';

export interface VibeCodexSlashCommandSuggestion {
	readonly label: string;
	readonly insertText: string;
	readonly kind: 'slash';
	readonly detail: string;
	readonly commandId: VibeCodexSlashCommandId;
	readonly workflowPath?: string;
}

export interface VibeCodexSlashCommandContext {
	readonly command: VibeCodexSlashCommandId;
	readonly label: string;
	readonly originalPrompt: string;
	readonly normalizedPrompt: string;
	readonly route: VibeCodexSlashCommandRoute;
	readonly modeOverride?: string;
	readonly planningDepth: VibeCodexSlashPlanningDepth;
	readonly requiresVisualPlan: boolean;
	readonly readOnlyBeforeApproval: boolean;
	readonly workflowPath?: string;
	readonly workflowContent?: VibeCodexSlashWorkflowContent;
	readonly instruction: string;
	readonly acceptanceCriteria: readonly string[];
}

export interface VibeCodexSlashWorkflowContent {
	readonly path: string;
	readonly text?: string;
	readonly byteLength?: number;
	readonly truncated?: boolean;
	readonly error?: string;
}

const builtinSlashCommands: readonly VibeCodexSlashCommandSuggestion[] = [
	{
		label: '/deep-planning',
		insertText: '/deep-planning ',
		kind: 'slash',
		commandId: 'deep-planning',
		detail: 'Cline-style deep planning with alternatives, risks, Mermaid, and acceptance criteria',
	},
	{
		label: '/newtask',
		insertText: '/newtask ',
		kind: 'slash',
		commandId: 'newtask',
		detail: 'Queue a dependent Cline-style task on the Vibe Codex Task Board',
	},
	{
		label: '/smol',
		insertText: '/smol ',
		kind: 'slash',
		commandId: 'smol',
		detail: 'Use compact context and prefer the smallest safe patch',
	},
	{
		label: '/newrule',
		insertText: '/newrule ',
		kind: 'slash',
		commandId: 'newrule',
		detail: 'Draft a workspace rule proposal through the normal plan approval gate',
	},
	{
		label: '/compact',
		insertText: '/compact ',
		kind: 'slash',
		commandId: 'compact',
		detail: 'Summarize current context before continuing',
	},
	{
		label: '/plan',
		insertText: '/plan ',
		kind: 'slash',
		commandId: 'plan',
		detail: 'Force Plan mode and keep tools read-only until approval',
	},
	{
		label: '/act',
		insertText: '/act ',
		kind: 'slash',
		commandId: 'act',
		detail: 'Prepare Act mode after the visual plan approval checkpoint',
	},
	{
		label: '/ask',
		insertText: '/ask ',
		kind: 'slash',
		commandId: 'ask',
		detail: 'Ask a read-only question with workspace context',
	},
	{
		label: '/debug',
		insertText: '/debug ',
		kind: 'slash',
		commandId: 'debug',
		detail: 'Debug with diagnostics, terminal evidence, and remediation planning',
	},
	{
		label: '/review',
		insertText: '/review ',
		kind: 'slash',
		commandId: 'review',
		detail: 'Review code, diffs, diagnostics, and risks without applying edits',
	},
];

export function builtinSlashCommandSuggestions(): readonly VibeCodexSlashCommandSuggestion[] {
	return builtinSlashCommands;
}

export function createWorkflowSlashSuggestions(paths: readonly string[]): readonly VibeCodexSlashCommandSuggestion[] {
	const suggestions = new Map<string, VibeCodexSlashCommandSuggestion>();
	for (const path of paths) {
		const slug = workflowSlug(path);
		if (!slug) {
			continue;
		}
		const label = `/${slug}`;
		if (suggestions.has(label)) {
			continue;
		}
		suggestions.set(label, {
			label,
			insertText: `${label} `,
			kind: 'slash',
			commandId: 'workflow',
			workflowPath: path,
			detail: `Run workflow instructions from ${path}`,
		});
	}
	return [...suggestions.values()].slice(0, 40);
}

export function parseSlashCommandPrompt(prompt: string, selectedMode: string, suggestions: readonly VibeCodexSlashCommandSuggestion[] = builtinSlashCommands): VibeCodexSlashCommandContext | undefined {
	const originalPrompt = prompt.trim();
	const match = originalPrompt.match(/^\/([A-Za-z0-9_.-]+)(?:\s+([\s\S]*))?$/);
	if (!match) {
		return undefined;
	}
	const token = match[1].toLowerCase();
	const rest = (match[2] ?? '').trim();
	const builtin = builtinSlashCommands.find(command => command.label === `/${token}` || command.commandId === token);
	if (builtin) {
		return createBuiltinContext(builtin.commandId, builtin.label, originalPrompt, rest, selectedMode);
	}
	const workflow = suggestions.find(command => command.commandId === 'workflow' && command.label.toLowerCase() === `/${token}`);
	if (!workflow) {
		return undefined;
	}
	return {
		command: 'workflow',
		label: workflow.label,
		originalPrompt,
		normalizedPrompt: rest || `Run workflow ${workflow.label}.`,
		route: 'startTask',
		modeOverride: 'agent',
		planningDepth: 'standard',
		requiresVisualPlan: true,
		readOnlyBeforeApproval: true,
		...(workflow.workflowPath ? { workflowPath: workflow.workflowPath } : {}),
		instruction: 'Load the referenced workflow file as planning guidance, summarize the workflow intent, then produce the normal Vibe Codex visual plan before any mutation.',
		acceptanceCriteria: [
			'The workflow file is treated as read-only planning guidance.',
			'The generated plan cites the workflow path and maps workflow milestones to plan steps.',
			'Execution remains locked until the exact visual plan revision is approved.',
		],
	};
}

export function slashCommandPromptBlock(context: VibeCodexSlashCommandContext): string {
	return JSON.stringify({
		command: context.command,
		label: context.label,
		route: context.route,
		modeOverride: context.modeOverride,
		planningDepth: context.planningDepth,
		requiresVisualPlan: context.requiresVisualPlan,
		readOnlyBeforeApproval: context.readOnlyBeforeApproval,
		workflowPath: context.workflowPath,
		workflowContent: context.workflowContent,
		instruction: context.instruction,
		acceptanceCriteria: context.acceptanceCriteria,
	}, null, 2);
}

export function slashCommandSummary(context: VibeCodexSlashCommandContext): string {
	const suffix = [
		context.modeOverride ? `mode=${context.modeOverride}` : undefined,
		context.route !== 'startTask' ? `route=${context.route}` : undefined,
		context.workflowPath ? `workflow=${context.workflowPath}` : undefined,
		context.workflowContent?.text ? `workflowContent=${context.workflowContent.truncated ? 'loaded-truncated' : 'loaded'}` : context.workflowContent?.error ? 'workflowContent=unavailable' : undefined,
		context.planningDepth !== 'standard' ? `planning=${context.planningDepth}` : undefined,
	].filter(Boolean).join(', ');
	return `${context.label}${suffix ? ` (${suffix})` : ''}: ${context.normalizedPrompt || '(empty prompt)'}`;
}

function createBuiltinContext(command: VibeCodexSlashCommandId, label: string, originalPrompt: string, rest: string, selectedMode: string): VibeCodexSlashCommandContext {
	const normalizedPrompt = rest || defaultPromptForCommand(command);
	switch (command) {
		case 'deep-planning':
			return {
				command,
				label,
				originalPrompt,
				normalizedPrompt,
				route: 'startTask',
				modeOverride: 'plan',
				planningDepth: 'deep',
				requiresVisualPlan: true,
				readOnlyBeforeApproval: true,
				instruction: 'Perform a deep planning pass before coding: enumerate assumptions, alternatives, affected files, data/control flow, rollback risks, required checks, and a Mermaid graph linked to checklist nodes.',
				acceptanceCriteria: [
					'Plan includes strategy, Mermaid flowchart, risks, and acceptance criteria.',
					'Plan identifies likely files and verification commands before execution.',
					'No writes, deletes, installs, or terminal commands occur before approval.',
				],
			};
		case 'newtask':
			return {
				command,
				label,
				originalPrompt,
				normalizedPrompt,
				route: 'queueTask',
				modeOverride: selectedMode,
				planningDepth: 'standard',
				requiresVisualPlan: true,
				readOnlyBeforeApproval: true,
				instruction: 'Create a queued task-board card from this prompt. Do not execute it immediately; preserve dependency and parallel-agent context for later start.',
				acceptanceCriteria: [
					'The task is queued rather than executed immediately.',
					'The queued card keeps the normalized prompt and selected mode.',
					'Starting the card later still requires visual plan approval before mutation.',
				],
			};
		case 'smol':
			return {
				command,
				label,
				originalPrompt,
				normalizedPrompt,
				route: 'startTask',
				modeOverride: selectedMode,
				planningDepth: 'compact',
				requiresVisualPlan: true,
				readOnlyBeforeApproval: true,
				instruction: 'Use compact context and prefer the smallest reversible patch that satisfies the request. Avoid broad refactors unless the plan proves they are necessary.',
				acceptanceCriteria: [
					'The plan explains why the patch is minimal.',
					'Context gathering is bounded to the files and symbols most relevant to the prompt.',
					'Verification covers the touched surface before final review.',
				],
			};
		case 'newrule':
			return {
				command,
				label,
				originalPrompt,
				normalizedPrompt,
				route: 'startTask',
				modeOverride: 'plan',
				planningDepth: 'standard',
				requiresVisualPlan: true,
				readOnlyBeforeApproval: true,
				instruction: 'Draft a workspace rule proposal for AGENTS.md, .clinerules, .cursor/rules, or .vibecodex rules. Present the intended rule text in the plan and wait for approval before writing it.',
				acceptanceCriteria: [
					'Plan identifies the target rule file and whether it already exists.',
					'Proposed rule text is shown before any file write.',
					'Rule changes remain behind diff review and checkpoint restore.',
				],
			};
		case 'compact':
			return {
				command,
				label,
				originalPrompt,
				normalizedPrompt,
				route: 'startTask',
				modeOverride: 'ask',
				planningDepth: 'compact',
				requiresVisualPlan: true,
				readOnlyBeforeApproval: true,
				instruction: 'Summarize the current task state, constraints, relevant context, and next actions. Keep the output compact and do not mutate files.',
				acceptanceCriteria: [
					'Summary captures current objective, known constraints, and next recommended action.',
					'No mutation or terminal execution is requested.',
				],
			};
		case 'plan':
		case 'act':
		case 'ask':
		case 'debug':
		case 'review':
			return {
				command,
				label,
				originalPrompt,
				normalizedPrompt,
				route: command === 'ask' || command === 'review' ? 'startTask' : 'startTask',
				modeOverride: command,
				planningDepth: 'standard',
				requiresVisualPlan: true,
				readOnlyBeforeApproval: true,
				instruction: `Run the request in ${command} mode while preserving Vibe Codex visual planning and approval gates.`,
				acceptanceCriteria: [
					'The selected mode is reflected in backend context and transcript.',
					'Mutating tools remain locked until the exact plan revision is approved.',
				],
			};
		default:
			return {
				command,
				label,
				originalPrompt,
				normalizedPrompt,
				route: 'startTask',
				modeOverride: selectedMode,
				planningDepth: 'standard',
				requiresVisualPlan: true,
				readOnlyBeforeApproval: true,
				instruction: 'Run the slash command through the normal Vibe Codex planning loop.',
				acceptanceCriteria: ['The visual plan is approved before execution.'],
			};
	}
}

function defaultPromptForCommand(command: VibeCodexSlashCommandId): string {
	switch (command) {
		case 'deep-planning':
			return 'Create a deep implementation plan for the current workspace task.';
		case 'newtask':
			return 'Queue a new Vibe Codex task.';
		case 'smol':
			return 'Use compact context and propose the smallest safe patch for the current task.';
		case 'newrule':
			return 'Draft a new workspace rule proposal.';
		case 'compact':
			return 'Summarize current task state and next steps compactly.';
		case 'plan':
			return 'Create a visual plan for the current task.';
		case 'act':
			return 'Prepare to execute the approved plan.';
		case 'ask':
			return 'Answer using workspace context.';
		case 'debug':
			return 'Debug the current failure with diagnostics and terminal evidence.';
		case 'review':
			return 'Review the current code or diff for risks.';
		case 'workflow':
			return 'Run the selected workflow.';
	}
}

function workflowSlug(path: string): string | undefined {
	const normalized = path.replace(/\\/g, '/');
	const fileName = normalized.split('/').pop()?.replace(/\.(md|mdx|txt)$/i, '') ?? '';
	const slug = fileName.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
	return slug.length ? slug : undefined;
}
