/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexMermaidFlow, parseMermaidFlowchart, validateMermaidFlowchart } from './mermaidFlow';
import { VibeCodexPlan, validatePlan } from './planProtocol';
import { redactSensitiveValue } from './secretFilters';

export interface VibeCodexPlanValidationRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly candidate: unknown;
	readonly candidatePresent: boolean;
	readonly includeCandidate: boolean;
	readonly includeRepairHints: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexPlanValidationResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly candidatePresent: boolean;
	readonly valid: boolean;
	readonly approvalReady: boolean;
	readonly taskId?: string;
	readonly revision?: number;
	readonly summary?: string;
	readonly validationErrors: readonly string[];
	readonly warnings: readonly string[];
	readonly repairHints?: readonly string[];
	readonly counts: {
		readonly steps: number;
		readonly files: number;
		readonly risks: number;
		readonly acceptanceCriteria: number;
		readonly pending: number;
		readonly inProgress: number;
		readonly completed: number;
		readonly blocked: number;
		readonly failed: number;
		readonly dependencies: number;
	};
	readonly mermaid: {
		readonly valid: boolean;
		readonly direction?: string;
		readonly nodeCount: number;
		readonly edgeCount: number;
		readonly missingFlowNodeIds: readonly string[];
		readonly duplicateFlowNodeIds: readonly string[];
		readonly errors: readonly string[];
	};
	readonly candidate?: unknown;
	readonly promptBlock: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

const planValidationMethods = new Set([
	'agent/validatePlan',
	'agent/planValidation',
	'plan/validate',
	'plan/validation',
	'visualPlan/validate',
	'vibecodex/validatePlan',
]);

const planValidationToolNames = new Set([
	'visual_plan_validate',
	'validate_plan',
	'plan_validate',
	'plan_validation',
	'check_plan',
]);

const identifierPattern = /^[a-zA-Z0-9_.:-]+$/;

