/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexMcpCatalog } from './mcpCatalog';
import { VibeCodexModePolicy, VibeCodexSensitiveAction, modeAllowsAction, modePolicySummary } from './modePolicy';
import type { VibeCodexParallelPlan } from './multiAgent';
import type { VibeCodexPreviewPlan } from './previewPlan';
import { redactSensitiveValue } from './secretFilters';

export type VibeCodexToolCatalogCategory = 'context' | 'planning' | 'file' | 'terminal' | 'browser' | 'web' | 'mcp' | 'hook' | 'parallel' | 'verification' | 'review';

export interface VibeCodexToolCatalogEntry {
	readonly id: string;
	readonly title: string;
	readonly category: VibeCodexToolCatalogCategory;
	readonly available: boolean;
	readonly requiresApproval: boolean;
	readonly requiresPlanApproval: boolean;
	readonly sensitiveAction?: VibeCodexSensitiveAction;
	readonly detail: string;
	readonly blockedReason?: string;
}

export interface VibeCodexToolCatalog {
	readonly version: 1;
	readonly updatedAt: number;
	readonly mode: string;
	readonly modeSummary: string;
	readonly bridgeConnected: boolean;
	readonly executionAuthorized: boolean;
	readonly tools: readonly VibeCodexToolCatalogEntry[];
}

export interface VibeCodexToolCatalogInput {
	readonly modePolicy: VibeCodexModePolicy;
	readonly hasExecutionAuthorization: boolean;
	readonly bridgeConnected: boolean;
	readonly mcpCatalog?: VibeCodexMcpCatalog;
	readonly previewPlan?: VibeCodexPreviewPlan;
	readonly parallelPlan?: VibeCodexParallelPlan;
}

