/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createLinearMermaidFlowchart, isSafeMermaidFlowchart, parseMermaidFlowchart } from './mermaidFlow';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexPlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';

export interface VibeCodexPlanStep {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexPlanStepStatus;
	readonly files?: readonly string[];
	readonly dependsOn?: readonly string[];
	readonly flowNodeId: string;
}

export interface VibeCodexPlan {
	readonly taskId: string;
	readonly revision: number;
	readonly summary: string;
	readonly strategy: string;
	readonly flowchart: string;
	readonly steps: readonly VibeCodexPlanStep[];
	readonly risks: readonly string[];
	readonly acceptanceCriteria: readonly string[];
}

export interface VibeCodexPlanValidationResult {
	readonly valid: boolean;
	readonly errors: readonly string[];
}

export interface VibeCodexRenderedPlanIdentity {
	readonly taskId: string;
	readonly revision: number;
	readonly planHash: string;
}

export type VibeCodexPlanSubmissionEvent = 'submitted' | 'updated';
export type VibeCodexPlanFeedbackAction = 'refine' | 'reject' | 'manualStepEdit';

export interface VibeCodexPlanSubmissionResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly method: string;
	readonly event: VibeCodexPlanSubmissionEvent;
	readonly accepted: boolean;
	readonly valid: boolean;
	readonly validationErrors: readonly string[];
	readonly taskId?: string;
	readonly revision?: number;
	readonly summary?: string;
	readonly planIdentity?: VibeCodexRenderedPlanIdentity;
	readonly planHash?: string;
	readonly approvalReady: boolean;
	readonly mutationLocked: true;
	readonly nextAction: 'await_user_approval' | 'repair_plan';
	readonly render: {
		readonly safeMermaid: boolean;
		readonly nodeCount: number;
		readonly edgeCount: number;
		readonly stepCount: number;
		readonly linkedStepCount: number;
	};
	readonly message: string;
}

export interface VibeCodexPlanFeedbackHandoff {
	readonly source: 'externalExtension';
	readonly action: VibeCodexPlanFeedbackAction;
	readonly taskId: string;
	readonly revision: number;
	readonly planIdentity: VibeCodexRenderedPlanIdentity;
	readonly approved: false;
	readonly mutationLocked: true;
	readonly executionAuthorizationRequired: true;
	readonly feedback?: string;
	readonly nextAction: 'await_revised_plan' | 'review_edited_plan';
	readonly guardrails: readonly string[];
	readonly message: string;
}

const knownStepStatuses = new Set<VibeCodexPlanStepStatus>(['pending', 'in_progress', 'completed', 'blocked', 'failed']);
const identifierPattern = /^[a-zA-Z0-9_.:-]+$/;

export function createFallbackPlan(prompt: string, mode: string): VibeCodexPlan {
	const taskId = `external-${Date.now().toString(36)}`;
	const summary = prompt.trim() || 'New Vibe Codex task';
	return {
		taskId,
		revision: 1,
		summary,
		strategy: [
			`Run ${mode} mode with an approval-first workflow.`,
			'Collect workspace context, produce a visual plan, pause for approval, then execute through the configured Codex backend or terminal handoff.'
		].join(' '),
		flowchart: [
			'graph TD',
			'  A[User task] --> B[Context analysis]',
			'  B --> C[Visual plan]',
			'  C --> D{Approve?}',
			'  D -- No --> E[Refine plan]',
			'  E --> C',
			'  D -- Yes --> F[Execute]',
			'  F --> G[Verify]',
			'  G --> H[Review diff]'
		].join('\n'),
		steps: [
			{ id: 'context', title: 'Collect workspace, selection, git, diagnostics, and terminal context', status: 'pending', flowNodeId: 'B' },
			{ id: 'plan', title: 'Render strategy, Mermaid flowchart, checklist, risks, and acceptance criteria', status: 'pending', flowNodeId: 'C' },
			{ id: 'approve', title: 'Wait for explicit approval before file or terminal mutation', status: 'pending', flowNodeId: 'D' },
			{ id: 'execute', title: 'Execute approved edits and commands through Codex with safety gates', status: 'pending', flowNodeId: 'F' },
			{ id: 'review', title: 'Present verification evidence, diffs, and rollback path', status: 'pending', flowNodeId: 'H' }
		],
		risks: ['External VS Code installs require a reachable Codex app-server for full native execution.'],
		acceptanceCriteria: ['No mutation before approval.', 'The approved plan revision is sent back through agent/approvePlan.', 'Terminal fallback includes the approved plan when app-server execution is unavailable.']
	};
}

