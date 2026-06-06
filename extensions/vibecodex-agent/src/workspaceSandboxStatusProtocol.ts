/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExternalApprovalCard, ExternalDiffReview } from './executionProtocol';
import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { redactSensitiveText } from './secretFilters';
import type { ExternalPatchCheckpoint } from './workspacePatch';
import { ignoredByWorkspacePolicy, type VibeCodexWorkspaceIgnorePolicy } from './workspaceIgnore';

export type VibeCodexSandboxPathStatus = 'safe_relative' | 'safe_absolute' | 'ignored' | 'parent_traversal' | 'outside_workspace' | 'unsupported_scheme' | 'invalid';
export type VibeCodexSandboxPathSource = 'approval' | 'diff' | 'checkpoint' | 'sample';

export interface VibeCodexWorkspaceSandboxStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeRoots: boolean;
	readonly includeIgnorePolicy: boolean;
	readonly includePaths: boolean;
	readonly includeGuardrails: boolean;
	readonly maxPaths: number;
	readonly samplePaths: readonly string[];
	readonly requestedAt: number;
}

export interface VibeCodexSandboxPathCheck {
	readonly path: string;
	readonly source: VibeCodexSandboxPathSource;
	readonly status: VibeCodexSandboxPathStatus;
	readonly workspaceRelative: boolean;
	readonly ignored: boolean;
	readonly blocked: boolean;
	readonly reason?: string;
}

export interface VibeCodexWorkspaceSandboxStatusResponse {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly ready: boolean;
	readonly workspaceTrusted: boolean;
	readonly counts: {
		readonly workspaceRoots: number;
		readonly ignoreSources: number;
		readonly ignoreRules: number;
		readonly pendingApprovalPaths: number;
		readonly activeDiffPaths: number;
		readonly checkpointPaths: number;
		readonly samplePaths: number;
		readonly returnedPaths: number;
		readonly blockedPaths: number;
	};
	readonly roots?: readonly string[];
	readonly ignorePolicy?: {
		readonly sources: readonly string[];
		readonly rules: number;
		readonly negatedRules: number;
	};
	readonly guards: {
		readonly workspaceRootRequired: true;
		readonly rejectsParentTraversal: true;
		readonly rejectsUnsupportedSchemes: true;
		readonly rejectsIgnoredPaths: true;
		readonly symlinkTraversalCheckedOnMutation: true;
		readonly checkpointsBeforeWrites: true;
		readonly atomicDiffRollback: true;
	};
	readonly paths?: readonly VibeCodexSandboxPathCheck[];
	readonly blockers: readonly string[];
	readonly guardrails?: readonly string[];
	readonly message: string;
}

export interface VibeCodexWorkspaceSandboxStatusInput {
	readonly workspaceRoots: readonly string[];
	readonly workspaceTrusted: boolean;
	readonly ignorePolicy?: VibeCodexWorkspaceIgnorePolicy;
	readonly approvals: readonly ExternalApprovalCard[];
	readonly activeDiffReview?: ExternalDiffReview;
	readonly patchCheckpoints: readonly ExternalPatchCheckpoint[];
}

const workspaceSandboxStatusMethods = new Set([
	'agent/getWorkspaceSandboxStatus',
	'agent/workspaceSandboxStatus',
	'workspace/sandboxStatus',
	'sandbox/status',
	'filesystem/sandboxStatus',
	'vibecodex/workspaceSandboxStatus',
]);

const workspaceSandboxStatusToolNames = new Set([
	'workspace_sandbox_status',
	'sandbox_status',
	'path_sandbox_status',
	'filesystem_sandbox_status',
	'workspace_path_status',
	'path_policy_status',
]);

const defaultMaxPaths = 24;
const maxPathLimit = 80;

