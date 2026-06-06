/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCommitHandoff } from './commitHandoff';
import type { VibeCodexDeliveryBarState } from './deliveryBar';
import type { VibeCodexSmokeBenchmarkState } from './smokeBenchmark';
import { redactSensitiveValue } from './secretFilters';

export type VibeCodexFinalReviewStatus = 'passed' | 'blocked' | 'pending';

export interface VibeCodexFinalReviewItem {
	readonly id: string;
	readonly title: string;
	readonly status: VibeCodexFinalReviewStatus;
	readonly required: boolean;
	readonly detail: string;
}

export interface VibeCodexFinalReviewState {
	readonly version: 1;
	readonly updatedAt: number;
	readonly ready: boolean;
	readonly blocked: boolean;
	readonly summary: string;
	readonly decision: 'pass' | 'block';
	readonly items: readonly VibeCodexFinalReviewItem[];
	readonly evidence: readonly string[];
	readonly nextAction: string;
}

export interface VibeCodexFinalReviewInput {
	readonly deliveryBar: VibeCodexDeliveryBarState;
	readonly smokeBenchmark: VibeCodexSmokeBenchmarkState;
	readonly commitHandoff: VibeCodexCommitHandoff;
}

export function createFinalReviewState(input: VibeCodexFinalReviewInput): VibeCodexFinalReviewState {
	const items = [
		deliveryItem(input.deliveryBar),
		smokeItem(input.smokeBenchmark),
		commitItem(input.commitHandoff),
		verificationItem(input.deliveryBar),
		diffItem(input.deliveryBar),
		rollbackItem(input.deliveryBar),
		parallelItem(input.deliveryBar),
	];
	const required = items.filter(item => item.required);
	const blocked = required.some(item => item.status === 'blocked');
	const ready = required.length > 0 && required.every(item => item.status === 'passed');
	const decision = ready ? 'pass' : 'block';
	return {
		version: 1,
		updatedAt: Date.now(),
		ready,
		blocked,
		decision,
		summary: finalReviewSummary(items, decision),
		items,
		evidence: finalReviewEvidence(input, items),
		nextAction: ready
			? 'Open Source Control or copy the prepared commit message for human merge/commit.'
			: 'Resolve blocked or pending final-review items before claiming delivery complete.',
	};
}

export function finalReviewPromptBlock(review: VibeCodexFinalReviewState): string {
	return JSON.stringify(redactSensitiveValue({
		version: review.version,
		decision: review.decision,
		ready: review.ready,
		blocked: review.blocked,
		summary: review.summary,
		items: review.items,
		evidence: review.evidence,
		nextAction: review.nextAction,
		note: 'Final review is the last delivery gate. Do not report task completion unless this decision is pass.',
	}), null, 2);
}

export function finalReviewSignature(review: VibeCodexFinalReviewState): string {
	return JSON.stringify({
		decision: review.decision,
		ready: review.ready,
		blocked: review.blocked,
		items: review.items.map(item => ({
			id: item.id,
			status: item.status,
			required: item.required,
			detail: item.detail,
		})),
		evidence: review.evidence,
		nextAction: review.nextAction,
	});
}

export function finalReviewSummary(items: readonly VibeCodexFinalReviewItem[], decision: 'pass' | 'block'): string {
	const passed = items.filter(item => item.status === 'passed').length;
	const pending = items.filter(item => item.status === 'pending').length;
	const blocked = items.filter(item => item.status === 'blocked').length;
	return decision === 'pass'
		? `Final review passed: ${passed} passed, ${pending} pending, ${blocked} blocked.`
		: `Final review blocked: ${passed} passed, ${pending} pending, ${blocked} blocked.`;
}

function deliveryItem(deliveryBar: VibeCodexDeliveryBarState): VibeCodexFinalReviewItem {
	return {
		id: 'delivery-bar',
		title: 'Delivery Bar',
		required: true,
		status: deliveryBar.ready ? 'passed' : deliveryBar.blocked ? 'blocked' : 'pending',
		detail: deliveryBar.summary,
	};
}

function smokeItem(smokeBenchmark: VibeCodexSmokeBenchmarkState): VibeCodexFinalReviewItem {
	const failed = smokeBenchmark.milestones.filter(milestone => milestone.required && milestone.status === 'failed');
	return {
		id: 'smoke-benchmark',
		title: 'End-to-end smoke benchmark',
		required: true,
		status: smokeBenchmark.ready ? 'passed' : failed.length ? 'blocked' : 'pending',
		detail: smokeBenchmark.summary,
	};
}

function commitItem(commitHandoff: VibeCodexCommitHandoff): VibeCodexFinalReviewItem {
	return {
		id: 'commit-handoff',
		title: 'Commit handoff',
		required: true,
		status: commitHandoff.ready ? 'passed' : commitHandoff.blockers.length ? 'blocked' : 'pending',
		detail: commitHandoff.summary,
	};
}

function verificationItem(deliveryBar: VibeCodexDeliveryBarState): VibeCodexFinalReviewItem {
	return checkItem(deliveryBar, 'verification', 'Verification evidence', true);
}

function diffItem(deliveryBar: VibeCodexDeliveryBarState): VibeCodexFinalReviewItem {
	return checkItem(deliveryBar, 'diff-review', 'Diff confirmation', true);
}

function rollbackItem(deliveryBar: VibeCodexDeliveryBarState): VibeCodexFinalReviewItem {
	return checkItem(deliveryBar, 'rollback', 'Rollback coverage', true);
}

function parallelItem(deliveryBar: VibeCodexDeliveryBarState): VibeCodexFinalReviewItem {
	return checkItem(deliveryBar, 'parallel', 'Parallel merge review', false);
}

function checkItem(deliveryBar: VibeCodexDeliveryBarState, id: string, title: string, requiredWhenPresent: boolean): VibeCodexFinalReviewItem {
	const check = deliveryBar.checks.find(candidate => candidate.id === id);
	const required = check ? check.required || requiredWhenPresent : requiredWhenPresent;
	return {
		id,
		title,
		required,
		status: check?.status === 'passed' || check?.status === 'skipped'
			? 'passed'
			: check?.status === 'failed'
				? 'blocked'
				: 'pending',
		detail: check?.detail ?? `${title} has not been produced yet.`,
	};
}

function finalReviewEvidence(input: VibeCodexFinalReviewInput, items: readonly VibeCodexFinalReviewItem[]): readonly string[] {
	const blocked = items.filter(item => item.status === 'blocked');
	const pending = items.filter(item => item.status === 'pending');
	return [
		input.deliveryBar.summary,
		input.smokeBenchmark.summary,
		input.commitHandoff.summary,
		input.commitHandoff.acceptedFiles.length ? `Accepted files: ${input.commitHandoff.acceptedFiles.join(', ')}` : 'Accepted files: none.',
		input.commitHandoff.evidence.join(' '),
		blocked.length ? `Blocked: ${blocked.map(item => item.title).join(', ')}` : undefined,
		pending.length ? `Pending: ${pending.map(item => item.title).join(', ')}` : undefined,
	].filter((value): value is string => !!value).slice(0, 12);
}