export function validatePlan(candidate: unknown): VibeCodexPlanValidationResult {
	const errors: string[] = [];
	if (!isRecord(candidate)) {
		return { valid: false, errors: ['Plan must be an object.'] };
	}

	const plan = candidate as Partial<VibeCodexPlan>;
	if (!isNonEmptyString(plan.taskId)) {
		errors.push('Plan taskId is required.');
	}
	if (!Number.isInteger(plan.revision) || (plan.revision ?? 0) < 1) {
		errors.push('Plan revision must be a positive integer.');
	}
	if (!isNonEmptyString(plan.summary)) {
		errors.push('Plan summary is required.');
	}
	if (!isNonEmptyString(plan.strategy)) {
		errors.push('Plan strategy is required.');
	}
	if (!isSafeMermaidFlowchart(plan.flowchart)) {
		errors.push('Plan flowchart must be a safe Mermaid graph or flowchart.');
	}
	if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
		errors.push('Plan must include at least one step.');
	} else {
		const stepIds = new Set<string>();
		const flowNodeIds = new Set<string>();
		const duplicateFlowNodeIds = new Set<string>();
		for (const [index, step] of plan.steps.entries()) {
			errors.push(...validateStep(step, index, stepIds));
			if (isRecord(step)) {
				const flowNodeId = stringValue(step.flowNodeId);
				if (flowNodeId && identifierPattern.test(flowNodeId)) {
					if (flowNodeIds.has(flowNodeId)) {
						duplicateFlowNodeIds.add(flowNodeId);
					}
					flowNodeIds.add(flowNodeId);
				}
			}
		}
		for (const id of duplicateFlowNodeIds) {
			errors.push(`Step flowNodeId "${id}" is duplicated.`);
		}
		errors.push(...validateStepDependencies(plan.steps, stepIds));
		if (isSafeMermaidFlowchart(plan.flowchart)) {
			errors.push(...validateStepFlowNodes(plan.flowchart, plan.steps));
		}
	}
	if (!Array.isArray(plan.risks)) {
		errors.push('Plan risks must be an array.');
	}
	if (!Array.isArray(plan.acceptanceCriteria)) {
		errors.push('Plan acceptanceCriteria must be an array.');
	}

	return { valid: errors.length === 0, errors };
}

export function createPlanSubmissionResponse(method: string, candidate: unknown, event: VibeCodexPlanSubmissionEvent): VibeCodexPlanSubmissionResponse {
	const validation = validatePlan(candidate);
	const plan = validation.valid ? candidate as VibeCodexPlan : undefined;
	const partial = isRecord(candidate) ? candidate : {};
	const flowchart = typeof partial.flowchart === 'string' ? partial.flowchart : '';
	const flow = flowchart ? parseMermaidFlowchart(flowchart, plan?.steps) : undefined;
	const identity = plan ? renderedPlanIdentity(plan) : undefined;
	const taskId = plan?.taskId ?? stringValue(partial.taskId);
	const revision = plan?.revision ?? (Number.isInteger(partial.revision) ? partial.revision as number : undefined);
	const summary = plan?.summary ?? stringValue(partial.summary);
	return {
		ok: validation.valid,
		source: 'externalExtension',
		method,
		event,
		accepted: validation.valid,
		valid: validation.valid,
		validationErrors: redactSensitiveValue(validation.errors) as readonly string[],
		...(taskId ? { taskId: redactSensitiveText(taskId) } : {}),
		...(revision !== undefined ? { revision } : {}),
		...(summary ? { summary: redactSensitiveText(summary) } : {}),
		...(identity ? { planIdentity: identity, planHash: identity.planHash } : {}),
		approvalReady: validation.valid,
		mutationLocked: true,
		nextAction: validation.valid ? 'await_user_approval' : 'repair_plan',
		render: {
			safeMermaid: !!flow?.valid,
			nodeCount: flow?.nodes.length ?? 0,
			edgeCount: flow?.edges.length ?? 0,
			stepCount: plan?.steps.length ?? (Array.isArray(partial.steps) ? partial.steps.length : 0),
			linkedStepCount: plan ? plan.steps.filter(step => flow?.nodes.some(node => node.id === step.flowNodeId)).length : 0,
		},
		message: validation.valid && identity
			? `Accepted ${event === 'submitted' ? 'submitted' : 'updated'} visual plan ${identity.taskId} r${identity.revision}; awaiting user approval for planHash ${identity.planHash}.`
			: `Rejected ${event === 'submitted' ? 'submitted' : 'updated'} visual plan; ${validation.errors[0] ?? 'plan validation failed'}.`,
	};
}

