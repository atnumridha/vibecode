/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexToolCatalog } from './toolCatalog';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexCapabilitySource = 'cursor' | 'cline' | 'codex' | 'vibecodex';
export type VibeCodexCapabilityStatus = 'implemented' | 'partial' | 'planned';

export interface VibeCodexCapabilityMatrixRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly includeEvidence: boolean;
	readonly includePlanned: boolean;
	readonly source?: VibeCodexCapabilitySource;
	readonly requestedAt: number;
}

export interface VibeCodexCapabilityMatrixItem {
	readonly id: string;
	readonly title: string;
	readonly sources: readonly VibeCodexCapabilitySource[];
	readonly status: VibeCodexCapabilityStatus;
	readonly runtimeAvailable: boolean;
	readonly toolCatalogIds: readonly string[];
	readonly missingToolCatalogIds: readonly string[];
	readonly blockedReasons: readonly string[];
	readonly evidence?: readonly string[];
	readonly notes?: readonly string[];
}

export interface VibeCodexCapabilityMatrixResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly requestedSource?: VibeCodexCapabilitySource;
	readonly counts: {
		readonly total: number;
		readonly implemented: number;
		readonly partial: number;
		readonly planned: number;
		readonly runtimeAvailable: number;
	};
	readonly sourceCounts: Record<VibeCodexCapabilitySource, number>;
	readonly capabilities: readonly VibeCodexCapabilityMatrixItem[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

interface CapabilityDefinition {
	readonly id: string;
	readonly title: string;
	readonly sources: readonly VibeCodexCapabilitySource[];
	readonly status: VibeCodexCapabilityStatus;
	readonly toolCatalogIds: readonly string[];
	readonly evidence: readonly string[];
	readonly notes?: readonly string[];
}

const capabilityMatrixMethods = new Set([
	'agent/getCapabilityMatrix',
	'agent/capabilityMatrix',
	'agent/getParityMatrix',
	'agent/parityMatrix',
	'capability/status',
	'parity/status',
	'vibecodex/capabilityMatrix',
]);

const capabilityMatrixToolNames = new Set([
	'capability_matrix',
	'get_capability_matrix',
	'parity_matrix',
	'get_parity_matrix',
	'cursor_parity',
	'cline_parity',
	'codex_parity',
]);

const capabilityDefinitions: readonly CapabilityDefinition[] = [
	capability('visualPlanning', 'Visual Plan Mode with Mermaid/checklist approval', ['cursor', 'codex', 'vibecodex'], ['planning.planValidation', 'planning.planEditStatus', 'planning.visualPlan', 'planning.planCanvasStatus', 'planning.planFocusStatus'], [
		'agent/validatePlan and visual_plan_validate preflight candidate plans for schema, Mermaid syntax, checklist flow-node links, dependencies, counts, and repair hints before rendering.',
			'agent/validatePlanEdit and plan_edit_status preview manual checklist step edits with prospective revision, planHash, changed fields, validation errors, and graph linkage without editing the active plan or unlocking mutation.',
			'agent/getVisualPlanStatus, plan_render_status, and plan_status expose renderStatus plus optional redacted renderModel nodes, edges, checklist bindings, fallback source, and exact approval readiness without exposing approval tokens.',
			'agent/getPlanCanvasStatus and plan_canvas_status expose the offline/local SVG renderer contract, strict CSP/no-CDN proof, last-valid graph retention, cached graph evidence/counts, graph/checklist binding coverage, exact approval lock, and next canvas route without mutating state.',
			'agent/getPlanFocusStatus and plan_focus_status expose redacted graph/checklist focus bindings for step ids, Mermaid node ids, and related files without changing UI focus or unlocking mutation.',
			'agent/planFocusChanged mirrors matched checklist hover/focus and graph hover/click focus events back to the backend as a read-only notification with redacted binding evidence.',
			'agent/submitPlan and agent/updatePlan render structured VibeCodexPlan objects before mutation.',
		'agent/approvePlan authorizes only the exact rendered task/revision.',
	]),
	capability('inlinePrompt', 'Ctrl/Cmd+K inline prompt to visual planning loop', ['cursor', 'cline', 'codex', 'vibecodex'], ['planning.inlinePromptStatus', 'planning.visualPlan'], [
		'Native VibeCode uses a ZoneWidget inline prompt and the installable extension fallback captures selected code, nearby context, required plan steps, and acceptance criteria.',
		'agent/getInlinePromptStatus and inline_prompt_status expose the active inline prompt session without gathering fresh editor text or unlocking mutation.',
	]),
	capability('modePolicy', 'Ask, Plan, Manual, Act, Agent, Debug, Review, and Custom modes', ['cursor', 'cline', 'codex', 'vibecodex'], ['context.modeStatus', 'context.safetyStatus'], [
		'Mode Policy blocks mutating tools in read-only modes and requires plan approval for execution-capable modes.',
		'agent/getModeStatus and mode_status expose current mode readiness, all standard mode policies, exact-plan authorization match, and next safe route without switching modes or unlocking mutation.',
	]),
	capability('workspaceSandbox', 'Workspace-rooted file, cwd, ignore-policy, checkpoint, and rollback safety', ['cline', 'codex', 'vibecodex'], ['context.workspaceSandboxStatus', 'context.safetyStatus', 'review.diffValidation', 'context.terminalCommandValidation', 'review.checkpointStatus', 'review.rollbackRestoreStatus'], [
		'Workspace file tools reject parent traversal, unsupported schemes, ignored paths, out-of-workspace paths, and symlink traversal before mutation.',
		'agent/getWorkspaceSandboxStatus and workspace_sandbox_status expose workspace roots/trust, ignore-policy counts, pending approval/diff/checkpoint/sample path readiness, symlink-guard capability, checkpoint coverage, atomic rollback capability, blockers, and guardrails without resolving symlinks, writing files, deleting files, restoring checkpoints, running terminals, changing trust, approving plans, or mutating files.',
		'Accepted writes still require exact visual-plan authorization, developer diff acceptance, workspace-root resolution, ignore-policy checks, symlink traversal checks, and checkpoints at mutation time.',
	]),
		capability('approvalStatus', 'Read-only pending/action approval introspection', ['cline', 'codex', 'vibecodex'], ['context.approvalStatus', 'context.actionApprovalStatus'], [
			'agent/getApprovalStatus and approval_status report pending approval cards, risk, and acceptance blockers without accepting, declining, auto-approving, or exposing approval tokens.',
			'agent/getActionApprovalStatus and action_approval_status compose Mode Policy, exact plan authorization, auto-approve settings, tool-call preflight, and terminal command validation to route proposed actions without approving or executing them.',
		]),
		capability('humanInputLoop', 'Developer clarification and Plan Mode feedback wait states', ['cline', 'codex', 'vibecodex'], ['planning.userInput', 'planning.userInputStatus'], [
			'ask_question, ask_followup_question, and plan_mode_respond pause the backend for explicit developer input through the sidebar.',
			'agent/getUserInputStatus and user_input_status expose pending request counts, redacted prompts, suggestions, and next wait action without answering, cancelling, approving plans, running tools, editing files, or unlocking mutation.',
		]),
		capability('activeTokenFilters', 'Active token filters and synthetic no-leak status checks', ['cursor', 'cline', 'codex', 'vibecodex'], ['context.redactionStatus', 'context.safetyStatus', 'context.protocolStatus'], [
		'agent/getRedactionStatus and redaction_status expose active token filter categories, synthetic no-leak self-test counts, and guardrails without scanning workspace files, secret storage, terminal output, or provider config.',
		'secret_filter_status and token_filter_status let backends verify redaction readiness before returning context, protocol diagnostics, terminal evidence, provider state, workflow status, or client-state payloads.',
	]),
	capability('contextMentions', '@ context, lexical search, symbols, diagnostics, docs, git, terminal, and chat recall', ['cursor', 'cline', 'codex', 'vibecodex'], ['context.readWorkspace', 'context.refresh', 'context.status', 'context.indexStatus', 'context.symbolIndexStatus', 'context.workspaceReadStatus', 'context.searchFiles', 'context.codeDefinitions', 'context.references', 'context.workspaceSymbols', 'context.diagnostics', 'context.git'], [
		'Context packs include active editor, mentions, ranked search hits, diagnostics, git state, docs context, session recall, and bounded symbols.',
		'agent/refreshContext and context_refresh let the backend request a fresh read-only gather before visual planning without unlocking mutation.',
		'agent/getContextIndexStatus and context_index_status expose source readiness, freshness, counts, and redacted path-only samples before plan execution.',
		'agent/getSymbolIndexStatus and symbol_index_status expose cached structural symbol counts, kind summaries, and optional capped entries without invoking providers or reading file text.',
		'agent/getWorkspaceReadStatus and workspace_read_status expose cached read/search evidence counts, paths, previews, and guardrails without reading files or searching again.',
		'vscode_references and workspace_symbols expose live VS Code language-provider references and workspace symbols without unlocking mutation.',
	]),
	capability('workspaceReadTools', 'Cline/Codex-compatible read-only workspace tools', ['cline', 'codex', 'vibecodex'], ['context.readFile', 'context.listFiles', 'context.searchFiles', 'context.workspaceReadStatus', 'context.codeDefinitions', 'context.references', 'context.workspaceSymbols', 'context.diagnostics', 'context.git'], [
		'read_file/read_files/list_files/list_dir/search_files/semantic_search/list_code_definition_names/vscode_references/workspace_symbols/get_diagnostics stay read-only and sandboxed.',
		'workspace_search_status and codebase_search_status give the backend an auditable cached context trail before it drafts or revises visual plans.',
	]),
	capability('diffReview', 'Review-first multi-file diff application with checkpoint rollback', ['cursor', 'cline', 'codex', 'vibecodex'], ['review.diffValidation', 'file.proposeDiff', 'diff.accept', 'review.diffStatus', 'review.diffFileStatus', 'review.diffReapplyStatus', 'review.checkpointStatus', 'review.rollbackRestoreStatus'], [
		'agent/validateDiff and diff_validate preflight proposed file edits, paths, unified diff hunks, SEARCH/REPLACE blocks, duplicate paths, and repair hints before review cards are created.',
		'write/edit/replace/apply_patch requests create diff cards and per-file checkpoints before writes.',
		'Accept All applies files atomically and rolls back already-applied files if a later file fails.',
		'agent/getDiffReviewStatus and diff_review_status can expose a read-only atomic review model with per-file action readiness, line stats, pending/accepted/rejected path sets, and checkpoint coverage.',
		'agent/getDiffFileStatus and diff_file_status expose focused per-file status, patch kind/stats, checkpoint coverage, sibling paths, and available actions without accepting, rejecting, restoring, or mutating files.',
		'agent/getDiffReapplyStatus and diff_reapply_status combine active diff-file state with candidate validation to route repair, replace, or submit-new-review decisions without creating review cards or mutating files.',
		'agent/getRollbackRestoreStatus and rollback_restore_status preflight task/file restore readiness, accepted-file checkpoint coverage, blockers, and visible restore route without restoring checkpoints or unlocking execution.',
	]),
	capability('terminalAutomation', 'Visible terminal execution with output streaming, interrupt, retry, insights, remediation, and evidence', ['cursor', 'cline', 'codex', 'vibecodex'], ['context.terminalCommandValidation', 'terminal.run', 'context.terminalOutput', 'context.terminalInsights', 'context.terminalRemediationStatus'], [
		'agent/validateCommand and command_validate preflight command intent, command permissions, mode readiness, cwd sandboxing, verification linkage, and repair hints before approval cards or terminal runs are requested.',
		'execute_command/bash/shell tool calls require approval, stream agent/terminalOutput, and report agent/terminalResult evidence.',
		'agent/getTerminalInsightStatus and terminal_insight_status return classified terminal findings without raw output or terminal control.',
		'agent/getTerminalRemediationStatus and terminal_remediation_status expose failure-triggered plan revisions, verification linkage, and execution-lock state without retrying commands or mutating files.',
	]),
	capability('attentionManagement', 'Cline-style notifications and human attention status', ['cline', 'codex', 'vibecodex'], ['context.notificationStatus', 'context.approvalStatus', 'context.toolTimelineStatus', 'review.diffStatus'], [
		'VS Code notifications can surface waiting plans, approval cards, MCP/browser requests, diff reviews, long-running terminals, and terminal completion actions.',
		'agent/getNotificationStatus and notification_status expose notification policy, enabled/disabled channels, developer/runtime attention items, and long-running terminal notification counts without showing notifications, changing settings, opening views, interrupting terminals, retrying commands, approving requests, accepting diffs, or mutating files.',
		'Attention status pairs with approval_status, tool_timeline_status, and diff_review_status so backends can wait, summarize, or request mutation with current human-blocker context.',
	]),
	capability('mcpAndPlugins', 'MCP status, documentation, approval, and resource/tool request gates', ['cline', 'codex', 'vibecodex'], ['mcp.status', 'mcp.documentation', 'mcp.call'], [
		'agent/getMcpStatus and mcp_status expose redacted MCP catalog readiness, requested-server scope, unknown/global guidance, enabled/disabled counts, transport metadata, and pending approval counts without executing MCP tools/resources.',
		'load_mcp_documentation is read-only; use_mcp_tool and access_mcp_resource remain approval gated, and unknown/global servers stay blocked until mirrored into workspace MCP config.',
	]),
		capability('browserAndWeb', 'Approval-gated web fetch/search and browser open/navigate requests', ['cursor', 'cline', 'codex', 'vibecodex'], ['context.previewStatus', 'preview.start', 'browser.status', 'browser.actionStatus', 'web.fetch', 'browser.openNavigate'], [
			'agent/getPreviewStatus and preview_status expose detected preview targets, terminal-discovered loopback URLs, and pending browser approvals without starting servers or opening browsers.',
			'agent/startPreview, preview/start, and preview_start start only detected preview targets through visible approval-gated terminal runs.',
			'agent/getBrowserStatus and browser_status expose supported external browser actions, native-controller-required actions, and pending browser approvals before browser_action requests.',
			'agent/getBrowserActionStatus and browser_action_status expose recent supported open/navigate outcomes plus native-controller-required click/type/scroll/screenshot handoffs without controlling pages.',
		'fetch_web/web_search and browser open/navigate requests are capped, redacted, and blocked until the approved plan allows them.',
	]),
	capability('rulesSkillsHooksMemory', 'Rules, skills, hooks, Memory Bank, and custom modes as planning context', ['cline', 'cursor', 'codex', 'vibecodex'], ['context.readGuidance', 'context.selectGuidance', 'hook.run'], [
		'AGENTS.md, .clinerules, .cursor rules, SKILL.md, hook manifests, Memory Bank, and custom modes are indexed as read-only guidance.',
		'agent/selectGuidance and guidance_select rank applicable rules, skills, hook manifests, and Memory Bank documents for prompt/path scope without executing hooks or unlocking mutation.',
	]),
	capability('providers', 'Codex login plus cloud, local, and custom OpenAI-compatible providers', ['cline', 'codex', 'vibecodex'], ['context.providerCatalog', 'context.providerStatus'], [
		'Provider catalog includes Codex/ChatGPT login, OpenAI, Anthropic, Gemini, Ollama, LM Studio, Bedrock, OpenRouter, Azure, Vertex, Groq, Mistral, xAI, and custom base URLs.',
		'Mode-specific model routing lets Plan/Ask/Review use a reasoning model while Act/Agent/Debug use faster local or OpenAI-compatible models without duplicating credentials.',
	]),
	capability('parallelAgents', 'Up to 8 isolated worktree lanes with reviewer/judge merge-back', ['cursor', 'cline', 'codex', 'vibecodex'], ['parallel.status', 'parallel.worktreeStatus', 'parallel.laneExecutionStatus', 'parallel.dispatchPlan', 'parallel.dispatchLane', 'parallel.reviewStatus', 'parallel.mergeStatus', 'parallel.prepareWorktrees'], [
		'Parallel Agents prepare isolated worktrees, collect lane results, require judge review before merge-back, and expose selected-lane merge status without applying merges.',
		'agent/prepareParallelWorktrees, agent/cleanupParallelWorktrees, and prepare_parallel_worktrees create visible approval cards before any git worktree command runs, even after the exact visual plan is approved.',
		'agent/getParallelWorktreeStatus and parallel_worktree_status expose workspace trust, exact-plan authorization, mode locks, worktree root, branch/path safety, lane materialization counts, and prepare/cleanup readiness without creating, cleaning, or mutating worktrees.',
		'agent/getParallelLaneExecutionStatus and parallel_lane_execution_status expose selected/auto lane dispatch readiness, exact-plan and mode gates, worktree materialization, result state, judge-review link, route, blockers, and next action without dispatching agents, running commands, or mutating worktrees.',
		'agent/getParallelDispatchPlan and parallel_dispatch_plan expose the plan-gated dispatch queue, per-lane agent/dispatchParallelLane payloads, expected agent/parallelResult callback, blockers, and guardrails without launching agents or mutating worktrees.',
		'agent/dispatchParallelLane and dispatch_parallel_lane create visible approval cards, run Codex only inside materialized lane worktrees, and convert terminal completion into agent/parallelResult evidence for judge review.',
		'agent/getParallelReviewStatus and parallel_review_status expose redacted lane rankings, scores, missing lanes, recommendations, and blockers before any merge-back request.',
		'agent/getParallelMergeStatus and parallel_merge_status expose the review-first diff handoff route, expected backend diff response methods, checkpoint requirement, and Accept/Reject requirement before any merge-back output can touch files.',
	]),
		capability('taskBoardDelegation', 'Cline-style task board, dependency chains, delegated subtasks, external/headless intake, and plan-only start readiness', ['cline', 'codex', 'vibecodex'], ['planning.taskBoardStatus', 'planning.taskStartStatus', 'planning.externalIntakeStatus', 'planning.connectorScheduleStatus'], [
			'new_task/delegate_task requests queue dependent Task Board cards instead of executing immediately.',
			'agent/getTaskIntakeStatus and task_intake_status expose source/intake counts, ready/running/blocked queue ids, dependency blockers, and intake-only guardrails without starting queued work.',
			'agent/getTaskStartStatus and task_start_status preflight whether a queued/delegated/external card can begin visual Plan Mode without starting it, approving plans, preparing worktrees, or mutating files.',
			'agent/getExternalIntakeStatus and external_intake_status expose supported URI, connector, scheduled, headless, and delegated intake routes, payload fields, start semantics, and parallel limits before callers queue work.',
			'agent/getConnectorStatus, connector_status, scheduled_agent_status, automation_status, and headless_agent_status expose Slack/Telegram/Discord/Google Chat/WhatsApp/Linear/Jira/GitHub/GitLab/email/webhook/cron/headless channel readiness and queued-card evidence without connecting accounts or creating schedules.',
			'External scheduled/headless URI intake still starts in Plan Mode and stays blocked from mutation until approved.',
		]),
	capability('slashWorkflows', 'Cline-style slash commands and workspace workflow shortcuts', ['cline', 'cursor', 'codex', 'vibecodex'], ['planning.slashCommandStatus', 'planning.visualPlan', 'planning.taskBoardStatus'], [
		'Slash command parsing supports /deep-planning, /newtask, /smol, /newrule, /compact, mode shortcuts, and workflow files under Cline/Cursor/VibeCodex workflow roots.',
		'agent/getSlashCommandStatus and slash_command_status expose built-in slash commands, workflow slash paths, allowed roots, limits, and last-command metadata without executing commands, creating tasks or rules, loading workflow text, approving plans, running tools, accepting diffs, restoring checkpoints, or mutating files.',
		'Workflow slash commands remain read-only planning guidance until the normal visual plan, execution authorization, diff review, and rollback gates are satisfied.',
	]),
	capability('historyAndExport', 'Cursor-style chat tabs, transcript, session history, compaction, and export', ['cursor', 'cline', 'codex', 'vibecodex'], ['planning.transcriptStreaming', 'planning.sessionHistoryStatus', 'planning.sessionExport', 'planning.taskSummary'], [
		'Transcript streaming, chat tabs, session restore, Markdown export, and summarize_task/condense handoffs are redacted and bounded.',
		'agent/getSessionHistoryStatus and session_history_status expose chat tab/session summaries without restoring sessions, exporting Markdown, or treating old plans as approval.',
		'agent/exportSession and session_export return capped redacted Markdown without restoring sessions, deleting history, or granting approval.',
	]),
	capability('verificationGate', 'Delivery Bar, smoke benchmarks, diagnostics, acceptance criteria, commit handoff, workflow lifecycle proof, Happy Path Proof, and Final Review task-completion gate', ['cursor', 'cline', 'codex', 'vibecodex'], ['verification.status', 'verification.executionGateStatus', 'verification.acceptanceCriteriaStatus', 'verification.smokeBenchmarkStatus', 'verification.deliveryBarStatus', 'verification.workflowStatus', 'verification.happyPathStatus', 'verification.taskCompletionStatus', 'verification.taskCompletion', 'verification.finalReview', 'review.commitHandoffStatus', 'review.autoCommitStatus'], [
		'attempt_completion and submit_and_exit pass only after Delivery Bar, Smoke Benchmark, Commit Handoff, and Final Review are satisfied.',
		'agent/getExecutionGateStatus and execution_gate_status combine active visual-plan validity, exact approval authorization, proposed tool-call preflight, pending approvals, and diff review counts to route the next safe execution handoff without mutating state.',
		'agent/getAcceptanceCriteriaStatus and acceptance_criteria_status expose plan acceptance criteria coverage, linked required verification checks, blockers, and redacted evidence without marking criteria passed or running checks.',
		'agent/getSmokeBenchmarkStatus and smoke_benchmark_status expose native prompt, visual plan, approval, terminal verification, diff, rollback, commit handoff, and Delivery Bar milestone readiness without accepting completion.',
		'agent/getDeliveryBarStatus and delivery_bar_status expose current Delivery Bar readiness, required check blockers, counts, and next action without running checks or accepting completion.',
		'agent/getTaskCompletionStatus and task_completion_status expose the latest completion gate decision, Final Review counts, blockers, redacted evidence, and next action without accepting completion.',
		'agent/getCommitHandoffStatus and commit_handoff_status return read-only commit blockers, evidence, and prepared git commands before task completion.',
		'agent/getAutoCommitStatus and auto_commit_status return opt-in auto-commit readiness, Final Review and Commit Handoff state, blockers, evidence, and prepared git commands without staging, committing, pushing, opening PRs, or mutating files.',
		'agent/getWorkflowStatus and workflow_status expose prompt -> visual plan -> approval -> execution -> terminal verification -> diff review -> rollback -> commit handoff -> Final Review readiness as a read-only lifecycle proof.',
		'agent/getHappyPathStatus and happy_path_status compose Workflow Proof, Smoke Benchmark, Delivery Bar, Final Review, and parallel lane readiness into one next-gate route without approving plans, dispatching agents, running tools, accepting diffs, restoring checkpoints, staging commits, or mutating files.',
	]),
	capability('protocolDiagnostics', 'Transparent JSON-RPC diagnostics, backend launch readiness, tool timeline, and redacted client-state snapshots', ['codex', 'vibecodex'], ['context.backendLaunchStatus', 'context.protocolStatus', 'context.toolTimelineStatus', 'context.clientState'], [
		'agent/getBackendLaunchStatus and backend_launch_status expose redacted stdio/pipe/websocket launch-route readiness, selected transport/framing, bridge state, blockers, and next action without starting processes or opening sockets.',
			'agent/getProtocolStatus and protocol_status expose redacted bridge health, handshake capability readiness, handshake contract coverage, transport, framing, pending requests, and recent lifecycle events without reconnecting transports, replaying agent/initialize, or sending JSON-RPC requests.',
		'agent/getToolTimelineStatus and tool_timeline_status expose recent tool/approval/terminal/diff/verification/rollback timeline events plus live pending approvals, terminal runs, and diff counts without approving, executing, accepting diffs, restoring checkpoints, or mutating files.',
		'agent/getClientState and protocol diagnostics expose broader sidebar/task state without raw approval tokens or API keys.',
	]),
	capability('toolSchemaExport', 'Machine-readable OpenAI/Anthropic/VibeCodex tool schemas', ['codex', 'vibecodex'], ['planning.toolSchemas', 'planning.toolCallStatus'], [
		'agent/getToolSchemas and tool_schema requests return tool aliases, JSON parameters, runtime availability, and approval/plan-gate metadata without executing tools.',
		'agent/validateToolCall and tool_call_status requests preflight one proposed tool call against the current schema manifest, Cline/Core alias argument shapes, missing/unknown argument checks, and approval route without executing tools.',
	]),
	capability('nativeVsixDistribution', 'Same extension surface for bundled VibeCode and external VS Code installs', ['codex', 'vibecodex'], ['context.extensionInstallStatus', 'context.backendLaunchStatus', 'context.protocolStatus'], [
		'The extension packages as a VSIX while also serving as the bundled VibeCode agent identity.',
		'agent/getExtensionInstallStatus and extension_install_status expose manifest identity, VSIX install command, activation routes, command contributions, configuration keys, runtime load state, and strict webview security readiness without installing packages or mutating settings.',
		'Backend Launch Readiness and Protocol Health then prove the external VS Code install can connect a Codex app-server route after the VSIX is installed.',
	]),
];

export function normalizeCapabilityMatrixRequest(message: JsonRpcMessage): VibeCodexCapabilityMatrixRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!capabilityMatrixMethods.has(message.method) && !isCapabilityMatrixToolCall(message.method, payload, args)) {
		return undefined;
	}
	const requestedSource = normalizeSource(stringValue(payload.source) ?? stringValue(args.source) ?? stringValue(payload.provider) ?? stringValue(args.provider));
	return {
		id: message.id,
		method: message.method,
		includeEvidence: booleanValue(payload.includeEvidence)
			?? booleanValue(payload.include_evidence)
			?? booleanValue(args.includeEvidence)
			?? booleanValue(args.include_evidence)
			?? true,
		includePlanned: booleanValue(payload.includePlanned)
			?? booleanValue(payload.include_planned)
			?? booleanValue(args.includePlanned)
			?? booleanValue(args.include_planned)
			?? false,
		...(requestedSource ? { source: requestedSource } : {}),
		requestedAt: Date.now(),
	};
}

