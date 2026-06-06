/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type VibeCodexAutoApproveRisk = 'low' | 'medium' | 'high' | 'blocked';

export interface VibeCodexAutoApproveConfig {
	readonly enabled: boolean;
	readonly terminal: boolean;
	readonly file: boolean;
	readonly tool: boolean;
	readonly generic: boolean;
	readonly mcp: boolean;
	readonly browser: boolean;
	readonly maxRisk: Exclude<VibeCodexAutoApproveRisk, 'blocked'>;
}

export interface VibeCodexAutoApproveDecision {
	readonly approve: boolean;
	readonly reason: string;
}

export const defaultAutoApproveConfig: VibeCodexAutoApproveConfig = {
	enabled: false,
	terminal: false,
	file: false,
	tool: false,
	generic: false,
	mcp: false,
	browser: false,
	maxRisk: 'medium',
};

export function shouldAutoApproveApproval(card: { readonly kind?: string; readonly risk?: string; readonly blocked?: boolean }, config: VibeCodexAutoApproveConfig, hasExecutionAuthorization: boolean): VibeCodexAutoApproveDecision {
	if (!config.enabled) {
		return decline('Auto-approve is disabled.');
	}
	if (card.blocked) {
		return decline('Request is blocked by safety policy.');
	}
	if (!hasExecutionAuthorization) {
		return decline('Plan approval is required before auto-approval.');
	}
	const kind = normalizeKind(card.kind);
	if (!config[kind]) {
		return decline(`${kind} auto-approval is disabled.`);
	}
	const risk = normalizeRisk(card.risk);
	if (!riskAllowed(risk, config.maxRisk)) {
		return decline(`Risk ${risk} exceeds auto-approve max risk ${config.maxRisk}.`);
	}
	return { approve: true, reason: `Auto-approved ${kind} request at ${risk} risk.` };
}

export function shouldAutoApproveMcp(request: { readonly risk?: string; readonly blocked?: boolean }, config: VibeCodexAutoApproveConfig, hasExecutionAuthorization: boolean): VibeCodexAutoApproveDecision {
	if (!config.enabled) {
		return decline('Auto-approve is disabled.');
	}
	if (!config.mcp) {
		return decline('MCP auto-approval is disabled.');
	}
	if (request.blocked) {
		return decline('MCP request is blocked by safety policy.');
	}
	if (!hasExecutionAuthorization) {
		return decline('Plan approval is required before MCP auto-approval.');
	}
	const risk = normalizeRisk(request.risk);
	if (!riskAllowed(risk, config.maxRisk)) {
		return decline(`MCP risk ${risk} exceeds auto-approve max risk ${config.maxRisk}.`);
	}
	return { approve: true, reason: `Auto-approved MCP request at ${risk} risk.` };
}

export function shouldAutoApproveBrowser(request: { readonly supported?: boolean }, config: VibeCodexAutoApproveConfig, hasExecutionAuthorization: boolean): VibeCodexAutoApproveDecision {
	if (!config.enabled) {
		return decline('Auto-approve is disabled.');
	}
	if (!config.browser) {
		return decline('Browser auto-approval is disabled.');
	}
	if (!request.supported) {
		return decline('Browser request needs native controller or unsafe URL handling.');
	}
	if (!hasExecutionAuthorization) {
		return decline('Plan approval is required before browser auto-approval.');
	}
	if (!riskAllowed('medium', config.maxRisk)) {
		return decline(`Browser risk medium exceeds auto-approve max risk ${config.maxRisk}.`);
	}
	return { approve: true, reason: 'Auto-approved supported browser open/navigate request.' };
}

export function autoApproveSummary(config: VibeCodexAutoApproveConfig): string {
	const enabledTargets = [
		config.terminal ? 'terminal' : undefined,
		config.file ? 'file' : undefined,
		config.tool ? 'tool' : undefined,
		config.generic ? 'generic' : undefined,
		config.mcp ? 'MCP' : undefined,
		config.browser ? 'browser' : undefined,
	].filter((value): value is string => !!value);
	return `${config.enabled ? 'Enabled' : 'Disabled'}; max risk ${config.maxRisk}; ${enabledTargets.length ? enabledTargets.join(', ') : 'no targets enabled'}.`;
}

function normalizeKind(kind: string | undefined): 'terminal' | 'file' | 'tool' | 'generic' {
	switch (kind) {
		case 'terminal':
		case 'file':
		case 'tool':
			return kind;
		default:
			return 'generic';
	}
}

function normalizeRisk(risk: string | undefined): VibeCodexAutoApproveRisk {
	switch (risk) {
		case 'low':
		case 'medium':
		case 'high':
		case 'blocked':
			return risk;
		default:
			return 'high';
	}
}

function riskAllowed(risk: VibeCodexAutoApproveRisk, maxRisk: Exclude<VibeCodexAutoApproveRisk, 'blocked'>): boolean {
	if (risk === 'blocked') {
		return false;
	}
	const order: Record<Exclude<VibeCodexAutoApproveRisk, 'blocked'>, number> = { low: 1, medium: 2, high: 3 };
	return order[risk] <= order[maxRisk];
}

function decline(reason: string): VibeCodexAutoApproveDecision {
	return { approve: false, reason };
}
