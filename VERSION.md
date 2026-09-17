# Director v0.8.0

**Database schema:** 6 (без новой миграции)

### Planner
- Instant local pick: очередь больше не остаётся пустой из-за AI/network timeout.
- AI уточняет уже показанный локальный выбор в фоне.
- `Another one` исключает текущий и недавние варианты (до 10) и реально рероллит очередь.
- Stream mode сильнее предпочитает stream-friendly + visual и избегает deep-work/off-stream.
- Focus mode слегка сохраняет зрелищные stream-friendly задачи на стрим.

### AI Backlog Pass
- Один проход по активному backlog (до 220 задач, батчи по 20).
- Назначает stream/off-stream, 2–8 тегов, estimate, taskType, visual, deepWork, blocking.
- Не меняет title/id/chapter/area/feature.
- Без API есть локальный fallback; приложение явно сообщает, что это не полноценный AI-pass.
- Tasks UI: Stream / Off-stream / Untagged фильтры и статистика.
