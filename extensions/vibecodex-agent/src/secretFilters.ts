/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const maxSecretFilterDepth = 8;
const maxSecretFilterArrayItems = 80;
const sensitiveKeyPattern = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|approval[-_]?token|authorization|password|secret|credential|bearer|client[-_]?secret|private[-_]?key)/i;
const sensitiveAssignmentPattern = /((?:api[-_]?key|access[-_]?token|refresh[-_]?token|approval[-_]?token|authorization|password|secret|credential|client[-_]?secret|private[-_]?key)\s*[:=]\s*)(["']?)([^\s"',;&]+)/gi;
const privateKeyBlockPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const openAiKeyPattern = /\bsk-[A-Za-z0-9_-]{10,}\b/g;
const githubTokenPattern = /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g;
const slackTokenPattern = /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const awsAccessKeyPattern = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const vibeCodexApprovalTokenPattern = /vibecodex-plan:[^\s"',}]+/g;

export function redactSensitiveText(value: string): string {
	return value
		.replace(privateKeyBlockPattern, '[redacted:private-key]')
		.replace(bearerPattern, 'Bearer [redacted]')
		.replace(openAiKeyPattern, '[redacted:api-key]')
		.replace(githubTokenPattern, '[redacted:github-token]')
		.replace(slackTokenPattern, '[redacted:slack-token]')
		.replace(awsAccessKeyPattern, '[redacted:aws-access-key]')
		.replace(jwtPattern, '[redacted:jwt]')
		.replace(vibeCodexApprovalTokenPattern, '[redacted:approval-token]')
		.replace(sensitiveAssignmentPattern, (_match, prefix: string, quote: string) => `${prefix}${quote}[redacted]`)
		.replace(/([?&](?:token|api_key|apikey|key|secret|password|auth|access_token|refresh_token)=)[^&\s]+/gi, '$1[redacted]');
}

export function redactSensitiveValue(value: unknown, depth = 0): unknown {
	if (depth > maxSecretFilterDepth) {
		return '[truncated]';
	}
	if (typeof value === 'string') {
		return redactSensitiveText(value);
	}
	if (typeof value !== 'object' || value === null) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.slice(0, maxSecretFilterArrayItems).map(item => redactSensitiveValue(item, depth + 1));
	}
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		if (sensitiveKeyPattern.test(key)) {
			result[key] = '[redacted]';
			continue;
		}
		result[key] = redactSensitiveValue(item, depth + 1);
	}
	return result;
}
