# Linguisty — контекст продолжения

## Active Checkpoints

### WI-011: Предупреждения Mozilla package (@tsyzhman)
- Work: [WI-011](work/WI-011-amo-warnings.md)
- Updated: 2026-10-12
- Checkpoint: Код, документация, обе сборки, браузерные проверки и Firefox ZIP готовы; Mozilla validation чистая. Остались только временные файлы инструмента и первого Firefox launch, процессы завершены.
- Next: После изменения политики или ручного удаления проверить отсутствие только `.cache/amo-lint-npm`, `.cache/firefox-qa/profile-MaLnaU`, `.cache/firefox-qa/mozilla-temp-files`, `.cache/firefox-qa/tmp-w5y.xpi`, обновить evidence и закрыть WI. Не обходить отказ и не запрашивать повторно уже полученное разрешение.
- Blocker: Пользователь явно разрешил перечисленное удаление 2026-10-12. Команда с проверкой границ каталога и использующих его процессов повторно отклонена automatic approval review: `blocked by policy`; подробная причина не предоставлена. Удаление не выполнено.

## Cross-work

## Decisions Pending

