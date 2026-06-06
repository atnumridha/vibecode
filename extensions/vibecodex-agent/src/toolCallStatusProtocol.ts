/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';
import type { VibeCodexToolCatalog } from './toolCatalog';
import type { VibeCodexJsonSchema, VibeCodexToolSchemaEntry } from './toolSchemaProtocol';
import { createToolSchemaManifestPayload } from './toolSchemaProtocol';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

export type VibeCodexToolCallRoute =
	| 'call_read_only_tool'
	| 'request_approval'
	| 'approve_plan_first'
	| 'repair_arguments'
	| 'unknown_tool';

export interface VibeCodexToolCallStatusRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly toolName?: string;
	readonly arguments: Record<string, unknown>;
	readonly includeSchema: boolean;
	readonly includeRepairHints: boolean;
	readonly requestedAt: number;
}

export interface VibeCodexToolCallStatusResponse {
	readonly ok: boolean;
	readonly source: 'externalExtension';
	readonly version: 1;
	readonly toolName?: string;
	readonly matched: boolean;
	readonly schema?: VibeCodexToolSchemaEntry;
	readonly schemaSummary?: {
		readonly name: string;
		readonly category: string;
		readonly required: readonly string[];
		readonly properties: readonly string[];
	};
	readonly catalogTool?: {
		readonly id: string;
		readonly title: string;
		readonly available: boolean;
		readonly requiresApproval: boolean;
		readonly requiresPlanApproval: boolean;
		readonly blockedReason?: string;
	};
	readonly classification: {
		readonly category?: string;
		readonly mutatesWorkspace: boolean;
		readonly approvalRequired: boolean;
		readonly planApprovalRequired: boolean;
		readonly modeBlocked: boolean;
		readonly executionAuthorized: boolean;
	};
	readonly validation: {
		readonly valid: boolean;
		readonly missingRequired: readonly string[];
		readonly unknownArguments: readonly string[];
		readonly warnings: readonly string[];
		readonly repairHints?: readonly string[];
	};
	readonly route: VibeCodexToolCallRoute;
	readonly nextAction: string;
	readonly promptBlock: string;
	readonly guardrails: readonly string[];
	readonly message: string;
}

export interface VibeCodexToolCallStatusInput {
	readonly toolCatalog?: VibeCodexToolCatalog;
	readonly hasExecutionAuthorization?: boolean;
}

const toolCallStatusMethods = new Set([
	'agent/validateToolCall',
	'agent/toolCallStatus',
	'tool/callStatus',
	'tools/callStatus',
	'vibecodex/toolCallStatus',
]);

const toolCallStatusToolNames = new Set([
	'tool_call_status',
	'tool_call_validate',
	'client_tool_call_status',
	'client_tool_validate',
]);

export function normalizeToolCallStatusRequest(message: JsonRpcMessage): VibeCodexToolCallStatusRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const directParams = parseMaybeJson(message.params);
	const payload = isRecord(directParams) ? directParams : {};
	const outerArgs = outerArgumentRecord(payload);
	const isStatusToolCall = isToolCallStatusToolCall(message.method, payload, outerArgs);
	if (!toolCallStatusMethods.has(message.method) && !isStatusToolCall) {
		return undefined;
	}
	const toolName = isStatusToolCall
		? stringValue(outerArgs.tool)
			?? stringValue(outerArgs.name)
			?? stringValue(outerArgs.toolName)
			?? stringValue(outerArgs.tool_name)
			?? stringValue(outerArgs.targetTool)
			?? stringValue(outerArgs.target_tool)
		: stringValue(payload.tool)
			?? stringValue(payload.name)
			?? stringValue(payload.toolName)
			?? stringValue(payload.tool_name)
			?? stringValue(payload.targetTool)
			?? stringValue(payload.target_tool)
			?? stringValue(outerArgs.tool)
			?? stringValue(outerArgs.name)
			?? stringValue(outerArgs.toolName)
			?? stringValue(outerArgs.tool_name)
			?? stringValue(outerArgs.targetTool)
			?? stringValue(outerArgs.target_tool);
	const callArguments = extractCallArguments(payload, outerArgs, isStatusToolCall);
	return {
		id: message.id,
		method: message.method,
		...(toolName ? { toolName: redactSensitiveText(toolName) } : {}),
		arguments: redactSensitiveValue(callArguments) as Record<string, unknown>,
		includeSchema: booleanValue(payload.includeSchema)
			?? booleanValue(payload.include_schema)
			?? booleanValue(outerArgs.includeSchema)
			?? booleanValue(outerArgs.include_schema)
			?? true,
		includeRepairHints: booleanValue(payload.includeRepairHints)
			?? booleanValue(payload.include_repair_hints)
			?? booleanValue(outerArgs.includeRepairHints)
			?? booleanValue(outerArgs.include_repair_hints)
			?? true,
		requestedAt: Date.now(),
	};
}

