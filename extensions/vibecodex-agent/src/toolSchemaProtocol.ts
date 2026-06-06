/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexToolCatalog } from './toolCatalog';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexToolSchemaCategory = 'context' | 'planning' | 'file' | 'terminal' | 'web' | 'browser' | 'mcp' | 'hook' | 'parallel' | 'verification' | 'review';
export type VibeCodexToolSchemaFormat = 'openai' | 'anthropic' | 'vibecodex';

export interface VibeCodexToolSchemaRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly format: VibeCodexToolSchemaFormat;
	readonly category?: VibeCodexToolSchemaCategory;
	readonly includeParameters: boolean;
	readonly includeUnavailable: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexJsonSchema {
	readonly type: 'object';
	readonly properties: Record<string, unknown>;
	readonly required?: readonly string[];
	readonly additionalProperties?: boolean;
}

export interface VibeCodexToolSchemaEntry {
	readonly name: string;
	readonly title: string;
	readonly category: VibeCodexToolSchemaCategory;
	readonly description: string;
	readonly toolCatalogId: string;
	readonly aliases: readonly string[];
	readonly available: boolean;
	readonly requiresApproval: boolean;
	readonly requiresPlanApproval: boolean;
	readonly mutatesWorkspace: boolean;
	readonly blockedReason?: string;
	readonly parameters?: VibeCodexJsonSchema;
	readonly openaiTool?: {
		readonly type: 'function';
		readonly function: {
			readonly name: string;
			readonly description: string;
			readonly parameters?: VibeCodexJsonSchema;
		};
	};
	readonly anthropicTool?: {
		readonly name: string;
		readonly description: string;
		readonly input_schema?: VibeCodexJsonSchema;
	};
}

export interface VibeCodexToolSchemaResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly format: VibeCodexToolSchemaFormat;
	readonly category?: VibeCodexToolSchemaCategory;
	readonly counts: {
		readonly total: number;
		readonly available: number;
		readonly approvalRequired: number;
		readonly planApprovalRequired: number;
		readonly mutating: number;
	};
	readonly schemas: readonly VibeCodexToolSchemaEntry[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexToolSchemaManifest {
	readonly ok: true;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly taskId?: string;
	readonly revision?: number;
	readonly preferredFormat: VibeCodexToolSchemaFormat;
	readonly formats: {
		readonly openai: VibeCodexToolSchemaResponse;
		readonly anthropic: VibeCodexToolSchemaResponse;
		readonly vibecodex: VibeCodexToolSchemaResponse;
	};
	readonly counts: {
		readonly total: number;
		readonly available: number;
		readonly approvalRequired: number;
		readonly planApprovalRequired: number;
		readonly mutating: number;
	};
	readonly toolNames: readonly string[];
	readonly guardrails: readonly string[];
	readonly message: string;
}

interface ToolSchemaDefinition {
	readonly name: string;
	readonly title: string;
	readonly category: VibeCodexToolSchemaCategory;
	readonly description: string;
	readonly toolCatalogId: string;
	readonly aliases?: readonly string[];
	readonly mutatesWorkspace?: boolean;
	readonly parameters: VibeCodexJsonSchema;
}

const toolSchemaMethods = new Set([
	'agent/getToolSchemas',
	'agent/toolSchemas',
	'agent/listTools',
	'tools/list',
	'tools/schema',
	'tool/schema',
	'vibecodex/toolSchemas',
]);

const toolSchemaToolNames = new Set([
	'tool_schema',
	'tool_schemas',
	'get_tool_schema',
	'get_tool_schemas',
	'list_tools',
	'list_available_tools',
]);

const noProperties = schema({});
const pathProperty = { type: 'string', description: 'Workspace-relative path. Absolute paths and ignored/out-of-workspace paths are rejected.' };
const maxResultsProperty = { type: 'integer', minimum: 1, maximum: 200, description: 'Maximum number of results to return.' };
const suggestionItemProperty = { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }], description: 'Either a plain suggestion string or a Cline-style object with label/text/value/id/description fields.' };

