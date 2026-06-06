/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscodeTypes from 'vscode';
import { queryTermsFromPrompt } from './contextSearch';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

declare const require: (module: string) => typeof vscodeTypes;
declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export interface VibeCodexDocsContext {
	readonly version: 1;
	readonly collectedAt: number;
	readonly explicitMention: boolean;
	readonly query: string;
	readonly documents: readonly VibeCodexDocsDocument[];
}

export interface VibeCodexDocsDocument {
	readonly path: string;
	readonly title: string;
	readonly kind: 'readme' | 'guide' | 'api' | 'adr' | 'changelog' | 'contributing' | 'generic';
	readonly score: number;
	readonly matchedTerms: readonly string[];
	readonly truncated: boolean;
	readonly text: string;
}

export interface VibeCodexDocsCandidate {
	readonly path: string;
	readonly text: string;
}

const docsInclude = '{README.md,README,CHANGELOG.md,CONTRIBUTING.md,SECURITY.md,docs/**/*.{md,mdx,txt},documentation/**/*.{md,mdx,txt},adr/**/*.{md,mdx},ADRs/**/*.{md,mdx},.github/**/*.md}';
const docsExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const maxDocsCandidates = 80;
const maxDocsDocuments = 8;
const maxDocumentBytes = 14000;
const maxDocumentTextChars = 7000;

export async function collectDocsContext(prompt: string): Promise<VibeCodexDocsContext> {
	const explicitMention = hasDocsMention(prompt);
	const query = redactSensitiveText(prompt.replace(/(?:^|\s)@docs(?:\b|$)/ig, ' ').trim());
	if (!explicitMention && !looksLikeDocumentationPrompt(query)) {
		return {
			version: 1,
			collectedAt: Date.now(),
			explicitMention,
			query,
			documents: [],
		};
	}
	const vscode = require('vscode');
	const candidates: VibeCodexDocsCandidate[] = [];
	for (const uri of await vscode.workspace.findFiles(docsInclude, docsExclude, maxDocsCandidates)) {
		const path = workspaceRelativePath(uri, vscode);
		const text = await readWorkspaceText(uri, vscode);
		if (!path || !text) {
			continue;
		}
		candidates.push({ path, text });
	}
	return {
		version: 1,
		collectedAt: Date.now(),
		explicitMention,
		query,
		documents: rankDocsDocuments(candidates, query, maxDocsDocuments),
	};
}

export function rankDocsDocuments(candidates: readonly VibeCodexDocsCandidate[], prompt: string, limit = maxDocsDocuments): readonly VibeCodexDocsDocument[] {
	const terms = queryTermsFromPrompt(prompt);
	return candidates
		.map(candidate => docsDocument(candidate, terms))
		.filter((document): document is VibeCodexDocsDocument => !!document)
		.filter(document => terms.length === 0 || document.matchedTerms.length > 0 || document.kind === 'readme')
		.sort((first, second) => second.score - first.score || first.path.localeCompare(second.path))
		.slice(0, Math.max(0, Math.min(12, Math.floor(Number.isFinite(limit) ? limit : maxDocsDocuments))));
}

export function docsContextSummary(context: VibeCodexDocsContext | undefined): string {
	if (!context || context.documents.length === 0) {
		return 'No docs context loaded.';
	}
	const source = context.explicitMention ? '@docs' : 'documentation prompt';
	return `${context.documents.length} docs document${context.documents.length === 1 ? '' : 's'} loaded from ${source}: ${context.documents.map(document => document.path).join(', ')}.`;
}

export function docsContextPromptBlock(context: VibeCodexDocsContext): string {
	return JSON.stringify(redactSensitiveValue({
		version: context.version,
		explicitMention: context.explicitMention,
		query: context.query,
		documents: context.documents.map(document => ({
			path: document.path,
			title: document.title,
			kind: document.kind,
			matchedTerms: document.matchedTerms,
			truncated: document.truncated,
			text: document.text,
		})),
		note: 'Docs context is read-only planning input. Do not edit documentation unless the approved visual plan explicitly includes documentation changes.',
	}), null, 2);
}

function docsDocument(candidate: VibeCodexDocsCandidate, terms: readonly string[]): VibeCodexDocsDocument | undefined {
	const text = redactSensitiveText(candidate.text).trim();
	if (!text || text.includes('\u0000')) {
		return undefined;
	}
	const lower = `${candidate.path}\n${text}`.toLowerCase();
	const matchedTerms = terms.filter(term => lower.includes(term));
	const kind = docsKind(candidate.path);
	const score = matchedTerms.length * 1000 + docsKindPriority(kind) + pathPriority(candidate.path);
	const truncated = text.length > maxDocumentTextChars;
	return {
		path: redactSensitiveText(candidate.path),
		title: docsTitle(candidate.path, text),
		kind,
		score,
		matchedTerms,
		truncated,
		text: truncated ? `${text.slice(0, maxDocumentTextChars).trim()}\n[truncated]` : text,
	};
}

function hasDocsMention(prompt: string): boolean {
	return /(?:^|\s)@docs(?:\b|$)/i.test(prompt) || /(?:^|\s)@documentation(?:\b|$)/i.test(prompt);
}

function looksLikeDocumentationPrompt(prompt: string): boolean {
	return /\b(docs?|documentation|readme|guide|changelog|adr|runbook|api reference)\b/i.test(prompt);
}

async function readWorkspaceText(uri: vscodeTypes.Uri, vscode: typeof vscodeTypes): Promise<string | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		if (bytes.byteLength > maxDocumentBytes) {
			return redactSensitiveText(new TextDecoder('utf-8').decode(bytes.slice(0, maxDocumentBytes)) + '\n[truncated]');
		}
		return redactSensitiveText(new TextDecoder('utf-8').decode(bytes));
	} catch {
		return undefined;
	}
}

function workspaceRelativePath(uri: vscodeTypes.Uri, vscode: typeof vscodeTypes): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	return vscode.workspace.asRelativePath(uri, false);
}

function docsTitle(path: string, text: string): string {
	const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
	if (heading) {
		return redactSensitiveText(heading).slice(0, 120);
	}
	const basename = path.split('/').pop() || path;
	return basename.replace(/\.(mdx?|txt)$/i, '').replace(/[-_]+/g, ' ').slice(0, 120);
}

function docsKind(path: string): VibeCodexDocsDocument['kind'] {
	const lower = path.toLowerCase();
	if (/(^|\/)readme(\.md)?$/.test(lower)) {
		return 'readme';
	}
	if (lower.includes('changelog')) {
		return 'changelog';
	}
	if (lower.includes('contributing') || lower.includes('security')) {
		return 'contributing';
	}
	if (lower.includes('/adr/') || lower.includes('/adrs/')) {
		return 'adr';
	}
	if (lower.includes('api') || lower.includes('reference')) {
		return 'api';
	}
	if (lower.includes('/docs/') || lower.includes('/documentation/')) {
		return 'guide';
	}
	return 'generic';
}

function docsKindPriority(kind: VibeCodexDocsDocument['kind']): number {
	switch (kind) {
		case 'readme': return 80;
		case 'guide': return 60;
		case 'api': return 55;
		case 'adr': return 50;
		case 'contributing': return 40;
		case 'changelog': return 30;
		default: return 10;
	}
}

function pathPriority(path: string): number {
	const depth = path.split('/').filter(Boolean).length;
	return Math.max(0, 20 - depth);
}
