# Director Desktop v0.5.1

Local-first personal manager for life, Reytrieve, streams and AI planning.

## What's new in v0.5

- Calendar page with local day blocks: Work / Reytrieve / Stream / Personal / Admin / Other.
- Today's schedule is visible directly on Today.
- The local Director picker now considers how much time is left before the next calendar block.
- AI receives the same calendar blocks together with tasks, energy, routines and chat context.
- SQLite schema v3 adds `calendar_blocks`; migration is automatic and backs up the old DB first.
- One-time GitHub bootstrap: `CONNECT_GITHUB_AND_PUBLISH.cmd` can install Git/GitHub CLI if needed, sign in, create a public repo, push this source, publish tag `v0.5.1`, and configure the installed Director updater.
- One-click later publishing: `PUBLISH_CURRENT_VERSION.cmd` commits/pushes the current source and publishes the version from `package.json` as a tag.
- npm install-script approvals for Electron / electron-winstaller / esbuild are now recorded in `package.json`, so fresh installs should stop asking for the same approvals.
- GitHub Actions workflow updated to current Node 24-era actions and runs `npm audit --audit-level=high` before publishing.
- Updater explicitly rejects NSIS web-installer updates; Director ships the full NSIS installer.

## Recommended upgrade path from installed v0.4

Do **not** uninstall v0.4. It is useful for the first real auto-update test.

1. Extract this v0.5 source folder somewhere permanent, e.g. `E:\Work\_LifeDirector\director-desktop-v05`.
2. Exit Director from the tray before the one-time setup so its settings file is not being edited at the same time.
3. Double-click `CONNECT_GITHUB_AND_PUBLISH.cmd`.
4. The script explains that it creates a **public** source repository and asks for confirmation before uploading anything.
5. Sign in to GitHub in the browser when GitHub CLI asks.
6. Keep the default repository name `LifeDirector` or type another one.
7. GitHub Actions builds and publishes Director v0.5.1.
8. Open the already-installed Director v0.4 → Settings → **Check for updates**.
9. It should discover v0.5.1, download it, and show **Restart & Update**.

That is the best test because it proves the actual installed updater path works end-to-end.

## Important privacy note

The easy token-free update route uses a public GitHub repository. That means the source code in this folder is publicly visible, including the built-in project context used by the Director prompt. No local database, API key, `%APPDATA%` settings, `.env` files, or user files are uploaded by the provided script.

If you want the source to stay private, do not run the public bootstrap. Use a private source repo + separate public release repo instead; that needs one additional GitHub token/secret setup.

## Calendar

Calendar blocks are intentionally simple in v0.5: they describe reality rather than trying to become Google Calendar immediately.

- Add a block with a date, start/end time and kind.
- Today shows today's blocks and the free window before the next future block.
- Director sees `calendarBlocks` in AI context.
- The offline scoring fallback penalizes tasks that obviously do not fit before the next block.

Google Calendar sync can be layered on later without changing the SQLite model.

## Database

The DB remains under Electron's userData folder, normally:

`%APPDATA%\Director\director.db`

v0.5 upgrades schema 2 → 3 and creates a timestamped pre-migration backup first. Installer updates do not intentionally delete this folder.

## Manual local build fallback

You should not need this for the GitHub bootstrap, but it remains available:

`BUILD_AND_INSTALL_V05.cmd`

Manual equivalent:

```powershell
npm.cmd install
npm.cmd audit --audit-level=high
npm.cmd run dist:win
```

## Future releases

After the GitHub bootstrap, a source tree that already has `.git`/`origin` can publish the version in `package.json` by double-clicking:

`PUBLISH_CURRENT_VERSION.cmd`

The GitHub workflow then builds the NSIS installer and publishes the update metadata used by Director.

## v0.5.2 release repair
If v0.5.1 failed in GitHub Actions at **Set release version** with `npm error Version not changed`, run `REPAIR_AND_PUBLISH_V052.cmd` from this package. It keeps the existing GitHub repository, publishes the fixed v0.5.2 source on top of its history, creates tag `v0.5.2`, and watches the GitHub Actions build.



## v0.5.4 build fix

This release fixes the strict TypeScript null-narrowing error in Settings that prevented the v0.5.3 GitHub Actions build. Run `REPAIR_AND_PUBLISH_V054.cmd` to publish this version. After the Action turns green, install `Director Setup 0.5.4.exe` once over the existing v0.4 installation.

## v0.5.3 hotfix
The updater repository defaults to `EgorPos/BankaiDirector`. `Check now` persists its fields before checking, has a 30-second timeout, and logs to `%APPDATA%\Director\director-updater.log`. The package now includes the tray icon at runtime.


## v0.5.5 release fix
The GitHub workflow now uploads the full updater set explicitly: `Director-Setup-<version>.exe`, `.blockmap`, and `latest.yml`, and fails if any asset is missing.
