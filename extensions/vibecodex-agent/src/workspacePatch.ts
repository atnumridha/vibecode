/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ExternalDiffFile } from './executionProtocol';
import { applySearchReplaceBlocksToText } from './searchReplaceEdits';
import { collectWorkspaceIgnorePolicy, ignoredByWorkspacePolicy } from './workspaceIgnore';

declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};
declare const TextEncoder: {
	new(): { encode(input: string): Uint8Array };
};

export interface ExternalPatchCheckpoint {
	readonly id: string;
	readonly path: string;
	readonly uri: string;
	readonly previousText: string;
	readonly existed: boolean;
	readonly createdAt: number;
}

export interface ExternalPatchApplyResult {
	readonly path: string;
	readonly checkpoint: ExternalPatchCheckpoint;
	readonly appliedText: string;
}

export interface ExternalPatchBatchApplyResult {
	readonly applied: readonly ExternalPatchApplyResult[];
}

export interface ExternalDiffPreview {
	readonly path: string;
	readonly targetUri: vscode.Uri;
	readonly previousText: string;
	readonly proposedText: string;
	readonly existed: boolean;
}

interface Hunk {
	readonly oldStart: number;
	readonly lines: readonly string[];
}

export async function applyExternalDiffFile(file: ExternalDiffFile): Promise<ExternalPatchApplyResult> {
	const uri = resolveWorkspaceFileUri(file.path);
	await assertWorkspacePathNotIgnored(file.path);
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, file.path);
	const previous = await readWorkspaceSnapshot(uri);
	const appliedText = file.proposedText !== undefined
		? applyWholeFileReplacement(file, previous.text)
		: applyUnifiedDiff(previous.text, file.patch);
	const checkpoint: ExternalPatchCheckpoint = {
		id: `checkpoint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		path: file.path,
		uri: uri.toString(),
		previousText: previous.text,
		existed: previous.existed,
		createdAt: Date.now(),
	};
	await writeWorkspaceText(uri, appliedText);
	return { path: file.path, checkpoint, appliedText };
}

export async function deleteExternalWorkspaceFile(rawPath: string): Promise<ExternalPatchApplyResult> {
	const uri = resolveWorkspaceFileUri(rawPath);
	await assertWorkspacePathNotIgnored(rawPath);
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, rawPath);
	const previous = await readWorkspaceSnapshot(uri);
	if (!previous.existed) {
		throw new Error(`Cannot delete ${rawPath}; file does not exist.`);
	}
	const checkpoint: ExternalPatchCheckpoint = {
		id: `checkpoint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		path: rawPath,
		uri: uri.toString(),
		previousText: previous.text,
		existed: previous.existed,
		createdAt: Date.now(),
	};
	await deleteWorkspaceFile(uri);
	return { path: rawPath, checkpoint, appliedText: '' };
}

export async function applyExternalDiffFilesAtomically(files: readonly ExternalDiffFile[]): Promise<ExternalPatchBatchApplyResult> {
	assertUniqueDiffPaths(files);
	const applied: ExternalPatchApplyResult[] = [];
	try {
		for (const file of files) {
			applied.push(await applyExternalDiffFile(file));
		}
		return { applied };
	} catch (error) {
		const rollbackFailures: string[] = [];
		for (const result of applied.slice().reverse()) {
			try {
				await restoreExternalPatchCheckpoint(result.checkpoint);
			} catch (rollbackError) {
				const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
				rollbackFailures.push(`${result.path}: ${message}`);
			}
		}
		const message = error instanceof Error ? error.message : String(error);
		throw new Error([
			`Atomic diff apply failed: ${message}.`,
			`Rolled back ${applied.length} applied file${applied.length === 1 ? '' : 's'}.`,
			rollbackFailures.length ? `Rollback failures: ${rollbackFailures.join('; ')}` : undefined,
		].filter((line): line is string => !!line).join(' '));
	}
}

export async function previewExternalDiffFile(file: ExternalDiffFile): Promise<ExternalDiffPreview> {
	const uri = resolveWorkspaceFileUri(file.path);
	await assertWorkspacePathNotIgnored(file.path);
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, file.path);
	const previous = await readWorkspaceSnapshot(uri);
	return {
		path: file.path,
		targetUri: uri,
		previousText: previous.text,
		proposedText: proposedTextForExternalDiff(file, previous.text),
		existed: previous.existed,
	};
}

export async function restoreExternalPatchCheckpoint(checkpoint: ExternalPatchCheckpoint): Promise<void> {
	const uri = vscode.Uri.parse(checkpoint.uri);
	assertWorkspaceUri(uri, checkpoint.path);
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, checkpoint.path);
	if (!checkpoint.existed) {
		await deleteWorkspaceFile(uri);
		return;
	}
	await writeWorkspaceText(uri, checkpoint.previousText);
}

export function proposedTextForExternalDiff(file: ExternalDiffFile, baselineText: string): string {
	return file.proposedText !== undefined
		? applyWholeFileReplacement(file, baselineText)
		: file.replacements?.length
			? applySearchReplaceBlocks(file, baselineText)
		: applyUnifiedDiff(baselineText, file.patch);
}