export function normalizePlanValidationRequest(message: JsonRpcMessage): VibeCodexPlanValidationRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const directParams = parseMaybeJson(message.params);
	const payload = isRecord(directParams) ? directParams : {};
	const args = argumentRecord(payload);
	if (!planValidationMethods.has(message.method) && !isPlanValidationToolCall(message.method, payload, args)) {
		return undefined;
	}
	const candidate = extractCandidatePlan(directParams, payload, args);
	return {
		id: message.id,
		method: message.method,
		candidate,
		candidatePresent: candidate !== undefined,
		includeCandidate: booleanValue(payload.includeCandidate)
			?? booleanValue(payload.include_candidate)
			?? booleanValue(args.includeCandidate)
			?? booleanValue(args.include_candidate)
			?? false,
		includeRepairHints: booleanValue(payload.includeRepairHints)
			?? booleanValue(payload.include_repair_hints)
			?? booleanValue(args.includeRepairHints)
			?? booleanValue(args.include_repair_hints)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createPlanValidationResponse(request: VibeCodexPlanValidationRequest): VibeCodexPlanValidationResponse {
	const candidate = request.candidate;
	const validation = request.candidatePresent
		? validatePlan(candidate)
		: { valid: false, errors: ['No candidate visual plan was provided.'] };
	const mermaid = mermaidSummary(candidate);
	const warnings = planWarnings(candidate);
	const counts = countPlan(candidate);
	const taskId = recordString(candidate, 'taskId');
	const revision = recordNumber(candidate, 'revision');
	const summary = redactString(recordString(candidate, 'summary'));
	const repairHints = request.includeRepairHints ? createRepairHints(validation.errors, warnings, mermaid, request.candidatePresent) : undefined;
	const responseWithoutPrompt = {
		ok: request.candidatePresent,
		source: 'externalExtension' as const,
		candidatePresent: request.candidatePresent,
		valid: validation.valid,
		approvalReady: validation.valid,
		...(taskId ? { taskId } : {}),
		...(revision !== undefined ? { revision } : {}),
		...(summary ? { summary } : {}),
		validationErrors: validation.errors,
		warnings,
		...(repairHints ? { repairHints } : {}),
		counts,
		mermaid,
		...(request.includeCandidate ? { candidate: redactSensitiveValue(candidate) } : {}),
		guardrails: planValidationGuardrails,
		message: planValidationMessage(validation.valid, request.candidatePresent, taskId, revision, counts, validation.errors, warnings),
	};
	return {
		...responseWithoutPrompt,
		promptBlock: JSON.stringify(redactSensitiveValue({
			type: 'vibecodex.visualPlanValidation',
			valid: responseWithoutPrompt.valid,
			approvalReady: responseWithoutPrompt.approvalReady,
			taskId: responseWithoutPrompt.taskId,
			revision: responseWithoutPrompt.revision,
			summary: responseWithoutPrompt.summary,
			counts: responseWithoutPrompt.counts,
			mermaid: responseWithoutPrompt.mermaid,
			validationErrors: responseWithoutPrompt.validationErrors,
			warnings: responseWithoutPrompt.warnings,
			repairHints: responseWithoutPrompt.repairHints,
			note: 'Repair the candidate plan, then submit it through agent/submitPlan or agent/updatePlan. This validation result is not an approval token.',
		}), null, 2),
	};
}

export function planValidationSummary(response: VibeCodexPlanValidationResponse): string {
	return response.message;
}

const planValidationGuardrails = [
	'Plan validation is read-only and never renders a plan, approves a revision, runs tools, mutates files, or unlocks execution.',
	'Approval readiness only means the candidate passes schema, safe Mermaid, flow-node linkage, and dependency validation; the user must still approve the exact rendered revision.',
	'Candidate plans and repair diagnostics are redacted before they are returned to the backend or shown in protocol diagnostics.',
];

function mermaidSummary(candidate: unknown): VibeCodexPlanValidationResponse['mermaid'] {
	const flowchart = recordString(candidate, 'flowchart');
	if (!flowchart) {
		return {
			valid: false,
			nodeCount: 0,
			edgeCount: 0,
			missingFlowNodeIds: stepFlowNodeIds(candidate),
			duplicateFlowNodeIds: duplicateFlowNodeIds(candidate),
			errors: ['Mermaid flowchart is required.'],
		};
	}
	const validation = validateMermaidFlowchart(flowchart);
	const parsed = parseMermaidFlowchart(flowchart) as VibeCodexMermaidFlow;
	return {
		valid: validation.valid,
		direction: parsed.direction,
		nodeCount: parsed.nodes.length,
		edgeCount: parsed.edges.length,
		missingFlowNodeIds: missingFlowNodeIds(candidate, parsed),
		duplicateFlowNodeIds: duplicateFlowNodeIds(candidate),
		errors: [...new Set([...validation.errors, ...parsed.errors])],
	};
}

function countPlan(candidate: unknown): VibeCodexPlanValidationResponse['counts'] {
	const steps = planSteps(candidate);
	const files = new Set<string>();
	let dependencies = 0;
	let pending = 0;
	let inProgress = 0;
	let completed = 0;
	let blocked = 0;
	let failed = 0;
	for (const step of steps) {
		for (const file of arrayStrings(step.files)) {
			files.add(file);
		}
		dependencies += arrayStrings(step.dependsOn).length;
		switch (step.status) {
			case 'in_progress':
				inProgress++;
				break;
			case 'completed':
				completed++;
				break;
			case 'blocked':
				blocked++;
				break;
			case 'failed':
				failed++;
				break;
			default:
				pending++;
				break;
		}
	}
	return {
		steps: steps.length,
		files: files.size,
		risks: arrayStrings(recordValue(candidate, 'risks')).length,
		acceptanceCriteria: arrayStrings(recordValue(candidate, 'acceptanceCriteria')).length,
		pending,
		inProgress,
		completed,
		blocked,
		failed,
		dependencies,
	};
}

function planWarnings(candidate: unknown): readonly string[] {
	const warnings: string[] = [];
	if (isRecord(candidate)) {
		const criteria = arrayStrings(candidate.acceptanceCriteria);
		if (!criteria.length) {
			warnings.push('Plan acceptanceCriteria is empty; add test-gated checks when possible.');
		}
		const risks = arrayStrings(candidate.risks);
		if (!risks.length) {
			warnings.push('Plan risks is empty; document edge cases, rollback, and verification risk.');
		}
	}
	return warnings;
}

function createRepairHints(errors: readonly string[], warnings: readonly string[], mermaid: VibeCodexPlanValidationResponse['mermaid'], candidatePresent: boolean): readonly string[] {
	const hints = new Set<string>();
	if (!candidatePresent) {
		hints.add('Send the candidate plan in params.plan, params.candidatePlan, tool arguments.plan, or as the direct params object.');
	}
	for (const error of errors) {
		if (/taskId/.test(error)) {
			hints.add('Set taskId to a stable non-empty identifier for this planning task.');
		}
		if (/revision/.test(error)) {
			hints.add('Set revision to a positive integer and increment it only when the plan changes.');
		}
		if (/summary/.test(error)) {
			hints.add('Add a concise summary describing the requested implementation outcome.');
		}
		if (/strategy/.test(error)) {
			hints.add('Add a strategy paragraph that explains the implementation approach before coding.');
		}
		if (/flowchart|Mermaid/i.test(error)) {
			hints.add('Use safe Mermaid starting with graph TD or flowchart TD, with simple nodes and edges only.');
		}
		if (/steps/.test(error) || /Step/.test(error)) {
			hints.add('Every checklist step needs a unique id, title, valid status, and flowNodeId.');
		}
		if (/dependsOn/.test(error)) {
			hints.add('Ensure each dependsOn entry references an existing step id.');
		}
		if (/flowNodeId/.test(error)) {
			hints.add('Ensure every step flowNodeId matches an actual Mermaid node id.');
		}
		if (/risks/.test(error)) {
			hints.add('Set risks to an array, even when there are no known risks.');
		}
		if (/acceptanceCriteria/.test(error)) {
			hints.add('Set acceptanceCriteria to an array of verifiable checks.');
		}
	}
	if (mermaid.missingFlowNodeIds.length) {
		hints.add(`Add Mermaid nodes for missing flowNodeIds: ${mermaid.missingFlowNodeIds.slice(0, 8).join(', ')}.`);
	}
	if (mermaid.duplicateFlowNodeIds.length) {
		hints.add(`Give each duplicated flowNodeId a unique graph node: ${mermaid.duplicateFlowNodeIds.slice(0, 8).join(', ')}.`);
	}
	for (const warning of warnings) {
		if (/acceptanceCriteria/.test(warning)) {
			hints.add('Add acceptance criteria that can become required checks, such as typecheck/test/lint/build or explicit manual review.');
		}
		if (/risks/.test(warning)) {
			hints.add('Add at least one risk or state that no material risks are known after inspection.');
		}
	}
	return [...hints];
}

function planValidationMessage(valid: boolean, candidatePresent: boolean, taskId: string | undefined, revision: number | undefined, counts: VibeCodexPlanValidationResponse['counts'], errors: readonly string[], warnings: readonly string[]): string {
	if (!candidatePresent) {
		return 'No candidate visual plan was provided for validation.';
	}
	const planLabel = taskId ? `Plan ${taskId}${revision !== undefined ? ` r${revision}` : ''}` : 'Candidate visual plan';
	if (valid) {
		return `${planLabel} is valid for rendering and approval with ${counts.steps} step${counts.steps === 1 ? '' : 's'} and ${counts.acceptanceCriteria} acceptance criter${counts.acceptanceCriteria === 1 ? 'ion' : 'ia'}${warnings.length ? `; ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.` : '.'}`;
	}
	return `${planLabel} is not approval-ready: ${errors[0] ?? 'validation failed'}`;
}

function extractCandidatePlan(directParams: unknown, payload: Record<string, unknown>, args: Record<string, unknown>): unknown {
	const named = firstDefined(
		args.plan,
		args.candidatePlan,
		args.candidate_plan,
		args.visualPlan,
		args.visual_plan,
		payload.plan,
		payload.candidatePlan,
		payload.candidate_plan,
		payload.visualPlan,
		payload.visual_plan,
	);
	if (named !== undefined) {
		return parseMaybeJson(named);
	}
	if (isLikelyPlanRecord(args)) {
		return args;
	}
	if (isLikelyPlanRecord(payload)) {
		return payload;
	}
	const parsed = parseMaybeJson(directParams);
	if (isRecord(parsed)) {
		return isLikelyPlanRecord(parsed) ? parsed : undefined;
	}
	return parsed === undefined ? undefined : parsed;
}

function missingFlowNodeIds(candidate: unknown, flow: VibeCodexMermaidFlow): readonly string[] {
	const graphNodeIds = new Set(flow.nodes.map(node => node.id));
	return stepFlowNodeIds(candidate).filter(id => identifierPattern.test(id) && !graphNodeIds.has(id));
}

function duplicateFlowNodeIds(candidate: unknown): readonly string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const flowNodeId of stepFlowNodeIds(candidate)) {
		if (!identifierPattern.test(flowNodeId)) {
			continue;
		}
		if (seen.has(flowNodeId)) {
			duplicates.add(flowNodeId);
		}
		seen.add(flowNodeId);
	}
	return [...duplicates];
}

