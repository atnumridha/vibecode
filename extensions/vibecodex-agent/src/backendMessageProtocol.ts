/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcMessage } from './externalBridge';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import { VibeCodexTranscriptKind, VibeCodexTranscriptStatus } from './transcript';

export interface VibeCodexBackendTranscriptMessage {
	readonly method: string;
	readonly streamId: string;
	readonly transcriptId: string;
	readonly kind: VibeCodexTranscriptKind;
	readonly status: VibeCodexTranscriptStatus;
	readonly title: string;
	readonly detail?: string;
	readonly append: boolean;
	readonly requestedAt: number;
}

const backendMessageMethods = new Set([
	'agent/message',
	'agent/messageDelta',
	'agent/messageChunk',
	'agent/assistantMessage',
	'agent/assistantDelta',
	'agent/status',
	'agent/log',
	'agent/thought',
	'conversation/message',
	'conversation/messageDelta',
	'item/message',
	'item/messageDelta',
	'item/assistant_message',
	'cline/say',
	'cline/message',
]);

export function normalizeBackendTranscriptMessage(message: JsonRpcMessage): VibeCodexBackendTranscriptMessage | undefined {
	if (!message.method || !isBackendMessageMethod(message.method, message.params)) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const rawText = textValue(payload.delta)
		?? textValue(args.delta)
		?? textValue(payload.chunk)
		?? textValue(args.chunk)
		?? textValue(payload.response)
		?? textValue(args.response)
		?? textValue(payload.text)
		?? textValue(args.text)
		?? textValue(payload.content)
		?? textValue(args.content)
		?? textValue(payload.message)
		?? textValue(args.message);
	const detail = rawText ? redactSensitiveText(rawText).slice(0, 12000) : undefined;
	const title = redactSensitiveText(stringValue(payload.title)
		?? stringValue(args.title)
		?? defaultTitle(message.method, payload, args)).slice(0, 240);
	const streamId = stringValue(payload.streamId)
		?? stringValue(args.streamId)
		?? stringValue(payload.messageId)
		?? stringValue(args.messageId)
		?? stringValue(payload.itemId)
		?? stringValue(args.itemId)
		?? stringValue(payload.turnId)
		?? stringValue(args.turnId)
		?? `${message.method}:${title}`;
	return {
		method: message.method,
		streamId,
		transcriptId: backendTranscriptId(streamId),
		kind: transcriptKind(message.method, payload, args),
		status: transcriptStatus(message.method, payload, args),
		title,
		...(detail ? { detail } : {}),
		append: shouldAppend(message.method, payload, args),
		requestedAt: Date.now(),
	};
}

export function createBackendTranscriptAck(message: VibeCodexBackendTranscriptMessage): unknown {
	return redactSensitiveValue({
		ok: true,
		source: 'externalExtension',
		received: true,
		streamId: message.streamId,
		status: message.status,
	});
}

export function backendTranscriptMessageSummary(message: VibeCodexBackendTranscriptMessage): string {
	return `${message.kind} ${message.status}: ${message.title}${message.append ? ' (stream)' : ''}`;
}

function isBackendMessageMethod(method: string, params: unknown): boolean {
	if (backendMessageMethods.has(method)) {
		return true;
	}
	if (method !== 'item/tool/call') {
		return false;
	}
	const payload = isRecord(params) ? params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const tool = toolName(payload, args);
	return tool === 'say' || tool === 'assistant_message' || tool === 'status_update' || tool === 'stream_message' || tool === 'act_mode_respond' || tool === 'act_mode_response';
}

function defaultTitle(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): string {
	const role = (stringValue(payload.role) ?? stringValue(args.role) ?? '').toLowerCase();
	const type = (stringValue(payload.type) ?? stringValue(args.type) ?? '').toLowerCase();
	const tool = toolName(payload, args);
	if (tool === 'act_mode_respond' || tool === 'act_mode_response') {
		return 'Act Mode response';
	}
	if (method.toLowerCase().includes('status') || type === 'status') {
		return 'Backend status';
	}
	if (method.toLowerCase().includes('thought') || type === 'thought') {
		return 'Backend reasoning update';
	}
	if (role === 'user') {
		return 'User message';
	}
	if (role === 'system') {
		return 'System message';
	}
	return 'Assistant message';
}

function transcriptKind(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): VibeCodexTranscriptKind {
	const role = (stringValue(payload.role) ?? stringValue(args.role) ?? '').toLowerCase();
	const type = (stringValue(payload.type) ?? stringValue(args.type) ?? '').toLowerCase();
	if (role === 'user') {
		return 'user';
	}
	if (role === 'system' || method.toLowerCase().includes('status') || method.toLowerCase().includes('log') || type === 'status') {
		return 'system';
	}
	if (type === 'tool') {
		return 'tool';
	}
	return 'assistant';
}

function transcriptStatus(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): VibeCodexTranscriptStatus {
	const status = (stringValue(payload.status) ?? stringValue(args.status) ?? '').toLowerCase();
	const level = (stringValue(payload.level) ?? stringValue(args.level) ?? '').toLowerCase();
	const done = booleanValue(payload.done) ?? booleanValue(args.done) ?? booleanValue(payload.final) ?? booleanValue(args.final) ?? false;
	if (status === 'failed' || status === 'error' || level === 'error') {
		return 'failed';
	}
	if (status === 'blocked') {
		return 'blocked';
	}
	if (done || status === 'completed' || status === 'complete' || status === 'done') {
		return 'completed';
	}
	if (shouldAppend(method, payload, args) || status === 'running' || status === 'streaming') {
		return 'running';
	}
	return 'completed';
}

function shouldAppend(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	return method.toLowerCase().includes('delta')
		|| method.toLowerCase().includes('chunk')
		|| booleanValue(payload.append) === true
		|| booleanValue(args.append) === true
		|| payload.delta !== undefined
		|| args.delta !== undefined;
}

function backendTranscriptId(streamId: string): string {
	return `backend-${streamId.trim().replace(/[^A-Za-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'message'}`;
}

function textValue(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim().length > 0) {
		return value;
	}
	if (Array.isArray(value)) {
		const parts = value.map(item => {
			if (typeof item === 'string') {
				return item;
			}
			if (isRecord(item)) {
				return stringValue(item.text) ?? stringValue(item.content) ?? stringValue(item.value) ?? '';
			}
			return '';
		}).filter(Boolean);
		return parts.length ? parts.join('') : undefined;
	}
	if (isRecord(value)) {
		return stringValue(value.text) ?? stringValue(value.content) ?? stringValue(value.value);
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		return /^(1|true|yes)$/i.test(value) ? true : /^(0|false|no)$/i.test(value) ? false : undefined;
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toolName(payload: Record<string, unknown>, args: Record<string, unknown>): string {
	return (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
}