export function normalizeWorkspaceSandboxStatusRequest(message: JsonRpcMessage): VibeCodexWorkspaceSandboxStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!workspaceSandboxStatusMethods.has(message.method) && !isWorkspaceSandboxStatusToolCall(message.method, payload, args)) {
		return undefined;
	}
	return {
		id: message.id,
		method: message.method,
		includeRoots: booleanValue(payload.includeRoots)
			?? booleanValue(payload.include_roots)
			?? booleanValue(args.includeRoots)
			?? booleanValue(args.include_roots)
			?? true,
		includeIgnorePolicy: booleanValue(payload.includeIgnorePolicy)
			?? booleanValue(payload.include_ignore_policy)
			?? booleanValue(args.includeIgnorePolicy)
			?? booleanValue(args.include_ignore_policy)
			?? true,
		includePaths: booleanValue(payload.includePaths)
			?? booleanValue(payload.include_paths)
			?? booleanValue(args.includePaths)
			?? booleanValue(args.include_paths)
			?? true,
		includeGuardrails: booleanValue(payload.includeGuardrails)
			?? booleanValue(payload.include_guardrails)
			?? booleanValue(args.includeGuardrails)
			?? booleanValue(args.include_guardrails)
			?? true,
		maxPaths: clampNumber(
			numberValue(payload.maxPaths)
				?? numberValue(payload.max_paths)
				?? numberValue(args.maxPaths)
				?? numberValue(args.max_paths)
				?? defaultMaxPaths,
			1,
			maxPathLimit,
		),
		samplePaths: stringArray(payload.samplePaths)
			?? stringArray(payload.sample_paths)
			?? stringArray(args.samplePaths)
			?? stringArray(args.sample_paths)
			?? [],
		requestedAt: Date.now(),
	};
}

export function createWorkspaceSandboxStatusResponse(request: VibeCodexWorkspaceSandboxStatusRequest, input: VibeCodexWorkspaceSandboxStatusInput): VibeCodexWorkspaceSandboxStatusResponse {
	const roots = input.workspaceRoots.map(root => redactSensitiveText(normalizePath(root)));
	const allPathChecks = sandboxPathChecks(request, input);
	const returnedPaths = allPathChecks.slice(0, request.maxPaths);
	const blockers = sandboxBlockers(input, allPathChecks);
	const ignoreSources = input.ignorePolicy?.sources ?? [];
	const ignoreRules = input.ignorePolicy?.rules ?? [];
	return {
		ok: true,
		source: 'externalExtension',
		ready: blockers.length === 0,
		workspaceTrusted: input.workspaceTrusted,
		counts: {
			workspaceRoots: input.workspaceRoots.length,
			ignoreSources: ignoreSources.length,
			ignoreRules: ignoreRules.length,
			pendingApprovalPaths: input.approvals.reduce((sum, approval) => sum + approval.paths.length, 0),
			activeDiffPaths: input.activeDiffReview?.files.length ?? 0,
			checkpointPaths: input.patchCheckpoints.length,
			samplePaths: request.samplePaths.length,
			returnedPaths: request.includePaths ? returnedPaths.length : 0,
			blockedPaths: allPathChecks.filter(path => path.blocked).length,
		},
		...(request.includeRoots ? { roots } : {}),
		...(request.includeIgnorePolicy ? {
			ignorePolicy: {
				sources: ignoreSources.map(source => redactSensitiveText(source)),
				rules: ignoreRules.length,
				negatedRules: ignoreRules.filter(rule => rule.negated).length,
			},
		} : {}),
		guards: {
			workspaceRootRequired: true,
			rejectsParentTraversal: true,
			rejectsUnsupportedSchemes: true,
			rejectsIgnoredPaths: true,
			symlinkTraversalCheckedOnMutation: true,
			checkpointsBeforeWrites: true,
			atomicDiffRollback: true,
		},
		...(request.includePaths ? { paths: returnedPaths } : {}),
		blockers,
		...(request.includeGuardrails ? { guardrails: workspaceSandboxGuardrails } : {}),
		message: blockers.length
			? `Workspace sandbox has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}; ${allPathChecks.filter(path => path.blocked).length} blocked path${allPathChecks.filter(path => path.blocked).length === 1 ? '' : 's'}.`
			: `Workspace sandbox ready with ${input.workspaceRoots.length} root${input.workspaceRoots.length === 1 ? '' : 's'}, ${ignoreRules.length} ignore rule${ignoreRules.length === 1 ? '' : 's'}, and ${allPathChecks.length} checked path${allPathChecks.length === 1 ? '' : 's'}.`,
	};
}

