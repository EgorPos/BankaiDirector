# Director v0.5.2

Hotfix release for the GitHub publishing pipeline.

## Fixed
- GitHub Actions no longer fails in **Set release version** when `package.json` already has the same version as the pushed tag.
- The release workflow now uses `npm version ... --allow-same-version`.
- Added `REPAIR_AND_PUBLISH_V052.cmd` for repairing an already-created GitHub repository after the failed v0.5.1 release attempt.

No database reset is required. The installed Director can update from v0.4.x directly to v0.5.2 once the GitHub Release is published.
