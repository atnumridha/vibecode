/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VibeCodexParallelPlan, withParallelThreadStatus } from './multiAgent';

declare const require: (module: string) => unknown;

type ExecFileFunction = (file: string, args: readonly string[], options: { readonly cwd?: string; readonly timeout?: number; readonly maxBuffer?: number }, callback: (error: ExecFileError | null, stdout: string, stderr: string) => void) => void;

interface ExecFileError extends Error {
	readonly code?: number;
}

export interface VibeCodexWorktreeOperationResult {
	readonly plan: VibeCodexParallelPlan;
	readonly evidence: readonly string[];
}

const { execFile } = require('child_process') as { readonly execFile: ExecFileFunction };

export async function materializeParallelWorktrees(plan: VibeCodexParallelPlan): Promise<VibeCodexWorktreeOperationResult> {
	if (!plan.enabled) {
		return { plan, evidence: ['Parallel worktrees not created because parallel agents are disabled.'] };
	}
	if (!vscode.workspace.isTrusted) {
		return markAll(plan, 'skipped', 'Workspace is not trusted; git worktree creation was skipped.');
	}
	const validation = validateParallelPlan(plan);
	if (validation) {
		return markAll(plan, 'failed', validation);
	}
	let next = plan;
	const evidence: string[] = [];
	await vscode.workspace.fs.createDirectory(vscode.Uri.file(plan.worktreeRoot!));
	for (const thread of plan.threads) {
		if (!thread.worktreePath) {
			next = withParallelThreadStatus(next, thread.id, 'failed', 'Missing worktree path.');
			evidence.push(`${thread.id}: missing worktree path.`);
			continue;
		}
		if (await worktreeExists(thread.worktreePath)) {
			next = withParallelThreadStatus(next, thread.id, 'materialized', 'Existing git worktree detected.');
			evidence.push(`${thread.id}: existing worktree at ${thread.worktreePath}.`);
			continue;
		}
		try {
			await ensureSafeWorktreeTarget(thread.worktreePath);
			const branchExists = await gitBranchExists(plan.baseWorkspaceRoot!, thread.branchName);
			const args = branchExists
				? ['-C', plan.baseWorkspaceRoot!, 'worktree', 'add', thread.worktreePath, thread.branchName]
				: ['-C', plan.baseWorkspaceRoot!, 'worktree', 'add', '-b', thread.branchName, thread.worktreePath, 'HEAD'];
			await git(args);
			next = withParallelThreadStatus(next, thread.id, 'materialized', `Ready at ${thread.worktreePath}.`);
			evidence.push(`${thread.id}: materialized ${thread.branchName} at ${thread.worktreePath}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			next = withParallelThreadStatus(next, thread.id, 'failed', message);
			evidence.push(`${thread.id}: failed to create worktree: ${message}`);
		}
	}
	return { plan: next, evidence };
}

export async function cleanupParallelWorktrees(plan: VibeCodexParallelPlan): Promise<VibeCodexWorktreeOperationResult> {
	if (!plan.enabled) {
		return { plan, evidence: ['Parallel worktree cleanup skipped because parallel agents are disabled.'] };
	}
	if (!vscode.workspace.isTrusted) {
		return markAll(plan, 'skipped', 'Workspace is not trusted; git worktree cleanup was skipped.');
	}
	const validation = validateParallelPlan(plan);
	if (validation) {
		return markAll(plan, 'failed', validation);
	}
	let next = plan;
	const evidence: string[] = [];
	for (const thread of plan.threads) {
		if (!thread.worktreePath || !await worktreeExists(thread.worktreePath)) {
			next = withParallelThreadStatus(next, thread.id, 'skipped', 'No git worktree exists at the planned path.');
			evidence.push(`${thread.id}: no worktree to clean.`);
			continue;
		}
		try {
			await git(['-C', plan.baseWorkspaceRoot!, 'worktree', 'remove', '--force', thread.worktreePath]);
			next = withParallelThreadStatus(next, thread.id, 'cleaned', `Removed ${thread.worktreePath}.`);
			evidence.push(`${thread.id}: removed ${thread.worktreePath}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			next = withParallelThreadStatus(next, thread.id, 'failed', message);
			evidence.push(`${thread.id}: failed to remove worktree: ${message}`);
		}
	}
	return { plan: next, evidence };
}

function validateParallelPlan(plan: VibeCodexParallelPlan): string | undefined {
	if (plan.isolation !== 'git-worktree') {
		return 'Only git-worktree isolation can be materialized by the extension.';
	}
	if (!plan.baseWorkspaceRoot || !plan.worktreeRoot) {
		return 'Parallel plan is missing base workspace or worktree root.';
	}
	const baseRoot = normalizePath(plan.baseWorkspaceRoot);
	const worktreeRoot = normalizePath(plan.worktreeRoot);
	if (!worktreeRoot.startsWith(`${baseRoot}/.vibecodex/worktrees/`)) {
		return 'Worktree root must be inside the workspace .vibecodex/worktrees directory.';
	}
	for (const thread of plan.threads) {
		if (!isSafeBranchName(thread.branchName)) {
			return `Unsafe branch name for ${thread.id}.`;
		}
		if (!thread.worktreePath || !normalizePath(thread.worktreePath).startsWith(`${worktreeRoot}/`)) {
			return `Unsafe worktree path for ${thread.id}.`;
		}
	}
	return undefined;
}

async function gitBranchExists(root: string, branchName: string): Promise<boolean> {
	const result = await git(['-C', root, 'show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], true);
	return result.code === 0;
}

async function git(args: readonly string[], allowFailure = false): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
	return new Promise((resolve, reject) => {
		execFile('git', args, { timeout: 15000, maxBuffer: 100000 }, (error, stdout, stderr) => {
			const code = error?.code ?? 0;
			if (error && !allowFailure) {
				reject(new Error((stderr || error.message).trim()));
				return;
			}
			resolve({ code, stdout, stderr });
		});
	});
}

async function worktreeExists(path: string): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(`${path}/.git`));
		return true;
	} catch {
		return false;
	}
}

async function ensureSafeWorktreeTarget(path: string): Promise<void> {
	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(path));
		throw new Error('Target path already exists but is not a git worktree.');
	} catch (error) {
		if (error instanceof Error && error.message.includes('not a git worktree')) {
			throw error;
		}
	}
}

function markAll(plan: VibeCodexParallelPlan, status: 'failed' | 'skipped', detail: string): VibeCodexWorktreeOperationResult {
	let next = plan;
	for (const thread of plan.threads) {
		next = withParallelThreadStatus(next, thread.id, status, detail);
	}
	return { plan: next, evidence: [detail] };
}

function isSafeBranchName(value: string): boolean {
	return value.startsWith('vibecodex/checkpoint/')
		&& !value.includes('..')
		&& !/[\s~^:?*[\\\u0000-\u001f]/.test(value)
		&& !value.endsWith('/')
		&& !value.endsWith('.');
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}
