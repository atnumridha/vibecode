/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VibeCodexExecutionAuthorization, authorizationMatchesPlan, executionAuthorizationSummary } from './executionAuthorization';
import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { parseMermaidFlowchart, validateMermaidFlowchart } from './mermaidFlow';
import { VibeCodexPlanRevisionSnapshot, planRevisionHistorySummary } from './planHistory';
import { VibeCodexPlan, VibeCodexPlanStep, validatePlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexPlanStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeHistory: boolean;
	readonly includeRenderModel: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexPlanStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly revision?: number;
	readonly summary?: string;
	readonly plan?: VibeCodexPlan;
	readonly valid?: boolean;
	readonly validationErrors?: readonly string[];
	readonly renderStatus: VibeCodexPlanRenderStatus;
	readonly renderModel?: VibeCodexPlanRenderModel;
	readonly approvalReady: boolean;
	readonly approvalBlockedReason?: string;
	readonly approved: boolean;
	readonly mutationReady: boolean;
	readonly approvedTaskId?: string;
	readonly approvedRevision?: number;
	readonly approvedPlanHash?: string;
	readonly authorizationSummary: string;
	readonly historySummary: string;
	readonly history?: readonly VibeCodexPlanRevisionSnapshot[];
	readonly message: string;
}

export interface VibeCodexPlanRenderModel {
	readonly source: 'mermaid' | 'fallback_checklist' | 'none';
	readonly direction?: string;
	readonly nodes: readonly VibeCodexPlanRenderNode[];
	readonly edges: readonly VibeCodexPlanRenderEdge[];
	readonly checklist: readonly VibeCodexPlanRenderStep[];
	readonly highlightBindings: readonly VibeCodexPlanHighlightBinding[];
	readonly fallbackReason?: string;
	readonly message: string;
}

export interface VibeCodexPlanRenderNode {
	readonly id: string;
	readonly label: string;
	readonly stepIds: readonly string[];
	readonly status?: VibeCodexPlanStep['status'];
	readonly files?: readonly string[];
}

export interface VibeCodexPlanRenderEdge {
	readonly from: string;
	readonly to: string;
	readonly label?: string;
}

export interface VibeCodexPlanRenderStep {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexPlanStep['status'];
	readonly flowNodeId: string;
	readonly linked: boolean;
	readonly files?: readonly string[];
	readonly dependsOn?: readonly string[];
}

export interface VibeCodexPlanHighlightBinding {
	readonly flowNodeId: string;
	readonly nodeId?: string;
	readonly stepIds: readonly string[];
}

export interface VibeCodexPlanRenderStatus {
	readonly available: boolean;
	readonly safeMermaid: boolean;
	readonly graphValid: boolean;
	readonly fallbackRequired: boolean;
	readonly direction?: string;
	readonly nodeCount: number;
	readonly edgeCount: number;
	readonly stepCount: number;
	readonly linkedStepCount: number;
	readonly missingFlowNodeIds: readonly string[];
	readonly duplicateFlowNodeIds: readonly string[];
	readonly unlinkedNodeIds: readonly string[];
	readonly errors: readonly string[];
	readonly message: string;
}

export interface VibeCodexPlanStatusInput {
	readonly plan?: VibeCodexPlan;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly history?: readonly VibeCodexPlanRevisionSnapshot[];
}

const planStatusMethods = new Set([
	'agent/getPlanStatus',
	'agent/planStatus',
	'agent/getVisualPlanStatus',
	'agent/visualPlanStatus',
	'plan/status',
	'plan/renderStatus',
	'visualPlan/status',
	'vibecodex/planStatus',
]);

const planStatusToolNames = new Set([
	'plan_status',
	'get_plan_status',
	'visual_plan_status',
	'get_visual_plan_status',
	'plan_render_status',
	'get_plan_render_status',
]);

export function normalizePlanStatusRequest(message: JsonRpcMessage): VibeCodexPlanStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!planStatusMethods.has(message.method) && !isPlanStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const toolName = message.method === 'item/tool/call'
		? (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase()
		: '';
	const renderStatusRequest = /render/i.test(message.method) || toolName.includes('render');
	return {
		id: message.id,
		method: message.method,
		includeHistory: booleanValue(payload.includeHistory)
			?? booleanValue(payload.include_history)
			?? booleanValue(args.includeHistory)
			?? booleanValue(args.include_history)
			?? false,
		includeRenderModel: booleanValue(payload.includeRenderModel)
			?? booleanValue(payload.include_render_model)
			?? booleanValue(args.includeRenderModel)
			?? booleanValue(args.include_render_model)
			?? renderStatusRequest,
		requestedAt: Date.now(),
	};
}