export function createToolCallStatusResponse(request: VibeCodexToolCallStatusRequest, input: VibeCodexToolCallStatusInput): VibeCodexToolCallStatusResponse {
	const manifest = createToolSchemaManifestPayload({ toolCatalog: input.toolCatalog, includeUnavailable: true });
	const schema = findSchema(request.toolName, manifest.formats.vibecodex.schemas);
	const catalogTool = schema
		? input.toolCatalog?.tools.find(tool => tool.id === schema.toolCatalogId)
		: undefined;
	const executionAuthorized = input.hasExecutionAuthorization ?? input.toolCatalog?.executionAuthorized ?? false;
	const normalizedArguments = normalizeToolCallArguments(schema, request.arguments);
	const validation = validateArguments(schema?.parameters, normalizedArguments, request.includeRepairHints);
	const matched = !!schema;
	const modeBlocked = !!(schema?.blockedReason || catalogTool?.blockedReason);
	const approvalRequired = !!(schema && (schema.requiresApproval || schema.mutatesWorkspace));
	const planApprovalRequired = !!schema && (schema.requiresPlanApproval || (schema.mutatesWorkspace && !executionAuthorized));
	const route = routeFor(schema, validation.valid, executionAuthorized);
	const nextAction = nextActionFor(route, schema, validation);
	const responseToolName = request.toolName ? schema ? redactSensitiveText(request.toolName) : 'unknown_tool' : undefined;
	const response: VibeCodexToolCallStatusResponse = {
		ok: matched && validation.valid && route !== 'unknown_tool',
		source: 'externalExtension',
		version: 1,
		...(responseToolName ? { toolName: responseToolName } : {}),
		matched,
		...(schema && request.includeSchema ? { schema: redactSensitiveValue(schema) as VibeCodexToolSchemaEntry } : {}),
		...(schema ? { schemaSummary: schemaSummary(schema) } : {}),
		...(catalogTool ? {
			catalogTool: {
				id: catalogTool.id,
				title: catalogTool.title,
				available: catalogTool.available,
				requiresApproval: catalogTool.requiresApproval,
				requiresPlanApproval: catalogTool.requiresPlanApproval,
				...(catalogTool.blockedReason ? { blockedReason: redactSensitiveText(catalogTool.blockedReason) } : {}),
			},
		} : {}),
		classification: {
			...(schema ? { category: schema.category } : {}),
			mutatesWorkspace: !!schema?.mutatesWorkspace,
			approvalRequired,
			planApprovalRequired,
			modeBlocked,
			executionAuthorized,
		},
		validation,
		route,
		nextAction,
		promptBlock: toolCallStatusPromptBlock({
			toolName: responseToolName,
			matched,
			route,
			validation,
			classification: {
				category: schema?.category,
				mutatesWorkspace: !!schema?.mutatesWorkspace,
				approvalRequired,
				planApprovalRequired,
				modeBlocked,
				executionAuthorized,
			},
			catalogToolId: catalogTool?.id,
			blockedReason: schema?.blockedReason ?? catalogTool?.blockedReason,
		}),
		guardrails: [
			'Tool-call preflight is read-only and never executes tools, approves plans, creates approval cards, runs terminals, or mutates files.',
			'Mutating tools still require the exact visual-plan approval, active Mode Policy, workspace sandbox, checkpoint, and user approval gates before execution.',
			'Arguments and blocked reasons are redacted before returning to the backend or rendering in protocol diagnostics.',
		],
		message: toolCallStatusSummaryFromRoute(route, responseToolName, validation),
	};
	return redactSensitiveValue(response) as VibeCodexToolCallStatusResponse;
}

export function toolCallStatusSummary(response: VibeCodexToolCallStatusResponse): string {
	return response.message;
}

