# Director Desktop v0.7.0

Local-first personal manager for life, Reytrieve, streams and AI planning.

## v0.7.0

- Tasks are split into **Active / Completed / Archive / All**.
- **Completed** means the task was actually finished. **Archive** means cancelled, obsolete, replaced, or intentionally dropped.
- Both Completed and Archive support **Restore**. Archived tasks return to Active/Todo and immediately become eligible for Director Queue again.
- Permanent delete is separate and asks for confirmation.
- Director Queue and AI task selection exclude completed, archived and inbox tasks.
- If a selected task has an internal checklist, the checklist is shown directly inside the Director Queue card and can be clicked there.
- The currently active task also shows its checklist on Today. Finish the checklist steps, then press **Done** when the whole task is complete.
- Task details still contain the full editable description and checklist editor.
- Task details now expose **Project / Chapter / Area / Feature** so the Miro backlog can be imported as one line = one task while preserving where that line belongs in the game.
- SQLite schema v5 adds `archived_at`; migration is automatic and Director creates a database backup before changing schema.

## Task lifecycle

- **Todo / Active / Deferred** → participates in planning.
- **Completed** → finished work; stays in history and can be restored.
- **Archive** → not done, but intentionally removed from the live backlog; stays searchable and can be restored.
- **Delete** → permanent removal with confirmation.

The distinction matters for AI: an archived task is not treated as something you accomplished.

## Database

The database remains under Electron userData, normally:

`%APPDATA%\Director\director.db`

v0.7 upgrades schema 4 → 5. Installer and auto-updates do not intentionally delete this folder.

## Publish v0.7.0

Double-click:

`REPAIR_AND_PUBLISH_V070.cmd`

It publishes source to the configured `EgorPos/BankaiDirector`, creates tag `v0.7.0`, waits for GitHub Actions, and opens the release page. After the green release, installed Director v0.6.0 should detect v0.7.0 through **Check now** or automatic update.