export function resolveWorkspaceFileUri(rawPath: string): vscode.Uri {
	if (!rawPath || /[\u0000\r\n]/.test(rawPath)) {
		throw new Error('Invalid patch path.');
	}
	if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rawPath) && !rawPath.toLowerCase().startsWith('file:')) {
		throw new Error(`Patch path uses unsupported URI scheme: ${rawPath}`);
	}
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders?.length) {
		throw new Error('Open a workspace before applying Vibe Codex diffs.');
	}

	const candidate = rawPath.toLowerCase().startsWith('file:')
		? vscode.Uri.parse(rawPath)
		: isAbsoluteFilePath(rawPath)
			? vscode.Uri.file(normalizeAbsolutePath(rawPath))
			: vscode.Uri.joinPath(workspaceFolders[0].uri, ...normalizeRelativePath(rawPath).split('/'));
	assertWorkspaceUri(candidate, rawPath);
	return candidate;
}

export async function assertWorkspacePathNotIgnored(rawPath: string): Promise<void> {
	const uri = resolveWorkspaceFileUri(rawPath);
	const path = workspaceRelativePath(uri) ?? rawPath;
	const ignoredBy = ignoredByWorkspacePolicy(path, await collectWorkspaceIgnorePolicy());
	if (ignoredBy) {
		throw new Error(`Blocked patch for ignored workspace path ${path} by ${ignoredBy}.`);
	}
}

export async function assertWorkspaceUriHasNoSymlinkTraversal(uri: vscode.Uri, originalPath: string): Promise<void> {
	assertWorkspaceUri(uri, originalPath);
	const root = workspaceRootForUri(uri);
	if (!root) {
		throw new Error(`Blocked patch outside workspace: ${originalPath}`);
	}
	const rootPath = normalizeAbsolutePath(root.fsPath);
	const candidatePath = normalizeAbsolutePath(uri.fsPath);
	const prefix = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
	const relative = candidatePath === rootPath ? '' : candidatePath.startsWith(prefix) ? candidatePath.slice(prefix.length) : '';
	let cursor = root;
	for (const segment of relative.split('/').filter(Boolean)) {
		cursor = vscode.Uri.joinPath(cursor, segment);
		try {
			const stat = await vscode.workspace.fs.stat(cursor);
			if ((stat.type & vscode.FileType.SymbolicLink) !== 0) {
				throw new Error(`Blocked workspace symlink traversal in patch path: ${originalPath}`);
			}
		} catch (error) {
			if (isFileNotFoundError(error)) {
				break;
			}
			throw error;
		}
	}
}

export function applyUnifiedDiff(currentText: string, patch: string): string {
	const hunks = parseUnifiedDiff(patch);
	if (!hunks.length) {
		throw new Error('Diff did not contain a unified patch hunk.');
	}

	const current = splitLines(currentText);
	const result: string[] = [];
	let sourceIndex = 0;
	for (const hunk of hunks) {
		const oldStartIndex = Math.max(0, hunk.oldStart - 1);
		if (oldStartIndex < sourceIndex) {
			throw new Error('Patch hunks overlap or arrive out of order.');
		}
		while (sourceIndex < oldStartIndex && sourceIndex < current.lines.length) {
			result.push(current.lines[sourceIndex++]);
		}
		for (const rawLine of hunk.lines) {
			if (!rawLine || rawLine.startsWith('\\')) {
				continue;
			}
			const marker = rawLine.charAt(0);
			const text = rawLine.slice(1);
			switch (marker) {
				case ' ':
					assertCurrentLine(current.lines[sourceIndex], text, 'context');
					result.push(current.lines[sourceIndex++]);
					break;
				case '-':
					assertCurrentLine(current.lines[sourceIndex], text, 'deletion');
					sourceIndex++;
					break;
				case '+':
					result.push(text);
					break;
				default:
					throw new Error(`Unsupported unified diff line marker: ${marker}`);
			}
		}
	}
	while (sourceIndex < current.lines.length) {
		result.push(current.lines[sourceIndex++]);
	}
	const finalNewline = result.length > 0 && (current.finalNewline || patch.endsWith('\n'));
	return result.join('\n') + (finalNewline ? '\n' : '');
}

function applyWholeFileReplacement(file: ExternalDiffFile, currentText: string): string {
	if (file.previousText !== undefined && file.previousText !== currentText) {
		throw new Error(`Cannot apply ${file.path}; current file no longer matches the proposed diff baseline.`);
	}
	return file.proposedText ?? '';
}