function findSchema(toolName: string | undefined, schemas: readonly VibeCodexToolSchemaEntry[]): VibeCodexToolSchemaEntry | undefined {
	if (!toolName) {
		return undefined;
	}
	const normalized = normalizeToolName(toolName);
	return schemas.find(schema => normalizeToolName(schema.name) === normalized || schema.aliases.some(alias => normalizeToolName(alias) === normalized));
}

function validateArguments(parameters: VibeCodexJsonSchema | undefined, args: Record<string, unknown>, includeRepairHints: boolean): VibeCodexToolCallStatusResponse['validation'] {
	if (!parameters) {
		return {
			valid: true,
			missingRequired: [],
			unknownArguments: [],
			warnings: [],
			...(includeRepairHints ? { repairHints: [] } : {}),
		};
	}
	const required = parameters.required ?? [];
	const properties = parameters.properties ?? {};
	const missingRequired = required.filter(key => !hasMeaningfulValue(args, key));
	const unknownArguments = parameters.additionalProperties === false
		? Object.keys(args).filter(key => !Object.prototype.hasOwnProperty.call(properties, key))
		: [];
	const warnings = [
		...unknownArguments.map(key => `Unknown argument "${redactSensitiveText(key)}" is not in this tool schema.`),
	];
	const repairHints = includeRepairHints ? [
		...missingRequired.map(key => `Add required argument "${redactSensitiveText(key)}".`),
		...unknownArguments.map(key => `Remove or rename unknown argument "${redactSensitiveText(key)}" before requesting execution.`),
	] : undefined;
	return {
		valid: missingRequired.length === 0 && unknownArguments.length === 0,
		missingRequired,
		unknownArguments,
		warnings,
		...(repairHints ? { repairHints } : {}),
	};
}

function routeFor(schema: VibeCodexToolSchemaEntry | undefined, valid: boolean, executionAuthorized: boolean): VibeCodexToolCallRoute {
	if (!schema) {
		return 'unknown_tool';
	}
	if (!valid) {
		return 'repair_arguments';
	}
	if ((schema.requiresPlanApproval || schema.mutatesWorkspace) && !executionAuthorized) {
		return 'approve_plan_first';
	}
	if (schema.requiresApproval || schema.mutatesWorkspace || !schema.available) {
		return 'request_approval';
	}
	return 'call_read_only_tool';
}

function nextActionFor(route: VibeCodexToolCallRoute, schema: VibeCodexToolSchemaEntry | undefined, validation: VibeCodexToolCallStatusResponse['validation']): string {
	if (route === 'unknown_tool') {
		return 'Request agent/toolSchemaManifest or agent/getToolSchemas, then retry with a known tool name or alias.';
	}
	if (route === 'repair_arguments') {
		return validation.repairHints?.[0] ?? 'Repair the tool arguments so they match the exported schema.';
	}
	if (route === 'approve_plan_first') {
		return schema?.blockedReason ?? 'Submit or refine the visual plan, then wait for the exact plan revision approval before requesting this tool.';
	}
	if (route === 'request_approval') {
		return schema?.blockedReason ?? 'Send the concrete request through the visible Vibe Codex approval path; do not execute it directly.';
	}
	return 'Call the read-only tool handler; this preflight did not grant mutation permissions.';
}

function schemaSummary(schema: VibeCodexToolSchemaEntry): NonNullable<VibeCodexToolCallStatusResponse['schemaSummary']> {
	return {
		name: schema.name,
		category: schema.category,
		required: schema.parameters?.required ?? [],
		properties: Object.keys(schema.parameters?.properties ?? {}),
	};
}

function toolCallStatusPromptBlock(input: {
	readonly toolName?: string;
	readonly matched: boolean;
	readonly route: VibeCodexToolCallRoute;
	readonly validation: VibeCodexToolCallStatusResponse['validation'];
	readonly classification: VibeCodexToolCallStatusResponse['classification'];
	readonly catalogToolId?: string;
	readonly blockedReason?: string;
}): string {
	return JSON.stringify(redactSensitiveValue({
		toolName: input.toolName,
		matched: input.matched,
		route: input.route,
		validation: input.validation,
		classification: input.classification,
		catalogToolId: input.catalogToolId,
		blockedReason: input.blockedReason,
		note: 'This preflight response does not execute or approve the proposed tool call.',
	}), null, 2);
}

