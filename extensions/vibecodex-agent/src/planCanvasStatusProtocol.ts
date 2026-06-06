/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { authorizationMatchesPlan, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { parseMermaidFlowchart, validateMermaidFlowchart } from './mermaidFlow';
import { VibeCodexPlan, renderedPlanIdentity, validatePlan } from './planProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexPlanCanvasRoute =
	| 'await_visual_plan'
	| 'repair_schema'
	| 'repair_mermaid'
	| 'repair_bindings'
	| 'await_approval'
	| 'ready_for_execution';

export interface VibeCodexPlanCanvasStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeFeatures: boolean;
	readonly includePromptBlock: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexPlanCanvasFeature {
	readonly id: string;
	readonly title: string;
	readonly ready: boolean;
	readonly detail: string;
}

export interface VibeCodexPlanCanvasCachedGraph {
	readonly taskId?: string;
	readonly revision?: number;
	readonly planHash?: string;
	readonly nodes: number;
	readonly edges: number;
	readonly updatedAt: number;
}

export interface VibeCodexPlanCanvasStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly taskId?: string;
	readonly revision?: number;
	readonly planHash?: string;
	readonly route: VibeCodexPlanCanvasRoute;
	readonly ready: boolean;
	readonly approvalLocked: boolean;
	readonly graphSource: 'validated_mermaid' | 'last_valid_cached' | 'fallback_checklist' | 'none';
	readonly counts: {
		readonly features: number;
		readonly readyFeatures: number;
		readonly blockers: number;
		readonly nodes: number;
		readonly edges: number;
		readonly cachedNodes: number;
		readonly cachedEdges: number;
		readonly steps: number;
		readonly linkedSteps: number;
		readonly missingFlowNodeIds: number;
		readonly duplicateFlowNodeIds: number;
	};
	readonly features?: readonly VibeCodexPlanCanvasFeature[];
	readonly lastValidGraph?: VibeCodexPlanCanvasCachedGraph;
	readonly blockers: readonly string[];
	readonly nextAction: string;
	readonly promptBlock?: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexPlanCanvasStatusInput {
	readonly plan?: VibeCodexPlan;
	readonly authorization?: VibeCodexExecutionAuthorization;
	readonly lastValidGraph?: VibeCodexPlanCanvasCachedGraph;
}

const planCanvasStatusMethods = new Set([
	'agent/getPlanCanvasStatus',
	'agent/planCanvasStatus',
	'agent/getVisualPlanCanvasStatus',
	'visualPlan/canvasStatus',
	'plan/canvasStatus',
	'canvas/status',
	'vibecodex/planCanvasStatus',
]);

const planCanvasStatusToolNames = new Set([
	'plan_canvas_status',
	'visual_plan_canvas_status',
	'plan_render_canvas_status',
	'mermaid_canvas_status',
	'flowchart_canvas_status',
]);

export function normalizePlanCanvasStatusRequest(message: JsonRpcMessage): VibeCodexPlanCanvasStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!planCanvasStatusMethods.has(message.method) && !isPlanCanvasStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeFeatures: booleanValue(payload.includeFeatures)
			?? booleanValue(payload.include_features)
			?? booleanValue(args.includeFeatures)
			?? booleanValue(args.include_features)
			?? true,
		includePromptBlock: booleanValue(payload.includePromptBlock)
			?? booleanValue(payload.include_prompt_block)
			?? booleanValue(args.includePromptBlock)
			?? booleanValue(args.include_prompt_block)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createPlanCanvasStatusResponse(request: VibeCodexPlanCanvasStatusRequest, input: VibeCodexPlanCanvasStatusInput): VibeCodexPlanCanvasStatusResponse {
	const plan = input.plan;
	const validation = plan ? validatePlan(plan) : { valid: false, errors: ['No active visual plan is available.'] };
	const mermaid = plan ? validateMermaidFlowchart(plan.flowchart) : { valid: false, errors: ['No active visual plan is available.'] };
	const flow = plan ? parseMermaidFlowchart(plan.flowchart, plan.steps) : undefined;
	const nodeIds = new Set((flow?.nodes ?? []).map(node => node.id));
	const stepFlowNodeIds = plan?.steps.map(step => step.flowNodeId).filter(Boolean) ?? [];
	const missingFlowNodeIds = stepFlowNodeIds.filter(id => !nodeIds.has(id));
	const duplicateFlowNodeIds = duplicates(stepFlowNodeIds);
	const linkedSteps = stepFlowNodeIds.length - missingFlowNodeIds.length;
	const approved = authorizationMatchesPlan(input.authorization, plan);
	const mermaidValid = mermaid.valid && !!flow?.valid;
	const lastValidGraph = cachedGraphForPlan(plan, input.lastValidGraph);
	const features = createFeatures({
		planAvailable: !!plan,
		schemaValid: validation.valid,
		mermaidValid,
		bindingsValid: !!plan && missingFlowNodeIds.length === 0 && duplicateFlowNodeIds.length === 0,
		approved,
		lastValidGraph,
	});
	const blockers = createBlockers(plan, validation.errors, mermaid.errors, mermaidValid, missingFlowNodeIds, duplicateFlowNodeIds, approved, lastValidGraph);
	const route = routeFor(plan, validation.errors, mermaidValid, missingFlowNodeIds, duplicateFlowNodeIds, approved);
	const graphSource = graphSourceFor(plan, mermaidValid, missingFlowNodeIds, duplicateFlowNodeIds, lastValidGraph);
	const visibleNodes = graphSource === 'last_valid_cached' ? lastValidGraph?.nodes ?? 0 : flow?.nodes.length ?? 0;
	const visibleEdges = graphSource === 'last_valid_cached' ? lastValidGraph?.edges ?? 0 : flow?.edges.length ?? 0;
	const identity = plan ? renderedPlanIdentity(plan) : undefined;
	const response = {
		ok: !!plan,
		source: 'externalExtension' as const,
		version: 1 as const,
		...(identity ? { taskId: identity.taskId, revision: identity.revision, planHash: identity.planHash } : {}),
		route,
		ready: route === 'ready_for_execution',
		approvalLocked: !approved,
		graphSource,
		counts: {
			features: features.length,
			readyFeatures: features.filter(feature => feature.ready).length,
			blockers: blockers.length,
			nodes: visibleNodes,
			edges: visibleEdges,
			cachedNodes: lastValidGraph?.nodes ?? 0,
			cachedEdges: lastValidGraph?.edges ?? 0,
			steps: plan?.steps.length ?? 0,
			linkedSteps,
			missingFlowNodeIds: missingFlowNodeIds.length,
			duplicateFlowNodeIds: duplicateFlowNodeIds.length,
		},
		...(request.includeFeatures ? { features: redactSensitiveValue(features) as readonly VibeCodexPlanCanvasFeature[] } : {}),
		...(lastValidGraph ? { lastValidGraph: redactSensitiveValue(lastValidGraph) as VibeCodexPlanCanvasCachedGraph } : {}),
		blockers,
		nextAction: nextActionFor(route, blockers),
		guardrails: planCanvasGuardrails,
		message: plan
			? `Plan Canvas routes to ${route}: ${features.filter(feature => feature.ready).length}/${features.length} renderer features ready.`
			: 'No Plan Canvas status is available because no active visual plan has been rendered.',
	};
	return {
		...response,
		...(request.includePromptBlock ? { promptBlock: planCanvasPromptBlock(response) } : {}),
	};
}

export function planCanvasStatusSummary(response: VibeCodexPlanCanvasStatusResponse): string {
	return response.ok
		? `${response.message} Next: ${response.nextAction}`
		: response.message;
}

const planCanvasGuardrails = [
	'Plan Canvas status is read-only and never renders new backend content, approves plans, edits checklist steps, changes graph focus, runs tools, accepts diffs, or mutates workspace files.',
	'The sidebar renderer is offline/local: it uses the parsed Mermaid render model to draw SVG and does not load Mermaid or scripts from a CDN at runtime.',
	'The webview contract uses nonce-scoped scripts/styles, a strict CSP, local webview resources only, and no unsafe-inline script execution.',
	'Plan Canvas status reports graph/checklist binding coverage without changing UI focus or checklist state.',
	'last-valid graph retention and checklist-derived fallback rendering are UI safety behavior only; invalid or unlinked plans still require repair before approval, and cached graph evidence is reported without approving execution.',
	'Approval readiness still requires explicit user approval of the exact rendered taskId, revision, and planHash.',
];

function createFeatures(input: { readonly planAvailable: boolean; readonly schemaValid: boolean; readonly mermaidValid: boolean; readonly bindingsValid: boolean; readonly approved: boolean; readonly lastValidGraph?: VibeCodexPlanCanvasCachedGraph }): readonly VibeCodexPlanCanvasFeature[] {
	return [
		feature('offline-local-svg-renderer', 'Offline/local SVG renderer', true, 'The sidebar uses an offline/local SVG renderer for the parsed Mermaid graph model and does not import Mermaid from a CDN.'),
		feature('strict-webview-csp', 'Strict webview CSP', true, 'The installable sidebar uses nonce-scoped scripts/styles, webview-local resources, default-src none, and no unsafe-inline.'),
		feature('safe-mermaid-validation', 'Safe Mermaid validation', input.planAvailable && input.mermaidValid, input.planAvailable ? 'The active flowchart passes the local Mermaid safety/parser checks.' : 'Waiting for a visual plan with Mermaid graph source.'),
		feature('graph-checklist-bindings', 'Graph/checklist bindings', input.planAvailable && input.bindingsValid, input.planAvailable ? 'Every checklist flowNodeId must map to a graph node and duplicate flowNodeIds are blocked.' : 'Waiting for checklist steps with flowNodeId values.'),
		feature('focus-event-bridge', 'Graph/checklist focus bridge', true, 'Checklist hover/focus and graph hover/click emit read-only agent/planFocusChanged notifications with redacted binding evidence.'),
		feature('manual-checklist-revision', 'Manual checklist revisions', true, 'Step title/status edits create a new local revision and keep execution locked until the edited planHash is approved.'),
		feature('last-valid-graph-retention', 'Last valid graph retention', true, input.lastValidGraph
			? `A cached valid graph is available with ${input.lastValidGraph.nodes} nodes and ${input.lastValidGraph.edges} edges while streamed updates are repaired.`
			: 'If a streamed update breaks Mermaid syntax before a valid graph is cached, the UI reports checklist fallback until Mermaid validates.'),
		feature('approval-identity-lock', 'Exact approval identity lock', input.planAvailable && input.schemaValid, input.planAvailable ? 'Approve/refine/reject/edit actions carry taskId, revision, and planHash so stale clicks are rejected.' : 'Waiting for a rendered plan identity.'),
		feature('execution-authorization', 'Execution authorization', input.approved, input.approved ? 'The active rendered plan matches the current execution authorization.' : 'Execution remains locked until the exact rendered plan is approved.'),
	];
}

function feature(id: string, title: string, ready: boolean, detail: string): VibeCodexPlanCanvasFeature {
	return {
		id,
		title,
		ready,
		detail,
	};
}

function createBlockers(plan: VibeCodexPlan | undefined, validationErrors: readonly string[], mermaidErrors: readonly string[], mermaidValid: boolean, missingFlowNodeIds: readonly string[], duplicateFlowNodeIds: readonly string[], approved: boolean, lastValidGraph: VibeCodexPlanCanvasCachedGraph | undefined): readonly string[] {
	const blockers: string[] = [];
	if (!plan) {
		blockers.push('Render a structured VibeCodexPlan before asking for Plan Canvas readiness.');
	}
	for (const error of validationErrors.slice(0, 6)) {
		blockers.push(redactSensitiveText(error));
	}
	for (const error of mermaidErrors.slice(0, 4)) {
		if (!blockers.includes(error)) {
			blockers.push(redactSensitiveText(error));
		}
	}
	if (plan && !mermaidValid && !lastValidGraph) {
		blockers.push('No last valid graph cache is available yet; checklist fallback will render until Mermaid is repaired.');
	}
	if (missingFlowNodeIds.length) {
		blockers.push(`Missing graph nodes for checklist flowNodeIds: ${missingFlowNodeIds.slice(0, 8).map(id => redactSensitiveText(id)).join(', ')}.`);
	}
	if (duplicateFlowNodeIds.length) {
		blockers.push(`Duplicate checklist flowNodeIds: ${duplicateFlowNodeIds.slice(0, 8).map(id => redactSensitiveText(id)).join(', ')}.`);
	}
	if (plan && !approved) {
		blockers.push('Approve the exact rendered plan revision before execution can start.');
	}
	return uniqueStrings(blockers).slice(0, 12);
}

function routeFor(plan: VibeCodexPlan | undefined, validationErrors: readonly string[], mermaidValid: boolean, missingFlowNodeIds: readonly string[], duplicateFlowNodeIds: readonly string[], approved: boolean): VibeCodexPlanCanvasRoute {
	if (!plan) {
		return 'await_visual_plan';
	}
	if (!mermaidValid) {
		return 'repair_mermaid';
	}
	if (missingFlowNodeIds.length || duplicateFlowNodeIds.length) {
		return 'repair_bindings';
	}
	if (validationErrors.length) {
		return 'repair_schema';
	}
	if (!approved) {
		return 'await_approval';
	}
	return 'ready_for_execution';
}

function graphSourceFor(plan: VibeCodexPlan | undefined, mermaidValid: boolean, missingFlowNodeIds: readonly string[], duplicateFlowNodeIds: readonly string[], lastValidGraph: VibeCodexPlanCanvasCachedGraph | undefined): VibeCodexPlanCanvasStatusResponse['graphSource'] {
	if (!plan) {
		return 'none';
	}
	if (mermaidValid && !missingFlowNodeIds.length && !duplicateFlowNodeIds.length) {
		return 'validated_mermaid';
	}
	if (mermaidValid) {
		return 'fallback_checklist';
	}
	return lastValidGraph ? 'last_valid_cached' : 'fallback_checklist';
}

function nextActionFor(route: VibeCodexPlanCanvasRoute, blockers: readonly string[]): string {
	switch (route) {
		case 'await_visual_plan':
			return 'Submit agent/submitPlan or start a task so the sidebar can render Strategy, Mermaid flowchart, checklist, risks, and acceptance criteria.';
		case 'repair_mermaid':
			return blockers[0] ?? 'Repair the Mermaid graph source before approval.';
		case 'repair_bindings':
			return blockers.find(blocker => /flowNodeId|graph nodes/i.test(blocker)) ?? 'Repair checklist flowNodeId to Mermaid node bindings.';
		case 'repair_schema':
			return blockers[0] ?? 'Repair visual-plan schema fields before approval.';
		case 'await_approval':
			return 'Ask the developer to approve the exact rendered plan revision, or refine/reject/edit the plan first.';
		case 'ready_for_execution':
			return 'Proceed through the normal approval-gated Act/Agent execution loop.';
	}
}

function planCanvasPromptBlock(response: Omit<VibeCodexPlanCanvasStatusResponse, 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		tool: 'plan_canvas_status',
		route: response.route,
		ready: response.ready,
		graphSource: response.graphSource,
		taskId: response.taskId,
		revision: response.revision,
		planHash: response.planHash,
		counts: response.counts,
		lastValidGraph: response.lastValidGraph,
		blockers: response.blockers,
		nextAction: response.nextAction,
		authorization: response.approvalLocked ? 'locked' : 'exact plan approved',
		note: 'Plan Canvas status is read-only. Repair invalid graph/checklist state, then request explicit approval of the exact rendered planHash before mutating tools.',
	}), null, 2);
}

function cachedGraphForPlan(plan: VibeCodexPlan | undefined, graph: VibeCodexPlanCanvasCachedGraph | undefined): VibeCodexPlanCanvasCachedGraph | undefined {
	if (!plan || !graph) {
		return undefined;
	}
	if (graph.taskId && graph.taskId !== plan.taskId) {
		return undefined;
	}
	const nodes = finiteCount(graph.nodes);
	const edges = finiteCount(graph.edges);
	if (nodes <= 0) {
		return undefined;
	}
	return {
		...(graph.taskId ? { taskId: redactSensitiveText(graph.taskId) } : {}),
		...(typeof graph.revision === 'number' ? { revision: graph.revision } : {}),
		...(graph.planHash ? { planHash: redactSensitiveText(graph.planHash) } : {}),
		nodes,
		edges,
		updatedAt: typeof graph.updatedAt === 'number' && Number.isFinite(graph.updatedAt) ? graph.updatedAt : Date.now(),
	};
}

function finiteCount(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
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

function uniqueStrings(values: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		if (value && !seen.has(value)) {
			seen.add(value);
			result.push(value);
		}
	}
	return result;
}

function isPlanCanvasStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return planCanvasStatusToolNames.has(tool);
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
