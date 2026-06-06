/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JsonRpcId, JsonRpcMessage } from './externalBridge';

declare const require: (module: string) => unknown;
declare const URL: {
	new(input: string, base?: string): {
		readonly protocol: string;
		readonly hostname: string;
		readonly href: string;
		readonly username: string;
		readonly password: string;
		pathname: string;
		search: string;
	};
};
declare function encodeURIComponent(value: string): string;
declare function setTimeout(handler: () => void, timeout?: number): number;
declare function clearTimeout(handle: number): void;

type HttpRequest = (url: string, options: { readonly method: string; readonly headers?: Record<string, string> }, callback: (response: HttpResponse) => void) => HttpClientRequest;
interface HttpClientRequest {
	on(event: 'error', listener: (error: Error) => void): void;
	setTimeout(ms: number, callback: () => void): void;
	destroy(error?: Error): void;
	end(): void;
}
interface HttpResponse {
	readonly statusCode?: number;
	readonly statusMessage?: string;
	readonly headers: Record<string, string | readonly string[] | undefined>;
	on(event: 'data', listener: (chunk: Uint8Array | string) => void): void;
	on(event: 'end', listener: () => void): void;
}

export interface VibeCodexWebFetchRequest {
	readonly id: JsonRpcId;
	readonly method: string;
	readonly kind: 'fetch' | 'search';
	readonly url: string;
	readonly query?: string;
	readonly reason?: string;
	readonly supported: boolean;
	readonly blocked: boolean;
	readonly risk: 'medium' | 'blocked';
	readonly title: string;
	readonly detail: string;
	readonly requestedAt: number;
}

export interface VibeCodexWebFetchResult {
	readonly ok: boolean;
	readonly url: string;
	readonly status?: number;
	readonly statusText?: string;
	readonly contentType?: string;
	readonly text?: string;
	readonly truncated?: boolean;
	readonly error?: string;
}

const maxFetchBytes = 120000;
const maxResponseChars = 24000;
const fetchTimeoutMs = 15000;
const redirectLimit = 3;

const webFetchMethods = new Set([
	'agent/webFetch',
	'agent/web/fetch',
	'web/fetch',
	'fetch/url',
	'item/web/fetch',
	'cline/web_fetch',
	'cline/web_search',
	'web/search',
	'agent/webSearch',
	'agent/web/search',
]);

export function normalizeWebFetchRequest(message: JsonRpcMessage): VibeCodexWebFetchRequest | undefined {
	if (message.id === undefined || !message.method || !isWebFetchMethod(message.method, message.params)) {
		return undefined;
	}
	const payload = isRecord(message.params) ? message.params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const toolName = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	const searchQuery = isWebSearchMethod(message.method, toolName)
		? stringValue(payload.query) ?? stringValue(args.query) ?? stringValue(payload.search) ?? stringValue(args.search) ?? stringValue(payload.prompt) ?? stringValue(args.prompt)
		: undefined;
	const redactedQuery = searchQuery ? redactFetchText(searchQuery).slice(0, 500) : undefined;
	const rawUrl = redactedQuery
		? searchUrlFor(redactedQuery)
		: stringValue(payload.url)
		?? stringValue(args.url)
		?? stringValue(payload.uri)
		?? stringValue(args.uri)
		?? stringValue(payload.href)
		?? stringValue(args.href);
	if (!rawUrl) {
		return undefined;
	}
	const reason = redactFetchText(stringValue(payload.reason) ?? stringValue(args.reason) ?? stringValue(payload.description) ?? stringValue(args.description) ?? '');
	const safety = validateFetchUrl(rawUrl);
	return {
		id: message.id,
		method: message.method,
		kind: redactedQuery ? 'search' : 'fetch',
		url: redactUrl(rawUrl),
		...(redactedQuery ? { query: redactedQuery } : {}),
		...(reason ? { reason: reason.slice(0, 500) } : {}),
		supported: safety.safe,
		blocked: !safety.safe,
		risk: safety.safe ? 'medium' : 'blocked',
		title: redactedQuery ? 'Web search approval' : 'Web fetch approval',
		detail: [
			reason,
			redactedQuery ? `Query: ${redactedQuery}` : undefined,
			`URL: ${redactUrl(rawUrl)}`,
			safety.safe ? `${redactedQuery ? 'Search results are fetched with' : 'HTTP(S) GET only;'} response text capped and redacted before returning to the backend.` : safety.reason,
		].filter((value): value is string => !!value).join('\n'),
		requestedAt: Date.now(),
	};
}

