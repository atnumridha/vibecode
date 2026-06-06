/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexMemoryBank, VibeCodexMemoryBankDocument, VibeCodexMemoryBankDocumentKind } from './memoryBank';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexGuidanceDocument, VibeCodexHookManifest, VibeCodexSkillDocument, VibeCodexWorkspaceGuidance } from './workspaceGuidance';

export type VibeCodexGuidanceSelectionType = 'rule' | 'skill' | 'hook' | 'memory';

export interface VibeCodexGuidanceSelectionRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly query: string;
	readonly paths: readonly string[];
	readonly includeRules: boolean;
	readonly includeSkills: boolean;
	readonly includeDocuments: boolean;
	readonly includeMemoryBank: boolean;
	readonly includeHooks: boolean;
	readonly maxItems: number;
	readonly maxDocumentChars: number;
	readonly requestedAt: number;
}

export interface VibeCodexGuidanceSelectionEntry {
	readonly id: string;
	readonly type: VibeCodexGuidanceSelectionType;
	readonly path: string;
	readonly kind: string;
	readonly title: string;
	readonly score: number;
	readonly matchedTerms: readonly string[];
	readonly reasons: readonly string[];
	readonly name?: string;
	readonly description?: string;
	readonly entries?: readonly string[];
	readonly truncated?: boolean;
	readonly textPreview: string;
	readonly text?: string;
}

export interface VibeCodexGuidanceSelectionResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly method: string;
	readonly query: string;
	readonly paths: readonly string[];
	readonly selectionHash: string;
	readonly counts: {
		readonly availableRules: number;
		readonly availableSkills: number;
		readonly availableHooks: number;
		readonly availableMemoryBankDocuments: number;
		readonly selected: number;
		readonly returnedWithText: number;
	};
	readonly selected: readonly VibeCodexGuidanceSelectionEntry[];
	readonly guardrails: readonly string[];
	readonly message: string;
	readonly promptBlock: string;
}

export interface VibeCodexGuidanceSelectionInput {
	readonly guidance?: VibeCodexWorkspaceGuidance;
	readonly memoryBank?: VibeCodexMemoryBank;
}

interface Candidate {
	readonly type: VibeCodexGuidanceSelectionType;
	readonly path: string;
	readonly kind: string;
	readonly title: string;
	readonly text: string;
	readonly priority: number;
	readonly name?: string;
	readonly description?: string;
	readonly entries?: readonly string[];
	readonly truncated?: boolean;
}

interface ScoredCandidate {
	readonly candidate: Candidate;
	readonly score: number;
	readonly matchedTerms: readonly string[];
	readonly reasons: readonly string[];
}

const guidanceSelectionMethods = new Set([
	'agent/selectGuidance',
	'agent/guidanceSelect',
	'agent/getSelectedGuidance',
	'guidance/select',
	'rules/select',
	'vibecodex/guidanceSelect',
]);

const guidanceSelectionToolNames = new Set([
	'guidance_select',
	'select_guidance',
	'selected_guidance',
	'rules_select',
	'select_rules',
	'skills',
	'use_skill',
	'invoke_skill',
	'skill_select',
	'select_skill',
	'memory_bank_select',
]);

const defaultMaxItems = 8;
const maxSelectableItems = 32;
const defaultMaxDocumentChars = 1800;
const maxDocumentChars = 4000;
const previewLimit = 700;
const maxTerms = 24;
const stopWords = new Set([
	'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'should', 'would', 'could', 'please', 'implement', 'change', 'update', 'make', 'create', 'agent',
]);