export function renderedPlanIdentity(plan: VibeCodexPlan): VibeCodexRenderedPlanIdentity {
	return {
		taskId: plan.taskId,
		revision: plan.revision,
		planHash: hashRenderedPlan(plan),
	};
}

export function createPlanFeedbackHandoff(plan: VibeCodexPlan, action: VibeCodexPlanFeedbackAction, feedback?: string): VibeCodexPlanFeedbackHandoff {
	const trimmed = feedback?.trim();
	const redactedFeedback = trimmed ? redactSensitiveText(trimmed) : undefined;
	const nextAction = action === 'manualStepEdit' ? 'review_edited_plan' : 'await_revised_plan';
	return {
		source: 'externalExtension',
		action,
		taskId: plan.taskId,
		revision: plan.revision,
		planIdentity: renderedPlanIdentity(plan),
		approved: false,
		mutationLocked: true,
		executionAuthorizationRequired: true,
		...(redactedFeedback ? { feedback: redactedFeedback } : {}),
		nextAction,
		guardrails: [
			'Plan feedback is not approval and never unlocks mutation.',
			'Backend must submit a revised agent/submitPlan or agent/updatePlan before execution can continue.',
			'Only user approval of the exact rendered planHash can create an execution authorization token.',
		],
		message: action === 'manualStepEdit'
			? `Recorded manual plan edit for ${plan.taskId} r${plan.revision}; developer must review the edited plan before approval.`
			: `Recorded plan ${action === 'reject' ? 'rejection' : 'refinement'} for ${plan.taskId} r${plan.revision}; awaiting a revised plan.`,
	};
}

function validateStepDependencies(steps: readonly unknown[], stepIds: ReadonlySet<string>): readonly string[] {
	const errors: string[] = [];
	for (const [index, step] of steps.entries()) {
		if (!isRecord(step) || !Array.isArray(step.dependsOn)) {
			continue;
		}
		for (const dependency of step.dependsOn) {
			if (isNonEmptyString(dependency) && !stepIds.has(dependency.trim())) {
				errors.push(`Step ${index + 1} dependsOn references unknown step "${dependency.trim()}".`);
			}
		}
	}
	return errors;
}

function validateStepFlowNodes(flowchart: string, steps: readonly unknown[]): readonly string[] {
	const flow = parseMermaidFlowchart(flowchart);
	const graphNodeIds = new Set(flow.nodes.map(node => node.id));
	const errors: string[] = [];
	for (const [index, step] of steps.entries()) {
		if (!isRecord(step)) {
			continue;
		}
		const flowNodeId = stringValue(step.flowNodeId);
		if (flowNodeId && identifierPattern.test(flowNodeId) && !graphNodeIds.has(flowNodeId)) {
			errors.push(`Step ${index + 1} flowNodeId "${flowNodeId}" is not present in the Mermaid flowchart.`);
		}
	}
	return errors;
}

