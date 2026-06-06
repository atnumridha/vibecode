/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VibeCodexLexicalCandidate, VibeCodexSearchHit, queryTermsFromPrompt, rankLexicalSearchCandidates } from './contextSearch';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import { VibeCodexSymbolIndex, collectSymbolIndex, symbolIndexSummary } from './symbolIndex';
import { VibeCodexWorkspaceIgnorePolicy, collectWorkspaceIgnorePolicy, isWorkspacePathIgnored, workspaceIgnoreSummary } from './workspaceIgnore';

declare const require: (module: string) => unknown;
declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

type ExecFileFunction = (file: string, args: readonly string[], options: { readonly cwd?: string; readonly timeout?: number; readonly maxBuffer?: number }, callback: (error: Error | null, stdout: string, stderr: string) => void) => void;

export interface VibeCodexContextPack {
	readonly version: 1;
	readonly gatheredAt: number;
	readonly mode: string;
	readonly workspaceRoots: readonly string[];
	readonly promptMentions: readonly VibeCodexMention[];
	readonly activeEditor?: VibeCodexActiveEditorContext;
	readonly files: readonly VibeCodexContextFile[];
	readonly searchHits: readonly VibeCodexSearchHit[];
	readonly symbolIndex?: VibeCodexSymbolIndex;
	readonly diagnostics: readonly VibeCodexDiagnostic[];
	readonly ignorePolicy?: VibeCodexWorkspaceIgnorePolicy;
	readonly terminal?: VibeCodexTerminalContext;
	readonly git?: VibeCodexGitContext;
}

export interface VibeCodexMention {
	readonly raw: string;
	readonly kind: 'file' | 'folder' | 'git' | 'diagnostics' | 'terminal' | 'workspace' | 'symbols' | 'docs' | 'chat' | 'unknown';
	readonly value: string;
}

export interface VibeCodexActiveEditorContext {
	readonly path: string;
	readonly languageId: string;
	readonly selectionRange?: string;
	readonly selectedText?: string;
}

export interface VibeCodexContextFile {
	readonly path: string;
	readonly kind: 'active' | 'mention' | 'workspace';
	readonly languageId?: string;
	readonly text?: string;
}

export interface VibeCodexDiagnostic {
	readonly path: string;
	readonly severity: 'error' | 'warning' | 'information' | 'hint';
	readonly message: string;
	readonly range: string;
	readonly source?: string;
}

export interface VibeCodexTerminalContext {
	readonly name: string;
	readonly processId?: number;
}

export interface VibeCodexGitContext {
	readonly repositories: readonly VibeCodexGitRepositoryContext[];
}

export interface VibeCodexGitRepositoryContext {
	readonly root: string;
	readonly branch?: string;
	readonly head?: string;
	readonly remotes: readonly string[];
	readonly changes: readonly string[];
	readonly recentCommits: readonly VibeCodexGitCommit[];
}

export interface VibeCodexGitCommit {
	readonly hash: string;
	readonly date?: string;
	readonly author?: string;
	readonly subject: string;
}

const maxMentionFiles = 20;
const maxWorkspaceFiles = 60;
const maxSearchCandidateFiles = 120;
const maxSearchHits = 12;
const maxContextFileBytes = 20000;
const maxDiagnostics = 80;
const maxGitCommits = 8;
const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const { execFile } = require('child_process') as { readonly execFile: ExecFileFunction };

export async function collectVibeCodexContext(prompt: string, mode: string): Promise<VibeCodexContextPack> {
	const mentions = parsePromptMentions(prompt);
	const workspaceRoots = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];
	const ignorePolicy = await collectWorkspaceIgnorePolicy();
	const activeEditor = activeEditorContext();
	const files = await collectContextFiles(mentions, activeEditor, ignorePolicy);
	const searchHits = await collectWorkspaceSearchHits(prompt, files, ignorePolicy);
	const symbolIndex = await collectSymbolIndex({ mentions, files, searchHits, ignorePolicy });
	const diagnostics = collectDiagnostics(files, mentions, activeEditor, ignorePolicy);
	const terminal = await activeTerminalContext();
	const git = await gitContext();
	return {
		version: 1,
		gatheredAt: Date.now(),
		mode,
		workspaceRoots,
		promptMentions: mentions,
		...(activeEditor ? { activeEditor } : {}),
		files,
		searchHits,
		...(symbolIndex ? { symbolIndex } : {}),
		diagnostics,
		...(ignorePolicy.rules.length ? { ignorePolicy } : {}),
		...(terminal ? { terminal } : {}),
		...(git ? { git } : {}),
	};
}

