/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VibeCodexCommandPermissionDecision, VibeCodexCommandPermissionPolicy, evaluateCommandPermission, isDangerousCommand, normalizeCommandPermissionPolicy } from './commandPermissions';
import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import { VibeCodexModePolicy, modeAllowsAction, modePolicyFor } from './modePolicy';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexTerminalCommandKind = 'test' | 'lint' | 'typecheck' | 'build' | 'install' | 'devServer' | 'git' | 'package' | 'network' | 'unknown';
export type VibeCodexTerminalCommandRisk = 'low' | 'medium' | 'high' | 'blocked';
export type VibeCodexTerminalCwdSafetyState = 'workspace_root' | 'safe_relative' | 'safe_absolute' | 'needs_workspace_check' | 'blocked';

export interface VibeCodexTerminalCommandValidationRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly commandLine?: string;
	readonly commandPresent: boolean;
	readonly cwd?: string;
	readonly reason?: string;
	readonly verificationCheckId?: string;
	readonly includeCommand: boolean;
	readonly includeRepairHints: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexTerminalCommandClassification {
	readonly kind: VibeCodexTerminalCommandKind;
	readonly verificationLikely: boolean;
	readonly longRunningLikely: boolean;
	readonly networkLikely: boolean;
	readonly writesWorkspaceLikely: boolean;
}

export interface VibeCodexTerminalCwdSafety {
	readonly state: VibeCodexTerminalCwdSafetyState;
	readonly safe: boolean;
	readonly workspaceRooted: boolean;
	readonly cwd?: string;
	readonly effectiveCwd?: string;
	readonly warnings: readonly string[];
	readonly errors: readonly string[];
}

export interface VibeCodexTerminalCommandValidationResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly candidatePresent: boolean;
	readonly valid: boolean;
	readonly approvalReady: boolean;
	readonly executionReady: boolean;
	readonly blocked: boolean;
	readonly risk: VibeCodexTerminalCommandRisk;
	readonly commandLine?: string;
	readonly cwd?: string;
	readonly reason?: string;
	readonly verificationCheckId?: string;
	readonly classification: VibeCodexTerminalCommandClassification;
	readonly policy: VibeCodexCommandPermissionDecision & {
		readonly dangerous: boolean;
	};
	readonly mode: {
		readonly mode: string;
		readonly label: string;
		readonly terminalAllowed: boolean;
		readonly blockReason?: string;
	};
	readonly authorization: {
		readonly hasExecutionAuthorization: boolean;
		readonly requiredBeforeRun: boolean;
		readonly blocksExecution: boolean;
	};
	readonly workspace: {
		readonly trusted: boolean;
		readonly roots: readonly string[];
		readonly cwdSafety: VibeCodexTerminalCwdSafety;
		readonly warnings: readonly string[];
	};
	readonly verification: {
		readonly requested: boolean;
		readonly checkId?: string;
		readonly known?: boolean;
		readonly warning?: string;
	};
	readonly validationErrors: readonly string[];
	readonly warnings: readonly string[];
	readonly repairHints?: readonly string[];
	readonly promptBlock: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexTerminalCommandValidationInput {
	readonly modePolicy?: VibeCodexModePolicy;
	readonly commandPermissionPolicy?: VibeCodexCommandPermissionPolicy;
	readonly hasExecutionAuthorization?: boolean;
	readonly workspaceTrusted?: boolean;
	readonly workspaceRoots?: readonly string[];
	readonly verificationCheckIds?: readonly string[];
}

const terminalCommandValidationMethods = new Set([
	'agent/validateCommand',
	'agent/commandValidation',
	'command/validate',
	'terminal/validate',
	'terminal/commandValidation',
	'vibecodex/validateCommand',
]);

const terminalCommandValidationToolNames = new Set([
	'command_validate',
	'validate_command',
	'terminal_validate',
	'terminal_command_validate',
	'shell_validate',
]);

const maxCommandLength = 12000;

