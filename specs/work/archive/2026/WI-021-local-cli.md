# WI-021: Перевод через установленный CLI

- Kind: `change`
- Canon action: `new-spec`

## Outcome

Пользователь выбирает Codex, Claude Code, Antigravity CLI или Grok Build и переводит страницу через собственный установленный CLI из интерфейса Linguisty.

## Specs

- Governing: `spec://common/PROP-000-product#scope.in`
- Governing: `spec://modules/platform/INFRA-003-local-cli#root`
- Affected: `spec://modules/platform/INFRA-003-local-cli#root`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`

## Scope

- In: Native Messaging, четыре CLI-адаптера, одноразовая установка соединителя Windows, UI без API-ключа, существующие кэш/дедупликация, отмена/лимиты, документация и проверки.
- Out: установка сторонних CLI, перенос их токенов, запросы к платным моделям, наш сервер, управление существующими пользовательскими чатами и процессами.

## Acceptance

- [x] CLI можно выбрать, сохранить и использовать без API-ключа; старые API-настройки продолжают работать.
- [x] Соединитель запускается браузером, ограничивает очередь/вход/выход, завершает принадлежащие ему процессы при отмене/timeout/disconnect.
- [x] Четыре адаптера проверены детерминированными ответами; неустановленный CLI и соединитель дают понятные ошибки.
- [x] Проверка подключения не вызывает модель и прямо сообщает предел проверки.
- [x] Установка Windows, typecheck, lint, осмысленные тесты, обе сборки, manifests/secrets, браузерный smoke и hygiene фактически проверены.
- [x] Реальные модельные ответы и отсутствующие CLI отмечены непроверенными.

## Result

Завершено 2026-10-08 для проекта @tsyzhman с использованием Codex. Четыре CLI adapters, bounded stdio Native Messaging host, Windows installer, keyless options/popup на 16 UI локалях и пакеты 0.3.0. API-ключ при CLI переводе не читается и не передаётся; прежний ключ сохраняется для возвращения к API.

Проверки: typecheck/lint PASS, 589 unit PASS, 15 native PASS, 8 manifest checker PASS, Chrome API/UI/native 16 PASS, Firefox API 14 PASS и native 5 checks PASS, обе сборки/manifests/secrets PASS, Mozilla 0/0/0, hygiene PASS. Собственные helper процессы/temp workspaces отсутствуют; чужой кэш и процессы сохранены. Vite UI size warning остаётся в TD-002.

Существенные пределы: реальные модели/аккаунты/языковая точность не проверены; Claude/Antigravity CLI не обнаружены. Chrome native transport использовал отдельную test copy только с изменённым permission declaration; физический optional prompt не подтверждён. Firefox штатный optional prompt проверен в неизменённом пакете. Доказательства и пакеты: docs/QA-CLI.md; установка: docs/LOCAL-CLI.md.
