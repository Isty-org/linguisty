# Приёмка Linguisty

## Автоматические проверки

Долгий batch: `node --test --test-concurrency=1 tests/e2e/long-batch.test.mjs`. Chrome проверяет transport с synthetic fetch 40 s; Firefox — loopback HTTP с поздними headers/body 40 s и естественную выгрузку фона после завершения. Lifecycle API расширения во время ожидания не опрашивается. Итоговый проход: [QA-2026-10-13](QA-2026-10-13.md).

Ленивая загрузка словарей 0.4.7: `node --test --test-concurrency=1 tests/e2e/locale-loading.test.mjs`. Chromium проверяет фактические requests только выбранных de/fr chunks; оба браузера проверяют offline local pack. В Firefox Resource Timing не раскрывает module requests в используемом WebDriver сеансе, поэтому его прямой сетевой счётчик остаётся непроверенным. Результаты полного прохода: [QA-2026-10-12](QA-2026-10-12.md).

Popup и регрессии 0.4.5: `node --test --test-concurrency=1 tests/e2e/rebrand-language.test.mjs`, `node --test --test-concurrency=1 tests/e2e/chromium-smoke.test.mjs`, `node scripts/firefox-smoke.mjs`. Chrome требует существующий `LINGUISTY_CHROMIUM_EXECUTABLE` из QA-CODEX. Шестерёнка проверяется по accessible name, tooltip, SVG, 44 px, клавиатуре, темам и 16 локалям; модель и предпочтения защищены от сохранения языков старым popup. Свидетельства — [QA-POPUP](QA-POPUP.md).

Подписка ChatGPT 0.4.6: `node --test --test-concurrency=1 tests/e2e/codex-chrome.test.mjs` и `node tests/e2e/codex-firefox.mjs`. Для Chrome задайте `LINGUISTY_CHROMIUM_EXECUTABLE` из QA-CODEX. Обе проверки запускают неизменённый пакет в собственных временных профилях, подставляют OAuth/JWKS/models/Responses в странице теста и проверяют callback/port/перевод. Responses fixture требует model=gpt-6-luna и строгий text.format, возвращает commentary + final_answer через output_item.done и пустой terminal output; отдельный пустой завершённый ответ проверяет новый безопасный код. Общий сценарий проверяет 1 340 фрагментов, повтор целиком из кэша, отказ незавершённого ответа с безопасным кодом и отсутствие записи ошибки в кэш. Свидетельства: `test-results/linguisty-response-stream/{chrome,firefox}.json`. Возврат проверяется с web initiator `auth.openai.com`: Chrome отправляет форму с локально подставленной страницы этого origin, Firefox выполняет навигацию с соответствующим content principal и отдельно проверяет запрет чужих origins/private pages. Прямой `tabs.update(callback)` не проверяет эту границу. Подписанная fixture использует singleton audience array; Firefox дополнительно проверяет безопасный код token HTTP 401, Chrome — код неверного nonce без секретов и переполнения на 360 px. В Firefox проверяется штатная выдача host-доступа, в Chrome host-доступ предварительно выдан тестовым UI; Chrome permission dialog не проверен. Ни реальный аккаунт, ни платные модели не используются. Результаты и ограничения — [QA-SUBSCRIPTION](QA-SUBSCRIPTION.md), исходный режим — [QA-CODEX](QA-CODEX.md).