export function createCapabilityMatrixResponse(request: VibeCodexCapabilityMatrixRequest, input: { readonly toolCatalog?: VibeCodexToolCatalog }): VibeCodexCapabilityMatrixResponse {
	const toolById = new Map((input.toolCatalog?.tools ?? []).map(tool => [tool.id, tool]));
	const capabilities = capabilityDefinitions
		.filter(definition => request.includePlanned || definition.status !== 'planned')
		.filter(definition => !request.source || definition.sources.includes(request.source))
		.map(definition => capabilityItem(definition, toolById, request.includeEvidence));
	const counts = {
		total: capabilities.length,
		implemented: capabilities.filter(item => item.status === 'implemented').length,
		partial: capabilities.filter(item => item.status === 'partial').length,
		planned: capabilities.filter(item => item.status === 'planned').length,
		runtimeAvailable: capabilities.filter(item => item.runtimeAvailable).length,
	};
	const sourceCounts = sourceCount(capabilities);
	return {
		ok: true,
		source: 'externalExtension',
		...(request.source ? { requestedSource: request.source } : {}),
		counts,
		sourceCounts,
		capabilities,
		guardrails: [
			'Capability matrix is read-only and never approves plans, runs tools, mutates files, starts terminals, or changes provider settings.',
			'Runtime availability is derived from the current Tool Catalog; blocked mutating tools may still be implemented but locked by mode, plan approval, or bridge state.',
			'Capability evidence is redacted before it is returned to the backend or rendered in the sidebar.',
		],
		message: capabilityMatrixSummaryFromCounts(counts, request.source),
	};
}