export function normalizeTerminalCommandValidationRequest(message: JsonRpcMessage): VibeCodexTerminalCommandValidationRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const directParams = parseMaybeJson(message.params);
	const payload = isRecord(directParams) ? directParams : {};
	const args = argumentRecord(payload);
	if (!terminalCommandValidationMethods.has(message.method) && !isTerminalCommandValidationToolCall(message.method, payload, args)) {
		return undefined;
	}
	const commandLine = extractCommandLine(directParams, payload, args);
	const cwd = stringValue(payload.cwd)
		?? stringValue(payload.workingDirectory)
		?? stringValue(payload.working_directory)
		?? stringValue(args.cwd)
		?? stringValue(args.workingDirectory)
		?? stringValue(args.working_directory);
	const reason = stringValue(payload.reason)
		?? stringValue(payload.description)
		?? stringValue(args.reason)
		?? stringValue(args.description);
	const verificationCheckId = stringValue(payload.verificationCheckId)
		?? stringValue(payload.verification_check_id)
		?? stringValue(args.verificationCheckId)
		?? stringValue(args.verification_check_id);
	return {
		id: message.id,
		method: message.method,
		...(commandLine !== undefined ? { commandLine } : {}),
		commandPresent: commandLine !== undefined,
		...(cwd ? { cwd } : {}),
		...(reason ? { reason } : {}),
		...(verificationCheckId ? { verificationCheckId } : {}),
		includeCommand: booleanValue(payload.includeCommand)
			?? booleanValue(payload.include_command)
			?? booleanValue(args.includeCommand)
			?? booleanValue(args.include_command)
			?? true,
		includeRepairHints: booleanValue(payload.includeRepairHints)
			?? booleanValue(payload.include_repair_hints)
			?? booleanValue(args.includeRepairHints)
			?? booleanValue(args.include_repair_hints)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createTerminalCommandValidationResponse(request: VibeCodexTerminalCommandValidationRequest, input: VibeCodexTerminalCommandValidationInput = {}): VibeCodexTerminalCommandValidationResponse {
	const modePolicy = input.modePolicy ?? modePolicyFor('agent');
	const commandPermissionPolicy = input.commandPermissionPolicy ?? normalizeCommandPermissionPolicy();
	const workspaceRoots = sanitizeRoots(input.workspaceRoots ?? []);
	const commandLine = request.commandLine?.trim() ?? '';
	const classification = classifyTerminalCommand(commandLine);
	const cwdSafety = validateCwd(request.cwd, workspaceRoots);
	const validationErrors = [
		...(!request.commandPresent ? ['No terminal command candidate was provided.'] : []),
		...(request.commandPresent && !commandLine ? ['Terminal command candidate must be a non-empty string.'] : []),
		...(commandLine.length > maxCommandLength ? [`Terminal command exceeds ${maxCommandLength} characters.`] : []),
		...(/[\u0000\r\n]/.test(commandLine) ? ['Terminal command must be a single line without NUL or newline characters.'] : []),
		...cwdSafety.errors,
	];
	const dangerous = !!commandLine && isDangerousCommand(commandLine);
	const policy = commandLine
		? evaluateCommandPermission(commandLine, commandPermissionPolicy)
		: { allowed: false, blocked: true, reason: 'Empty terminal command is blocked.' };
	const terminalAllowed = modeAllowsAction(modePolicy, 'terminal');
	const modeBlockReason = terminalAllowed ? undefined : `${modePolicy.label} Mode blocks terminal tools.`;
	const authorizationRequired = modePolicy.requiresPlanApproval;
	const hasExecutionAuthorization = input.hasExecutionAuthorization ?? false;
	const authorizationBlocksExecution = authorizationRequired && !hasExecutionAuthorization;
	const verification = verificationStatus(request.verificationCheckId, input.verificationCheckIds);
	const warnings = [
		...cwdSafety.warnings,
		...(verification.warning ? [verification.warning] : []),
		...(classification.networkLikely ? ['Command appears to use network or package installation; require explicit user review before execution.'] : []),
		...(classification.longRunningLikely ? ['Command may be long-running; terminal output streaming and interrupt/retry controls should remain visible.'] : []),
		...(authorizationBlocksExecution ? ['The command can be reviewed, but execution remains locked until the exact visual plan revision is approved.'] : []),
	];
	const valid = request.commandPresent
		&& !!commandLine
		&& validationErrors.length === 0
		&& !dangerous
		&& !policy.blocked
		&& cwdSafety.safe;
	const approvalReady = valid && terminalAllowed;
	const executionReady = approvalReady && !authorizationBlocksExecution;
	const risk = terminalCommandRisk(valid, approvalReady, policy, classification);
	const repairHints = request.includeRepairHints
		? createRepairHints(validationErrors, warnings, policy, terminalAllowed, authorizationBlocksExecution, classification, cwdSafety, request.commandPresent)
		: undefined;
	const responseWithoutPrompt = {
		ok: request.commandPresent,
		source: 'externalExtension' as const,
		candidatePresent: request.commandPresent,
		valid,
		approvalReady,
		executionReady,
		blocked: !executionReady,
		risk,
		...(request.includeCommand && commandLine ? { commandLine: redactSensitiveText(commandLine) } : {}),
		...(request.cwd ? { cwd: redactSensitiveText(request.cwd) } : {}),
		...(request.reason ? { reason: redactSensitiveText(request.reason) } : {}),
		...(request.verificationCheckId ? { verificationCheckId: redactSensitiveText(request.verificationCheckId) } : {}),
		classification,
		policy: {
			...policy,
			reason: redactSensitiveText(policy.reason),
			...(policy.matchedRule ? { matchedRule: redactSensitiveText(policy.matchedRule) } : {}),
			dangerous,
		},
		mode: {
			mode: modePolicy.mode,
			label: modePolicy.label,
			terminalAllowed,
			...(modeBlockReason ? { blockReason: modeBlockReason } : {}),
		},
		authorization: {
			hasExecutionAuthorization,
			requiredBeforeRun: authorizationRequired,
			blocksExecution: authorizationBlocksExecution,
		},
		workspace: {
			trusted: input.workspaceTrusted ?? true,
			roots: workspaceRoots.map(redactSensitiveText),
			cwdSafety: redactCwdSafety(cwdSafety),
			warnings: cwdSafety.warnings,
		},
		verification,
		validationErrors,
		warnings,
		...(repairHints ? { repairHints } : {}),
		guardrails: terminalCommandValidationGuardrails,
		message: terminalCommandValidationMessage(valid, approvalReady, executionReady, request.commandPresent, modeBlockReason, authorizationBlocksExecution, policy, classification, validationErrors, warnings),
	};
	return {
		...responseWithoutPrompt,
		promptBlock: JSON.stringify(redactSensitiveValue({
			type: 'vibecodex.terminalCommandValidation',
			valid: responseWithoutPrompt.valid,
			approvalReady: responseWithoutPrompt.approvalReady,
			executionReady: responseWithoutPrompt.executionReady,
			risk: responseWithoutPrompt.risk,
			classification: responseWithoutPrompt.classification,
			policy: responseWithoutPrompt.policy,
			mode: responseWithoutPrompt.mode,
			authorization: responseWithoutPrompt.authorization,
			workspace: responseWithoutPrompt.workspace,
			verification: responseWithoutPrompt.verification,
			validationErrors: responseWithoutPrompt.validationErrors,
			warnings: responseWithoutPrompt.warnings,
			repairHints: responseWithoutPrompt.repairHints,
			note: 'Repair or reclassify unsafe commands, then request terminal approval through the normal execute_command/terminal run path. This validation result is not a terminal approval, execution authorization, or command output request.',
		}), null, 2),
	};
}

export function terminalCommandValidationSummary(response: VibeCodexTerminalCommandValidationResponse): string {
	return response.message;
}

const terminalCommandValidationGuardrails = [
	'Terminal command validation is read-only and never creates approval cards, starts terminals, interrupts/retries runs, changes verification checks, approves plans, mutates files, or unlocks execution.',
	'Approval readiness only means the command can be shown for developer review under the current Mode Policy; execution still requires exact visual-plan authorization, command permissions, visible terminal approval, and workspace cwd sandboxing.',
	'Commands, cwd values, permission rules, and repair diagnostics are redacted before they are returned to the backend or shown in protocol diagnostics.',
];

function classifyTerminalCommand(commandLine: string): VibeCodexTerminalCommandClassification {
	const command = normalizeCommand(commandLine);
	const install = /\b(?:npm\s+(?:install|i|add)|pnpm\s+(?:install|add)|yarn\s+(?:install|add)|bun\s+(?:install|add)|pip(?:x)?\s+install|poetry\s+add|cargo\s+install|gem\s+install|go\s+install)\b/.test(command);
	const network = install || /\b(?:curl|wget|fetch|httpie|http|gh\s+api)\b/.test(command);
	const test = /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|test:[\w:-]+)\b/.test(command)
		|| /\b(?:pytest|vitest|jest|mocha|cargo\s+test|go\s+test|mvn\s+test|gradle\s+test|rspec|dotnet\s+test)\b/.test(command);
	const lint = /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:lint|lint:[\w:-]+)\b/.test(command)
		|| /\b(?:eslint|ruff\s+check|flake8|golangci-lint|rubocop|clippy)\b/.test(command);
	const typecheck = /\b(?:tsc|vue-tsc|mypy|pyright|basedpyright|sorbet|flow|dotnet\s+build)\b/.test(command)
		|| /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:typecheck|type-check|check:types)\b/.test(command);
	const build = /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|compile|package)\b/.test(command)
		|| /\b(?:cargo\s+build|go\s+build|mvn\s+package|gradle\s+build|make(?:\s|$)|cmake)\b/.test(command);
	const devServer = /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|preview)\b/.test(command)
		|| /\b(?:vite|next\s+dev|webpack\s+serve|rails\s+server|python\s+-m\s+http\.server)\b/.test(command);
	const git = /^git(?:\s|$)/.test(command);
	const packageCommand = /^(?:npm|pnpm|yarn|bun)(?:\s|$)/.test(command);
	const writesWorkspace = install
		|| build
		|| /\b(?:touch|mkdir|cp|mv|rm|sed\s+-i|perl\s+-pi|tee|patch|git\s+(?:checkout|switch|merge|rebase|reset|clean|apply|commit|push|pull|stash))\b/.test(command)
		|| /(?:^|\s)>/.test(command);
	const kind: VibeCodexTerminalCommandKind = install ? 'install'
		: network ? 'network'
			: test ? 'test'
				: lint ? 'lint'
					: typecheck ? 'typecheck'
						: build ? 'build'
							: devServer ? 'devServer'
								: git ? 'git'
									: packageCommand ? 'package'
										: 'unknown';
	return {
		kind,
		verificationLikely: test || lint || typecheck || build,
		longRunningLikely: devServer || /\b(?:--watch|-w|watch)\b/.test(command),
		networkLikely: network,
		writesWorkspaceLikely: writesWorkspace,
	};
}