CLI: npm run test:native; node --test --test-concurrency=1 tests/e2e/native-chrome.test.mjs; node tests/e2e/native-firefox.mjs. Native smoke не обращается к живым моделям. Детали test copy Chrome, штатного Firefox grant и воспроизведения — [QA-CLI](QA-CLI.md).

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build:chrome`, `npm run build:firefox`, `npm run check:manifests`. Тесты проверяют contracts, storage/migration, secrets boundary, TTL/LRU/cache limits, prompt/parser, provider errors/timeout/abort, dedup, DOM filtering/whitespace/restore/mutations/stale replies и cleanup. Максимум 2 test workers.

## Браузерный smoke

| Сценарий | Что проверять |
|---|---|
| Установка обеих сборок | Manifest V3, Linguisty, popup/options без CSP errors |
| Onboarding | Нет ключа/модели, ссылка в настройки, manual model |
| Permissions | Только origin выбранного API, отказ не сохраняет новую конфигурацию |
| Статичная fixture | Visible first, полный текст, неизменные event handlers/forms |
| JSON/API errors | Неизвестные IDs, malformed JSON, 401, 429, timeout, no raw secrets |
| Шрифт | CJK ↔ кириллица: измеренные glyph heights, иерархия размеров, clipping, восстановление и внешние стили |
| Журнал API | Только допустимые машинные code/type, HTTP status и attempts; отсутствие provider prose/request IDs и фрагментов страницы в storage/UI/копии, очистка старых записей, один record после retry, clear, обе темы |
| Поток | Первая целая фраза до конца ответа; повреждённые ID/UTF-8/SSE, error при 200, обрыв, rollback/cancel/route/close, regular mode и явный fallback |
| Cancel и restore | Нет новых запросов после отмены; original/translated без API |
| Dynamic/SPA | Новый текст переводится один раз; старая batch не применяется после route |
| Popup reopen / worker restart | Актуальный status, предсказуемое продолжение/повторный запуск |
| Cache | Второй запрос без fetch; другой model/instructions/context не получает старый перевод |
| Ресурсы | Detached nodes, observers/timers/in-flight map очищаются; bounded cache/queue |
| Темы | Light/dark/system, keyboard/focus/labels/reduced motion |
| Языки | Новый browser default, сохранённый manual выбор, независимый UI/target, return-auto через form submit, 16 locales, Arabic RTL |

QA report обязан разделять реальные browser checks, mock/integration tests и невыполненные проверки. Две успешные сборки не равны двум проверенным браузерам.

## Живая оценка OpenRouter

При предоставленном ключе: французская недвижимость (PAP/SeLoger/Bien'ici), news, docs, SPA, infinite scroll, table. Проверить цены/площади/DPE/числа/названия, сохранность кнопок/галереи, полноту смысла, first viewport latency, восстановление и повторное посещение. Сравнить несколько самостоятельно выбранных моделей; не объявлять одну модель лучшей по одному тесту. Реальный paid API не запускается автоматически по найденному чужому ключу.

## Финальный отчёт

`docs/QA-REPORT.md`: фактические commands/results, даты Europe/Moscow, artifacts, проверенные браузеры, ограничения и размер кэша/пакетов. Незавершённый обязательный acceptance сохраняет WI In Progress/Blocked, а не Done.

Последний локальный проход 0.2.0 после Retro Orbit: 566 tests / 33 files, 8 manifest/hygiene tests, 5 fixtures, 13 Chromium scenarios (14 PASS с parent), отдельные UI/startup runs, 14 Firefox groups и 2 packaged language scenarios. Mozilla Add-ons Linter 10.13.0 — 0 ошибок и предупреждений в Firefox ZIP. Подробности и исторический key-lifecycle evidence — [QA-REPORT](QA-REPORT.md) и [FIREFOX-QA](FIREFOX-QA.md). Real-provider quality, ревью всех локализаций носителями, permanent signed install и обновление Firefox executable отдельно от доступной автоматической приёмки.

Полные новые сценарии входят в `node --test tests/e2e/chromium-smoke.test.mjs` и `node scripts/firefox-smoke.mjs`. Для отдельного сценария задайте LINGUISTY_SMOKE_FILTER / LINGUISTY_FIREFOX_SMOKE_FILTER как `fonts`, `journal` или `streaming`. Production packages не патчатся; тестовый loopback сервер имитирует ошибки, SSE chunks и обрыв. Font baseline: `node tests/e2e/font-metrics.mjs`; результаты — `test-results/linguisty-fonts/baseline.json`.

Новые regression runs: `node tests/e2e/firefox-key-lifecycle.mjs` и `node --test --test-concurrency=1 tests/ui/startup-browser.test.mjs`. Для Chromium используйте доступный runtime через LINGUISTY_CHROMIUM_EXECUTABLE из QA-REPORT. Первый run использует только test credential без API; второй инжектирует в тестовую страницу pending cache/settings reads и первый транспортный отказ, проверяет открытие формы, timeout/retry и cleanup. Для unit tests watch не нужен, максимум два worker.

Retro Orbit/languages: `node --test --test-concurrency=1 tests/e2e/rebrand-language.test.mjs`. Тест проверяет все 16 locales/320/390/1280 px в Chromium, оба типа выбора через реальные формы Chrome/Firefox, RTL, contrast tokens, локальные шрифты/SVG и отсутствие внешних UI resources. Footer имеет локализованный credit и доступный знак Isty; в header знака нет. После выбора browser target ждёт удаления manual input (React commit), после save — feedback и завершённой формы; одно native select.value не подтверждает состояние приложения. Firefox preferences меняются только в собственном temporary профиле; платные запросы не выполняются. Reports/screenshots: `test-results/linguisty-rebrand/`.