const toolSchemaDefinitions: readonly ToolSchemaDefinition[] = [
	def('read_file', 'Read file', 'context', 'Read one or more workspace files with optional one-based line range bounds. Returns capped, redacted text only. Cline start_line/end_line and file_path aliases are normalized during tool-call preflight.', 'context.readFile', ['read_files', 'editor.read', 'open_file', 'view_file'], schema({
		path: pathProperty,
		paths: { type: 'array', items: pathProperty, description: 'Workspace-relative paths to read.' },
		startLine: { type: 'integer', minimum: 1 },
		endLine: { type: 'integer', minimum: 1 },
	}, ['paths'])),
	def('list_dir', 'List directory', 'context', 'List bounded workspace directory entries while honoring Vibe Codex ignore policy.', 'context.listFiles', ['list_files', 'list_directory'], schema({
		path: { ...pathProperty, default: '.' },
		recursive: { type: 'boolean', default: false },
		maxResults: maxResultsProperty,
	})),
	def('search_files', 'Search files', 'context', 'Search workspace files with literal or regex matching and capped line previews. Cline regex/file_pattern/max_results aliases are normalized during tool-call preflight.', 'context.searchFiles', ['grep_search', 'search', 'ripgrep', 'regex_search', 'workspace_search'], schema({
		query: { type: 'string', description: 'Literal text or regex pattern.' },
		path: { type: 'string', description: 'Optional workspace-relative file or folder scope.' },
		filePattern: { type: 'string', description: 'Optional Cline-style file glob/pattern hint preserved for backend routing.' },
		isRegex: { type: 'boolean', default: false },
		caseSensitive: { type: 'boolean', default: false },
		maxResults: maxResultsProperty,
	}, ['query'])),
	def('semantic_search', 'Semantic/codebase search', 'context', 'Rank workspace files by identifier, path, and token overlap for codebase exploration.', 'context.searchFiles', ['codebase_search', 'search_codebase'], schema({
		query: { type: 'string' },
		path: { type: 'string', description: 'Optional workspace-relative scope.' },
		maxResults: maxResultsProperty,
	}, ['query'])),
	def('workspace_read_status', 'Workspace read evidence status', 'context', 'Inspect cached read_file/list_dir/search_files/semantic_search evidence, counts, sample paths/previews, and guardrails without reading files, searching, invoking providers, approving plans, or mutating files.', 'context.workspaceReadStatus', ['workspace_search_status', 'codebase_search_status', 'read_tool_status', 'context_evidence_status', 'agent/getWorkspaceReadStatus', 'workspace/readStatus', 'workspace/searchStatus'], schema({
		kind: { type: 'string', enum: ['read_file', 'list_dir', 'search_files', 'semantic_search'], description: 'Optional read/search tool kind filter.' },
		includeEvents: { type: 'boolean', default: true, description: 'Include bounded recent cached evidence events.' },
		includeSamples: { type: 'boolean', default: true, description: 'Include bounded file/path/search-hit samples without full file text.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted cached-evidence prompt block.' },
		maxEvents: { type: 'integer', minimum: 0, maximum: 40, default: 8 },
		maxSamples: { type: 'integer', minimum: 0, maximum: 20, default: 6 },
	})),
	def('list_code_definition_names', 'List code definitions', 'context', 'Return capped VS Code document-symbol definitions for a workspace file or folder.', 'context.codeDefinitions', ['list_symbols'], schema({
		path: pathProperty,
		maxResults: maxResultsProperty,
	}, ['path'])),
	def('vscode_references', 'Find references', 'context', 'Return capped VS Code reference-provider locations for a workspace file position while honoring workspace ignore rules. Read-only and does not unlock mutation.', 'context.references', ['find_references', 'usages', 'find_usages', 'workspace/references'], schema({
		path: pathProperty,
		line: { type: 'integer', minimum: 1, description: 'One-based line number.' },
		column: { type: 'integer', minimum: 1, description: 'One-based column number.' },
		includeDeclaration: { type: 'boolean', default: true },
		maxResults: maxResultsProperty,
	}, ['path', 'line', 'column'])),
	def('workspace_symbols', 'Search workspace symbols', 'context', 'Return capped VS Code workspace-symbol provider results while honoring workspace ignore rules. Read-only and does not read file text or unlock mutation.', 'context.workspaceSymbols', ['symbol_search', 'workspace_symbol_search', 'symbols_search', 'find_symbols', 'workspace/symbols'], schema({
		query: { type: 'string', description: 'Symbol query to send to VS Code workspace symbol providers.' },
		maxResults: maxResultsProperty,
	}, ['query'])),
	def('get_diagnostics', 'Get diagnostics', 'context', 'Read current VS Code Problems diagnostics with optional path and severity filters.', 'context.diagnostics', ['diagnostics'], schema({
		path: { type: 'string', description: 'Optional workspace-relative file/folder scope.' },
		severity: { type: 'string', enum: ['error', 'warning', 'information', 'hint'] },
		maxResults: maxResultsProperty,
	})),
	def('git_status', 'Git status', 'context', 'Read sanitized git status for trusted workspace repositories through shell-free git arguments.', 'context.git', ['git_diff', 'git_log'], schema({
		path: { type: 'string', description: 'Optional workspace-relative path for git diff/log context.' },
		maxResults: maxResultsProperty,
	})),
	def('command_output', 'Read terminal output', 'context', 'Return capped, redacted output tail for a captured terminal run without starting a command.', 'context.terminalOutput', ['terminal_output', 'get_terminal_output'], schema({
		runId: { type: 'string', description: 'Known Vibe Codex terminal run id. Omit with latest=true to inspect the latest run.' },
		latest: { type: 'boolean', default: true },
		maxBytes: { type: 'integer', minimum: 1, maximum: 20000 },
	})),
	def('terminal_insight_status', 'Read terminal insights', 'context', 'Return classified terminal findings, summaries, signatures, local preview URLs, and optional redacted follow-up prompts without raw output tails or terminal control.', 'context.terminalInsights', ['terminal_insights', 'get_terminal_insight_status', 'terminal_findings', 'agent/getTerminalInsightStatus'], schema({
		runId: { type: 'string', description: 'Known Vibe Codex terminal run id. Omit with latest=true to inspect the latest classified insight.' },
		latest: { type: 'boolean', default: true },
		includeFindings: { type: 'boolean', default: false, description: 'Include redacted classified findings and follow-up prompt.' },
		maxFindings: { type: 'integer', minimum: 0, maximum: 32 },
	})),
	def('terminal_remediation_status', 'Read terminal remediation status', 'context', 'Inspect terminal-failure remediation plan revisions, triggering run/finding metadata, verification linkage, and execution-lock state without retrying commands, editing files, approving plans, or changing verification checks.', 'context.terminalRemediationStatus', ['get_terminal_remediation_status', 'terminal_failure_status', 'failure_remediation_status', 'agent/getTerminalRemediationStatus'], schema({
		taskId: { type: 'string', description: 'Optional visual-plan task id to filter remediation events.' },
		runId: { type: 'string', description: 'Optional captured terminal run id to inspect.' },
		includePlan: { type: 'boolean', default: false, description: 'Include the redacted active plan snapshot.' },
		includeEvidence: { type: 'boolean', default: false, description: 'Include redacted terminal/diagnostic evidence captured for remediation.' },
		maxEvents: { type: 'integer', minimum: 1, maximum: 24, default: 8 },
	})),
	def('symbol_index_status', 'Read cached symbol index status', 'context', 'Inspect cached VS Code symbol counts, kind summaries, and optional capped entries without gathering fresh files, invoking symbol providers, reading file text, or mutating workspace state.', 'context.symbolIndexStatus', ['get_symbol_index_status', 'symbol_status', 'symbols_status', 'code_symbols_status', 'agent/getSymbolIndexStatus'], schema({
		path: { type: 'string', description: 'Optional path substring to filter cached symbol entries.' },
		query: { type: 'string', description: 'Optional symbol name/container/path search terms.' },
		kind: { type: 'string', description: 'Optional exact symbol kind filter such as class, function, method, or interface.' },
		includeEntries: { type: 'boolean', default: false, description: 'Include capped redacted cached symbol entries.' },
		includePromptBlock: { type: 'boolean', default: false, description: 'Include a bounded redacted symbol-index prompt block.' },
		maxItems: { type: 'integer', minimum: 0, maximum: 120, default: 24 },
	})),
	def('command_validate', 'Validate terminal command candidate', 'context', 'Classify a terminal command candidate, command permission policy, Mode Policy readiness, cwd sandbox state, verification linkage, and repair hints without creating approval cards, running terminals, interrupting/retrying commands, approving plans, or unlocking execution.', 'context.terminalCommandValidation', ['validate_command', 'terminal_validate', 'terminal_command_validate', 'shell_validate', 'agent/validateCommand', 'command/validate', 'terminal/validate'], schema({
		command: { type: 'string', description: 'Candidate terminal command line to validate.' },
		cmd: { type: 'string', description: 'Alias for command.' },
		commandLine: { type: 'string', description: 'Alias for command.' },
		commands: { type: 'array', items: { type: 'string' }, description: 'Cline run_commands-style command list; normalized into one visible approval candidate joined with &&.' },
		cwd: { type: 'string', description: 'Optional workspace-relative working directory candidate.' },
		reason: { type: 'string', description: 'Why the backend wants to run this command.' },
		verificationCheckId: { type: 'string', description: 'Optional verification check id that this command is expected to satisfy.' },
		includeCommand: { type: 'boolean', default: true, description: 'Include the redacted command in the response.' },
		includeRepairHints: { type: 'boolean', default: true, description: 'Include deterministic repair hints for blocked or risky commands.' },
	}, ['command'])),
	def('preview_status', 'Read preview status', 'context', 'Inspect detected preview targets, terminal-discovered loopback URLs, pending browser approvals, and execution authorization state without starting servers, opening browsers, fetching URLs, approving actions, or mutating files.', 'context.previewStatus', ['get_preview_status', 'localhost_preview_status', 'browser_preview_status', 'agent/getPreviewStatus'], schema({
		url: { type: 'string', description: 'Optional loopback preview URL to check against known targets and terminal-discovered URLs.' },
		includeTargets: { type: 'boolean', default: true, description: 'Include detected package-script preview targets.' },
		includeInsights: { type: 'boolean', default: true, description: 'Include capped terminal insight summaries that mention loopback URLs.' },
		maxInsights: { type: 'integer', minimum: 0, maximum: 24, default: 8 },
	})),
	def('terminal_status', 'Terminal status/control', 'terminal', 'Inspect captured terminal runs, request proceed-while-running for long-lived dev servers, or request interrupt/retry through the same approval and mode gates.', 'context.terminalOutput', ['terminal_interrupt', 'terminal_retry', 'terminal_proceed', 'continue_while_running', 'agent/terminalControl'], schema({
		action: { type: 'string', enum: ['status', 'interrupt', 'retry', 'proceed'] },
		runId: { type: 'string' },
		latest: { type: 'boolean', default: true },
		reason: { type: 'string' },
	}, ['action'])),
	def('submit_plan', 'Submit visual plan', 'planning', 'Submit or update the required VibeCodexPlan before any mutating tools are allowed. Addressed requests return validation errors, render counts, the rendered planHash, mutationLocked=true, and nextAction=await_user_approval. User refine/reject/manual-step-edit feedback stays mutation-locked with approved=false until a revised exact planHash is approved. Execution authorization includes approvedPlanHash, and same-revision content drift is treated as unapproved.', 'planning.visualPlan', ['agent/submitPlan', 'agent/updatePlan'], schema({
		taskId: { type: 'string' },
		revision: { type: 'integer', minimum: 1 },
		summary: { type: 'string' },
		strategy: { type: 'string' },
		flowchart: { type: 'string', description: 'Safe Mermaid graph TD or flowchart TD source.' },
		steps: { type: 'array', items: { type: 'object' } },
		risks: { type: 'array', items: { type: 'string' } },
		acceptanceCriteria: { type: 'array', items: { type: 'string' } },
	}, ['taskId', 'revision', 'summary', 'strategy', 'flowchart', 'steps'])),
	def('visual_plan_validate', 'Validate visual plan candidate', 'planning', 'Validate a candidate VibeCodexPlan schema, safe Mermaid graph, checklist flow-node links, dependencies, counts, and repair hints without rendering, approving, mutating, or unlocking execution.', 'planning.planValidation', ['validate_plan', 'plan_validate', 'plan_validation', 'check_plan', 'agent/validatePlan', 'plan/validate'], schema({
		plan: { description: 'Candidate VibeCodexPlan object, or a JSON string containing one.' },
		candidatePlan: { description: 'Alias for plan.' },
		includeCandidate: { type: 'boolean', default: false, description: 'Include the redacted candidate in the response.' },
		includeRepairHints: { type: 'boolean', default: true, description: 'Include deterministic repair hints for invalid or weak plans.' },
	})),
	def('plan_edit_status', 'Preview manual plan edit', 'planning', 'Preview a manual visual-plan checklist step title/status edit, prospective revision, planHash, changed fields, schema validity, graph linkage, and repair hints without editing the active plan, approving execution, or mutating files.', 'planning.planEditStatus', ['visual_plan_edit_status', 'validate_plan_edit', 'plan_step_edit_status', 'checklist_edit_status', 'agent/validatePlanEdit', 'agent/getPlanEditStatus', 'plan/editStatus', 'visualPlan/editStatus'], schema({
		stepId: { type: 'string', description: 'Active visual-plan checklist step id to preview editing.' },
		title: { type: 'string', description: 'Optional replacement step title.' },
		status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked', 'failed'], description: 'Optional replacement step status.' },
		includeEditedPlan: { type: 'boolean', default: false, description: 'Include the redacted prospective edited plan.' },
		includeRepairHints: { type: 'boolean', default: true, description: 'Include deterministic repair hints.' },
	}, ['stepId'])),
	def('plan_status', 'Visual plan status', 'planning', 'Inspect the active visual plan, schema validity, Mermaid render status, optional redacted graph/checklist render model, checklist-flow link coverage, approvalReady, mutationReady, approvalBlockedReason, approved revision match, and optional revision history without exposing approval tokens.', 'planning.visualPlan', ['get_plan_status', 'visual_plan_status', 'get_visual_plan_status', 'plan_render_status', 'get_plan_render_status', 'agent/getPlanStatus', 'agent/getVisualPlanStatus', 'plan/status', 'plan/renderStatus'], schema({
		includeHistory: { type: 'boolean', default: false, description: 'Include bounded redacted plan revision history.' },
		includeRenderModel: { type: 'boolean', default: false, description: 'Include redacted nodes, edges, checklist bindings, highlight bindings, and fallback source. Defaults true for plan_render_status aliases.' },
	})),
	def('plan_canvas_status', 'Visual plan canvas readiness', 'planning', 'Inspect the Plan Canvas offline/local SVG renderer contract, strict CSP/no-CDN proof, last-valid graph retention, cached graph evidence/counts, graph/checklist binding coverage, exact approval lock, blockers, and next route without changing UI focus, editing plans, approving execution, rendering remote scripts, or mutating files.', 'planning.planCanvasStatus', ['visual_plan_canvas_status', 'plan_render_canvas_status', 'mermaid_canvas_status', 'flowchart_canvas_status', 'agent/getPlanCanvasStatus', 'agent/planCanvasStatus', 'visualPlan/canvasStatus', 'plan/canvasStatus'], schema({
		includeFeatures: { type: 'boolean', default: true, description: 'Include renderer/security/focus/approval feature readiness cards.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted canvas-readiness prompt block.' },
	})),
	def('plan_focus_status', 'Visual plan focus status', 'planning', 'Inspect graph/checklist focus bindings for a step id, Mermaid flow node id, or related file without changing UI focus, editing plans, approving execution, or mutating files.', 'planning.planFocusStatus', ['visual_plan_focus_status', 'visual_plan_focus', 'flow_node_status', 'flowchart_node_status', 'checklist_focus_status', 'agent/getPlanFocusStatus', 'visualPlan/focusStatus', 'plan/focusStatus'], schema({
		stepId: { type: 'string', description: 'Optional checklist step id to validate and focus.' },
		flowNodeId: { type: 'string', description: 'Optional Mermaid node id / plan step flowNodeId to validate and focus.' },
		file: pathProperty,
		includeBindings: { type: 'boolean', default: true, description: 'Include all redacted graph/checklist focus bindings.' },
		includeGraph: { type: 'boolean', default: false, description: 'Include parsed redacted graph nodes and edges.' },
		includeFiles: { type: 'boolean', default: true, description: 'Include redacted related files from matched checklist steps and bindings.' },
		includeRepairHints: { type: 'boolean', default: true, description: 'Include deterministic repair hints for missing graph/checklist bindings.' },
	})),
	def('inline_prompt_status', 'Inline prompt status', 'planning', 'Inspect the active Ctrl/Cmd+K inline prompt session, target file/range, required visual plan steps, acceptance criteria, optional redacted prompt/context, and plan authorization match without gathering fresh editor text or mutating files.', 'planning.inlinePromptStatus', ['get_inline_prompt_status', 'ctrl_k_status', 'inline_context_status', 'agent/getInlinePromptStatus'], schema({
		includePrompt: { type: 'boolean', default: false, description: 'Include the redacted generated planning prompt.' },
		includeContext: { type: 'boolean', default: false, description: 'Include redacted selected text and nearby context captured when the inline prompt was created.' },
	})),
	def('approval_status', 'Pending approval status', 'planning', 'Inspect pending approval cards, risk, acceptance blockers, and redacted command/path details without accepting, declining, auto-approving, or exposing approval tokens.', 'context.approvalStatus', ['get_approval_status', 'pending_approvals', 'agent/getApprovalStatus', 'approval/status'], schema({
		approvalId: { type: 'string', description: 'Optional pending approval/card id to inspect.' },
		includeDetails: { type: 'boolean', default: false, description: 'Include redacted pending approval card details.' },
	})),
	def('action_approval_status', 'Action approval route status', 'planning', 'Preflight a proposed terminal/file/tool/browser/MCP/web/diff action against Mode Policy, exact visual-plan authorization, auto-approve configuration, tool schema validation, and terminal command validation without accepting, auto-approving, executing, opening browsers, calling MCP, accepting diffs, or mutating files.', 'context.actionApprovalStatus', ['auto_approve_status', 'autoapproval_status', 'approval_route_status', 'yolo_status', 'cline_action_status', 'agent/getActionApprovalStatus', 'action/approvalStatus', 'autoApprove/status'], schema({
		kind: { type: 'string', enum: ['terminal', 'file', 'tool', 'browser', 'mcp', 'web', 'diff', 'generic'], description: 'Optional action class. If omitted, it is inferred from toolName or command.' },
		toolName: { type: 'string', description: 'Candidate client/backend tool name or alias.' },
		targetTool: { type: 'string', description: 'Alias for toolName when action_approval_status is called as a tool.' },
		command: { type: 'string', description: 'Candidate terminal command.' },
		cmd: { type: 'string', description: 'Alias for command.' },
		commandLine: { type: 'string', description: 'Alias for command.' },
		commands: { type: 'array', items: { type: 'string' }, description: 'Cline run_commands-style command list; normalized into one reviewed terminal candidate.' },
		cwd: { type: 'string', description: 'Optional terminal cwd candidate.' },
		reason: { type: 'string', description: 'Reason shown in approval routing diagnostics.' },
		risk: { type: 'string', enum: ['low', 'medium', 'high', 'blocked'], description: 'Optional caller-provided risk hint.' },
		blocked: { type: 'boolean', default: false, description: 'Caller-known blocked state for the candidate action.' },
		arguments: { type: 'object', additionalProperties: true, description: 'Candidate tool arguments to validate.' },
		includeToolCall: { type: 'boolean', default: true, description: 'Include nested tool-call schema preflight when toolName is provided.' },
		includeTerminalValidation: { type: 'boolean', default: true, description: 'Include nested terminal command validation for terminal candidates.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted prompt block with route, blockers, and next action.' },
	})),
	def('tool_timeline_status', 'Tool timeline status', 'context', 'Inspect recent tool-related transcript events, pending approvals, terminal runs, and diff review counts without approving, executing, interrupting, retrying, accepting diffs, restoring checkpoints, or mutating files.', 'context.toolTimelineStatus', ['tool_timeline', 'activity_status', 'agent_activity_status', 'agent/getToolTimelineStatus', 'tool/timelineStatus'], schema({
		includeEvents: { type: 'boolean', default: true, description: 'Include bounded redacted transcript events for tool/approval/terminal/diff/verification/rollback activity.' },
		includeLiveState: { type: 'boolean', default: true, description: 'Include live pending approvals, terminal run summaries, and active diff review counts.' },
		includeDetails: { type: 'boolean', default: false, description: 'Include capped redacted event details, command lines, paths, and diff paths.' },
		maxEvents: { type: 'integer', minimum: 1, maximum: 80, default: 24 },
	})),
	def('notification_status', 'Notification and attention status', 'context', 'Inspect Cline-style notification policy, enabled/disabled attention channels, developer/runtime wait items, pending approval/diff/terminal counts, and long-running terminal notification state without showing notifications, changing settings, opening views, interrupting terminals, retrying commands, approving requests, accepting diffs, or mutating files.', 'context.notificationStatus', ['notifications_status', 'attention_status', 'human_attention_status', 'developer_attention_status', 'waiting_status', 'agent/getNotificationStatus', 'attention/status'], schema({
		includeItems: { type: 'boolean', default: true, description: 'Include bounded redacted plan/approval/diff/terminal attention items.' },
		includeDetails: { type: 'boolean', default: false, description: 'Include capped redacted item details such as summaries, approval details, paths, and long-running terminal notification state.' },
		maxItems: { type: 'integer', minimum: 1, maximum: 80, default: 16 },
	})),
	def('ask_followup_question', 'Ask developer', 'planning', 'Pause for developer clarification and wait for a redacted sidebar response.', 'planning.userInput', ['ask_question', 'agent/requestUserInput'], schema({
		question: { type: 'string' },
		details: { type: 'string' },
		suggestions: { type: 'array', items: suggestionItemProperty },
	}, ['question'])),
		def('plan_mode_respond', 'Plan Mode response', 'planning', 'Present a Cline-compatible Plan Mode response for developer review/refinement without approving or mutating. The extension imports the response into the visual plan canvas as a linked Mermaid/checklist draft and still keeps execution locked until approval. Accepts response, question, prompt, or message text plus optional choices/options.', 'planning.userInput', ['plan_mode_response', 'request_plan_feedback'], schema({
			response: { type: 'string', description: 'Cline Plan Mode response body shown to the developer.' },
			question: { type: 'string', description: 'Alias for response when a backend wants explicit feedback.' },
			prompt: { type: 'string', description: 'Alias for response.' },
		message: { type: 'string', description: 'Alias for response.' },
		details: { type: 'string', description: 'Additional context shown below the response.' },
		suggestions: { type: 'array', items: suggestionItemProperty },
		options: { type: 'array', items: suggestionItemProperty },
		choices: { type: 'array', items: suggestionItemProperty },
			needsMoreExploration: { type: 'boolean', default: false },
			nextMode: { type: 'string', enum: ['plan', 'ask', 'manual', 'act', 'agent', 'debug', 'review', 'custom'] },
		})),
		def('user_input_status', 'User input status', 'planning', 'Inspect pending ask_question, ask_followup_question, and plan_mode_respond wait states, including redacted prompts, suggestion metadata, counts, and next action without answering, cancelling, approving plans, running tools, editing files, or unlocking mutation.', 'planning.userInputStatus', ['get_user_input_status', 'question_status', 'pending_questions', 'plan_input_status', 'agent/getUserInputStatus', 'userInput/status'], schema({
			includeRequests: { type: 'boolean', default: true, description: 'Include bounded redacted pending request details.' },
			includePromptBlock: { type: 'boolean', default: false, description: 'Include a redacted machine-readable pendingUserInputRequests prompt block for backend wait loops.' },
			maxRequests: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
		})),
		def('act_mode_respond', 'Act Mode response', 'planning', 'Stream a Cline-compatible Act Mode progress response into the transcript and acknowledge it immediately. This never pauses for developer input, approves plans, or mutates files.', 'planning.transcriptStreaming', ['act_mode_response'], schema({
		response: { type: 'string', description: 'Cline Act Mode progress response body.' },
		message: { type: 'string', description: 'Alias for response.' },
		text: { type: 'string', description: 'Alias for response.' },
		status: { type: 'string', enum: ['running', 'completed', 'blocked', 'failed'], description: 'Optional transcript status.' },
	})),
	def('task_summary', 'Condense task context', 'planning', 'Request a capped, redacted task handoff summary. Does not grant approval.', 'planning.taskSummary', ['summarize_task', 'condense', 'agent/summarizeTask'], schema({
		purpose: { type: 'string', description: 'Why the backend needs a compact continuation handoff.' },
		maxChars: { type: 'integer', minimum: 500, maximum: 24000, default: 8000 },
		includePlan: { type: 'boolean', default: true },
		includeTranscript: { type: 'boolean', default: true },
		includeEvidence: { type: 'boolean', default: true },
	})),
	def('session_history_status', 'Session history status', 'planning', 'Inspect active chat tabs, recent session summaries, status counts, task/revision metadata, and optional capped transcript tails without restoring sessions or treating old plans as approval.', 'planning.sessionHistoryStatus', ['get_session_history_status', 'chat_history_status', 'chat_tabs_status', 'agent/getSessionHistoryStatus'], schema({
		includeDetails: { type: 'boolean', default: false, description: 'Include provider/inline prompt metadata and last event summaries.' },
		includeTranscriptTail: { type: 'boolean', default: false, description: 'Include capped, redacted transcript tail events for returned sessions.' },
		maxSessions: { type: 'integer', minimum: 1, maximum: 30, default: 8 },
	})),
	def('session_export', 'Export session Markdown', 'planning', 'Return capped redacted Markdown for the active or requested session without restoring sessions, deleting history, approving old plans, or mutating workspace state.', 'planning.sessionExport', ['export_session', 'chat_export', 'export_chat', 'conversation_export', 'agent/exportSession'], schema({
		sessionId: { type: 'string', description: 'Optional session id. Omit to export the active session or latest stored session.' },
		active: { type: 'boolean', default: true, description: 'Prefer the active session when sessionId is omitted.' },
		maxChars: { type: 'integer', minimum: 500, maximum: 120000, default: 20000 },
	})),
	def('capability_matrix', 'Capability matrix', 'planning', 'Inspect Cursor/Cline/Codex/VibeCodex parity coverage and runtime locks.', 'planning.capabilityMatrix', ['cursor_parity', 'cline_parity', 'codex_parity'], schema({
		source: { type: 'string', enum: ['cursor', 'cline', 'codex', 'vibecodex'] },
		includeEvidence: { type: 'boolean', default: true },
	})),
	def('tool_call_status', 'Tool-call preflight status', 'planning', 'Validate one proposed client tool call against the current schema manifest, Cline/Core alias argument shapes, runtime availability, approval gates, and exact visual-plan authorization state without executing tools, creating approvals, approving plans, or mutating files.', 'planning.toolCallStatus', ['tool_call_validate', 'client_tool_call_status', 'client_tool_validate', 'agent/validateToolCall', 'agent/toolCallStatus', 'tool/callStatus', 'tools/callStatus'], schema({
		tool: { type: 'string', description: 'Tool name or alias to preflight.' },
		name: { type: 'string', description: 'Alias for tool.' },
		toolName: { type: 'string', description: 'Alias for tool.' },
		tool_name: { type: 'string', description: 'Alias for tool.' },
		arguments: { type: 'object', description: 'Proposed arguments for the target tool.' },
		args: { type: 'object', description: 'Alias for arguments.' },
		input: { type: 'object', description: 'Alias for arguments.' },
		includeSchema: { type: 'boolean', default: true, description: 'Include the redacted matched schema in the response.' },
		includeRepairHints: { type: 'boolean', default: true, description: 'Include deterministic repair hints for missing or unknown arguments.' },
	}, ['tool'])),
	def('extension_install_status', 'Extension install readiness', 'context', 'Inspect the installable Vibe Codex Agent VSIX contract: manifest identity, package command, activation routes, command contributions, configuration keys, runtime load state, and strict webview security readiness without installing packages, starting Codex, opening sockets, changing settings, reading secrets, approving plans, or mutating files.', 'context.extensionInstallStatus', ['vsix_status', 'install_status', 'package_status', 'agent_extension_status', 'external_install_status', 'agent/getExtensionInstallStatus', 'agent/extensionInstallStatus', 'extension/installStatus', 'vsix/status', 'package/status'], schema({
		includeFeatures: { type: 'boolean', default: true, description: 'Include manifest, activation, command, config, runtime, and webview security feature readiness cards.' },
		includeActivationEvents: { type: 'boolean', default: true, description: 'Include contributed activation events.' },
		includeCommands: { type: 'boolean', default: true, description: 'Include contributed command ids.' },
		includeConfiguration: { type: 'boolean', default: true, description: 'Include contributed configuration keys without values.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted VSIX readiness prompt block.' },
	})),
	def('task_board_status', 'Task board status', 'planning', 'Inspect queued/dependent Task Board cards, preserved external sources, ready/running/blocked queue ids, dependency readiness, and optional redacted prompt/evidence context without creating, starting, or archiving tasks.', 'planning.taskBoardStatus', ['list_tasks'], schema({
		cardId: { type: 'string' },
		includePrompts: { type: 'boolean', default: false },
		includeEvidence: { type: 'boolean', default: false },
		includeArchived: { type: 'boolean', default: false },
	})),
		def('task_intake_status', 'Task intake status', 'planning', 'Inspect Cline-style delegated, URI, connector, scheduled, and headless Task Board intake counts, source mix, readiness, blockers, and guardrails without creating, starting, or archiving tasks.', 'planning.taskBoardStatus', ['external_task_status', 'headless_task_status', 'get_task_intake_status', 'agent/getTaskIntakeStatus'], schema({
			cardId: { type: 'string' },
			includePrompts: { type: 'boolean', default: false },
			includeEvidence: { type: 'boolean', default: true },
			includeArchived: { type: 'boolean', default: false },
		})),
		def('task_start_status', 'Task start readiness status', 'planning', 'Preflight whether a queued/delegated/external Task Board card can begin visual Plan Mode, including dependency blockers, redacted visualPlanSeed, plan-only handoff, source, and parallel lane count without starting cards, approving plans, preparing worktrees, or mutating files.', 'planning.taskStartStatus', ['task_board_start_status', 'start_task_status', 'start_card_status', 'plan_start_status', 'agent/getTaskStartStatus'], schema({
			cardId: { type: 'string', description: 'Optional Task Board card id. Omit to inspect the next ready card.' },
			card_id: { type: 'string', description: 'Alias for cardId.' },
			taskId: { type: 'string', description: 'Alias for cardId.' },
			includePromptBlock: { type: 'boolean', default: true, description: 'Include the redacted visualPlanSeed and capped task-start prompt block for backend Plan Mode initialization.' },
			includeEvidence: { type: 'boolean', default: false, description: 'Include capped redacted card evidence.' },
		})),
		def('external_intake_status', 'External intake capability status', 'planning', 'Inspect Cline-style URI, connector, scheduled, headless, and delegated intake routes, payload/query fields, start semantics, limits, queue counts, and guardrails without creating or starting tasks.', 'planning.externalIntakeStatus', ['intake_capability_status', 'connector_intake_status', 'scheduled_intake_status', 'headless_intake_status', 'agent/getExternalIntakeStatus'], schema({
		triggerKind: { type: 'string', enum: ['uri', 'connector', 'scheduled', 'headless', 'delegated'], description: 'Optional trigger family to inspect.' },
		includeExamples: { type: 'boolean', default: true, description: 'Include redacted URI/tool examples.' },
		includeQueueCounts: { type: 'boolean', default: true, description: 'Include current redacted Task Board intake counts.' },
	})),
	def('connector_status', 'Connector and scheduled intake readiness', 'planning', 'Inspect Cline-style connector, scheduled, cron, and headless intake channels, supported routes, queued cards, and guardrails without connecting accounts, creating schedules, queueing tasks, starting cards, approving plans, or mutating files.', 'planning.connectorScheduleStatus', ['messaging_connector_status', 'cline_connector_status', 'external_channel_status', 'scheduled_agent_status', 'schedule_status', 'automation_status', 'cron_status', 'headless_agent_status', 'agent/getConnectorStatus', 'agent/getScheduledAgentStatus'], schema({
		family: { type: 'string', enum: ['all', 'connector', 'scheduled', 'headless'], default: 'all', description: 'Optional channel family to inspect.' },
		includeExamples: { type: 'boolean', default: true, description: 'Include redacted connector/scheduled/headless URI and tool-call examples.' },
		includeQueue: { type: 'boolean', default: true, description: 'Include matching Task Board queue evidence.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted prompt block for backend routing.' },
		maxCards: { type: 'integer', minimum: 0, maximum: 30, default: 8, description: 'Maximum matching queued cards to return.' },
	})),
	def('slash_command_status', 'Slash command and workflow status', 'planning', 'Inspect Cline-style built-in slash commands, workflow slash command paths, allowed workflow roots, limits, and last slash command metadata without executing slash commands, creating task-board cards, creating rule proposals, loading workflow text, approving plans, running tools, accepting diffs, restoring checkpoints, or mutating files.', 'planning.slashCommandStatus', ['slash_status', 'slash_commands_status', 'workflow_slash_status', 'slash_workflow_status', 'agent/getSlashCommandStatus', 'slash/status'], schema({
		includeBuiltins: { type: 'boolean', default: true, description: 'Include built-in slash commands such as /deep-planning, /newtask, /newrule, and mode shortcuts.' },
		includeWorkflows: { type: 'boolean', default: true, description: 'Include discovered workflow slash command labels and redacted workspace-relative paths.' },
		includeLastCommand: { type: 'boolean', default: true, description: 'Include last parsed slash command metadata, if one exists.' },
		includeDetails: { type: 'boolean', default: false, description: 'Include redacted command details and workflow paths, but never workflow file text.' },
		maxWorkflows: { type: 'integer', minimum: 1, maximum: 80, default: 20 },
	})),
	def('new_task', 'Queue delegated task', 'planning', 'Queue a delegated subtask on the Task Board instead of executing it immediately.', 'planning.taskBoardStatus', ['delegate_task', 'agent/newTask'], schema({
		title: { type: 'string' },
		prompt: { type: 'string' },
		mode: { type: 'string', enum: ['plan', 'ask', 'manual', 'act', 'agent', 'debug', 'review', 'custom'] },
		dependsOn: { type: 'array', items: { type: 'string' } },
		parallelThreads: { type: 'integer', minimum: 1, maximum: 8 },
	}, ['prompt'])),
	def('use_subagents', 'Queue parallel subagents', 'planning', 'Queue a Cline-compatible parallel subagent coordination card on the Task Board. This is intake-only: it never starts execution, prepares worktrees, approves plans, runs commands, or mutates files.', 'planning.taskBoardStatus', ['subagents', 'use_subagent', 'parallel_subagents', 'agent_subagents', 'agent/useSubagents'], schema({
		title: { type: 'string', description: 'Optional Task Board card title.' },
		task: { type: 'string', description: 'Overall task for the coordinated subagents.' },
		prompt: { type: 'string', description: 'Alias for task.' },
		mode: { type: 'string', enum: ['plan', 'ask', 'manual', 'act', 'agent', 'debug', 'review', 'custom'], default: 'agent' },
		agents: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Subagent lane descriptors with name/role plus prompt/task/instructions/focus.' },
		subagents: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Alias for agents.' },
		subtasks: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] }, description: 'Subtasks to preserve in the planning handoff.' },
		dependsOn: { type: 'array', items: { type: 'string' } },
		parallelThreads: { type: 'integer', minimum: 1, maximum: 8, description: 'Requested lane count. If omitted, Vibe Codex infers it from agents/subtasks and clamps to 8.' },
		reason: { type: 'string' },
	}, [])),
	def('write_file', 'Propose file write', 'file', 'Propose a whole-file write/create through diff review. Does not modify files until accepted. Cline file_content/new_content aliases are normalized into content during preflight.', 'file.proposeDiff', ['write_to_file', 'create_file'], schema({
		path: pathProperty,
		content: { type: 'string' },
		reason: { type: 'string' },
	}, ['path', 'content']), true),
	def('edit_file', 'Propose file edit', 'file', 'Propose patch/search-replace edits through review-first diff cards.', 'file.proposeDiff', ['replace_in_file', 'apply_patch', 'patch_file'], schema({
		path: pathProperty,
		patch: { type: 'string', description: 'Unified diff or SEARCH/REPLACE block.' },
		replacements: { type: 'array', items: { type: 'object' } },
		reason: { type: 'string' },
	}, ['path']), true),
	def('delete_file', 'Delete file', 'file', 'Request a checkpointed workspace file delete. Requires approval and exact plan authorization.', 'file.delete', ['remove_file'], schema({
		path: pathProperty,
		reason: { type: 'string' },
	}, ['path']), true),
		def('execute_command', 'Run terminal command', 'terminal', 'Request a visible captured terminal run with command permissions, output streaming, interrupt, retry, diagnostics, and verification evidence.', 'terminal.run', ['bash', 'shell', 'run_command', 'run_commands'], schema({
			command: { type: 'string', description: 'Command line to run in the workspace terminal.' },
			commands: { type: 'array', items: { type: 'string' }, description: 'Cline run_commands-style command list; normalized into one visible terminal run joined with &&.' },
			cwd: { type: 'string', description: 'Optional workspace-relative working directory.' },
			reason: { type: 'string' },
			verificationCheckId: { type: 'string' },
		}, ['command']), true),
		def('preview_start', 'Start localhost preview', 'terminal', 'Request approval to start a detected preview target through a visible captured terminal. Use preview_status first; arbitrary shell commands must use execute_command.', 'preview.start', ['start_preview', 'preview.start', 'start_localhost_preview', 'localhost_start_preview', 'localhost_preview_start', 'agent/startPreview', 'preview/start'], schema({
			targetId: { type: 'string', description: 'Detected preview target id from preview_status.' },
			url: { type: 'string', description: 'Detected preview loopback URL from preview_status.' },
			label: { type: 'string', description: 'Detected preview label from preview_status.' },
			command: { type: 'string', description: 'Exact detected preview command from preview_status; arbitrary commands are rejected.' },
			cwd: { type: 'string', description: 'Detected workspace-relative preview cwd.' },
			reason: { type: 'string' },
		}), true),
		def('fetch_web', 'Fetch/search web', 'web', 'Request approval-gated safe HTTP(S) web fetch or web search context.', 'web.fetch', ['fetch_web_content', 'web_search'], schema({
			url: { type: 'string' },
			query: { type: 'string' },
		maxBytes: { type: 'integer', minimum: 1, maximum: 80000 },
	}, [])),
	def('browser_status', 'Browser support status', 'browser', 'Read supported external browser actions, native-controller-required actions, pending browser approvals, and approval readiness without opening browsers or controlling pages.', 'browser.status', ['get_browser_status', 'browser_capability_status', 'browser_support_status', 'agent/getBrowserStatus'], schema({
		includePendingActions: { type: 'boolean', default: true, description: 'Include capped redacted pending browser approval cards.' },
		maxActions: { type: 'integer', minimum: 0, maximum: 50, default: 12 },
	})),
	def('browser_action_status', 'Browser action evidence status', 'browser', 'Inspect pending and recent browser action outcomes, supported open/navigate starts, blocked or declined decisions, and native-controller-required handoffs without opening browsers, controlling pages, approving actions, or mutating files.', 'browser.actionStatus', ['browser_controller_status', 'browser_handoff_status', 'browser_action_history', 'agent/getBrowserActionStatus', 'browser/actionStatus', 'browser/controllerStatus'], schema({
		includeEvents: { type: 'boolean', default: true, description: 'Include bounded recent browser action evidence events.' },
		includePendingActions: { type: 'boolean', default: true, description: 'Include bounded pending browser action handoffs.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted browser-controller handoff prompt block.' },
		maxEvents: { type: 'integer', minimum: 0, maximum: 50, default: 12 },
		maxPendingActions: { type: 'integer', minimum: 0, maximum: 50, default: 12 },
	})),
	def('browser_action', 'Browser action', 'browser', 'Request approval-gated browser actions. External VSIX executes safe open/navigate URLs; click/type/scroll_down/scroll_up/screenshot/close are normalized and declined with native-controller-required metadata for the bundled VibeCode browser controller.', 'browser.openNavigate', ['open_browser', 'browser_open', 'browser_navigate'], schema({
		action: { type: 'string', enum: ['launch', 'open', 'navigate', 'click', 'type', 'scroll_down', 'scroll_up', 'screenshot', 'close'] },
		url: { type: 'string', description: 'Required for launch/open/navigate. Must be a safe http(s) URL in the external VSIX.' },
		selector: { type: 'string', description: 'Optional selector for native-controller click/type actions.' },
		text: { type: 'string', description: 'Text for native-controller type actions.' },
		x: { type: 'number', description: 'Optional x coordinate for native-controller click actions.' },
		y: { type: 'number', description: 'Optional y coordinate for native-controller click actions.' },
		reason: { type: 'string' },
	}, ['action'])),
	def('mcp_status', 'MCP status', 'mcp', 'Inspect redacted workspace MCP server catalog readiness, requested-server scope, unknown/global guidance, enabled/disabled counts, transport metadata, auto-approve hints, and pending request counts without executing tools/resources.', 'mcp.status', ['get_mcp_status', 'mcp_server_status', 'mcp_catalog_status', 'agent/getMcpStatus'], schema({
		includeServers: { type: 'boolean', default: true, description: 'Include bounded redacted server entries.' },
		includeTools: { type: 'boolean', default: false, description: 'Include auto-approve tool-name hints from workspace MCP config; still does not approve tools.' },
		serverName: { type: 'string', description: 'Optional MCP server name to inspect.' },
	})),
	def('load_mcp_documentation', 'Load MCP documentation', 'mcp', 'Return read-only MCP usage guidance and the redacted workspace MCP catalog.', 'mcp.documentation', ['mcp_documentation'], noProperties),
	def('use_mcp_tool', 'Use MCP tool', 'mcp', 'Request an MCP tool call through explicit Vibe Codex approval.', 'mcp.call', [], schema({
		serverName: { type: 'string' },
		toolName: { type: 'string' },
		arguments: { type: 'object', additionalProperties: true },
	}, ['serverName', 'toolName'])),
	def('access_mcp_resource', 'Access MCP resource', 'mcp', 'Request an MCP resource read through explicit Vibe Codex approval.', 'mcp.call', [], schema({
		serverName: { type: 'string' },
		uri: { type: 'string' },
	}, ['serverName', 'uri'])),
	def('run_hook', 'Run workspace hook', 'hook', 'Request a hook command that must match an indexed hook manifest and command policy.', 'hook.run', ['hook_run'], schema({
		hookName: { type: 'string' },
		manifestPath: pathProperty,
		command: { type: 'string' },
		reason: { type: 'string' },
	})),
	def('parallel_status', 'Parallel status', 'parallel', 'Inspect 8-lane worktree plan, lane results, judge recommendation, merge readiness, and blockers.', 'parallel.status', ['get_parallel_status'], schema({
		taskId: { type: 'string' },
		includeResults: { type: 'boolean', default: false },
	})),
	def('parallel_worktree_status', 'Parallel worktree lifecycle status', 'parallel', 'Inspect workspace trust, exact-plan authorization, mode lock, root/path/branch safety, lane materialization states, and prepare/cleanup readiness without creating, cleaning, merging, or mutating worktrees.', 'parallel.worktreeStatus', ['parallel_worktrees_status', 'worktree_status', 'parallel_lane_status', 'agent/getParallelWorktreeStatus'], schema({
		taskId: { type: 'string' },
		includeThreads: { type: 'boolean', default: true },
	})),
	def('parallel_lane_execution_status', 'Parallel lane execution status', 'parallel', 'Inspect selected or auto-selected parallel lane dispatch readiness, exact-plan and mode gates, materialization state, branch/path safety, result state, judge-review link, and next route without dispatching agents, preparing worktrees, running commands, writing files, or mutating worktrees.', 'parallel.laneExecutionStatus', ['lane_execution_status', 'parallel_dispatch_status', 'lane_dispatch_status', 'get_parallel_lane_execution_status', 'agent/getParallelLaneExecutionStatus'], schema({
		taskId: { type: 'string', description: 'Optional active parallel task id to match.' },
		threadId: { type: 'string', description: 'Optional lane/thread id such as agent-01. Omit to let the client select the next dispatch candidate.' },
		includeResult: { type: 'boolean', default: false, description: 'Include the redacted selected lane result summary and changed files when a result exists.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted routing prompt block.' },
	})),
	def('parallel_dispatch_plan', 'Parallel dispatch plan', 'parallel', 'Inspect the exact read-only parallel dispatch queue: plan gate, mode gate, per-lane dispatch requests, expected agent/parallelResult callback, blockers, and guardrails without dispatching agents, preparing worktrees, running commands, writing files, or mutating worktrees.', 'parallel.dispatchPlan', ['parallel_dispatch_queue', 'parallel_agent_dispatch', 'dispatch_parallel_agents', 'lane_dispatch_plan', 'get_parallel_dispatch_plan', 'agent/getParallelDispatchPlan'], schema({
		taskId: { type: 'string', description: 'Optional active parallel task id to match.' },
		includeLanes: { type: 'boolean', default: true, description: 'Include bounded per-lane route cards and dispatch request payloads.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted routing prompt block.' },
		maxLanes: { type: 'integer', minimum: 1, maximum: 8, default: 8 },
	})),
	def('dispatch_parallel_lane', 'Dispatch parallel lane', 'parallel', 'Request visible approval-card gated launch of one materialized parallel lane. The extension starts Codex in the lane worktree only after exact visual-plan authorization, command policy validation, and developer approval, then reports terminal completion as agent/parallelResult evidence.', 'parallel.dispatchLane', ['parallel_dispatch_lane', 'parallel_agent_dispatch_lane', 'run_parallel_lane', 'launch_parallel_lane', 'agent/dispatchParallelLane'], schema({
		taskId: { type: 'string', description: 'Active parallel task id from parallel_dispatch_plan.' },
		threadId: { type: 'string', description: 'Lane/thread id such as agent-01.' },
		worktreePath: { type: 'string', description: 'Optional expected lane worktree path; must match the active materialized lane.' },
		branchName: { type: 'string', description: 'Optional expected lane branch; must match the active lane branch.' },
		promptFocus: { type: 'string', description: 'Optional lane focus override for the terminal prompt.' },
	}, ['taskId', 'threadId']), true),
	def('parallel_review_status', 'Parallel judge review status', 'parallel', 'Inspect redacted lane rankings, scores, missing lanes, judge recommendation, merge readiness, and blockers without selecting lanes or requesting merge-back.', 'parallel.reviewStatus', ['get_parallel_review_status', 'parallel_judge_status', 'get_parallel_judge_status', 'agent/getParallelReviewStatus'], schema({
		taskId: { type: 'string' },
		includeResults: { type: 'boolean', default: false },
		includeRanking: { type: 'boolean', default: true },
	})),
	def('parallel_merge_status', 'Parallel merge-back status', 'parallel', 'Inspect selected merge-back lane, recommended lane, authorization, selected-result summary, blockers, and the review-first diff handoff contract without requesting a merge.', 'parallel.mergeStatus', ['get_parallel_merge_status', 'parallel_merge_back_status'], schema({
		taskId: { type: 'string' },
		includeReview: { type: 'boolean', default: false },
	})),
	def('prepare_parallel_worktrees', 'Prepare parallel worktrees', 'parallel', 'Request visible approval-card gated preparation or cleanup of isolated parallel worktrees. Even after exact visual-plan approval, this creates a pending approval card before any git worktree command runs.', 'parallel.prepareWorktrees', ['cleanup_parallel_worktrees', 'agent/prepareParallelWorktrees', 'agent/cleanupParallelWorktrees', 'parallel/prepareWorktrees', 'parallel/cleanupWorktrees'], schema({
		operation: { type: 'string', enum: ['prepare', 'cleanup'] },
		taskId: { type: 'string' },
	}, ['operation']), true),
	def('delivery_bar_status', 'Delivery Bar status', 'verification', 'Inspect current Delivery Bar readiness, path-accurate rollback checkpoint blockers, required check blockers, counts, next action, and optional prompt block without running checks, accepting completion, changing Final Review, staging commits, or mutating files.', 'verification.deliveryBarStatus', ['delivery_gate_status', 'delivery_readiness_status', 'delivery_check_status', 'agent/getDeliveryBarStatus', 'deliveryBar/status', 'delivery/gateStatus'], schema({
		includeChecks: { type: 'boolean', default: true, description: 'Include redacted Delivery Bar checks.' },
		includeBlockers: { type: 'boolean', default: true, description: 'Include required checks that still block delivery readiness.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted prompt block with current blockers and next action.' },
	})),
	def('acceptance_criteria_status', 'Acceptance criteria status', 'verification', 'Inspect plan acceptance criteria coverage, linked required verification checks, blockers, counts, and redacted evidence without marking criteria passed, running checks, editing plans, approving execution, accepting completion, or mutating files.', 'verification.acceptanceCriteriaStatus', ['acceptance_status', 'plan_acceptance_status', 'criteria_status', 'verification_acceptance_status', 'agent/getAcceptanceCriteriaStatus', 'acceptance/status', 'acceptanceCriteria/status'], schema({
		includeCriteria: { type: 'boolean', default: true, description: 'Include redacted per-criterion readiness and linked check ids.' },
		includeEvidence: { type: 'boolean', default: true, description: 'Include redacted evidence from linked verification checks.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted prompt block with blockers and next action.' },
		maxCriteria: { type: 'integer', minimum: 0, maximum: 40, default: 12 },
	})),
	def('execution_gate_status', 'Execution gate routing status', 'verification', 'Inspect one proposed tool call by combining visual-plan validity, exact approval authorization, tool-call preflight, pending approvals, and diff review counts without creating approval cards, submitting diffs, running terminals, accepting diffs, restoring checkpoints, or mutating files.', 'verification.executionGateStatus', ['mutation_gate_status', 'approval_gate_status', 'execution_readiness_status', 'mutation_readiness_status', 'agent/getExecutionGateStatus', 'agent/executionGateStatus', 'execution/gateStatus'], schema({
		tool: { type: 'string', description: 'Optional proposed tool name or alias to route.' },
		name: { type: 'string', description: 'Alias for tool.' },
		toolName: { type: 'string', description: 'Alias for tool.' },
		tool_name: { type: 'string', description: 'Alias for tool.' },
		taskId: { type: 'string', description: 'Optional visual-plan task id the backend believes is active.' },
		revision: { type: 'integer', minimum: 1, description: 'Optional visual-plan revision the backend believes is active.' },
		arguments: { type: 'object', description: 'Proposed arguments for the target tool.' },
		args: { type: 'object', description: 'Alias for arguments.' },
		input: { type: 'object', description: 'Alias for arguments.' },
		includeToolCall: { type: 'boolean', default: true, description: 'Include redacted tool-call preflight details.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted routing prompt block.' },
	})),
	def('verification_status', 'Verification status', 'verification', 'Inspect verification checks, diagnostics evidence, Delivery Bar, Smoke Benchmark, and Final Review.', 'verification.status', ['get_verification_status'], schema({
		includeTerminalRuns: { type: 'boolean', default: false },
		includeDiagnostics: { type: 'boolean', default: true },
	})),
	def('smoke_benchmark_status', 'Smoke Benchmark status', 'verification', 'Inspect native prompt, visual plan, manual plan adjustment, exact approval, parallel safety, terminal verification, multi-file diff, rollback, commit handoff, and Delivery Bar milestone readiness without approving plans, running checks, accepting diffs, staging commits, accepting completion, or mutating files.', 'verification.smokeBenchmarkStatus', ['smoke_status', 'e2e_smoke_status', 'benchmark_status', 'agent/getSmokeBenchmarkStatus', 'smokeBenchmark/status', 'smoke/status'], schema({
		includeMilestones: { type: 'boolean', default: true, description: 'Include bounded redacted Smoke Benchmark milestones.' },
		includeBlockers: { type: 'boolean', default: true, description: 'Include required milestones that have not passed.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted completion-readiness prompt block.' },
	})),
	def('final_review_status', 'Final Review status', 'verification', 'Inspect the strict Final Review pass/block decision, item evidence, redacted prompt block, and next action without accepting completion, running checks, staging commits, or mutating files.', 'verification.finalReview', ['get_final_review_status', 'agent/getFinalReviewStatus', 'finalReview/status', 'delivery_status'], schema({
		includeFinalReview: { type: 'boolean', default: true },
		includeDiagnostics: { type: 'boolean', default: false },
		includeChecks: { type: 'boolean', default: false },
	})),
	def('workflow_status', 'Workflow lifecycle status', 'verification', 'Inspect the end-to-end lifecycle proof for prompt, visual plan, approval, execution, terminal verification, diff review, path-accurate rollback checkpoint coverage, commit handoff, and Final Review without approving plans, running tools, accepting diffs, restoring checkpoints, staging commits, or mutating files.', 'verification.workflowStatus', ['get_workflow_status', 'delivery_workflow_status', 'lifecycle_status', 'agent/getWorkflowStatus', 'workflow/status'], schema({
		includeMilestones: { type: 'boolean', default: true },
		includeEvidence: { type: 'boolean', default: false },
		includePromptBlock: { type: 'boolean', default: true },
	})),
	def('happy_path_status', 'Happy Path Proof status', 'verification', 'Inspect the compact minimum-delivery proof route by composing Workflow Proof, Smoke Benchmark, Delivery Bar, Final Review, and parallel lane readiness without approving plans, dispatching agents, running tools, accepting diffs, restoring checkpoints, accepting completion, staging commits, or mutating files.', 'verification.happyPathStatus', ['delivery_proof_status', 'workflow_happy_path_status', 'e2e_workflow_status', 'minimum_delivery_status', 'agent/getHappyPathStatus', 'workflow/happyPathStatus', 'delivery/happyPathStatus'], schema({
		includeGates: { type: 'boolean', default: true, description: 'Include ordered redacted happy-path gates and next route for each gate.' },
		includeEvidence: { type: 'boolean', default: false, description: 'Include bounded redacted evidence from workflow, delivery, smoke, final-review, and parallel lane status.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted routing prompt block for backend orchestration.' },
	})),
	def('task_completion_status', 'Task completion gate status', 'verification', 'Inspect the current Final Review completion gate, latest completion attempt, blockers, counts, redacted evidence, and next action without accepting completion, running checks, staging commits, or mutating files.', 'verification.taskCompletionStatus', ['completion_gate_status', 'completion_status', 'completion_readiness_status', 'agent/getTaskCompletionStatus', 'completion/status', 'completion/gateStatus'], schema({
		includeLatest: { type: 'boolean', default: true, description: 'Include the latest redacted completion attempt, if one exists.' },
		includeBlockers: { type: 'boolean', default: true, description: 'Include redacted Final Review blockers.' },
		includeEvidence: { type: 'boolean', default: true, description: 'Include redacted Final Review evidence.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted prompt block with current gate state and next action.' },
		includeResult: { type: 'boolean', default: false, description: 'Include the latest completion result text, redacted and capped.' },
	})),
	def('attempt_completion', 'Attempt completion', 'verification', 'Ask the extension to evaluate Final Review before accepting task completion. Blocked responses include structured gate counts, blockerIds, pendingIds, and redacted evidence for repair.', 'verification.taskCompletion', ['submit_and_exit', 'agent/taskComplete'], schema({
		result: { type: 'string' },
		summary: { type: 'string' },
		evidence: { type: 'array', items: { type: 'string' } },
	}, ['summary'])),
		def('provider_catalog', 'Provider catalog', 'context', 'Inspect supported cloud, local, and OpenAI-compatible providers, defaults, selected provider, and credential readiness without exposing raw API keys or changing settings.', 'context.providerCatalog', ['model_catalog', 'get_provider_catalog', 'get_model_catalog', 'list_providers'], schema({
			includeDefaults: { type: 'boolean', default: true },
			includeCodexConfig: { type: 'boolean', default: false },
		})),
		def('provider_status', 'Provider status', 'context', 'Inspect selected provider, effective mode model route, base URL readiness, sanitized Codex config, and credential source without exposing raw API keys.', 'context.providerStatus', ['get_provider_status', 'model_status', 'get_model_status'], schema({
			mode: { type: 'string', enum: ['plan', 'ask', 'manual', 'act', 'agent', 'debug', 'review', 'custom'], description: 'Optional mode whose effective provider model route should be resolved.' },
			includeCodexConfig: { type: 'boolean', default: false },
			includeModeRoutes: { type: 'boolean', default: false, description: 'Include the redacted effective model/base URL/credential route for every standard Vibe Codex mode.' },
		})),
		def('backend_launch_status', 'Backend launch readiness', 'context', 'Inspect redacted Codex app-server stdio/pipe/websocket launch-route readiness, selected transport/framing, route blockers, bridge state, and next action without starting processes, opening sockets, sending JSON-RPC requests, approving plans, or mutating files.', 'context.backendLaunchStatus', ['launch_status', 'app_server_status', 'codex_app_server_status', 'bridge_launch_status', 'agent/getBackendLaunchStatus', 'backend/launchStatus', 'bridge/launchStatus'], schema({
		includeRoutes: { type: 'boolean', default: true, description: 'Include readiness rows for stdio, pipe, and websocket launch routes.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a compact redacted launch-readiness prompt block.' },
	})),
		def('protocol_status', 'Protocol status', 'context', 'Inspect redacted JSON-RPC bridge health, handshake capability readiness, handshake contract coverage, handshake/transport/framing state, pending request counts, recent lifecycle events, and method names without sending requests, replaying agent/initialize, reconnecting transports, approving plans, or executing tools.', 'context.protocolStatus', ['get_protocol_status', 'bridge_status', 'jsonrpc_status', 'agent/getProtocolStatus'], schema({
		includeEvents: { type: 'boolean', default: true, description: 'Include bounded redacted lifecycle events.' },
		maxEvents: { type: 'integer', minimum: 0, maximum: 80, default: 20 },
		direction: { type: 'string', enum: ['in', 'out', 'status', 'error'], description: 'Optional event direction filter.' },
	})),
	def('client_state', 'Client state', 'context', 'Inspect redacted sidebar/client state, including mode, authorization summary, pending counts, tool catalog, delivery/final-review state, parallel state, and optional bounded protocol diagnostics.', 'context.clientState', ['get_client_state', 'agent/getClientState'], schema({
		includeProtocol: { type: 'boolean', default: false, description: 'Include bounded redacted protocol diagnostics.' },
	})),
	def('context_refresh', 'Refresh context', 'context', 'Trigger a bounded read-only workspace context gather and return summary/index readiness plus optional explicitly requested redacted context or prompt blocks. Does not approve plans or unlock mutation.', 'context.refresh', ['refresh_context', 'gather_context', 'workspace_context_refresh', 'agent/refreshContext'], schema({
		prompt: { type: 'string', description: 'Optional prompt to use for mention parsing, lexical search, docs recall, and context ranking. Omit to reuse the active prompt.' },
		mode: { type: 'string', enum: ['plan', 'ask', 'manual', 'act', 'agent', 'debug', 'review', 'custom'], description: 'Optional mode metadata for the refreshed context pack. Does not change the UI mode policy.' },
		includeContext: { type: 'boolean', default: false, description: 'Include the redacted bounded context pack. Defaults false to avoid returning code/text unless explicitly requested.' },
		includePromptBlock: { type: 'boolean', default: false, description: 'Include the redacted planning prompt block generated from the refreshed context.' },
		includeIndexStatus: { type: 'boolean', default: true, description: 'Include context index readiness in the response.' },
	})),
	def('context_status', 'Context status', 'context', 'Inspect last gathered context counts and readiness without gathering fresh files or exposing snippets.', 'context.status', undefined, noProperties),
	def('context_index_status', 'Context index status', 'context', 'Inspect workspace context source readiness, freshness, counts, and optional redacted path-only samples without gathering fresh files or exposing snippets.', 'context.indexStatus', ['get_context_index_status', 'workspace_index_status', 'codebase_index_status', 'search_index_status', 'agent/getContextIndexStatus'], schema({
		includeSources: { type: 'boolean', default: true, description: 'Include per-source readiness rows for roots, editor, mentions, search, symbols, diagnostics, git, terminal, and ignore policy.' },
		includeSamples: { type: 'boolean', default: false, description: 'Include capped redacted path-only samples. Never includes file text, snippets, terminal output, or diagnostic messages.' },
		maxItems: { type: 'integer', minimum: 0, maximum: 40, default: 12 },
	})),
	def('mode_status', 'Mode status', 'context', 'Inspect current Vibe Codex mode policy, all standard modes, allowed/blocked actions, exact-plan authorization match, and next safe route without switching modes, approving plans, running tools, accepting diffs, or mutating files.', 'context.modeStatus', ['get_mode_status', 'mode_policy_status', 'current_mode', 'agent/getModeStatus', 'mode/status'], schema({
		includeModes: { type: 'boolean', default: true, description: 'Include all standard Vibe Codex mode policies.' },
		includeInstructions: { type: 'boolean', default: true, description: 'Include per-mode behavioral instructions.' },
		includePromptBlock: { type: 'boolean', default: false, description: 'Include a redacted machine-readable mode readiness prompt block.' },
	})),
	def('safety_status', 'Safety status', 'context', 'Inspect mode, permission, sandbox, and approval-gate state without changing policy.', 'context.safetyStatus', ['permission_status'], schema({
		includePendingDetails: { type: 'boolean', default: false },
	})),
	def('workspace_sandbox_status', 'Workspace sandbox status', 'context', 'Inspect workspace roots/trust, ignore-policy counts, pending approval/diff/checkpoint/sample path readiness, symlink-guard capability, checkpoint coverage, atomic rollback capability, blockers, and guardrails without resolving symlinks, writing files, deleting files, restoring checkpoints, staging commits, running terminals, changing trust, changing ignore policy, approving plans, or mutating files.', 'context.workspaceSandboxStatus', ['sandbox_status', 'path_sandbox_status', 'filesystem_sandbox_status', 'workspace_path_status', 'path_policy_status', 'agent/getWorkspaceSandboxStatus', 'workspace/sandboxStatus'], schema({
		includeRoots: { type: 'boolean', default: true, description: 'Include redacted active workspace root paths.' },
		includeIgnorePolicy: { type: 'boolean', default: true, description: 'Include ignore source and rule counts without returning ignore file contents.' },
		includePaths: { type: 'boolean', default: true, description: 'Include bounded redacted path-readiness rows for pending approval/diff/checkpoint/sample paths.' },
		includeGuardrails: { type: 'boolean', default: true, description: 'Include read-only sandbox guardrails.' },
		maxPaths: { type: 'integer', minimum: 1, maximum: 80, default: 24 },
		samplePaths: { type: 'array', items: pathProperty, description: 'Optional workspace-relative sample paths to classify without reading, writing, or resolving symlinks.' },
	})),
	def('redaction_status', 'Redaction status', 'context', 'Inspect active token filters, synthetic redaction self-test counts, optional redacted sample previews, and no-leak guardrails without scanning workspace files, secret storage, terminal output, provider config, or exposing raw secrets.', 'context.redactionStatus', ['secret_filter_status', 'secrets_status', 'token_filter_status', 'active_token_filters', 'agent/getRedactionStatus', 'redaction/status'], schema({
		includeSamples: { type: 'boolean', default: true, description: 'Include bounded redacted synthetic sample results. Raw synthetic tokens are never returned.' },
		includePromptBlock: { type: 'boolean', default: true, description: 'Include a redacted prompt block that tells the backend active token filters are enabled.' },
	})),
	def('guidance_status', 'Guidance status', 'context', 'Inspect rules, skills, hooks, Memory Bank, custom modes, and rule proposals as read-only context.', 'context.readGuidance', ['memory_bank_status'], schema({
		includeDocuments: { type: 'boolean', default: false },
		includeMemoryBank: { type: 'boolean', default: true },
		includeCustomModes: { type: 'boolean', default: true },
	})),
	def('guidance_select', 'Select relevant guidance', 'context', 'Rank applicable rules, skills, hook manifests, and Memory Bank documents for a prompt/path set as read-only planning context. Never executes hooks, writes guidance files, approves plans, or unlocks mutation.', 'context.selectGuidance', ['select_guidance', 'selected_guidance', 'rules_select', 'select_rules', 'memory_bank_select', 'agent/selectGuidance'], schema({
		query: { type: 'string', description: 'Task prompt or focused search query used to rank guidance.' },
		prompt: { type: 'string', description: 'Alias for query.' },
		paths: { type: 'array', items: pathProperty, description: 'Workspace-relative target files or folders used to bias selection.' },
		path: pathProperty,
		includeRules: { type: 'boolean', default: true, description: 'Include rule/instruction files in the ranked selection.' },
		includeSkills: { type: 'boolean', default: true, description: 'Include configured skill documents in the ranked selection.' },
		includeDocuments: { type: 'boolean', default: false, description: 'Include capped redacted document text instead of previews only.' },
		includeMemoryBank: { type: 'boolean', default: true },
		includeHooks: { type: 'boolean', default: true, description: 'Include hook manifests as read-only planning context only.' },
		maxItems: { type: 'integer', minimum: 1, maximum: 32, default: 8 },
		maxDocumentChars: { type: 'integer', minimum: 200, maximum: 4000, default: 1800 },
	})),
	def('skills', 'Select configured skills', 'context', 'Select Cline-compatible configured skills as read-only planning context. Skill text can be returned when includeDocuments=true, but this never executes hooks, writes files, approves plans, or unlocks mutation.', 'context.selectGuidance', ['use_skill', 'invoke_skill', 'skill_select', 'select_skill'], schema({
		query: { type: 'string', description: 'Task prompt, skill name, or focused search query used to rank configured skills.' },
		skillName: { type: 'string', description: 'Optional configured skill name to rank first.' },
		skill_name: { type: 'string', description: 'Alias for skillName.' },
		paths: { type: 'array', items: pathProperty, description: 'Workspace-relative target files or folders used to bias skill selection.' },
		includeDocuments: { type: 'boolean', default: true, description: 'Include capped redacted skill document text.' },
		maxItems: { type: 'integer', minimum: 1, maximum: 32, default: 8 },
		maxDocumentChars: { type: 'integer', minimum: 200, maximum: 4000, default: 1800 },
	})),
	def('checkpoint_status', 'Checkpoint status', 'review', 'Inspect diff/task checkpoint and rollback coverage without restoring or mutating files.', 'review.checkpointStatus', ['rollback_status', 'task_checkpoint_status'], schema({
		includeFiles: { type: 'boolean', default: false },
		includeActiveReview: { type: 'boolean', default: true },
	})),
	def('rollback_restore_status', 'Rollback restore readiness', 'review', 'Preflight task/file checkpoint restore readiness, accepted-file checkpoint coverage, blockers, and visible restore route without restoring checkpoints, writing, deleting, accepting diffs, rejecting diffs, staging, committing, branching, or unlocking execution.', 'review.rollbackRestoreStatus', ['checkpoint_restore_status', 'restore_checkpoint_status', 'task_rollback_status', 'task_restore_status', 'diff_restore_status', 'file_restore_status', 'agent/getRollbackRestoreStatus', 'rollback/restoreStatus', 'checkpoint/restoreStatus'], schema({
		target: { type: 'string', enum: ['task', 'file', 'all'], default: 'task', description: 'Restore readiness target.' },
		path: pathProperty,
		includeFiles: { type: 'boolean', default: true },
		includePromptBlock: { type: 'boolean', default: true },
		maxFiles: { type: 'integer', minimum: 0, maximum: 80, default: 20 },
	})),
	def('commit_handoff_status', 'Commit handoff status', 'review', 'Inspect accepted files, blockers, redacted commit message, evidence, and prepared git commands without staging, committing, branching, writing, restoring, or merging files.', 'review.commitHandoffStatus', ['get_commit_handoff_status', 'commit_status', 'git_handoff_status', 'workspace_commit_status'], schema({
		includeMessage: { type: 'boolean', default: true },
		includeEvidence: { type: 'boolean', default: false },
		includeCommands: { type: 'boolean', default: true },
	})),
	def('auto_commit_status', 'Auto-commit readiness status', 'review', 'Inspect opt-in auto-commit readiness, Final Review and Commit Handoff state, blockers, evidence, and prepared git commands without staging, committing, pushing, creating branches, opening PRs, writing, restoring, or merging files.', 'review.autoCommitStatus', ['auto_commit_readiness', 'git_auto_commit_status', 'workspace_auto_commit_status', 'agent/getAutoCommitStatus', 'autoCommit/status'], schema({
		includeCommands: { type: 'boolean', default: true },
		includeEvidence: { type: 'boolean', default: false },
	})),
	def('diff_validate', 'Validate candidate diff', 'review', 'Validate proposed file edits, paths, unified diff hunks, SEARCH/REPLACE blocks, duplicate paths, counts, warnings, and repair hints without creating review cards, writing files, accepting diffs, restoring checkpoints, or unlocking execution.', 'review.diffValidation', ['validate_diff', 'patch_validate', 'validate_patch', 'edit_validate', 'agent/validateDiff', 'diff/validate'], schema({
		diff: { description: 'Candidate diff review, file list, single file edit object, or JSON string containing one.' },
		review: { description: 'Alias for diff.' },
		files: { type: 'array', items: { type: 'object' }, description: 'Candidate file changes with path plus content/proposedText, patch/diff, or SEARCH/REPLACE replacements.' },
		includeCandidate: { type: 'boolean', default: false, description: 'Include the redacted candidate payload in the response.' },
		includePatchPreviews: { type: 'boolean', default: false, description: 'Include capped redacted patch previews for diagnostics.' },
		includeRepairHints: { type: 'boolean', default: true, description: 'Include deterministic repair hints for invalid candidate diffs.' },
	})),
	def('diff_status', 'Diff review status', 'review', 'Inspect active diff decisions, checkpoint ids, pending counts, atomicReview merge/completion/rollback readiness, optional atomic review model, available actions, checkpoint coverage, and optional redacted patch previews.', 'review.diffStatus', ['get_diff_status', 'diff_review_status', 'agent/getDiffReviewStatus'], schema({
		includePatchPreview: { type: 'boolean', default: false },
		includePatches: { type: 'boolean', default: false },
		includeReviewModel: { type: 'boolean', default: false, description: 'Include atomic review model with line stats, pending/accepted/rejected path sets, available actions, and checkpoint coverage.' },
	})),
	def('diff_file_status', 'Focused diff file status', 'review', 'Inspect a single active diff file decision, patch kind/stats, checkpoint coverage, sibling paths, available actions, and next action without accepting, rejecting, restoring, writing, staging, or mutating files.', 'review.diffFileStatus', ['diff_focus_status', 'diff_review_file_status', 'file_diff_status', 'agent/getDiffFileStatus', 'diff/fileStatus', 'diff/focusStatus'], schema({
		path: pathProperty,
		file: pathProperty,
		includePatchPreview: { type: 'boolean', default: false, description: 'Include capped redacted patch/proposed-text previews.' },
		includeSiblings: { type: 'boolean', default: true, description: 'Include active diff review sibling paths for repair when the requested path is missing.' },
	})),
	def('diff_reapply_status', 'Diff reapply readiness status', 'review', 'Inspect whether a revised single-file candidate can be routed as a review-first reapply/repair for the active diff file, combining active diff state with candidate validation without creating review cards, replacing files, accepting diffs, restoring checkpoints, writing, staging, or mutating files.', 'review.diffReapplyStatus', ['reapply_diff_status', 'diff_repair_status', 'patch_reapply_status', 'edit_reapply_status', 'agent/getDiffReapplyStatus', 'diff/reapplyStatus', 'diff/repairStatus'], schema({
		path: pathProperty,
		file: pathProperty,
		diff: { description: 'Candidate diff review, single file edit object, or JSON string containing one file change.' },
		review: { description: 'Alias for diff.' },
		candidate: { description: 'Alias for diff.' },
		files: { type: 'array', items: { type: 'object' }, description: 'Candidate file changes; focused reapply expects exactly one path.' },
		includeCandidate: { type: 'boolean', default: false, description: 'Include the redacted candidate payload.' },
		includePatchPreviews: { type: 'boolean', default: false, description: 'Include capped redacted candidate patch previews.' },
		includeRepairHints: { type: 'boolean', default: true, description: 'Include deterministic repair hints for blocked reapply routing.' },
		includeActiveFile: { type: 'boolean', default: true, description: 'Include redacted active diff-file decision and checkpoint coverage.' },
	})),
];

