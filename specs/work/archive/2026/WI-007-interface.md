# WI-007: Linguisty interface

- Kind: `implement`
- Canon action: `none`

## Outcome

The user configures their service/key/model and translates a page through working popup/options in Cloud Day/Cloud Night themes.

## Specs

- Governing: `spec://modules/interface/FEAT-003-controls#root`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#ui`

## Scope

- In/owned: `src/ui/**`, `entrypoints/popup/**`, `entrypoints/options/**`, `tests/ui/**`, this WI's Result.
- Out: shared/config/lock, storage/providers/cache/background/content, public assets/scripts, docs/BOARD/WAL.
- UI React, shared sendMessage<T> and RuntimeMessage. Export bootstraps use createRoot, no inline scripts. Import constants/contracts rather than duplicates. Browser permission request occurs on user gesture before privileged call. Permission denial and empty key behavior strictly follows the specs.
- Take theme CSS from DESIGN §4.5; supplied docs/design/assets/original-logo.png may be used as a mark; product is always Linguisty. Do not load remote fonts/scripts.

## Dependencies

- Depends on: WI-002; integration WI-006.

## Acceptance

- [x] Popup progress/translate/cancel/original/translation/status reopen works.
- [x] Options providers/baseURL/key modes/manual model/discovery/test/save/remove/cache implemented.
- [x] Permission denial and invalid settings do not produce false success; no key prefill/logging.
- [x] Light/dark/system, labels/keyboard/focus/reduced motion, and responsive options checked.
- [x] Own interaction tests and available type/lint checks are completed; no timers/subscriptions leaks.

## Result

Ready for coordinator acceptance. Canon action: none. BOARD/WAL/shared/config/dependencies/others' sources were not changed.

Before → after: popup/options did not exist → two working Linguisty React screens with Cloud Day/Cloud Night/system, own service configuration, and control of the real tab session. Latest synchronization per coordinator instruction: API key limit 8192 → 4096 characters and `maxLength=4096` on the password input.

Implemented:

- Popup: source/target, real provider/model, onboarding, START/CANCEL/SET_DISPLAY_MODE/GET_TAB_STATE, progress recovery on open, event filtering by tabId, protection from late snapshots, original text/translation, readable errors, and a separate settings link for key/model errors. Partial failures are explicitly displayed with the localized message meaning “Translation finished with errors.” A normal completed screen fits in approximately 600 px; manual status refresh is available while working/on error.
- Options: OpenRouter/OpenAI-compatible, HTTPS/loopback endpoint, password without prefill, session/persistent, manual model, bounded discovery/search/selection, test/save/remove key, source/target BCP 47, style, instructions, theme, real cache stats/clear. An empty key is not sent and preserves the existing one; the entered key is cleared after successful save. Permission request is called synchronously from click/submit before the first await; denial does not send SAVE_SETTINGS/TEST_CONNECTION/LIST_MODELS.
- UI uses only shared contracts/constants/errors/messaging and browser API. Secret/provider/cache helpers are not imported. No remote fonts/CDN/inline scripts; supplied `/icon/48.png` used.
- CSS semantic tokens taken from DESIGN §4.5, 44 px controls, native labels/keyboard/focus-visible, aria-live/error, reduced motion, responsive options. Theme hint in localStorage contains only the theme; preview does not save settings without Save.
- Model list bounded by MODEL_MAX_ENTRIES, duplicate IDs removed, up to 40 results shown simultaneously. Popup listener and matchMedia subscription removed on unmount; no polling/watch/timers in UI.

Files and exports:

- `src/ui/Popup.tsx`: Popup; `src/ui/Options.tsx`: Options.
- `src/ui/components.tsx`: Brand, Notice/NoticeData, FieldError, LanguageSelect, LANGUAGES, formatBytes.
- `src/ui/settingsForm.ts`: API_KEY_INPUT_MAX_LENGTH, FormErrors, providerUrl, normalizedForm, validateForm, requestProviderPermission.
- `src/ui/theme.ts`: applyTheme, applyInitialTheme, rememberTheme, useTheme; `src/ui/styles.css`: shared Cloudline UI.
- `entrypoints/popup/{index.html,main.tsx}`, `entrypoints/options/{index.html,main.tsx}`: external createRoot bootstraps; options opens in a separate tab.
- `tests/ui/{Options.test.tsx,Popup.test.tsx,theme.test.tsx,browserMock.ts,browser-ui.test.mjs}`: own interaction/lifecycle/native UI checks; shared QA browser/server helpers used without copying.

