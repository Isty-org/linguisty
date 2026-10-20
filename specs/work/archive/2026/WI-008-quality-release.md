# WI-008: Проверки, browser smoke и release assets

- Kind: `implement`
- Canon action: `none`

## Outcome

Проект имеет независимые fixture/manifest/resource checks, install assets и честный отчёт о готовности интеграции.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://modules/platform/INFRA-001-extension#acceptance`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- In/owned: `scripts/**`, `tests/fixtures/**`, `tests/e2e/**`, `public/icon/**`, `docs/QA-REPORT.md`, Result этого WI; исключение — `scripts/firefox-smoke.mjs` и `tests/e2e/firefox-*.mjs` принадлежат WI-010.
- Out: production modules/shared/config/lock, чужие tests, specs/BOARD/WAL/archive, root docs.
- scripts/check-manifests.mjs validates .output/chrome-mv3 and firefox-mv3, brand/permissions/CSP/background shape/entrypoint assets/no leaked secrets/no mandatory all_urls.
- scripts/check-hygiene.mjs gives bounded filesystem sizes/duplicate suspicious sources/cache artifacts. Не удалять чужие файлы.
- Assets: create 16/32/48/128 PNG icons using supplied logo.png as visual reference or a clear code-native Linguisty mark. Нельзя показывать другое текстовое название. sharp available, no remote fonts.
- Browser smoke через разрешённый CLI/tool if available, preferably Playwright bundled Chromium; local mock API HTTP localhost допустим, пользовательский key не нужен. Не использовать обычный Chrome profile. Не писать production files для облегчения теста.

## Dependencies

- Depends on: WI-002; fixtures/assets/checks independent; final smoke requires WI-003…WI-007 and coordinator integration.

## Acceptance

- [x] Fixtures недвижимость/динамика/таблица/формы/DOM edge cases добавлены.
- [x] Scripts validate both manifests and report real resource sizes; icons packaged correctly.
- [x] Integration commands и browser smoke выполнены после появления modules; доступные проверки отмечены отдельно от недоступных.
- [x] QA report lists commands/results/limitations, no fictitious real translation quality.
- [x] Нет лишних duplicate modules/cache/watch processes; resources cleanup checked.

## Result

Готово к проверке координатором, 2026-10-07. Исполнитель QA не менял acceptance/BOARD/WAL/archive; принятие WI и продуктовой версии делает координатор. Доступный QA-проход завершён. Зелёный snapshot350+9 относится к версии до заключительных URL/cache-counter правок; окончательный повтор shared checks/builds/full Chromium выполняет координатор. Firefox runtime дополняет отдельный WI-010.