export function createToolCatalog(input: VibeCodexToolCatalogInput): VibeCodexToolCatalog {
	const tools = [
		contextTool('context.readWorkspace', 'Read workspace context', 'Active file, selected text, @mentions, lexical search, diagnostics, git, terminal metadata, and symbols.'),
		contextTool('context.readFile', 'Read workspace files on request', 'Backend read_file/read_files and Cline editor read/view/open requests return bounded, redacted file text or requested line ranges from workspace paths that pass sandbox and ignore-policy checks.'),
		contextTool('context.listFiles', 'List workspace directories on request', 'Backend list_files/list_dir requests return bounded workspace directory entries while honoring workspace ignore files.'),
		contextTool('context.searchFiles', 'Search workspace files on request', 'Backend search/grep/search_files requests return capped literal or regex line previews with optional workspace path scope; semantic_search/codebase_search/search_codebase requests return ranked file-level context from non-ignored workspace files.'),
		contextTool('context.workspaceReadStatus', 'Read cached workspace read/search evidence', 'Backend agent/getWorkspaceReadStatus, agent/workspaceReadStatus, workspace/readStatus, workspace/searchStatus, workspace_read_status, workspace_search_status, codebase_search_status, or read_tool_status requests return cached read_file/list_dir/search_files/semantic_search evidence, counts, sample paths/previews, and guardrails without reading files, searching, approving plans, or mutating files.'),
		contextTool('context.codeDefinitions', 'List code definition names on request', 'Backend list_code_definition_names requests return capped, redacted VS Code document-symbol entries for workspace files or folders without unlocking mutation.'),
		contextTool('context.references', 'Find references and usages on request', 'Backend vscode_references, find_references, usages, or workspace/references requests return capped, redacted VS Code reference-provider locations for workspace files while honoring workspace ignore rules and without unlocking mutation.'),
		contextTool('context.workspaceSymbols', 'Search workspace symbols on request', 'Backend workspace_symbols, symbol_search, symbols/search, or workspace/symbols requests return capped, redacted VS Code workspace-symbol results while honoring workspace ignore rules and without reading file text or unlocking mutation.'),
		contextTool('context.diagnostics', 'Read IDE diagnostics on request', 'Backend get_diagnostics requests return capped, redacted VS Code Problems diagnostics with optional path and severity filters.'),
		contextTool('context.git', 'Read Git status, diff, and log on request', 'Backend Git status/diff/log requests are read-only, shell-free, workspace-rooted, capped, redacted, and reject ignored or out-of-workspace paths.'),
		contextTool('context.terminalOutput', 'Read or stream captured terminal output', 'Backend command_output or terminal/output requests return capped, redacted output tails for a known or latest Vibe Codex terminal run, agent/terminalOutput notifications stream throttled redacted deltas, and terminal/status reads tracked run state without starting a new command.'),
		contextTool('context.terminalInsights', 'Read classified terminal insights', 'Backend agent/getTerminalInsightStatus, agent/terminalInsightStatus, terminal/insightStatus, terminal_insight_status, or terminal_findings requests return classified test/lint/typecheck/build/runtime/port/preview findings, signatures, summaries, and redacted follow-up prompts without raw output tails or terminal control.'),
		contextTool('context.terminalRemediationStatus', 'Read terminal remediation status', 'Backend agent/getTerminalRemediationStatus, agent/terminalRemediationStatus, terminal/remediationStatus, terminal_remediation_status, or terminal_failure_status requests return redacted remediation plan revisions, triggering run/finding metadata, verification linkage, and execution-lock state without retrying commands, editing files, approving plans, or changing verification checks.'),
		contextTool('context.terminalCommandValidation', 'Validate terminal command candidates', 'Backend agent/validateCommand, agent/commandValidation, command/validate, terminal/validate, command_validate, validate_command, terminal_validate, or shell_validate requests classify command intent, command-permission policy, Mode Policy readiness, plan-authorization lock state, cwd sandbox readiness, verification linkage, and repair hints without creating approval cards, starting terminals, or unlocking execution.'),
		contextTool('context.previewStatus', 'Read localhost preview status', 'Backend agent/getPreviewStatus, agent/previewStatus, preview/status, preview_status, localhost_preview_status, or browser_preview_status requests return detected preview targets, terminal-discovered loopback URLs, pending browser approvals, and execution authorization state without starting servers, opening browsers, fetching URLs, approving actions, or mutating files.'),
		contextTool('context.refresh', 'Refresh workspace planning context', 'Backend agent/refreshContext, agent/gatherContext, context/refresh, context/gather, context_refresh, refresh_context, or gather_context requests trigger a bounded read-only context gather, update the sidebar cache, and return summary/index readiness plus optional explicitly requested redacted context or prompt blocks without unlocking mutation.'),
		contextTool('context.status', 'Read gathered workspace context status', 'Backend agent/getContextStatus, agent/contextStatus, context/status, or context_status requests return last gathered context counts, mention/file/search/symbol/diagnostic/git metadata, and readiness without gathering fresh files, exposing file text/snippets, or changing workspace state.'),
		contextTool('context.indexStatus', 'Read context index readiness', 'Backend agent/getContextIndexStatus, agent/contextIndexStatus, context/indexStatus, context/index/status, context_index_status, workspace_index_status, codebase_index_status, or search_index_status requests return source readiness, freshness, counts, and optional redacted path-only samples without gathering fresh files, exposing snippets, or changing workspace state.'),
		contextTool('context.symbolIndexStatus', 'Read cached symbol index status', 'Backend agent/getSymbolIndexStatus, agent/symbolIndexStatus, symbol/indexStatus, symbols/status, symbol_index_status, or code_symbols_status requests return cached VS Code symbol counts, kind summaries, and optional capped entries without gathering fresh files, invoking providers, exposing file text, or changing workspace state.'),
		contextTool('context.safetyStatus', 'Read safety and permission status', 'Backend agent/getSafetyStatus, agent/safetyStatus, safety/status, or safety_status requests return mode policy, command allow/deny counts, auto-approve posture, workspace trust/sandbox state, plan authorization summary, and pending approval counts without exposing approval tokens or changing policy.'),
		contextTool('context.modeStatus', 'Read current agent mode readiness', 'Backend agent/getModeStatus, agent/modeStatus, mode/status, mode_status, mode_policy_status, or current_mode requests return the current Ask/Plan/Manual/Act/Agent/Debug/Review/Custom policy, all mode policies, exact-plan authorization match, and next safe route without switching modes, approving plans, running tools, accepting diffs, or mutating files.'),
		contextTool('context.workspaceSandboxStatus', 'Read workspace sandbox and path policy status', 'Backend agent/getWorkspaceSandboxStatus, agent/workspaceSandboxStatus, workspace/sandboxStatus, sandbox/status, workspace_sandbox_status, sandbox_status, path_policy_status, or workspace_path_status requests return workspace roots/trust, ignore-policy counts, path readiness for pending approval/diff/checkpoint/sample paths, symlink-guard/checkpoint/atomic-rollback capability flags, blockers, and guardrails without resolving symlinks, writing files, deleting files, restoring checkpoints, staging commits, running terminals, changing trust, changing ignore policy, approving plans, or mutating files.'),
		contextTool('context.redactionStatus', 'Read active token filter status', 'Backend agent/getRedactionStatus, agent/redactionStatus, redaction/status, security/redactionStatus, redaction_status, secret_filter_status, token_filter_status, or active_token_filters requests return active filter categories, synthetic no-leak self-test counts, optional redacted sample previews, and guardrails without scanning workspace files, secret storage, terminal output, provider config, or exposing raw secrets.'),
		contextTool('context.approvalStatus', 'Read pending approval status', 'Backend agent/getApprovalStatus, agent/approvalStatus, approval/status, approval_status, or pending_approvals requests return pending approval cards, acceptance blockers, risk, and redacted command/path details without accepting, declining, or exposing approval tokens.'),
		contextTool('context.actionApprovalStatus', 'Read action approval route readiness', 'Backend agent/getActionApprovalStatus, agent/actionApprovalStatus, action/approvalStatus, autoApprove/status, action_approval_status, auto_approve_status, yolo_status, or cline_action_status requests combine Mode Policy, exact visual-plan authorization, auto-approve settings, tool-call preflight, and terminal-command validation to route a proposed action to read-only handling, explicit prompt, auto-approve, plan approval, mode switch, repair, or blocked without approving or executing anything.'),
		contextTool('context.toolTimelineStatus', 'Read tool timeline status', 'Backend agent/getToolTimelineStatus, agent/toolTimelineStatus, tool/timelineStatus, timeline/status, tool_timeline_status, or activity_status requests return recent tool-related transcript events plus live pending approvals, terminal runs, and diff review counts without approving, executing, interrupting, retrying, accepting diffs, restoring checkpoints, or mutating files.'),
		contextTool('context.notificationStatus', 'Read notification and attention status', 'Backend agent/getNotificationStatus, agent/notificationStatus, notification/status, attention/status, notification_status, or attention_status requests return notification policy, enabled/disabled channels, redacted developer/runtime attention items, and long-running terminal notification counts without showing notifications, changing settings, opening views, interrupting terminals, retrying commands, approving requests, accepting diffs, or mutating files.'),
		contextTool('context.providerCatalog', 'Read provider and model catalog', 'Backend agent/getProviderCatalog, agent/providerCatalog, provider/catalog, provider_catalog, or model_catalog requests return supported providers, local/OpenAI-compatible flags, default models/base URLs, selected provider, and credential readiness without exposing raw API keys or changing provider settings.'),
		contextTool('context.providerStatus', 'Read provider and model status', 'Backend agent/getProviderStatus, agent/providerStatus, provider/status, or provider_status requests return the selected provider, effective mode model route, optional all-mode routing matrix, model source, base URL, API-key configured flag, sanitized Codex config, and credential source without exposing raw API keys.'),
		contextTool('context.readGuidance', 'Read rules, skills, hooks, and Memory Bank', 'Cline/Cursor/Codex/VibeCodex rules, skills, hook manifests, and Memory Bank files are read-only planning context. Backend agent/getGuidanceStatus, agent/guidanceStatus, guidance/status, or guidance_status requests return redacted summaries and optional document text without executing hooks or writing guidance files.'),
		contextTool('context.selectGuidance', 'Select relevant guidance for a task', 'Backend agent/selectGuidance, agent/guidanceSelect, guidance/select, guidance_select, rules_select, or Cline-compatible skills/use_skill requests rank applicable rules, skills, hook manifests, and Memory Bank documents for the prompt/paths. The skills tool defaults to configured skill documents only. Results are bounded and redacted without executing hooks, writing guidance files, approving plans, or unlocking mutation.'),
		contextTool('planning.planValidation', 'Validate visual plan candidates', 'Backend agent/validatePlan, agent/planValidation, plan/validate, visualPlan/validate, visual_plan_validate, validate_plan, plan_validate, or check_plan requests inspect a candidate plan schema, Mermaid graph, checklist node links, dependencies, counts, and repair hints without rendering, approving, mutating, or unlocking execution.'),
		contextTool('planning.planEditStatus', 'Preview manual visual plan step edits', 'Backend agent/validatePlanEdit, agent/getPlanEditStatus, plan/editStatus, visualPlan/editStatus, plan_edit_status, validate_plan_edit, or checklist_edit_status requests preview a manual checklist step title/status edit, prospective revision, planHash, changed fields, validation errors, graph linkage, and repair hints without editing the active plan, approving execution, or mutating files.'),
		contextTool('planning.visualPlan', 'Submit, refine, or inspect visual plan', 'Backend can emit or address agent/submitPlan or agent/updatePlan. Addressed requests return validation errors, render counts, the rendered planHash, mutationLocked=true, and nextAction=await_user_approval. User refine/reject/manual-step-edit feedback is sent through mutation-locked agent/refinePlan, agent/rejectPlan, or agent/updatePlan handoffs with approved=false and exact plan identity. agent/getPlanStatus, agent/getVisualPlanStatus, visual_plan_status, plan_render_status, agent/planStatus, or plan/status reads the active rendered revision, schema validity, Mermaid render status, optional redacted graph/checklist render model, checklist-flow link coverage, history summary, and authorization match without exposing approval tokens. Execution authorization includes approvedPlanHash, and same-revision content drift is treated as unapproved until the revised rendered planHash is approved.'),
			contextTool('planning.planCanvasStatus', 'Read visual plan canvas readiness', 'Backend agent/getPlanCanvasStatus, agent/planCanvasStatus, visualPlan/canvasStatus, plan/canvasStatus, plan_canvas_status, visual_plan_canvas_status, mermaid_canvas_status, or flowchart_canvas_status requests return the offline/local SVG renderer contract, strict CSP/no-CDN proof, last-valid graph retention, cached graph evidence/counts, graph/checklist binding coverage, exact approval lock, blockers, and next route without changing UI focus, editing plans, approving execution, rendering remote scripts, or mutating files.'),
			contextTool('planning.planFocusStatus', 'Read visual plan graph/checklist focus bindings', 'Backend agent/getPlanFocusStatus, agent/planFocusStatus, visualPlan/focusStatus, plan/focusStatus, plan_focus_status, visual_plan_focus, flow_node_status, or checklist_focus_status requests validate a requested checklist step, Mermaid flow node, or related file focus target and return redacted graph/checklist/file bindings, repair hints, and linked-step status without changing UI focus, editing plans, approving execution, or mutating files; matched checklist hover/focus and graph hover/click events are mirrored back through the read-only agent/planFocusChanged notification.'),
			contextTool('planning.inlinePromptStatus', 'Read Ctrl/Cmd+K inline prompt status', 'Backend agent/getInlinePromptStatus, agent/inlinePromptStatus, inlinePrompt/status, inline_prompt_status, or ctrl_k_status requests return the active inline prompt session, target file/range, required visual plan steps, acceptance criteria, optional redacted prompt/context, and plan authorization match without gathering fresh editor text, approving plans, or mutating files.'),
			contextTool('planning.userInput', 'Ask the developer for clarification', 'Backend can pause with agent/requestUserInput or Cline-compatible ask_question / ask_followup_question / plan_mode_respond requests and receive a redacted sidebar response. Plan Mode responses are also imported into the visual plan canvas as a generated linked Mermaid/checklist revision while mutation stays locked. Suggested responses can be strings or Cline-style label/value objects and are returned with stable selectedSuggestion metadata.'),
			contextTool('planning.userInputStatus', 'Read pending developer input status', 'Backend agent/getUserInputStatus, agent/userInputStatus, userInput/status, user_input_status, question_status, or plan_input_status requests return pending ask_question, ask_followup_question, and plan_mode_respond counts, redacted prompts, suggestion metadata, and next wait action without answering, cancelling, approving plans, running tools, editing files, or unlocking mutation.'),
			contextTool('planning.transcriptStreaming', 'Stream assistant and status messages', 'Backend can send agent/message, agent/messageDelta, agent/status, Cline-compatible say events, or act_mode_respond progress updates into the redacted sidebar transcript and session export without pausing for user input.'),
		contextTool('planning.sessionHistoryStatus', 'Read chat tabs and session history status', 'Backend agent/getSessionHistoryStatus, agent/sessionHistoryStatus, session/historyStatus, session_history_status, or chat_tabs_status requests return active chat tab/session summaries, status counts, task/revision metadata, and optional capped transcript tails without restoring, exporting, deleting, approving old plans, or exposing full transcripts.'),
		contextTool('planning.sessionExport', 'Export chat/session Markdown', 'Backend agent/exportSession, agent/sessionExport, session/export, chat/export, session_export, export_session, or export_chat requests return capped, redacted Markdown for the active or requested session without restoring sessions, deleting history, approving old plans, or mutating workspace state.'),
		contextTool('planning.slashCommandStatus', 'Read slash command and workflow status', 'Backend agent/getSlashCommandStatus, agent/slashCommandStatus, slash/status, slash_command_status, slash_status, or workflow_slash_status requests return Cline-style built-in slash commands, workflow slash command paths, allowed workflow roots, limits, and last slash command metadata without executing slash commands, creating task-board cards, creating rule proposals, loading workflow text, approving plans, running tools, accepting diffs, restoring checkpoints, or mutating files.'),
		contextTool('planning.taskSummary', 'Condense active task context', 'Backend can request agent/summarizeTask or Cline-compatible summarize_task / condense responses containing a capped, redacted Markdown handoff summary without granting execution approval.'),
		contextTool('planning.capabilityMatrix', 'Inspect Cursor/Cline/Codex parity matrix', 'Backend agent/getCapabilityMatrix, agent/capabilityMatrix, agent/getParityMatrix, capability/status, parity/status, capability_matrix, cursor_parity, cline_parity, or codex_parity requests return read-only capability coverage, runtime lock reasons, source tags, and redacted evidence without approving plans or running tools.'),
		contextTool('planning.toolSchemas', 'List machine-readable tool schemas', 'Backend agent/getToolSchemas, agent/toolSchemas, tools/list, tools/schema, tool/schema, tool_schema, get_tool_schemas, or list_tools requests return OpenAI/Anthropic/VibeCodex tool schemas, aliases, runtime availability, approval requirements, and blocked reasons without approving plans or executing tools.'),
		contextTool('planning.toolCallStatus', 'Validate proposed client tool calls', 'Backend agent/validateToolCall, agent/toolCallStatus, tool/callStatus, tools/callStatus, tool_call_status, or tool_call_validate requests preflight one concrete tool call against the current schema manifest, Cline/Core alias argument shapes for terminal/file/search/MCP/browser/delegation/completion tools, including write_to_file file_content, search_files regex/file_pattern, read_file start_line/end_line, and list_code_definition_names directory forms, approval locks, and exact visual-plan authorization state without executing tools, creating approvals, approving plans, or mutating files.'),
		contextTool('context.extensionInstallStatus', 'Read installable extension readiness', 'Backend agent/getExtensionInstallStatus, agent/extensionInstallStatus, extension/installStatus, vsix/status, extension_install_status, vsix_status, or package_status requests return manifest identity, VSIX command, activation routes, command contributions, configuration keys, runtime load state, and strict webview security readiness without installing packages, starting Codex, opening sockets, changing settings, exposing secrets, or mutating files.'),
		contextTool('context.backendLaunchStatus', 'Read backend launch readiness', 'Backend agent/getBackendLaunchStatus, agent/backendLaunchStatus, backend/launchStatus, bridge/launchStatus, backend_launch_status, app_server_status, or codex_app_server_status requests return redacted stdio/pipe/websocket launch-route readiness, selected transport/framing, route blockers, bridge state, and next action without starting processes, opening sockets, sending JSON-RPC, or mutating files.'),
		contextTool('context.protocolStatus', 'Read JSON-RPC protocol status', 'Backend agent/getProtocolStatus, agent/protocolStatus, protocol/status, bridge/status, protocol_status, or jsonrpc_status requests return redacted bridge health, handshake capability readiness, handshake contract coverage, handshake/transport/framing state, pending request counts, recent lifecycle events, and method names without sending JSON-RPC requests, replaying agent/initialize, reconnecting transports, approving plans, or executing tools.'),
		contextTool('context.runtimeReadinessStatus', 'Read combined runtime readiness', 'Backend agent/getRuntimeReadinessStatus, agent/runtimeReadinessStatus, runtime/readinessStatus, runtime/status, runtime_readiness_status, runtime_status, agent_runtime_status, or startup_status requests combine provider/model route, backend launch configuration, bridge connection, transport health, backend handshake, and protocol health into one redacted startup route without changing settings, starting processes, opening sockets, sending JSON-RPC, approving plans, unlocking mutation, or mutating files.'),
		contextTool('context.clientState', 'Read redacted client state', 'Backend agent/getClientState, agent/clientState, client/state, get_client_state, or agent.getclientstate requests return mode, authorization summary, pending counts, tool catalog, delivery bar, final review, parallel state, and optional bounded protocol diagnostics without exposing API keys or approval tokens.'),
			contextTool('planning.taskBoardStatus', 'Inspect queued and delegated task board work', 'Backend agent/getTaskBoardStatus, agent/taskBoardStatus, taskBoard/status, task_board_status, agent/getTaskIntakeStatus, task/intakeStatus, or task_intake_status requests return redacted queued/dependent Task Board cards, source/intake counts for sidebar/uri/connector/scheduled/headless/delegated work, ready/running/blocked queue ids, dependency readiness, guardrails, and optional prompt/evidence context without creating, starting, completing, or archiving tasks. Cline-compatible new_task/delegate_task/use_subagents requests only queue cards and never start execution, prepare worktrees, or unlock mutation.'),
			contextTool('planning.taskStartStatus', 'Read Task Board start readiness', 'Backend agent/getTaskStartStatus, agent/taskStartStatus, task/startStatus, taskBoard/startStatus, task_start_status, or task_board_start_status requests preflight whether a queued/delegated/external card can begin visual Plan Mode, returning dependency blockers, start route, redacted visualPlanSeed, plan-only handoff, source, and parallel lane count without starting cards, approving plans, preparing worktrees, or mutating files.'),
			contextTool('planning.externalIntakeStatus', 'Read external intake route capabilities', 'Backend agent/getExternalIntakeStatus, agent/externalIntakeStatus, externalIntake/status, intake/status, external_intake_status, connector_intake_status, scheduled_intake_status, or headless_intake_status requests return Cline-style URI/connector/scheduled/headless/delegated route groups, accepted payload/query keys, start semantics, queue counts, parallel limits, and guardrails without creating, starting, completing, archiving, or mutating Task Board cards.'),
			contextTool('planning.connectorScheduleStatus', 'Read connector and scheduled intake readiness', 'Backend agent/getConnectorStatus, agent/connectorStatus, connector/status, agent/getScheduledAgentStatus, schedule/status, automation/status, headless/status, connector_status, scheduled_agent_status, automation_status, or headless_agent_status requests return Slack/Telegram/Discord/Google Chat/WhatsApp/Linear/Jira/GitHub/GitLab/email/webhook/cron/headless intake routes, queue evidence, and guardrails without connecting accounts, creating schedules, queuing cards, starting tasks, approving plans, or mutating files.'),
		contextTool('review.diffValidation', 'Validate candidate diffs', 'Backend agent/validateDiff, agent/diffValidation, diff/validate, patch/validate, diff_validate, validate_diff, patch_validate, or validate_patch requests inspect proposed file edits, paths, unified diff hunks, SEARCH/REPLACE blocks, duplicate paths, counts, and repair hints without creating review cards, writing files, accepting diffs, restoring checkpoints, or unlocking execution.'),
		contextTool('review.diffStatus', 'Read active diff review and checkpoint status', 'Backend agent/getDiffReviewStatus, agent/diffReviewStatus, diff/status, or diff_review_status requests return active multi-file diff decisions, pending counts, checkpoint ids, atomicReview merge/completion/rollback readiness, optional atomic review model with available actions/checkpoint coverage/line stats, and optional redacted patch previews without accepting, rejecting, or restoring files.'),
		contextTool('review.diffFileStatus', 'Read focused diff file status', 'Backend agent/getDiffFileStatus, agent/diffFileStatus, diff/fileStatus, diff/focusStatus, diff_file_status, or diff_focus_status requests return a focused diff file decision, patch kind/stats, checkpoint coverage, sibling paths, available actions, and next action without accepting, rejecting, restoring, writing, staging, or mutating files.'),
		contextTool('review.diffReapplyStatus', 'Read diff reapply readiness', 'Backend agent/getDiffReapplyStatus, agent/diffReapplyStatus, diff/reapplyStatus, diff/repairStatus, diff_reapply_status, or diff_repair_status requests combine active diff-file state with candidate diff validation to choose repair, replace, or submit-new-review routing without creating review cards, replacing files, accepting diffs, restoring checkpoints, writing, staging, or mutating files.'),
		contextTool('review.checkpointStatus', 'Read checkpoint and rollback status', 'Backend agent/getCheckpointStatus, agent/checkpointStatus, checkpoint/status, rollback/status, rollback_status, or task_checkpoint_status requests return task checkpoint id, file checkpoint counts, redacted paths, git checkpoint metadata, and accepted-file coverage without restoring, deleting, writing, staging, committing, or branching.'),
		contextTool('review.rollbackRestoreStatus', 'Read rollback restore readiness', 'Backend agent/getRollbackRestoreStatus, agent/rollbackRestoreStatus, rollback/restoreStatus, checkpoint/restoreStatus, diff/restoreStatus, rollback_restore_status, checkpoint_restore_status, restore_checkpoint_status, task_rollback_status, or diff_restore_status requests preflight task/file restore readiness, accepted-file checkpoint coverage, blockers, and visible restore route without restoring checkpoints, writing, deleting, accepting diffs, rejecting diffs, staging, committing, branching, or unlocking execution.'),
		contextTool('review.commitHandoffStatus', 'Read commit handoff status', 'Backend agent/getCommitHandoffStatus, agent/commitHandoffStatus, commit/status, commit_handoff_status, or workspace_commit_status requests return accepted files, blockers, redacted commit message, evidence, and prepared git commands without staging, committing, branching, writing, restoring, or merging files.'),
		contextTool('review.autoCommitStatus', 'Read auto-commit readiness', 'Backend agent/getAutoCommitStatus, agent/autoCommitStatus, autoCommit/status, commit/autoStatus, auto_commit_status, or workspace_auto_commit_status requests return opt-in auto-commit readiness, Final Review and Commit Handoff state, blockers, evidence, and prepared git commands without staging, committing, pushing, creating branches, opening PRs, writing, restoring, or merging files.'),
		parallelReadTool('parallel.status', 'Read parallel agent lane status', 'Backend agent/getParallelStatus, agent/parallelStatus, or parallel/status requests return the active 8-lane worktree plan, reported results, judge recommendation, merge readiness, and blockers without preparing, cleaning, or merging worktrees.'),
		parallelReadTool('parallel.worktreeStatus', 'Read parallel worktree lifecycle readiness', 'Backend agent/getParallelWorktreeStatus, agent/parallelWorktreeStatus, parallel/worktreeStatus, worktree/status, parallel_worktree_status, worktree_status, or parallel_lane_status requests return workspace trust, exact-plan authorization, mode lock, root/path/branch safety, lane materialization states, and prepare/cleanup readiness without creating, cleaning, checking out, merging, staging, or mutating worktrees.'),
		parallelReadTool('parallel.laneExecutionStatus', 'Read parallel lane dispatch readiness', 'Backend agent/getParallelLaneExecutionStatus, agent/parallelLaneExecutionStatus, parallel/laneExecutionStatus, parallel/dispatchStatus, parallel_lane_execution_status, lane_execution_status, or parallel_dispatch_status requests return the selected/auto lane route, exact-plan and mode gates, worktree materialization, branch/path safety, result state, judge-review link, and next action without dispatching agents, preparing worktrees, running commands, writing files, or mutating worktrees.'),
		parallelReadTool('parallel.dispatchPlan', 'Read parallel dispatch queue', 'Backend agent/getParallelDispatchPlan, agent/parallelDispatchPlan, parallel/dispatchPlan, parallel/dispatchQueue, parallel_dispatch_plan, parallel_dispatch_queue, or dispatch_parallel_agents requests return the plan-gated dispatch route, per-lane dispatch requests, expected agent/parallelResult callback, blockers, and guardrails without dispatching agents, preparing worktrees, running commands, writing files, or mutating worktrees.'),
		gatedTool(input, 'parallel.dispatchLane', 'Dispatch isolated parallel lane', 'terminal', 'Backend agent/dispatchParallelLane, parallel/dispatchLane, dispatch_parallel_lane, parallel_dispatch_lane, or run_parallel_lane requests create a visible approval card, run Codex in the materialized lane worktree only after exact visual-plan authorization, and convert terminal completion into agent/parallelResult evidence for judge review.'),
		parallelReadTool('parallel.reviewStatus', 'Read parallel judge review status', 'Backend agent/getParallelReviewStatus, agent/parallelReviewStatus, parallel/reviewStatus, parallel/judgeStatus, parallel_review_status, or parallel_judge_status requests return redacted lane rankings, scores, missing lanes, judge recommendation, merge readiness, and blockers without selecting lanes, preparing worktrees, requesting merge-back, applying diffs, or cleaning worktrees.'),
		parallelReadTool('parallel.mergeStatus', 'Read parallel merge-back status', 'Backend agent/getParallelMergeStatus, agent/parallelMergeStatus, parallel/mergeStatus, or parallel_merge_status requests return the selected lane, recommended lane, plan authorization, selected-result summary, merge blockers, and a review-first diff handoff contract without requesting or applying a merge.'),
		gatedTool(input, 'file.proposeDiff', 'Propose file edits through diff review', 'file', 'Backend file changes, including Cline editor edit/write/replace requests, must arrive as reviewable patches and be accepted by the developer before workspace writes apply.'),
		gatedTool(input, 'file.delete', 'Delete workspace files with checkpoint rollback', 'file', 'delete_file tool calls are approval-gated, workspace-sandboxed, ignored-path aware, and create file checkpoints before deletion.'),
		gatedTool(input, 'diff.accept', 'Accept or reject reviewed diffs', 'diff', 'Diff decisions are blocked until the exact visual plan revision is approved.'),
		gatedTool(input, 'terminal.run', 'Run terminal/test commands', 'terminal', 'Visible VS Code pseudoterminal runs capture output, stream agent/terminalOutput deltas, record exit status, diagnostics, verification evidence, backend terminal proceed/interrupt/retry control, command_output reads, and Cline-compatible execute_command/run_command/run_commands/bash/shell tool calls.'),
		gatedTool(input, 'tool.generic', 'Run generic backend tools', 'tool', 'Generic tool calls are approval-gated and must stay attached to the approved plan revision.'),
		gatedTool(input, 'web.fetch', 'Fetch or search web context', 'tool', 'Safe HTTP(S) GET, fetch_web_content, and web_search requests are approval-gated, capped, redacted, and returned to the backend as text.'),
		contextTool('browser.status', 'Read browser controller support status', 'Backend agent/getBrowserStatus, agent/browserStatus, browser/status, browser_status, or browser_capability_status requests return supported external browser actions, native-controller-required actions, pending browser approvals, and approval readiness without opening browsers, navigating, clicking, typing, scrolling, screenshotting, closing tabs, or mutating files.'),
		contextTool('browser.actionStatus', 'Read browser action evidence and controller handoff status', 'Backend agent/getBrowserActionStatus, agent/browserActionStatus, browser/actionStatus, browser/controllerStatus, browser_action_status, browser_controller_status, or browser_handoff_status requests return pending and recent browser action outcomes, supported open/navigate starts, blocked/declined decisions, and native-controller-required handoffs without opening browsers, controlling pages, approving actions, or mutating files.'),
		gatedTool(input, 'browser.openNavigate', 'Open or navigate loopback/browser targets', 'browser', 'External installs approve safe open/navigate requests; richer browser control requires the native VibeCode controller.'),
		contextTool('mcp.status', 'Read MCP server status', 'Backend agent/getMcpStatus, agent/mcpStatus, mcp/status, mcp_status, or mcp_server_status requests return redacted workspace MCP catalog readiness, requested-server scope, unknown/global guidance, enabled/disabled counts, transports, pending approval counts, and guardrails without executing MCP tools/resources or approving requests.'),
		contextTool('mcp.documentation', 'Load MCP documentation', 'Backend can request load_mcp_documentation to receive read-only MCP usage guidance plus the current redacted workspace MCP server catalog.'),
		gatedTool(input, 'mcp.call', 'Call MCP tools/resources', 'mcp', mcpDetail(input.mcpCatalog)),
		gatedTool(input, 'hook.run', 'Run approved workspace hooks', 'terminal', 'Hook run requests must match indexed workspace hook manifests, pass command permissions, and execute through the visible terminal after exact plan approval.'),
		gatedTool(input, 'preview.start', 'Start localhost preview', 'terminal', previewDetail(input.previewPlan)),
		gatedTool(input, 'parallel.prepareWorktrees', 'Prepare isolated parallel worktrees', 'tool', parallelDetail(input.parallelPlan)),
		contextTool('verification.status', 'Read verification and Delivery Bar status', 'Backend agent/getVerificationStatus, agent/verificationStatus, verification/status, or verification_status requests return verification checks, diagnostics evidence, Delivery Bar, Smoke Benchmark, Final Review, and optional terminal-run tails without running checks or accepting task completion.'),
		contextTool('verification.acceptanceCriteriaStatus', 'Read acceptance criteria verification readiness', 'Backend agent/getAcceptanceCriteriaStatus, agent/acceptanceCriteriaStatus, acceptance/status, acceptanceCriteria/status, verification/acceptanceStatus, acceptance_criteria_status, acceptance_status, or plan_acceptance_status requests return plan acceptance criteria coverage, linked required verification checks, blockers, counts, and redacted evidence without marking criteria passed, running checks, editing plans, approving execution, accepting completion, or mutating files.'),
		contextTool('verification.executionGateStatus', 'Read execution gate routing status', 'Backend agent/getExecutionGateStatus, agent/executionGateStatus, execution/gateStatus, execution_gate_status, mutation_gate_status, or approval_gate_status requests combine active visual-plan validity, exact approval authorization, proposed tool-call preflight, pending approvals, and diff review counts to return the next safe execution route without creating approvals, submitting diffs, running terminals, accepting diffs, or mutating files.'),
		contextTool('verification.smokeBenchmarkStatus', 'Read Smoke Benchmark lifecycle proof', 'Backend agent/getSmokeBenchmarkStatus, agent/smokeBenchmarkStatus, smokeBenchmark/status, smoke/status, smoke_benchmark_status, smoke_status, or e2e_smoke_status requests return native prompt, visual plan, manual plan adjustment, approval, parallel safety, terminal verification, multi-file diff, rollback, commit handoff, and Delivery Bar milestone readiness without approving plans, running checks, accepting diffs, staging commits, accepting completion, or mutating files.'),
		contextTool('verification.deliveryBarStatus', 'Read Delivery Bar gate status', 'Backend agent/getDeliveryBarStatus, agent/deliveryBarStatus, deliveryBar/status, delivery/gateStatus, delivery_bar_status, delivery_gate_status, or delivery_readiness_status requests return current Delivery Bar readiness, path-accurate rollback checkpoint blockers, required check blockers, counts, next action, and optional prompt block without running checks, accepting completion, changing Final Review, staging commits, or mutating files.'),
		contextTool('verification.taskCompletionStatus', 'Read task completion gate status', 'Backend agent/getTaskCompletionStatus, agent/taskCompletionStatus, completion/status, completion/gateStatus, task_completion_status, or completion_gate_status requests return the current Final Review completion gate, latest completion attempt, blockers, counts, redacted evidence, and next action without accepting completion, running checks, staging commits, or mutating files.'),
		contextTool('verification.taskCompletion', 'Gate backend task completion', 'Backend attempt_completion, submit_and_exit, or agent/taskComplete requests must pass Delivery Bar, Smoke Benchmark, Commit Handoff, and Final Review before the task is marked completed.'),
		contextTool('verification.finalReview', 'Read Final Review delivery decision', 'Backend agent/getFinalReviewStatus, agent/finalReviewStatus, finalReview/status, final_review_status, or get_final_review_status requests return the strict pass/block decision, item evidence, redacted prompt block, and next action without accepting task completion, running checks, staging commits, or mutating files.'),
		contextTool('verification.workflowStatus', 'Read end-to-end workflow lifecycle proof', 'Backend agent/getWorkflowStatus, agent/workflowStatus, workflow/status, delivery/workflowStatus, workflow_status, delivery_workflow_status, or lifecycle_status requests return prompt -> visual plan -> approval -> execution -> terminal verification -> diff review -> path-accurate rollback checkpoint coverage -> commit handoff -> Final Review readiness, counts, milestones, redacted evidence, and next action without approving plans, running tools, accepting diffs, restoring checkpoints, staging commits, or mutating files.'),
		contextTool('verification.happyPathStatus', 'Read compact Happy Path Proof route', 'Backend agent/getHappyPathStatus, agent/happyPathStatus, workflow/happyPathStatus, delivery/happyPathStatus, happy_path_status, delivery_proof_status, workflow_happy_path_status, or e2e_workflow_status requests compose Workflow Proof, Smoke Benchmark, Delivery Bar, Final Review, and parallel lane readiness into one next-gate route without approving plans, dispatching agents, running tools, accepting diffs, restoring checkpoints, accepting completion, staging commits, or mutating files.'),
	];
	return {
		version: 1,
		updatedAt: Date.now(),
		mode: input.modePolicy.mode,
		modeSummary: modePolicySummary(input.modePolicy),
		bridgeConnected: input.bridgeConnected,
		executionAuthorized: input.hasExecutionAuthorization,
		tools,
	};
}