export function normalizeGuidanceSelectionRequest(message: JsonRpcMessage): VibeCodexGuidanceSelectionRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!guidanceSelectionMethods.has(message.method) && !isGuidanceSelectionToolCall(message.method, payload, args)) {
		return undefined;
	}
	const toolName = guidanceSelectionToolName(message.method, payload, args);
	const skillOnly = isSkillsToolName(toolName);
	const query = stringValue(payload.query)
		?? stringValue(args.query)
		?? stringValue(payload.prompt)
		?? stringValue(args.prompt)
		?? stringValue(payload.task)
		?? stringValue(args.task)
		?? stringValue(payload.skillName)
		?? stringValue(args.skillName)
		?? stringValue(payload.skill_name)
		?? stringValue(args.skill_name)
		?? (skillOnly ? stringValue(args.name) : undefined)
		?? '';
	const paths = uniqueStrings([
		...stringArray(payload.paths),
		...stringArray(args.paths),
		...stringArray(payload.files),
		...stringArray(args.files),
		stringValue(payload.path),
		stringValue(args.path),
		stringValue(payload.file),
		stringValue(args.file),
	]);
	return {
		id: message.id,
		method: message.method,
		query: redactSensitiveText(query).slice(0, 4000),
		paths: paths.map(path => redactSensitiveText(normalizePath(path))).slice(0, 24),
		includeRules: booleanValue(payload.includeRules)
			?? booleanValue(payload.include_rules)
			?? booleanValue(args.includeRules)
			?? booleanValue(args.include_rules)
			?? !skillOnly,
		includeSkills: booleanValue(payload.includeSkills)
			?? booleanValue(payload.include_skills)
			?? booleanValue(args.includeSkills)
			?? booleanValue(args.include_skills)
			?? true,
		includeDocuments: booleanValue(payload.includeDocuments)
			?? booleanValue(payload.include_documents)
			?? booleanValue(args.includeDocuments)
			?? booleanValue(args.include_documents)
			?? skillOnly,
		includeMemoryBank: booleanValue(payload.includeMemoryBank)
			?? booleanValue(payload.include_memory_bank)
			?? booleanValue(args.includeMemoryBank)
			?? booleanValue(args.include_memory_bank)
			?? !skillOnly,
		includeHooks: booleanValue(payload.includeHooks)
			?? booleanValue(payload.include_hooks)
			?? booleanValue(args.includeHooks)
			?? booleanValue(args.include_hooks)
			?? !skillOnly,
		maxItems: clampInteger(numberValue(payload.maxItems) ?? numberValue(payload.max_items) ?? numberValue(args.maxItems) ?? numberValue(args.max_items), 1, maxSelectableItems, defaultMaxItems),
		maxDocumentChars: clampInteger(numberValue(payload.maxDocumentChars) ?? numberValue(payload.max_document_chars) ?? numberValue(args.maxDocumentChars) ?? numberValue(args.max_document_chars), 200, maxDocumentChars, defaultMaxDocumentChars),
		requestedAt: Date.now(),
	};
}

export function createGuidanceSelectionResponse(request: VibeCodexGuidanceSelectionRequest, input: VibeCodexGuidanceSelectionInput): VibeCodexGuidanceSelectionResponse {
	const candidates = [
		...(request.includeRules ? input.guidance?.rules.map(ruleCandidate) ?? [] : []),
		...(request.includeSkills ? input.guidance?.skills.map(skillCandidate) ?? [] : []),
		...(request.includeHooks ? input.guidance?.hooks.map(hookCandidate) ?? [] : []),
		...(request.includeMemoryBank ? input.memoryBank?.documents.map(memoryCandidate) ?? [] : []),
	];
	const terms = selectionTerms(request);
	const selected = candidates
		.map(candidate => scoreCandidate(candidate, terms, request.paths))
		.sort((a, b) => b.score - a.score || b.candidate.priority - a.candidate.priority || a.candidate.path.localeCompare(b.candidate.path))
		.slice(0, request.maxItems)
		.map((scored, index) => toSelectionEntry(scored, request.includeDocuments, request.maxDocumentChars, index));
	const counts = {
		availableRules: input.guidance?.rules.length ?? 0,
		availableSkills: input.guidance?.skills.length ?? 0,
		availableHooks: input.guidance?.hooks.length ?? 0,
		availableMemoryBankDocuments: input.memoryBank?.documents.length ?? 0,
		selected: selected.length,
		returnedWithText: selected.filter(entry => entry.text !== undefined).length,
	};
	const responseWithoutMessage = {
		ok: candidates.length > 0,
		source: 'externalExtension' as const,
		version: 1 as const,
		method: request.method,
		query: request.query,
		paths: request.paths,
		selectionHash: hashText(JSON.stringify(selected.map(entry => ({ id: entry.id, score: entry.score, matchedTerms: entry.matchedTerms })))),
		counts,
		selected,
		guardrails: [
			'Guidance selection is read-only and never writes rules, skills, hooks, or Memory Bank files.',
			'Hook manifests are returned as planning context only; this response never executes hooks or grants hook execution approval.',
			'Document text is omitted unless includeDocuments is true, then capped and redacted.',
			'Selection does not approve visual plans, terminal commands, MCP calls, browser actions, file edits, deletes, or diff acceptance.',
		],
	};
	const response = {
		...responseWithoutMessage,
		message: guidanceSelectionSummary(responseWithoutMessage),
		promptBlock: guidanceSelectionPromptBlock(responseWithoutMessage),
	};
	return response;
}

