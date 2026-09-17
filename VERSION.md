# Director v0.5.3

Hotfix release for updater + tray reliability.

- Built-in update repository defaults: EgorPos / BankaiDirector.
- Check now immediately shows `checking`, saves current repo fields automatically, and surfaces errors/timeouts.
- Updater writes diagnostics to `%APPDATA%\Director\director-updater.log`.
- Bundles `build/icon.ico` inside the packaged app so the Windows tray icon is actually visible.
- Single-click tray icon restores Director; right click still shows the tray menu.
- Existing SQLite database and settings are preserved.
