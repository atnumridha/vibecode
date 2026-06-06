/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { parseMermaidFlowchart, validateMermaidFlowchart } from './mermaidFlow';
import { applyPlanStepEdit } from './planEditing';
import type { VibeCodexPlan } from './planProtocol';
import { renderedPlanIdentity, validatePlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexPlanEditStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly stepId?: string;
	readonly title?: string;
	readonly status?: string;
	readonly includeEditedPlan: boolean;
	readonly includeRepairHints: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexPlanEditStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly activePlanAvailable: boolean;
	readonly editPresent: boolean;
	readonly changed: boolean;
	readonly valid: boolean;
	readonly approvalReady: boolean;
	readonly mutationLocked: true;
	readonly taskId?: string;
	readonly currentRevision?: number;
	readonly prospectiveRevision?: number;
	readonly previousPlanIdentity?: ReturnType<typeof renderedPlanIdentity>;
	readonly editedPlanIdentity?: ReturnType<typeof renderedPlanIdentity>;
	readonly stepId?: string;
	readonly requestedEdit: {
		readonly title?: string;
		readonly status?: string;
	};
	readonly changes: {
		readonly titleChanged: boolean;
		readonly statusChanged: boolean;
	};
	readonly validationErrors: readonly string[];
	readonly editErrors: readonly string[];
	readonly render: {
		readonly safeMermaid: boolean;
		readonly nodeCount: number;
		readonly edgeCount: number;
		readonly stepCount: number;
		readonly linkedStepCount: number;
	};
	readonly editedPlan?: VibeCodexPlan;
	readonly repairHints?: readonly string[];
	readonly promptBlock: string;
	readonly guardrails: readonly string[];
	readonly nextAction: 'wait_for_plan' | 'repair_edit' | 'no_change' | 'submit_manual_edit';
	readonly message: string;
}

export interface VibeCodexPlanEditStatusInput {
	readonly plan?: VibeCodexPlan;
}

const planEditStatusMethods = new Set([
	'agent/validatePlanEdit',
	'agent/getPlanEditStatus',
	'agent/planEditStatus',
	'visualPlan/editStatus',
	'plan/editStatus',
	'plan/edit/validate',
	'vibecodex/planEditStatus',
]);

const planEditStatusToolNames = new Set([
	'plan_edit_status',
	'visual_plan_edit_status',
	'validate_plan_edit',
	'plan_step_edit_status',
	'checklist_edit_status',
]);

