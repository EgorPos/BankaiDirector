# Director Desktop v0.6.0

Local-first personal manager for life, Reytrieve, streams and AI planning.

## v0.6.0

- Stream Scheduler now mirrors recurring stream days into Calendar automatically.
- Prep reminder time is separate from actual stream start/end time.
- Stream Prep can play a system sound and still opens always-on-top.
- Tasks now have expandable details with description/notes and an editable checklist.
- Calendar now has a month grid, clickable dates and a direct date picker.
- SQLite schema v4 adds persistent task checklists. Migration is automatic and a DB backup is created before schema changes.
- Existing updater pipeline remains compatible with `EgorPos/BankaiDirector`.

## Stream schedule

Defaults are Monday / Thursday / Saturday. The prep popup remains at 18:00 by default. Actual stream block time has its own fields under Settings → Stream Scheduler. The initial placeholder is 20:00–23:00; change it to the real stream hours and press **Save scheduler**. Director rebuilds the future recurring Stream blocks for the next 120 days.

## Task details

Open any task with **Details** (or click its main text). You can add a free-form description and checklist items. Checklist progress is shown on the collapsed task row and is stored in SQLite.

## Calendar

Calendar has a real month view. Click a day, use the native date picker, or use month arrows. Manual blocks and generated recurring Stream blocks are shown as dots. Generated Stream blocks are labeled `recurring` and are controlled from Stream Scheduler settings.

## Database

The database remains under Electron userData, normally:

`%APPDATA%\Director\director.db`

v0.6 upgrades schema 3 → 4. Installer and auto-updates do not intentionally delete this folder.

## Publish v0.6.0

Double-click:

`REPAIR_AND_PUBLISH_V060.cmd`

It publishes the source to the already configured `EgorPos/BankaiDirector`, creates tag `v0.6.0`, waits for GitHub Actions, and opens the release page. Once the release is green, the installed Director v0.5.5 should discover v0.6.0 through **Check now** or automatic update; no manual installer step should be necessary.
