/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

declare function require(name: string): unknown;
declare const process: { readonly env: Record<string, string | undefined> };

type ChildProcessModule = {
	readonly spawn: (command: string, options: { readonly cwd?: string; readonly shell: boolean; readonly env?: Record<string, string | undefined> }) => ChildProcessLike;
};

type ChildProcessLike = {
	readonly stdout?: { readonly on: (event: 'data', listener: (chunk: unknown) => void) => void };
	readonly stderr?: { readonly on: (event: 'data', listener: (chunk: unknown) => void) => void };
	readonly on: (event: 'close' | 'error', listener: (arg1: unknown, arg2?: unknown) => void) => void;
	readonly kill: (signal?: string) => boolean;
};

export type VibeCodexTerminalRunStatus = 'running' | 'passed' | 'failed' | 'interrupted';

export interface VibeCodexCapturedTerminalRun {
	readonly id: string;
	readonly commandLine: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly startedAt: number;
	readonly endedAt?: number;
	readonly status: VibeCodexTerminalRunStatus;
	readonly output: string;
	readonly exitCode?: number;
	readonly signal?: string;
}

interface InternalTerminalRun {
	snapshot: VibeCodexCapturedTerminalRun;
	readonly terminal: vscode.Terminal;
	readonly writeEmitter: vscode.EventEmitter<string>;
	readonly closeEmitter: vscode.EventEmitter<number>;
	child?: ChildProcessLike;
	interrupted?: boolean;
	finished?: boolean;
}

const maxTerminalOutput = 16000;

export class VibeCodexTerminalRunner implements vscode.Disposable {
	private readonly runs = new Map<string, InternalTerminalRun>();
	private readonly onDidUpdateEmitter = new vscode.EventEmitter<VibeCodexCapturedTerminalRun>();
	readonly onDidUpdate = this.onDidUpdateEmitter.event;

	run(commandLine: string, cwd?: string, reason?: string): VibeCodexCapturedTerminalRun {
		const id = `terminal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		const writeEmitter = new vscode.EventEmitter<string>();
		const closeEmitter = new vscode.EventEmitter<number>();
		const internal: InternalTerminalRun = {
			snapshot: {
				id,
				commandLine,
				...(cwd ? { cwd } : {}),
				...(reason ? { reason } : {}),
				startedAt: Date.now(),
				status: 'running',
				output: '',
			},
			terminal: undefined as unknown as vscode.Terminal,
			writeEmitter,
			closeEmitter,
		};
		const pty: vscode.Pseudoterminal = {
			onDidWrite: writeEmitter.event,
			onDidClose: closeEmitter.event,
			open: () => this.startProcess(internal),
			close: () => {
				if (internal.snapshot.status === 'running') {
					this.interrupt(id);
				}
			},
		};
		const terminal = vscode.window.createTerminal({ name: terminalName(reason), pty });
		(internal as { terminal: vscode.Terminal }).terminal = terminal;
		this.runs.set(id, internal);
		terminal.show();
		this.emit(internal);
		return internal.snapshot;
	}

	interrupt(runId: string): VibeCodexCapturedTerminalRun | undefined {
		const internal = this.runs.get(runId);
		if (!internal) {
			return undefined;
		}
		internal.interrupted = true;
		internal.child?.kill('SIGINT');
		this.append(internal, '\n^C\n');
		return internal.snapshot;
	}

	snapshot(runId: string): VibeCodexCapturedTerminalRun | undefined {
		return this.runs.get(runId)?.snapshot;
	}

	dispose(): void {
		for (const internal of this.runs.values()) {
			if (internal.snapshot.status === 'running') {
				internal.child?.kill('SIGINT');
			}
			internal.writeEmitter.dispose();
			internal.closeEmitter.dispose();
			internal.terminal.dispose();
		}
		this.runs.clear();
		this.onDidUpdateEmitter.dispose();
	}

	private startProcess(internal: InternalTerminalRun): void {
		if (internal.child || internal.finished) {
			return;
		}
		this.append(internal, `$ ${internal.snapshot.commandLine}\n`);
		const childProcess = require('child_process') as ChildProcessModule;
		const child = childProcess.spawn(internal.snapshot.commandLine, {
			...(internal.snapshot.cwd ? { cwd: internal.snapshot.cwd } : {}),
			shell: true,
			env: { ...process.env },
		});
		internal.child = child;
		child.stdout?.on('data', chunk => this.append(internal, String(chunk)));
		child.stderr?.on('data', chunk => this.append(internal, String(chunk)));
		child.on('error', error => {
			const message = error instanceof Error ? error.message : String(error);
			this.append(internal, `\n${message}\n`);
			this.finish(internal, 'failed', undefined, undefined);
		});
		child.on('close', (code, signal) => {
			const exitCode = typeof code === 'number' ? code : undefined;
			const exitSignal = typeof signal === 'string' ? signal : undefined;
			this.finish(internal, internal.interrupted ? 'interrupted' : exitCode === 0 ? 'passed' : 'failed', exitCode, exitSignal);
		});
	}

	private append(internal: InternalTerminalRun, chunk: string): void {
		const output = trimOutput(`${internal.snapshot.output}${chunk}`);
		internal.snapshot = { ...internal.snapshot, output };
		internal.writeEmitter.fire(toTerminalText(chunk));
		this.emit(internal);
	}

	private finish(internal: InternalTerminalRun, status: VibeCodexTerminalRunStatus, exitCode: number | undefined, signal: string | undefined): void {
		if (internal.finished) {
			return;
		}
		internal.finished = true;
		internal.snapshot = {
			...internal.snapshot,
			status,
			endedAt: Date.now(),
			...(exitCode !== undefined ? { exitCode } : {}),
			...(signal ? { signal } : {}),
		};
		internal.writeEmitter.fire(`\r\n[${status}${exitCode !== undefined ? ` exit ${exitCode}` : signal ? ` ${signal}` : ''}]\r\n`);
		internal.closeEmitter.fire(exitCode ?? (status === 'passed' ? 0 : 1));
		this.emit(internal);
	}

	private emit(internal: InternalTerminalRun): void {
		this.onDidUpdateEmitter.fire(internal.snapshot);
	}
}

function terminalName(reason: string | undefined): string {
	return reason ? `Vibe Codex: ${reason.slice(0, 36)}` : 'Vibe Codex Terminal';
}

function trimOutput(value: string): string {
	return value.length > maxTerminalOutput ? value.slice(value.length - maxTerminalOutput) : value;
}

function toTerminalText(value: string): string {
	return value.replace(/\r?\n/g, '\r\n');
}
