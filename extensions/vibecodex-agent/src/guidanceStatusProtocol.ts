/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCustomModeCatalog } from './customModes';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexMemoryBank } from './memoryBank';
import type { VibeCodexRuleProposal } from './ruleProposal';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';
import type { VibeCodexWorkspaceGuidance } from './workspaceGuidance';

export interface VibeCodexGuidanceStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeDocuments: boolean;
	readonly includeMemoryBank: boolean;
	readonly includeCustomModes: boolean;
	readonly includeRuleProposal: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexGuidanceStatusDocument {
	readonly path: string;
	readonly kind: string;
	readonly title?: string;
	readonly name?: string;
	readonly description?: string;
	readonly entries?: readonly string[];
	readonly truncated?: boolean;
	readonly textPreview?: string;
	readonly text?: string;
}

export interface VibeCodexGuidanceStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly collectedAt?: number;
	readonly summary: string;
	readonly counts: {
		readonly rules: number;
		readonly skills: number;
		readonly hooks: number;
		readonly memoryBankDocuments: number;
		readonly customModes: number;
	};
	readonly guidanceSummary?: string;
	readonly rules?: readonly VibeCodexGuidanceStatusDocument[];
	readonly skills?: readonly VibeCodexGuidanceStatusDocument[];
	readonly hooks?: readonly VibeCodexGuidanceStatusDocument[];
	readonly memoryBankSummary?: string;
	readonly memoryBankDocuments?: readonly VibeCodexGuidanceStatusDocument[];
	readonly customModeSummary?: string;
	readonly customModes?: unknown;
	readonly ruleProposalSummary?: string;
	readonly ruleProposal?: unknown;
	readonly message: string;
}

export interface VibeCodexGuidanceStatusInput {
	readonly guidance?: VibeCodexWorkspaceGuidance;
	readonly memoryBank?: VibeCodexMemoryBank;
	readonly customModeCatalog?: VibeCodexCustomModeCatalog;
	readonly ruleProposal?: VibeCodexRuleProposal;
}

const guidanceStatusMethods = new Set([
	'agent/getGuidanceStatus',
	'agent/guidanceStatus',
	'guidance/status',
	'workspaceGuidance/status',
	'rules/status',
	'vibecodex/guidanceStatus',
]);

const guidanceStatusToolNames = new Set([
	'guidance_status',
	'workspace_guidance_status',
	'rules_status',
	'get_rules',
	'memory_bank_status',
]);

const previewLimit = 700;

export function normalizeGuidanceStatusRequest(message: JsonRpcMessage): VibeCodexGuidanceStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!guidanceStatusMethods.has(message.method) && !isGuidanceStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const toolName = message.method === 'item/tool/call'
		? (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase()
		: '';
	return {
		id: message.id,
		method: message.method,
		includeDocuments: booleanValue(payload.includeDocuments)
			?? booleanValue(payload.include_documents)
			?? booleanValue(args.includeDocuments)
			?? booleanValue(args.include_documents)
			?? false,
		includeMemoryBank: booleanValue(payload.includeMemoryBank)
			?? booleanValue(payload.include_memory_bank)
			?? booleanValue(args.includeMemoryBank)
			?? booleanValue(args.include_memory_bank)
			?? toolName === 'memory_bank_status',
		includeCustomModes: booleanValue(payload.includeCustomModes)
			?? booleanValue(payload.include_custom_modes)
			?? booleanValue(args.includeCustomModes)
			?? booleanValue(args.include_custom_modes)
			?? false,
		includeRuleProposal: booleanValue(payload.includeRuleProposal)
			?? booleanValue(payload.include_rule_proposal)
			?? booleanValue(args.includeRuleProposal)
			?? booleanValue(args.include_rule_proposal)
			?? false,
		requestedAt: Date.now(),
	};
}

export function createGuidanceStatusResponse(request: VibeCodexGuidanceStatusRequest, input: VibeCodexGuidanceStatusInput): VibeCodexGuidanceStatusResponse {
	const guidance = input.guidance;
	const memoryBank = input.memoryBank;
	const customModeCatalog = input.customModeCatalog;
	const ruleProposal = input.ruleProposal;
	const counts = {
		rules: guidance?.rules.length ?? 0,
		skills: guidance?.skills.length ?? 0,
		hooks: guidance?.hooks.length ?? 0,
		memoryBankDocuments: memoryBank?.documents.length ?? 0,
		customModes: customModeCatalog?.modes.length ?? 0,
	};
	const ok = !!guidance || !!memoryBank || !!customModeCatalog || !!ruleProposal;
	const summary = createSummary(guidance, memoryBank, customModeCatalog, ruleProposal);
	return {
		ok,
		source: 'externalExtension',
		version: 1,
		...(guidance?.collectedAt ? { collectedAt: guidance.collectedAt } : {}),
		summary,
		counts,
		...(guidance ? {
			guidanceSummary: workspaceGuidanceSummaryLocal(guidance),
			rules: guidance.rules.map(rule => documentStatus(rule.path, rule.kind, rule.text, request.includeDocuments)),
			skills: guidance.skills.map(skill => documentStatus(skill.path, 'skill', skill.text, request.includeDocuments, { name: skill.name, description: skill.description })),
			hooks: guidance.hooks.map(hook => documentStatus(hook.path, `hook:${hook.kind}`, hook.text, request.includeDocuments, { entries: hook.entries })),
		} : {}),
		...(request.includeMemoryBank && memoryBank ? {
			memoryBankSummary: memoryBankSummaryLocal(memoryBank),
			memoryBankDocuments: memoryBank.documents.map(document => documentStatus(document.path, document.kind, document.text, request.includeDocuments, { title: document.title, truncated: document.truncated })),
		} : memoryBank ? { memoryBankSummary: memoryBankSummaryLocal(memoryBank) } : {}),
		...(request.includeCustomModes && customModeCatalog ? {
			customModeSummary: customModeCatalogSummaryLocal(customModeCatalog),
			customModes: redactSensitiveValue(customModeCatalog),
		} : customModeCatalog ? { customModeSummary: customModeCatalogSummaryLocal(customModeCatalog) } : {}),
		...(request.includeRuleProposal && ruleProposal ? {
			ruleProposalSummary: ruleProposalSummaryLocal(ruleProposal),
			ruleProposal: redactSensitiveValue(ruleProposal),
		} : ruleProposal ? { ruleProposalSummary: ruleProposalSummaryLocal(ruleProposal) } : {}),
		message: ok
			? `Workspace guidance status returned: ${counts.rules} rule file${counts.rules === 1 ? '' : 's'}, ${counts.skills} skill${counts.skills === 1 ? '' : 's'}, ${counts.hooks} hook manifest${counts.hooks === 1 ? '' : 's'}.`
			: 'No workspace guidance status is available yet.',
	};
}

