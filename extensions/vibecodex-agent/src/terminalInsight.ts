/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { VibeCodexCapturedTerminalRun, VibeCodexTerminalRunStatus } from './terminalRunner';

export type VibeCodexTerminalInsightKind = 'test-failure' | 'lint-failure' | 'typecheck-failure' | 'build-failure' | 'runtime-error' | 'port-conflict' | 'dev-server' | 'command-success' | 'interrupted' | 'unknown-failure';
export type VibeCodexTerminalInsightSeverity = 'info' | 'warning' | 'error';

export interface VibeCodexTerminalInsightFinding {
	readonly id: string;
	readonly kind: VibeCodexTerminalInsightKind;
	readonly severity: VibeCodexTerminalInsightSeverity;
	readonly title: string;
	readonly detail: string;
}

export interface VibeCodexTerminalInsight {
	readonly version: 1;
	readonly runId: string;
	readonly commandLine: string;
	readonly status: VibeCodexTerminalRunStatus;
	readonly createdAt: number;
	readonly summary: string;
	readonly findings: readonly VibeCodexTerminalInsightFinding[];
	readonly urls: readonly string[];
	readonly followUpPrompt?: string;
}

const maxOutputSample = 4000;
const maxUrls = 8;

export function createTerminalInsight(run: Pick<VibeCodexCapturedTerminalRun, 'id' | 'commandLine' | 'status' | 'output' | 'exitCode' | 'signal'>): VibeCodexTerminalInsight {
	const output = run.output.slice(-maxOutputSample);
	const urls = localUrls(output);
	const findings = [
		...failureFindings(run, output),
		...urlFindings(urls),
		...statusFindings(run, output, urls),
	];
	const uniqueFindings = dedupeFindings(findings);
	return {
		version: 1,
		runId: run.id,
		commandLine: run.commandLine,
		status: run.status,
		createdAt: Date.now(),
		summary: terminalInsightSummary(run, uniqueFindings, urls),
		findings: uniqueFindings,
		urls,
		...(uniqueFindings.some(finding => finding.severity === 'error') ? { followUpPrompt: remediationPrompt(run, uniqueFindings, output) } : {}),
	};
}

export function terminalInsightPromptBlock(insight: VibeCodexTerminalInsight): string {
	return JSON.stringify({
		version: insight.version,
		runId: insight.runId,
		commandLine: insight.commandLine,
		status: insight.status,
		summary: insight.summary,
		urls: insight.urls,
		findings: insight.findings,
		followUpPrompt: insight.followUpPrompt,
	}, null, 2);
}

export function terminalInsightSignature(insight: VibeCodexTerminalInsight): string {
	return JSON.stringify({
		status: insight.status,
		urls: insight.urls,
		findings: insight.findings.map(finding => [finding.kind, finding.title, finding.detail.slice(0, 240)]),
	});
}

function failureFindings(run: Pick<VibeCodexCapturedTerminalRun, 'status' | 'output'>, output: string): readonly VibeCodexTerminalInsightFinding[] {
	const findings: VibeCodexTerminalInsightFinding[] = [];
	if (/EADDRINUSE|address already in use/i.test(output)) {
		findings.push(finding('port-conflict', 'error', 'Port conflict detected', sampleLine(output, /EADDRINUSE|address already in use/i)));
	}
	if (/error TS\d{4}|TS\d{4}:|TypeScript error/i.test(output)) {
		findings.push(finding('typecheck-failure', 'error', 'TypeScript/typecheck failure detected', sampleLine(output, /error TS\d{4}|TS\d{4}:|TypeScript error/i)));
	}
	if (/\b(?:eslint|ruff|flake8|pylint)\b[\s\S]{0,200}\b(?:error|failed|violation)\b/i.test(output)) {
		findings.push(finding('lint-failure', 'error', 'Lint failure detected', sampleLine(output, /\b(?:eslint|ruff|flake8|pylint)\b/i)));
	}
	if (/\b(?:FAIL|failed tests?|tests? failed|failing|AssertionError|Expected\b[\s\S]{0,120}\bReceived)\b/i.test(output)) {
		findings.push(finding('test-failure', 'error', 'Test failure detected', sampleLine(output, /\b(?:FAIL|failed tests?|tests? failed|failing|AssertionError|Expected\b[\s\S]{0,120}\bReceived)\b/i)));
	}
	if (/\b(?:build failed|compilation failed|compile error|webpack.*error|vite.*error|rollup.*error|npm ERR!)\b/i.test(output)) {
		findings.push(finding('build-failure', 'error', 'Build failure detected', sampleLine(output, /\b(?:build failed|compilation failed|compile error|webpack.*error|vite.*error|rollup.*error|npm ERR!)\b/i)));
	}
	if (/\b(?:Traceback \(most recent call last\)|UnhandledPromiseRejection|panic:|Exception:|Error:)\b/i.test(output) && run.status === 'failed') {
		findings.push(finding('runtime-error', 'error', 'Runtime error detected', sampleLine(output, /\b(?:Traceback \(most recent call last\)|UnhandledPromiseRejection|panic:|Exception:|Error:)\b/i)));
	}
	return findings;
}

