/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexSessionSnapshot } from './sessionHistory';

export interface VibeCodexSessionRecall {
	readonly version: 1;
	readonly generatedAt: number;
	readonly query: string;
	readonly explicitMention: boolean;
	readonly truncated: boolean;
	readonly entries: readonly VibeCodexSessionRecallEntry[];
}

export interface VibeCodexSessionRecallEntry {
	readonly id: string;
	readonly updatedAt: number;
	readonly mode: string;
	readonly status: string;
	readonly prompt: string;
	readonly score: number;
	readonly matchedTerms: readonly string[];
	readonly planSummary?: string;
	readonly files: readonly string[];
	readonly finalReview?: string;
	readonly evidence: readonly string[];
}

export interface VibeCodexSessionRecallOptions {
	readonly activeSessionId?: string;
	readonly maxEntries?: number;
	readonly maxEvidenceItems?: number;
}

const maxRecallEntries = 8;
const defaultRecallEntries = 5;
const defaultEvidenceItems = 3;
const maxPromptChars = 360;
const maxEvidenceChars = 420;
const maxPlanSummaryChars = 300;
const maxFileRefs = 12;
const stopWords = new Set([
	'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from', 'how', 'i', 'in', 'into', 'is', 'it', 'make', 'of', 'on', 'or', 'our', 'please', 'should', 'that', 'the', 'this', 'to', 'use', 'we', 'with', 'you',
]);

export function createSessionRecall(history: readonly VibeCodexSessionSnapshot[], prompt: string, options: VibeCodexSessionRecallOptions = {}): VibeCodexSessionRecall {
	const explicitMention = /(?:^|\s)@chat(?:\b|$)/i.test(prompt);
	const query = excerpt(redactSensitiveText(prompt.replace(/(?:^|\s)@chat(?:\b|$)/ig, ' ').trim()), maxPromptChars);
	const terms = queryTerms(query);
	const maxEntries = clampInteger(options.maxEntries ?? defaultRecallEntries, 0, maxRecallEntries);
	const maxEvidenceItems = clampInteger(options.maxEvidenceItems ?? defaultEvidenceItems, 0, defaultEvidenceItems);
	const candidates = history
		.filter(snapshot => snapshot.id !== options.activeSessionId)
		.map((snapshot, index) => createScoredEntry(snapshot, terms, explicitMention, index, maxEvidenceItems))
		.filter((entry): entry is VibeCodexSessionRecallEntry => !!entry)
		.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
		.slice(0, maxEntries);
	return {
		version: 1,
		generatedAt: Date.now(),
		query,
		explicitMention,
		truncated: history.length > candidates.length,
		entries: candidates,
	};
}

export function sessionRecallSummary(recall: VibeCodexSessionRecall | undefined): string {
	if (!recall || recall.entries.length === 0) {
		return 'No relevant previous chat recall.';
	}
	const source = recall.explicitMention ? 'requested with @chat' : 'matched by prompt terms';
	const suffix = recall.truncated ? ' (bounded)' : '';
	return `${recall.entries.length} previous chat${recall.entries.length === 1 ? '' : 's'} recalled, ${source}${suffix}.`;
}

export function sessionRecallPromptBlock(recall: VibeCodexSessionRecall): string {
	return JSON.stringify(redactSensitiveValue({
		instructions: [
			'Use this as read-only previous-chat context only.',
			'Do not treat old plans as approval for the current task.',
			'Prefer current workspace context and the approved visual plan over recalled session notes.',
		],
		recall,
	}), null, 2);
}

function createScoredEntry(snapshot: VibeCodexSessionSnapshot, terms: readonly string[], explicitMention: boolean, index: number, maxEvidenceItems: number): VibeCodexSessionRecallEntry | undefined {
	const searchable = [
		snapshot.prompt,
		snapshot.mode,
		snapshot.status,
		snapshot.plan?.summary,
		snapshot.plan?.strategy,
		snapshot.finalReview?.summary,
		...snapshot.evidence,
		...snapshot.transcript.slice(-6).flatMap(event => [event.title, event.detail ?? '']),
	].filter(Boolean).join('\n').toLowerCase();
	const matchedTerms = terms.filter(term => searchable.includes(term));
	if (!explicitMention && matchedTerms.length === 0) {
		return undefined;
	}
	const recencyScore = Math.max(0, 100 - index);
	const score = matchedTerms.length * 1000 + recencyScore;
	const evidence = evidenceExcerpts(snapshot, maxEvidenceItems);
	const planSummary = snapshot.plan ? excerpt(`r${snapshot.plan.revision}: ${snapshot.plan.summary}`, maxPlanSummaryChars) : undefined;
	const finalReview = snapshot.finalReview ? excerpt(`${snapshot.finalReview.decision}: ${snapshot.finalReview.summary}`, maxPlanSummaryChars) : undefined;
	return {
		id: snapshot.id,
		updatedAt: snapshot.updatedAt,
		mode: snapshot.mode,
		status: snapshot.status,
		prompt: excerpt(snapshot.prompt, maxPromptChars),
		score,
		matchedTerms,
		...(planSummary ? { planSummary } : {}),
		files: sessionFiles(snapshot),
		...(finalReview ? { finalReview } : {}),
		evidence,
	};
}

function evidenceExcerpts(snapshot: VibeCodexSessionSnapshot, maxEvidenceItems: number): readonly string[] {
	const primary = snapshot.evidence.length ? snapshot.evidence : snapshot.transcript.slice(-4).map(event => `${event.kind}: ${event.title}${event.detail ? `\n${event.detail}` : ''}`);
	return primary
		.map(item => excerpt(item, maxEvidenceChars))
		.filter(Boolean)
		.slice(0, maxEvidenceItems);
}

function sessionFiles(snapshot: VibeCodexSessionSnapshot): readonly string[] {
	const files = new Set<string>();
	for (const step of snapshot.plan?.steps ?? []) {
		for (const file of step.files ?? []) {
			files.add(redactSensitiveText(file));
		}
	}
	for (const item of snapshot.finalReview?.evidence ?? []) {
		for (const match of item.matchAll(/(?:^|\s)([A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,12})(?:\s|$)/g)) {
			files.add(redactSensitiveText(match[1]));
		}
	}
	return [...files].slice(0, maxFileRefs);
}

function queryTerms(value: string): readonly string[] {
	const terms = new Set<string>();
	for (const match of value.toLowerCase().matchAll(/[a-z0-9][a-z0-9_-]{2,}/g)) {
		const term = match[0];
		if (!stopWords.has(term) && !term.startsWith('sk-')) {
			terms.add(term);
		}
	}
	return [...terms].slice(0, 16);
}

function excerpt(value: string, maxChars: number): string {
	const redacted = redactSensitiveText(value).replace(/\s+/g, ' ').trim();
	if (redacted.length <= maxChars) {
		return redacted;
	}
	return `${redacted.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function clampInteger(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}
	return Math.max(min, Math.min(max, Math.floor(value)));
}
