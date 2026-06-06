/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { requiresApprovalAuthorization, type VibeCodexExecutionAuthorization } from './executionAuthorization';
import type { ApprovalKind, ExternalApprovalCard } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { modeAllowsAction, type VibeCodexModePolicy } from './modePolicy';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export interface VibeCodexApprovalStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly approvalId?: string;
	readonly includeDetails: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexApprovalStatusCard {
	readonly id: string;
	readonly method: string;
	readonly kind: ApprovalKind;
	readonly title: string;
	readonly description: string;
	readonly risk: ExternalApprovalCard['risk'];
	readonly blocked: boolean;
	readonly canAccept: boolean;
	readonly canDecline: boolean;
	readonly blockedReasons: readonly string[];
	readonly requestedAt: number;
	readonly toolName?: string;
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly paths?: readonly string[];
	readonly detail?: string;
	readonly parallelWorktreeOperation?: ExternalApprovalCard['parallelWorktreeOperation'];
	readonly parallelTaskId?: string;
}

export interface VibeCodexApprovalStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly total: number;
	readonly actionable: number;
	readonly blocked: number;
	readonly counts: Record<ApprovalKind, number>;
	readonly selectedApproval?: VibeCodexApprovalStatusCard;
	readonly approvals?: readonly VibeCodexApprovalStatusCard[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexApprovalStatusInput {
	readonly approvals: readonly ExternalApprovalCard[];
	readonly modePolicy: VibeCodexModePolicy;
	readonly authorization?: VibeCodexExecutionAuthorization;
}

const approvalStatusMethods = new Set([
	'agent/getApprovalStatus',
	'agent/approvalStatus',
	'approval/status',
	'approvals/status',
	'toolApproval/status',
	'vibecodex/approvalStatus',
]);

const approvalStatusToolNames = new Set([
	'approval_status',
	'get_approval_status',
	'pending_approvals',
	'approvals_status',
]);

export function normalizeApprovalStatusRequest(message: JsonRpcMessage): VibeCodexApprovalStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!approvalStatusMethods.has(message.method) && !isApprovalStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	const approvalId = stringValue(payload.approvalId)
		?? stringValue(payload.approval_id)
		?? stringValue(payload.cardId)
		?? stringValue(payload.card_id)
		?? stringValue(args.approvalId)
		?? stringValue(args.approval_id)
		?? stringValue(args.cardId)
		?? stringValue(args.card_id);
	return {
		id: message.id,
		method: message.method,
		...(approvalId ? { approvalId } : {}),
		includeDetails: booleanValue(payload.includeDetails)
			?? booleanValue(payload.include_details)
			?? booleanValue(args.includeDetails)
			?? booleanValue(args.include_details)
			?? !!approvalId,
		requestedAt: Date.now(),
	};
}

export function createApprovalStatusResponse(request: VibeCodexApprovalStatusRequest, input: VibeCodexApprovalStatusInput): VibeCodexApprovalStatusResponse {
	const cards = input.approvals.map(card => approvalStatusCard(card, input));
	const selectedApproval = request.approvalId ? cards.find(card => card.id === request.approvalId) : undefined;
	const visible = request.approvalId ? (selectedApproval ? [selectedApproval] : []) : cards;
	const counts = visible.reduce<Record<ApprovalKind, number>>((result, card) => {
		result[card.kind]++;
		return result;
	}, { terminal: 0, file: 0, tool: 0, generic: 0 });
	const ok = !request.approvalId || !!selectedApproval;
	const actionable = visible.filter(card => card.canAccept).length;
	const blocked = visible.filter(card => !card.canAccept).length;
	return {
		ok,
		source: 'externalExtension',
		total: visible.length,
		actionable,
		blocked,
		counts,
		...(selectedApproval ? { selectedApproval } : {}),
		...(request.includeDetails ? { approvals: visible } : {}),
		guardrails: [
			'Approval status is read-only and never accepts, declines, or auto-approves a request.',
			'Approval tokens are never included; accepted requests are still answered only through the explicit UI decision path.',
			'Blocked reasons mirror the same mode-policy and exact-plan authorization gates used by the approval buttons.',
			'Command lines, paths, reasons, and details are redacted before they are returned to the backend.',
		],
		message: ok
			? `${visible.length} pending approval${visible.length === 1 ? '' : 's'} visible; ${actionable} actionable, ${blocked} blocked.`
			: `Pending approval ${request.approvalId} was not found.`,
	};
}

export function approvalStatusSummary(response: VibeCodexApprovalStatusResponse): string {
	return response.ok
		? `${response.message} Terminal: ${response.counts.terminal}; file: ${response.counts.file}; tool: ${response.counts.tool}; generic: ${response.counts.generic}.`
		: response.message;
}

function approvalStatusCard(card: ExternalApprovalCard, input: VibeCodexApprovalStatusInput): VibeCodexApprovalStatusCard {
	const blockedReasons = approvalBlockedReasons(card, input);
	return {
		id: redactSensitiveText(String(card.id)),
		method: redactSensitiveText(card.method),
		kind: card.kind,
		title: redactSensitiveText(card.title),
		description: redactSensitiveText(card.description),
		risk: card.risk,
		blocked: card.blocked,
		canAccept: blockedReasons.length === 0,
		canDecline: true,
		blockedReasons,
		requestedAt: card.requestedAt,
		...(card.toolName ? { toolName: redactSensitiveText(card.toolName) } : {}),
		...(card.commandLine ? { commandLine: redactSensitiveText(card.commandLine) } : {}),
		...(card.cwd ? { cwd: redactSensitiveText(card.cwd) } : {}),
		...(card.reason ? { reason: redactSensitiveText(card.reason) } : {}),
		...(card.paths.length ? { paths: redactSensitiveValue(card.paths) as readonly string[] } : {}),
		...(card.detail ? { detail: redactSensitiveText(card.detail) } : {}),
		...(card.parallelWorktreeOperation ? { parallelWorktreeOperation: card.parallelWorktreeOperation } : {}),
		...(card.parallelTaskId ? { parallelTaskId: redactSensitiveText(card.parallelTaskId) } : {}),
	};
}

function approvalBlockedReasons(card: ExternalApprovalCard, input: VibeCodexApprovalStatusInput): readonly string[] {
	return [
		card.blocked ? 'Approval request is blocked by safety policy.' : undefined,
		!modeAllowsAction(input.modePolicy, card.kind) ? `${input.modePolicy.label} Mode blocks ${card.kind} requests.` : undefined,
		requiresApprovalAuthorization(card) && !input.authorization ? 'Plan approval is required before accepting this request.' : undefined,
	].filter((value): value is string => !!value).map(redactSensitiveText);
}

function isApprovalStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return approvalStatusToolNames.has(tool);
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
