# WI-024: Возврат в Linguisty после входа ChatGPT в Firefox

- Kind: `fix`
- Canon action: `none`

## Outcome

Firefox пропускает возврат со страницы OpenAI в собственную callback page Linguisty без зависания на about:blank.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#auth`
- Constraint: `spec://modules/platform/INFRA-004-codex-connection#resources`
- Constraint: `spec://modules/platform/INFRA-001-extension#permissions`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: воспроизведение возврата с web initiator в Firefox, точечная настройка доступности callback, browser regression, проверка обеих сборок и ресурсов.
- Out: изменение OAuth протокола, токенов, лимитов подписки и реальный платный inference.

## Acceptance

- [x] Регрессионная проверка воспроизводит блокировку текущей сборки при инициаторе auth.openai.com.
- [x] Исправленная сборка получает callback в собственном auth tab; чужой origin не получает доступ к callback page.
- [x] Typecheck, lint, тесты, обе сборки, manifest/secret checks и Chrome/Firefox smoke пройдены.
- [x] Кэш, дубли, память и завершение собственных браузерных процессов проверены; подготовлен обновлённый Firefox ZIP.

## Dependencies

- Related: `WI-022`, `WI-023`

## Result

Было: web_accessible_resources разрешал callback page только от 127.0.0.1; fixture открывала URL через API расширения и не проверяла сайт-инициатор. Стало: точный auth.openai.com добавлен к callback origins, private pages закрыты, OAuth протокол и token boundary сохранены. Версия 0.4.2; обновлены проверки пакета и инструкция повторного входа.

На прежней сборке Firefox 157.0.1 навигация с content principal auth.openai.com не доставила callback: callback/token=0. После изменения тот же сценарий прошёл; 7 проверок Firefox principal подтвердили разрешённые origins и запрет чужих origins/private pages. Chromium 152.0.7977.8 прошёл два входа через форму на подставленной странице auth.openai.com, перевод, cache hit и разделение по аккаунтам. Firefox также прошёл перевод и освобождение сеанса. В обоих браузерах проверены 16 языков.

Проверки: typecheck/lint PASS, 661 Vitest tests / 46 файлов, 9 manifest/hygiene tests, обе production сборки и manifest/secret/resource checks PASS. Mozilla linter: 0 errors/notices/warnings. Firefox ZIP `.output/linguisty-0.4.2-firefox.zip`: 28 файлов / 1 137 648 B до сжатия. Прежнее предупреждение размера UI chunk остаётся в TD-002.

Ресурсы: .cache неизменна — 5 652 файла / 203 426 930 B; исходных дублей нет. Firefox: 13 собственных процессов / 1 447 309 312 B working set → 0; профиль удалён. Chrome context закрыт и профиль удалён; отдельная проверка QA command lines не нашла оставшихся browser/watch процессов. Снимок RAM после проверок: свободно 17 130 971 136 из 34 282 012 672 B; это не доказательство отсутствия любых утечек.

Evidence: `docs/QA-SUBSCRIPTION.md`, `docs/RESEARCH.md`, `test-results/linguisty-subscription/{chrome,firefox,hygiene-final}.json`. Реальный вход в аккаунт пользователя, доступность плана, live token exchange/CORS и ответы модели не проверены. Для пользователя требуется перезагрузка расширения и новая попытка входа; старые OAuth вкладки повторно не используются.
