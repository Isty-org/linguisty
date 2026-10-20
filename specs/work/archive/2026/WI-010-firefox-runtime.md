# WI-010: Проверка расширения в Firefox

- Kind: `research`
- Canon action: `none`

## Outcome

Фактическая совместимость production-пакета с установленным Firefox проверена в отдельном временном профиле; результат и границы проверки воспроизводимы.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://modules/platform/INFRA-001-extension#root`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In: Firefox temporary add-on/runtime, локальный mock, настройка сервиса, перевод/оригинал/отмена/динамика/SPA, release evidence и cleanup.
- Owned: `scripts/firefox-smoke.mjs`, `tests/e2e/firefox-*.mjs`, `docs/FIREFOX-QA.md`, собственный Result. Evidence в `test-results/linguisty-firefox/`; временный driver только в `.cache/firefox-qa/`.
- Read-only: production package, существующие fixtures и `tests/e2e/local-server.mjs`.
- Out: чужие production/scripts, пользовательский профиль, установка браузера, платные API, публикация, изменения shared/config/lock/BOARD/WAL.

## Dependencies

- Depends on: WI-006 и production build Firefox.
- Related: WI-008, WI-009.

## Acceptance

- [x] Исследованы существующие подходы и официальная документация Mozilla до реализации harness.
- [x] Проверен неизменённый production Firefox package; версия runtime, команды и результаты сохранены.
- [x] Проверены доступные сценарии; найденные дефекты переданы координатору, непроведённые проверки прямо отмечены.
- [x] Нет собственного незакрытого сервера/driver/профиля; runtime requests/timers и RAM/кэш проверены.
- [x] При недоступной автоматизации зафиксировано конкретное воспроизведённое ограничение и выполнены доступные проверки; нет фиктивного PASS.

## Result

- Было → стало: Firefox runtime имел только непроверенный production-пакет; теперь есть воспроизводимый smoke, фактический отчёт и screenshots неизменённого пакета в Firefox 157.0. Production/shared/config/lock/BOARD/WAL и чужие QA файлы не изменялись; `Canon action: none`.
- Созданы owned `scripts/firefox-smoke.mjs`, `tests/e2e/firefox-runtime.mjs`, `tests/e2e/firefox-smoke.mjs`, `docs/FIREFOX-QA.md`. Переиспользованы общий local-server и fixtures; npm dependencies и браузер не устанавливались. До harness исследованы Reddit/Stack Overflow и подтверждены Mozilla geckodriver/Marionette/temporary installation/MDN docs; ссылки и method находятся в FIREFOX-QA.
- Production package snapshot после сообщения координатора проверен командой `node scripts/firefox-smoke.mjs` 2026-10-07 11:17:52–11:18:33 МСК: **10 PASS, 0 FAIL**, exit code 0. Runtime Firefox **157.0**, geckodriver **0.37.1**, временный isolated headless profile. Хеш package index до/после **78dbc619cdfa64dd39ce225a719dfd34277edf407aa54518dd24363f1b55ba26**, 13 файлов / 343 380 bytes; дополнительная сверка текущих file SHA-256 сразу после прохода совпала. Manifest/CSP/permissions/source files исполнителем не патчились.
- Пройдены: onboarding; отказ и разрешение настоящего Firefox optional-host prompt из production options; сохранение local service/manual model; mock connection/model discovery; production popup→фон→контент→mock; exact original/translated и динамический resume; form/gallery/listener/reference/whitespace preservation; own-mutation no-loop; external text/dynamic insert/delete; SPA новый sessionId/title context; repeat-cache без сети и точный fully cached fromCache counter; model isolation/clear; DOM exclusions/placeholders/HTML-as-text; light/dark/system, labels, targeted Tab focus и aria-live.
- Ошибки проверены отдельно: 401→INVALID_API_KEY, 429→RATE_LIMIT, malformed/unknown IDs→INVALID_MODEL_RESPONSE, about:config→RESTRICTED_PAGE. Public UI/content boundaries и ошибки не содержат mock credential или raw provider response; session↔persistent migration оставляет одну копию, удаление очищает обе. Paid/external provider запросов не было: gateway loopback, 52 mock requests, maximumActiveRequests=2.
- Resource probe наблюдал ненулевую активность до cleanup: 4 timers, 1 MutationObserver, 1 IntersectionObserver, по одному page listener. Повторный inject не добавил observers/listeners. После каждой из трёх отмен: timers=0, observers=0, session listeners=0 (bootstrap pagehide сохраняется до закрытия документа), active mock requests=0, pending mock timers=0; snapshots закрытых вкладок удалены. Finally: 0 собственных Firefox/geckodriver процессов, profileRemoved=true, mockAfterClose activeRequests=0/pendingTimers=0.
- RAM snapshots сохранены в evidence: собственный Firefox/driver working set 769→1006→1019 MiB на установке/pipeline/трёх lifecycle, после закрытия 0; Node RSS 64→72→74 MiB на тех же этапах. Это наблюдения, не утверждение отсутствия всех утечек. Final cache clear: entries=0 / estimatedBytes=0. QA cache содержит только `driver/geckodriver.exe` (4 075 136 bytes) и `driver-source.json` (355 bytes); duplicate downloaded zip и все собственные profiles удалены. SHA-256 downloaded archive совпал с официальным release digest.
- Синтаксические `node --check` всех трёх mjs и targeted ESLint **PASS**. Общие typecheck/lint/unit/build/release проверки принадлежат координатору/WI-008 и не выдаются здесь за проведённые этим чатом.
- Evidence: `test-results/linguisty-firefox/observations.json`, `geckodriver.log`, screenshots real-estate/SPA/options light-dark-system/popup-system; метод, команды, researched sources и ограничения — `docs/FIREFOX-QA.md`. Production-дефектов в измеренном scope не выявлено. Первичные harness ошибки устранены: chrome/content window handles, ошибочная трактовка ApiResult.error, observer probe Xray subclass и поиск restricted tab по скрытому URL.
- Не проверено: signed/AMO и installation-time data consent; физический native permission click и toolbar/activeTab-only gesture; native popup geometry; реальный OpenRouter/смысловая точность; полный WCAG/contrast/reduced-motion audit; browser restart/session-key lifetime; cache TTL/LRU/eviction/IDB отказ в runtime smoke. Native optional prompt разрешается его реальной кнопкой программно через test driver chrome scope после delay; manifest и production security не ослаблены.
- Handoff после завершённого прохода: координатор сообщил о последующих source-правках UI raw-authority/C0/DEL validation и background model limit 200. Они не входят в указанный package snapshot. По поручению координатора дополнительный full smoke не запускался; он самостоятельно пересоберёт production и выполнит воспроизводимую команду. Старый PASS не перенесён на новый source/package. WI-010 содержит готовый harness и фактически измеренное evidence; принятие/архивирование остаётся за координатором.

Принято координатором 2026-10-07: общий набор 391 unit tests PASS; финальные production packages прошли 9 Chromium scenarios и 10 Firefox groups. Все runtime tests используют loopback mock, реальная языковая точность не проверена. Замечания UI raw authority/C0/DEL и background model200 исправлены координатором и проверены; отсутствие storage.session вне поддерживаемых desktop versions не принимается как целевой runtime. Ограничение аварийной миграции двух областей записано TD-001.
