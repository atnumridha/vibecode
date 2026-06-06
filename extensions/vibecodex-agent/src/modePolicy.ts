/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type VibeCodexMode = 'plan' | 'ask' | 'manual' | 'act' | 'agent' | 'debug' | 'review' | 'custom';
export type VibeCodexSensitiveAction = 'terminal' | 'file' | 'tool' | 'generic' | 'browser' | 'mcp' | 'diff';

export const vibeCodexModes: readonly VibeCodexMode[] = ['plan', 'ask', 'manual', 'act', 'agent', 'debug', 'review', 'custom'];

export interface VibeCodexModePolicy {
	readonly mode: VibeCodexMode;
	readonly label: string;
	readonly description: string;
	readonly requiresVisualPlan: boolean;
	readonly requiresPlanApproval: boolean;
	readonly readOnly: boolean;
	readonly allowedActions: readonly VibeCodexSensitiveAction[];
	readonly blockedActions: readonly VibeCodexSensitiveAction[];
	readonly instructions: readonly string[];
}

const allSensitiveActions: readonly VibeCodexSensitiveAction[] = ['terminal', 'file', 'tool', 'generic', 'browser', 'mcp', 'diff'];
const executionActions: readonly VibeCodexSensitiveAction[] = ['terminal', 'file', 'tool', 'generic', 'browser', 'mcp', 'diff'];

const modePolicies: Record<VibeCodexMode, Omit<VibeCodexModePolicy, 'blockedActions'>> = {
	plan: {
		mode: 'plan',
		label: 'Plan',
		description: 'Read-only strategy mode for visual planning, Mermaid topology, risks, and acceptance criteria.',
		requiresVisualPlan: true,
		requiresPlanApproval: false,
		readOnly: true,
		allowedActions: [],
		instructions: [
			'Produce or refine a structured VibeCodexPlan.',
			'Do not request file writes, deletes, installs, terminal commands, browser actions, MCP tools, or diff acceptance.',
		],
	},
	ask: {
		mode: 'ask',
		label: 'Ask',
		description: 'Read-only question answering with workspace context.',
		requiresVisualPlan: true,
		requiresPlanApproval: false,
		readOnly: true,
		allowedActions: [],
		instructions: [
			'Answer using available context and cite uncertainty.',
			'Do not request mutating tools or terminal execution.',
		],
	},
	manual: {
		mode: 'manual',
		label: 'Manual',
		description: 'Read-only backend mode for developer-guided edits performed outside autonomous tools.',
		requiresVisualPlan: true,
		requiresPlanApproval: true,
		readOnly: true,
		allowedActions: [],
		instructions: [
			'Prepare instructions and review guidance for the developer.',
			'Do not autonomously request file writes, terminal commands, MCP tools, browser actions, or diff acceptance.',
		],
	},
	act: {
		mode: 'act',
		label: 'Act',
		description: 'Execute the approved plan with approval-gated tools and verification.',
		requiresVisualPlan: true,
		requiresPlanApproval: true,
		readOnly: false,
		allowedActions: executionActions,
		instructions: [
			'Execute only after the exact visual plan revision is approved.',
			'Route file changes through diff review, run relevant checks, and preserve rollback evidence.',
		],
	},
	agent: {
		mode: 'agent',
		label: 'Agent',
		description: 'Autonomous multi-step execution after visual plan approval.',
		requiresVisualPlan: true,
		requiresPlanApproval: true,
		readOnly: false,
		allowedActions: executionActions,
		instructions: [
			'Plan, execute, verify, and iterate through approval-gated tools.',
			'Keep every mutation tied to the approved plan revision and final evidence.',
		],
	},
	debug: {
		mode: 'debug',
		label: 'Debug',
		description: 'Investigate failures and execute approved diagnostic/remediation steps.',
		requiresVisualPlan: true,
		requiresPlanApproval: true,
		readOnly: false,
		allowedActions: executionActions,
		instructions: [
			'Start from diagnostics, tests, terminal evidence, and likely failure boundaries.',
			'Run remediation only after the approved visual plan unlocks tools.',
		],
	},
	review: {
		mode: 'review',
		label: 'Review',
		description: 'Read-only code and diff review mode.',
		requiresVisualPlan: true,
		requiresPlanApproval: false,
		readOnly: true,
		allowedActions: [],
		instructions: [
			'Prioritize defects, risks, missing tests, and behavioral regressions.',
			'Do not request mutating tools; propose changes as review findings or plan refinements.',
		],
	},
	custom: {
		mode: 'custom',
		label: 'Custom',
		description: 'Custom agent behavior with Vibe Codex safety gates preserved.',
		requiresVisualPlan: true,
		requiresPlanApproval: true,
		readOnly: false,
		allowedActions: executionActions,
		instructions: [
			'Honor custom instructions while preserving Vibe Codex plan approval and rollback gates.',
			'Decline unsafe or out-of-policy mutations.',
		],
	},
};

export function normalizeVibeCodexMode(mode: string): VibeCodexMode {
	switch (mode) {
		case 'ask':
		case 'plan':
		case 'manual':
		case 'act':
		case 'agent':
		case 'debug':
		case 'review':
		case 'custom':
			return mode;
		default:
			return 'agent';
	}
}

export function modePolicyFor(mode: string): VibeCodexModePolicy {
	const normalized = normalizeVibeCodexMode(mode);
	const policy = modePolicies[normalized];
	const allowed = new Set(policy.allowedActions);
	return {
		...policy,
		blockedActions: allSensitiveActions.filter(action => !allowed.has(action)),
	};
}

export function modeLabel(mode: string): string {
	return modePolicyFor(mode).label;
}

export function modePolicySummary(policy: VibeCodexModePolicy): string {
	return [
		`${policy.label} Mode: ${policy.description}`,
		`Visual plan required: ${policy.requiresVisualPlan ? 'yes' : 'no'}.`,
		`Plan approval required for mutation: ${policy.requiresPlanApproval ? 'yes' : 'no'}.`,
		policy.readOnly ? 'Backend mutating actions are blocked.' : `Allowed after approval: ${policy.allowedActions.join(', ')}.`,
	].join('\n');
}

export function modePolicyPromptBlock(policy: VibeCodexModePolicy): string {
	return JSON.stringify({
		mode: policy.mode,
		label: policy.label,
		description: policy.description,
		requiresVisualPlan: policy.requiresVisualPlan,
		requiresPlanApproval: policy.requiresPlanApproval,
		readOnly: policy.readOnly,
		allowedActions: policy.allowedActions,
		blockedActions: policy.blockedActions,
		instructions: policy.instructions,
	}, null, 2);
}

export function modeAllowsAction(policy: VibeCodexModePolicy, action: VibeCodexSensitiveAction): boolean {
	return policy.allowedActions.includes(action);
}
