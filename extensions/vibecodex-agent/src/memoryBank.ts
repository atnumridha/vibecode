/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export type VibeCodexMemoryBankDocumentKind = 'projectbrief' | 'productContext' | 'activeContext' | 'systemPatterns' | 'techContext' | 'progress' | 'decisionLog' | 'generic';

export interface VibeCodexMemoryBank {
	readonly version: 1;
	readonly collectedAt: number;
	readonly status: 'ready' | 'empty';
	readonly documents: readonly VibeCodexMemoryBankDocument[];
}

export interface VibeCodexMemoryBankDocument {
	readonly path: string;
	readonly kind: VibeCodexMemoryBankDocumentKind;
	readonly title: string;
	readonly text: string;
	readonly truncated: boolean;
}

const memoryBankExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const memoryBankPatterns = [
	'memory-bank/*.md',
	'memory-bank/**/*.md',
	'.cline/memory-bank/*.md',
	'.cline/memory-bank/**/*.md',
	'.vibecodex/memory-bank/*.md',
	'.vibecodex/memory-bank/**/*.md',
	'.codex/memory-bank/*.md',
	'.codex/memory-bank/**/*.md',
	'.cursor/memory-bank/*.md',
	'.cursor/memory-bank/**/*.md',
] as const;
const maxMemoryBankDocuments = 18;
const maxMemoryBankDocumentBytes = 14000;

export async function collectMemoryBank(): Promise<VibeCodexMemoryBank> {
	const documents: VibeCodexMemoryBankDocument[] = [];
	for (const uri of await findUniqueMemoryBankFiles()) {
		const path = workspaceRelativePath(uri);
		const document = path ? await readMemoryBankDocument(uri, path) : undefined;
		if (document) {
			documents.push(document);
		}
		if (documents.length >= maxMemoryBankDocuments) {
			break;
		}
	}
	const sorted = documents.sort((a, b) => documentPriority(a.kind) - documentPriority(b.kind) || a.path.localeCompare(b.path));
	return {
		version: 1,
		collectedAt: Date.now(),
		status: sorted.length ? 'ready' : 'empty',
		documents: sorted,
	};
}

export function memoryBankSummary(memoryBank: VibeCodexMemoryBank): string {
	if (!memoryBank.documents.length) {
		return 'No Memory Bank documents found.';
	}
	const kinds = new Map<VibeCodexMemoryBankDocumentKind, number>();
	for (const document of memoryBank.documents) {
		kinds.set(document.kind, (kinds.get(document.kind) ?? 0) + 1);
	}
	const kindSummary = [...kinds.entries()].map(([kind, count]) => `${count} ${kind}`).join(', ');
	return `${memoryBank.documents.length} Memory Bank document${memoryBank.documents.length === 1 ? '' : 's'} loaded${kindSummary ? `: ${kindSummary}.` : '.'}`;
}

export function memoryBankPromptBlock(memoryBank: VibeCodexMemoryBank): string {
	return JSON.stringify(redactSensitiveValue({
		version: memoryBank.version,
		status: memoryBank.status,
		documents: memoryBank.documents.map(document => ({
			path: document.path,
			kind: document.kind,
			title: document.title,
			truncated: document.truncated,
			text: document.text,
		})),
		note: 'Memory Bank documents are read-only planning context. Propose updates through the normal visual plan, diff review, and checkpoint flow.',
	}), null, 2);
}

export function memoryBankDocumentKind(path: string): VibeCodexMemoryBankDocumentKind {
	const lower = path.toLowerCase();
	const name = lower.split('/').pop() ?? lower;
	if (name === 'projectbrief.md' || name === 'project-brief.md') {
		return 'projectbrief';
	}
	if (name === 'productcontext.md' || name === 'product-context.md') {
		return 'productContext';
	}
	if (name === 'activecontext.md' || name === 'active-context.md') {
		return 'activeContext';
	}
	if (name === 'systempatterns.md' || name === 'system-patterns.md') {
		return 'systemPatterns';
	}
	if (name === 'techcontext.md' || name === 'tech-context.md') {
		return 'techContext';
	}
	if (name === 'progress.md') {
		return 'progress';
	}
	if (name === 'decisionlog.md' || name === 'decision-log.md' || name === 'decisions.md') {
		return 'decisionLog';
	}
	return 'generic';
}

async function findUniqueMemoryBankFiles(): Promise<readonly vscode.Uri[]> {
	const seen = new Set<string>();
	const files: vscode.Uri[] = [];
	for (const pattern of memoryBankPatterns) {
		for (const uri of await vscode.workspace.findFiles(pattern, memoryBankExclude, maxMemoryBankDocuments)) {
			const key = uri.toString();
			if (!seen.has(key)) {
				seen.add(key);
				files.push(uri);
			}
		}
	}
	return files.sort((a, b) => workspaceRelativePath(a).localeCompare(workspaceRelativePath(b))).slice(0, maxMemoryBankDocuments);
}

async function readMemoryBankDocument(uri: vscode.Uri, path: string): Promise<VibeCodexMemoryBankDocument | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		const truncated = bytes.byteLength > maxMemoryBankDocumentBytes;
		const buffer = truncated ? bytes.slice(0, maxMemoryBankDocumentBytes) : bytes;
		const text = redactSensitiveText(new TextDecoder('utf-8').decode(buffer) + (truncated ? '\n[truncated]' : ''));
		if (!text.trim()) {
			return undefined;
		}
		return {
			path,
			kind: memoryBankDocumentKind(path),
			title: documentTitle(path, text),
			text,
			truncated,
		};
	} catch {
		return undefined;
	}
}

function documentTitle(path: string, text: string): string {
	const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
	if (heading) {
		return heading.slice(0, 120);
	}
	const fileName = path.split('/').pop()?.replace(/\.md$/i, '') ?? path;
	return fileName.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()).slice(0, 120);
}

function documentPriority(kind: VibeCodexMemoryBankDocumentKind): number {
	switch (kind) {
		case 'projectbrief': return 0;
		case 'productContext': return 1;
		case 'activeContext': return 2;
		case 'systemPatterns': return 3;
		case 'techContext': return 4;
		case 'progress': return 5;
		case 'decisionLog': return 6;
		case 'generic': return 7;
	}
}

function workspaceRelativePath(uri: vscode.Uri): string {
	return vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
}
