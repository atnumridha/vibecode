/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ExternalDiffFile } from './executionProtocol';
import type { ExternalPatchCheckpoint } from './workspacePatch';
import { previewExternalDiffFile, proposedTextForExternalDiff } from './workspacePatch';

export class VibeCodexDiffPreviewProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
	static readonly scheme = 'vibecodex-diff';

	private readonly contents = new Map<string, string>();
	private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange = this.onDidChangeEmitter.event;

	async open(file: ExternalDiffFile, checkpoint?: ExternalPatchCheckpoint): Promise<void> {
		const preview = checkpoint
			? {
				previousText: checkpoint.previousText,
				proposedText: proposedTextForExternalDiff(file, checkpoint.previousText),
			}
			: await previewExternalDiffFile(file);
		const previousUri = this.store(file.path, 'baseline', preview.previousText);
		const proposedUri = this.store(file.path, 'proposed', preview.proposedText);
		await vscode.commands.executeCommand('vscode.diff', previousUri, proposedUri, `Vibe Codex Diff: ${file.path}`, { preview: false });
	}

	provideTextDocumentContent(uri: vscode.Uri): string {
		return this.contents.get(contentKey(uri)) ?? '';
	}

	dispose(): void {
		this.contents.clear();
		this.onDidChangeEmitter.dispose();
	}

	private store(path: string, side: 'baseline' | 'proposed', text: string): vscode.Uri {
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
		const uri = vscode.Uri.from({
			scheme: VibeCodexDiffPreviewProvider.scheme,
			authority: side,
			path: `/${side}/${virtualPath(path)}`,
			query: `id=${id}&side=${side}`,
		});
		this.contents.set(contentKey(uri), text);
		this.onDidChangeEmitter.fire(uri);
		return uri;
	}
}

function contentKey(uri: vscode.Uri): string {
	return uri.toString(true);
}

function virtualPath(path: string): string {
	const normalized = path.replace(/\\/g, '/').replace(/[\u0000\r\n?#]/g, '_');
	return normalized.split('/').filter(Boolean).map(encodeURIComponent).join('/') || 'untitled';
}
