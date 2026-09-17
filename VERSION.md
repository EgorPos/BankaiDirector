# Director v0.5.4

Build-fix release for the updater + tray hotfix.

- Fixes strict TypeScript narrowing in Settings that blocked the v0.5.3 GitHub Actions build.
- Keeps the built-in update repository defaults: EgorPos / BankaiDirector.
- Keeps updater diagnostics, timeout/error status, packaged tray icon, and single-click tray restore.
- Existing SQLite database and settings are preserved.
