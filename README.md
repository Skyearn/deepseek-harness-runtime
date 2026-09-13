# DeepSeek Harness Runtime Releases

Prebuilt DeepSeek Harness runtime bundles.

Published automatically from upstream `@deepseek-ai/dsh` every 6 hours.

The version to mirror is the newest of the `next` and `latest` dist-tags
(`scripts/latest-dsh-version.mjs`): upstream publishes prereleases under `next`,
so reading `latest` alone would skip every release candidate. `alpha` builds are
intentionally not mirrored.

Assets:

- `dsh-runtime-<dsh-version>-macos-universal.tar.gz`
- `dsh-runtime-<dsh-version>-windows-x64.zip`
