/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { redactSensitiveText, redactSensitiveValue } from './secretFilters';

declare function require(name: string): unknown;

const path = require('path') as {
	readonly relative: (from: string, to: string) => string;
	readonly sep: string;
};

export interface VibeCodexDiagnosticsSnapshot {
	readonly capturedAt: number;
	readonly total: number;
	readonly errors: number;
	readonly warnings: number;
	readonly information: number;
	readonly hints: number;
	readonly sample: readonly VibeCodexDiagnosticsSample[];
}

export interface VibeCodexDiagnosticsSample {
	readonly path: string;
	readonly severity: 'error' | 'warning' | 'information' | 'hint';
	readonly message: string;
	readonly range: string;
	readonly source?: string;
}

export interface VibeCodexDiagnosticsBaselineLike {
	readonly error: number;
	readonly warning: number;
	readonly information: number;
	readonly hint: number;
}

const maxDiagnosticsEvidence = 80;
const maxDiagnosticMessageLength = 500;

export function collectDiagnosticsSnapshot(): VibeCodexDiagnosticsSnapshot {
	let errors = 0;
	let warnings = 0;
	let information = 0;
	let hints = 0;
	const sample: VibeCodexDiagnosticsSample[] = [];

	for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
		const relativePath = workspaceRelativePath(uri);
		if (!relativePath) {
			continue;
		}
		for (const diagnostic of diagnostics) {
			const severity = diagnosticSeverity(diagnostic.severity);
			if (severity === 'error') {
				errors++;
			} else if (severity === 'warning') {
				warnings++;
			} else if (severity === 'information') {
				information++;
			} else {
				hints++;
			}
			if (sample.length < maxDiagnosticsEvidence) {
				sample.push({
					path: relativePath,
					severity,
					message: capDiagnosticMessage(redactSensitiveText(diagnostic.message)),
					range: diagnosticRange(diagnostic.range),
					...(diagnostic.source ? { source: redactSensitiveText(diagnostic.source) } : {}),
				});
			}
		}
	}

	return {
		capturedAt: Date.now(),
		total: errors + warnings + information + hints,
		errors,
		warnings,
		information,
		hints,
		sample,
	};
}

export function diagnosticsSnapshotSummary(snapshot: VibeCodexDiagnosticsSnapshot): string {
	if (snapshot.total === 0) {
		return 'No workspace diagnostics after run.';
	}
	return [
		`Diagnostics after run: ${countLabel(snapshot.errors, 'error')}, ${countLabel(snapshot.warnings, 'warning')}, ${countLabel(snapshot.information, 'information')}, ${countLabel(snapshot.hints, 'hint')}.`,
		snapshot.sample.length ? `Sample: ${snapshot.sample.slice(0, 5).map(item => `${item.path}:${item.range} ${item.severity}: ${item.message}`).join(' | ')}` : undefined,
	].filter(Boolean).join('\n');
}

export function diagnosticsSnapshotPromptBlock(snapshot: VibeCodexDiagnosticsSnapshot): string {
	return JSON.stringify(redactSensitiveValue({
		capturedAt: snapshot.capturedAt,
		total: snapshot.total,
		errors: snapshot.errors,
		warnings: snapshot.warnings,
		information: snapshot.information,
		hints: snapshot.hints,
		sample: snapshot.sample,
		note: 'Snapshot captured from vscode.languages.getDiagnostics after terminal/test completion.',
	}), null, 2);
}

export function diagnosticsBaselineStatus(snapshot: VibeCodexDiagnosticsSnapshot, baseline: VibeCodexDiagnosticsBaselineLike): 'passed' | 'failed' {
	return snapshot.errors > baseline.error ? 'failed' : 'passed';
}

export function diagnosticsBaselineEvidence(snapshot: VibeCodexDiagnosticsSnapshot, baseline: VibeCodexDiagnosticsBaselineLike): string {
	const status = diagnosticsBaselineStatus(snapshot, baseline);
	return [
		`Diagnostics baseline ${status}: ${countLabel(snapshot.errors, 'error')} after run vs ${countLabel(baseline.error, 'error')} at plan time.`,
		`Deltas: errors ${signedDelta(snapshot.errors - baseline.error)}, warnings ${signedDelta(snapshot.warnings - baseline.warning)}, information ${signedDelta(snapshot.information - baseline.information)}, hints ${signedDelta(snapshot.hints - baseline.hint)}.`,
		diagnosticsSnapshotSummary(snapshot),
	].join('\n');
}

function diagnosticSeverity(severity: vscode.DiagnosticSeverity): VibeCodexDiagnosticsSample['severity'] {
	switch (severity) {
		case vscode.DiagnosticSeverity.Error:
			return 'error';
		case vscode.DiagnosticSeverity.Warning:
			return 'warning';
		case vscode.DiagnosticSeverity.Information:
			return 'information';
		default:
			return 'hint';
	}
}

function diagnosticRange(range: vscode.Range): string {
	return `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}`;
}

function capDiagnosticMessage(message: string): string {
	return message.length > maxDiagnosticMessageLength ? `${message.slice(0, maxDiagnosticMessageLength)}\n[truncated]` : message;
}

function countLabel(count: number, label: string): string {
	return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function signedDelta(value: number): string {
	return value > 0 ? `+${value}` : String(value);
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	const roots = vscode.workspace.workspaceFolders ?? [];
	if (!roots.length) {
		return uri.fsPath;
	}
	for (const folder of roots) {
		const relative = path.relative(folder.uri.fsPath, uri.fsPath);
		if (relative && !relative.startsWith('..') && !isAbsoluteLike(relative)) {
			return relative.replace(/\\/g, '/');
		}
		if (!relative) {
			return folder.name;
		}
	}
	return undefined;
}

function isAbsoluteLike(value: string): boolean {
	return value.startsWith('/') || value.startsWith(`..${path.sep}`);
}
