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
- [x] Chrome/Firefox ZIP сверены с проверенными сборками, опубликованы checksums и корректные инструкции установки.
- [x] Source commit и tag опубликованы, GitHub Release доступен и содержит ожидаемые assets; проверены ресурсы, дубли и cleanup собственных процессов.

## Result

Опубликован [первый релиз v0.4.9](https://github.com/Isty-org/linguisty/releases/tag/v0.4.9), initial commit `c23c3c977b70ea97a8041559c833048f32367f60`, default branch `main`. GitHub подтвердил author/committer/release author `Tsyzhman`; Git name — Никита Цыжман, email — GitHub noreply. Публичный source tree содержит 333 файла без `.me`, credentials и generated folders. Все три assets скачаны с GitHub и совпали по SHA-256 с локальными файлами; GitHub asset digests совпадают тоже.

780 unit / 15 native / 9 manifest-hygiene tests PASS, typecheck/lint/builds/manifests/fixtures PASS, полные browser smoke 14/14 на каждой платформе, mock ChatGPT Chrome PASS / Firefox 8 PASS, long-batch 2 PASS. Mozilla 0/0/0. ZIP проверены побайтно, после browser runs все 112 production-файлов неизменны. QA: `docs/QA-RELEASE-2026-10-20.md`. Source scan, 146 локальных ссылок и 642 spec references прошли; связанных helper-процессов нет. Ограничения реального provider access, подписи/магазинов, отсутствие выбранной открытой лицензии и исходные whitespace diagnostics зафиксированы без объявления непроведённых проверок успешными.
