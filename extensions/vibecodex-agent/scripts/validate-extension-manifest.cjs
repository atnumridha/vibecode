/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const contributionIdPattern = /^[A-Za-z0-9_-]+$/;

function isRecord(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateContributionId(value, label, errors) {
	if (typeof value !== 'string' || value.length === 0 || !contributionIdPattern.test(value)) {
		errors.push(`${label} must be a non-empty VS Code contribution id using only alphanumeric characters, underscores, and hyphens.`);
	}
}

function validateExtensionManifest(manifest) {
	const errors = [];
	if (!isRecord(manifest)) {
		return ['Extension manifest must be a JSON object.'];
	}
	const contributes = isRecord(manifest.contributes) ? manifest.contributes : {};
	const viewsContainers = isRecord(contributes.viewsContainers) ? contributes.viewsContainers : {};
	const activitybar = Array.isArray(viewsContainers.activitybar) ? viewsContainers.activitybar : [];
	const views = isRecord(contributes.views) ? contributes.views : {};
	if (activitybar.length === 0) {
		errors.push('contributes.viewsContainers.activitybar must declare the Vibe Codex activity bar container.');
	}
	for (const [index, container] of activitybar.entries()) {
		if (!isRecord(container)) {
			errors.push(`contributes.viewsContainers.activitybar[${index}] must be an object.`);
			continue;
		}
		validateContributionId(container.id, `contributes.viewsContainers.activitybar[${index}].id`, errors);
	}
	if (Object.keys(views).length === 0) {
		errors.push('contributes.views must register at least one view container.');
	}
	for (const [containerId, contributedViews] of Object.entries(views)) {
		validateContributionId(containerId, `contributes.views key "${containerId}"`, errors);
		if (!Array.isArray(contributedViews) || contributedViews.length === 0) {
			errors.push(`contributes.views["${containerId}"] must contain at least one contributed view.`);
			continue;
		}
		for (const [index, view] of contributedViews.entries()) {
			if (!isRecord(view)) {
				errors.push(`contributes.views["${containerId}"][${index}] must be an object.`);
				continue;
			}
			validateContributionId(view.id, `contributes.views["${containerId}"][${index}].id`, errors);
		}
	}
	return errors;
}

function main() {
	const manifestPath = process.argv[2] ?? path.resolve(__dirname, '..', 'package.json');
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const errors = validateExtensionManifest(manifest);
	if (errors.length > 0) {
		console.error(`Invalid extension manifest contribution ids in ${manifestPath}:`);
		for (const error of errors) {
			console.error(`- ${error}`);
		}
		process.exit(1);
	}
	console.log(`Extension manifest contribution ids are valid: ${manifestPath}`);
}

if (require.main === module) {
	main();
}

module.exports = {
	validateExtensionManifest,
};
