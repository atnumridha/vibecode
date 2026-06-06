/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexBrowserActionRequest } from './browserActionProtocol';
import type { ExternalApprovalCard } from './executionProtocol';
import type { VibeCodexMcpActionRequest } from './mcpActionProtocol';
import { renderedPlanIdentity, type VibeCodexPlan } from './planProtocol';
import type { VibeCodexWebFetchRequest } from './webFetchProtocol';

export interface VibeCodexExecutionAuthorization {
	readonly taskId: string;
	readonly revision: number;
	readonly planHash: string;
	readonly approvalToken: string;
	readonly approvedAt: number;
}

export function createExecutionAuthorization(plan: VibeCodexPlan): VibeCodexExecutionAuthorization {
	const identity = renderedPlanIdentity(plan);
	return {
		taskId: identity.taskId,
		revision: identity.revision,
		planHash: identity.planHash,
		approvalToken: `vibecodex-plan:${plan.taskId}:r${plan.revision}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`,
		approvedAt: Date.now(),
	};
}

export function executionAuthorizationSummary(authorization: VibeCodexExecutionAuthorization | undefined): string {
	return authorization ? `${authorization.taskId} r${authorization.revision} ${authorization.planHash}` : 'no approved plan revision';
}

export function authorizationMatchesPlan(authorization: VibeCodexExecutionAuthorization | undefined, plan: VibeCodexPlan | undefined): boolean {
	if (!authorization || !plan) {
		return false;
	}
	const identity = renderedPlanIdentity(plan);
	return authorization.taskId === identity.taskId && authorization.revision === identity.revision && authorization.planHash === identity.planHash;
}

export function requiresApprovalAuthorization(card: ExternalApprovalCard): boolean {
	return card.kind === 'terminal' || card.kind === 'file' || card.kind === 'tool' || card.kind === 'generic';
}

export function requiresBrowserAuthorization(action: VibeCodexBrowserActionRequest): boolean {
	return action.supported;
}

export function requiresMcpAuthorization(action: VibeCodexMcpActionRequest): boolean {
	return !action.blocked;
}

export function requiresWebFetchAuthorization(action: VibeCodexWebFetchRequest): boolean {
	return action.supported && !action.blocked;
}

export function attachExecutionAuthorization<T>(response: T, authorization: VibeCodexExecutionAuthorization | undefined, approved: boolean): T {
	if (!approved || !authorization || typeof response !== 'object' || response === null) {
		return response;
	}
	return {
		...(response as Record<string, unknown>),
		approvedTaskId: authorization.taskId,
		approvedRevision: authorization.revision,
		approvedPlanHash: authorization.planHash,
		approvalToken: authorization.approvalToken,
		approvedAt: authorization.approvedAt,
	} as T;
}
