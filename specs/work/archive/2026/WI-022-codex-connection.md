# WI-022: Подключение Codex из настроек

- Kind: `change`
- Canon action: `new-spec`

## Outcome

В настройках пользователь выбирает Codex, нажимает «Подключить Codex» и получает отдельную страницу с инструкцией, входом через ChatGPT и проверенным состоянием подключения. Новый режим не требует Native Messaging host или установленного CLI.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#options`
- Governing: `spec://modules/platform/INFRA-004-codex-connection#auth`, `spec://modules/platform/INFRA-004-codex-connection#requests`
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#root`, `spec://common/PROP-001-contracts#types`
- Affected: `spec://modules/storage/INFRA-002-local-data#cache.key`, `spec://modules/platform/INFRA-001-extension#permissions`, `spec://common/PROP-000-product#invariants`

## Scope

- In: выбор Codex, страница шагов, официальный OSS OAuth с PKCE/OIDC, только память вкладки для токенов, Responses/SSE, отмена и ограниченные ресурсы, оба браузера, документация.
- Out: прямой вход через подписки Claude/Antigravity/Grok; автоматическая публикация; запросы к реальной модели без отдельного тестового поручения.

## Acceptance

- [x] Dropdown содержит API-провайдеры и один новый Codex; другие CLI не предлагаются.
- [x] Кнопка открывает/фокусирует одну собственную вкладку подключения с понятными шагами и ограничением её закрытия.
- [x] OAuth проверяет state, PKCE, подпись/issuer/audience/nonce/expiry ID token и разрешение ChatGPT plan; access/refresh/ID tokens не записываются в storage, URL, журнал или сообщения фону.
- [x] Callback перехватывается только для собственной попытки входа и освобождает временное правило/вкладку/таймер при завершении и отмене; фон очищает только собственные брошенные правила/вкладки.
- [x] Provider реализует документированный Responses контракт, строгую проверку переводов, account scope постоянного кэша и отмену.
- [x] Typecheck, lint, осмысленные tests, обе сборки/ZIP, manifest/hygiene и браузерный сценарий проходят; live OAuth/model отдельно помечены непроверенными при отсутствии ручного входа.

## Result

Реализован dropdown Codex → кнопка → отдельная страница с четырьмя шагами входа ChatGPT, проверкой списка моделей, выбором модели, отменой, отключением и возвратом. Инструкция и ошибки доступны на 16 языках. Новый режим не использует CLI/Native Messaging и хранит токены только в RAM открытой страницы. API-настройки и прежний ключ сохраняются; старые CLI больше не предлагаются в UI.

Проверки: TypeScript/ESLint PASS; 644 Vitest / 45 files (2 workers max); 15 native mock tests; 8 manifest/hygiene tests; production builds/ZIP Chrome+Firefox; Mozilla Add-ons Linter 10.13.0 — 0 errors/notices/warnings. Неизменённые пакеты: Chrome Codex 5 групп, Firefox Codex 4 группы; API full smoke — 13 Chrome scenarios / 14 Node PASS и 14 Firefox groups, затем после account cache change — финальные focused API cache checks обоих браузеров. OAuth/JWKS/Responses используют только fixture, не реальные аккаунты/модели.

При приёмке исправлены required DNR permission, Chrome duplicate tab/worker-wake lookup через собственный getContexts, разделение постоянного кэша по аккаунту и узкий заголовок. Защищённая .cache осталась 5 652 files / 203 426 930 B; source duplicates/suspicious=0; own QA processes=0, созданные профили удалены. UI chunk 614 710 B учтён в TD-002. Отчёт: docs/QA-CODEX.md; инструкция: docs/CODEX-CONNECTION.md; evidence: test-results/linguisty-codex/.

Реальные OAuth/eligibility/CORS, ответ/точность/расходы модели, разрешение магазинной публикации, signed install, native review локализаций и minimum-version browsers не проверены. Вкладка подключения должна оставаться открытой; модель облачная. Эти ограничения показаны в интерфейсе/документации; живые проверки и публикация вне scope.