function toolCallStatusSummaryFromRoute(route: VibeCodexToolCallRoute, toolName: string | undefined, validation: VibeCodexToolCallStatusResponse['validation']): string {
	const name = toolName ? redactSensitiveText(toolName) : 'requested tool';
	if (route === 'unknown_tool') {
		return `${name} is not in the current client tool schema manifest.`;
	}
	if (route === 'repair_arguments') {
		return `${name} arguments need repair: ${validation.missingRequired.length} missing required, ${validation.unknownArguments.length} unknown.`;
	}
	if (route === 'approve_plan_first') {
		return `${name} is valid but remains blocked until the exact visual plan revision is approved.`;
	}
	if (route === 'request_approval') {
		return `${name} is valid but must use the visible approval-gated request path.`;
	}
	return `${name} is valid and can be routed to a read-only client tool handler.`;
}

function extractCallArguments(payload: Record<string, unknown>, outerArgs: Record<string, unknown>, statusToolCall: boolean): Record<string, unknown> {
	if (statusToolCall) {
		const nested = firstRecord(outerArgs.arguments, outerArgs.args, outerArgs.input, outerArgs.toolArguments, outerArgs.tool_arguments, outerArgs.params);
		return nested ?? omitControlKeys(outerArgs);
	}
	return firstRecord(payload.arguments, payload.args, payload.input, payload.toolArguments, payload.tool_arguments, payload.params, outerArgs.arguments, outerArgs.args, outerArgs.input) ?? {};
}

function normalizeToolCallArguments(schema: VibeCodexToolSchemaEntry | undefined, args: Record<string, unknown>): Record<string, unknown> {
	if (!schema) {
		return args;
	}
	switch (schema.name) {
		case 'read_file':
			return withReadRangeAliases(withPathAliases(args, true));
		case 'list_dir':
		case 'delete_file':
			return withPathAliases(args, false);
		case 'list_code_definition_names':
			return withMaxResultsAliases(withPathAliases(args, false));
		case 'write_file':
			return withContentAliases(withPathAliases(args, false));
		case 'edit_file':
			return withPatchAliases(withPathAliases(args, false));
		case 'search_files':
			return withSearchFileAliases(withMaxResultsAliases(withQueryAliases(args)));
		case 'semantic_search':
			return withMaxResultsAliases(withQueryAliases(args));
		case 'execute_command':
		case 'command_validate':
			return withCommandAliases(args);
		case 'browser_action':
			return withBrowserActionAliases(args);
		case 'use_mcp_tool':
		case 'access_mcp_resource':
			return withMcpToolAliases(args);
		case 'new_task':
			return withDelegationAliases(args);
		case 'use_subagents':
			return withSubagentAliases(withDelegationAliases(args));
		case 'attempt_completion':
			return withCompletionAliases(args);
		default:
			return args;
	}
}

function withPathAliases(args: Record<string, unknown>, requirePaths: boolean): Record<string, unknown> {
	const path = stringRecordValue(args, 'path')
		?? stringRecordValue(args, 'file')
		?? stringRecordValue(args, 'filePath')
		?? stringRecordValue(args, 'file_path')
		?? stringRecordValue(args, 'filepath')
		?? stringRecordValue(args, 'relativePath')
		?? stringRecordValue(args, 'relative_path')
		?? stringRecordValue(args, 'targetFile')
		?? stringRecordValue(args, 'target_file')
		?? stringRecordValue(args, 'targetPath')
		?? stringRecordValue(args, 'target_path')
		?? stringRecordValue(args, 'directory')
		?? stringRecordValue(args, 'dir')
		?? stringRecordValue(args, 'folder')
		?? stringRecordValue(args, 'folderPath')
		?? stringRecordValue(args, 'folder_path');
	const paths = arrayRecordStrings(args, 'paths')
		?? arrayRecordStrings(args, 'files')
		?? arrayRecordStrings(args, 'filePaths')
		?? arrayRecordStrings(args, 'file_paths')
		?? arrayRecordStrings(args, 'relativePaths')
		?? arrayRecordStrings(args, 'relative_paths');
	const result = omitKeys(args, [
		'file',
		'filePath',
		'file_path',
		'filepath',
		'relativePath',
		'relative_path',
		'targetFile',
		'target_file',
		'targetPath',
		'target_path',
		'directory',
		'dir',
		'folder',
		'folderPath',
		'folder_path',
		'files',
		'filePaths',
		'file_paths',
		'relativePaths',
		'relative_paths',
	]);
	if (path && !stringRecordValue(result, 'path')) {
		result.path = path;
	}
	if (requirePaths && !arrayRecordStrings(result, 'paths')) {
		const normalizedPaths = paths ?? (path ? [path] : undefined);
		if (normalizedPaths?.length) {
			result.paths = normalizedPaths;
		}
	}
	return result;
}

