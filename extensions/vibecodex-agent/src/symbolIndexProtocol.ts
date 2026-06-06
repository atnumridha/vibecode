/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveValue } from './secretFilters';

export interface VibeCodexSymbolIndex {
	readonly version: 1;
	readonly collectedAt: number;
	readonly entries: readonly VibeCodexSymbolEntry[];
	readonly truncated: boolean;
}

export interface VibeCodexSymbolEntry {
	readonly path: string;
	readonly name: string;
	readonly kind: string;
	readonly range: string;
	readonly containerName?: string;
}

export function symbolIndexSummary(index: VibeCodexSymbolIndex | undefined): string {
	if (!index?.entries.length) {
		return '';
	}
	const files = new Set(index.entries.map(entry => entry.path));
	const kinds = new Map<string, number>();
	for (const entry of index.entries) {
		kinds.set(entry.kind, (kinds.get(entry.kind) ?? 0) + 1);
	}
	const kindSummary = [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([kind, count]) => `${count} ${kind}`).join(', ');
	return `${index.entries.length}${index.truncated ? '+' : ''} symbol${index.entries.length === 1 ? '' : 's'} from ${files.size} file${files.size === 1 ? '' : 's'}${kindSummary ? `: ${kindSummary}` : ''}.`;
}

export function symbolIndexPromptBlock(index: VibeCodexSymbolIndex | undefined): string {
	if (!index) {
		return 'null';
	}
	return JSON.stringify(redactSensitiveValue({
		version: index.version,
		truncated: index.truncated,
		entries: index.entries,
		note: 'Symbols are read-only structural context from VS Code document symbol providers.',
	}), null, 2);
}