export function toolCatalogSummary(catalog: VibeCodexToolCatalog): string {
	const available = catalog.tools.filter(tool => tool.available).length;
	const blocked = catalog.tools.filter(tool => !tool.available).length;
	const approval = catalog.tools.filter(tool => tool.requiresApproval).length;
	return `${available}/${catalog.tools.length} tools available; ${blocked} blocked; ${approval} approval-gated. Mode: ${catalog.mode}. Bridge: ${catalog.bridgeConnected ? 'connected' : 'not connected'}.`;
}

export function toolCatalogPromptBlock(catalog: VibeCodexToolCatalog): string {
	return JSON.stringify(redactSensitiveValue({
		version: catalog.version,
		mode: catalog.mode,
		modeSummary: catalog.modeSummary,
		bridgeConnected: catalog.bridgeConnected,
		executionAuthorized: catalog.executionAuthorized,
		tools: catalog.tools,
		note: 'This is the Vibe Codex client tool catalog. Mutating tools remain blocked unless available=true and the request includes the approved plan authorization when required.',
	}), null, 2);
}

export function toolCatalogSignature(catalog: VibeCodexToolCatalog): string {
	return JSON.stringify({
		mode: catalog.mode,
		bridgeConnected: catalog.bridgeConnected,
		executionAuthorized: catalog.executionAuthorized,
		tools: catalog.tools.map(tool => ({
			id: tool.id,
			available: tool.available,
			requiresApproval: tool.requiresApproval,
			requiresPlanApproval: tool.requiresPlanApproval,
			blockedReason: tool.blockedReason,
		})),
	});
}

