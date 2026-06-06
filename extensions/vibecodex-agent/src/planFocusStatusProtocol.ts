/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { parseMermaidFlowchart } from './mermaidFlow';
import type { VibeCodexPlan, VibeCodexPlanStep, VibeCodexPlanStepStatus } from './planProtocol';
import { validatePlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexPlanFocusStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly stepId?: string;
	readonly flowNodeId?: string;
	readonly file?: string;
	readonly includeBindings: boolean;
	readonly includeGraph: boolean;
	readonly includeFiles: boolean;
	readonly includeRepairHints: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexPlanFocusBinding {
	readonly flowNodeId: string;
	readonly nodeId?: string;
	readonly graphNodePresent: boolean;
	readonly stepIds: readonly string[];
	readonly stepTitles: readonly string[];
	readonly statuses: Record<VibeCodexPlanStepStatus, number>;
	readonly files?: readonly string[];
}

export interface VibeCodexPlanFocusSelection {
	readonly available: boolean;
	readonly matched: boolean;
	readonly requestedBy: 'step' | 'flowNode' | 'file' | 'none';
	readonly stepId?: string;
	readonly flowNodeId?: string;
	readonly nodeId?: string;
	readonly graphNodePresent: boolean;
	readonly checklistLinked: boolean;
	readonly stepIds: readonly string[];
	readonly steps: readonly {
		readonly id: string;
		readonly title: string;
		readonly status: VibeCodexPlanStepStatus;
		readonly flowNodeId: string;
		readonly files?: readonly string[];
		readonly dependsOn?: readonly string[];
	}[];
	readonly files?: readonly string[];
	readonly message: string;
}

export interface VibeCodexPlanFocusStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly taskId?: string;
	readonly revision?: number;
	readonly valid: boolean;
	readonly validationErrors: readonly string[];
	readonly counts: {
		readonly steps: number;
		readonly graphNodes: number;
		readonly graphEdges: number;
		readonly bindings: number;
		readonly linkedBindings: number;
		readonly missingGraphNodes: number;
		readonly duplicateFlowNodeIds: number;
	};
	readonly target: {
		readonly stepId?: string;
		readonly flowNodeId?: string;
		readonly file?: string;
	};
	readonly focus: VibeCodexPlanFocusSelection;
	readonly bindings?: readonly VibeCodexPlanFocusBinding[];
	readonly graph?: {
		readonly direction?: string;
		readonly nodes: readonly { readonly id: string; readonly label: string }[];
		readonly edges: readonly { readonly from: string; readonly to: string; readonly label?: string }[];
	};
	readonly repairHints?: readonly string[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexPlanFocusStatusInput {
	readonly plan?: VibeCodexPlan;
}

const planFocusStatusMethods = new Set([
	'agent/getPlanFocusStatus',
	'agent/planFocusStatus',
	'agent/getVisualPlanFocusStatus',
	'visualPlan/focusStatus',
	'plan/focusStatus',
	'plan/focus',
	'vibecodex/planFocusStatus',
]);

const planFocusStatusToolNames = new Set([
	'plan_focus_status',
	'visual_plan_focus_status',
	'visual_plan_focus',
	'flow_node_status',
	'flowchart_node_status',
	'checklist_focus_status',
]);

const stepStatuses: readonly VibeCodexPlanStepStatus[] = ['pending', 'in_progress', 'completed', 'blocked', 'failed'];

export function normalizePlanFocusStatusRequest(message: JsonRpcMessage): VibeCodexPlanFocusStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!planFocusStatusMethods.has(message.method) && !isPlanFocusStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const stepId = stringValue(payload.stepId) ?? stringValue(payload.step_id) ?? stringValue(args.stepId) ?? stringValue(args.step_id);
	const flowNodeId = stringValue(payload.flowNodeId) ?? stringValue(payload.flow_node_id) ?? stringValue(args.flowNodeId) ?? stringValue(args.flow_node_id) ?? stringValue(payload.nodeId) ?? stringValue(args.nodeId);
	const file = stringValue(payload.file) ?? stringValue(payload.path) ?? stringValue(args.file) ?? stringValue(args.path);
	return {
		id: message.id,
		method: message.method,
		...(stepId ? { stepId } : {}),
		...(flowNodeId ? { flowNodeId } : {}),
		...(file ? { file } : {}),
		includeBindings: booleanValue(payload.includeBindings)
			?? booleanValue(payload.include_bindings)
			?? booleanValue(args.includeBindings)
			?? booleanValue(args.include_bindings)
			?? true,
		includeGraph: booleanValue(payload.includeGraph)
			?? booleanValue(payload.include_graph)
			?? booleanValue(args.includeGraph)
			?? booleanValue(args.include_graph)
			?? false,
		includeFiles: booleanValue(payload.includeFiles)
			?? booleanValue(payload.include_files)
			?? booleanValue(args.includeFiles)
			?? booleanValue(args.include_files)
			?? true,
		includeRepairHints: booleanValue(payload.includeRepairHints)
			?? booleanValue(payload.include_repair_hints)
			?? booleanValue(args.includeRepairHints)
			?? booleanValue(args.include_repair_hints)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createPlanFocusStatusResponse(request: VibeCodexPlanFocusStatusRequest, input: VibeCodexPlanFocusStatusInput): VibeCodexPlanFocusStatusResponse {
	const plan = input.plan;
	if (!plan) {
		return {
			ok: false,
			source: 'externalExtension',
			valid: false,
			validationErrors: ['No active visual plan is available.'],
			counts: emptyCounts(),
			target: redactedTarget(request),
			focus: {
				available: false,
				matched: false,
				requestedBy: requestedBy(request),
				graphNodePresent: false,
				checklistLinked: false,
				stepIds: [],
				steps: [],
				message: 'No active visual plan is available for graph/checklist focus.',
			},
			...(request.includeRepairHints ? { repairHints: ['Wait for agent/submitPlan or create a local fallback plan before asking for plan focus status.'] } : {}),
			guardrails: planFocusGuardrails,
			message: 'No active visual plan is available.',
		};
	}

	const validation = validatePlan(plan);
	const flow = parseMermaidFlowchart(plan.flowchart, plan.steps);
	const nodeIds = new Set(flow.nodes.map(node => node.id));
	const bindings = createBindings(plan.steps, nodeIds, request.includeFiles);
	const focus = createFocusSelection(request, plan.steps, nodeIds, request.includeFiles);
	const missingGraphNodes = bindings.filter(binding => !binding.graphNodePresent).length;
	const duplicateFlowNodeIds = duplicateCount(plan.steps.map(step => step.flowNodeId));
	return {
		ok: true,
		source: 'externalExtension',
		taskId: redactSensitiveText(plan.taskId),
		revision: plan.revision,
		valid: validation.valid,
		validationErrors: redactSensitiveValue(validation.errors) as readonly string[],
		counts: {
			steps: plan.steps.length,
			graphNodes: flow.nodes.length,
			graphEdges: flow.edges.length,
			bindings: bindings.length,
			linkedBindings: bindings.length - missingGraphNodes,
			missingGraphNodes,
			duplicateFlowNodeIds,
		},
		target: redactedTarget(request),
		focus,
		...(request.includeBindings ? { bindings } : {}),
		...(request.includeGraph ? {
			graph: {
				direction: flow.direction,
				nodes: flow.nodes.map(node => ({ id: redactSensitiveText(node.id), label: redactSensitiveText(node.label) })),
				edges: flow.edges.map(edge => ({
					from: redactSensitiveText(edge.from),
					to: redactSensitiveText(edge.to),
					...(edge.label ? { label: redactSensitiveText(edge.label) } : {}),
				})),
			},
		} : {}),
		...(request.includeRepairHints ? { repairHints: repairHints(request, validation.errors, focus, bindings) } : {}),
		guardrails: planFocusGuardrails,
		message: focus.matched
			? `Plan focus target ${focus.flowNodeId ?? focus.stepId ?? request.file ?? 'selection'} maps to ${focus.stepIds.length} checklist step${focus.stepIds.length === 1 ? '' : 's'}.`
			: focus.message,
	};
}

export function planFocusStatusSummary(response: VibeCodexPlanFocusStatusResponse): string {
	return response.ok
		? `Plan focus ${response.focus.matched ? 'matched' : 'unmatched'}; ${response.counts.linkedBindings}/${response.counts.bindings} graph/checklist bindings linked.`
		: response.message;
}

const planFocusGuardrails = [
	'Plan focus status is read-only and never changes the selected graph node, edits checklist steps, approves plans, writes files, runs tools, restores checkpoints, or mutates workspace state.',
	'Graph/checklist focus is advisory only; execution remains locked until the exact visual plan revision is approved.',
	'Returned graph nodes, checklist steps, files, and repair hints are redacted before they are sent to the backend.',
];

function createFocusSelection(request: VibeCodexPlanFocusStatusRequest, steps: readonly VibeCodexPlanStep[], nodeIds: ReadonlySet<string>, includeFiles: boolean): VibeCodexPlanFocusSelection {
	const by = requestedBy(request);
	const matchedSteps = matchedPlanSteps(request, steps);
	const flowNodeId = request.flowNodeId ?? matchedSteps[0]?.flowNodeId;
	const graphNodePresent = !!flowNodeId && nodeIds.has(flowNodeId);
	const files = includeFiles ? uniqueStrings(matchedSteps.flatMap(step => step.files ?? [])).map(file => redactSensitiveText(file)) : [];
	return {
		available: true,
		matched: matchedSteps.length > 0,
		requestedBy: by,
		...(request.stepId ? { stepId: redactSensitiveText(request.stepId) } : {}),
		...(flowNodeId ? { flowNodeId: redactSensitiveText(flowNodeId) } : {}),
		...(graphNodePresent && flowNodeId ? { nodeId: redactSensitiveText(flowNodeId) } : {}),
		graphNodePresent,
		checklistLinked: matchedSteps.length > 0 && graphNodePresent,
		stepIds: matchedSteps.map(step => redactSensitiveText(step.id)),
		steps: matchedSteps.map(step => redactedStep(step, includeFiles)),
		...(includeFiles && files.length ? { files } : {}),
		message: matchedSteps.length
			? `Focus target is linked to ${matchedSteps.length} checklist step${matchedSteps.length === 1 ? '' : 's'}.`
			: unmatchedMessage(by, graphNodePresent),
	};
}

function matchedPlanSteps(request: VibeCodexPlanFocusStatusRequest, steps: readonly VibeCodexPlanStep[]): readonly VibeCodexPlanStep[] {
	if (request.stepId) {
		return steps.filter(step => step.id === request.stepId);
	}
	if (request.flowNodeId) {
		return steps.filter(step => step.flowNodeId === request.flowNodeId);
	}
	if (request.file) {
		const wanted = normalizePath(request.file);
		return steps.filter(step => (step.files ?? []).some(file => normalizePath(file) === wanted));
	}
	return [];
}

function createBindings(steps: readonly VibeCodexPlanStep[], nodeIds: ReadonlySet<string>, includeFiles: boolean): readonly VibeCodexPlanFocusBinding[] {
	const grouped = new Map<string, VibeCodexPlanStep[]>();
	for (const step of steps) {
		const existing = grouped.get(step.flowNodeId) ?? [];
		existing.push(step);
		grouped.set(step.flowNodeId, existing);
	}
	return [...grouped.entries()].map(([flowNodeId, groupedSteps]) => {
		const graphNodePresent = nodeIds.has(flowNodeId);
		const files = includeFiles ? uniqueStrings(groupedSteps.flatMap(step => step.files ?? [])).map(file => redactSensitiveText(file)) : [];
		return {
			flowNodeId: redactSensitiveText(flowNodeId),
			...(graphNodePresent ? { nodeId: redactSensitiveText(flowNodeId) } : {}),
			graphNodePresent,
			stepIds: groupedSteps.map(step => redactSensitiveText(step.id)),
			stepTitles: groupedSteps.map(step => redactSensitiveText(step.title)),
			statuses: statusCounts(groupedSteps),
			...(includeFiles && files.length ? { files } : {}),
		};
	});
}

function redactedStep(step: VibeCodexPlanStep, includeFiles: boolean): VibeCodexPlanFocusSelection['steps'][number] {
	const files = includeFiles ? uniqueStrings(step.files ?? []).map(file => redactSensitiveText(file)) : [];
	const dependsOn = uniqueStrings(step.dependsOn ?? []).map(id => redactSensitiveText(id));
	return {
		id: redactSensitiveText(step.id),
		title: redactSensitiveText(step.title),
		status: step.status,
		flowNodeId: redactSensitiveText(step.flowNodeId),
		...(includeFiles && files.length ? { files } : {}),
		...(dependsOn.length ? { dependsOn } : {}),
	};
}

function statusCounts(steps: readonly VibeCodexPlanStep[]): Record<VibeCodexPlanStepStatus, number> {
	return Object.fromEntries(stepStatuses.map(status => [status, steps.filter(step => step.status === status).length])) as Record<VibeCodexPlanStepStatus, number>;
}

function repairHints(request: VibeCodexPlanFocusStatusRequest, validationErrors: readonly string[], focus: VibeCodexPlanFocusSelection, bindings: readonly VibeCodexPlanFocusBinding[]): readonly string[] {
	const hints: string[] = [];
	if (validationErrors.length) {
		hints.push(...validationErrors.slice(0, 4));
	}
	if (!focus.matched && request.stepId) {
		hints.push(`No checklist step id "${redactSensitiveText(request.stepId)}" exists in the active plan.`);
	}
	if (!focus.matched && request.flowNodeId) {
		hints.push(`No checklist step is bound to flowNodeId "${redactSensitiveText(request.flowNodeId)}".`);
	}
	if (!focus.matched && request.file) {
		hints.push(`No checklist step lists file "${redactSensitiveText(request.file)}".`);
	}
	if (focus.matched && !focus.graphNodePresent && focus.flowNodeId) {
		hints.push(`Add node "${focus.flowNodeId}" to the Mermaid graph or update the step flowNodeId.`);
	}
	if (bindings.some(binding => !binding.graphNodePresent)) {
		hints.push('Repair missing Mermaid graph nodes so checklist hover and graph-node focus stay synchronized.');
	}
	if (!hints.length) {
		hints.push('Plan focus bindings are ready for checklist hover, graph-node click, and related-file focus in the webview.');
	}
	return uniqueStrings(hints).slice(0, 8);
}

function unmatchedMessage(by: VibeCodexPlanFocusSelection['requestedBy'], graphNodePresent: boolean): string {
	if (by === 'none') {
		return 'No specific step, flow node, or file focus target was requested; returning available plan bindings.';
	}
	if (by === 'flowNode' && graphNodePresent) {
		return 'The Mermaid node exists, but no checklist step is bound to it.';
	}
	return 'Requested plan focus target did not match the active checklist.';
}

function requestedBy(request: VibeCodexPlanFocusStatusRequest): VibeCodexPlanFocusSelection['requestedBy'] {
	if (request.stepId) {
		return 'step';
	}
	if (request.flowNodeId) {
		return 'flowNode';
	}
	if (request.file) {
		return 'file';
	}
	return 'none';
}

function redactedTarget(request: VibeCodexPlanFocusStatusRequest): VibeCodexPlanFocusStatusResponse['target'] {
	return {
		...(request.stepId ? { stepId: redactSensitiveText(request.stepId) } : {}),
		...(request.flowNodeId ? { flowNodeId: redactSensitiveText(request.flowNodeId) } : {}),
		...(request.file ? { file: redactSensitiveText(request.file) } : {}),
	};
}

function emptyCounts(): VibeCodexPlanFocusStatusResponse['counts'] {
	return {
		steps: 0,
		graphNodes: 0,
		graphEdges: 0,
		bindings: 0,
		linkedBindings: 0,
		missingGraphNodes: 0,
		duplicateFlowNodeIds: 0,
	};
}

function duplicateCount(values: readonly string[]): number {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			duplicates.add(value);
		}
		seen.add(value);
	}
	return duplicates.size;
}

function isPlanFocusStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return planFocusStatusToolNames.has(tool);
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

function normalizePath(value: string): string {
	return value.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