export function parsePromptMentions(prompt: string): readonly VibeCodexMention[] {
	const mentions = new Map<string, VibeCodexMention>();
	for (const match of prompt.matchAll(/@([^\s,;]+)/g)) {
		const raw = match[0];
		const value = match[1].replace(/[)\].!?]+$/, '');
		if (!value) {
			continue;
		}
		const mention: VibeCodexMention = {
			raw,
			value,
			kind: classifyMention(value),
		};
		mentions.set(`${mention.kind}:${mention.value}`, mention);
	}
	return [...mentions.values()];
}

export function summarizeContextPack(context: VibeCodexContextPack): string {
	const fileSummary = context.files.map(file => file.path).slice(0, 8).join(', ');
	const searchSummary = context.searchHits.map(hit => `${hit.path} (${Math.round(hit.score)})`).slice(0, 5).join(', ');
	const symbolSummary = symbolIndexSummary(context.symbolIndex);
	const ignoreSummary = workspaceIgnoreSummary(context.ignorePolicy);
	const diagnostics = context.diagnostics.reduce((counts, diagnostic) => {
		counts[diagnostic.severity] = (counts[diagnostic.severity] ?? 0) + 1;
		return counts;
	}, {} as Record<string, number>);
	const diagnosticSummary = Object.entries(diagnostics).map(([severity, count]) => `${count} ${severity}`).join(', ');
	return [
		context.activeEditor ? `Active: ${context.activeEditor.path}` : undefined,
		context.promptMentions.length ? `Mentions: ${context.promptMentions.map(mention => mention.raw).join(', ')}` : undefined,
		fileSummary ? `Files: ${fileSummary}` : undefined,
		searchSummary ? `Search: ${searchSummary}` : undefined,
		symbolSummary ? `Symbols: ${symbolSummary}` : undefined,
		diagnosticSummary ? `Diagnostics: ${diagnosticSummary}` : undefined,
		ignoreSummary ? `Ignore: ${ignoreSummary}` : undefined,
		context.git?.repositories.length ? `Git repos: ${context.git.repositories.length}${context.git.repositories.some(repository => repository.recentCommits.length) ? ' with recent history' : ''}` : undefined,
		context.terminal ? `Terminal: ${context.terminal.name}` : undefined,
	].filter((value): value is string => !!value).join('\n');
}

export function contextPackForPrompt(context: VibeCodexContextPack): string {
	const compact = {
		version: context.version,
		mode: context.mode,
		workspaceRoots: context.workspaceRoots,
		promptMentions: context.promptMentions,
		activeEditor: context.activeEditor,
		files: context.files.map(file => ({ path: file.path, kind: file.kind, languageId: file.languageId, text: file.text })),
		searchHits: context.searchHits,
		symbolIndex: context.symbolIndex,
		diagnostics: context.diagnostics,
		ignorePolicy: context.ignorePolicy,
		terminal: context.terminal,
		git: context.git,
	};
	return JSON.stringify(redactSensitiveValue(compact), null, 2);
}

