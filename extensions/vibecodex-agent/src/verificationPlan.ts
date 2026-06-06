/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export interface VibeCodexVerificationPlan {
	readonly version: 1;
	readonly createdAt: number;
	readonly workspaceRoot?: string;
	readonly checks: readonly VibeCodexVerificationCheck[];
	readonly diagnosticsBaseline: VibeCodexDiagnosticsBaseline;
	readonly acceptanceCriteria: readonly string[];
}

export type VibeCodexVerificationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface VibeCodexVerificationCheck {
	readonly id: string;
	readonly label: string;
	readonly command?: string;
	readonly kind: 'test' | 'lint' | 'build' | 'typecheck' | 'diagnostics' | 'custom';
	readonly status: VibeCodexVerificationStatus;
	readonly required: boolean;
	readonly source: string;
	readonly lastRunId?: string;
	readonly evidence?: string;
	readonly updatedAt?: number;
}

export interface VibeCodexDiagnosticsBaseline {
	readonly error: number;
	readonly warning: number;
	readonly information: number;
	readonly hint: number;
}

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const maxPackageFiles = 5;
const maxProjectFiles = 5;
const maxChecks = 18;
const maxAcceptanceCriteria = 12;

export async function collectVerificationPlan(acceptanceCriteria: readonly string[] = []): Promise<VibeCodexVerificationPlan> {
	const root = vscode.workspace.workspaceFolders?.[0];
	const checks = new Map<string, VibeCodexVerificationCheck>();
	const explicitAcceptanceCriteria = normalizeExplicitAcceptanceCriteria(acceptanceCriteria);
	const effectiveAcceptanceCriteria = explicitAcceptanceCriteria.length ? explicitAcceptanceCriteria : defaultAcceptanceCriteria();
	collectAcceptanceCriteriaChecks(checks, effectiveAcceptanceCriteria);
	await collectPackageJsonChecks(checks);
	await collectCargoChecks(checks);
	await collectPythonChecks(checks);
	await collectGoChecks(checks);
	addCheck(checks, {
		id: 'diagnostics-baseline',
		label: 'IDE diagnostics do not introduce new errors',
		kind: 'diagnostics',
		status: 'pending',
		required: true,
		source: 'vscode.languages.getDiagnostics',
	});

	return {
		version: 1,
		createdAt: Date.now(),
		...(root ? { workspaceRoot: root.uri.fsPath } : {}),
		checks: [...checks.values()].slice(0, maxChecks),
		diagnosticsBaseline: collectDiagnosticsBaseline(),
		acceptanceCriteria: effectiveAcceptanceCriteria,
	};
}

export function verificationPlanSummary(plan: VibeCodexVerificationPlan): string {
	const commandChecks = plan.checks.filter(check => !!check.command);
	const required = plan.checks.filter(check => check.required);
	return [
		`${plan.checks.length} verification check${plan.checks.length === 1 ? '' : 's'} (${required.length} required).`,
		commandChecks.length ? `Commands: ${commandChecks.map(check => check.command).slice(0, 6).join(', ')}` : 'Commands: none detected; use IDE diagnostics baseline.',
		`Diagnostics baseline: ${plan.diagnosticsBaseline.error} error, ${plan.diagnosticsBaseline.warning} warning, ${plan.diagnosticsBaseline.information} information, ${plan.diagnosticsBaseline.hint} hint.`,
	].join('\n');
}

export function verificationPlanPromptBlock(plan: VibeCodexVerificationPlan): string {
	return JSON.stringify({
		version: plan.version,
		workspaceRoot: plan.workspaceRoot,
		acceptanceCriteria: plan.acceptanceCriteria,
		diagnosticsBaseline: plan.diagnosticsBaseline,
		checks: plan.checks.map(check => ({
			id: check.id,
			kind: check.kind,
			label: check.label,
			command: check.command,
			status: check.status,
			required: check.required,
			source: check.source,
			evidence: check.evidence,
		})),
	}, null, 2);
}

export function withVerificationCheckStatus(plan: VibeCodexVerificationPlan, checkId: string, status: VibeCodexVerificationStatus, evidence?: string, runId?: string): VibeCodexVerificationPlan {
	let found = false;
	const checks = plan.checks.map(check => {
		if (check.id !== checkId) {
			return check;
		}
		found = true;
		return {
			...check,
			status,
			...(runId ? { lastRunId: runId } : {}),
			...(evidence ? { evidence } : {}),
			updatedAt: Date.now(),
		};
	});
	if (!found) {
		throw new Error(`Verification check ${checkId} was not found.`);
	}
	return {
		...plan,
		checks,
	};
}

