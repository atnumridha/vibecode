/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface VibeCodexSearchReplaceBlock {
	readonly search: string;
	readonly replace: string;
	readonly startLine?: number;
}

export function parseSearchReplaceBlocks(diff: string): readonly VibeCodexSearchReplaceBlock[] {
	const normalized = diff.replace(/\r\n/g, '\n');
	const blocks: VibeCodexSearchReplaceBlock[] = [];
	const pattern = /<<<<<<< SEARCH\s*\n([\s\S]*?)\n=======\s*\n([\s\S]*?)\n>>>>>>> REPLACE/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(normalized)) !== null) {
		const prepared = stripSearchMetadata(match[1]);
		if (!prepared.search.length) {
			continue;
		}
		blocks.push({
			search: prepared.search,
			replace: stripBoundaryPadding(match[2]),
			...(prepared.startLine ? { startLine: prepared.startLine } : {}),
		});
	}
	return blocks;
}

export function applySearchReplaceBlocksToText(blocks: readonly VibeCodexSearchReplaceBlock[], currentText: string): string {
	let next = currentText;
	for (const block of blocks) {
		if (!block.search.length) {
			throw new Error('SEARCH block is empty.');
		}
		const index = replacementIndex(next, block.search, block.startLine);
		if (index < 0) {
			throw new Error('SEARCH block does not match the current file.');
		}
		next = `${next.slice(0, index)}${block.replace}${next.slice(index + block.search.length)}`;
	}
	return next;
}

function stripSearchMetadata(value: string): { readonly search: string; readonly startLine?: number } {
	const lines = value.split('\n');
	let startLine: number | undefined;
	let index = 0;
	while (index < lines.length) {
		const line = lines[index].trim();
		const startLineMatch = /^:start_line:\s*(\d+)\s*$/i.exec(line);
		if (startLineMatch) {
			startLine = Number(startLineMatch[1]);
			index++;
			continue;
		}
		if (/^:[a-z_]+:\s*.+$/i.test(line)) {
			index++;
			continue;
		}
		if (line === '-------') {
			index++;
			break;
		}
		break;
	}
	return {
		search: stripBoundaryPadding(lines.slice(index).join('\n')),
		...(startLine ? { startLine } : {}),
	};
}

function replacementIndex(text: string, search: string, startLine: number | undefined): number {
	if (startLine && startLine > 0) {
		const lineOffset = offsetForLine(text, startLine);
		if (lineOffset >= 0 && text.slice(lineOffset, lineOffset + search.length) === search) {
			return lineOffset;
		}
	}
	const first = text.indexOf(search);
	if (first < 0) {
		return -1;
	}
	if (text.indexOf(search, first + search.length) !== -1) {
		throw new Error('SEARCH block is ambiguous; include a unique block or start_line metadata.');
	}
	return first;
}

function offsetForLine(text: string, oneBasedLine: number): number {
	if (oneBasedLine <= 1) {
		return 0;
	}
	let line = 1;
	for (let index = 0; index < text.length; index++) {
		if (text.charCodeAt(index) === 10) {
			line++;
			if (line === oneBasedLine) {
				return index + 1;
			}
		}
	}
	return -1;
}

function stripBoundaryPadding(value: string): string {
	return value.replace(/^\n/, '').replace(/\n$/, '');
}