export function guidanceStatusSummary(response: VibeCodexGuidanceStatusResponse): string {
	return response.ok
		? `${response.message} ${response.counts.memoryBankDocuments} Memory Bank document${response.counts.memoryBankDocuments === 1 ? '' : 's'}, ${response.counts.customModes} custom mode${response.counts.customModes === 1 ? '' : 's'}. Hooks are read-only context.`
		: response.message;
}

function documentStatus(path: string, kind: string, text: string, includeText: boolean, extra?: { readonly title?: string; readonly name?: string; readonly description?: string; readonly entries?: readonly string[]; readonly truncated?: boolean }): VibeCodexGuidanceStatusDocument {
	const redactedText = redactSensitiveText(text);
	return {
		path: redactSensitiveText(path),
		kind,
		...(extra?.title ? { title: redactSensitiveText(extra.title) } : {}),
		...(extra?.name ? { name: redactSensitiveText(extra.name) } : {}),
		...(extra?.description ? { description: redactSensitiveText(extra.description) } : {}),
		...(extra?.entries ? { entries: redactSensitiveValue(extra.entries) as readonly string[] } : {}),
		...(extra?.truncated !== undefined ? { truncated: extra.truncated } : {}),
		textPreview: preview(redactedText),
		...(includeText ? { text: redactedText } : {}),
	};
}

function createSummary(guidance: VibeCodexWorkspaceGuidance | undefined, memoryBank: VibeCodexMemoryBank | undefined, customModeCatalog: VibeCodexCustomModeCatalog | undefined, ruleProposal: VibeCodexRuleProposal | undefined): string {
	return [
		guidance ? workspaceGuidanceSummaryLocal(guidance) : undefined,
		memoryBank ? memoryBankSummaryLocal(memoryBank) : undefined,
		customModeCatalog ? customModeCatalogSummaryLocal(customModeCatalog) : undefined,
		ruleProposal ? ruleProposalSummaryLocal(ruleProposal) : undefined,
		'Rules, skills, hooks, Memory Bank, and custom modes are read-only planning context; this status response never executes hooks or writes guidance files.',
	].filter((line): line is string => !!line).map(line => redactSensitiveText(line)).join('\n');
}

function workspaceGuidanceSummaryLocal(guidance: VibeCodexWorkspaceGuidance): string {
	return [
		`${guidance.rules.length} rule/instruction file${guidance.rules.length === 1 ? '' : 's'}.`,
		`${guidance.skills.length} skill document${guidance.skills.length === 1 ? '' : 's'}.`,
		`${guidance.hooks.length} hook manifest${guidance.hooks.length === 1 ? '' : 's'} indexed as read-only context.`,
	].join('\n');
}

function memoryBankSummaryLocal(memoryBank: VibeCodexMemoryBank): string {
	if (!memoryBank.documents.length) {
		return 'No Memory Bank documents found.';
	}
	return `${memoryBank.documents.length} Memory Bank document${memoryBank.documents.length === 1 ? '' : 's'} loaded.`;
}

function customModeCatalogSummaryLocal(catalog: VibeCodexCustomModeCatalog): string {
	const executable = catalog.modes.filter(mode => !mode.readOnly).length;
	return `${catalog.modes.length} custom mode${catalog.modes.length === 1 ? '' : 's'} indexed; ${executable} execution-capable after visual plan approval. ${catalog.sources.length} source file${catalog.sources.length === 1 ? '' : 's'}.`;
}

function ruleProposalSummaryLocal(proposal: VibeCodexRuleProposal): string {
	return `Rule proposal targets ${proposal.targetPath} (${proposal.operation}, ${proposal.targetKind}). ${proposal.existingRulePaths.length} existing rule file${proposal.existingRulePaths.length === 1 ? '' : 's'} indexed.`;
}

function preview(value: string): string {
	return value.length > previewLimit ? `${value.slice(0, previewLimit).trimEnd()}...` : value;
}

function isGuidanceStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return guidanceStatusToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return {};
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
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

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
