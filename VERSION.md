# Director v0.8.1

**Database schema:** 6 (без новой миграции)

### Task context on picked tasks
- Director Queue теперь показывает локацию выбранной задачи: Chapter → Area / Act → Feature.
- Под выбранной задачей видны Project, task type, stream/off-stream, blocker и теги.
- Тот же контекст остаётся виден после `Start` в блоке `NOW WORKING ON`.
- Если задача ещё не размечена, карточка явно пишет `no tags yet`, а не молча скрывает метаданные.

Все данные/105 Miro tasks/checklists/archive/calendar остаются без изменений.
