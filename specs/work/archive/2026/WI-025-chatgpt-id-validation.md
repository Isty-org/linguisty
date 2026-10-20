# WI-025: Проверка подтверждения ChatGPT и точная причина отказа

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Корректный ID token с единственным aud в массиве принимается после полной проверки подписи; ошибки подключения получают безопасную причину в собственной странице.

## Specs

- Governing: `spec://modules/platform/INFRA-004-codex-connection#auth`
- Affected: `spec://modules/platform/INFRA-004-codex-connection#auth`
- Constraint: `spec://modules/platform/INFRA-004-codex-connection#resources`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: OIDC audience/azp regression; ограниченная диагностика callback/token/discovery/JWKS/identity/models; отображение кода причины без внешних сообщений и секретов; обе сборки, тесты и ZIP.
- Out: ослабление подписи/state/nonce, чтение пользовательских токенов, paid inference, утверждение причины реального сбоя без диагностики.

## Acceptance

- [x] Тест воспроизводит отказ допустимого aud=[clientId]; исправление принимает его, отклоняет чужие audience/azp и сохраняет проверку подписи.
- [x] Коды причин различают шаг/HTTP status/проверку claims; внешний текст, токены, URL callback и account data в них не попадают.
- [x] Ошибка видна на странице подключения; браузерные проверки включают audience array и безопасный отказ.
- [x] Typecheck/lint, тесты, обе сборки, package checks, ресурсная проверка и обновлённые ZIP готовы.

## Dependencies

- Related: `WI-022`, `WI-024`

## Result

Было: singleton audience array без azp ошибочно отвергался; общий текст скрывал этап отказа. Стало: допустимый audience проходит полную проверку, чужой azp/audience и неверная подпись отклоняются; собственная страница показывает только ограниченный LGT-код. Токены/внешние сообщения/claims не добавлены в UI, журнал или port contract. Причина именно реального сообщения пользователя пока не установлена; новый код предназначен для следующей попытки.

Проверки 2026-10-09: регрессия до исправления — FAIL, после — PASS; typecheck/lint; 685 Vitest tests / 47 files; 9 manifest/hygiene tests; обе production builds, manifest/secret/resource checks. Firefox 157.0.1 и Chromium 152.0.7977.8: по 7 browser-check групп с подписанным aud=[clientId], callback с OpenAI initiator, переводом fixture, очисткой и безопасным отказом (token HTTP 401 / неверный nonce). Визуально проверены сообщения в Firefox dark и Chrome light 360 px. Mozilla linter: 0 errors/notices/warnings. Пакеты 0.4.3: Firefox 28 files / 1 139 383 bytes, Chrome 28 / 1 139 220 bytes до сжатия; ZIP versions проверены.

Кэш до/между/после: .cache 5 652 files / 203 426 930 bytes; source duplicates/suspicious=0; watch/QA-процессов после проверки=0. Firefox освободил 12 собственных процессов / 1 387 491 328 bytes working set, свой профиль удалён. Зависимости не устанавливались, чужой кэш/процессы сохранены. Финальный снимок: test-results/linguisty-subscription/hygiene-final.json. Общий UI chunk 608 410 bytes по-прежнему учитывается в TD-002.

Документация: docs/RESEARCH.md, docs/QA-SUBSCRIPTION.md, docs/CODEX-CONNECTION.md, docs/TESTING.md, docs/DEVELOPMENT.md. Живой вход пользователя, доступность его плана и ответы модели не проверены. Следующая пользовательская проверка: обновить расширение, начать новый вход и при отказе сообщить только текст с LGT-кодом.
