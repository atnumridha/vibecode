/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VibeCodexPlan, validatePlan } from './planProtocol';

export type VibeCodexPlanRevisionEvent = 'submitted' | 'updated' | 'edited' | 'refine_requested' | 'rejected' | 'approved' | 'restored';

export interface VibeCodexPlanRevisionSnapshot {
	readonly id: string;
	readonly taskId: string;
	readonly revision: number;
	readonly event: VibeCodexPlanRevisionEvent;
	readonly capturedAt: number;
	readonly summary: string;
	readonly note?: string;
	readonly plan: VibeCodexPlan;
}

const maxPlanRevisionHistory = 24;

export function appendPlanRevision(history: readonly VibeCodexPlanRevisionSnapshot[], plan: VibeCodexPlan, event: VibeCodexPlanRevisionEvent, note?: string): readonly VibeCodexPlanRevisionSnapshot[] {
	const capturedAt = Date.now();
	const snapshot: VibeCodexPlanRevisionSnapshot = {
		id: `${plan.taskId}:r${plan.revision}:${event}:${capturedAt.toString(36)}`,
		taskId: plan.taskId,
		revision: plan.revision,
		event,
		capturedAt,
		summary: plan.summary,
		...(note ? { note } : {}),
		plan,
	};
	return [snapshot, ...history].slice(0, maxPlanRevisionHistory);
}

export function sanitizePlanRevisionHistory(value: unknown): readonly VibeCodexPlanRevisionSnapshot[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter(isPlanRevisionSnapshot).slice(0, maxPlanRevisionHistory);
}

export function planRevisionHistorySummary(history: readonly VibeCodexPlanRevisionSnapshot[]): string {
	if (!history.length) {
		return 'No plan revisions recorded yet.';
	}
	const approved = history.find(item => item.event === 'approved');
	return [
		`${history.length} plan revision snapshot${history.length === 1 ? '' : 's'} recorded.`,
		approved ? `Approved snapshot: ${approved.taskId} r${approved.revision}.` : 'No approved snapshot yet.',
	].join('\n');
}

export function planRevisionHistoryMarkdown(history: readonly VibeCodexPlanRevisionSnapshot[]): string {
	return history.map(item => [
		`- ${item.taskId} r${item.revision} (${item.event}) at ${new Date(item.capturedAt).toISOString()}: ${item.summary}`,
		item.note ? `  ${item.note}` : undefined,
	].filter(Boolean).join('\n')).join('\n');
}

function isPlanRevisionSnapshot(value: unknown): value is VibeCodexPlanRevisionSnapshot {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Partial<VibeCodexPlanRevisionSnapshot>;
	return typeof candidate.id === 'string'
		&& typeof candidate.taskId === 'string'
		&& typeof candidate.revision === 'number'
		&& isPlanRevisionEvent(candidate.event)
		&& typeof candidate.capturedAt === 'number'
		&& typeof candidate.summary === 'string'
		&& validatePlan(candidate.plan).valid;
}

function isPlanRevisionEvent(value: unknown): value is VibeCodexPlanRevisionEvent {
	return value === 'submitted'
		|| value === 'updated'
		|| value === 'edited'
		|| value === 'refine_requested'
		|| value === 'rejected'
		|| value === 'approved'
		|| value === 'restored';
}