export async function performWebFetch(request: VibeCodexWebFetchRequest): Promise<VibeCodexWebFetchResult> {
	if (!request.supported) {
		return { ok: false, url: request.url, error: 'Web fetch URL is blocked by the Vibe Codex safety policy.' };
	}
	try {
		return await fetchUrl(request.url, redirectLimit);
	} catch (error) {
		return {
			ok: false,
			url: request.url,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export function createWebFetchResponse(request: VibeCodexWebFetchRequest, accepted: boolean, result?: VibeCodexWebFetchResult): unknown {
	const approved = accepted && request.supported;
	return {
		approved,
		decision: approved ? 'accept' : 'decline',
		source: 'externalExtension',
		kind: request.kind,
		url: request.url,
		...(request.query ? { query: request.query } : {}),
		...(result ? { result } : {}),
		...(!accepted ? { message: 'Web fetch declined.' } : {}),
		...(accepted && !request.supported ? { message: 'Web fetch blocked by URL safety policy.' } : {}),
	};
}

export function isSafeWebFetchUrl(url: string): boolean {
	return validateFetchUrl(url).safe;
}

function isWebFetchMethod(method: string, params: unknown): boolean {
	if (webFetchMethods.has(method)) {
		return true;
	}
	if (method !== 'item/tool/call') {
		return false;
	}
	const payload = isRecord(params) ? params : {};
	const args = isRecord(payload.arguments) ? payload.arguments : isRecord(payload.args) ? payload.args : {};
	const tool = (stringValue(payload.tool) ?? stringValue(payload.name) ?? stringValue(args.tool) ?? stringValue(args.name) ?? '').toLowerCase();
	return tool === 'web_fetch'
		|| tool === 'fetch_web'
		|| tool === 'fetch'
		|| tool === 'fetch_url'
		|| tool === 'fetch_web_content'
		|| tool === 'web_search'
		|| tool === 'search_web';
}

function isWebSearchMethod(method: string, toolName: string): boolean {
	return method === 'cline/web_search'
		|| method === 'web/search'
		|| method === 'agent/webSearch'
		|| method === 'agent/web/search'
		|| toolName === 'web_search'
		|| toolName === 'search_web';
}

function validateFetchUrl(value: string): { readonly safe: boolean; readonly reason?: string } {
	let url: InstanceType<typeof URL>;
	try {
		url = new URL(value);
	} catch {
		return { safe: false, reason: 'URL is invalid.' };
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { safe: false, reason: 'Only HTTP(S) URLs can be fetched.' };
	}
	if (url.username || url.password) {
		return { safe: false, reason: 'URLs with embedded credentials are blocked.' };
	}
	if (/\s/.test(value)) {
		return { safe: false, reason: 'URLs containing whitespace are blocked.' };
	}
	return { safe: true };
}

function fetchUrl(url: string, redirectsRemaining: number): Promise<VibeCodexWebFetchResult> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const client = require(parsed.protocol === 'https:' ? 'https' : 'http') as { readonly request: HttpRequest };
		const timer = setTimeout(() => reject(new Error('Web fetch timed out.')), fetchTimeoutMs + 1000);
		const request = client.request(parsed.href, {
			method: 'GET',
			headers: {
				'user-agent': 'VibeCodex-Agent/0.1',
				'accept': 'text/plain,text/markdown,text/html,application/json;q=0.9,*/*;q=0.5',
			},
		}, response => {
			const status = response.statusCode ?? 0;
			const location = headerValue(response.headers.location);
			if (location && status >= 300 && status < 400 && redirectsRemaining > 0) {
				clearTimeout(timer);
				const redirectUrl = new URL(location, parsed.href).href;
				void fetchUrl(redirectUrl, redirectsRemaining - 1).then(resolve, reject);
				return;
			}
			const chunks: Array<Uint8Array | string> = [];
			let bytes = 0;
			let truncated = false;
			response.on('data', chunk => {
				const length = typeof chunk === 'string' ? chunk.length : chunk.byteLength;
				bytes += length;
				if (bytes <= maxFetchBytes) {
					chunks.push(chunk);
				} else {
					truncated = true;
				}
			});
			response.on('end', () => {
				clearTimeout(timer);
				const raw = chunks.map(chunk => typeof chunk === 'string' ? chunk : bytesToString(chunk)).join('');
				const text = redactFetchText(raw).slice(0, maxResponseChars);
				resolve({
					ok: status >= 200 && status < 300,
					url: redactUrl(parsed.href),
					status,
					...(response.statusMessage ? { statusText: response.statusMessage } : {}),
					...(headerValue(response.headers['content-type']) ? { contentType: headerValue(response.headers['content-type']) } : {}),
					text,
					truncated: truncated || raw.length > maxResponseChars,
				});
			});
		});
		request.on('error', error => {
			clearTimeout(timer);
			reject(error);
		});
		request.setTimeout(fetchTimeoutMs, () => {
			request.destroy(new Error('Web fetch timed out.'));
		});
		request.end();
	});
}

function bytesToString(bytes: Uint8Array): string {
	let output = '';
	for (const byte of bytes) {
		output += String.fromCharCode(byte);
	}
	try {
		return decodeURIComponent(escape(output));
	} catch {
		return output;
	}
}

function redactFetchText(value: string): string {
	return value
		.replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, '[redacted:api-key]')
		.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
		.replace(/([?&](?:token|api_key|apikey|key|secret|password|auth|access_token|refresh_token)=)[^&\s"']+/gi, '$1[redacted]');
}

function redactUrl(url: string): string {
	const noCredentials = url.replace(/^(https?:\/\/)([^/@]+)@/i, '$1[redacted]@');
	const [base, query] = noCredentials.split('?', 2);
	if (!query) {
		return noCredentials;
	}
	return `${base}?${query.split('&').map(part => {
		const [key, value = ''] = part.split('=', 2);
		if (/token|key|secret|password|auth/i.test(key)) {
			return `${key}=[redacted]`;
		}
		const redactedValue = value.replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted:api-key]');
		return value ? `${key}=${redactedValue}` : key;
	}).join('&')}`;
}

function searchUrlFor(query: string): string {
	return `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
}

function headerValue(value: string | readonly string[] | undefined): string | undefined {
	if (typeof value === 'string') {
		return value;
	}
	return Array.isArray(value) ? value[0] : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