export function createPlanStatusResponse(request: VibeCodexPlanStatusRequest, input: VibeCodexPlanStatusInput): VibeCodexPlanStatusResponse {
	const history = input.history ?? [];
	const validation = input.plan ? validatePlan(input.plan) : { valid: false, errors: ['No active visual plan is available.'] };
	const renderStatus = createPlanRenderStatus(input.plan);
	const renderModel = request.includeRenderModel ? createPlanRenderModel(input.plan, renderStatus) : undefined;
	const approved = authorizationMatchesPlan(input.authorization, input.plan);
	const approvalReady = !!input.plan && validation.valid;
	const approvalBlockedReason = approvalReady ? undefined : validation.errors[0] ?? 'Plan validation failed.';
	const plan = input.plan ? redactSensitiveValue(input.plan) as VibeCodexPlan : undefined;
	// Keep the raw approvalToken private; status callers only receive the redacted authorization summary.
	return {
		ok: !!input.plan,
		source: 'externalExtension',
		...(input.plan ? { taskId: redactSensitiveText(input.plan.taskId), revision: input.plan.revision, summary: redactSensitiveText(input.plan.summary) } : {}),
		...(plan ? { plan } : {}),
		valid: validation.valid,
		validationErrors: validation.errors,
		renderStatus,
		...(renderModel ? { renderModel } : {}),
		approvalReady,
		...(approvalBlockedReason ? { approvalBlockedReason } : {}),
		approved,
		mutationReady: approvalReady && approved,
		...(input.authorization ? { approvedTaskId: redactSensitiveText(input.authorization.taskId), approvedRevision: input.authorization.revision, approvedPlanHash: input.authorization.planHash } : {}),
		authorizationSummary: executionAuthorizationSummary(input.authorization),
		historySummary: planRevisionHistorySummary(history),
		...(request.includeHistory ? { history: redactSensitiveValue(history) as readonly VibeCodexPlanRevisionSnapshot[] } : {}),
		message: input.plan
			? `Plan ${input.plan.taskId} r${input.plan.revision} is ${approved ? 'approved' : 'not approved'} for execution${approvalReady ? '' : `; approval blocked: ${approvalBlockedReason}`}.`
			: 'No active visual plan is available.',
	};
}

export function planStatusSummary(response: VibeCodexPlanStatusResponse): string {
	return response.ok
		? `${response.message} ${response.valid ? 'Schema valid.' : `Schema invalid: ${(response.validationErrors ?? []).join('; ')}`} Render: ${response.renderStatus.message}`
		: response.message;
}

function createPlanRenderStatus(plan: VibeCodexPlan | undefined): VibeCodexPlanRenderStatus {
	if (!plan) {
		return {
			available: false,
			safeMermaid: false,
			graphValid: false,
			fallbackRequired: true,
			nodeCount: 0,
			edgeCount: 0,
			stepCount: 0,
			linkedStepCount: 0,
			missingFlowNodeIds: [],
			duplicateFlowNodeIds: [],
			unlinkedNodeIds: [],
			errors: ['No active visual plan is available.'],
			message: 'No renderable visual plan is available.',
		};
	}
	const mermaid = validateMermaidFlowchart(plan.flowchart);
	const flow = parseMermaidFlowchart(plan.flowchart, plan.steps);
	const nodeIds = new Set(flow.nodes.map(node => node.id));
	const stepFlowNodeIds = plan.steps.map(step => step.flowNodeId).filter(Boolean);
	const duplicateFlowNodeIds = duplicates(stepFlowNodeIds);
	const missingFlowNodeIds = stepFlowNodeIds.filter(id => !nodeIds.has(id));
	const stepNodeIds = new Set(stepFlowNodeIds);
	const unlinkedNodeIds = flow.nodes.map(node => node.id).filter(id => !stepNodeIds.has(id));
	const linkedStepCount = stepFlowNodeIds.length - missingFlowNodeIds.length;
	const errors = [...mermaid.errors, ...flow.errors].filter((value, index, all) => all.indexOf(value) === index);
	const graphValid = mermaid.valid && flow.valid;
	const fallbackRequired = !graphValid || missingFlowNodeIds.length > 0 || duplicateFlowNodeIds.length > 0;
	return {
		available: true,
		safeMermaid: mermaid.valid,
		graphValid,
		fallbackRequired,
		direction: flow.direction,
		nodeCount: flow.nodes.length,
		edgeCount: flow.edges.length,
		stepCount: plan.steps.length,
		linkedStepCount,
		missingFlowNodeIds: redactSensitiveValue(missingFlowNodeIds) as readonly string[],
		duplicateFlowNodeIds: redactSensitiveValue(duplicateFlowNodeIds) as readonly string[],
		unlinkedNodeIds: redactSensitiveValue(unlinkedNodeIds.slice(0, 32)) as readonly string[],
		errors: redactSensitiveValue(errors) as readonly string[],
		message: graphValid && !fallbackRequired
			? `Graph render-ready with ${flow.nodes.length} node${flow.nodes.length === 1 ? '' : 's'} and ${linkedStepCount}/${plan.steps.length} linked checklist step${plan.steps.length === 1 ? '' : 's'}.`
			: `Graph requires repair or fallback rendering; ${linkedStepCount}/${plan.steps.length} checklist step${plan.steps.length === 1 ? '' : 's'} linked.`,
	};
}

