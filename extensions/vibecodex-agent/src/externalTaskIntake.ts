/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexExternalTaskTriggerKind = 'uri' | 'connector' | 'scheduled' | 'headless';

export interface VibeCodexExternalTaskUriLike {
	readonly scheme?: string;
	readonly authority?: string;
	readonly path?: string;
	readonly query?: string;
	readonly fragment?: string;
	readonly toString?: (skipEncoding?: boolean) => string;
}

export interface VibeCodexExternalTaskIntake {
	readonly version: 1;
	readonly prompt: string;
	readonly title: string;
	readonly mode: string;
	readonly triggerKind: VibeCodexExternalTaskTriggerKind;
	readonly source: string;
	readonly sourceId?: string;
	readonly dependsOn: readonly string[];
	readonly parallelThreads: number;
	readonly startRequested: boolean;
	readonly receivedAt: number;
	readonly originalUri?: string;
}

interface ParsedQuery {
	get(key: string): string | undefined;
	getAll(key: string): readonly string[];
}

const taskRouteSegments = new Set([
	'task',
	'tasks',
	'queue',
	'start',
	'plan',
	'headless',
	'scheduled',
	'schedule',
	'automation',
	'automations',
	'connector',
	'connectors',
]);

export function normalizeExternalTaskUri(uri: VibeCodexExternalTaskUriLike): VibeCodexExternalTaskIntake | undefined {
	const params = parseQuery(uri.query ?? '');
	const payload = payloadRecord(params);
	const segments = routeSegments(uri);
	if (!segments.some(segment => taskRouteSegments.has(segment)) && !payload) {
		return undefined;
	}
	const prompt = firstString([
		payload?.prompt,
		payload?.task,
		payload?.instructions,
		payload?.description,
		payload?.message,
		...params.getAll('prompt'),
		...params.getAll('task'),
		...params.getAll('instructions'),
		...params.getAll('description'),
		...params.getAll('message'),
		uri.fragment,
		pathPrompt(segments),
	]);
	if (!prompt) {
		return undefined;
	}
	const mode = firstString([payload?.mode, params.get('mode')]) ?? 'agent';
	const title = firstString([payload?.title, payload?.name, params.get('title'), params.get('name')]) ?? firstPromptLine(prompt);
	const action = firstString([payload?.action, params.get('action')])?.toLowerCase();
	const triggerKind = triggerKindFrom([
		payload?.triggerKind,
		payload?.trigger,
		payload?.type,
		payload?.source,
		params.get('triggerKind'),
		params.get('trigger'),
		params.get('type'),
		params.get('source'),
		...segments,
	]);
	const source = firstString([
		payload?.source,
		payload?.connector,
		payload?.provider,
		params.get('source'),
		params.get('connector'),
		params.get('provider'),
	]) ?? triggerKind;
	const sourceId = firstString([
		payload?.sourceId,
		payload?.source_id,
		payload?.triggerId,
		payload?.trigger_id,
		payload?.eventId,
		payload?.event_id,
		params.get('sourceId'),
		params.get('source_id'),
		params.get('triggerId'),
		params.get('trigger_id'),
		params.get('eventId'),
		params.get('event_id'),
	]);
	const dependsOn = dedupeStrings([
		...arrayOfStrings(payload?.dependsOn),
		...arrayOfStrings(payload?.depends_on),
		...splitParamValues(params.getAll('dependsOn')),
		...splitParamValues(params.getAll('depends_on')),
	]);
	const parallelThreads = clampParallelThreads(numberValue(payload?.parallelThreads)
		?? numberValue(payload?.parallel_threads)
		?? numberValue(params.get('parallelThreads'))
		?? numberValue(params.get('parallel_threads'))
		?? 1);
	const explicitStart = booleanValue(payload?.start)
		?? booleanValue(payload?.autoStart)
		?? booleanValue(payload?.auto_start)
		?? booleanValue(params.get('start'))
		?? booleanValue(params.get('autoStart'))
		?? booleanValue(params.get('auto_start'));
	const routeStartRequested = action === 'start' || action === 'plan' || segments.includes('start') || segments.includes('plan');
	const startRequested = explicitStart ?? routeStartRequested;
	return {
		version: 1,
		prompt: redactSensitiveText(prompt),
		title: redactSensitiveText(title),
		mode: redactSensitiveText(mode),
		triggerKind,
		source: redactSensitiveText(source),
		...(sourceId ? { sourceId: redactSensitiveText(sourceId) } : {}),
		dependsOn: dependsOn.map(redactSensitiveText),
		parallelThreads,
		startRequested,
		receivedAt: Date.now(),
		...(uri.toString ? { originalUri: redactSensitiveText(uri.toString(true)) } : {}),
	};
}

