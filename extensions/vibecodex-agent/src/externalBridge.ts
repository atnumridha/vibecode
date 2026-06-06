/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare const require: (module: string) => unknown;
declare const setTimeout: (callback: () => void, ms: number) => unknown;
declare const clearTimeout: (handle: unknown) => void;
declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

import { createAgentInitializeParams } from './bridgeHandshakeContract';

type SpawnFunction = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcessLike;
type CreateConnectionFunction = (path: string) => SocketLike;
type WebSocketConstructor = new (url: string) => WebSocketLike;

interface SpawnOptions {
	readonly cwd?: string;
	readonly env?: Record<string, string | undefined>;
	readonly stdio: 'pipe';
}

interface StreamLike {
	setEncoding(encoding: string): void;
	on(event: 'data', listener: (chunk: unknown) => void): void;
	write?(chunk: string, callback?: (error?: Error | null) => void): void;
	end?(): void;
	removeAllListeners(event?: string): void;
}

interface SocketLike extends StreamLike {
	on(event: 'data', listener: (chunk: unknown) => void): void;
	on(event: 'connect', listener: () => void): void;
	on(event: 'error', listener: (error: Error) => void): void;
	on(event: 'close', listener: (hadError?: boolean) => void): void;
	once(event: 'connect', listener: () => void): void;
	once(event: 'error', listener: (error: Error) => void): void;
	once(event: 'close', listener: (hadError?: boolean) => void): void;
	destroy(): void;
}

interface WebSocketLike {
	readonly readyState: number;
	send(data: string): void;
	close(code?: number, reason?: string): void;
	addEventListener(event: 'open', listener: () => void, options?: { readonly once?: boolean }): void;
	addEventListener(event: 'message', listener: (event: { readonly data?: unknown }) => void, options?: { readonly once?: boolean }): void;
	addEventListener(event: 'error', listener: (event: { readonly error?: unknown; readonly message?: string }) => void, options?: { readonly once?: boolean }): void;
	addEventListener(event: 'close', listener: (event: { readonly code?: number; readonly reason?: string; readonly wasClean?: boolean }) => void, options?: { readonly once?: boolean }): void;
}

interface ChildProcessLike {
	readonly stdin: StreamLike;
	readonly stdout: StreamLike;
	readonly stderr: StreamLike;
	on(event: 'spawn', listener: () => void): void;
	on(event: 'error', listener: (error: Error) => void): void;
	on(event: 'exit', listener: (code: number | null, signal: string | null) => void): void;
	once(event: 'spawn', listener: () => void): void;
	once(event: 'error', listener: (error: Error) => void): void;
	once(event: 'exit', listener: (code: number | null, signal: string | null) => void): void;
	removeAllListeners(event?: string): void;
	kill(signal?: string): boolean;
}

export type JsonRpcId = number | string;
export type JsonRpcFraming = 'ndjson' | 'content-length';

export interface JsonRpcMessage {
	readonly jsonrpc: '2.0';
	readonly id?: JsonRpcId;
	readonly method?: string;
	readonly params?: unknown;
	readonly result?: unknown;
	readonly error?: { readonly code?: number; readonly message?: string; readonly data?: unknown };
}

export interface JsonRpcFrameDrainResult {
	readonly messages: readonly string[];
	readonly remaining: string;
	readonly errors: readonly string[];
}

export interface ExternalBridgeStatus {
	readonly state: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
	readonly label: string;
	readonly detail?: string;
	readonly pendingRequests?: number;
	readonly handshake?: 'unknown' | 'ok' | 'unsupported' | 'failed';
	readonly transport?: 'stdio' | 'pipe' | 'websocket';
	readonly framing?: JsonRpcFraming;
	readonly health?: ExternalBridgeHealth;
}

