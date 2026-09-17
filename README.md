# Director Desktop v0.7.2

This hotfix hardens Stream Prep reminders and fixes popup audio. The existing SQLite database and Miro backlog import are preserved.

# Director Desktop v0.7.1

This update imports the current active Reytrieve backlog captured from Egor's Miro screenshots.

## Miro import rules
- One bullet / one written row = one task.
- White active rows are imported.
- Yellow, red, and blue-only rows are intentionally not imported.
- Category headers are stored as project metadata rather than task titles.
- Stable IDs make the migration safe to run once without duplicating tasks.

## Upgrade
Run `REPAIR_AND_PUBLISH_V071.cmd`, wait for GitHub Actions to finish, then use Director -> Settings -> Check now.
