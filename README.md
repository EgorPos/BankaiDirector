## v0.8.2 — Random Director Queue

Director task picker теперь не ранжирует backlog детерминированным списком. Режим задаёт только подходящий пул, а задача вытаскивается случайно. `Another one` не повторяет недавние варианты. Сам выбор работает локально и не вызывает OpenAI API.

# Director Desktop v0.8.2

## Что нового

- В карточке `NEXT TASK` теперь всегда видна локация задачи: `Chapter → Area / Act → Feature`.
- Там же видны Project, task type, `stream/off-stream`, blocker и обычные теги.
- После `Start` этот же контекст остаётся в блоке `NOW WORKING ON`.
- Если задача ещё не размечена, Director явно показывает `no tags yet`.
- Все функции v0.8.1 сохранены: контекст/теги на выбранной задаче, Stream/Focus/30 min/Visual, Miro backlog, чеклисты и архив.
- `WHAT SHOULD I DO?` и `Another one` теперь используют локальный случайный выбор и не вызывают OpenAI API.
- SQLite schema остаётся 6: база и задачи не переимпортируются и не сбрасываются.

## Публикация

Двойной клик по:

`REPAIR_AND_PUBLISH_V082.cmd`

После зелёного GitHub Actions открой установленный Director → Settings → `Check now` → `Restart & Update`.
