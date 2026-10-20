# WI-038: Первый релиз Linguisty в GitHub

- Kind: `migration`
- Canon action: `none`

## Outcome

В `Isty-org/linguisty` опубликован первый релиз v0.4.9 с проверенными пакетами Chrome/Firefox, исходниками и авторством Никиты Цыжмана @tsyzhman.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://common/PROP-002-quality#hygiene`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- In: gitignore и исключение локальной `.me`; авторство и metadata; документация выпуска; текущие автоматические и браузерные проверки; initial commit, tag и GitHub Release с пакетами и SHA-256.
- In: устранение воспроизведённой нестабильности `tests/storage/errorLog.test.ts`: случайный UUID совпал с PII sentinel `250`; production-логика журнала не меняется.
- Out: публикация в магазинах, подпись Firefox, реальные платные API/ChatGPT-запросы, удаление старых временных файлов WI-011.
- Версия 0.4.9 сохраняется. Лицензия добавляется только при выборе пользователя; отсутствие выбора не означает разрешение лицензирования.

## Acceptance

- [x] `.me` локальна и содержит @tsyzhman / Никита Цыжман / human; generated files, caches и credentials исключены из Git.
- [x] Авторство README, metadata, BOARD и текущей документации согласовано; Git author настроен на подтверждённый GitHub noreply аккаунта @tsyzhman.
- [x] Typecheck, lint, unit/native/manifest tests, обе production builds и доступные browser smoke выполнены; ограничения записаны.
- [ ] Chrome/Firefox ZIP сверены с проверенными сборками, опубликованы checksums и корректные инструкции установки.
- [ ] Source commit и tag опубликованы, GitHub Release доступен и содержит ожидаемые assets; проверены ресурсы, дубли и cleanup собственных процессов.

## Result

Локальная подготовка завершена: 780 unit / 15 native / 9 manifest-hygiene tests PASS, typecheck/lint/builds/manifests/fixtures PASS, полные browser smoke 14/14 на каждой платформе, mock ChatGPT Chrome PASS / Firefox 8 PASS, long-batch 2 PASS. Mozilla 0/0/0. ZIP проверены побайтно, после browser runs все 112 production-файлов неизменны. QA: `docs/QA-RELEASE-2026-10-20.md`. Source scan и ссылки/канон прошли; `.me` и generated artifacts не staged. Открытая лицензия не выбрана и не добавлена. Следующий шаг — initial commit/tag, публикация и проверка GitHub assets; завершение WI после фактического результата.