function contextTool(id: string, title: string, detail: string): VibeCodexToolCatalogEntry {
	return {
		id,
		title,
		category: id.startsWith('planning.') ? 'planning' : id.startsWith('verification.') ? 'verification' : id.startsWith('review.') ? 'review' : id.startsWith('mcp.') ? 'mcp' : 'context',
		available: true,
		requiresApproval: false,
		requiresPlanApproval: false,
		detail,
	};
}

function parallelReadTool(id: string, title: string, detail: string): VibeCodexToolCatalogEntry {
	return {
		id,
		title,
		category: 'parallel',
		available: true,
		requiresApproval: false,
		requiresPlanApproval: false,
		detail,
	};
}

function gatedTool(input: VibeCodexToolCatalogInput, id: string, title: string, action: VibeCodexSensitiveAction, detail: string): VibeCodexToolCatalogEntry {
	const modeAllowed = modeAllowsAction(input.modePolicy, action);
	const authorized = !input.modePolicy.requiresPlanApproval || input.hasExecutionAuthorization;
	const backendAvailable = id.startsWith('parallel.') || id.startsWith('preview.') ? true : input.bridgeConnected || id === 'terminal.run' || id === 'diff.accept' || id === 'file.proposeDiff';
	const available = modeAllowed && authorized && backendAvailable;
	const blockedReason = !modeAllowed
		? `${input.modePolicy.label} Mode blocks ${action} tools.`
		: !authorized
			? 'Approve the exact visual plan revision before this tool can run.'
			: !backendAvailable
				? 'Connect Codex app-server before backend-dependent tool calls can run.'
				: undefined;
	return {
		id,
		title,
		category: toolCategory(action, id),
		available,
		requiresApproval: true,
		requiresPlanApproval: input.modePolicy.requiresPlanApproval,
		sensitiveAction: action,
		detail,
		...(blockedReason ? { blockedReason } : {}),
	};
}

