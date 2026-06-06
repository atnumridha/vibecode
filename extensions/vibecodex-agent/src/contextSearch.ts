/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface VibeCodexLexicalCandidate {
	readonly path: string;
	readonly text?: string;
	readonly languageId?: string;
}

export type VibeCodexSearchCandidate = VibeCodexLexicalCandidate;

export interface VibeCodexSearchHit {
	readonly path: string;
	readonly score: number;
	readonly matchedTerms: readonly string[];
	readonly snippet?: string;
	readonly languageId?: string;
	readonly strategy?: 'lexical' | 'semantic';
}

const maxQueryTerms = 12;
const maxSnippetLength = 360;
const stopWords = new Set([
	'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'should', 'would', 'could', 'please', 'implement', 'change', 'update', 'make', 'create',
]);

export function queryTermsFromPrompt(prompt: string): readonly string[] {
	const withoutMentions = prompt.replace(/@[^\s,;]+/g, ' ');
	const terms = new Map<string, string>();
	for (const match of withoutMentions.matchAll(/[A-Za-z0-9_.$/-]{3,}/g)) {
		const raw = match[0].replace(/^[-.$/]+|[-.$/]+$/g, '');
		const normalized = raw.toLowerCase();
		if (!normalized || stopWords.has(normalized) || /^\d+$/.test(normalized)) {
			continue;
		}
		terms.set(normalized, raw);
		if (terms.size >= maxQueryTerms) {
			break;
		}
	}
	return [...terms.keys()];
}

export function rankLexicalSearchCandidates(prompt: string, candidates: readonly VibeCodexLexicalCandidate[], limit = 12): readonly VibeCodexSearchHit[] {
	const terms = queryTermsFromPrompt(prompt);
	if (!terms.length) {
		return [];
	}
	return candidates
		.map(candidate => scoreCandidate(candidate, terms))
		.filter((hit): hit is VibeCodexSearchHit => !!hit)
		.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
		.slice(0, Math.max(0, limit));
}

export function rankSemanticSearchCandidates(prompt: string, candidates: readonly VibeCodexSearchCandidate[], limit = 12): readonly VibeCodexSearchHit[] {
	const queryTerms = expandedQueryTerms(prompt);
	if (!queryTerms.length) {
		return [];
	}
	return candidates
		.map(candidate => scoreSemanticCandidate(candidate, queryTerms))
		.filter((hit): hit is VibeCodexSearchHit => !!hit)
		.sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length || a.path.localeCompare(b.path))
		.slice(0, Math.max(0, limit));
}

function scoreCandidate(candidate: VibeCodexLexicalCandidate, terms: readonly string[]): VibeCodexSearchHit | undefined {
	const path = candidate.path.toLowerCase();
	const text = candidate.text?.toLowerCase() ?? '';
	const matchedTerms: string[] = [];
	let score = 0;
	let firstTextIndex = -1;
	for (const term of terms) {
		const pathIndex = path.indexOf(term);
		const textIndex = text.indexOf(term);
		if (pathIndex === -1 && textIndex === -1) {
			continue;
		}
		matchedTerms.push(term);
		if (pathIndex !== -1) {
			score += path.endsWith(term) ? 12 : path.includes(`/${term}`) ? 9 : 5;
		}
		if (textIndex !== -1) {
			score += Math.min(12, countOccurrences(text, term) * 2);
			if (firstTextIndex === -1 || textIndex < firstTextIndex) {
				firstTextIndex = textIndex;
			}
		}
	}
	if (!matchedTerms.length) {
		return undefined;
	}
	return {
		path: candidate.path,
		score,
		matchedTerms,
		...(candidate.text && firstTextIndex >= 0 ? { snippet: snippetAround(candidate.text, firstTextIndex) } : {}),
		...(candidate.languageId ? { languageId: candidate.languageId } : {}),
		strategy: 'lexical',
	};
}

function scoreSemanticCandidate(candidate: VibeCodexSearchCandidate, queryTerms: readonly string[]): VibeCodexSearchHit | undefined {
	const pathTerms = searchableTerms(candidate.path);
	const textTerms = searchableTerms(candidate.text ?? '');
	const matchedTerms: string[] = [];
	let score = 0;
	for (const term of queryTerms) {
		const pathMatch = pathTerms.has(term);
		const textMatch = textTerms.has(term);
		if (!pathMatch && !textMatch) {
			continue;
		}
		matchedTerms.push(term);
		if (pathMatch) {
			score += 10;
		}
		if (textMatch) {
			score += 3;
		}
	}
	if (!matchedTerms.length) {
		return undefined;
	}
	const firstIndex = firstSemanticTextIndex(candidate.text ?? '', matchedTerms);
	return {
		path: candidate.path,
		score,
		matchedTerms,
		...(candidate.text && firstIndex >= 0 ? { snippet: snippetAround(candidate.text, firstIndex) } : candidate.text ? { snippet: snippetAround(candidate.text, 0) } : {}),
		...(candidate.languageId ? { languageId: candidate.languageId } : {}),
		strategy: 'semantic',
	};
}

function expandedQueryTerms(prompt: string): readonly string[] {
	const terms = new Set<string>();
	for (const term of queryTermsFromPrompt(prompt)) {
		for (const searchable of searchableTerms(term)) {
			if (!stopWords.has(searchable)) {
				terms.add(searchable);
			}
		}
	}
	return [...terms].slice(0, maxQueryTerms * 2);
}

function searchableTerms(value: string): Set<string> {
	const normalized = value
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_./\\-]+/g, ' ')
		.toLowerCase();
	const terms = new Set<string>();
	for (const match of normalized.matchAll(/[a-z0-9]{3,}/g)) {
		const term = match[0];
		if (!stopWords.has(term) && !/^\d+$/.test(term)) {
			terms.add(term);
		}
	}
	return terms;
}

function firstSemanticTextIndex(text: string, terms: readonly string[]): number {
	const lower = text.toLowerCase();
	let first = -1;
	for (const term of terms) {
		const index = lower.indexOf(term);
		if (index >= 0 && (first === -1 || index < first)) {
			first = index;
		}
	}
	return first;
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

function snippetAround(text: string, index: number): string {
	const start = Math.max(0, index - 120);
	const end = Math.min(text.length, index + maxSnippetLength - 120);
	const prefix = start > 0 ? '...' : '';
	const suffix = end < text.length ? '...' : '';
	return `${prefix}${text.slice(start, end)}${suffix}`.replace(/\s+/g, ' ').trim();
}