export interface ExternalBridgeHealth {
	readonly state: 'starting' | 'ok' | 'idle' | 'busy' | 'stale' | 'disconnected';
	readonly connectedAt?: number;
	readonly lastMessageAt?: number;
	readonly lastSendAt?: number;
	readonly lastStatusAt: number;
	readonly pendingRequests: number;
	readonly oldestPendingMs?: number;
	readonly stalePendingMs: number;
}

export interface ExternalBridgeLaunchConfig {
	readonly transport?: 'stdio' | 'pipe' | 'websocket';
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd?: string;
	readonly pipePath?: string;
	readonly websocketUrl?: string;
	readonly framing?: JsonRpcFraming;
	readonly requestTimeoutMs?: number;
	readonly handshakeTimeoutMs?: number;
	readonly healthIntervalMs?: number;
	readonly stalePendingMs?: number;
}

const { spawn } = require('child_process') as { readonly spawn: SpawnFunction };
const { createConnection } = require('net') as { readonly createConnection: CreateConnectionFunction };
const startupTimeoutMs = 10000;
const defaultRequestTimeoutMs = 120000;
const defaultHandshakeTimeoutMs = 3500;
const defaultHealthIntervalMs = 15000;
const defaultStalePendingMs = 45000;

export class VibeCodexExternalBridge {
	private child: ChildProcessLike | undefined;
	private socket: SocketLike | undefined;
	private websocket: WebSocketLike | undefined;
	private nextId = 1;
	private stdoutBuffer = '';
	private stderrTail = '';
	private handshake: ExternalBridgeStatus['handshake'] = 'unknown';
	private connectedAt = 0;
	private lastMessageAt = 0;
	private lastSendAt = 0;
	private healthTimer: unknown;
	private readonly pending = new Map<JsonRpcId, { readonly method: string; readonly startedAt: number; readonly timeout: unknown; readonly resolve: (value: unknown) => void; readonly reject: (error: Error) => void }>();
	private readonly statusListeners = new Set<(status: ExternalBridgeStatus) => void>();
	private readonly notificationListeners = new Set<(message: JsonRpcMessage) => void>();

	constructor(private readonly config: ExternalBridgeLaunchConfig) { }

	onStatus(listener: (status: ExternalBridgeStatus) => void): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	onNotification(listener: (message: JsonRpcMessage) => void): () => void {
		this.notificationListeners.add(listener);
		return () => this.notificationListeners.delete(listener);
	}

	get connected(): boolean {
		return !!this.child || !!this.socket || !!this.websocket;
	}

	async connect(): Promise<void> {
		if (this.connected) {
			return;
		}
		this.handshake = 'unknown';
		if ((this.config.transport ?? 'stdio') === 'pipe') {
			await this.connectPipe();
			await this.handshakeBackend();
			return;
		}
		if ((this.config.transport ?? 'stdio') === 'websocket') {
			await this.connectWebSocket();
			await this.handshakeBackend();
			return;
		}
		await this.connectStdio();
		await this.handshakeBackend();
	}

