# Firefox runtime QA — WI-010

Автор разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты и фактические проверки указаны ниже. См. [AUTHORS](../AUTHORS.md).

После узкой правки footer Isty повторён packaged language/form scenario — PASS, Mozilla validation Firefox ZIP — 0 errors/notices/warnings. Full translation smoke ниже выполнен до footer; background/content hashes не изменились. Актуальные размеры и screenshots — в [QA-REPORT](QA-REPORT.md).

Актуальная версия **0.2.0 после Retro Orbit**, 2026-10-08: Firefox 157.0.1 / geckodriver 0.37.1 — **14 PASS / 0 FAIL**, включая шрифт, журнал, SSE и большой/inline DOM. Package index до/после: `02261dbf583fc49e9f016fc5e14f78d36bcc64238aa8c11bc779c11e6e1812ec`. Отдельный packaged language scenario прошёл browser default uk-UA, Arabic RTL, manual sr-Latn-RS/English save/reopen и return-auto через настоящую форму. Mock active requests/timers и remainingOwnedProcesses после cleanup 0, профили удалены. Firefox ZIP: Mozilla Add-ons Linter 10.13.0 — 0 ошибок/предупреждений. Это не оценка реального API или ревью носителями всех языков. Итоговые размеры/ограничения и evidence — [QA-REPORT](QA-REPORT.md).

До редизайна та же версия 0.2.0: 13 PASS / 0 FAIL; первый локальный mock translation 136 ms, full 2527 ms, regular 2519 ms. Package index `ec4a586df53bcb6c91c73f471397f1da25d64b8b4a8f7cdf19a4892094edca09`. Key lifecycle — 2 PASS, оба профиля удалены; после редизайна отдельный lifecycle run не повторялся.

Предыдущая версия 0.1.1 (WI-015/WI-016), 2026-10-08: Firefox 157.0.1 — 10 PASS/0 FAIL; отдельный key lifecycle — 2 PASS. `node tests/e2e/firefox-key-lifecycle.mjs` проверяет настоящие reload, установку higher-version temporary package с тем же ID и browser exit/start в одном собственном профиле. Local ключ сохранился после повторной temporary установки и с обычными, и с preservation preferences. Preferences меняются только в созданном тестом профиле; user profile не используется. После cleanup собственных Firefox/driver процессов нет, оба профиля удалены. Подписанный permanent install и обновление Firefox executable не проверены. Актуальные hashes/ограничения — в [QA-REPORT](QA-REPORT.md).

Ниже сохранена история 0.1.0.

Метод и исторические результаты WI-010 ниже сохранены. После WI-011 текущая сборка повторно проверена на Firefox 157.0.1: 10 PASS/0 FAIL; `observations.json` содержит этот новый run. Актуальные package hash, Mozilla validation и ограничения cleanup находятся в [QA-REPORT](QA-REPORT.md).

Проверка 2026-10-07 использует установленный Firefox 157.0 и geckodriver 0.37.1. Исходный production-каталог `.output/firefox-mv3` устанавливается temporary add-on без изменения manifest, CSP, разрешений или JavaScript. Это проверка runtime, а не подписи или публикации в AMO.

Полный проход исполнителя 07.10.2026 11:17:52–11:18:33 МСК: **10 PASS, 0 FAIL**, exit code 0. Проверенный package snapshot до/после: `78dbc619cdfa64dd39ce225a719dfd34277edf407aa54518dd24363f1b55ba26` (13 файлов, 343 380 bytes). После cleanup: 0 собственных Firefox/driver процессов, профиль удалён, 0 active mock requests и 0 pending mock timers. Production-дефектов в проверенном scope не выявлено; перечисленные ниже ограничения остаются непроверенными.

После snapshot исполнителя координатор исправил UI raw-authority/C0/DEL validation и background model limit 200, пересобрал production и самостоятельно повторил полный smoke. **Завершающий run WI-010 11:28:32–11:29:15 МСК: 10 PASS, 0 FAIL**, 13 файлов / **343 812 bytes**, SHA-256 index **62487cf6ef6281404c884a84ab91c2a50e3d6795d14639a5fb52d495fc8e5c3c** до/после одинаков. После закрытия remainingOwnedProcesses=0, profileRemoved=true, activeRequests/pendingTimers=0. Это исторические snapshots WI-010; текущий package и evidence указаны выше.

## Воспроизведение

Из корня Linguisty, с существующей общей `node_modules` и готовой Firefox production-сборкой:

```powershell
node scripts/firefox-smoke.mjs
```

Драйвер по умолчанию: `.cache/firefox-qa/driver/geckodriver.exe`. Браузер по умолчанию: `%LOCALAPPDATA%/Mozilla Firefox/firefox.exe`. Для явно выбранных локальных executable поддерживаются `LINGUISTY_FIREFOX_EXECUTABLE` и `LINGUISTY_GECKODRIVER`; новый браузер или npm dependencies тест не устанавливает. `LINGUISTY_FIREFOX_SMOKE_FILTER` оставляет onboarding, подходящие проверки и сравнение package hash; такой запуск сохраняет отдельный `observations-focused-*.json` и не заменяет полный отчёт.

