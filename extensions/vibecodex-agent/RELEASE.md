# Vibe Codex Agent Release

The `Vibe Codex Agent Release` GitHub Actions workflow builds, verifies, and publishes the extension package.

## Release Triggers

- Push a tag named `vibecodex-agent-v<version>` to build a VSIX, verify the checksum, upload artifacts, and create or update the matching GitHub Release.
- Run the workflow manually with `workflow_dispatch` to publish the current branch without creating the tag first.
- Set `publish_marketplaces` during a manual run to publish marketplace packages after the GitHub Release is updated.

## Required Secrets

- `GITHUB_TOKEN` is provided by GitHub Actions and is used for release creation.
- `VSCE_PAT` enables Visual Studio Marketplace publishing.
- `OVSX_PAT` enables Open VSX publishing.

Marketplace publishing is skipped when the matching secret is not configured.

## Local Verification

Before tagging a release, run:

```sh
npm --prefix extensions/vibecodex-agent run verify
shasum -a 256 -c extensions/vibecodex-agent/vibecodex.agent-*.vsix.sha256
```