async function collectContextFiles(mentions: readonly VibeCodexMention[], activeEditor: VibeCodexActiveEditorContext | undefined, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): Promise<readonly VibeCodexContextFile[]> {
	const files = new Map<string, VibeCodexContextFile>();
	if (activeEditor) {
		files.set(activeEditor.path, {
			path: activeEditor.path,
			kind: 'active',
			languageId: activeEditor.languageId,
			...(activeEditor.selectedText ? { text: activeEditor.selectedText } : {}),
		});
	}

	for (const mention of mentions.filter(mention => mention.kind === 'file' || mention.kind === 'folder' || mention.kind === 'unknown').slice(0, maxMentionFiles)) {
		for (const uri of await resolveMentionUris(mention)) {
			const path = workspaceRelativePath(uri);
			if (!path || files.has(path)) {
				continue;
			}
			files.set(path, {
				path,
				kind: 'mention',
				languageId: documentLanguageForUri(uri),
				text: await readWorkspaceText(uri),
			});
		}
	}

	if (mentions.some(mention => mention.kind === 'workspace')) {
		for (const uri of await vscode.workspace.findFiles('**/*', workspaceExclude, maxWorkspaceFiles)) {
			const path = workspaceRelativePath(uri);
			if (path && !files.has(path) && !isWorkspacePathIgnored(path, ignorePolicy)) {
				files.set(path, { path, kind: 'workspace', languageId: documentLanguageForUri(uri) });
			}
		}
	}

	return [...files.values()];
}

async function collectWorkspaceSearchHits(prompt: string, files: readonly VibeCodexContextFile[], ignorePolicy: VibeCodexWorkspaceIgnorePolicy): Promise<readonly VibeCodexSearchHit[]> {
	if (!queryTermsFromPrompt(prompt).length || !vscode.workspace.workspaceFolders?.length) {
		return [];
	}
	const candidates = new Map<string, VibeCodexLexicalCandidate>();
	for (const file of files) {
		candidates.set(file.path, {
			path: file.path,
			languageId: file.languageId,
			text: file.text,
		});
	}
	for (const uri of await vscode.workspace.findFiles('**/*', workspaceExclude, maxSearchCandidateFiles)) {
		const path = workspaceRelativePath(uri);
		if (!path || isWorkspacePathIgnored(path, ignorePolicy)) {
			continue;
		}
		const existing = candidates.get(path);
		if (existing?.text) {
			continue;
		}
		candidates.set(path, {
			path,
			languageId: documentLanguageForUri(uri),
			text: await readWorkspaceText(uri),
		});
	}
	return rankLexicalSearchCandidates(prompt, [...candidates.values()], maxSearchHits);
}

async function resolveMentionUris(mention: VibeCodexMention): Promise<readonly vscode.Uri[]> {
	const normalized = mention.value.replace(/^\/+/, '');
	const direct = await resolveDirectWorkspaceUri(normalized);
	if (direct) {
		const stat = await statUri(direct);
		if (stat?.type === vscode.FileType.Directory) {
			return vscode.workspace.findFiles(`${normalized}/**/*`, workspaceExclude, maxMentionFiles);
		}
		return [direct];
	}

	const basename = normalized.split('/').pop() ?? normalized;
	return vscode.workspace.findFiles(`**/${basename}`, workspaceExclude, maxMentionFiles);
}

async function resolveDirectWorkspaceUri(value: string): Promise<vscode.Uri | undefined> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return undefined;
	}
	const uri = vscode.Uri.joinPath(folder.uri, ...value.split('/').filter(Boolean));
	return await statUri(uri) ? uri : undefined;
}

async function statUri(uri: vscode.Uri): Promise<vscode.FileStat | undefined> {
	try {
		return await vscode.workspace.fs.stat(uri);
	} catch {
		return undefined;
	}
}

async function readWorkspaceText(uri: vscode.Uri): Promise<string | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		if (bytes.byteLength > maxContextFileBytes) {
			return undefined;
		}
		const text = new TextDecoder('utf-8').decode(bytes);
		if (text.includes('\u0000')) {
			return undefined;
		}
		return redactSensitiveText(text);
	} catch {
		return undefined;
	}
}

function activeEditorContext(): VibeCodexActiveEditorContext | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.uri.scheme !== 'file') {
		return undefined;
	}
	const path = workspaceRelativePath(editor.document.uri);
	if (!path) {
		return undefined;
	}
	const selection = editor.selection;
	const selectedText = selection.isEmpty ? undefined : redactSensitiveText(capText(editor.document.getText(selection), maxContextFileBytes));
	return {
		path,
		languageId: editor.document.languageId,
		...(selection.isEmpty ? {} : { selectionRange: rangeToString(selection) }),
		...(selectedText ? { selectedText } : {}),
	};
}