export function capabilityMatrixSummary(response: VibeCodexCapabilityMatrixResponse): string {
	return response.message;
}

function capability(id: string, title: string, sources: readonly VibeCodexCapabilitySource[], toolCatalogIds: readonly string[], evidence: readonly string[], notes?: readonly string[]): CapabilityDefinition {
	return {
		id,
		title,
		sources,
		status: 'implemented',
		toolCatalogIds,
		evidence,
		...(notes ? { notes } : {}),
	};
}

function capabilityItem(definition: CapabilityDefinition, toolById: ReadonlyMap<string, VibeCodexToolCatalog['tools'][number]>, includeEvidence: boolean): VibeCodexCapabilityMatrixItem {
	const missingToolCatalogIds = definition.toolCatalogIds.filter(id => !toolById.has(id));
	const tools = definition.toolCatalogIds.map(id => toolById.get(id)).filter((tool): tool is VibeCodexToolCatalog['tools'][number] => !!tool);
	const blockedReasons = tools
		.map(tool => tool.blockedReason)
		.filter((value): value is string => !!value)
		.map(redactSensitiveText);
	const runtimeAvailable = missingToolCatalogIds.length === 0 && tools.every(tool => tool.available);
	const status: VibeCodexCapabilityStatus = missingToolCatalogIds.length
		? definition.status === 'implemented' ? 'partial' : definition.status
		: definition.status;
	return {
		id: definition.id,
		title: definition.title,
		sources: definition.sources,
		status,
		runtimeAvailable,
		toolCatalogIds: definition.toolCatalogIds,
		missingToolCatalogIds,
		blockedReasons,
		...(includeEvidence ? { evidence: redactSensitiveValue(definition.evidence) as readonly string[] } : {}),
		...(definition.notes ? { notes: redactSensitiveValue(definition.notes) as readonly string[] } : {}),
	};
}