function createPlanRenderModel(plan: VibeCodexPlan | undefined, renderStatus: VibeCodexPlanRenderStatus): VibeCodexPlanRenderModel {
	if (!plan) {
		return {
			source: 'none',
			nodes: [],
			edges: [],
			checklist: [],
			highlightBindings: [],
			fallbackReason: 'No active visual plan is available.',
			message: 'No visual plan render model is available.',
		};
	}
	const flow = parseMermaidFlowchart(plan.flowchart, plan.steps);
	const useMermaid = flow.valid && flow.nodes.length > 0;
	const nodeIds = new Set(useMermaid ? flow.nodes.map(node => node.id) : plan.steps.map(step => step.flowNodeId));
	const stepsByNode = groupStepsByFlowNode(plan.steps);
	const checklist = plan.steps.map(step => renderStep(step, nodeIds.has(step.flowNodeId) || !useMermaid));
	const highlightBindings = [...stepsByNode.entries()].map(([flowNodeId, steps]) => ({
		flowNodeId: redactSensitiveText(flowNodeId),
		...(nodeIds.has(flowNodeId) ? { nodeId: redactSensitiveText(flowNodeId) } : {}),
		stepIds: steps.map(step => redactSensitiveText(step.id)),
	}));
	if (useMermaid) {
		const fallbackReason = renderStatus.fallbackRequired ? renderStatus.message : undefined;
		return {
			source: 'mermaid',
			direction: flow.direction,
			nodes: flow.nodes.map(node => renderNode(node.id, node.label, stepsByNode.get(node.id) ?? [])),
			edges: flow.edges.map(edge => ({
				from: redactSensitiveText(edge.from),
				to: redactSensitiveText(edge.to),
				...(edge.label ? { label: redactSensitiveText(edge.label) } : {}),
			})),
			checklist,
			highlightBindings,
			...(fallbackReason ? { fallbackReason: redactSensitiveText(fallbackReason) } : {}),
			message: renderStatus.fallbackRequired
				? 'Mermaid graph is renderable, but checklist bindings need repair before approval.'
				: 'Mermaid graph render model is ready.',
		};
	}
	return {
		source: 'fallback_checklist',
		direction: 'TD',
		nodes: plan.steps.map(step => renderNode(step.flowNodeId, step.title, [step])),
		edges: plan.steps.slice(0, -1).map((step, index) => ({
			from: redactSensitiveText(step.flowNodeId),
			to: redactSensitiveText(plan.steps[index + 1].flowNodeId),
		})),
		checklist,
		highlightBindings,
		fallbackReason: renderStatus.errors[0] ?? 'Mermaid graph was not renderable.',
		message: 'Checklist-derived fallback render model is available while Mermaid is repaired.',
	};
}

function renderNode(id: string, label: string, steps: readonly VibeCodexPlanStep[]): VibeCodexPlanRenderNode {
	const files = uniqueStrings(steps.flatMap(step => step.files ?? []));
	return {
		id: redactSensitiveText(id),
		label: redactSensitiveText(label),
		stepIds: steps.map(step => redactSensitiveText(step.id)),
		...(steps.length === 1 ? { status: steps[0].status } : {}),
		...(files.length ? { files: files.map(file => redactSensitiveText(file)) } : {}),
	};
}

function renderStep(step: VibeCodexPlanStep, linked: boolean): VibeCodexPlanRenderStep {
	const files = uniqueStrings(step.files ?? []);
	const dependsOn = uniqueStrings(step.dependsOn ?? []);
	return {
		id: redactSensitiveText(step.id),
		title: redactSensitiveText(step.title),
		status: step.status,
		flowNodeId: redactSensitiveText(step.flowNodeId),
		linked,
		...(files.length ? { files: files.map(file => redactSensitiveText(file)) } : {}),
		...(dependsOn.length ? { dependsOn: dependsOn.map(id => redactSensitiveText(id)) } : {}),
	};
}

function groupStepsByFlowNode(steps: readonly VibeCodexPlanStep[]): Map<string, readonly VibeCodexPlanStep[]> {
	const grouped = new Map<string, VibeCodexPlanStep[]>();
	for (const step of steps) {
		const existing = grouped.get(step.flowNodeId) ?? [];
		existing.push(step);
		grouped.set(step.flowNodeId, existing);
	}
	return grouped;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (trimmed && !seen.has(trimmed)) {
			seen.add(trimmed);
			result.push(trimmed);
		}
	}
	return result;
}

function duplicates(values: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const duplicate = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			duplicate.add(value);
		}
		seen.add(value);
	}
	return [...duplicate];
}

function isPlanStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return planStatusToolNames.has(tool);
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