function withReadRangeAliases(args: Record<string, unknown>): Record<string, unknown> {
	const startLine = numberRecordValue(args, 'startLine')
		?? numberRecordValue(args, 'start_line')
		?? numberRecordValue(args, 'lineStart')
		?? numberRecordValue(args, 'line_start')
		?? numberRecordValue(args, 'fromLine')
		?? numberRecordValue(args, 'from_line');
	const endLine = numberRecordValue(args, 'endLine')
		?? numberRecordValue(args, 'end_line')
		?? numberRecordValue(args, 'lineEnd')
		?? numberRecordValue(args, 'line_end')
		?? numberRecordValue(args, 'toLine')
		?? numberRecordValue(args, 'to_line');
	const result = omitKeys(args, ['start_line', 'lineStart', 'line_start', 'fromLine', 'from_line', 'end_line', 'lineEnd', 'line_end', 'toLine', 'to_line']);
	if (startLine !== undefined && result.startLine === undefined) {
		result.startLine = startLine;
	}
	if (endLine !== undefined && result.endLine === undefined) {
		result.endLine = endLine;
	}
	return result;
}

function withContentAliases(args: Record<string, unknown>): Record<string, unknown> {
	const content = stringRecordValue(args, 'content')
		?? stringRecordValue(args, 'contents')
		?? stringRecordValue(args, 'fileContent')
		?? stringRecordValue(args, 'file_content')
		?? stringRecordValue(args, 'newContent')
		?? stringRecordValue(args, 'new_content')
		?? stringRecordValue(args, 'text')
		?? stringRecordValue(args, 'body');
	const result = omitKeys(args, ['contents', 'fileContent', 'file_content', 'newContent', 'new_content', 'text', 'body']);
	if (content && !stringRecordValue(result, 'content')) {
		result.content = content;
	}
	return result;
}

function withPatchAliases(args: Record<string, unknown>): Record<string, unknown> {
	const patch = stringRecordValue(args, 'patch')
		?? stringRecordValue(args, 'diff')
		?? stringRecordValue(args, 'unifiedDiff')
		?? stringRecordValue(args, 'unified_diff')
		?? stringRecordValue(args, 'searchReplace')
		?? stringRecordValue(args, 'search_replace');
	const result = omitKeys(args, ['diff', 'unifiedDiff', 'unified_diff', 'searchReplace', 'search_replace']);
	if (patch && !stringRecordValue(result, 'patch')) {
		result.patch = patch;
	}
	return result;
}

function withQueryAliases(args: Record<string, unknown>): Record<string, unknown> {
	const query = stringRecordValue(args, 'query')
		?? stringRecordValue(args, 'pattern')
		?? stringRecordValue(args, 'regex')
		?? stringRecordValue(args, 'text');
	const result = omitKeys(args, ['pattern', 'regex', 'text']);
	if (query && !stringRecordValue(result, 'query')) {
		result.query = query;
	}
	return result;
}

function withSearchFileAliases(args: Record<string, unknown>): Record<string, unknown> {
	const filePattern = stringRecordValue(args, 'filePattern')
		?? stringRecordValue(args, 'file_pattern')
		?? stringRecordValue(args, 'includePattern')
		?? stringRecordValue(args, 'include_pattern')
		?? stringRecordValue(args, 'glob')
		?? stringRecordValue(args, 'fileGlob')
		?? stringRecordValue(args, 'file_glob');
	const result = omitKeys(args, ['file_pattern', 'includePattern', 'include_pattern', 'glob', 'fileGlob', 'file_glob']);
	if (filePattern && !stringRecordValue(result, 'filePattern')) {
		result.filePattern = filePattern;
	}
	return result;
}

function withMaxResultsAliases(args: Record<string, unknown>): Record<string, unknown> {
	const maxResults = numberRecordValue(args, 'maxResults')
		?? numberRecordValue(args, 'max_results')
		?? numberRecordValue(args, 'limit');
	const result = omitKeys(args, ['max_results', 'limit']);
	if (maxResults !== undefined && result.maxResults === undefined) {
		result.maxResults = maxResults;
	}
	return result;
}

