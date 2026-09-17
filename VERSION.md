# Director v0.5.1

## GitHub setup hotfix

- Fixed first-run GitHub authentication on Windows PowerShell: expected `gh auth status` stderr no longer aborts setup.
- Fixed the same expected-failure handling when probing whether the repository or release tag already exists.
- The setup now reaches `gh auth login --web` instead of stopping with `NativeCommandError`.

## Calendar / capacity

- Added persistent `CalendarBlock` data to application state.
- Added Calendar navigation page with day navigation and manual time blocks.
- Today now shows today's schedule and a free-window hint.
- Offline task scoring considers time before the next calendar block.
- AI prompt explicitly treats the calendar as a planning constraint.

## Database

- SQLite schema version is now 3.
- Migration 3 adds `calendar_blocks` and an index on date/start time.
- Existing v0.4 databases are backed up before schema migration.

## Update pipeline

- Added `CONNECT_GITHUB_AND_PUBLISH.cmd` + PowerShell bootstrap.
- Bootstrap can install Git and GitHub CLI through winget, authenticate via browser, create a public GitHub repo, configure the installed app's updater settings, push source and publish the current tag.
- Added `PUBLISH_CURRENT_VERSION.cmd` for later tagged releases.
- GitHub Actions uses checkout/setup-node/upload-artifact v7 and Node 24.
- Release workflow performs a high-severity npm audit before publishing.
- Install-script approvals are recorded in `package.json` for Electron, electron-winstaller and esbuild.
- Updater disallows NSIS web-installer payloads.

## Compatibility

- `appId` remains `com.egor.director`.
- `productName` remains `Director`.
- Existing `%APPDATA%\Director` data is preserved by design.