export function guidanceSelectionSummary(response: Pick<VibeCodexGuidanceSelectionResponse, 'ok' | 'counts' | 'query' | 'paths'>): string {
	if (!response.ok) {
		return 'No workspace guidance, skills, hooks, or Memory Bank documents are available for selection.';
	}
	const scope = [response.query ? 'prompt query' : undefined, response.paths.length ? `${response.paths.length} path${response.paths.length === 1 ? '' : 's'}` : undefined].filter(Boolean).join(' and ') || 'default priority';
	return `Selected ${response.counts.selected} guidance item${response.counts.selected === 1 ? '' : 's'} for ${scope}; ${response.counts.returnedWithText} include bounded document text.`;
}

function guidanceSelectionPromptBlock(response: Omit<VibeCodexGuidanceSelectionResponse, 'message' | 'promptBlock'>): string {
	return JSON.stringify(redactSensitiveValue({
		version: response.version,
		query: response.query,
		paths: response.paths,
		includeRules: response.selected.some(entry => entry.type === 'rule'),
		includeSkills: response.selected.some(entry => entry.type === 'skill'),
		includeHooks: response.selected.some(entry => entry.type === 'hook'),
		includeMemoryBank: response.selected.some(entry => entry.type === 'memory'),
		selectionHash: response.selectionHash,
		counts: response.counts,
		selected: response.selected,
		guardrails: response.guardrails,
		note: 'Use selected guidance as read-only planning context. Request explicit plan/diff/hook approval before any mutation or execution.',
	}), null, 2);
}

function scoreCandidate(candidate: Candidate, terms: readonly string[], paths: readonly string[]): ScoredCandidate {
	const lowerPath = candidate.path.toLowerCase();
	const lowerTitle = candidate.title.toLowerCase();
	const lowerName = candidate.name?.toLowerCase() ?? '';
	const lowerDescription = candidate.description?.toLowerCase() ?? '';
	const lowerEntries = candidate.entries?.join('\n').toLowerCase() ?? '';
	const lowerText = candidate.text.toLowerCase();
	const matchedTerms: string[] = [];
	const reasons: string[] = [priorityReason(candidate)];
	let score = candidate.priority;
	for (const path of paths) {
		const normalized = normalizePath(path).toLowerCase();
		if (!normalized) {
			continue;
		}
		if (lowerPath === normalized || lowerPath.endsWith(`/${normalized}`)) {
			score += 32;
			reasons.push(`target path matched ${path}`);
			continue;
		}
		for (const segment of pathTerms(path)) {
			if (lowerPath.includes(segment)) {
				score += 6;
				reasons.push(`path segment "${segment}" matched document path`);
				break;
			}
		}
	}
	for (const term of terms) {
		let termScore = 0;
		if (lowerPath.includes(term)) {
			termScore += 10;
		}
		if (lowerTitle.includes(term) || lowerName.includes(term)) {
			termScore += 8;
		}
		if (lowerDescription.includes(term)) {
			termScore += 5;
		}
		if (lowerEntries.includes(term)) {
			termScore += 4;
		}
		const textMatches = countOccurrences(lowerText, term);
		if (textMatches) {
			termScore += Math.min(10, textMatches * 2);
		}
		if (termScore > 0) {
			score += termScore;
			matchedTerms.push(term);
			reasons.push(`matched "${term}"`);
		}
	}
	if (!terms.length && !paths.length) {
		reasons.push('selected by default guidance priority');
	}
	return {
		candidate,
		score,
		matchedTerms: uniqueStrings(matchedTerms),
		reasons: uniqueStrings(reasons).slice(0, 8),
	};
}

function toSelectionEntry(scored: ScoredCandidate, includeText: boolean, maxChars: number, index: number): VibeCodexGuidanceSelectionEntry {
	const candidate = scored.candidate;
	const redactedText = redactSensitiveText(candidate.text);
	const id = `${candidate.type}-${index + 1}-${hashText(`${candidate.path}:${candidate.kind}:${candidate.title}`).slice(0, 8)}`;
	return {
		id,
		type: candidate.type,
		path: redactSensitiveText(candidate.path),
		kind: candidate.kind,
		title: redactSensitiveText(candidate.title),
		score: scored.score,
		matchedTerms: scored.matchedTerms,
		reasons: scored.reasons.map(reason => redactSensitiveText(reason)),
		...(candidate.name ? { name: redactSensitiveText(candidate.name) } : {}),
		...(candidate.description ? { description: redactSensitiveText(candidate.description) } : {}),
		...(candidate.entries ? { entries: redactSensitiveValue(candidate.entries) as readonly string[] } : {}),
		...(candidate.truncated !== undefined ? { truncated: candidate.truncated } : {}),
		textPreview: preview(redactedText, previewLimit),
		...(includeText ? { text: preview(redactedText, maxChars) } : {}),
	};
}