function withCommandAliases(args: Record<string, unknown>): Record<string, unknown> {
	const command = stringRecordValue(args, 'command')
		?? stringRecordValue(args, 'cmd')
		?? stringRecordValue(args, 'commandLine')
		?? stringRecordValue(args, 'command_line')
		?? stringRecordValue(args, 'shellCommand')
		?? stringRecordValue(args, 'shell_command')
		?? arrayRecordStrings(args, 'commands')?.join(' && ');
	const result = omitKeys(args, ['cmd', 'commandLine', 'command_line', 'shellCommand', 'shell_command']);
	if (command && !stringRecordValue(result, 'command')) {
		result.command = command;
	}
	return result;
}

function withBrowserActionAliases(args: Record<string, unknown>): Record<string, unknown> {
	let action = stringRecordValue(args, 'action')
		?? stringRecordValue(args, 'browserAction')
		?? stringRecordValue(args, 'browser_action')
		?? stringRecordValue(args, 'actionType')
		?? stringRecordValue(args, 'action_type')
		?? stringRecordValue(args, 'operation');
	const url = stringRecordValue(args, 'url')
		?? stringRecordValue(args, 'uri')
		?? stringRecordValue(args, 'href')
		?? stringRecordValue(args, 'targetUrl')
		?? stringRecordValue(args, 'target_url');
	const text = stringRecordValue(args, 'text')
		?? stringRecordValue(args, 'input')
		?? stringRecordValue(args, 'value')
		?? stringRecordValue(args, 'content');
	const selector = stringRecordValue(args, 'selector')
		?? stringRecordValue(args, 'cssSelector')
		?? stringRecordValue(args, 'css_selector');
	if (!action && url) {
		action = 'open';
	}
	const result = omitKeys(args, ['browserAction', 'browser_action', 'actionType', 'action_type', 'operation', 'uri', 'href', 'targetUrl', 'target_url', 'input', 'value', 'content', 'cssSelector', 'css_selector']);
	if (action && !stringRecordValue(result, 'action')) {
		result.action = action;
	}
	if (url && !stringRecordValue(result, 'url')) {
		result.url = url;
	}
	if (text && !stringRecordValue(result, 'text')) {
		result.text = text;
	}
	if (selector && !stringRecordValue(result, 'selector')) {
		result.selector = selector;
	}
	return result;
}

function withMcpToolAliases(args: Record<string, unknown>): Record<string, unknown> {
	const serverName = stringRecordValue(args, 'serverName')
		?? stringRecordValue(args, 'server_name')
		?? stringRecordValue(args, 'server');
	const toolName = stringRecordValue(args, 'toolName')
		?? stringRecordValue(args, 'tool_name')
		?? stringRecordValue(args, 'mcpToolName')
		?? stringRecordValue(args, 'mcp_tool_name');
	const resourceUri = stringRecordValue(args, 'uri')
		?? stringRecordValue(args, 'resourceUri')
		?? stringRecordValue(args, 'resource_uri')
		?? stringRecordValue(args, 'resource');
	const result = omitKeys(args, ['server_name', 'server', 'tool_name', 'mcpToolName', 'mcp_tool_name', 'resource_uri', 'resource']);
	if (serverName && !stringRecordValue(result, 'serverName')) {
		result.serverName = serverName;
	}
	if (toolName && !stringRecordValue(result, 'toolName')) {
		result.toolName = toolName;
	}
	if (resourceUri && !stringRecordValue(result, 'uri')) {
		result.uri = resourceUri;
	}
	return result;
}