function collectDiagnostics(files: readonly VibeCodexContextFile[], mentions: readonly VibeCodexMention[], activeEditor: VibeCodexActiveEditorContext | undefined, ignorePolicy: VibeCodexWorkspaceIgnorePolicy): readonly VibeCodexDiagnostic[] {
	if (!mentions.some(mention => mention.kind === 'diagnostics') && !activeEditor && files.length === 0) {
		return [];
	}
	const targetPaths = new Set(files.map(file => file.path));
	if (activeEditor) {
		targetPaths.add(activeEditor.path);
	}
	const includeAll = mentions.some(mention => mention.kind === 'diagnostics');
	const diagnostics: VibeCodexDiagnostic[] = [];
	for (const [uri, uriDiagnostics] of vscode.languages.getDiagnostics()) {
		const path = workspaceRelativePath(uri);
		if (!path || (!targetPaths.has(path) && (!includeAll || isWorkspacePathIgnored(path, ignorePolicy)))) {
			continue;
		}
		for (const diagnostic of uriDiagnostics) {
			diagnostics.push({
				path,
				severity: severityLabel(diagnostic.severity),
				message: redactSensitiveText(capText(diagnostic.message, 500)),
				range: rangeToString(diagnostic.range),
				...(diagnostic.source ? { source: diagnostic.source } : {}),
			});
			if (diagnostics.length >= maxDiagnostics) {
				return diagnostics;
			}
		}
	}
	return diagnostics;
}

async function activeTerminalContext(): Promise<VibeCodexTerminalContext | undefined> {
	const terminal = vscode.window.activeTerminal;
	if (!terminal) {
		return undefined;
	}
	const processId = await terminal.processId;
	return {
		name: terminal.name,
		...(processId ? { processId } : {}),
	};
}

async function gitContext(): Promise<VibeCodexGitContext | undefined> {
	const extension = vscode.extensions.getExtension('vscode.git');
	const api = extension ? extension.isActive ? extension.exports?.getAPI?.(1) : (await extension.activate())?.getAPI?.(1) : undefined;
	const repositories = Array.isArray(api?.repositories) ? api.repositories : [];
	const contexts = repositories.length
		? (await Promise.all(repositories.map((repository: unknown) => gitRepositoryContext(repository)))).filter((repository): repository is VibeCodexGitRepositoryContext => !!repository)
		: await gitWorkspaceRepositoryContexts();
	if (!contexts.length) {
		return undefined;
	}
	return {
		repositories: contexts,
	};
}

async function gitRepositoryContext(repository: unknown): Promise<VibeCodexGitRepositoryContext | undefined> {
	if (!isRecord(repository) || !isRecord(repository.rootUri) || typeof repository.rootUri.fsPath !== 'string') {
		return undefined;
	}
	const state = isRecord(repository.state) ? repository.state : {};
	const head = isRecord(state.HEAD) ? state.HEAD : {};
	const root = repository.rootUri.fsPath;
	return {
		root,
		...(typeof head.name === 'string' ? { branch: head.name } : {}),
		...(typeof head.commit === 'string' ? { head: head.commit } : {}),
		remotes: arrayOfRecords(state.remotes).map(remote => typeof remote.name === 'string' ? remote.name : undefined).filter((value): value is string => !!value),
		changes: [
			...gitChangePaths(state.workingTreeChanges),
			...gitChangePaths(state.indexChanges),
			...gitChangePaths(state.mergeChanges),
		].slice(0, 80),
		recentCommits: await gitRecentCommits(root),
	};
}

async function gitWorkspaceRepositoryContexts(): Promise<readonly VibeCodexGitRepositoryContext[]> {
	if (!vscode.workspace.isTrusted) {
		return [];
	}
	const contexts: VibeCodexGitRepositoryContext[] = [];
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const root = folder.uri.fsPath;
		const head = await gitRead(root, ['rev-parse', '--short=12', 'HEAD']);
		if (!head) {
			continue;
		}
		const branch = await gitRead(root, ['branch', '--show-current']);
		const remotes = (await gitRead(root, ['remote']))?.split(/\r?\n/).map(line => line.trim()).filter(Boolean) ?? [];
		const changes = (await gitRead(root, ['status', '--porcelain=v1']))?.split(/\r?\n/).map(line => line.slice(3).trim()).filter(Boolean).slice(0, 80) ?? [];
		contexts.push({
			root,
			...(branch ? { branch } : {}),
			head,
			remotes,
			changes,
			recentCommits: await gitRecentCommits(root),
		});
	}
	return contexts;
}