function validateCwd(cwd: string | undefined, workspaceRoots: readonly string[]): VibeCodexTerminalCwdSafety {
	if (!cwd?.trim()) {
		const root = workspaceRoots[0];
		return {
			state: 'workspace_root',
			safe: true,
			workspaceRooted: !!root,
			...(root ? { effectiveCwd: root } : {}),
			warnings: root ? [] : ['No workspace root is open; terminal cwd defaults cannot be confirmed workspace-rooted.'],
			errors: [],
		};
	}
	const raw = cwd.trim();
	const warnings: string[] = [];
	const errors: string[] = [];
	if (/[\u0000\r\n]/.test(raw)) {
		errors.push('Terminal cwd must not contain NUL or newline characters.');
	}
	const filePath = fileUriToPath(raw);
	if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !filePath) {
		errors.push('Terminal cwd must be a workspace-relative path, absolute file path, or file:// URI.');
	}
	const candidate = normalizeFsPath(filePath ?? raw);
	if (!candidate) {
		errors.push('Terminal cwd could not be normalized.');
	}
	if (/^~(?:\/|$)/.test(raw)) {
		warnings.push('Terminal cwd uses ~; prefer an explicit workspace-relative folder.');
	}
	if (hasParentTraversal(candidate)) {
		errors.push('Terminal cwd must not use parent-directory traversal.');
	}
	const absolute = isAbsolutePath(candidate);
	const rooted = absolute ? workspaceRoots.some(root => isPathWithin(candidate, root)) : !hasParentTraversal(candidate);
	if (absolute && workspaceRoots.length && !rooted) {
		errors.push('Terminal cwd resolves outside the active workspace roots.');
	}
	const state: VibeCodexTerminalCwdSafetyState = errors.length ? 'blocked'
		: absolute && workspaceRoots.length ? 'safe_absolute'
			: absolute ? 'needs_workspace_check'
				: 'safe_relative';
	if (state === 'needs_workspace_check') {
		warnings.push('Absolute terminal cwd was provided without an open workspace root; verify it manually before requesting execution.');
	}
	return {
		state,
		safe: errors.length === 0,
		workspaceRooted: rooted,
		cwd: raw,
		effectiveCwd: absolute ? candidate : `${workspaceRoots[0] ?? '<workspace>'}/${candidate}`,
		warnings,
		errors,
	};
}

