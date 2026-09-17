# Director Desktop v0.7.2

## Stream reminder reliability hotfix

- Fixed Stream Prep sound: the previous implementation relied on a non-existent Electron `shell.beep()` path.
- Added a bundled two-tone alert sound that the popup plays itself.
- Stream popup now force-shows/focuses with ready/load/fallback paths instead of relying on one event.
- Scheduler checks every 15 seconds and retries if a due popup unexpectedly vanished.
- Closing the popup with X now snoozes it instead of silently killing the reminder for the rest of the day.
- Changing today's prep time clears stale shown/snoozed state so the new time can fire.
- Settings now shows Director clock, next reminder, today's reminder state, and reminder debug-log path.
- Added `director-reminder.log` for diagnosing future missed reminders.
