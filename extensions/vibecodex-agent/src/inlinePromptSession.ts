/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { redactSensitiveText } from './secretFilters';

export interface VibeCodexInlinePromptSession {
	readonly id: string;
	readonly source: 'inlinePrompt';
	readonly createdAt: number;
	readonly instruction: string;
	readonly prompt: string;
	readonly file?: string;
	readonly languageId?: string;
	readonly range?: string;
	readonly selectionKind: 'active-file' | 'selected-range' | 'workspace';
	readonly selectedText?: string;
	readonly selectedTextTruncated?: boolean;
	readonly contextBefore?: string;
	readonly contextBeforeRange?: string;
	readonly contextAfter?: string;
	readonly contextAfterRange?: string;
	readonly requiredPlanSteps: readonly string[];
	readonly acceptanceCriteria: readonly string[];
}

const selectedTextMaxLength = 12000;
const surroundingContextLineCount = 20;
const surroundingContextMaxLength = 5000;

export function createInlinePromptSession(editor: vscode.TextEditor | undefined, instruction: string): VibeCodexInlinePromptSession {
	const createdAt = Date.now();
	const id = `inline-${createdAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const trimmedInstruction = redactSensitiveText(instruction.trim());
	if (!editor) {
		const requiredPlanSteps = [
			'Clarify the workspace target before mutation.',
			'Generate a visual VibeCodexPlan and wait for explicit approval.',
			'Execute only after approval and present verification evidence.',
		];
		const acceptanceCriteria = [
			'No workspace mutation occurs before plan approval.',
			'The final review explains which files were inspected or changed.',
		];
		const prompt = createPrompt({
			instruction: trimmedInstruction,
			selectionKind: 'workspace',
			requiredPlanSteps,
			acceptanceCriteria,
		});
		return { id, source: 'inlinePrompt', createdAt, instruction: trimmedInstruction, prompt, selectionKind: 'workspace', requiredPlanSteps, acceptanceCriteria };
	}

	const document = editor.document;
	const selection = editor.selection;
	const file = document.uri.scheme === 'file' ? vscode.workspace.asRelativePath(document.uri, false) : document.uri.toString();
	const effectiveRange = selection.isEmpty ? lineRange(document, selection.active.line) : selection;
	const selected = capText(redactSensitiveText(document.getText(effectiveRange)), selectedTextMaxLength);
	const before = contextBefore(document, effectiveRange);
	const after = contextAfter(document, effectiveRange);
	const range = rangeToPrompt(effectiveRange);
	const selectionKind = selection.isEmpty ? 'active-file' : 'selected-range';
	const requiredPlanSteps = createRequiredPlanSteps(file, range, selectionKind);
	const acceptanceCriteria = createAcceptanceCriteria(file, range, selectionKind);
	const prompt = createPrompt({
		instruction: trimmedInstruction,
		file,
		languageId: document.languageId,
		range,
		selectionKind,
		selectedText: selected.text,
		selectedTextTruncated: selected.truncated,
		contextBefore: before?.text,
		contextBeforeRange: before?.range,
		contextAfter: after?.text,
		contextAfterRange: after?.range,
		requiredPlanSteps,
		acceptanceCriteria,
	});

	return {
		id,
		source: 'inlinePrompt',
		createdAt,
		instruction: trimmedInstruction,
		prompt,
		file,
		languageId: document.languageId,
		range,
		selectionKind,
		selectedText: selected.text,
		...(selected.truncated ? { selectedTextTruncated: true } : {}),
		...(before ? { contextBefore: before.text, contextBeforeRange: before.range } : {}),
		...(after ? { contextAfter: after.text, contextAfterRange: after.range } : {}),
		requiredPlanSteps,
		acceptanceCriteria,
	};
}

function createPrompt(input: {
	readonly instruction: string;
	readonly file?: string;
	readonly languageId?: string;
	readonly range?: string;
	readonly selectionKind: VibeCodexInlinePromptSession['selectionKind'];
	readonly selectedText?: string;
	readonly selectedTextTruncated?: boolean;
	readonly contextBefore?: string;
	readonly contextBeforeRange?: string;
	readonly contextAfter?: string;
	readonly contextAfterRange?: string;
	readonly requiredPlanSteps: readonly string[];
	readonly acceptanceCriteria: readonly string[];
}): string {
	return [
		'Inline edit request from VibeCode Ctrl/Cmd+K.',
		'Plan Mode is required before any mutation. Generate a structured VibeCodexPlan with strategy, Mermaid flowchart, checklist steps, risks, and acceptance criteria.',
		'Do not write files, run terminal commands, install dependencies, or call mutating tools before the user approves the rendered plan revision.',
		'',
		'User instruction:',
		input.instruction || '(empty instruction)',
		'',
		'Inline context:',
		input.file ? `- File: @${input.file}` : '- File: workspace not selected',
		input.languageId ? `- Language: ${input.languageId}` : undefined,
		input.range ? `- Range: ${input.range}` : undefined,
		`- Selection kind: ${selectionKindLabel(input.selectionKind)}`,
		'',
		'Required visual planning contract:',
		'- Submit a VibeCodexPlan object through agent/submitPlan or the local fallback plan renderer before Act/Agent work.',
		'- Required fields: taskId, revision, summary, strategy, flowchart, steps, risks, acceptanceCriteria.',
		'- flowchart must be Mermaid graph TD or flowchart TD syntax. Every steps[].flowNodeId must match a node in the Mermaid graph.',
		'',
		'Required plan steps:',
		...input.requiredPlanSteps.map((step, index) => `${index + 1}. ${step}`),
		'',
		'Required acceptance criteria:',
		...input.acceptanceCriteria.map(item => `- ${item}`),
		input.contextBefore ? `\nNearby code before selection (${input.contextBeforeRange}):\n\`\`\`${input.languageId ?? ''}\n${input.contextBefore}\n\`\`\`` : undefined,
		input.selectedText ? `\nSelected code${input.selectedTextTruncated ? ' (truncated)' : ''}:\n\`\`\`${input.languageId ?? ''}\n${input.selectedText}\n\`\`\`` : undefined,
		input.contextAfter ? `\nNearby code after selection (${input.contextAfterRange}):\n\`\`\`${input.languageId ?? ''}\n${input.contextAfter}\n\`\`\`` : undefined,
	].filter((value): value is string => value !== undefined).join('\n');
}

