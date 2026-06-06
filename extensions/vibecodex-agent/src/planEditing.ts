/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createLinearMermaidFlowchart } from './mermaidFlow';
import { VibeCodexPlan, VibeCodexPlanStep, VibeCodexPlanStepStatus } from './planProtocol';

export interface VibeCodexPlanStepEdit {
	readonly stepId: string;
	readonly title?: string;
	readonly status?: string;
}

export interface VibeCodexPlanRemediation {
	readonly reason: string;
	readonly evidence?: string;
	readonly failedStepHint?: string;
}

const knownStatuses = new Set<VibeCodexPlanStepStatus>(['pending', 'in_progress', 'completed', 'blocked', 'failed']);

export function applyPlanStepEdit(plan: VibeCodexPlan, edit: VibeCodexPlanStepEdit): VibeCodexPlan {
	const stepId = edit.stepId.trim();
	if (!stepId) {
		throw new Error('Plan step id is required.');
	}
	const status = normalizeStepStatus(edit.status);
	const title = edit.title?.trim();
	let changed = false;
	let found = false;
	const steps = plan.steps.map(step => {
		if (step.id !== stepId) {
			return step;
		}
		found = true;
		const next: VibeCodexPlanStep = {
			...step,
			...(title ? { title } : {}),
			...(status ? { status } : {}),
		};
		changed = next.title !== step.title || next.status !== step.status;
		return next;
	});
	if (!found) {
		throw new Error(`Plan step ${stepId} was not found.`);
	}
	if (!changed) {
		return plan;
	}
	const revision = plan.revision + 1;
	return {
		...plan,
		revision,
		steps,
		flowchart: createLinearMermaidFlowchart(steps),
		strategy: [
			plan.strategy,
			`Revision ${revision}: user adjusted checklist step ${stepId}.`,
		].join('\n\n'),
	};
}

export function planStepEditSummary(plan: VibeCodexPlan, previousRevision: number): string {
	return `Plan ${plan.taskId} revised locally from r${previousRevision} to r${plan.revision}.`;
}

export function applyPlanRemediation(plan: VibeCodexPlan, remediation: VibeCodexPlanRemediation): VibeCodexPlan {
	const reason = compactLine(remediation.reason) || 'Terminal verification failed';
	const revision = plan.revision + 1;
	const anchor = remediationAnchorStep(plan.steps, remediation.failedStepHint);
	const remediationStep: VibeCodexPlanStep = {
		id: uniqueStepId(plan.steps, `remediate-${revision}`),
		title: `Remediate failure: ${reason}`.slice(0, 180),
		status: 'pending',
		...(anchor ? { dependsOn: [anchor.id] } : {}),
		flowNodeId: uniqueFlowNodeId(plan.steps, `R${revision}`),
	};
	const steps = [
		...plan.steps.map(step => anchor && step.id === anchor.id ? { ...step, status: 'failed' as const } : step),
		remediationStep,
	];
	return {
		...plan,
		revision,
		steps,
		flowchart: createLinearMermaidFlowchart(steps),
		strategy: [
			plan.strategy,
			`Revision ${revision}: terminal evidence requires a remediation pass before continuing execution.`,
			remediation.evidence ? `Failure evidence: ${compactLine(remediation.evidence).slice(0, 700)}` : undefined,
		].filter((line): line is string => !!line).join('\n\n'),
		risks: [
			...plan.risks,
			`Terminal remediation required: ${reason}`,
		],
	};
}

function normalizeStepStatus(value: string | undefined): VibeCodexPlanStepStatus | undefined {
	if (value === undefined || value.trim() === '') {
		return undefined;
	}
	const normalized = value.trim() as VibeCodexPlanStepStatus;
	if (!knownStatuses.has(normalized)) {
		throw new Error(`Unsupported plan step status: ${value}`);
	}
	return normalized;
}

function remediationAnchorStep(steps: readonly VibeCodexPlanStep[], hint: string | undefined): VibeCodexPlanStep | undefined {
	const normalizedHint = hint?.toLowerCase() ?? '';
	return steps.find(step => normalizedHint && (step.id.toLowerCase() === normalizedHint || step.title.toLowerCase().includes(normalizedHint)))
		?? steps.find(step => /(verify|test|lint|build|typecheck|diagnostic)/i.test(`${step.id} ${step.title}`))
		?? steps.find(step => /(execute|terminal|run|tool)/i.test(`${step.id} ${step.title}`))
		?? steps.find(step => step.status === 'in_progress')
		?? steps.find(step => step.status === 'pending');
}

function uniqueStepId(steps: readonly VibeCodexPlanStep[], base: string): string {
	const existing = new Set(steps.map(step => step.id));
	if (!existing.has(base)) {
		return base;
	}
	for (let index = 2; index < 100; index++) {
		const candidate = `${base}-${index}`;
		if (!existing.has(candidate)) {
			return candidate;
		}
	}
	return `${base}-${Date.now().toString(36)}`;
}

function uniqueFlowNodeId(steps: readonly VibeCodexPlanStep[], base: string): string {
	const existing = new Set(steps.map(step => step.flowNodeId));
	if (!existing.has(base)) {
		return base;
	}
	for (let index = 2; index < 100; index++) {
		const candidate = `${base}${index}`;
		if (!existing.has(candidate)) {
			return candidate;
		}
	}
	return `${base}${Date.now().toString(36)}`;
}

function compactLine(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}
