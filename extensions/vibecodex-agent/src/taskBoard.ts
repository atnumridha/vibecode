/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexTaskBoardStatus = 'queued' | 'ready' | 'running' | 'completed' | 'blocked' | 'archived';
export type VibeCodexTaskBoardSource = 'sidebar' | 'inline' | 'uri' | 'connector' | 'scheduled' | 'headless' | 'restored' | 'delegated';

export interface VibeCodexTaskBoardCard {
	readonly id: string;
	readonly title: string;
	readonly prompt: string;
	readonly mode: string;
	readonly status: VibeCodexTaskBoardStatus;
	readonly source: VibeCodexTaskBoardSource;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly dependsOn: readonly string[];
	readonly parallelThreads: number;
	readonly branchName?: string;
	readonly worktreePath?: string;
	readonly evidence: readonly string[];
}

export interface VibeCodexTaskBoard {
	readonly version: 1;
	readonly updatedAt: number;
	readonly cards: readonly VibeCodexTaskBoardCard[];
}

export interface VibeCodexTaskBoardCardSeed {
	readonly title?: string;
	readonly prompt: string;
	readonly mode: string;
	readonly source?: VibeCodexTaskBoardSource;
	readonly dependsOn?: readonly string[];
	readonly parallelThreads?: number;
	readonly branchName?: string;
	readonly worktreePath?: string;
	readonly evidence?: readonly string[];
}

export interface VibeCodexTaskBoardCardReadiness {
	readonly ready: boolean;
	readonly blockers: readonly string[];
}

export const taskBoardStorageKey = 'vibecodex.taskBoard';

const maxTaskBoardCards = 40;
const maxEvidence = 12;

export function createEmptyTaskBoard(): VibeCodexTaskBoard {
	return {
		version: 1,
		updatedAt: Date.now(),
		cards: [],
	};
}

export function sanitizeTaskBoard(value: unknown): VibeCodexTaskBoard {
	if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.cards)) {
		return createEmptyTaskBoard();
	}
	return normalizeTaskBoard(value.cards.filter(isTaskBoardCard).slice(0, maxTaskBoardCards), typeof value.updatedAt === 'number' ? value.updatedAt : undefined);
}

export function queueTaskBoardCard(board: VibeCodexTaskBoard, seed: VibeCodexTaskBoardCardSeed): VibeCodexTaskBoard {
	const prompt = seed.prompt.trim();
	if (!prompt) {
		return board;
	}
	const now = Date.now();
	const id = `task-${now.toString(36)}-${hashText(`${seed.mode}:${prompt}`).slice(0, 8)}`;
	const dependsOn = dedupeStrings(seed.dependsOn ?? []).filter(dependency => dependency !== id);
	const parallelThreads = clampParallelThreads(seed.parallelThreads ?? 1);
	const card: VibeCodexTaskBoardCard = {
		id,
		title: redactSensitiveText(normalizeTitle(seed.title, prompt)),
		prompt: redactSensitiveText(prompt),
		mode: seed.mode || 'agent',
		status: 'queued',
		source: seed.source ?? 'sidebar',
		createdAt: now,
		updatedAt: now,
		dependsOn,
		parallelThreads,
		...(seed.branchName ? { branchName: seed.branchName } : {}),
		...(seed.worktreePath ? { worktreePath: seed.worktreePath } : {}),
		evidence: initialEvidence(seed.evidence),
	};
	return normalizeTaskBoard([card, ...board.cards].slice(0, maxTaskBoardCards), now);
}

export function updateTaskBoardCardStatus(board: VibeCodexTaskBoard, id: string, status: VibeCodexTaskBoardStatus, evidence?: string): VibeCodexTaskBoard {
	const now = Date.now();
	const cards = board.cards.map(card => {
		if (card.id !== id) {
			return card;
		}
		return {
			...card,
			status,
			updatedAt: now,
			evidence: appendEvidence(card.evidence, evidence),
		};
	});
	return normalizeTaskBoard(cards, now);
}

export function archiveTaskBoardCard(board: VibeCodexTaskBoard, id: string): VibeCodexTaskBoard {
	return updateTaskBoardCardStatus(board, id, 'archived', 'Archived from the Vibe Codex Task Board.');
}

export function taskBoardCardReadiness(board: VibeCodexTaskBoard, cardId: string): VibeCodexTaskBoardCardReadiness {
	const card = board.cards.find(candidate => candidate.id === cardId);
	if (!card) {
		return { ready: false, blockers: ['Task card was not found.'] };
	}
	const blockers = card.dependsOn
		.map(dependency => {
			const dependencyCard = board.cards.find(candidate => candidate.id === dependency);
			if (!dependencyCard) {
				return `${dependency} is missing.`;
			}
			if (dependencyCard.status !== 'completed') {
				return `${dependencyCard.title} is ${dependencyCard.status}.`;
			}
			return undefined;
		})
		.filter((value): value is string => !!value);
	return {
		ready: blockers.length === 0 && (card.status === 'queued' || card.status === 'ready'),
		blockers,
	};
}