function verificationStatus(checkId: string | undefined, knownCheckIds: readonly string[] | undefined): VibeCodexTerminalCommandValidationResponse['verification'] {
	if (!checkId) {
		return { requested: false };
	}
	const known = knownCheckIds ? knownCheckIds.includes(checkId) : undefined;
	return {
		requested: true,
		checkId: redactSensitiveText(checkId),
		...(known !== undefined ? { known } : {}),
		...(known === false ? { warning: `Verification check ${checkId} is not in the current verification plan.` } : {}),
	};
}

function terminalCommandRisk(valid: boolean, approvalReady: boolean, policy: VibeCodexCommandPermissionDecision, classification: VibeCodexTerminalCommandClassification): VibeCodexTerminalCommandRisk {
	if (!valid || !approvalReady || policy.blocked) {
		return 'blocked';
	}
	if (classification.networkLikely || classification.kind === 'install' || classification.writesWorkspaceLikely) {
		return 'high';
	}
	if (classification.longRunningLikely || classification.kind === 'build' || classification.kind === 'git' || classification.kind === 'package') {
		return 'medium';
	}
	return 'low';
}

function createRepairHints(validationErrors: readonly string[], warnings: readonly string[], policy: VibeCodexCommandPermissionDecision, terminalAllowed: boolean, authorizationBlocksExecution: boolean, classification: VibeCodexTerminalCommandClassification, cwdSafety: VibeCodexTerminalCwdSafety, candidatePresent: boolean): readonly string[] {
	const hints: string[] = [];
	if (!candidatePresent || validationErrors.some(error => error.includes('non-empty') || error.includes('No terminal command'))) {
		hints.push('Provide a single command string in command, cmd, commandLine, or shellCommand.');
	}
	if (validationErrors.some(error => error.includes('single line'))) {
		hints.push('Split multi-line shell scripts into explicit reviewed steps, or wrap them in a workspace script file proposed through diff review.');
	}
	if (validationErrors.some(error => error.includes('outside the active workspace') || error.includes('parent-directory traversal')) || cwdSafety.state === 'blocked') {
		hints.push('Use a workspace-relative cwd and avoid absolute paths outside the active workspace roots.');
	}
	if (policy.blocked) {
		hints.push(`Choose a command allowed by the client command permission policy, or ask the developer to update allow/deny settings. Current block: ${policy.reason}`);
	}
	if (!terminalAllowed) {
		hints.push('Switch to Act, Agent, Debug, or Custom mode after submitting the visual plan; Plan/Ask/Manual/Review modes are read-only.');
	}
	if (authorizationBlocksExecution) {
		hints.push('Submit or repair the visual plan, then wait for the developer to approve the exact rendered revision before requesting execution.');
	}
	if (classification.networkLikely) {
		hints.push('For install or network-sensitive commands, include the package/source reason and prefer project-local lockfile-aware commands.');
	}
	if (warnings.some(warning => warning.includes('long-running'))) {
		hints.push('For dev servers or watch commands, mark the command as long-running and rely on terminal interrupt/retry controls.');
	}
	return [...new Set(hints)].slice(0, 10).map(redactSensitiveText);
}

