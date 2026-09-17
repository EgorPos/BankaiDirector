# Director Desktop v0.8.0

## Что нового

- Director Queue теперь всегда показывает локальный выбор сразу, даже если AI/API тормозит или недоступен.
- `Another one` действительно исключает предыдущие варианты и рероллит задачу, вместо повторного выбора того же top-score таска.
- Focus / Stream / 30 min / Visual используют более строгие правила выбора.
- В Tasks появился **AI Backlog Pass**: Director проходит по активному пулу, решает `stream` / `off-stream`, выставляет теги, тип задачи, visual/deep-work, blocker и примерное время.
- Добавлены фильтры `Stream`, `Off-stream`, `Untagged` и показ AI-тегов прямо в списке задач.
- Миро-задачи и вся текущая SQLite база сохраняются без повторного импорта или сброса.

## Публикация

Двойной клик по:

`REPAIR_AND_PUBLISH_V080.cmd`

После зелёного GitHub Actions открой установленный Director → Settings → `Check now` → `Restart & Update`.