export function externalTaskIntakeSummary(intake: VibeCodexExternalTaskIntake): string {
	return [
		`${intake.triggerKind} task from ${intake.source}.`,
		`Mode: ${intake.mode}.`,
		`Parallel lanes: ${intake.parallelThreads}.`,
		intake.dependsOn.length ? `Depends on: ${intake.dependsOn.join(', ')}.` : undefined,
		intake.startRequested ? 'Requested action: start visual plan after queueing.' : 'Requested action: queue for user-controlled planning.',
		intake.sourceId ? `Source id: ${intake.sourceId}.` : undefined,
	].filter((value): value is string => !!value).join('\n');
}

export function externalTaskIntakePromptBlock(intake: VibeCodexExternalTaskIntake): string {
	return JSON.stringify(redactSensitiveValue({
		version: intake.version,
		title: intake.title,
		mode: intake.mode,
		triggerKind: intake.triggerKind,
		source: intake.source,
		sourceId: intake.sourceId,
		dependsOn: intake.dependsOn,
		parallelThreads: intake.parallelThreads,
		startRequested: intake.startRequested,
		prompt: intake.prompt,
		note: 'External, scheduled, connector, and headless tasks are intake only. They must enter visual Plan Mode and remain blocked from mutation until the exact plan revision is approved.',
	}), null, 2);
}

function routeSegments(uri: VibeCodexExternalTaskUriLike): readonly string[] {
	const raw = [
		uri.authority,
		...(uri.path ?? '').split('/'),
	].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
	return raw.map(segment => decodeSegment(segment).toLowerCase()).filter(Boolean);
}

function pathPrompt(segments: readonly string[]): string | undefined {
	const index = segments.findIndex(segment => taskRouteSegments.has(segment));
	if (index < 0 || index >= segments.length - 1) {
		return undefined;
	}
	return decodeSegment(segments.slice(index + 1).join(' '));
}

function parseQuery(query: string): ParsedQuery {
	const values = new Map<string, string[]>();
	for (const part of query.replace(/^\?/, '').split('&')) {
		if (!part) {
			continue;
		}
		const separator = part.indexOf('=');
		const key = decodeSegment(separator >= 0 ? part.slice(0, separator) : part);
		const value = decodeSegment(separator >= 0 ? part.slice(separator + 1) : '');
		const existing = values.get(key) ?? [];
		values.set(key, [...existing, value]);
	}
	return {
		get: key => values.get(key)?.[0],
		getAll: key => values.get(key) ?? [],
	};
}

function payloadRecord(params: ParsedQuery): Record<string, unknown> | undefined {
	for (const key of ['payload', 'json', 'data']) {
		for (const value of params.getAll(key)) {
			const parsed = parseJsonValue(value) ?? parseJsonValue(decodeSegment(value));
			if (isRecord(parsed)) {
				return parsed;
			}
		}
	}
	return undefined;
}

function parseJsonValue(value: string | undefined | null): unknown {
	if (!value) {
		return undefined;
	}
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function triggerKindFrom(values: readonly unknown[]): VibeCodexExternalTaskTriggerKind {
	const labels = values
		.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
		.map(value => value.trim().toLowerCase());
	if (labels.some(label => /schedule|cron|automation/.test(label))) {
		return 'scheduled';
	}
	if (labels.some(label => /headless|cli|server/.test(label))) {
		return 'headless';
	}
	if (labels.some(label => /connector|slack|telegram|discord|google|whatsapp|jira|linear|github|gitlab|email|webhook/.test(label))) {
		return 'connector';
	}
	return 'uri';
}

function firstPromptLine(prompt: string): string {
	return prompt.split(/\r?\n/, 1)[0].trim().replace(/\s+/g, ' ').slice(0, 72) || 'External Vibe Codex task';
}

function firstString(values: readonly unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === 'string' && value.trim().length > 0) {
			return String(redactSensitiveValue(value.trim()));
		}
	}
	return undefined;
}

function arrayOfStrings(value: unknown): readonly string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
}

function splitParamValues(values: readonly string[]): readonly string[] {
	return values.flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean);
}

function dedupeStrings(values: readonly string[]): readonly string[] {
	return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) {
		return Number(value);
	}
	return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value !== 'string') {
		return undefined;
	}
	const normalized = value.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on', 'start'].includes(normalized)) {
		return true;
	}
	if (['0', 'false', 'no', 'off', 'queue'].includes(normalized)) {
		return false;
	}
	return undefined;
}

function clampParallelThreads(value: number): number {
	return Math.max(1, Math.min(8, Math.floor(Number.isFinite(value) ? value : 1)));
}

function decodeSegment(value: string): string {
	try {
		return decodeURIComponent(value.replace(/\+/g, '%20')).trim();
	} catch {
		return value.trim();
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
