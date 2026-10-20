# WI-007: Интерфейс Linguisty

- Kind: `implement`
- Canon action: `none`

## Outcome

Пользователь настраивает свой сервис/ключ/модель и переводит страницу через рабочие popup/options в темах Cloud Day/Cloud Night.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#root`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#ui`

## Scope

- In/owned: `src/ui/**`, `entrypoints/popup/**`, `entrypoints/options/**`, `tests/ui/**`, Result этого WI.
- Out: shared/config/lock, storage/providers/cache/background/content, public assets/scripts, docs/BOARD/WAL.
- UI React, shared sendMessage<T> и RuntimeMessage. Export bootstraps use createRoot, no inline scripts. Import constants/contracts rather than duplicates. Browser permission request occurs on user gesture before privileged call. Поведение permission denial и empty key строго по спекам.
- Theme CSS взять из DESIGN §4.5; supplied logo.png можно использовать как mark, продукт всегда Linguisty. Не подключать удалённые fonts/scripts.

## Dependencies

- Depends on: WI-002; integration WI-006.

## Acceptance

- [x] Popup progress/translate/cancel/original/translation/status reopen работает.
- [x] Options providers/baseURL/key modes/manual model/discovery/test/save/remove/cache implemented.
- [x] Permission denial и invalid settings не дают ложный success; no key prefill/logging.
- [x] Light/dark/system, labels/keyboard/focus/reduced motion и responsive options checked.
- [x] Own interaction tests и доступные type/lint checks выполнены; no timers/subscriptions leaks.

## Result

Готово для приёмки координатором. Canon action: none. BOARD/WAL/shared/config/dependencies/чужие исходники не изменялись.

Было → стало: popup/options отсутствовали → два рабочих React-экрана Linguisty с Cloud Day/Cloud Night/system, настройкой собственного сервиса и управлением реальной сессией вкладки. Последняя синхронизация по указанию координатора: предел API-ключа 8192 → 4096 символов и `maxLength=4096` у password input.

Реализовано:

- Popup: source/target, реальный provider/model, onboarding, START/CANCEL/SET_DISPLAY_MODE/GET_TAB_STATE, восстановление прогресса при открытии, фильтрация событий по tabId, защита от запоздавшего snapshot, исходный текст/перевод, читаемые ошибки и отдельный переход к настройкам при ошибке ключа/модели. Частичные сбои явно показаны как «Перевод завершён с ошибками». Обычный завершённый экран укладывается примерно в 600 px; ручное обновление статуса доступно при работе/ошибке.
- Options: OpenRouter/OpenAI-compatible, HTTPS/loopback endpoint, password без prefill, session/persistent, manual model, ограниченный discovery/search/selection, test/save/remove key, source/target BCP 47, style, instructions, theme, настоящие cache stats/clear. Пустой ключ не отправляется и сохраняет существующий; введённый ключ очищается после успешного save. Permission request вызывается синхронно из click/submit до первого await; отказ не отправляет SAVE_SETTINGS/TEST_CONNECTION/LIST_MODELS.
- UI использует только shared contracts/constants/errors/messaging и browser API. Secret/provider/cache helpers не импортируются. Нет удалённых fonts/CDN/inline scripts; используется supplied `/icon/48.png`.
- CSS semantic tokens взяты из DESIGN §4.5, 44 px controls, native labels/keyboard/focus-visible, aria-live/error, reduced motion, responsive options. Theme hint в localStorage содержит только тему; preview не сохраняет настройки без Save.
- Model list ограничен MODEL_MAX_ENTRIES, дубли ID убираются, одновременно отображается до 40 результатов. Listener popup и matchMedia subscription снимаются на unmount; polling/watch/timers в UI отсутствуют.

Файлы и экспорты:

- `src/ui/Popup.tsx`: Popup; `src/ui/Options.tsx`: Options.
- `src/ui/components.tsx`: Brand, Notice/NoticeData, FieldError, LanguageSelect, LANGUAGES, formatBytes.
- `src/ui/settingsForm.ts`: API_KEY_INPUT_MAX_LENGTH, FormErrors, providerUrl, normalizedForm, validateForm, requestProviderPermission.
- `src/ui/theme.ts`: applyTheme, applyInitialTheme, rememberTheme, useTheme; `src/ui/styles.css`: общий Cloudline UI.
- `entrypoints/popup/{index.html,main.tsx}`, `entrypoints/options/{index.html,main.tsx}`: внешние createRoot bootstraps; options открывается отдельной вкладкой.
- `tests/ui/{Options.test.tsx,Popup.test.tsx,theme.test.tsx,browserMock.ts,browser-ui.test.mjs}`: свои interaction/lifecycle/native UI checks; используются общие QA browser/server helpers, без их копирования.

