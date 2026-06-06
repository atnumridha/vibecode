/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

declare const require: (module: string) => unknown;

type ExecFileFunction = (file: string, args: readonly string[], options: { readonly cwd?: string; readonly timeout?: number; readonly maxBuffer?: number }, callback: (error: ExecFileError | null, stdout: string, stderr: string) => void) => void;

interface ExecFileError extends Error {
	readonly code?: number;
}

export interface VibeCodexGitCheckpoint {
	readonly id: string;
	readonly root?: string;
	readonly branchName?: string;
	readonly head?: string;
	readonly created: boolean;
	readonly skippedReason?: string;
}

const { execFile } = require('child_process') as { readonly execFile: ExecFileFunction };

export async function createWorkspaceGitCheckpoint(seed: string | undefined): Promise<VibeCodexGitCheckpoint> {
	const id = checkpointId(seed);
	if (!vscode.workspace.isTrusted) {
		return { id, created: false, skippedReason: 'Workspace is not trusted; git checkpoint branch was skipped.' };
	}
	const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!root) {
		return { id, created: false, skippedReason: 'No workspace root is open.' };
	}
	const gitRoot = await gitRead(root, ['rev-parse', '--show-toplevel']);
	if (!gitRoot) {
		return { id, root, created: false, skippedReason: 'Workspace is not inside a git repository.' };
	}
	const head = await gitRead(gitRoot, ['rev-parse', '--verify', 'HEAD']);
	if (!head) {
		return { id, root: gitRoot, created: false, skippedReason: 'Git repository has no HEAD checkpoint target.' };
	}
	const branchName = `vibecodex/checkpoint/${id}`;
	if (!isSafeCheckpointBranch(branchName)) {
		return { id, root: gitRoot, head, created: false, skippedReason: 'Generated checkpoint branch name was unsafe.' };
	}
	if (await gitBranchExists(gitRoot, branchName)) {
		return { id, root: gitRoot, branchName, head, created: false };
	}
	const created = await gitWrite(gitRoot, ['branch', branchName, head]);
	return created
		? { id, root: gitRoot, branchName, head, created: true }
		: { id, root: gitRoot, head, created: false, skippedReason: 'Git checkpoint branch creation failed.' };
}

export function gitCheckpointSummary(checkpoint: VibeCodexGitCheckpoint | undefined): string | undefined {
	if (!checkpoint) {
		return undefined;
	}
	if (checkpoint.branchName) {
		return `Git checkpoint: ${checkpoint.branchName}${checkpoint.created ? '' : ' (existing)'}`;
	}
	return checkpoint.skippedReason ? `Git checkpoint skipped: ${checkpoint.skippedReason}` : undefined;
}

function checkpointId(seed: string | undefined): string {
	const base = (seed || 'task').toLowerCase()
		.replace(/[^a-z0-9._/-]+/g, '-')
		.replace(/\.\.+/g, '.')
		.replace(/^[-/.]+|[-/.]+$/g, '')
		.slice(0, 56) || 'task';
	return `${base}-${Date.now().toString(36)}`;
}

async function gitBranchExists(root: string, branchName: string): Promise<boolean> {
	const result = await git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`], true);
	return result.code === 0;
}

async function gitRead(root: string, args: readonly string[]): Promise<string | undefined> {
	const result = await git(root, args, true);
	return result.code === 0 ? result.stdout.trim() : undefined;
}

async function gitWrite(root: string, args: readonly string[]): Promise<boolean> {
	const result = await git(root, args, true);
	return result.code === 0;
}

async function git(root: string, args: readonly string[], allowFailure = false): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
	return new Promise((resolve, reject) => {
		execFile('git', ['-C', root, ...args], { timeout: 10000, maxBuffer: 100000 }, (error, stdout, stderr) => {
			const code = error?.code ?? 0;
			if (error && !allowFailure) {
				reject(new Error((stderr || error.message).trim()));
				return;
			}
			resolve({ code, stdout, stderr });
		});
	});
}

function isSafeCheckpointBranch(value: string): boolean {
	return value.startsWith('vibecodex/checkpoint/')
		&& !value.includes('..')
		&& !/[\s~^:?*[\\\u0000-\u001f]/.test(value)
		&& !value.endsWith('/')
		&& !value.endsWith('.');
}