function ruleCandidate(rule: VibeCodexGuidanceDocument): Candidate {
	return {
		type: 'rule',
		path: rule.path,
		kind: rule.kind,
		title: rule.path,
		text: rule.text,
		priority: rulePriority(rule.kind),
	};
}

function skillCandidate(skill: VibeCodexSkillDocument): Candidate {
	return {
		type: 'skill',
		path: skill.path,
		kind: 'skill',
		title: skill.name,
		name: skill.name,
		...(skill.description ? { description: skill.description } : {}),
		text: skill.text,
		priority: 64,
	};
}

function hookCandidate(hook: VibeCodexHookManifest): Candidate {
	return {
		type: 'hook',
		path: hook.path,
		kind: hook.kind,
		title: hook.path,
		entries: hook.entries,
		text: hook.text,
		priority: 24,
	};
}

function memoryCandidate(document: VibeCodexMemoryBankDocument): Candidate {
	return {
		type: 'memory',
		path: document.path,
		kind: document.kind,
		title: document.title,
		text: document.text,
		truncated: document.truncated,
		priority: memoryPriority(document.kind),
	};
}

function rulePriority(kind: VibeCodexGuidanceDocument['kind']): number {
	switch (kind) {
		case 'agent': return 98;
		case 'cline': return 94;
		case 'vibecodex': return 92;
		case 'codex': return 90;
		case 'cursor': return 88;
		case 'copilot': return 70;
		case 'generic': return 66;
	}
}

function memoryPriority(kind: VibeCodexMemoryBankDocumentKind): number {
	switch (kind) {
		case 'projectbrief': return 86;
		case 'activeContext': return 84;
		case 'productContext': return 82;
		case 'systemPatterns': return 80;
		case 'techContext': return 78;
		case 'progress': return 72;
		case 'decisionLog': return 70;
		case 'generic': return 58;
	}
}

function priorityReason(candidate: Candidate): string {
	switch (candidate.type) {
		case 'rule': return `${candidate.kind} rule priority`;
		case 'skill': return 'skill document priority';
		case 'hook': return 'hook manifest is read-only context';
		case 'memory': return `${candidate.kind} Memory Bank priority`;
	}
}

function selectionTerms(request: VibeCodexGuidanceSelectionRequest): readonly string[] {
	return uniqueStrings([
		...termsFromText(request.query),
		...request.paths.flatMap(pathTerms),
	]).slice(0, maxTerms);
}

function termsFromText(value: string): readonly string[] {
	const terms: string[] = [];
	for (const match of value.matchAll(/[A-Za-z0-9_.$/-]{3,}/g)) {
		const normalized = match[0].replace(/^[-.$/]+|[-.$/]+$/g, '').replace(/[_./\\-]+/g, ' ').toLowerCase();
		for (const term of normalized.split(/\s+/)) {
			if (term.length >= 3 && !stopWords.has(term) && !/^\d+$/.test(term)) {
				terms.push(term);
			}
		}
	}
	return uniqueStrings(terms);
}

function pathTerms(value: string): readonly string[] {
	return termsFromText(value.replace(/\.[a-z0-9]+$/i, ' '));
}

function countOccurrences(value: string, term: string): number {
	let count = 0;
	let index = value.indexOf(term);
	while (index >= 0 && count < 8) {
		count++;
		index = value.indexOf(term, index + term.length);
	}
	return count;
}

function preview(value: string, limit: number): string {
	if (value.length <= limit) {
		return value;
	}
	return `${value.slice(0, Math.max(0, limit - 16)).trimEnd()}\n[truncated]`;
}

function isGuidanceSelectionToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	return guidanceSelectionToolNames.has(guidanceSelectionToolName(method, payload, args));
}

function guidanceSelectionToolName(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): string {
	return method === 'item/tool/call'
		? (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase()
		: '';
}

function isSkillsToolName(value: string): boolean {
	return value === 'skills' || value === 'use_skill' || value === 'invoke_skill' || value === 'skill_select' || value === 'select_skill';
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function stringArray(value: unknown): readonly string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
	}
	return [];
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const normalized = value?.trim();
		if (!normalized) {
			continue;
		}
		const key = normalized.toLowerCase();
		if (!seen.has(key)) {
			seen.add(key);
			result.push(normalized);
		}
	}
	return result;
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
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

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
	if (value === undefined) {
		return fallback;
	}
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
