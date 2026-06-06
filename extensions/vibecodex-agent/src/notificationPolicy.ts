/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface VibeCodexNotificationConfig {
	readonly approvals: boolean;
	readonly terminalCompletion: boolean;
	readonly longRunningTerminalSeconds: number;
}

export const defaultNotificationConfig: VibeCodexNotificationConfig = {
	approvals: true,
	terminalCompletion: false,
	longRunningTerminalSeconds: 120,
};

export function normalizeNotificationConfig(value: {
	readonly approvals?: unknown;
	readonly terminalCompletion?: unknown;
	readonly longRunningTerminalSeconds?: unknown;
}): VibeCodexNotificationConfig {
	return {
		approvals: typeof value.approvals === 'boolean' ? value.approvals : defaultNotificationConfig.approvals,
		terminalCompletion: typeof value.terminalCompletion === 'boolean' ? value.terminalCompletion : defaultNotificationConfig.terminalCompletion,
		longRunningTerminalSeconds: normalizeLongRunningSeconds(value.longRunningTerminalSeconds),
	};
}

export function shouldNotifyApproval(config: VibeCodexNotificationConfig): boolean {
	return config.approvals;
}

export function shouldNotifyTerminalCompletion(config: VibeCodexNotificationConfig): boolean {
	return config.terminalCompletion;
}

export function longRunningTerminalDelayMs(config: VibeCodexNotificationConfig): number | undefined {
	return config.longRunningTerminalSeconds > 0 ? config.longRunningTerminalSeconds * 1000 : undefined;
}

function normalizeLongRunningSeconds(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return defaultNotificationConfig.longRunningTerminalSeconds;
	}
	return Math.max(0, Math.min(3600, Math.floor(value)));
}
