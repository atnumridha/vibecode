/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

function loadVsce() {
	try {
		return require('@vscode/vsce');
	} catch {
		return require('../../../build/node_modules/@vscode/vsce');
	}
}

const vsce = loadVsce();

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = require(resolve(extensionRoot, 'package.json'));
const packagePath = resolve(extensionRoot, `${packageJson.publisher}.${packageJson.name}-${packageJson.version}.vsix`);

await vsce.createVSIX({
	cwd: extensionRoot,
	packagePath,
	dependencies: false,
	skipLicense: false,
	allowUnusedFilesPattern: true
});

const checksum = createHash('sha256').update(await readFile(packagePath)).digest('hex');
const checksumPath = `${packagePath}.sha256`;
await writeFile(checksumPath, `${checksum}  ${packageJson.publisher}.${packageJson.name}-${packageJson.version}.vsix\n`);

console.log(packagePath);
console.log(checksumPath);
