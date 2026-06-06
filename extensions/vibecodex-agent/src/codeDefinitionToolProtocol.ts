/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { JsonRpcId, JsonRpcMessage } from './externalBridge';

export interface VibeCodexCodeDefinitionRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly path: string;
	readonly recursive: boolean;
	readonly maxResults: number;
	readonly requestedAt: number;
}

const defaultMaxResults = 120;
const hardMaxResults = 240;

const codeDefinitionMethods = new Set([
	'workspace/listCodeDefinitionNames',
	'workspace/listCodeDefinitions',
	'workspace/symbols',
	'agent/listCodeDefinitionNames',
	'agent/listCodeDefinitions',
	'symbols/listDefinitions',
	'code/listDefinitions',
]);

export function normalizeCodeDefinitionRequest(message: JsonRpcMessage): VibeCodexCodeDefinitionRequest | undefined {
	if (message.id === undefined || !message.method) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	if (!isCodeDefinitionRequest(message.method, toolName)) {
		return undefined;
	}
	const path = stringValue(payload.path)
		?? stringValue(args.path)
		?? stringValue(payload.file)
		?? stringValue(args.file)
		?? stringValue(payload.filePath)
		?? stringValue(args.filePath)
		?? stringValue(payload.file_path)
		?? stringValue(args.file_path)
		?? stringValue(payload.relativePath)
		?? stringValue(args.relativePath)
		?? stringValue(payload.relative_path)
		?? stringValue(args.relative_path)
		?? stringValue(payload.directory)
		?? stringValue(args.directory)
		?? stringValue(payload.dir)
		?? stringValue(args.dir)
		?? stringValue(payload.folder)
		?? stringValue(args.folder)
		?? stringValue(payload.folderPath)
		?? stringValue(args.folderPath)
		?? stringValue(payload.folder_path)
		?? stringValue(args.folder_path)
		?? '.';
	const maxResults = Math.max(1, Math.min(hardMaxResults,
		numberValue(payload.maxResults)
		?? numberValue(args.maxResults)
		?? numberValue(payload.max_results)
		?? numberValue(args.max_results)
		?? numberValue(payload.limit)
		?? numberValue(args.limit)
		?? defaultMaxResults));
	return {
		id: message.id,
		method: message.method,
		path,
		recursive: booleanValue(payload.recursive) ?? booleanValue(args.recursive) ?? true,
		maxResults,
		requestedAt: Date.now(),
	};
}

function isCodeDefinitionRequest(method: string, toolName: string): boolean {
	return codeDefinitionMethods.has(method)
		|| toolName === 'list_code_definition_names'
		|| toolName === 'list_code_definitions'
		|| toolName === 'list_symbols';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
	const valueAsNumber = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(valueAsNumber) ? valueAsNumber : undefined;
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