Фактические проверки:

- `node node_modules/vitest/vitest.mjs run tests/ui --maxWorkers=2`: PASS, 3 files / 23 tests после окончательной правки 4096. Покрыты отказ permission, invalid endpoint, пустой/заменённый/слишком длинный ключ, modes, false connection result, failed discovery + manual model, model bounds/dedup/search/keyboard, key removal, cache failure/clear, status reopen/cancel/toggle/late snapshot/partial errors/repeated mount cleanup, system theme cleanup.
- `node node_modules/eslint/bin/eslint.js src/ui entrypoints/popup entrypoints/options tests/ui`: PASS.
- `node node_modules/typescript/bin/tsc --noEmit`: PASS после окончательной правки. Ранние ошибки в чужих background/translation/cache модулях к последнему запуску устранены их владельцами.
- `npm run build:chrome`, `npm run build:firefox`: PASS после окончательной правки; `npm run check:manifests`: PASS для обоих, 13 files / 12 referenced assets; размеры 342565 / 342728 bytes на последнем запуске.
- `LINGUISTY_CHROMIUM_EXECUTABLE=C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe` + `node --test tests/ui/browser-ui.test.mjs`: PASS в Chromium 152.0.7977.8 на UI перед последней синхронизацией maxlength. Реальные packaged options/popup → background → loopback mock: connection/discovery/search/save/key migration/remove/cache clear/status reopen; обе темы; 320/390 px без horizontal overflow; controls >=44 px; keyboard focus ring; system changes/reduced motion; 0 page errors. Последняя правка maxlength отдельно проверена interaction test с 4097 символами.
- Screenshots и фактический отчёт: `test-results/linguisty-ui/` (7 PNG + observations.json). Изображения просмотрены, финальные снимки сделаны с завершением CSS transitions.
- Общий `tests/e2e/chromium-smoke.test.mjs` при запуске прошёл UI/pipeline/restore/cancel/themes, но упал в SPA route-reset на непереведённом «Maisons disponibles à Nantes». Координатор сообщил, что SPA исправляет фон; это не объявлено успешным и общий сценарий требует финального повторения root.

Ресурсы/дубли:

- `npm run check:hygiene`: PASS; на контрольной точке node_modules 193585435 bytes, .wxt 6390 bytes, доступная RAM около 15 GiB. Собственный UI source около 54 KB; tests около 35 KB; review artifacts около 0.94 MB, в ignored test-results.
- Последний native отчёт: activeRequests=0, pendingTimers=0; local mock server закрыт, изолированный browser profile удалён. Проверка оставшихся процессов `tests/ui/browser-ui.test.mjs`: 0. Чужой кэш/процессы не удалялись. Повторяемый mount/unmount доказывает снятие UI subscriptions; RAM snapshot сам по себе не объявлен доказательством отсутствия утечек.

Исследование до реализации: [MDN permissions.request](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request), [Chrome permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions), [React Effect cleanup](https://react.dev/reference/react/useEffect), [WXT entrypoints](https://wxt.dev/guide/essentials/entrypoints.html); существующая проблема gesture проверена в [Stack Overflow](https://stackoverflow.com/questions/76555077/extension-optional-permissions-request-what-counts-as-a-user-gesture) и [Reddit optional host access](https://www.reddit.com/r/chrome_extensions/comments/1e118cy/).

Ограничения/интеграция для координатора: Firefox runtime, нативное окно approval и toolbar activeTab gesture не проверены; loopback permission для Chromium pre-granted только в собственном временном профиле. Реальные OpenRouter/API/семантическая точность не проверены и платные запросы не запускались. UI не требует изменений чужих исходников; финальную полную приёмку и повтор SPA smoke после исправления фона делает root.


Принято координатором 2026-10-07: общий typecheck/lint PASS, 384 unit tests PASS, обе production builds/manifest checks PASS, 9 Chromium scenarios PASS после последних контрактных правок. Firefox runtime дополняет WI-010; реальная языковая точность не проверена.