function urlFindings(urls: readonly string[]): readonly VibeCodexTerminalInsightFinding[] {
	if (!urls.length) {
		return [];
	}
	return [finding('dev-server', 'info', 'Local preview URL detected', urls.join('\n'))];
}

function statusFindings(run: Pick<VibeCodexCapturedTerminalRun, 'status' | 'exitCode' | 'signal'>, output: string, urls: readonly string[]): readonly VibeCodexTerminalInsightFinding[] {
	if (run.status === 'passed' && !outputLooksFailureLike(output)) {
		return [finding('command-success', 'info', 'Terminal command completed successfully', run.exitCode !== undefined ? `Exit ${run.exitCode}` : 'Exit status passed.')];
	}
	if (run.status === 'interrupted') {
		return [finding('interrupted', 'warning', 'Terminal command was interrupted', run.signal ? `Signal: ${run.signal}` : 'Interrupted by user or process signal.')];
	}
	if (run.status === 'failed' && !urls.length && !outputLooksFailureLike(output)) {
		return [finding('unknown-failure', 'error', 'Terminal command failed without a classified pattern', run.exitCode !== undefined ? `Exit ${run.exitCode}` : 'No exit code was captured.')];
	}
	return [];
}

function terminalInsightSummary(run: Pick<VibeCodexCapturedTerminalRun, 'status'>, findings: readonly VibeCodexTerminalInsightFinding[], urls: readonly string[]): string {
	const errors = findings.filter(finding => finding.severity === 'error').length;
	const warnings = findings.filter(finding => finding.severity === 'warning').length;
	const info = findings.filter(finding => finding.severity === 'info').length;
	return `${run.status}: ${errors} error insight${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, ${info} info; ${urls.length} local URL${urls.length === 1 ? '' : 's'}.`;
}

function remediationPrompt(run: Pick<VibeCodexCapturedTerminalRun, 'commandLine'>, findings: readonly VibeCodexTerminalInsightFinding[], output: string): string {
	return [
		`Investigate the failed terminal command: ${run.commandLine}`,
		'Classified findings:',
		...findings.map(finding => `- ${finding.kind}: ${finding.title} - ${finding.detail}`),
		'Use the existing visual plan and approval gates before proposing code changes.',
		`Terminal tail:\n${output.slice(-1200)}`,
	].join('\n');
}

function outputLooksFailureLike(output: string): boolean {
	return /EADDRINUSE|address already in use|error TS\d{4}|TS\d{4}:|FAIL|failed tests?|tests? failed|AssertionError|build failed|compilation failed|Traceback \(most recent call last\)|UnhandledPromiseRejection|panic:|npm ERR!/i.test(output);
}

function localUrls(output: string): readonly string[] {
	const matches = output.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?(?:\/[^\s'"<>)\]]*)?/gi) ?? [];
	return [...new Set(matches)].slice(0, maxUrls);
}

function sampleLine(output: string, pattern: RegExp): string {
	const line = output.split(/\r?\n/).find(line => pattern.test(line));
	return line?.trim().slice(0, 700) || 'Pattern matched in terminal output.';
}

function finding(kind: VibeCodexTerminalInsightKind, severity: VibeCodexTerminalInsightSeverity, title: string, detail: string): VibeCodexTerminalInsightFinding {
	return {
		id: `${kind}:${hashText(`${title}:${detail}`).slice(0, 8)}`,
		kind,
		severity,
		title,
		detail,
	};
}

function dedupeFindings(findings: readonly VibeCodexTerminalInsightFinding[]): readonly VibeCodexTerminalInsightFinding[] {
	const seen = new Set<string>();
	return findings.filter(finding => {
		if (seen.has(finding.id)) {
			return false;
		}
		seen.add(finding.id);
		return true;
	});
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}