function applySearchReplaceBlocks(file: ExternalDiffFile, currentText: string): string {
	try {
		return applySearchReplaceBlocksToText(file.replacements ?? [], currentText);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Cannot apply ${file.path}; ${message}`);
	}
}

function assertUniqueDiffPaths(files: readonly ExternalDiffFile[]): void {
	const seen = new Set<string>();
	for (const file of files) {
		const key = file.path.replace(/\\/g, '/').toLowerCase();
		if (seen.has(key)) {
			throw new Error(`Atomic diff batch contains duplicate path: ${file.path}`);
		}
		seen.add(key);
	}
}

function parseUnifiedDiff(patch: string): readonly Hunk[] {
	const hunks: Hunk[] = [];
	let current: { oldStart: number; lines: string[] } | undefined;
	for (const line of patch.replace(/\r\n/g, '\n').split('\n')) {
		const hunkHeader = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
		if (hunkHeader) {
			current = { oldStart: Number(hunkHeader[1]), lines: [] };
			hunks.push(current);
			continue;
		}
		if (!current) {
			continue;
		}
		if (line.startsWith('diff --git ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
			continue;
		}
		current.lines.push(line);
	}
	return hunks;
}

function assertCurrentLine(actual: string | undefined, expected: string, kind: string): void {
	if (actual !== expected) {
		throw new Error(`Cannot apply patch; ${kind} line does not match current file.`);
	}
}

async function readWorkspaceSnapshot(uri: vscode.Uri): Promise<{ readonly text: string; readonly existed: boolean }> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		return { text: new TextDecoder('utf-8').decode(bytes), existed: true };
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return { text: '', existed: false };
		}
		throw error;
	}
}

async function writeWorkspaceText(uri: vscode.Uri, text: string): Promise<void> {
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, uri.toString());
	const parent = vscode.Uri.joinPath(uri, '..');
	assertWorkspaceUri(parent, uri.toString());
	await vscode.workspace.fs.createDirectory(parent);
	await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
}

async function deleteWorkspaceFile(uri: vscode.Uri): Promise<void> {
	assertWorkspaceUri(uri, uri.toString());
	await assertWorkspaceUriHasNoSymlinkTraversal(uri, uri.toString());
	try {
		await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
	} catch (error) {
		if (!isFileNotFoundError(error)) {
			throw error;
		}
	}
}

function assertWorkspaceUri(uri: vscode.Uri, originalPath: string): void {
	if (uri.scheme !== 'file') {
		throw new Error(`Patch path must resolve to a local file: ${originalPath}`);
	}
	const candidate = normalizeAbsolutePath(uri.fsPath);
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	for (const folder of workspaceFolders) {
		const root = normalizeAbsolutePath(folder.uri.fsPath);
		if (candidate === root || candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			return;
		}
	}
	throw new Error(`Blocked patch outside workspace: ${originalPath}`);
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	const candidate = normalizeAbsolutePath(uri.fsPath);
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const root = normalizeAbsolutePath(folder.uri.fsPath);
		if (candidate === root) {
			return '.';
		}
		if (candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			return candidate.slice((root.endsWith('/') ? root : `${root}/`).length);
		}
	}
	return undefined;
}

function workspaceRootForUri(uri: vscode.Uri): vscode.Uri | undefined {
	const candidate = normalizeAbsolutePath(uri.fsPath);
	let best: vscode.Uri | undefined;
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const root = normalizeAbsolutePath(folder.uri.fsPath);
		if (candidate === root || candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			if (!best || root.length > normalizeAbsolutePath(best.fsPath).length) {
				best = folder.uri;
			}
		}
	}
	return best;
}

function normalizeRelativePath(rawPath: string): string {
	const parts: string[] = [];
	for (const part of rawPath.replace(/\\/g, '/').split('/')) {
		if (!part || part === '.') {
			continue;
		}
		if (part === '..') {
			throw new Error(`Blocked workspace traversal in patch path: ${rawPath}`);
		}
		parts.push(part);
	}
	if (!parts.length) {
		throw new Error('Patch path must target a file.');
	}
	return parts.join('/');
}

function normalizeAbsolutePath(rawPath: string): string {
	const normalized = rawPath.replace(/\\/g, '/');
	const drive = /^[A-Za-z]:\//.test(normalized) ? normalized.slice(0, 3) : '';
	const root = drive || (normalized.startsWith('/') ? '/' : '');
	const body = normalized.slice(root.length);
	const parts: string[] = [];
	for (const part of body.split('/')) {
		if (!part || part === '.') {
			continue;
		}
		if (part === '..') {
			parts.pop();
			continue;
		}
		parts.push(part);
	}
	return `${root}${parts.join('/')}`;
}

function isAbsoluteFilePath(rawPath: string): boolean {
	return rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath);
}

function splitLines(text: string): { readonly lines: readonly string[]; readonly finalNewline: boolean } {
	const normalized = text.replace(/\r\n/g, '\n');
	const finalNewline = normalized.endsWith('\n');
	const lines = normalized.split('\n');
	if (finalNewline) {
		lines.pop();
	}
	return { lines, finalNewline };
}

function isFileNotFoundError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) {
		return false;
	}
	const candidate = error as { readonly code?: unknown; readonly name?: unknown; readonly message?: unknown };
	return candidate.code === 'FileNotFound'
		|| String(candidate.name ?? '').includes('FileNotFound')
		|| String(candidate.message ?? '').includes('FileNotFound');
}
