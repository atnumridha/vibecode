/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexPlanStep } from './planProtocol';

export type VibeCodexMermaidDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export interface VibeCodexMermaidNode {
	readonly id: string;
	readonly label: string;
}

export interface VibeCodexMermaidEdge {
	readonly from: string;
	readonly to: string;
	readonly label?: string;
}

export interface VibeCodexMermaidFlow {
	readonly valid: boolean;
	readonly direction: VibeCodexMermaidDirection;
	readonly nodes: readonly VibeCodexMermaidNode[];
	readonly edges: readonly VibeCodexMermaidEdge[];
	readonly errors: readonly string[];
}

export interface VibeCodexMermaidChecklistBindingReport {
	readonly valid: boolean;
	readonly stepCount: number;
	readonly linkedStepCount: number;
	readonly nodeIds: readonly string[];
	readonly stepFlowNodeIds: readonly string[];
	readonly linkedStepIds: readonly string[];
	readonly missingFlowNodeIds: readonly string[];
	readonly duplicateFlowNodeIds: readonly string[];
	readonly errors: readonly string[];
}

const mermaidStartPattern = /^\s*(graph|flowchart)\s+(TD|TB|BT|RL|LR)\b/i;
const blockedMermaidPattern = /(?:\b(?:click|href|javascript:)|<script|%%\{(?:init:)?)/i;
const nodePattern = /^\s*([a-zA-Z0-9_.:-]+)\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(([^)]*)\))?\s*$/;
const edgePattern = /^\s*(.+?)\s+((?:--[^-<>]*-->|-->|---|-.->|==>))\s+(.+?)\s*$/;
const maxMermaidBytes = 20000;
const maxMermaidLines = 180;
const maxMermaidNodes = 96;
const maxMermaidEdges = 160;

export function isSafeMermaidFlowchart(value: unknown): value is string {
	const validation = validateMermaidFlowchart(value);
	return validation.valid;
}

export function validateMermaidFlowchart(value: unknown): { readonly valid: boolean; readonly errors: readonly string[] } {
	const errors: string[] = [];
	if (typeof value !== 'string' || !value.trim()) {
		return { valid: false, errors: ['Mermaid flowchart is required.'] };
	}
	if (value.length > maxMermaidBytes) {
		errors.push(`Mermaid flowchart exceeds ${maxMermaidBytes} characters.`);
	}
	if (blockedMermaidPattern.test(value)) {
		errors.push('Mermaid flowchart contains blocked interactive or script directives.');
	}
	const lines = usefulLines(value);
	if (lines.length > maxMermaidLines) {
		errors.push(`Mermaid flowchart exceeds ${maxMermaidLines} non-empty lines.`);
	}
	if (!mermaidStartPattern.test(lines[0] ?? '')) {
		errors.push('Mermaid flowchart must start with graph/flowchart and a supported direction.');
	}
	const parsed = parseMermaidFlowchart(value);
	errors.push(...parsed.errors);
	return { valid: errors.length === 0 && parsed.valid, errors };
}

export function parseMermaidFlowchart(value: string, steps: readonly VibeCodexPlanStep[] = []): VibeCodexMermaidFlow {
	const lines = usefulLines(value);
	const start = mermaidStartPattern.exec(lines[0] ?? '');
	const direction = (start?.[2]?.toUpperCase() as VibeCodexMermaidDirection | undefined) ?? 'TD';
	const errors: string[] = [];
	const nodes = new Map<string, VibeCodexMermaidNode>();
	const edges: VibeCodexMermaidEdge[] = [];
	const stepLabels = new Map(steps.map(step => [step.flowNodeId, step.title]));

	if (!start) {
		errors.push('Missing Mermaid graph/flowchart declaration.');
	}

	for (const line of lines.slice(1)) {
		if (/^(?:subgraph|end|classDef|class|style)\b/i.test(line)) {
			continue;
		}
		const edgeMatch = edgePattern.exec(line);
		if (edgeMatch) {
			const left = parseNodeToken(edgeMatch[1]);
			const right = parseNodeToken(edgeMatch[3]);
			if (!left || !right) {
				errors.push(`Unsupported Mermaid edge: ${line}`);
				continue;
			}
			upsertNode(nodes, left.id, left.label ?? stepLabels.get(left.id));
			upsertNode(nodes, right.id, right.label ?? stepLabels.get(right.id));
			const label = edgeLabel(edgeMatch[2]);
			edges.push({
				from: left.id,
				to: right.id,
				...(label ? { label } : {}),
			});
			continue;
		}
		const node = parseNodeToken(line);
		if (node) {
			upsertNode(nodes, node.id, node.label ?? stepLabels.get(node.id));
			continue;
		}
		errors.push(`Unsupported Mermaid line: ${sanitizeMermaidErrorLine(line)}`);
	}

	for (const step of steps) {
		if (nodes.has(step.flowNodeId)) {
			upsertNode(nodes, step.flowNodeId, step.title);
		}
	}

	if (!nodes.size) {
		errors.push('Mermaid flowchart contains no renderable nodes.');
	}
	if (nodes.size > maxMermaidNodes) {
		errors.push(`Mermaid flowchart exceeds ${maxMermaidNodes} nodes.`);
	}
	if (edges.length > maxMermaidEdges) {
		errors.push(`Mermaid flowchart exceeds ${maxMermaidEdges} edges.`);
	}

	return {
		valid: errors.length === 0,
		direction,
		nodes: [...nodes.values()].slice(0, maxMermaidNodes),
		edges: edges.slice(0, maxMermaidEdges),
		errors,
	};
}

