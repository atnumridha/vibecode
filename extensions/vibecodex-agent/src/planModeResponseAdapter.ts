/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createLinearMermaidFlowchart } from './mermaidFlow';
import type { VibeCodexPlan, VibeCodexPlanStep, VibeCodexPlanStepStatus } from './planProtocol';
import { redactSensitiveText } from './secretFilters';
import type { VibeCodexUserInputRequest } from './userInputProtocol';

interface ExtractedPlanStep {
	readonly title: string;
	readonly status: VibeCodexPlanStepStatus;
	readonly files: readonly string[];
}

const maxImportedSteps = 12;
const maxStrategyChars = 3200;
const genericHeadings = new Set(['plan', 'implementation plan', 'steps', 'task', 'strategy', 'approach']);

export function planFromPlanModeResponse(request: VibeCodexUserInputRequest): VibeCodexPlan | undefined {
	if (request.kind !== 'plan_feedback') {
		return undefined;
	}
	const source = redactSensitiveText([
		request.prompt,
		request.detail,
	].filter((value): value is string => !!value?.trim()).join('\n\n')).trim();
	if (!source) {
		return undefined;
	}

	const extracted = extractPlanSteps(source);
	const steps = (extracted.length ? extracted : fallbackPlanSteps(source))
		.slice(0, maxImportedSteps)
		.map((step, index): VibeCodexPlanStep => {
			const id = `cline-plan-step-${index + 1}`;
			return {
				id,
				title: capTitle(step.title),
				status: step.status,
				...(step.files.length ? { files: step.files } : {}),
				...(index > 0 ? { dependsOn: [`cline-plan-step-${index}`] } : {}),
				flowNodeId: `S${index + 1}`,
			};
		});

	return {
		taskId: `cline-plan-${sanitizeIdentifier(String(request.id))}`,
		revision: 1,
		summary: extractSummary(source),
		strategy: createStrategy(source),
		flowchart: createLinearMermaidFlowchart(steps),
		steps,
		risks: extractSectionItems(source, /risk|edge case|concern/)
			.concat('Imported from Cline Plan Mode response; review generated checklist and graph before approval.')
			.slice(0, 8),
		acceptanceCriteria: extractSectionItems(source, /acceptance criteria|definition of done|done when|verification|test plan/)
			.concat('No workspace mutation happens until this imported visual plan revision is approved.')
			.slice(0, 8),
	};
}

function extractPlanSteps(value: string): readonly ExtractedPlanStep[] {
	const steps: ExtractedPlanStep[] = [];
	let section = 'body';
	for (const rawLine of stripFencedBlocks(value).split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}
		const nextSection = sectionLabel(line);
		if (nextSection) {
			section = nextSection;
			continue;
		}
		if (/risk|acceptance|definition of done|done when|verification|test plan/.test(section)) {
			continue;
		}
		const checkbox = /^(?:[-*+]\s+)?\[( |x|X|-|~|!|failed|blocked)\]\s+(.+?)\s*$/.exec(line);
		if (checkbox) {
			steps.push({
				title: cleanListText(checkbox[2]),
				status: statusFromMarker(checkbox[1]),
				files: extractFiles(checkbox[2]),
			});
			continue;
		}
		if (/step|plan|implementation|approach|body/.test(section)) {
			const item = /^(?:\d{1,2}[.)]|[-*+])\s+(.+?)\s*$/.exec(line);
			if (item) {
				steps.push({
					title: cleanListText(item[1]),
					status: statusFromTitle(item[1]),
					files: extractFiles(item[1]),
				});
			}
		}
	}
	return uniqueSteps(steps);
}

function fallbackPlanSteps(source: string): readonly ExtractedPlanStep[] {
	const summary = extractSummary(source);
	return [
		{ title: `Review Cline Plan Mode response: ${summary}`, status: 'pending', files: [] },
		{ title: 'Confirm generated visual checklist, risks, and acceptance criteria', status: 'pending', files: [] },
		{ title: 'Approve this exact plan revision before switching to Act or Agent mode', status: 'pending', files: [] },
	];
}