	private async connectStdio(): Promise<void> {
		this.validateLaunch();
		this.fireStatus('connecting', `Starting ${this.safeLabel()}`);

		const child = spawn(this.config.command, this.config.args, {
			cwd: this.config.cwd,
			stdio: 'pipe',
		});
		this.child = child;
		this.stderrTail = '';

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', chunk => this.acceptStdout(String(chunk)));
		child.stderr.on('data', chunk => this.acceptStderr(String(chunk)));

		await new Promise<void>((resolve, reject) => {
			let settled = false;
			const timer = setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				this.child = undefined;
				child.kill('SIGTERM');
				const error = new Error(`Timed out waiting for ${this.safeLabel()} to spawn.`);
				this.fireStatus('error', 'Codex app-server startup timed out', error.message);
				reject(error);
			}, startupTimeoutMs);

			const clear = () => clearTimeout(timer);
			child.once('spawn', () => {
				if (settled) {
					return;
				}
				settled = true;
				clear();
				this.markConnected();
				this.fireStatus('connected', `Connected to ${this.safeLabel()}`);
				child.on('error', error => this.fail(error));
				child.on('exit', (code, signal) => this.exit(code, signal));
				resolve();
			});
			child.once('error', error => {
				if (settled) {
					this.fail(error);
					return;
				}
				settled = true;
				clear();
				this.child = undefined;
				this.fireStatus('error', 'Codex app-server process error', redactText(error.message));
				reject(error);
			});
			child.once('exit', (code, signal) => {
				if (settled) {
					return;
				}
				settled = true;
				clear();
				this.child = undefined;
				const detail = this.stderrTail || `code=${code ?? 'null'} signal=${signal ?? 'null'}`;
				this.fireStatus('error', 'Codex app-server exited before startup', redactText(detail));
				reject(new Error(detail));
			});
		});
	}

	private async connectWebSocket(): Promise<void> {
		this.validateWebSocket();
		this.fireStatus('connecting', `Connecting to ${this.safeLabel()}`);
		const WebSocketCtor = (globalThis as unknown as { readonly WebSocket?: WebSocketConstructor }).WebSocket;
		if (!WebSocketCtor) {
			throw new Error('WebSocket transport is not available in this VS Code extension host runtime.');
		}
		const websocket = new WebSocketCtor(this.config.websocketUrl!.trim());
		this.websocket = websocket;
		this.stderrTail = '';

		await new Promise<void>((resolve, reject) => {
			let settled = false;
			const timer = setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				this.websocket = undefined;
				websocket.close(1000, 'startup timeout');
				const error = new Error(`Timed out connecting to ${this.safeLabel()}.`);
				this.fireStatus('error', 'Codex app-server WebSocket connection timed out', error.message);
				reject(error);
			}, startupTimeoutMs);
			const clear = () => clearTimeout(timer);
			websocket.addEventListener('open', () => {
				if (settled) {
					return;
				}
				settled = true;
				clear();
				this.markConnected();
				this.fireStatus('connected', `Connected to ${this.safeLabel()}`);
				websocket.addEventListener('message', event => this.acceptWebSocketData(event.data));
				websocket.addEventListener('error', event => this.fail(new Error(webSocketErrorMessage(event))));
				websocket.addEventListener('close', event => this.closeWebSocket(event));
				resolve();
			}, { once: true });
			websocket.addEventListener('error', event => {
				if (settled) {
					this.fail(new Error(webSocketErrorMessage(event)));
					return;
				}
				settled = true;
				clear();
				this.websocket = undefined;
				const message = webSocketErrorMessage(event);
				this.fireStatus('error', 'Codex app-server WebSocket error', redactText(message));
				reject(new Error(message));
			}, { once: true });
			websocket.addEventListener('close', event => {
				if (settled) {
					return;
				}
				settled = true;
				clear();
				this.websocket = undefined;
				const detail = webSocketCloseMessage(event, 'WebSocket closed before connection.');
				this.fireStatus('error', 'Codex app-server WebSocket closed before startup', redactText(detail));
				reject(new Error(detail));
			}, { once: true });
		});
	}

	private async connectPipe(): Promise<void> {
		this.validatePipe();
		this.fireStatus('connecting', `Connecting to ${this.safeLabel()}`);
		const socket = createConnection(this.config.pipePath!);
		this.socket = socket;
		this.stderrTail = '';
		socket.setEncoding('utf8');
		socket.on('data', chunk => this.acceptStdout(String(chunk)));

		await new Promise<void>((resolve, reject) => {
			let settled = false;
			const timer = setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				this.socket = undefined;
				socket.destroy();
				const error = new Error(`Timed out connecting to ${this.safeLabel()}.`);
				this.fireStatus('error', 'Codex app-server pipe connection timed out', error.message);
				reject(error);
			}, startupTimeoutMs);
			const clear = () => clearTimeout(timer);
			socket.once('connect', () => {
				if (settled) {
					return;
				}
				settled = true;
				clear();
				this.markConnected();
				this.fireStatus('connected', `Connected to ${this.safeLabel()}`);
				socket.on('error', error => this.fail(error));
				socket.on('close', hadError => this.closeSocket(hadError));
				resolve();
			});
			socket.once('error', error => {
				if (settled) {
					this.fail(error);
					return;
				}
				settled = true;
				clear();
				this.socket = undefined;
				this.fireStatus('error', 'Codex app-server pipe error', redactText(error.message));
				reject(error);
			});
			socket.once('close', hadError => {
				if (settled) {
					return;
				}
				settled = true;
				clear();
				this.socket = undefined;
				const detail = hadError ? 'Pipe closed after connection error.' : 'Pipe closed before connection.';
				this.fireStatus('error', 'Codex app-server pipe closed before startup', detail);
				reject(new Error(detail));
			});
		});
	}

	async request(method: string, params?: unknown, timeoutMs = this.config.requestTimeoutMs ?? defaultRequestTimeoutMs): Promise<unknown> {
		const id = this.nextId++;
		const message = { jsonrpc: '2.0', id, method, params } as const;
		return new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				const error = new Error(`Codex app-server request timed out: ${method}`);
				this.fireStatus('error', 'Codex app-server request timed out', redactText(error.message));
				reject(error);
			}, Math.max(1, timeoutMs));
			this.pending.set(id, {
				method,
				startedAt: Date.now(),
				timeout,
				resolve,
				reject,
			});
			this.fireStatus('connected', `Connected to ${this.safeLabel()}`, `Request pending: ${method}`);
			void this.send(message).catch(error => {
				const pending = this.pending.get(id);
				if (pending) {
					clearTimeout(pending.timeout);
					this.pending.delete(id);
				}
				reject(error instanceof Error ? error : new Error(String(error)));
			});
		});
	}

	async notify(method: string, params?: unknown): Promise<void> {
		await this.send({ jsonrpc: '2.0', method, params });
	}

	async respond(id: JsonRpcId, result?: unknown): Promise<void> {
		await this.send({ jsonrpc: '2.0', id, result });
	}

	async respondError(id: JsonRpcId, code: number, message: string, data?: unknown): Promise<void> {
		await this.send({ jsonrpc: '2.0', id, error: { code, message, data } });
	}

	private async handshakeBackend(): Promise<void> {
		try {
			await this.request('agent/initialize', createAgentInitializeParams(), this.config.handshakeTimeoutMs ?? defaultHandshakeTimeoutMs);
			this.handshake = 'ok';
			this.fireStatus('connected', `Connected to ${this.safeLabel()}`, 'agent/initialize handshake completed.');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.handshake = /unsupported|not found|unknown method|-32601/i.test(message) ? 'unsupported' : 'failed';
			this.fireStatus('connected', `Connected to ${this.safeLabel()}`, `agent/initialize handshake ${this.handshake}: ${redactText(message)}`);
		}
	}

	disconnect(): void {
		const child = this.child;
		const socket = this.socket;
		const websocket = this.websocket;
		this.child = undefined;
		this.socket = undefined;
		this.websocket = undefined;
		this.stdoutBuffer = '';
		this.stopHealthMonitor();
		this.rejectAllPending(new Error('Codex app-server disconnected.'));
		if (child) {
			child.stdin.end?.();
			child.kill('SIGTERM');
			child.removeAllListeners();
			child.stdout.removeAllListeners();
			child.stderr.removeAllListeners();
		}
		if (socket) {
			socket.end?.();
			socket.destroy();
			socket.removeAllListeners();
		}
		if (websocket) {
			websocket.close(1000, 'extension disconnect');
		}
		this.fireStatus('disconnected', 'Codex app-server disconnected');
	}

	private async send(message: JsonRpcMessage): Promise<void> {
		this.lastSendAt = Date.now();
		const frame = encodeJsonRpcMessage(message, this.config.framing ?? 'ndjson');
		if (this.websocket) {
			this.websocket.send(frame);
			return;
		}
		const writer = this.child?.stdin ?? this.socket;
		if (!writer?.write) {
			throw new Error('Codex app-server is not connected.');
		}
		await new Promise<void>((resolve, reject) => {
			writer.write?.(frame, error => error ? reject(error) : resolve());
		});
	}

	private acceptWebSocketData(data: unknown): void {
		const text = jsonRpcTransportDataToText(data);
		if (!text.trim()) {
			return;
		}
		if (text.includes('\n')) {
			this.acceptStdout(text);
			return;
		}
		this.acceptLine(text.trim());
	}

	private acceptStdout(chunk: string): void {
		const drained = drainJsonRpcFrames(`${this.stdoutBuffer}${chunk}`);
		this.stdoutBuffer = drained.remaining;
		for (const error of drained.errors) {
			this.fireStatus('error', 'Codex app-server emitted invalid JSON-RPC frame', redactText(error));
		}
		for (const message of drained.messages) {
			this.acceptLine(message);
		}
	}

	private acceptLine(line: string): void {
		this.lastMessageAt = Date.now();
		let message: JsonRpcMessage;
		try {
			message = JSON.parse(line) as JsonRpcMessage;
		} catch (error) {
			this.fireStatus('error', 'Codex app-server emitted invalid JSON-RPC', error instanceof Error ? error.message : String(error));
			return;
		}

		if (message.id !== undefined && !message.method) {
			const pending = this.pending.get(message.id);
			if (!pending) {
				return;
			}
			clearTimeout(pending.timeout);
			this.pending.delete(message.id);
			this.fireStatus('connected', `Connected to ${this.safeLabel()}`, `Response received: ${pending.method}`);
			if (message.error) {
				pending.reject(new Error(message.error.message ?? 'Codex app-server request failed.'));
			} else {
				pending.resolve(message.result);
			}
			return;
		}

		for (const listener of this.notificationListeners) {
			listener(message);
		}
	}

	private acceptStderr(chunk: string): void {
		this.stderrTail = `${this.stderrTail}${chunk}`.slice(-4000);
		this.fireStatus('connected', `Connected to ${this.safeLabel()}`, redactText(this.stderrTail.trim()));
	}

	private fail(error: Error): void {
		this.child = undefined;
		this.socket = undefined;
		this.websocket = undefined;
		this.stopHealthMonitor();
		this.rejectAllPending(error);
		this.fireStatus('error', 'Codex app-server connection error', redactText(error.message));
	}

	private exit(code: number | null, signal: string | null): void {
		if (!this.child) {
			return;
		}
		this.child = undefined;
		this.stopHealthMonitor();
		this.rejectAllPending(new Error('Codex app-server exited.'));
		const detail = this.stderrTail || `code=${code ?? 'null'} signal=${signal ?? 'null'}`;
		this.fireStatus(code === 0 ? 'disconnected' : 'error', 'Codex app-server exited', redactText(detail));
	}

	private closeSocket(hadError?: boolean): void {
		if (!this.socket) {
			return;
		}
		this.socket = undefined;
		this.stopHealthMonitor();
		this.rejectAllPending(new Error('Codex app-server pipe closed.'));
		this.fireStatus(hadError ? 'error' : 'disconnected', hadError ? 'Codex app-server pipe closed with an error' : 'Codex app-server pipe disconnected');
	}

	private closeWebSocket(event: { readonly code?: number; readonly reason?: string; readonly wasClean?: boolean }): void {
		if (!this.websocket) {
			return;
		}
		this.websocket = undefined;
		this.stopHealthMonitor();
		this.rejectAllPending(new Error('Codex app-server WebSocket closed.'));
		const detail = webSocketCloseMessage(event, 'WebSocket disconnected.');
		this.fireStatus(event.wasClean === false ? 'error' : 'disconnected', event.wasClean === false ? 'Codex app-server WebSocket closed with an error' : 'Codex app-server WebSocket disconnected', redactText(detail));
	}

	private rejectAllPending(error: Error): void {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout);
			pending.reject(error);
		}
		this.pending.clear();
	}

	private validateLaunch(): void {
		if (!this.config.command.trim()) {
			throw new Error('Codex command is required.');
		}
		if (/[;&|`$<>]/.test(this.config.command)) {
			throw new Error('Codex command must be an executable path, not a shell expression.');
		}
		if (!this.config.args.length || this.config.args.some(arg => !arg.trim())) {
			throw new Error('Codex app-server args must not be empty.');
		}
		if (this.config.args.some(arg => /[\r\n\u0000]/.test(arg))) {
			throw new Error('Codex app-server args must not contain control characters.');
		}
	}

	private validatePipe(): void {
		const pipePath = this.config.pipePath?.trim();
		if (!pipePath) {
			throw new Error('Codex app-server pipe path is required for pipe transport.');
		}
		if (/[\r\n\u0000]/.test(pipePath)) {
			throw new Error('Codex app-server pipe path must not contain control characters.');
		}
	}

	private validateWebSocket(): void {
		const url = this.config.websocketUrl?.trim();
		if (!url) {
			throw new Error('Codex app-server WebSocket URL is required for websocket transport.');
		}
		if (/[\r\n\u0000]/.test(url)) {
			throw new Error('Codex app-server WebSocket URL must not contain control characters.');
		}
		if (!/^wss?:\/\/[^/]+(?:\/|$)/i.test(url)) {
			throw new Error('Codex app-server WebSocket URL must start with ws:// or wss://.');
		}
	}

	private safeLabel(): string {
		if ((this.config.transport ?? 'stdio') === 'pipe') {
			return redactText(`pipe ${this.config.pipePath ?? ''}`);
		}
		if ((this.config.transport ?? 'stdio') === 'websocket') {
			return redactText(`websocket ${this.config.websocketUrl ?? ''}`);
		}
		return redactText([this.config.command, ...this.config.args].join(' '));
	}

	private markConnected(): void {
		const now = Date.now();
		this.connectedAt = now;
		this.lastMessageAt = 0;
		this.lastSendAt = 0;
		this.startHealthMonitor();
	}

	private startHealthMonitor(): void {
		this.stopHealthMonitor();
		this.scheduleHealthMonitor();
	}

	private scheduleHealthMonitor(): void {
		this.healthTimer = setTimeout(() => {
			this.healthTimer = undefined;
			if (!this.connected) {
				return;
			}
			this.fireStatus('connected', `Connected to ${this.safeLabel()}`, bridgeHealthDetail(this.healthSnapshot()));
			this.scheduleHealthMonitor();
		}, Math.max(1000, this.config.healthIntervalMs ?? defaultHealthIntervalMs));
	}

	private stopHealthMonitor(): void {
		if (this.healthTimer !== undefined) {
			clearTimeout(this.healthTimer);
			this.healthTimer = undefined;
		}
	}

	private healthSnapshot(): ExternalBridgeHealth {
		const now = Date.now();
		const oldestPendingMs = oldestPendingRequestMs(this.pending, now);
		const stalePendingMs = Math.max(1000, this.config.stalePendingMs ?? defaultStalePendingMs);
		const connected = this.connected;
		const state: ExternalBridgeHealth['state'] = !connected
			? 'disconnected'
			: this.connectedAt === 0
				? 'starting'
				: oldestPendingMs !== undefined && oldestPendingMs >= stalePendingMs
					? 'stale'
					: this.pending.size > 0
						? 'busy'
						: this.lastMessageAt || this.lastSendAt
							? 'ok'
							: 'idle';
		return {
			state,
			...(this.connectedAt ? { connectedAt: this.connectedAt } : {}),
			...(this.lastMessageAt ? { lastMessageAt: this.lastMessageAt } : {}),
			...(this.lastSendAt ? { lastSendAt: this.lastSendAt } : {}),
			lastStatusAt: now,
			pendingRequests: this.pending.size,
			...(oldestPendingMs !== undefined ? { oldestPendingMs } : {}),
			stalePendingMs,
		};
	}

	private fireStatus(state: ExternalBridgeStatus['state'], label: string, detail?: string): void {
		const status = {
			state,
			label,
			...(detail ? { detail } : {}),
			pendingRequests: this.pending.size,
			handshake: this.handshake,
			transport: this.config.transport ?? 'stdio',
			framing: this.config.framing ?? 'ndjson',
			health: this.healthSnapshot(),
		} satisfies ExternalBridgeStatus;
		for (const listener of this.statusListeners) {
			listener(status);
		}
	}
}

function webSocketErrorMessage(event: { readonly error?: unknown; readonly message?: string }): string {
	if (event.error instanceof Error) {
		return event.error.message;
	}
	if (typeof event.message === 'string' && event.message.trim()) {
		return event.message;
	}
	return 'WebSocket connection error.';
}

function webSocketCloseMessage(event: { readonly code?: number; readonly reason?: string; readonly wasClean?: boolean }, fallback: string): string {
	const parts = [
		`code=${event.code ?? 'unknown'}`,
		event.reason ? `reason=${event.reason}` : undefined,
		typeof event.wasClean === 'boolean' ? `clean=${event.wasClean}` : undefined,
	].filter((part): part is string => !!part);
	return parts.length ? parts.join(' ') : fallback;
}

function oldestPendingRequestMs(pending: ReadonlyMap<JsonRpcId, { readonly startedAt: number }>, now: number): number | undefined {
	let oldest: number | undefined;
	for (const request of pending.values()) {
		const age = Math.max(0, now - request.startedAt);
		oldest = oldest === undefined ? age : Math.max(oldest, age);
	}
	return oldest;
}

function bridgeHealthDetail(health: ExternalBridgeHealth): string {
	const parts = [
		`health=${health.state}`,
		health.pendingRequests ? `pending=${health.pendingRequests}` : undefined,
		health.oldestPendingMs !== undefined ? `oldestPending=${Math.round(health.oldestPendingMs / 1000)}s` : undefined,
		health.lastMessageAt ? `lastMessage=${new Date(health.lastMessageAt).toISOString()}` : undefined,
		health.lastSendAt ? `lastSend=${new Date(health.lastSendAt).toISOString()}` : undefined,
	];
	return parts.filter((part): part is string => !!part).join(' ');
}

export function encodeJsonRpcMessage(message: JsonRpcMessage, framing: JsonRpcFraming = 'ndjson'): string {
	const payload = JSON.stringify(message);
	if (framing === 'content-length') {
		return `Content-Length: ${utf8ByteLength(payload)}\r\n\r\n${payload}`;
	}
	return `${payload}\n`;
}

export function jsonRpcTransportDataToText(data: unknown): string {
	if (typeof data === 'string') {
		return data;
	}
	if (data instanceof ArrayBuffer) {
		return decodeUtf8Bytes(new Uint8Array(data));
	}
	if (isArrayBufferView(data)) {
		return decodeUtf8Bytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
	}
	if (data && typeof (data as { readonly toString?: unknown }).toString === 'function') {
		const text = String(data);
		return text === '[object ArrayBuffer]' ? '' : text;
	}
	return '';
}

export function drainJsonRpcFrames(buffer: string): JsonRpcFrameDrainResult {
	let remaining = buffer;
	const messages: string[] = [];
	const errors: string[] = [];

	for (;;) {
		const leadingNewlines = /^[\r\n]+/.exec(remaining)?.[0].length ?? 0;
		if (leadingNewlines) {
			remaining = remaining.slice(leadingNewlines);
			continue;
		}

		if (/^Content-Length:/i.test(remaining)) {
			const header = contentLengthHeader(remaining);
			if (!header) {
				break;
			}
			const lengthMatch = /(?:^|\r?\n)Content-Length:\s*(\d+)/i.exec(remaining.slice(0, header.headerEnd));
			if (!lengthMatch) {
				errors.push('Content-Length frame did not include a valid Content-Length header.');
				remaining = remaining.slice(header.bodyStart);
				continue;
			}
			const byteLength = Number(lengthMatch[1]);
			if (!Number.isFinite(byteLength) || byteLength < 0) {
				errors.push(`Invalid Content-Length value: ${lengthMatch[1]}`);
				remaining = remaining.slice(header.bodyStart);
				continue;
			}
			const payload = takeUtf8Payload(remaining, header.bodyStart, byteLength);
			if (!payload) {
				break;
			}
			if (!payload.exact) {
				errors.push(`Content-Length frame ended inside a UTF-8 character boundary: ${byteLength}`);
				remaining = remaining.slice(payload.end);
				continue;
			}
			const message = payload.value.trim();
			if (message) {
				messages.push(message);
			}
			remaining = remaining.slice(payload.end);
			continue;
		}

		const newline = remaining.indexOf('\n');
		if (newline < 0) {
			break;
		}
		const line = remaining.slice(0, newline).trim();
		remaining = remaining.slice(newline + 1);
		if (line) {
			messages.push(line);
		}
	}

	return { messages, remaining, errors };
}

function decodeUtf8Bytes(bytes: Uint8Array): string {
	return new TextDecoder('utf-8').decode(bytes);
}

function isArrayBufferView(value: unknown): value is { readonly buffer: ArrayBuffer; readonly byteOffset: number; readonly byteLength: number } {
	return !!value
		&& typeof value === 'object'
		&& ArrayBuffer.isView(value)
		&& (value as { readonly buffer?: unknown }).buffer instanceof ArrayBuffer;
}

function contentLengthHeader(value: string): { readonly headerEnd: number; readonly bodyStart: number } | undefined {
	const crlf = value.indexOf('\r\n\r\n');
	const lf = value.indexOf('\n\n');
	if (crlf >= 0 && (lf < 0 || crlf <= lf)) {
		return { headerEnd: crlf, bodyStart: crlf + 4 };
	}
	if (lf >= 0) {
		return { headerEnd: lf, bodyStart: lf + 2 };
	}
	return undefined;
}

function takeUtf8Payload(value: string, start: number, byteLength: number): { readonly value: string; readonly end: number; readonly exact: boolean } | undefined {
	let bytes = 0;
	let index = start;
	while (index < value.length && bytes < byteLength) {
		const codePoint = value.codePointAt(index)!;
		bytes += utf8CodePointByteLength(codePoint);
		index += codePoint > 0xffff ? 2 : 1;
	}
	if (bytes < byteLength) {
		return undefined;
	}
	return {
		value: value.slice(start, index),
		end: index,
		exact: bytes === byteLength,
	};
}

function utf8ByteLength(value: string): number {
	let bytes = 0;
	for (let index = 0; index < value.length; index++) {
		const codePoint = value.codePointAt(index)!;
		bytes += utf8CodePointByteLength(codePoint);
		if (codePoint > 0xffff) {
			index++;
		}
	}
	return bytes;
}

function utf8CodePointByteLength(codePoint: number): number {
	if (codePoint <= 0x7f) {
		return 1;
	}
	if (codePoint <= 0x7ff) {
		return 2;
	}
	if (codePoint <= 0xffff) {
		return 3;
	}
	return 4;
}

function redactText(value: string): string {
	return value
		.replace(/(sk-[A-Za-z0-9_-]+)/g, '[redacted]')
		.replace(/vibecodex-plan:[^\s"',}]+/g, '[redacted:approval-token]')
		.replace(/((?:api[-_]?key|access[-_]?token|refresh[-_]?token|approval[-_]?token|authorization)=)[^\s]+/gi, '$1[redacted]')
		.replace(/(--(?:api-key|access-token|refresh-token|approval-token)\s+)[^\s]+/gi, '$1[redacted]');
}