function terminalCommandValidationMessage(valid: boolean, approvalReady: boolean, executionReady: boolean, candidatePresent: boolean, modeBlockReason: string | undefined, authorizationBlocksExecution: boolean, policy: VibeCodexCommandPermissionDecision, classification: VibeCodexTerminalCommandClassification, validationErrors: readonly string[], warnings: readonly string[]): string {
	if (!candidatePresent) {
		return 'No terminal command candidate was provided.';
	}
	if (!valid) {
		const reason = validationErrors[0] ?? (policy.blocked ? policy.reason : 'Command candidate is not valid for terminal approval.');
		return `Terminal command candidate is blocked: ${redactSensitiveText(reason)}`;
	}
	if (!approvalReady) {
		return `Terminal command candidate is valid, but cannot be approved now: ${modeBlockReason ?? 'terminal approval is unavailable in the current client state'}`;
	}
	if (!executionReady && authorizationBlocksExecution) {
		return `Terminal command candidate is approval-ready as ${classification.kind}, but execution remains locked until the exact visual plan revision is approved.`;
	}
	const suffix = warnings.length ? ` ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.` : '';
	return `Terminal command candidate is ready for approval and execution as ${classification.kind}.${suffix}`;
}

function extractCommandLine(directParams: unknown, payload: Record<string, unknown>, args: Record<string, unknown>): string | undefined {
	if (typeof directParams === 'string') {
		return directParams;
	}
	const direct = stringValue(payload.command)
		?? stringValue(payload.cmd)
		?? stringValue(payload.commandLine)
		?? stringValue(payload.command_line)
		?? stringValue(payload.shellCommand)
		?? stringValue(payload.shell_command)
		?? stringValue(args.command)
		?? stringValue(args.cmd)
		?? stringValue(args.commandLine)
		?? stringValue(args.command_line)
		?? stringValue(args.shellCommand)
		?? stringValue(args.shell_command);
	if (direct) {
		return direct;
	}
	const commands = arrayOfStrings(payload.commands) ?? arrayOfStrings(args.commands);
	return commands?.length ? commands.join(' && ') : undefined;
}

function isTerminalCommandValidationToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? method).toLowerCase();
	return terminalCommandValidationToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input;
	if (typeof args === 'string') {
		const parsed = parseMaybeJson(args);
		return isRecord(parsed) ? parsed : {};
	}
	return isRecord(args) ? args : {};
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		if (/^(true|1|yes)$/i.test(value.trim())) {
			return true;
		}
		if (/^(false|0|no)$/i.test(value.trim())) {
			return false;
		}
	}
	return undefined;
}

function arrayOfStrings(value: unknown): readonly string[] | undefined {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function normalizeCommand(commandLine: string): string {
	return commandLine.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sanitizeRoots(roots: readonly string[]): readonly string[] {
	return roots.map(root => normalizeFsPath(root)).filter((root): root is string => !!root);
}

function fileUriToPath(value: string): string | undefined {
	if (!/^file:\/\//i.test(value)) {
		return undefined;
	}
	try {
		const decoded = decodeURIComponent(value.replace(/^file:\/\//i, ''));
		return decoded.startsWith('/') ? decoded : `/${decoded}`;
	} catch {
		return value.replace(/^file:\/\//i, '');
	}
}

function normalizeFsPath(value: string): string {
	const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
	if (!normalized) {
		return '';
	}
	const prefix = normalized.match(/^[a-z]:/i)?.[0] ?? (normalized.startsWith('/') ? '/' : '');
	const withoutPrefix = prefix === '/' ? normalized.slice(1) : prefix ? normalized.slice(prefix.length) : normalized;
	const parts: string[] = [];
	for (const part of withoutPrefix.split('/')) {
		if (!part || part === '.') {
			continue;
		}
		if (part === '..') {
			parts.push(part);
			continue;
		}
		parts.push(part);
	}
	const joined = parts.join('/');
	return prefix === '/' ? `/${joined}` : prefix ? `${prefix}${joined ? `/${joined}` : ''}` : joined;
}

function hasParentTraversal(value: string): boolean {
	return value.split('/').includes('..');
}

function isAbsolutePath(value: string): boolean {
	return value.startsWith('/') || /^[a-z]:\//i.test(value);
}

function isPathWithin(candidate: string, root: string): boolean {
	const normalizedCandidate = stripTrailingSlash(normalizeFsPath(candidate).toLowerCase());
	const normalizedRoot = stripTrailingSlash(normalizeFsPath(root).toLowerCase());
	return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function stripTrailingSlash(value: string): string {
	return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function redactCwdSafety(safety: VibeCodexTerminalCwdSafety): VibeCodexTerminalCwdSafety {
	return {
		...safety,
		...(safety.cwd ? { cwd: redactSensitiveText(safety.cwd) } : {}),
		...(safety.effectiveCwd ? { effectiveCwd: redactSensitiveText(safety.effectiveCwd) } : {}),
		warnings: safety.warnings.map(redactSensitiveText),
		errors: safety.errors.map(redactSensitiveText),
	};
}
