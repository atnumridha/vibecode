/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

declare const TextDecoder: {
	new(label?: string): { decode(input?: Uint8Array): string };
};

export interface VibeCodexPreviewPlan {
	readonly version: 1;
	readonly detectedAt: number;
	readonly previews: readonly VibeCodexPreviewTarget[];
}

export interface VibeCodexPreviewTarget {
	readonly id: string;
	readonly label: string;
	readonly command: string;
	readonly cwd?: string;
	readonly url: string;
	readonly source: string;
	readonly status: 'available';
}

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const workspaceExclude = '{**/.git/**,**/node_modules/**,**/out/**,**/dist/**,**/build/**,**/.next/**,**/.turbo/**,**/.vscode-test/**}';
const maxPackageFiles = 5;
const maxPreviews = 8;
const previewScriptNames = ['dev', 'start', 'serve', 'preview'] as const;

export async function collectPreviewPlan(): Promise<VibeCodexPreviewPlan> {
	const previews = new Map<string, VibeCodexPreviewTarget>();
	const packageFiles = await vscode.workspace.findFiles('**/package.json', workspaceExclude, maxPackageFiles);
	for (const uri of sortUrisByPathDepth(packageFiles)) {
		const json = parseJson(await readWorkspaceText(uri));
		if (!isRecord(json) || !isRecord(json.scripts)) {
			continue;
		}
		const dir = parentUri(uri);
		const relativeDir = workspaceRelativePath(dir) ?? '.';
		const packageManager = await detectPackageManager(dir);
		for (const script of previewScriptNames) {
			const value = json.scripts[script];
			if (typeof value !== 'string') {
				continue;
			}
			const target: VibeCodexPreviewTarget = {
				id: checkId('preview', relativeDir, script),
				label: `${script}${relativeDir === '.' ? '' : ` in ${relativeDir}`}`,
				command: packageScriptCommand(packageManager, relativeDir, script),
				...(relativeDir === '.' ? {} : { cwd: relativeDir }),
				url: previewUrl(script, value, json),
				source: `${workspaceRelativePath(uri) ?? 'package.json'}:${script}`,
				status: 'available',
			};
			previews.set(target.id, target);
			if (previews.size >= maxPreviews) {
				break;
			}
		}
	}
	return {
		version: 1,
		detectedAt: Date.now(),
		previews: [...previews.values()].slice(0, maxPreviews),
	};
}

export function previewPlanSummary(plan: VibeCodexPreviewPlan): string {
	if (!plan.previews.length) {
		return 'No preview scripts detected.';
	}
	return `${plan.previews.length} preview target${plan.previews.length === 1 ? '' : 's'}: ${plan.previews.map(target => `${target.label} -> ${target.url}`).join(', ')}`;
}

export function previewPlanPromptBlock(plan: VibeCodexPreviewPlan): string {
	return JSON.stringify({
		version: plan.version,
		previews: plan.previews.map(target => ({
			id: target.id,
			label: target.label,
			command: target.command,
			cwd: target.cwd,
			url: target.url,
			source: target.source,
		})),
		note: 'Preview commands are user-visible terminal handoffs. Do not start servers without user approval.',
	}, null, 2);
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

function previewUrl(script: string, command: string, packageJson: Record<string, unknown>): string {
	const explicitPort = command.match(/(?:--port|-p)\s+([0-9]{2,5})\b/)?.[1]
		?? command.match(/PORT=([0-9]{2,5})\b/)?.[1];
	const port = explicitPort ?? inferredPort(script, command, packageJson);
	return `http://localhost:${port}`;
}

function inferredPort(script: string, command: string, packageJson: Record<string, unknown>): string {
	const text = JSON.stringify({
		command,
		dependencies: packageJson.dependencies,
		devDependencies: packageJson.devDependencies,
	}).toLowerCase();
	if (text.includes('astro')) {
		return '4321';
	}
	if (text.includes('@angular/') || text.includes('ng serve')) {
		return '4200';
	}
	if (text.includes('vite') || text.includes('sveltekit')) {
		return '5173';
	}
	if (text.includes('next') || text.includes('nuxt') || script === 'start') {
		return '3000';
	}
	return '3000';
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

function parseJson(text: string | undefined): Record<string, unknown> | undefined {
	if (!text) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(text);
		return isRecord(parsed) ? parsed : undefined;
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

function checkId(...parts: readonly string[]): string {
	return parts.map(part => part.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()).filter(Boolean).join('-').slice(0, 80);
}

function commandQuote(value: string): string {
	if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
		return value;
	}
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