export function normalizeIncomingPlan(method: string, params: unknown, fallbackPrompt: string, mode: string): VibeCodexPlan | undefined {
	if ((method === 'agent/submitPlan' || method === 'agent/updatePlan') && validatePlan(params).valid) {
		return params as VibeCodexPlan;
	}

	if (method !== 'turn/plan/updated' || !isRecord(params)) {
		return undefined;
	}

	const planItems = Array.isArray(params.plan) ? params.plan : [];
	if (!planItems.length) {
		return undefined;
	}

	const fallback = createFallbackPlan(fallbackPrompt, mode);
	const steps = planItems
		.map((item, index): VibeCodexPlanStep | undefined => {
			if (!isRecord(item)) {
				return undefined;
			}
			const title = stringValue(item.step) ?? stringValue(item.title);
			if (!title) {
				return undefined;
			}
			const status = normalizeStatus(item.status);
			const nodeId = `P${index + 1}`;
			return {
				id: `step-${index + 1}`,
				title,
				status,
				flowNodeId: nodeId,
			};
		})
		.filter((step): step is VibeCodexPlanStep => !!step);

	if (!steps.length) {
		return undefined;
	}

	return {
		...fallback,
		taskId: stringValue(params.taskId) ?? stringValue(params.turnId) ?? fallback.taskId,
		summary: stringValue(params.explanation) ?? fallback.summary,
		strategy: stringValue(params.explanation) ?? fallback.strategy,
		flowchart: createLinearMermaidFlowchart(steps),
		steps,
	};
}

export function planToPrompt(plan: VibeCodexPlan): string {
	return [
		`Approved Vibe Codex plan ${plan.taskId} revision ${plan.revision}: ${plan.summary}`,
		'',
		plan.strategy,
		'',
		'Flowchart:',
		plan.flowchart,
		'',
		'Steps:',
		...plan.steps.map(step => `- [${step.status === 'completed' ? 'x' : ' '}] ${step.title}`),
		'',
		'Acceptance criteria:',
		...plan.acceptanceCriteria.map(item => `- ${item}`),
	].join('\n');
}

function hashRenderedPlan(plan: VibeCodexPlan): string {
	const text = JSON.stringify({
		taskId: plan.taskId,
		revision: plan.revision,
		summary: plan.summary,
		strategy: plan.strategy,
		flowchart: plan.flowchart,
		steps: plan.steps,
		risks: plan.risks,
		acceptanceCriteria: plan.acceptanceCriteria,
	});
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${text.length}`;
}

export function refineFallbackPlan(plan: VibeCodexPlan, feedback: string): VibeCodexPlan {
	const revision = plan.revision + 1;
	const trimmed = feedback.trim();
	return {
		...plan,
		revision,
		strategy: [
			plan.strategy,
			trimmed ? `Revision ${revision} user feedback: ${trimmed}` : `Revision ${revision}: user requested another planning pass.`,
		].join('\n\n'),
		risks: [
			...plan.risks,
			trimmed ? `Plan revision ${revision} must address: ${trimmed}` : `Plan revision ${revision} needs additional user clarification.`,
		],
	};
}

function validateStep(step: unknown, index: number, stepIds: Set<string>): string[] {
	const errors: string[] = [];
	if (!isRecord(step)) {
		return [`Step ${index + 1} must be an object.`];
	}
	const id = stringValue(step.id);
	if (!id || !identifierPattern.test(id)) {
		errors.push(`Step ${index + 1} id is required and must be identifier-like.`);
	} else if (stepIds.has(id)) {
		errors.push(`Step id "${id}" is duplicated.`);
	} else {
		stepIds.add(id);
	}
	if (!isNonEmptyString(step.title)) {
		errors.push(`Step ${index + 1} title is required.`);
	}
	if (!knownStepStatuses.has(step.status as VibeCodexPlanStepStatus)) {
		errors.push(`Step ${index + 1} has an unsupported status.`);
	}
	if (step.files !== undefined && (!Array.isArray(step.files) || !step.files.every(isNonEmptyString))) {
		errors.push(`Step ${index + 1} files must be an array of non-empty strings when provided.`);
	}
	if (step.dependsOn !== undefined && (!Array.isArray(step.dependsOn) || !step.dependsOn.every(isNonEmptyString))) {
		errors.push(`Step ${index + 1} dependsOn must be an array of non-empty strings when provided.`);
	}
	const flowNodeId = stringValue(step.flowNodeId);
	if (!flowNodeId || !identifierPattern.test(flowNodeId)) {
		errors.push(`Step ${index + 1} flowNodeId is required and must be identifier-like.`);
	}
	return errors;
}

function normalizeStatus(value: unknown): VibeCodexPlanStepStatus {
	return knownStepStatuses.has(value as VibeCodexPlanStepStatus) ? value as VibeCodexPlanStepStatus : 'pending';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