- Было → стало: не было независимых package/resource checks, install icons и fixtures → manifest/hygiene checker,6 regression tests, PNG16/32/48/128 code-native Linguisty «L»,5 HTML fixtures с bounded interaction helpers, loopback mock, isolated browser harness и фактический QA report.
- Owned files/exports: `scripts/check-manifests.mjs` (`inspectBuild`, `checkManifests`), `check-hygiene.mjs` (`checkHygiene`), `check-manifests.test.mjs`, `generate-icons.mjs`, `check-fixtures.mjs`, `browser-preflight.mjs`, `scripts/assets/linguisty-mark.svg`; `public/icon/{16,32,48,128}.png`; `tests/fixtures/{real-estate,dynamic,table,forms,dom-edge-cases}.html`, `fixture.css`, `fixture.js`; `tests/e2e/local-server.mjs` (`startLocalServer`, `translatedText`, `MOCK_KEY`), `browser-runtime.mjs` (`launchIsolatedChromium`), `chromium-smoke.test.mjs`; `docs/QA-REPORT.md`. Firefox-owned files не изменялись.
- Independent checks: icons PASS; node manifest/hygiene tests6/6 PASS; fixtures5/5 PASS (jsdom structure/interactions, не extension translation). Пройденный global snapshot до заключительных правок: typecheck PASS, lint PASS,350 unit tests/17 suites PASS; maxWorkers2, no watch.
- Both builds/package checks PASS: Chrome341937 bytes, Firefox342100 bytes, each13 files/12 referenced assets. MV3/brand/permission/CSP/platform background/minimum versions/data consent/assets/known secrets/dev markers checked; arbitrary secret absence не доказана эвристикой. `.output` total684037 bytes.
- Full real Chromium extension smoke PASS для проверенного пакета до заключительных правок:9 scenarios + parent =10 Node tests, no skipped/failed, `observations.json.ok:true,fullSmoke:true`. Chromium152.0.7977.8 (cached bundled revision1237) with Playwright1.63.0 and explicit executable. Isolated profile/unmodified production build/local-only provider, no real key/paid requests. Tested UI→background→content pipeline, viewport order, forms/gallery/links/DOM identity/whitespace, toggle/resume/reopen, exclusions/placeholder tokens/text-only HTML, dynamic/external mutation/SPA, cache/model isolation, real worker stop/recovery/new batch,401/429/malformed/unknown IDs/retry/redaction,cancel/late reply/tab close,light/dark/system/labels/focus/reduced-motion preference/restricted page.
- Found defects были переданы конкретным владельцам через report/Result: SPA loading event removed same-document session; malformed raw authority `https://@example.com/v1`; early WXT path/lint/hoisting defects. Исправлены владельцами production, targeted/full checks перепроведены после новых изменений; final SPA/unit checks PASS. QA не правил production/shared/config/lock/чужие tests.
- Evidence: `test-results/linguisty-smoke/observations.json` + translated fixture/options theme screenshots (5 files877597 bytes). Latest mock52 requests/max concurrent2/active0/timers0/page errors0. Temporary browser/server/CDP/listeners clean in finally. Post-run process/profile check: own Node0, isolated Chromium0, temporary profiles0.
- Final hygiene PASS: node_modules193585466 bytes/.wxt6390/.output684037; source snapshot86 files505412 bytes/duplicates0/suspicious0/hashSkipped0. RAM total34282012672/free16774664192; inspectorRSS64217088/heap8835024. Это snapshot, не proof of leak absence. Временный local cache находится в удаляемом test profile; чужой кэш/процессы/artifacts не удалялись.
- Limitations: installed driver default Chromium1243 отсутствует, поэтому cached1237 задан явно; matching runtime при необходимости устанавливает координатор. Native toolbar activeTab + native permission approve/deny не проверены: loopback access configured через isolated developerPrivate + permissions.request, popup inactive tab. Firefox build PASS не равен Firefox runtime PASS; WI-010 владеет отдельным Firefox harness/report. Real OpenRouter/semantic translation/latency/cost без key и отдельного задания не проверены. Полная UI state/mobile/contrast matrix не заявляется проверенной.
- Integration notes: дополнительные dependencies/config для own QA не требуются; npm install не выполнялся. Release runner координатора должен явно вызвать independent node tests и Chromium smoke (они намеренно вне Vitest); commands/results/limitations находятся в QA report. После результата WI-010 общий QA report можно дополнить ссылкой на `docs/FIREFOX-QA.md`, без дублирования Firefox harness. Координатор выполняет финальные shared checks/zip и принимает результаты.
- Final handoff: root review добавил URL one/no-slash+userinfo boundary и exact mixed-batch cache counter после изменений/удаления DOM nodes. Optional `cacheHitIds` уже в shared contract/PROP-001; storage/engine/content владельцы реализуют fixes/regressions. QA не объявляет новые правки проверенными и не повторяет tests/builds/smoke параллельно координатору. Окончательный прогон после этих изменений выполняет root.
- Handoff hygiene PASS: duplicates/suspicious/hashSkipped0; node_modules193585452/.wxt6390/.output685293/shared test-results1820913 bytes; source87 files527467 bytes. `.cache`3 files5855605 bytes теперь содержит WI-010 Firefox driver и не удалялся QA. RAM free16252194816, inspectorRSS64143360/heap8968792. Это отдельный resource snapshot, не подтверждение новых сборок/runtime.


Принято координатором 2026-10-07: общий typecheck/lint PASS, 384 unit tests PASS, обе production builds/manifest checks PASS, 9 Chromium scenarios PASS после последних контрактных правок. Firefox runtime дополняет WI-010; реальная языковая точность не проверена.