Actual checks:

- `node node_modules/vitest/vitest.mjs run tests/ui --maxWorkers=2`: PASS, 3 files / 23 tests after the final 4096 fix. Covers permission denial, invalid endpoint, empty/replaced/too-long key, modes, false connection result, failed discovery + manual model, model bounds/dedup/search/keyboard, key removal, cache failure/clear, status reopen/cancel/toggle/late snapshot/partial errors/repeated mount cleanup, system theme cleanup.
- `node node_modules/eslint/bin/eslint.js src/ui entrypoints/popup entrypoints/options tests/ui`: PASS.
- `node node_modules/typescript/bin/tsc --noEmit`: PASS after the final fix. Earlier errors in others' background/translation/cache modules were resolved by their owners by the latest run.
- `npm run build:chrome`, `npm run build:firefox`: PASS after the final fix; `npm run check:manifests`: PASS for both, 13 files / 12 referenced assets; sizes 342565 / 342728 bytes on the latest run.
- `LINGUISTY_CHROMIUM_EXECUTABLE=C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe` + `node --test tests/ui/browser-ui.test.mjs`: PASS in Chromium 152.0.7977.8 for UI before the latest maxlength synchronization. Real packaged options/popup → background → loopback mock: connection/discovery/search/save/key migration/remove/cache clear/status reopen; both themes; 320/390 px without horizontal overflow; controls >=44 px; keyboard focus ring; system changes/reduced motion; 0 page errors. Latest maxlength fix separately verified by an interaction test with 4097 characters.
- Screenshots and factual report: `test-results/linguisty-ui/` (7 PNG + observations.json). Images reviewed; final screenshots captured after CSS transitions completed.
- Overall `tests/e2e/chromium-smoke.test.mjs` passed UI/pipeline/restore/cancel/themes when run but failed SPA route-reset on untranslated “Maisons disponibles à Nantes.” The coordinator reported that the background owner was fixing SPA; this was not declared successful and the overall scenario requires a final repeat by root.

Resources/duplicates:

- `npm run check:hygiene`: PASS; at the checkpoint node_modules 193585435 bytes, .wxt 6390 bytes, available RAM about 15 GiB. Own UI source about 54 KB; tests about 35 KB; review artifacts about 0.94 MB, in ignored test-results.
- Latest native report: activeRequests=0, pendingTimers=0; local mock server closed, isolated browser profile removed. Remaining process check for `tests/ui/browser-ui.test.mjs`: 0. Others' cache/processes were not deleted. Repeatable mount/unmount demonstrates UI subscription removal; a RAM snapshot alone is not claimed as proof of no leaks.

Research before implementation: [MDN permissions.request](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request), [Chrome permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions), [React Effect cleanup](https://react.dev/reference/react/useEffect), [WXT entrypoints](https://wxt.dev/guide/essentials/entrypoints.html); existing gesture issue checked on [Stack Overflow](https://stackoverflow.com/questions/76555077/extension-optional-permissions-request-what-counts-as-a-user-gesture) and [Reddit optional host access](https://www.reddit.com/r/chrome_extensions/comments/1e118cy/).

Limitations/integration for the coordinator: Firefox runtime, native approval dialog, and toolbar activeTab gesture were not checked; Chromium loopback permission was pre-granted only in the own temporary profile. Real OpenRouter/API/semantic accuracy were not checked and no paid requests were made. UI requires no changes to others' sources; root performs final full acceptance and repeats SPA smoke after the background fix.


Accepted by the coordinator on 2026-10-07: overall typecheck/lint PASS, 384 unit tests PASS, both production builds/manifest checks PASS, 9 Chromium scenarios PASS after the latest contract changes. Firefox runtime is supplemented by WI-010; real language accuracy was not tested.
