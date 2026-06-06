/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { redactSensitiveText } from './secretFilters';
import type { VibeCodexSessionSnapshot } from './sessionHistory';

export interface VibeCodexChatTabsState {
	readonly version: 1;
	readonly generatedAt: number;
	readonly activeSessionId?: string;
	readonly tabs: readonly VibeCodexChatTab[];
}

export interface VibeCodexChatTab {
	readonly id: string;
	readonly title: string;
	readonly mode: string;
	readonly status: string;
	readonly updatedAt: number;
	readonly active: boolean;
	readonly promptPreview: string;
	readonly taskId?: string;
	readonly revision?: number;
}

const defaultMaxTabs = 8;
const maxTitleChars = 64;
const maxPromptPreviewChars = 180;

export function createChatTabs(history: readonly VibeCodexSessionSnapshot[], activeSessionId?: string, maxTabs = defaultMaxTabs): VibeCodexChatTabsState {
	const limit = Math.max(1, Math.min(12, Math.floor(Number.isFinite(maxTabs) ? maxTabs : defaultMaxTabs)));
	const tabs = history
		.slice()
		.sort((first, second) => tabSortScore(second, activeSessionId) - tabSortScore(first, activeSessionId))
		.slice(0, limit)
		.map(snapshot => {
			const title = tabTitle(snapshot);
			return {
				id: snapshot.id,
				title,
				mode: snapshot.mode,
				status: snapshot.status,
				updatedAt: snapshot.updatedAt,
				active: snapshot.id === activeSessionId,
				promptPreview: excerpt(snapshot.prompt, maxPromptPreviewChars),
				...(snapshot.plan?.taskId ? { taskId: snapshot.plan.taskId } : {}),
				...(snapshot.plan ? { revision: snapshot.plan.revision } : {}),
			};
		});
	return {
		version: 1,
		generatedAt: Date.now(),
		...(activeSessionId ? { activeSessionId } : {}),
		tabs,
	};
}

export function chatTabsSummary(state: VibeCodexChatTabsState): string {
	if (!state.tabs.length) {
		return 'No chat tabs yet.';
	}
	const active = state.tabs.find(tab => tab.active);
	return `${state.tabs.length} chat tab${state.tabs.length === 1 ? '' : 's'}${active ? `, active: ${active.title}` : ''}.`;
}

function tabSortScore(snapshot: VibeCodexSessionSnapshot, activeSessionId: string | undefined): number {
	return snapshot.updatedAt + (snapshot.id === activeSessionId ? 10_000_000_000_000 : 0);
}

function tabTitle(snapshot: VibeCodexSessionSnapshot): string {
	const value = snapshot.plan?.summary || snapshot.prompt.split(/\r?\n/, 1)[0] || `${snapshot.mode} session`;
	return excerpt(value, maxTitleChars);
}

function excerpt(value: string, maxChars: number): string {
	const text = redactSensitiveText(value).replace(/\s+/g, ' ').trim();
	if (text.length <= maxChars) {
		return text || 'Untitled chat';
	}
	return `${text.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}
