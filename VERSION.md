# Director v0.7.1

- Imports Egor's current active Miro backlog into the existing SQLite database.
- One Miro bullet/line becomes one task.
- Only the white active lines from the supplied screenshots are imported; yellow/red/blue-only lines are excluded.
- Tasks are grouped by Chapter / Act / Area / Feature so Director can reason about project context.
- Adds `source = miro` and stable Miro IDs so the import is one-time and duplicate-safe.
- Removes only the two original demo seed tasks (`seed-pixel`, `seed-karaoke`) during this migration.
- Keeps all v0.7.0 archive / restore / live checklist behavior.
- Database schema: 6 (automatic backup before migration).