export function workspaceSandboxStatusSummary(response: VibeCodexWorkspaceSandboxStatusResponse): string {
	return `${response.ready ? 'Ready' : 'Blocked'} workspace sandbox; ${response.counts.workspaceRoots} roots; ${response.counts.ignoreRules} ignore rules; ${response.counts.blockedPaths} blocked paths.`;
}

const workspaceSandboxGuardrails = [
	'Workspace sandbox status is read-only and never resolves symlinks, writes files, deletes files, restores checkpoints, stages commits, runs terminal commands, changes trust, changes ignore policy, approves plans, or mutates workspace state.',
	'Accepted workspace writes still require exact visual-plan authorization, developer diff acceptance, workspace-root resolution, ignore-policy checks, symlink traversal checks, and checkpoints at mutation time.',
	'Paths, roots, ignore sources, and blockers are redacted before they are returned to the backend.',
	'Use diff_validate, command_validate, approval_status, checkpoint_status, and workflow_status for deeper read-only readiness before requesting mutation.',
];

function sandboxPathChecks(request: VibeCodexWorkspaceSandboxStatusRequest, input: VibeCodexWorkspaceSandboxStatusInput): readonly VibeCodexSandboxPathCheck[] {
	const entries: { readonly path: string; readonly source: VibeCodexSandboxPathSource }[] = [
		...request.samplePaths.map(path => ({ path, source: 'sample' as const })),
		...input.approvals.flatMap(approval => approval.paths.map(path => ({ path, source: 'approval' as const }))),
		...(input.activeDiffReview?.files.map(file => ({ path: file.path, source: 'diff' as const })) ?? []),
		...input.patchCheckpoints.map(checkpoint => ({ path: checkpoint.path, source: 'checkpoint' as const })),
	];
	const seen = new Set<string>();
	const result: VibeCodexSandboxPathCheck[] = [];
	for (const entry of entries) {
		const key = `${entry.source}:${entry.path}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(checkPath(entry.path, entry.source, input.workspaceRoots, input.ignorePolicy));
	}
	return result;
}

function checkPath(rawPath: string, source: VibeCodexSandboxPathSource, roots: readonly string[], ignorePolicy: VibeCodexWorkspaceIgnorePolicy | undefined): VibeCodexSandboxPathCheck {
	const normalized = normalizePath(rawPath);
	const invalid = !normalized || /[\u0000\r\n]/.test(rawPath);
	const unsupportedScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) && !normalized.toLowerCase().startsWith('file:');
	const absolute = isAbsolutePath(normalized);
	const relativePart = relativePathForIgnore(normalized, roots);
	const parentTraversal = hasParentTraversal(relativePart ?? normalized);
	const ignoredBy = relativePart && !parentTraversal ? ignoredByWorkspacePolicy(relativePart, ignorePolicy) : undefined;
	const insideAbsoluteRoot = absolute ? absoluteWithinRoot(normalized, roots) : true;
	const status: VibeCodexSandboxPathStatus = invalid
		? 'invalid'
		: unsupportedScheme
			? 'unsupported_scheme'
			: parentTraversal
				? 'parent_traversal'
				: ignoredBy
					? 'ignored'
					: absolute && !insideAbsoluteRoot
						? 'outside_workspace'
						: absolute
							? 'safe_absolute'
							: 'safe_relative';
	const blocked = status !== 'safe_relative' && status !== 'safe_absolute';
	return {
		path: redactSensitiveText(normalized),
		source,
		status,
		workspaceRelative: !absolute && status !== 'unsupported_scheme',
		ignored: !!ignoredBy,
		blocked,
		...(blocked ? { reason: blockedPathReason(status, ignoredBy) } : {}),
	};
}

function sandboxBlockers(input: VibeCodexWorkspaceSandboxStatusInput, paths: readonly VibeCodexSandboxPathCheck[]): readonly string[] {
	const blockers: string[] = [];
	if (!input.workspaceRoots.length) {
		blockers.push('No workspace root is open; file tools and workspace-rooted terminal cwd cannot be proven sandboxed.');
	}
	if (!input.workspaceTrusted) {
		blockers.push('Workspace is not trusted; git checkpoints, parallel worktrees, and automation gates remain restricted.');
	}
	for (const path of paths.filter(path => path.blocked).slice(0, 8)) {
		blockers.push(`${path.source} path ${path.path} blocked: ${path.reason ?? path.status}.`);
	}
	return blockers;
}

function blockedPathReason(status: VibeCodexSandboxPathStatus, ignoredBy: string | undefined): string {
	switch (status) {
		case 'invalid':
			return 'Path is empty or contains control characters.';
		case 'unsupported_scheme':
			return 'Path uses an unsupported URI scheme.';
		case 'parent_traversal':
			return 'Path contains parent-directory traversal.';
		case 'ignored':
			return `Path is ignored by ${redactSensitiveText(ignoredBy ?? 'workspace ignore policy')}.`;
		case 'outside_workspace':
			return 'Absolute path is outside the active workspace roots.';
		default:
			return status;
	}
}

function relativePathForIgnore(path: string, roots: readonly string[]): string | undefined {
	if (path.toLowerCase().startsWith('file:')) {
		const decoded = decodeFilePath(path);
		return absoluteRelative(decoded, roots);
	}
	if (isAbsolutePath(path)) {
		return absoluteRelative(path, roots);
	}
	return normalizeRelative(path);
}

function absoluteRelative(path: string, roots: readonly string[]): string | undefined {
	const normalized = normalizePath(path).toLowerCase();
	for (const root of roots) {
		const rootPath = normalizePath(root).toLowerCase().replace(/\/+$/, '');
		const prefix = `${rootPath}/`;
		if (normalized === rootPath) {
			return '.';
		}
		if (normalized.startsWith(prefix)) {
			return normalizeRelative(path.slice(prefix.length));
		}
	}
	return undefined;
}

function absoluteWithinRoot(path: string, roots: readonly string[]): boolean {
	if (!roots.length) {
		return false;
	}
	return absoluteRelative(path.toLowerCase().startsWith('file:') ? decodeFilePath(path) : path, roots) !== undefined;
}

function decodeFilePath(path: string): string {
	const withoutScheme = path.replace(/^file:\/\//i, '');
	const withoutHost = withoutScheme.startsWith('/') ? withoutScheme : withoutScheme.replace(/^[^/]+/, '');
	try {
		return decodeURIComponent(withoutHost);
	} catch {
		return withoutHost;
	}
}

function hasParentTraversal(path: string): boolean {
	return normalizeRelative(path).split('/').includes('..');
}

function normalizePath(path: string): string {
	return path.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

function normalizeRelative(path: string): string {
	return normalizePath(path).replace(/^\/+/, '').replace(/\/+$/, '');
}

function isAbsolutePath(path: string): boolean {
	return path.startsWith('/') || /^[A-Za-z]:\//.test(path) || path.toLowerCase().startsWith('file:');
}

function isWorkspaceSandboxStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return workspaceSandboxStatusToolNames.has(tool);
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

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function stringArray(value: unknown): readonly string[] | undefined {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, maxPathLimit);
	}
	if (typeof value === 'string' && value.trim()) {
		return value.split(',').map(item => item.trim()).filter(Boolean).slice(0, maxPathLimit);
	}
	return undefined;
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