export function createMermaidChecklistBindingReport(flowchart: string, steps: readonly VibeCodexPlanStep[]): VibeCodexMermaidChecklistBindingReport {
	const flow = parseMermaidFlowchart(flowchart);
	const nodeIds = uniqueStrings(flow.nodes.map(node => node.id));
	const graphNodeIds = new Set(nodeIds);
	const stepFlowNodeIds = steps.map(step => step.flowNodeId).filter(Boolean);
	const duplicateFlowNodeIds = duplicateStrings(stepFlowNodeIds);
	const missingFlowNodeIds = uniqueStrings(stepFlowNodeIds.filter(id => !graphNodeIds.has(id)));
	const missing = new Set(missingFlowNodeIds);
	const linkedStepIds = steps
		.filter(step => step.flowNodeId && graphNodeIds.has(step.flowNodeId))
		.map(step => step.id);
	const errors = [
		...missingFlowNodeIds.map(id => `Checklist flowNodeId "${id}" is not present in the Mermaid flowchart.`),
		...duplicateFlowNodeIds.map(id => `Checklist flowNodeId "${id}" is duplicated.`),
	];
	return {
		valid: flow.valid && !missing.size && !duplicateFlowNodeIds.length,
		stepCount: steps.length,
		linkedStepCount: linkedStepIds.length,
		nodeIds,
		stepFlowNodeIds,
		linkedStepIds,
		missingFlowNodeIds,
		duplicateFlowNodeIds,
		errors,
	};
}

export function createLinearMermaidFlowchart(steps: readonly VibeCodexPlanStep[]): string {
	const lines = ['graph TD'];
	for (const step of steps) {
		lines.push(`  ${step.flowNodeId}[${escapeMermaidLabel(step.title)}]`);
	}
	for (let index = 0; index < steps.length - 1; index++) {
		lines.push(`  ${steps[index].flowNodeId} --> ${steps[index + 1].flowNodeId}`);
	}
	return lines.join('\n');
}

function usefulLines(value: string): readonly string[] {
	return value.split(/\r?\n/)
		.map(line => line.replace(/\s+%%.*$/, '').trim())
		.filter(line => line.length > 0);
}

function parseNodeToken(value: string): { readonly id: string; readonly label?: string } | undefined {
	const match = nodePattern.exec(value.trim());
	if (!match) {
		return undefined;
	}
	const label = match[2] ?? match[3] ?? match[4];
	return {
		id: match[1],
		...(label ? { label: escapeDisplayLabel(label) } : {}),
	};
}

function upsertNode(nodes: Map<string, VibeCodexMermaidNode>, id: string, label: string | undefined): void {
	const nextLabel = escapeDisplayLabel(label || nodes.get(id)?.label || id);
	nodes.set(id, { id, label: nextLabel });
}

function edgeLabel(operator: string): string | undefined {
	const label = /^--\s*(.*?)\s*-->$/.exec(operator)?.[1]?.trim();
	return label ? escapeDisplayLabel(label) : undefined;
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

function duplicateStrings(values: readonly string[]): readonly string[] {
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

function escapeMermaidLabel(value: string): string {
	return value.replace(/[\[\]{}()]/g, '').slice(0, 100);
}

function escapeDisplayLabel(value: string): string {
	return value.replace(/["<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function sanitizeMermaidErrorLine(value: string): string {
	return value
		.replace(/javascript:[^\s"']*/gi, '[blocked-javascript]')
		.replace(/\bhref\s+[^\s]+/gi, 'href [blocked-url]')
		.replace(/<script[\s\S]*/gi, '[blocked-script]')
		.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
		.replace(/vibecodex-plan:[^\s"',}]+/g, '[redacted:approval-token]')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 160);
}