export function normalizeToolSchemaRequest(message: JsonRpcMessage): VibeCodexToolSchemaRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = argumentRecord(payload);
	if (!toolSchemaMethods.has(message.method) && !isToolSchemaToolCall(message.method, payload, args)) {
		return undefined;
	}
	const category = normalizeCategory(stringValue(payload.category) ?? stringValue(args.category));
	return {
		id: message.id,
		method: message.method,
		format: normalizeFormat(stringValue(payload.format) ?? stringValue(args.format)),
		...(category ? { category } : {}),
		includeParameters: booleanValue(payload.includeParameters)
			?? booleanValue(payload.include_parameters)
			?? booleanValue(args.includeParameters)
			?? booleanValue(args.include_parameters)
			?? true,
		includeUnavailable: booleanValue(payload.includeUnavailable)
			?? booleanValue(payload.include_unavailable)
			?? booleanValue(args.includeUnavailable)
			?? booleanValue(args.include_unavailable)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createToolSchemaResponse(request: VibeCodexToolSchemaRequest, input: { readonly toolCatalog?: VibeCodexToolCatalog }): VibeCodexToolSchemaResponse {
	const toolById = new Map((input.toolCatalog?.tools ?? []).map(tool => [tool.id, tool]));
	const schemas = toolSchemaDefinitions
		.filter(definition => !request.category || definition.category === request.category)
		.map(definition => schemaEntry(definition, toolById, request))
		.filter(entry => request.includeUnavailable || entry.available);
	const counts = {
		total: schemas.length,
		available: schemas.filter(entry => entry.available).length,
		approvalRequired: schemas.filter(entry => entry.requiresApproval).length,
		planApprovalRequired: schemas.filter(entry => entry.requiresPlanApproval).length,
		mutating: schemas.filter(entry => entry.mutatesWorkspace).length,
	};
	return {
		ok: true,
		source: 'externalExtension',
		format: request.format,
		...(request.category ? { category: request.category } : {}),
		counts,
		schemas,
		guardrails: [
			'Tool schema export is read-only and never runs tools, approves plans, changes provider settings, or mutates files.',
			'Mutating and sensitive schemas are discovery-only until the active Mode Policy, exact visual-plan approval, command permissions, and user approvals allow a specific request.',
			'Schema metadata is generated from the extension Tool Catalog so runtime availability and blocked reasons reflect the current client state.',
		],
		message: toolSchemaSummaryFromCounts(counts, request.category),
	};
}

export function createToolSchemaManifestPayload(input: {
	readonly toolCatalog?: VibeCodexToolCatalog;
	readonly taskId?: string;
	readonly revision?: number;
	readonly includeUnavailable?: boolean;
}): VibeCodexToolSchemaManifest {
	const includeUnavailable = input.includeUnavailable ?? true;
	const openai = createToolSchemaResponse(manifestRequest('openai', includeUnavailable), { toolCatalog: input.toolCatalog });
	const anthropic = createToolSchemaResponse(manifestRequest('anthropic', includeUnavailable), { toolCatalog: input.toolCatalog });
	const vibecodex = createToolSchemaResponse(manifestRequest('vibecodex', includeUnavailable), { toolCatalog: input.toolCatalog });
	const counts = openai.counts;
	return {
		ok: true,
		source: 'externalExtension',
		version: 1,
		...(input.taskId ? { taskId: redactSensitiveText(input.taskId) } : {}),
		...(typeof input.revision === 'number' ? { revision: input.revision } : {}),
		preferredFormat: 'openai',
		formats: {
			openai,
			anthropic,
			vibecodex,
		},
		counts,
		toolNames: openai.schemas.map(schema => schema.name),
		guardrails: [
			'Tool schema manifest is read-only and only advertises client tool contracts to the backend.',
			'Backends must still call tools through the visible Vibe Codex approval, exact visual-plan authorization, Mode Policy, and workspace sandbox gates.',
			'Mutating schemas in this manifest are discovery-only until a concrete request is separately approved.',
		],
		message: `Tool schema manifest: ${counts.available}/${counts.total} OpenAI-compatible tools available, ${counts.approvalRequired} approval-gated, ${counts.planApprovalRequired} plan-gated.`,
	};
}

export function toolSchemaSummary(response: VibeCodexToolSchemaResponse): string {
	return response.message;
}

function manifestRequest(format: VibeCodexToolSchemaFormat, includeUnavailable: boolean): VibeCodexToolSchemaRequest {
	return {
		id: `manifest-${format}`,
		method: 'agent/toolSchemaManifest',
		format,
		includeParameters: true,
		includeUnavailable,
		requestedAt: Date.now(),
	};
}

function schemaEntry(definition: ToolSchemaDefinition, toolById: ReadonlyMap<string, VibeCodexToolCatalog['tools'][number]>, request: VibeCodexToolSchemaRequest): VibeCodexToolSchemaEntry {
	const catalog = toolById.get(definition.toolCatalogId);
	const parameters = request.includeParameters ? definition.parameters : undefined;
	const base = {
		name: definition.name,
		title: definition.title,
		category: definition.category,
		description: definition.description,
		toolCatalogId: definition.toolCatalogId,
		aliases: definition.aliases ?? [],
		available: catalog?.available ?? false,
		requiresApproval: catalog?.requiresApproval ?? false,
		requiresPlanApproval: catalog?.requiresPlanApproval ?? false,
		mutatesWorkspace: definition.mutatesWorkspace === true,
		...(catalog?.blockedReason ? { blockedReason: catalog.blockedReason } : {}),
		...(parameters ? { parameters } : {}),
	};
	if (request.format === 'openai') {
		return {
			...base,
			openaiTool: {
				type: 'function',
				function: {
					name: definition.name,
					description: definition.description,
					...(parameters ? { parameters } : {}),
				},
			},
		};
	}
	if (request.format === 'anthropic') {
		return {
			...base,
			anthropicTool: {
				name: definition.name,
				description: definition.description,
				...(parameters ? { input_schema: parameters } : {}),
			},
		};
	}
	return base;
}

function def(name: string, title: string, category: VibeCodexToolSchemaCategory, description: string, toolCatalogId: string, aliases: readonly string[] | undefined, parameters: VibeCodexJsonSchema, mutatesWorkspace = false): ToolSchemaDefinition {
	return { name, title, category, description, toolCatalogId, ...(aliases ? { aliases } : {}), parameters, ...(mutatesWorkspace ? { mutatesWorkspace } : {}) };
}

function schema(properties: Record<string, unknown>, required?: readonly string[]): VibeCodexJsonSchema {
	return {
		type: 'object',
		properties,
		...(required?.length ? { required } : {}),
		additionalProperties: false,
	};
}

function toolSchemaSummaryFromCounts(counts: VibeCodexToolSchemaResponse['counts'], category: VibeCodexToolSchemaCategory | undefined): string {
	const scope = category ? `${category} ` : '';
	return `${scope}tool schemas: ${counts.available}/${counts.total} available, ${counts.approvalRequired} approval-gated, ${counts.planApprovalRequired} plan-gated, ${counts.mutating} mutating.`;
}

function isToolSchemaToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return toolSchemaToolNames.has(tool);
}

function argumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	if (!isRecord(args)) {
		return payload;
	}
	const nested = args.arguments ?? args.args ?? args.input;
	return isRecord(nested) ? { ...args, ...nested } : args;
}

function normalizeFormat(value: string | undefined): VibeCodexToolSchemaFormat {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'anthropic' || normalized === 'claude') {
		return 'anthropic';
	}
	if (normalized === 'vibecodex' || normalized === 'native') {
		return 'vibecodex';
	}
	return 'openai';
}

function normalizeCategory(value: string | undefined): VibeCodexToolSchemaCategory | undefined {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'context'
		|| normalized === 'planning'
		|| normalized === 'file'
		|| normalized === 'terminal'
		|| normalized === 'web'
		|| normalized === 'browser'
		|| normalized === 'mcp'
		|| normalized === 'hook'
		|| normalized === 'parallel'
		|| normalized === 'verification'
		|| normalized === 'review') {
		return normalized;
	}
	return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
			return true;
		}
		if (normalized === 'false' || normalized === 'no' || normalized === '0') {
			return false;
		}
	}
	return undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? String(redactSensitiveValue(value.trim())) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