Для восстановления локального драйвера использовать только [официальный release Mozilla 0.37.1](https://github.com/mozilla/geckodriver/releases/tag/v0.37.1):

```powershell
$firefoxQaRoot = Join-Path (Get-Location).Path '.cache/firefox-qa'
New-Item -ItemType Directory -Path $firefoxQaRoot -Force | Out-Null
$firefoxQaRoot = (Resolve-Path -LiteralPath $firefoxQaRoot).Path
$firefoxQaRelease = Invoke-RestMethod 'https://api.github.com/repos/mozilla/geckodriver/releases/tags/v0.37.1'
$firefoxQaAsset = $firefoxQaRelease.assets | Where-Object name -eq 'geckodriver-v0.37.1-win64.zip'
$firefoxQaArchive = Join-Path $firefoxQaRoot 'geckodriver-v0.37.1-win64.zip'
Invoke-WebRequest -Uri $firefoxQaAsset.browser_download_url -OutFile $firefoxQaArchive
$firefoxQaHash = (Get-FileHash -LiteralPath $firefoxQaArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($firefoxQaAsset.digest -ne "sha256:$firefoxQaHash") { throw 'Official release digest mismatch.' }
Expand-Archive -LiteralPath $firefoxQaArchive -DestinationPath (Join-Path $firefoxQaRoot 'driver') -Force
@{ name=$firefoxQaAsset.name; url=$firefoxQaAsset.browser_download_url; digest=$firefoxQaAsset.digest; verifiedSha256=$firefoxQaHash; bytes=$firefoxQaAsset.size } |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $firefoxQaRoot 'driver-source.json')
if ((Split-Path -Parent $firefoxQaArchive) -ne $firefoxQaRoot) { throw 'Unowned archive path.' }
Remove-Item -LiteralPath $firefoxQaArchive
```

Проверенный SHA-256 архива: `dfed9315abe8d2fbc1b6161a2ee8002452e79cf05ee92fdc653a4e26bc35edd8`. После распаковки архив удаляется; бинарник и source metadata остаются для следующего запуска. Финальную production-сборку делает координатор отдельно; smoke не запускает сборку и не записывает в `.output`.

## Метод и доказательства

`tests/e2e/firefox-runtime.mjs` использует прямой WebDriver HTTP, поэтому Selenium dependency не нужна. Каждый запуск создаёт новый `.cache/firefox-qa/profile-*`; geckodriver и Firefox запущены скрыто/headless, remote endpoint слушает только `127.0.0.1`. Ни существующий пользовательский профиль, ни посторонние Firefox/Node процессы не используются и не закрываются.

`--allow-system-access` включён только у test driver: Firefox chrome scope нужен для доверенного открытия options/popup и управления реальным optional-host prompt. Это [документированный режим Firefox UI testing](https://firefox-source-docs.mozilla.org/testing/geckodriver/Flags.html#allow-system-access). Host permission не добавляется в manifest и не назначается напрямую через внутренний permission store: production options вызывает `permissions.request`, тест сначала отклоняет, потом разрешает настоящий Firefox prompt его кнопкой. В headless Firefox WebDriver click на native `moz-button` оказался `element not interactable`; harness вызывает `.click()` этой кнопки в chrome scope после anti-click-through delay. Физическое нажатие пользователем остаётся отдельной проверкой.

Popup открывается доверенной неактивной extension-вкладкой над выбранной fixture. Он использует production-разметку, обработчики и реальный фон. Условия для native toolbar/activeTab-only gesture этим способом не подтверждены: выданное через options API-origin разрешение покрывает loopback fixture.

Переиспользован `tests/e2e/local-server.mjs` и существующие HTML/CSS/JS fixtures. Mock слушает случайный loopback port, проверяет Authorization и bounded input, возвращает детерминированные тексты и ошибки; внешние API не вызываются. Test credential не является пользовательским ключом и не выводится в evidence. Ошибки отчёта и driver log редактируются на случай его появления.

Основное evidence: `test-results/linguisty-firefox/observations.json`. В нём есть версия runtime, package manifest/file SHA-256 до/после, результаты сценариев, bounded cache stats, lifecycle counters, RAM samples и finally cleanup. Screenshot evidence: `real-estate-translated.png`, `spa-translated.png`, `options-light.png`, `options-dark.png`, `options-system.png`, `popup-system.png`. Эти производные файлы не являются production assets.

## Сценарии

| Проверка | Наблюдаемое поведение |
|---|---|
| Onboarding/options | Без ключа виден onboarding; отказ optional-host prompt сохраняет прежние settings и отсутствие ключа; разрешение сохраняет локальный gateway, manual model, очищает password input; connection/model discovery проходят через mock |
| Production popup pipeline | Popup → background → injected page → mock → Text nodes; viewport обрабатывается раньше far content; числовые значения, whitespace, DOM references, введённые form values, gallery и submit listeners сохраняются |
| Original/resume | Точный оригинал восстанавливается без сети; вставка в original mode остаётся исходной; возврат translated обрабатывает новые узлы; own mutations не вызывают повторяющиеся запросы; повторное открытие popup сохраняет реальный progress |
| Dynamic/SPA | Внешняя правка становится новым original; вставленные и удалённые узлы учитываются; history route создаёт новый sessionId, перевод и provider context с новым title |
| Cache | Повтор той же таблицы не делает запросов; fully cached `fromCache` равен числу translated nodes; смена модели делает запрос; stats bounded; clear без провайдера обнуляет entries |
| DOM/security | Исключения hidden/editable/code/URLs/email соблюдены; placeholders сохранены; ответ с HTML показывается буквальным текстом и не создаёт img/script execution |
| Errors | 401, 429, malformed JSON и unknown node IDs дают соответствующие public errors без сырого mock response/credential; restricted `about:config` отвергается |
| Resources | Три цикла start/cancel/close; повторный inject не умножает observers/listeners; cancel обнуляет content timers/observers и mock requests/timers; закрытые вкладки удалены из session snapshots |
| Secrets | session/persistent перенос оставляет ровно одну копию; UI public responses не содержат ключ; content GET_SETTINGS/GET_SECRET_STATUS отвергнуты; удаление очищает обе области |
| Themes/accessibility | Light/dark/system применяются в настоящих options, поля имеют labels, Tab с model переводит фокус к discovery button, popup progress использует aria-live |

Точные PASS/FAIL и SHA-256 относятся к конкретному запуску в JSON. Нельзя переносить PASS старого package на новую сборку без повторного smoke.

## Ресурсы и границы вывода

Resource probe ставится в isolated content world до production injection. Он учитывает `setTimeout`/`clearTimeout`, MutationObserver/IntersectionObserver и page listeners; производственные файлы остаются неизменными. Нативные observer subclasses в Firefox не сохранили перехваченные методы, поэтому probe использует JS-обёртку с передачей вызовов настоящему observer. Нулевые счётчики после cancel проверяются только после ненулевой активности. Bootstrap pagehide listener сохраняется до закрытия документа и не считается утечкой отменённой сессии.

Finally удаляет только профиль с проверенным родителем `.cache/firefox-qa` и префиксом `profile-`; закрывает WebDriver session и захваченные собственные PID; закрывает local mock и проверяет `activeRequests=0`, `pendingTimers=0`. Working set и доступная RAM фиксируются при установке, после pipeline, после трёх lifecycle и cleanup. RAM snapshots сами по себе не доказывают отсутствие всех утечек. Cache TTL/LRU/50 MiB eviction и отказ IndexedDB в этом runtime smoke не моделируются; они требуют соответствующих contract/unit tests.

Не проверено: signed-install/AMO, installation-time data consent, физический native permission/toolbar gesture, activeTab-only на внешнем сайте без постоянного host grant, настоящая popup geometry, реальный provider/лингвистическая точность, полный WCAG/contrast/reduced-motion audit и перезапуск browser с проверкой жизни session key. Не считать эти пункты PASS.

## Исследование до реализации

Форумы изучены как источники известных проблем; API решения подтверждены Mozilla:

- [Reddit: Selenium и отдельный Firefox profile](https://www.reddit.com/r/learnpython/comments/gifr92/) — подтверждает необходимость различать test instance и пользовательский профиль.
- [Stack Overflow: temporary add-on через geckodriver](https://stackoverflow.com/questions/54754945/how-to-install-extension-permanently-in-geckodriver/54807581) — отправная точка installAddon.
- [Mozilla geckodriver profiles](https://firefox-source-docs.mozilla.org/testing/geckodriver/Profiles.html) — новый профиль, scoped TMP/TEMP и явное удаление session.
- [Mozilla geckodriver flags](https://firefox-source-docs.mozilla.org/testing/geckodriver/Flags.html) — loopback binding и chrome-context UI testing.
- [Mozilla Marionette API](https://firefox-source-docs.mozilla.org/python/marionette_driver.html) — chrome/content contexts и automation primitives.
- [Mozilla Bug 1959376](https://bugzilla.mozilla.org/show_bug.cgi?id=1959376) — получение настоящего extension URL через WebExtensionPolicy.
- [Mozilla temporary installation limitations](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/#limitations) — temporary install не воспроизводит installation-time permission/data-consent prompts.
- [MDN content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts) — Firefox isolated scope и Xray; harness не внедряется в MAIN world.

Ответственные спеки: `spec://common/PROP-002-quality#checks`, `#resources`, `#hygiene`; `spec://modules/platform/INFRA-001-extension#root`; `spec://modules/page/FEAT-002-page-translation#sessions`; `spec://modules/interface/FEAT-003-controls#options`.
