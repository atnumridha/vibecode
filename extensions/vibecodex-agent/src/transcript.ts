/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveText } from './secretFilters';

export type VibeCodexTranscriptKind =
	| 'user'
	| 'assistant'
	| 'plan'
	| 'approval'
	| 'tool'
	| 'terminal'
	| 'diff'
	| 'verification'
	| 'rollback'
	| 'system';

export type VibeCodexTranscriptStatus = 'pending' | 'running' | 'completed' | 'blocked' | 'failed';

export interface VibeCodexTranscriptEvent {
	readonly id: string;
	readonly timestamp: number;
	readonly kind: VibeCodexTranscriptKind;
	readonly status: VibeCodexTranscriptStatus;
	readonly title: string;
	readonly detail?: string;
}

export interface VibeCodexTranscriptSeed {
	readonly kind: VibeCodexTranscriptKind;
	readonly title: string;
	readonly detail?: string;
	readonly status?: VibeCodexTranscriptStatus;
}

const maxTranscriptEvents = 160;

export function createTranscriptEvent(seed: VibeCodexTranscriptSeed, timestamp = Date.now()): VibeCodexTranscriptEvent {
	const title = redactSensitiveText(seed.title.trim()).slice(0, 240) || 'Untitled event';
	const detail = seed.detail ? redactSensitiveText(seed.detail.trim()).slice(0, 8000) : undefined;
	return {
		id: `event-${timestamp.toString(36)}-${hashText(`${seed.kind}:${title}:${detail ?? ''}`).slice(0, 8)}`,
		timestamp,
		kind: seed.kind,
		status: seed.status ?? 'completed',
		title,
		...(detail ? { detail } : {}),
	};
}

export function appendTranscriptEvent(events: readonly VibeCodexTranscriptEvent[], seed: VibeCodexTranscriptSeed): readonly VibeCodexTranscriptEvent[] {
	const next = [createTranscriptEvent(seed), ...sanitizeTranscriptEvents(events)];
	return next.slice(0, maxTranscriptEvents);
}

export function upsertTranscriptEvent(events: readonly VibeCodexTranscriptEvent[], id: string, seed: VibeCodexTranscriptSeed, appendDetail = false): readonly VibeCodexTranscriptEvent[] {
	const safeId = sanitizeTranscriptId(id);
	const sanitized = sanitizeTranscriptEvents(events);
	const existing = sanitized.find(event => event.id === safeId);
	const detail = appendDetail && existing?.detail
		? `${existing.detail}${seed.detail ?? ''}`
		: seed.detail;
	const nextEvent = {
		...createTranscriptEvent({ ...seed, detail }, existing?.timestamp ?? Date.now()),
		id: safeId,
	};
	return [nextEvent, ...sanitized.filter(event => event.id !== safeId)].slice(0, maxTranscriptEvents);
}

export function sanitizeTranscriptEvents(events: readonly unknown[]): readonly VibeCodexTranscriptEvent[] {
	return events
		.filter(isTranscriptEventLike)
		.map(event => createTranscriptEvent({
			kind: event.kind,
			status: event.status,
			title: event.title,
			detail: event.detail,
		}, event.timestamp))
		.slice(0, maxTranscriptEvents);
}

export function transcriptMarkdown(events: readonly VibeCodexTranscriptEvent[]): string {
	const items = sanitizeTranscriptEvents(events);
	if (!items.length) {
		return '';
	}
	return items
		.slice()
		.reverse()
		.map(event => [
			`### ${new Date(event.timestamp).toISOString()} - ${event.kind} (${event.status})`,
			'',
			event.title,
			event.detail ? `\n${event.detail}` : undefined,
		].filter((line): line is string => line !== undefined).join('\n'))
		.join('\n\n');
}

function isTranscriptEventLike(value: unknown): value is VibeCodexTranscriptEvent {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Partial<VibeCodexTranscriptEvent>;
	return typeof candidate.timestamp === 'number'
		&& isTranscriptKind(candidate.kind)
		&& isTranscriptStatus(candidate.status)
		&& typeof candidate.title === 'string';
}

function isTranscriptKind(value: unknown): value is VibeCodexTranscriptKind {
	return value === 'user'
		|| value === 'assistant'
		|| value === 'plan'
		|| value === 'approval'
		|| value === 'tool'
		|| value === 'terminal'
		|| value === 'diff'
		|| value === 'verification'
		|| value === 'rollback'
		|| value === 'system';
}

function isTranscriptStatus(value: unknown): value is VibeCodexTranscriptStatus {
	return value === 'pending'
		|| value === 'running'
		|| value === 'completed'
		|| value === 'blocked'
		|| value === 'failed';
}

function sanitizeTranscriptId(value: string): string {
	const compact = value.trim().replace(/[^A-Za-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
	return compact || `event-${Date.now().toString(36)}`;
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}