function stepFlowNodeIds(candidate: unknown): readonly string[] {
	return planSteps(candidate)
		.map(step => recordString(step, 'flowNodeId') ?? '')
		.filter(value => value.length > 0);
}

function planSteps(candidate: unknown): readonly Record<string, unknown>[] {
	if (!isRecord(candidate) || !Array.isArray(candidate.steps)) {
		return [];
	}
	return candidate.steps.filter(isRecord);
}

function arrayStrings(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim()) : [];
}

function isPlanValidationToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return planValidationToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = parseMaybeJson(payload.arguments ?? payload.args ?? payload.input ?? payload.params);
	if (!isRecord(args)) {
		return payload;
	}
	const nested = parseMaybeJson(args.arguments ?? args.args ?? args.input);
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function recordValue(value: unknown, key: string): unknown {
	return isRecord(value) ? value[key] : undefined;
}

function recordString(value: unknown, key: string): string | undefined {
	return stringValue(recordValue(value, key));
}

function recordNumber(value: unknown, key: string): number | undefined {
	const raw = recordValue(value, key);
	return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function redactString(value: string | undefined): string | undefined {
	const redacted = redactSensitiveValue(value);
	return typeof redacted === 'string' ? redacted : value;
}

function firstDefined(...values: readonly unknown[]): unknown {
	return values.find(value => value !== undefined);
}

function isLikelyPlanRecord(value: unknown): value is VibeCodexPlan & Record<string, unknown> {
	return isRecord(value) && ('taskId' in value || 'flowchart' in value || 'steps' in value);
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