function toolCategory(action: VibeCodexSensitiveAction, id: string): VibeCodexToolCatalogCategory {
	if (id.startsWith('parallel.')) {
		return 'parallel';
	}
	if (id.startsWith('preview.')) {
		return 'terminal';
	}
	if (id.startsWith('web.')) {
		return 'web';
	}
	if (id.startsWith('hook.')) {
		return 'hook';
	}
	switch (action) {
		case 'file':
		case 'diff':
			return 'file';
		case 'terminal':
			return 'terminal';
		case 'browser':
			return 'browser';
		case 'mcp':
			return 'mcp';
		default:
			return 'review';
	}
}

function mcpDetail(catalog: VibeCodexMcpCatalog | undefined): string {
	const servers = catalog?.servers ?? [];
	const enabled = servers.filter(server => !server.disabled);
	return servers.length
		? `${servers.length} MCP server${servers.length === 1 ? '' : 's'} detected; ${enabled.length} enabled. Disabled servers remain blocked.`
		: 'No workspace MCP servers detected; backend MCP calls will still require explicit approval if requested.';
}

function previewDetail(plan: VibeCodexPreviewPlan | undefined): string {
	const previews = plan?.previews ?? [];
	return previews.length
		? `${previews.length} localhost preview target${previews.length === 1 ? '' : 's'} detected. Backend start_preview, agent/startPreview, or preview/start requests can start only detected targets through visible terminal approval.`
		: 'No preview scripts detected; backend can still propose an arbitrary command only through approval-gated execute_command.';
}

function parallelDetail(plan: VibeCodexParallelPlan | undefined): string {
	return plan && plan.requestedThreads > 1
		? `${plan.requestedThreads} isolated git-worktree lanes requested under ${plan.worktreeRoot ?? '.vibecodex/worktrees'}.`
		: 'Single-lane task; parallel worktree preparation is optional.';
}
