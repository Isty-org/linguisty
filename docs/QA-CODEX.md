# Linguisty 0.4.0 — подключение Codex

Автор разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты и фактические проверки указаны ниже. См. [AUTHORS](../AUTHORS.md).

Дата: 2026-10-08, Europe/Moscow. WI-022. Инструкция пользователя — [CODEX-CONNECTION](CODEX-CONNECTION.md); первичные источники и найденные browser limitations — [RESEARCH](RESEARCH.md#wi-022-codex-без-установки-соединителя).

Было → стало: четыре CLI в выборе и установка Native Messaging host → API-провайдеры и один Codex; кнопка открывает отдельную страницу четырёх шагов, входа ChatGPT, моделей, проверки и отключения. Новый режим использует официальный OSS/local OAuth preview. Старый native transport сохранён для внутренней совместимости. CLI и host новому режиму не нужны.

## Выполненные проверки

| Проверка | Фактический результат |
|---|---|
| TypeScript / ESLint | PASS |
| Vitest | 644 PASS, 45 файлов, максимум 2 worker |
| Существующие native contracts | 15 PASS, только fake CLI subprocesses |
| Manifest/hygiene checker tests | 8 PASS |
| Chrome / Firefox production builds и ZIP | PASS, версия 0.4.0 |
| Manifest / секреты / локальные assets | PASS, по 28 файлов и 24 referenced assets |
| Mozilla Add-ons Linter 10.13.0 | 0 errors, 0 notices, 0 warnings |
| Codex в Chrome 152.0.7977.8 | 5 групп PASS; неизменённый пакет, mock OAuth/Responses |
| Codex в Firefox 157.0.1, geckodriver 0.37.1 | 4 группы PASS; неизменённый пакет, mock OAuth/Responses |
| Полный прежний API smoke | Chrome: 13 сценариев / 14 Node PASS; Firefox: 14 групп PASS |
| Финальный API cache regression после account-scope правки | Chrome: 2 сценария / 3 Node PASS; Firefox: 3 группы PASS |
| Кэш / дубли / временные ресурсы | PASS; подробности ниже |

Полный API smoke выполнен перед последней правкой только Codex account scope в ключе кэша. После неё повторены полный Vitest, обе Codex browser проверки и focused API cache smoke; остальные API browser группы повторно не запускались. Это не выдаётся за второй полный browser run.

Chrome проверяет dropdown из трёх пунктов, скрытые API-поля, сохранение перед открытием инструкции, четыре шага, настоящий browser redirect собственного callback, PKCE/RSA/OIDC fixture, очистку правила, один guide tab при повторном нажатии, background port и реальный перевод Text nodes/возврат оригинала. Повтор в одном аккаунте использует постоянный кэш; вход с другим подписанным fixture sub вызывает новый Responses запрос. Итог: два token/model/Responses/callback запроса, ноль неожиданных сетевых обращений. Отключение/закрытие вкладки дают безопасный reconnect error. Макет 360 px не имеет горизонтального overflow; desktop/mobile screenshots просмотрены.

Firefox проверяет штатный optional host grant, тот же callback и bridge, перевод/оригинал, повторное открытие и отключение. Проверка выполняется с temporary install; системная тестовая область используется только для нажатия browser permission UI. Chrome host-доступ предварительно выдан через test-browser UI: физический Chrome permission dialog не проверен. OpenAI endpoints подставлены только в тестовой странице; исходники production packages не патчатся.

Unit contracts проверяют state/PKCE/nonce, RSA signature/issuer/audience/expiry, обязательное разрешение плана, refresh rotation/failure, Responses completed/incomplete/refusal/UTF-8/лимиты, scoped cache и строгие IDs, timeout/cancel и 30 циклов port cleanup. Проверяется также пробуждение Chrome background при скрытом tab URL и очистка только собственных правил/вкладок.

## Найденные и исправленные проблемы

- Optional declarativeNetRequestWithHostAccess: Firefox не предоставляет API, Chrome зависает на updateSessionRules. Разрешение теперь required; OpenAI/loopback host-доступ остаётся optional и выдаётся кнопкой. Широкого required host-доступа нет.
- Chrome tabs.query не находил собственный guide URL, создавал дубль и смешивал status двух сеансов. Поиск через runtime.getContexts ограничен своим documentUrl и переживает worker restart. Пять повторов прошли после исправления; финальный расширенный cache run также прошёл.
- Account scope первоначально разделял только in-flight запросы. Теперь он входит и в постоянный cache digest; токены и email не входят в digest. API digest сохранён.
- Узкий заголовок разрывал слово. Размер исправлен только для Codex guide; обе темы и mobile screenshot проверены визуально.

## Память и артефакты

Снимок после browser checks: node_modules — 8 473 файла / 193 593 454 B; .wxt — 6 / 6 713 B; .output — 75 / 10 038 595 B до обновления документации в sources ZIP. Source scan: 206 файлов, одинаковых копий и suspicious artifacts нет. Зависимости не устанавливались, watch/helper не оставлены. Общий UI JS chunk — 614 710 B; предупреждение Vite >500 kB сохраняется в TD-002, не скрывается.

Защищённая .cache сохранила исходные 5 652 файла / 203 426 930 B. Старые cache/profile/отчёты других задач не удалялись. Созданные тестовые профили удалены; Firefox cleanup сообщает ownProcessCount=0/profileRemoved=true, дополнительная проверка Chrome/Firefox QA command lines — 0 процессов. Свободная RAM в контрольном снимке — 13 429 415 936 B из 34 282 012 672 B; это измерение, а не самостоятельное доказательство отсутствия утечек. Lifecycle подтверждается отдельными тестами.

Артефакты: `test-results/linguisty-codex/{chrome,firefox,hygiene,packages}.json`, четыре screenshots и собственный driver log. Полные API отчёты — `test-results/linguisty-smoke/observations.json` и `test-results/linguisty-firefox/observations.json`; финальные cache reports — `observations-focused-cache.json` в тех же каталогах. JSON с hashes пакетов создаётся после окончательной упаковки.

## Воспроизведение и ограничения

Базовые команды: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:native`, `node --test --test-concurrency=2 scripts/check-manifests.test.mjs`, обе `zip:*`, `npm run check:manifests`, `npm run check:hygiene`. Browser команды перечислены в [TESTING](TESTING.md). Доступный Chromium задаётся через `LINGUISTY_CHROMIUM_EXECUTABLE=C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe`. Mozilla linter запускался из существующего защищённого cache без npm install.

**Реальный вход ChatGPT, eligibility аккаунта/плана, реальный CORS/OpenAI callback, ответы/языковая точность/расходы модели, условия магазинного распространения, signed/store install и браузеры минимальной версии не проверены.** Используется официальный preview; fixture не подтверждает универсальный доступ по подписке. Модель работает в облаке OpenAI. Вкладка подключения должна оставаться открытой; закрытие, перезагрузка/выгрузка вкладки или перезапуск браузера требуют нового входа. Chrome и Firefox ZIP — локальные пакеты, Firefox без подписи.
