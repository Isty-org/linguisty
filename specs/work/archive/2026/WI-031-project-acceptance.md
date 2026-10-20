# WI-031: Полная приёмка проекта и устранение оставшихся регрессий

- Kind: `fix`
- Canon action: `none`

## Outcome

Проверить текущую первую версию по канону и получить воспроизводимое evidence Chrome/Firefox; закрыть исправимые gaps проверки и релизной гигиены.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://common/PROP-002-quality#hygiene`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- Assigned paths: `scripts/**`, `tests/e2e/**`, `tests/build/**`, `tests/fixtures/**`, `docs/QA-2026-10-12.md`, этот WI.
- Coordinator paths: версии в `package.json`, `package-lock.json`, `wxt.config.ts`; общая документация, BOARD/WAL/TECHDEBT и архивирование после проверки.
- In: полнота acceptance, harness fixes, resource measurements, browser/mock verification, перечень конкретных незакрытых задач.
- Out: production modules, зависимости, build config, README, канон и BOARD/WAL. Координатор принимает интеграцию и обновляет общие документы.

## Acceptance

- [x] Проверен активный scope; будущие возможности не выданы за текущие обязательства.
- [x] Выполнены доступные browser scenarios обеих платформ и проверки manifest/секретов/ресурсов после стабилизации реализации.
- [x] Измерены cache/duplicates/RAM; собственные helpers завершены, чужие процессы сохранены.
- [x] Отчёт точно отделяет PASS/FAIL/непроверенное; реальные paid/login запросы не выполнялись.

## Result

Было: browser/manifest evidence относился к старому 0.4.6, а загрузка отдельных UI языков не измерялась. Стало: на неизменённых production каталогах 0.4.7 Chrome/Firefox full smoke по 14 PASS, ChatGPT mock и 16 языков PASS; новый browser harness проверил выборочные locale requests Chromium и offline загрузку в обоих браузерах. Typecheck/lint PASS, 751 unit/contract/DOM tests PASS, manifest/секреты/ресурсы PASS, Firefox каталог и точный ZIP прошли Mozilla Linter без ошибок/предупреждений. Детали, артефакты и границы — `docs/QA-2026-10-12.md`.

Кэш `.cache` не изменился (5 652 файлов / 203 426 930 байт), дублей и suspicious source copies нет. Финальный Firefox smoke освободил свои 12 процессов и профиль; QA/watch helpers этого WI не остались. В доступном browser/mock scope доказанных production-регрессий не выявлено. Старый cache WI-011 не удалялся: automatic approval review ранее отклонил очистку. Реальный OpenRouter/ChatGPT login, качество модели, подписанная установка и прямой счётчик dynamic imports в Firefox остаются непроверенными; это явно отделено от PASS. WI готов к проверке координатором, файл не архивирован.