export function normalizePlanEditStatusRequest(message: JsonRpcMessage): VibeCodexPlanEditStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!planEditStatusMethods.has(message.method) && !isPlanEditStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const stepId = stringValue(payload.stepId)
		?? stringValue(payload.step_id)
		?? stringValue(args.stepId)
		?? stringValue(args.step_id)
		?? stringValue(payload.id)
		?? stringValue(args.id);
	const title = stringValue(payload.title)
		?? stringValue(payload.stepTitle)
		?? stringValue(payload.step_title)
		?? stringValue(args.title)
		?? stringValue(args.stepTitle)
		?? stringValue(args.step_title);
	const status = stringValue(payload.status) ?? stringValue(args.status);
	return {
		id: message.id,
		method: message.method,
		...(stepId ? { stepId } : {}),
		...(title ? { title } : {}),
		...(status ? { status } : {}),
		includeEditedPlan: booleanValue(payload.includeEditedPlan)
			?? booleanValue(payload.include_edited_plan)
			?? booleanValue(args.includeEditedPlan)
			?? booleanValue(args.include_edited_plan)
			?? false,
		includeRepairHints: booleanValue(payload.includeRepairHints)
			?? booleanValue(payload.include_repair_hints)
			?? booleanValue(args.includeRepairHints)
			?? booleanValue(args.include_repair_hints)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createPlanEditStatusResponse(request: VibeCodexPlanEditStatusRequest, input: VibeCodexPlanEditStatusInput): VibeCodexPlanEditStatusResponse {
	const plan = input.plan;
	const requestedEdit = {
		...(request.title ? { title: redactSensitiveText(request.title) } : {}),
		...(request.status ? { status: redactSensitiveText(request.status) } : {}),
	};
	if (!plan) {
		return finalizeResponse(request, {
			ok: false,
			activePlanAvailable: false,
			editPresent: !!request.stepId,
			changed: false,
			valid: false,
			approvalReady: false,
			taskId: undefined,
			currentRevision: undefined,
			prospectiveRevision: undefined,
			previousPlanIdentity: undefined,
			editedPlanIdentity: undefined,
			stepId: request.stepId ? redactSensitiveText(request.stepId) : undefined,
			requestedEdit,
			changes: { titleChanged: false, statusChanged: false },
			validationErrors: ['No active visual plan is available.'],
			editErrors: ['No active visual plan is available.'],
			render: emptyRender(),
			editedPlan: undefined,
			nextAction: 'wait_for_plan',
			message: 'No active visual plan is available for manual edit preflight.',
		});
	}

	const previous = renderedPlanIdentity(plan);
	const stepId = request.stepId?.trim();
	if (!stepId) {
		return finalizeResponse(request, {
			ok: false,
			activePlanAvailable: true,
			editPresent: false,
			changed: false,
			valid: false,
			approvalReady: false,
			taskId: redactSensitiveText(plan.taskId),
			currentRevision: plan.revision,
			prospectiveRevision: plan.revision,
			previousPlanIdentity: previous,
			editedPlanIdentity: previous,
			stepId: undefined,
			requestedEdit,
			changes: { titleChanged: false, statusChanged: false },
			validationErrors: [],
			editErrors: ['Plan step id is required.'],
			render: renderSummary(plan),
			editedPlan: undefined,
			nextAction: 'repair_edit',
			message: `Plan ${plan.taskId} r${plan.revision} edit preflight needs a step id.`,
		});
	}

	const beforeStep = plan.steps.find(step => step.id === stepId);
	try {
		const edited = applyPlanStepEdit(plan, {
			stepId,
			...(request.title ? { title: request.title } : {}),
			...(request.status ? { status: request.status } : {}),
		});
		const afterStep = edited.steps.find(step => step.id === stepId);
		const validation = validatePlan(edited);
		const changed = edited !== plan;
		const editedIdentity = renderedPlanIdentity(edited);
		const titleChanged = !!beforeStep && !!afterStep && beforeStep.title !== afterStep.title;
		const statusChanged = !!beforeStep && !!afterStep && beforeStep.status !== afterStep.status;
		return finalizeResponse(request, {
			ok: true,
			activePlanAvailable: true,
			editPresent: true,
			changed,
			valid: validation.valid,
			approvalReady: changed && validation.valid,
			taskId: redactSensitiveText(edited.taskId),
			currentRevision: plan.revision,
			prospectiveRevision: edited.revision,
			previousPlanIdentity: previous,
			editedPlanIdentity: editedIdentity,
			stepId: redactSensitiveText(stepId),
			requestedEdit,
			changes: { titleChanged, statusChanged },
			validationErrors: redactSensitiveValue(validation.errors) as readonly string[],
			editErrors: [],
			render: renderSummary(edited),
			editedPlan: request.includeEditedPlan ? redactSensitiveValue(edited) as VibeCodexPlan : undefined,
			nextAction: changed ? validation.valid ? 'submit_manual_edit' : 'repair_edit' : 'no_change',
			message: changed
				? `Plan ${edited.taskId} manual edit preview would create r${edited.revision}; ${validation.valid ? 'ready for developer review before approval.' : `needs repair: ${validation.errors[0] ?? 'validation failed'}`}`
				: `Plan step ${stepId} is already up to date; no new revision is needed.`,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return finalizeResponse(request, {
			ok: false,
			activePlanAvailable: true,
			editPresent: true,
			changed: false,
			valid: false,
			approvalReady: false,
			taskId: redactSensitiveText(plan.taskId),
			currentRevision: plan.revision,
			prospectiveRevision: plan.revision,
			previousPlanIdentity: previous,
			editedPlanIdentity: previous,
			stepId: redactSensitiveText(stepId),
			requestedEdit,
			changes: { titleChanged: false, statusChanged: false },
			validationErrors: [],
			editErrors: [redactSensitiveText(message)],
			render: renderSummary(plan),
			editedPlan: undefined,
			nextAction: 'repair_edit',
			message: `Plan edit preflight failed: ${redactSensitiveText(message)}`,
		});
	}
}

export function planEditStatusSummary(response: VibeCodexPlanEditStatusResponse): string {
	return response.message;
}

const planEditStatusGuardrails = [
	'Plan edit status is read-only and never edits checklist steps, approves plans, writes files, runs tools, accepts diffs, restores checkpoints, or mutates workspace state.',
	'Manual edit preflight can preview a prospective revision and planHash, but execution remains locked until the edited plan is rendered and explicitly approved.',
	'Backends must submit manual checklist changes through the normal agent/updatePlan or UI manualStepEdit handoff before asking for agent/approvePlan.',
	'Returned titles, plans, validation errors, and prompt blocks are redacted before they are sent to the backend.',
];

type ResponseDraft = Omit<VibeCodexPlanEditStatusResponse, 'source' | 'mutationLocked' | 'guardrails' | 'promptBlock' | 'repairHints'>;

function finalizeResponse(request: VibeCodexPlanEditStatusRequest, draft: ResponseDraft): VibeCodexPlanEditStatusResponse {
	const repairHints = request.includeRepairHints ? createRepairHints(draft) : undefined;
	const responseWithoutPrompt = {
		...draft,
		source: 'externalExtension' as const,
		mutationLocked: true as const,
		...(repairHints ? { repairHints } : {}),
		guardrails: planEditStatusGuardrails,
	};
	return {
		...responseWithoutPrompt,
		promptBlock: JSON.stringify(redactSensitiveValue({
			type: 'vibecodex.visualPlanEditStatus',
			activePlanAvailable: responseWithoutPrompt.activePlanAvailable,
			editPresent: responseWithoutPrompt.editPresent,
			changed: responseWithoutPrompt.changed,
			valid: responseWithoutPrompt.valid,
			approvalReady: responseWithoutPrompt.approvalReady,
			mutationLocked: true,
			taskId: responseWithoutPrompt.taskId,
			currentRevision: responseWithoutPrompt.currentRevision,
			prospectiveRevision: responseWithoutPrompt.prospectiveRevision,
			previousPlanIdentity: responseWithoutPrompt.previousPlanIdentity,
			editedPlanIdentity: responseWithoutPrompt.editedPlanIdentity,
			stepId: responseWithoutPrompt.stepId,
			changes: responseWithoutPrompt.changes,
			validationErrors: responseWithoutPrompt.validationErrors,
			editErrors: responseWithoutPrompt.editErrors,
			render: responseWithoutPrompt.render,
			nextAction: responseWithoutPrompt.nextAction,
			repairHints,
			note: 'This is a read-only manual plan edit preflight. It is not approval and does not unlock mutation.',
		}), null, 2),
	};
}

function createRepairHints(response: ResponseDraft): readonly string[] {
	const hints = new Set<string>();
	if (!response.activePlanAvailable) {
		hints.add('Wait for agent/submitPlan or create a local fallback visual plan before previewing a manual edit.');
	}
	if (!response.editPresent) {
		hints.add('Provide a stepId matching an active checklist step.');
	}
	for (const error of response.editErrors) {
		if (/not found/i.test(error)) {
			hints.add('Call plan_focus_status or plan_status with includeRenderModel=true to discover valid step ids.');
		}
		if (/Unsupported plan step status/i.test(error)) {
			hints.add('Use one of: pending, in_progress, completed, blocked, failed.');
		}
		if (/required/i.test(error)) {
			hints.add('Provide a non-empty step id and at least one changed field.');
		}
	}
	for (const error of response.validationErrors) {
		if (/flowNodeId|Mermaid/i.test(error)) {
			hints.add('Keep checklist flowNodeId values linked to Mermaid graph nodes after editing.');
		}
		if (/dependsOn/i.test(error)) {
			hints.add('Ensure edited steps do not leave dependencies pointing at unknown step ids.');
		}
	}
	if (response.nextAction === 'no_change') {
		hints.add('No backend update is needed; the active rendered plan revision can stay unchanged.');
	}
	if (response.nextAction === 'submit_manual_edit') {
		hints.add('Submit the edited revision through agent/updatePlan or the UI manualStepEdit handoff, then wait for explicit user approval of the new planHash.');
	}
	return [...hints];
}

function renderSummary(plan: VibeCodexPlan): VibeCodexPlanEditStatusResponse['render'] {
	const mermaid = validateMermaidFlowchart(plan.flowchart);
	const flow = parseMermaidFlowchart(plan.flowchart, plan.steps);
	return {
		safeMermaid: mermaid.valid && flow.valid,
		nodeCount: flow.nodes.length,
		edgeCount: flow.edges.length,
		stepCount: plan.steps.length,
		linkedStepCount: plan.steps.filter(step => flow.nodes.some(node => node.id === step.flowNodeId)).length,
	};
}

function emptyRender(): VibeCodexPlanEditStatusResponse['render'] {
	return {
		safeMermaid: false,
		nodeCount: 0,
		edgeCount: 0,
		stepCount: 0,
		linkedStepCount: 0,
	};
}

function isPlanEditStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name)
		?? '').toLowerCase();
	return planEditStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = parseMaybeJson(payload.arguments ?? payload.args ?? payload.input ?? payload.params);
	if (!isRecord(args)) {
		return payload;
	}
	const nested = parseMaybeJson(args.arguments ?? args.args ?? args.input);
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const trimmed = value.trim();
	if (!trimmed || !/^[{[]/.test(trimmed)) {
		return value;
	}
	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return value;
	}
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
			return true;
		}
		if (normalized === 'false' || normalized === '0' || normalized === 'no') {
			return false;
		}
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