function sourceCount(capabilities: readonly VibeCodexCapabilityMatrixItem[]): Record<VibeCodexCapabilitySource, number> {
	return capabilities.reduce<Record<VibeCodexCapabilitySource, number>>((accumulator, item) => {
		for (const source of item.sources) {
			accumulator[source] += 1;
		}
		return accumulator;
	}, { cursor: 0, cline: 0, codex: 0, vibecodex: 0 });
}

function capabilityMatrixSummaryFromCounts(counts: VibeCodexCapabilityMatrixResponse['counts'], source: VibeCodexCapabilitySource | undefined): string {
	const scoped = source ? `${source} ` : '';
	return `${scoped}capability matrix: ${counts.implemented}/${counts.total} implemented, ${counts.partial} partial, ${counts.planned} planned, ${counts.runtimeAvailable} runtime-available under current policy.`;
}

function isCapabilityMatrixToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
	if (method !== 'item/tool/call') {
		return false;
	}
	const tool = (stringValue(payload.tool)
		?? stringValue(payload.name)
		?? stringValue(payload.toolName)
		?? stringValue(payload.tool_name)
		?? stringValue(args.tool)
		?? stringValue(args.name)
		?? stringValue(args.toolName)
		?? stringValue(args.tool_name)
		?? '').toLowerCase();
	return capabilityMatrixToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return payload;
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function normalizeSource(value: string | undefined): VibeCodexCapabilitySource | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'cursor' || normalized === 'cline' || normalized === 'codex' || normalized === 'vibecodex') {
		return normalized;
	}
	if (normalized === 'vibe' || normalized === 'vibecode') {
		return 'vibecodex';
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true') {
			return true;
		}
		if (normalized === 'false') {
			return false;
		}
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