function withDelegationAliases(args: Record<string, unknown>): Record<string, unknown> {
	const prompt = stringRecordValue(args, 'prompt')
		?? stringRecordValue(args, 'task')
		?? stringRecordValue(args, 'instructions')
		?? stringRecordValue(args, 'description')
		?? stringRecordValue(args, 'context')
		?? stringRecordValue(args, 'message');
	const dependsOn = arrayRecordStrings(args, 'dependsOn')
		?? arrayRecordStrings(args, 'depends_on')
		?? arrayRecordStrings(args, 'dependencies');
	const parallelThreads = numberRecordValue(args, 'parallelThreads')
		?? numberRecordValue(args, 'parallel_threads')
		?? numberRecordValue(args, 'threadCount')
		?? numberRecordValue(args, 'thread_count')
		?? numberRecordValue(args, 'maxAgents')
		?? numberRecordValue(args, 'max_agents')
		?? numberRecordValue(args, 'workers');
	const result = omitKeys(args, ['task', 'instructions', 'description', 'context', 'message', 'depends_on', 'dependencies', 'parallel_threads', 'threadCount', 'thread_count', 'maxAgents', 'max_agents', 'workers']);
	if (prompt && !stringRecordValue(result, 'prompt')) {
		result.prompt = prompt;
	}
	if (dependsOn?.length && !arrayRecordStrings(result, 'dependsOn')) {
		result.dependsOn = dependsOn;
	}
	if (parallelThreads !== undefined && result.parallelThreads === undefined) {
		result.parallelThreads = parallelThreads;
	}
	return result;
}

function withSubagentAliases(args: Record<string, unknown>): Record<string, unknown> {
	const task = stringRecordValue(args, 'task')
		?? stringRecordValue(args, 'prompt');
	const result = { ...args };
	if (task && !stringRecordValue(result, 'task')) {
		result.task = task;
	}
	return result;
}

function withCompletionAliases(args: Record<string, unknown>): Record<string, unknown> {
	const summary = stringRecordValue(args, 'summary')
		?? stringRecordValue(args, 'result')
		?? stringRecordValue(args, 'message')
		?? stringRecordValue(args, 'text')
		?? stringRecordValue(args, 'response');
	const result = omitKeys(args, ['result', 'message', 'text', 'response']);
	if (summary && !stringRecordValue(result, 'summary')) {
		result.summary = summary;
	}
	return result;
}

function omitKeys(args: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
	const blocked = new Set(keys);
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args)) {
		if (!blocked.has(key)) {
			result[key] = value;
		}
	}
	return result;
}

function omitControlKeys(value: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const controlKeys = new Set([
		'tool',
		'name',
		'toolName',
		'tool_name',
		'targetTool',
		'target_tool',
		'includeSchema',
		'include_schema',
		'includeRepairHints',
		'include_repair_hints',
	]);
	for (const [key, entry] of Object.entries(value)) {
		if (!controlKeys.has(key)) {
			result[key] = entry;
		}
	}
	return result;
}

function stringRecordValue(value: Record<string, unknown>, key: string): string | undefined {
	return stringValue(value[key]);
}

function arrayRecordStrings(value: Record<string, unknown>, key: string): readonly string[] | undefined {
	const item = value[key];
	if (!Array.isArray(item)) {
		return undefined;
	}
	const strings = item.map(entry => typeof entry === 'string' ? entry.trim() : '').filter(entry => !!entry);
	return strings.length ? strings : undefined;
}

function numberRecordValue(value: Record<string, unknown>, key: string): number | undefined {
	const item = value[key];
	if (typeof item === 'number' && Number.isFinite(item)) {
		return item;
	}
	if (typeof item === 'string' && /^-?[0-9]+(?:\.[0-9]+)?$/.test(item.trim())) {
		return Number(item.trim());
	}
	return undefined;
}

function isToolCallStatusToolCall(method: string, payload: Record<string, unknown>, args: Record<string, unknown>): boolean {
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
	return toolCallStatusToolNames.has(tool);
}

function hasMeaningfulValue(value: Record<string, unknown>, key: string): boolean {
	if (!Object.prototype.hasOwnProperty.call(value, key)) {
		return false;
	}
	const entry = value[key];
	return !(entry === undefined || entry === null || entry === '');
}

function normalizeToolName(value: string): string {
	return value.trim().toLowerCase();
}

function outerArgumentRecord(payload: Record<string, unknown>): Record<string, unknown> {
	const args = payload.arguments ?? payload.args ?? payload.input ?? payload.params;
	return isRecord(args) ? args : {};
}

function firstRecord(...values: readonly unknown[]): Record<string, unknown> | undefined {
	for (const value of values) {
		if (isRecord(value)) {
			return value;
		}
		const parsed = parseMaybeJson(value);
		if (isRecord(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	const text = value.trim();
	if (!text || !/^[\[{"]/.test(text)) {
		return value;
	}
	try {
		return JSON.parse(text);
	} catch {
		return value;
	}
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
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