async function collectPackageJsonChecks(checks: Map<string, VibeCodexVerificationCheck>): Promise<void> {
	const packageFiles = await vscode.workspace.findFiles('**/package.json', workspaceExclude, maxPackageFiles);
	for (const uri of sortUrisByPathDepth(packageFiles)) {
		const json = parseJson(await readWorkspaceText(uri));
		if (!isRecord(json) || !isRecord(json.scripts)) {
			continue;
		}
		const dir = parentUri(uri);
		const relativeDir = workspaceRelativePath(dir) ?? '.';
		const packageManager = await detectPackageManager(dir);
		for (const [script, value] of Object.entries(json.scripts)) {
			if (typeof value !== 'string') {
				continue;
			}
			const kind = scriptKind(script);
			if (!kind) {
				continue;
			}
			addCheck(checks, {
				id: checkId('package', relativeDir, script),
				label: `${script} script${relativeDir === '.' ? '' : ` in ${relativeDir}`}`,
				command: packageScriptCommand(packageManager, relativeDir, script),
				kind,
				status: 'pending',
				required: kind !== 'custom',
				source: `package.json:${script}`,
			});
		}
	}
}

async function collectCargoChecks(checks: Map<string, VibeCodexVerificationCheck>): Promise<void> {
	const cargoFiles = await vscode.workspace.findFiles('**/Cargo.toml', workspaceExclude, maxProjectFiles);
	for (const uri of sortUrisByPathDepth(cargoFiles)) {
		const relativeFile = workspaceRelativePath(uri);
		if (!relativeFile) {
			continue;
		}
		addCheck(checks, {
			id: checkId('cargo', relativeFile, 'test'),
			label: `Cargo tests${relativeFile === 'Cargo.toml' ? '' : ` for ${relativeFile}`}`,
			command: `cargo test --manifest-path ${commandQuote(relativeFile)}`,
			kind: 'test',
			status: 'pending',
			required: true,
			source: relativeFile,
		});
		addCheck(checks, {
			id: checkId('cargo', relativeFile, 'build'),
			label: `Cargo build${relativeFile === 'Cargo.toml' ? '' : ` for ${relativeFile}`}`,
			command: `cargo build --manifest-path ${commandQuote(relativeFile)}`,
			kind: 'build',
			status: 'pending',
			required: true,
			source: relativeFile,
		});
	}
}

async function collectPythonChecks(checks: Map<string, VibeCodexVerificationCheck>): Promise<void> {
	const pyprojectFiles = await vscode.workspace.findFiles('**/pyproject.toml', workspaceExclude, maxProjectFiles);
	const pytestFiles = await vscode.workspace.findFiles('**/pytest.ini', workspaceExclude, maxProjectFiles);
	const seenDirs = new Set<string>();
	for (const uri of sortUrisByPathDepth([...pyprojectFiles, ...pytestFiles])) {
		const dir = workspaceRelativePath(parentUri(uri)) ?? '.';
		if (seenDirs.has(dir)) {
			continue;
		}
		seenDirs.add(dir);
		const target = dir === '.' ? '' : ` ${commandQuote(dir)}`;
		addCheck(checks, {
			id: checkId('python', dir, 'pytest'),
			label: `Python tests${dir === '.' ? '' : ` in ${dir}`}`,
			command: `python -m pytest${target}`,
			kind: 'test',
			status: 'pending',
			required: true,
			source: workspaceRelativePath(uri) ?? 'pyproject.toml',
		});
		const text = await readWorkspaceText(uri);
		if (text && /\btool\.ruff\b|\bruff\b/i.test(text)) {
			addCheck(checks, {
				id: checkId('python', dir, 'ruff'),
				label: `Ruff lint${dir === '.' ? '' : ` in ${dir}`}`,
				command: `ruff check ${dir === '.' ? '.' : commandQuote(dir)}`,
				kind: 'lint',
				status: 'pending',
				required: true,
				source: workspaceRelativePath(uri) ?? 'pyproject.toml',
			});
		}
	}
}

async function collectGoChecks(checks: Map<string, VibeCodexVerificationCheck>): Promise<void> {
	const goModFiles = await vscode.workspace.findFiles('**/go.mod', workspaceExclude, maxProjectFiles);
	for (const uri of sortUrisByPathDepth(goModFiles)) {
		const dir = workspaceRelativePath(parentUri(uri)) ?? '.';
		addCheck(checks, {
			id: checkId('go', dir, 'test'),
			label: `Go tests${dir === '.' ? '' : ` in ${dir}`}`,
			command: dir === '.' ? 'go test ./...' : `go test ./${commandPath(dir)}/...`,
			kind: 'test',
			status: 'pending',
			required: true,
			source: workspaceRelativePath(uri) ?? 'go.mod',
		});
	}
}

function collectAcceptanceCriteriaChecks(checks: Map<string, VibeCodexVerificationCheck>, acceptanceCriteria: readonly string[]): void {
	for (const [index, criterion] of acceptanceCriteria.entries()) {
		addCheck(checks, {
			id: checkId('acceptance', String(index + 1), criterion),
			label: `Acceptance criterion ${index + 1}: ${criterion}`,
			kind: 'custom',
			status: 'pending',
			required: true,
			source: 'plan.acceptanceCriteria',
		});
	}
}

