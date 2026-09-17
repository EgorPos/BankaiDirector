# Director v0.7.0

## What changed
- Tasks now have separate Active, Completed and Archive views.
- Completed tasks can be restored; archived tasks can be restored without pretending they were completed.
- Permanent delete now asks for confirmation.
- Archived tasks are excluded from Director Queue and AI picks.
- Selected tasks now expose their checklist directly in Director Queue.
- Active task checklist is clickable on Today, so you can complete steps and only then press Done.
- Task hierarchy fields (Project / Chapter / Area / Feature) are editable in Details for the upcoming Miro backlog import.
- SQLite schema v5 stores archive timestamps and migrates with a backup.