async function gitRecentCommits(root: string): Promise<readonly VibeCodexGitCommit[]> {
	if (!vscode.workspace.isTrusted) {
		return [];
	}
	const output = await gitRead(root, ['log', `-${maxGitCommits}`, '--date=short', '--pretty=format:%h%x09%ad%x09%an%x09%s']);
	if (!output) {
		return [];
	}
	return output.split(/\r?\n/)
		.map(line => {
			const [hash, date, author, ...subjectParts] = line.split('\t');
			const subject = redactSensitiveText(subjectParts.join('\t').trim());
			if (!hash || !subject) {
				return undefined;
			}
			return {
				hash,
				...(date ? { date } : {}),
				...(author ? { author: redactSensitiveText(author) } : {}),
				subject,
			};
		})
		.filter((commit): commit is VibeCodexGitCommit => !!commit);
}

async function gitRead(root: string, args: readonly string[]): Promise<string | undefined> {
	return new Promise(resolve => {
		execFile('git', ['-C', root, ...args], { timeout: 2000, maxBuffer: 20000 }, (error, stdout) => {
			if (error) {
				resolve(undefined);
				return;
			}
			resolve(redactSensitiveText(stdout.trim()));
		});
	});
}

function gitChangePaths(value: unknown): readonly string[] {
	return arrayOfRecords(value)
		.map(change => isRecord(change.uri) && typeof change.uri.fsPath === 'string' ? workspaceRelativePath(vscode.Uri.file(change.uri.fsPath)) : undefined)
		.filter((path): path is string => !!path);
}

function classifyMention(value: string): VibeCodexMention['kind'] {
	const lower = value.toLowerCase();
	if (['git', 'diff', 'changes', 'commit', 'branch'].includes(lower)) {
		return 'git';
	}
	if (['diagnostics', 'problems', 'errors', 'warnings'].includes(lower)) {
		return 'diagnostics';
	}
	if (['terminal', 'shell', 'console'].includes(lower)) {
		return 'terminal';
	}
	if (['workspace', 'codebase', 'repo', 'repository'].includes(lower)) {
		return 'workspace';
	}
	if (['symbols', 'symbol'].includes(lower)) {
		return 'symbols';
	}
	if (['docs', 'documentation'].includes(lower)) {
		return 'docs';
	}
	if (['chat', 'history'].includes(lower)) {
		return 'chat';
	}
	if (/\.[A-Za-z0-9]+$/.test(value) || value.includes('/')) {
		return 'file';
	}
	return 'unknown';
}

function documentLanguageForUri(uri: vscode.Uri): string | undefined {
	for (const document of vscode.workspace.textDocuments) {
		if (document.uri.toString() === uri.toString()) {
			return document.languageId;
		}
	}
	return undefined;
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	const folders = vscode.workspace.workspaceFolders ?? [];
	for (const folder of folders) {
		const root = normalizePath(folder.uri.fsPath);
		const candidate = normalizePath(uri.fsPath);
		if (candidate === root) {
			return '.';
		}
		if (candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			return candidate.slice((root.endsWith('/') ? root : `${root}/`).length);
		}
	}
	return undefined;
}

function severityLabel(severity: vscode.DiagnosticSeverity): VibeCodexDiagnostic['severity'] {
	switch (severity) {
		case vscode.DiagnosticSeverity.Error: return 'error';
		case vscode.DiagnosticSeverity.Warning: return 'warning';
		case vscode.DiagnosticSeverity.Information: return 'information';
		default: return 'hint';
	}
}

function rangeToString(range: vscode.Range): string {
	return `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}`;
}

function capText(value: string, limit: number): string {
	return value.length > limit ? `${value.slice(0, limit)}\n[truncated]` : value;
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function arrayOfRecords(value: unknown): readonly Record<string, unknown>[] {
	return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