export function taskBoardSummary(board: VibeCodexTaskBoard): string {
	const visible = board.cards.filter(card => card.status !== 'archived');
	if (!visible.length) {
		return 'Task Board empty. Queue prompts to coordinate dependent agent work.';
	}
	const counts = visible.reduce<Record<VibeCodexTaskBoardStatus, number>>((accumulator, card) => {
		accumulator[card.status] += 1;
		return accumulator;
	}, { queued: 0, ready: 0, running: 0, completed: 0, blocked: 0, archived: 0 });
	return [
		`${visible.length} task card${visible.length === 1 ? '' : 's'}.`,
		`${counts.ready} ready, ${counts.queued} queued, ${counts.running} running, ${counts.completed} completed, ${counts.blocked} blocked.`,
	].join('\n');
}

export function taskBoardPromptBlock(board: VibeCodexTaskBoard, activeCardId?: string): string {
	const visible = board.cards.filter(card => card.status !== 'archived').slice(0, maxTaskBoardCards);
	return JSON.stringify({
		version: board.version,
		updatedAt: board.updatedAt,
		activeCardId,
		summary: taskBoardSummary(board),
		cards: visible.map(card => {
			const readiness = taskBoardCardReadiness(board, card.id);
			return {
				id: card.id,
				title: card.title,
				mode: card.mode,
				status: card.status,
				source: card.source,
				dependsOn: card.dependsOn,
				parallelThreads: card.parallelThreads,
				branchName: card.branchName,
				worktreePath: card.worktreePath,
				ready: readiness.ready,
				blockers: redactSensitiveValue(readiness.blockers),
				prompt: card.prompt,
				evidence: redactSensitiveValue(card.evidence),
			};
		}),
	}, null, 2);
}

function normalizeTaskBoard(cards: readonly VibeCodexTaskBoardCard[], updatedAt: number = Date.now()): VibeCodexTaskBoard {
	const visibleIds = new Set(cards.map(card => card.id));
	const normalized = cards.map(card => {
		const dependsOn = card.dependsOn.filter(dependency => dependency !== card.id && visibleIds.has(dependency));
		const status = normalizeDependencyStatus({ ...card, dependsOn }, cards);
		return {
			...card,
			title: redactSensitiveText(card.title),
			prompt: redactSensitiveText(card.prompt),
			status,
			dependsOn,
			...(card.branchName ? { branchName: redactSensitiveText(card.branchName) } : {}),
			...(card.worktreePath ? { worktreePath: redactSensitiveText(card.worktreePath) } : {}),
			evidence: initialEvidence(card.evidence),
		};
	});
	return {
		version: 1,
		updatedAt,
		cards: normalized.slice(0, maxTaskBoardCards),
	};
}

function normalizeDependencyStatus(card: VibeCodexTaskBoardCard, cards: readonly VibeCodexTaskBoardCard[]): VibeCodexTaskBoardStatus {
	if (card.status !== 'queued' && card.status !== 'ready') {
		return card.status;
	}
	const dependenciesComplete = card.dependsOn.every(dependency => cards.find(candidate => candidate.id === dependency)?.status === 'completed');
	return dependenciesComplete ? 'ready' : 'queued';
}

function isTaskBoardCard(value: unknown): value is VibeCodexTaskBoardCard {
	if (!isRecord(value)) {
		return false;
	}
	return typeof value.id === 'string'
		&& typeof value.title === 'string'
		&& typeof value.prompt === 'string'
		&& typeof value.mode === 'string'
		&& isTaskBoardStatus(value.status)
		&& isTaskBoardSource(value.source)
		&& typeof value.createdAt === 'number'
		&& typeof value.updatedAt === 'number'
		&& Array.isArray(value.dependsOn)
		&& value.dependsOn.every(item => typeof item === 'string')
		&& typeof value.parallelThreads === 'number'
		&& (value.branchName === undefined || typeof value.branchName === 'string')
		&& (value.worktreePath === undefined || typeof value.worktreePath === 'string')
		&& Array.isArray(value.evidence)
		&& value.evidence.every(item => typeof item === 'string');
}

function isTaskBoardStatus(value: unknown): value is VibeCodexTaskBoardStatus {
	return value === 'queued'
		|| value === 'ready'
		|| value === 'running'
		|| value === 'completed'
		|| value === 'blocked'
		|| value === 'archived';
}

function isTaskBoardSource(value: unknown): value is VibeCodexTaskBoardSource {
	return value === 'sidebar'
		|| value === 'inline'
		|| value === 'uri'
		|| value === 'connector'
		|| value === 'scheduled'
		|| value === 'headless'
		|| value === 'restored'
		|| value === 'delegated';
}

function normalizeTitle(title: string | undefined, prompt: string): string {
	const value = (title?.trim() || prompt.split(/\r?\n/, 1)[0] || 'Vibe Codex task').replace(/\s+/g, ' ');
	return value.length > 72 ? `${value.slice(0, 71).trimEnd()}` : value;
}

function appendEvidence(existing: readonly string[], value: string | undefined): readonly string[] {
	const trimmed = value?.trim();
	return trimmed ? initialEvidence([trimmed, ...existing]) : initialEvidence(existing);
}

function initialEvidence(values: readonly string[] | undefined): readonly string[] {
	return dedupeStrings(values ?? []).map(redactSensitiveText).slice(0, maxEvidence);
}

function dedupeStrings(values: readonly string[]): readonly string[] {
	return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function clampParallelThreads(value: number): number {
	return Math.max(1, Math.min(8, Math.floor(Number.isFinite(value) ? value : 1)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}