function extractSummary(value: string): string {
	for (const line of stripFencedBlocks(value).split(/\r?\n/)) {
		const heading = /^(?:#{1,6}\s+|\*\*)?(.+?)(?:\*\*)?:?\s*$/.exec(line.trim())?.[1]?.trim();
		if (!heading) {
			continue;
		}
		const cleaned = cleanListText(heading);
		if (!cleaned || genericHeadings.has(cleaned.toLowerCase())) {
			continue;
		}
		return capTitle(cleaned, 180);
	}
	return 'Imported Cline Plan Mode visual plan';
}

function createStrategy(source: string): string {
	const withoutMermaid = stripFencedBlocks(source).trim();
	const capped = withoutMermaid.length > maxStrategyChars ? `${withoutMermaid.slice(0, maxStrategyChars)}\n[truncated]` : withoutMermaid;
	return [
		'Imported from Cline-compatible Plan Mode response. Vibe Codex converted the response into a linked visual plan and kept mutation locked until explicit approval.',
		capped,
	].filter(Boolean).join('\n\n');
}

function extractSectionItems(value: string, headingPattern: RegExp): readonly string[] {
	const items: string[] = [];
	let active = false;
	for (const rawLine of stripFencedBlocks(value).split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}
		const label = sectionLabel(line);
		if (label) {
			active = headingPattern.test(label);
			continue;
		}
		if (!active) {
			continue;
		}
		const item = listItemText(line);
		if (item) {
			items.push(capTitle(item, 220));
		}
	}
	return [...new Set(items)];
}

function stripFencedBlocks(value: string): string {
	const lines: string[] = [];
	let inFence = false;
	for (const line of value.split(/\r?\n/)) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (!inFence) {
			lines.push(line);
		}
	}
	return lines.join('\n');
}

function sectionLabel(line: string): string | undefined {
	const markdownHeading = /^(?:#{1,6}\s+|\*\*)?(.+?)(?:\*\*)?\s*:?\s*$/.exec(line.trim());
	if (!markdownHeading) {
		return undefined;
	}
	const label = cleanListText(markdownHeading[1]).toLowerCase();
	return /^(?:strategy|approach|plan|steps|implementation|risks?|edge cases?|concerns?|acceptance criteria|definition of done|done when|verification|test plan)\b/.test(label) ? label : undefined;
}

function listItemText(line: string): string | undefined {
	const match = /^(?:\d{1,2}[.)]|[-*+])\s+(?:\[[ xX\-~!]+\]\s+)?(.+?)\s*$/.exec(line);
	return match ? cleanListText(match[1]) : undefined;
}

function statusFromMarker(marker: string): VibeCodexPlanStepStatus {
	const normalized = marker.trim().toLowerCase();
	if (normalized === 'x') {
		return 'completed';
	}
	if (normalized === '-' || normalized === '~') {
		return 'in_progress';
	}
	if (normalized === '!' || normalized === 'failed') {
		return 'failed';
	}
	if (normalized === 'blocked') {
		return 'blocked';
	}
	return 'pending';
}

function statusFromTitle(title: string): VibeCodexPlanStepStatus {
	if (/\b(?:blocked|waiting)\b/i.test(title)) {
		return 'blocked';
	}
	if (/\b(?:failed|failing)\b/i.test(title)) {
		return 'failed';
	}
	if (/\b(?:done|completed)\b/i.test(title)) {
		return 'completed';
	}
	return 'pending';
}

function cleanListText(value: string): string {
	return redactSensitiveText(value)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/[`*_~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function capTitle(value: string, max = 180): string {
	const clean = cleanListText(value);
	return clean.length > max ? `${clean.slice(0, max - 12).trim()} [truncated]` : clean;
}

function extractFiles(value: string): readonly string[] {
	const files = new Set<string>();
	const text = redactSensitiveText(value);
	for (const match of text.matchAll(/`([^`\s]+\.[a-zA-Z0-9]{1,10})`|(?:^|\s)([./\w-]+\.[a-zA-Z0-9]{1,10})(?=$|[\s,;:)])/g)) {
		const candidate = (match[1] ?? match[2] ?? '').trim();
		if (candidate && !/^https?:\/\//i.test(candidate)) {
			files.add(candidate.replace(/^[./]+$/, ''));
		}
	}
	return [...files].slice(0, 6);
}

function uniqueSteps(steps: readonly ExtractedPlanStep[]): readonly ExtractedPlanStep[] {
	const unique: ExtractedPlanStep[] = [];
	const seen = new Set<string>();
	for (const step of steps) {
		const title = capTitle(step.title);
		const key = title.toLowerCase();
		if (!title || seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push({ ...step, title });
	}
	return unique;
}

function sanitizeIdentifier(value: string): string {
	const sanitized = redactSensitiveText(value).replace(/[^a-zA-Z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
	return sanitized || `request-${Date.now().toString(36)}`;
}