function createRequiredPlanSteps(file: string, range: string, selectionKind: VibeCodexInlinePromptSession['selectionKind']): readonly string[] {
	return [
		`Inspect ${file} ${range} and nearby context without mutation.`,
		'Design the inline edit with a Mermaid node for each checklist step.',
		selectionKind === 'selected-range' ? `After approval, apply the minimal diff for ${file} and the selected range.` : `After approval, apply the minimal diff for ${file}.`,
		'Run or identify the closest verification command and inspect diagnostics.',
		'Present atomic diff review controls with Accept, Reject, and rollback checkpoint evidence.',
	];
}

function createAcceptanceCriteria(file: string, range: string, selectionKind: VibeCodexInlinePromptSession['selectionKind']): readonly string[] {
	return [
		selectionKind === 'selected-range'
			? `The accepted diff review includes the selected range in ${file} ${range} or explicitly explains why the edit moved elsewhere.`
			: `The accepted diff review includes ${file} ${range} or explicitly explains why the edit moved elsewhere.`,
		'The closest available verification command passes after the approved inline edit.',
		'Diagnostics have no new errors for the edited file or related callers.',
		'A rollback checkpoint exists before applying any inline edit mutations.',
	];
}

function contextBefore(document: vscode.TextDocument, range: vscode.Range): { readonly text: string; readonly range: string } | undefined {
	const startLine = Math.max(0, range.start.line - surroundingContextLineCount);
	const contextRange = new vscode.Range(new vscode.Position(startLine, 0), range.start);
	return contextForRange(document, contextRange, 'before');
}

function contextAfter(document: vscode.TextDocument, range: vscode.Range): { readonly text: string; readonly range: string } | undefined {
	const endLine = Math.min(document.lineCount - 1, range.end.line + surroundingContextLineCount);
	const endPosition = document.lineAt(endLine).range.end;
	const contextRange = new vscode.Range(range.end, endPosition);
	return contextForRange(document, contextRange, 'after');
}

function contextForRange(document: vscode.TextDocument, range: vscode.Range, side: 'before' | 'after'): { readonly text: string; readonly range: string } | undefined {
	const raw = document.getText(range);
	if (!raw.trim()) {
		return undefined;
	}
	const capped = capSurroundingContext(redactSensitiveText(raw), side);
	return { text: capped, range: rangeToPrompt(range) };
}

function capSurroundingContext(value: string, side: 'before' | 'after'): string {
	if (value.length <= surroundingContextMaxLength) {
		return value;
	}
	if (side === 'before') {
		const prefix = '... [inline context truncated]\n';
		return `${prefix}${value.slice(value.length - surroundingContextMaxLength + prefix.length)}`;
	}
	const suffix = '\n... [inline context truncated]';
	return `${value.slice(0, surroundingContextMaxLength - suffix.length)}${suffix}`;
}

function lineRange(document: vscode.TextDocument, line: number): vscode.Range {
	const safeLine = Math.max(0, Math.min(document.lineCount - 1, line));
	return document.lineAt(safeLine).range;
}

function capText(value: string, maxLength: number): { readonly text: string; readonly truncated: boolean } {
	if (value.length <= maxLength) {
		return { text: value, truncated: false };
	}
	return { text: `${value.slice(0, maxLength)}\n... [inline selection truncated]`, truncated: true };
}

function rangeToPrompt(range: vscode.Range): string {
	return `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}`;
}

function selectionKindLabel(kind: VibeCodexInlinePromptSession['selectionKind']): string {
	switch (kind) {
		case 'selected-range':
			return 'highlighted code range';
		case 'active-file':
			return 'active line in current file';
		default:
			return 'workspace prompt';
	}
}