async function detectPackageManager(dir: vscode.Uri): Promise<PackageManager> {
	if (await fileExists(vscode.Uri.joinPath(dir, 'pnpm-lock.yaml'))) {
		return 'pnpm';
	}
	if (await fileExists(vscode.Uri.joinPath(dir, 'yarn.lock'))) {
		return 'yarn';
	}
	if (await fileExists(vscode.Uri.joinPath(dir, 'bun.lockb')) || await fileExists(vscode.Uri.joinPath(dir, 'bun.lock'))) {
		return 'bun';
	}
	return 'npm';
}

function scriptKind(script: string): VibeCodexVerificationCheck['kind'] | undefined {
	const lower = script.toLowerCase();
	if (lower === 'test' || lower.startsWith('test:') || lower.includes('test')) {
		return 'test';
	}
	if (lower === 'lint' || lower.startsWith('lint:') || lower.includes('eslint')) {
		return 'lint';
	}
	if (lower === 'typecheck' || lower === 'type-check' || lower.includes('typecheck') || lower.includes('check:types') || lower.includes('tsc')) {
		return 'typecheck';
	}
	if (lower === 'build' || lower.startsWith('build:') || lower.includes('compile')) {
		return 'build';
	}
	if (lower === 'check' || lower.startsWith('check:')) {
		return 'custom';
	}
	return undefined;
}

function packageScriptCommand(packageManager: PackageManager, relativeDir: string, script: string): string {
	const run = `${packageManager} run ${commandQuote(script)}`;
	if (relativeDir === '.') {
		return run;
	}
	switch (packageManager) {
		case 'pnpm':
			return `pnpm --dir ${commandQuote(relativeDir)} run ${commandQuote(script)}`;
		case 'yarn':
			return `yarn --cwd ${commandQuote(relativeDir)} run ${commandQuote(script)}`;
		case 'bun':
			return `bun --cwd ${commandQuote(relativeDir)} run ${commandQuote(script)}`;
		default:
			return `npm --prefix ${commandQuote(relativeDir)} run ${commandQuote(script)}`;
	}
}

function collectDiagnosticsBaseline(): VibeCodexDiagnosticsBaseline {
	const baseline = {
		error: 0,
		warning: 0,
		information: 0,
		hint: 0,
	};
	for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
		if (!workspaceRelativePath(uri)) {
			continue;
		}
		for (const diagnostic of diagnostics) {
			switch (diagnostic.severity) {
				case vscode.DiagnosticSeverity.Error:
					baseline.error++;
					break;
				case vscode.DiagnosticSeverity.Warning:
					baseline.warning++;
					break;
				case vscode.DiagnosticSeverity.Information:
					baseline.information++;
					break;
				default:
					baseline.hint++;
					break;
			}
		}
	}
	return baseline;
}

function normalizeExplicitAcceptanceCriteria(criteria: readonly string[]): readonly string[] {
	return criteria
		.map(item => item.trim())
		.filter(item => item.length > 0)
		.slice(0, maxAcceptanceCriteria);
}

function defaultAcceptanceCriteria(): readonly string[] {
	return [
		'Relevant test, lint, build, or diagnostics checks are run or explicitly explained.',
		'Accepted diffs do not introduce new workspace errors.',
	];
}

function addCheck(checks: Map<string, VibeCodexVerificationCheck>, check: VibeCodexVerificationCheck): void {
	if (!checks.has(check.id) && checks.size < maxChecks) {
		checks.set(check.id, check);
	}
}

function checkId(...parts: readonly string[]): string {
	return parts.map(part => part.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()).filter(Boolean).join('-').slice(0, 80);
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

async function readWorkspaceText(uri: vscode.Uri): Promise<string | undefined> {
	try {
		return new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
	} catch {
		return undefined;
	}
}

function parseJson(text: string | undefined): unknown {
	if (!text) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function parentUri(uri: vscode.Uri): vscode.Uri {
	const path = uri.path.replace(/\/[^/]*$/, '') || '/';
	return uri.with({ path });
}

function workspaceRelativePath(uri: vscode.Uri): string | undefined {
	if (uri.scheme !== 'file') {
		return undefined;
	}
	const folders = vscode.workspace.workspaceFolders ?? [];
	for (const folder of folders) {
		const root = normalizePath(folder.uri.fsPath);
		const candidate = normalizePath(uri.fsPath);
		if (candidate === root) {
			return '.';
		}
		if (candidate.startsWith(root.endsWith('/') ? root : `${root}/`)) {
			return candidate.slice((root.endsWith('/') ? root : `${root}/`).length) || '.';
		}
	}
	return undefined;
}

function sortUrisByPathDepth(uris: readonly vscode.Uri[]): readonly vscode.Uri[] {
	return [...uris].sort((first, second) => {
		const firstPath = workspaceRelativePath(first) ?? first.fsPath;
		const secondPath = workspaceRelativePath(second) ?? second.fsPath;
		return pathDepth(firstPath) - pathDepth(secondPath) || firstPath.localeCompare(secondPath);
	});
}

function pathDepth(value: string): number {
	return value.split('/').filter(Boolean).length;
}

function commandQuote(value: string): string {
	if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
		return value;
	}
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function commandPath(value: string): string {
	return value.replace(/^\.\//, '').replace(/\/+$/, '');
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
