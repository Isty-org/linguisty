# Linguisty — проверка пользовательских логотипов

Автор разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты и фактические проверки указаны ниже. См. [AUTHORS](../AUTHORS.md).

Дата: 2026-10-08, Europe/Moscow. Ответственность: `spec://modules/interface/FEAT-003-controls#design`.

Последнее уточнение — компактный popup без вводного баннера; результат и актуальные размеры пакетов приведены ниже. Первые разделы фиксируют проверку логотипов до этого уточнения.

Было → стало: шапка с одним названием и toolbar со знаком Isty → шапка с логотипом Linguisty, monochrome на paper / brand colors на graphite, и PNG toolbar icons из цветного Linguisty. Оба предоставленных SVG скопированы побайтно без изменения геометрии и цветов. Размер в options 64×64 px, в popup 44×44 px. Знак рядом с доступным текстовым названием декоративен для screen reader. Footer Isty 42×24 px и его 16 локализованных шаблонов сохранены.

## Границы проверенного результата

В общей папке одновременно внедряется CLI-режим WI-021 из другого чата. Общие typecheck/lint на первом прогоне этой задачи остановились на незавершённых CLI ErrorCode и лишнем ChatProvider import; 566 существующих tests прошли. Эти результаты не объявлены успешной приёмкой CLI.

Для проверки логотипов использована отдельная копия последней проверенной версии из `.output/linguisty-0.2.0-sources.zip` от 13:11:26. На неё наложены только логотипы, Brand/CSS, генератор PNG, относящиеся документы и browser assertions. Зависимости подключены junction к общей node_modules, без установки второй копии. Изменения CLI не откатывались; его `.output` и `.wxt` не перезаписывались. Проверенные ZIP названы `linguisty-0.2.0-logo-{chrome,firefox}.zip` и содержат API-версию с новыми логотипами, без незавершённого CLI-режима. Файлы Brand/CSS, генератор и SVG в рабочем проекте совпадают по SHA-256 с проверенной копией.

## Результаты логотипов до удаления баннера

| Проверка отдельной копии | Фактический результат |
|---|---|
| Typecheck / lint | PASS |
| Unit/contract/DOM | 566 PASS, 33 files, максимум 2 workers |
| Packaged Chromium / Firefox UI | 3 PASS; API connection/model/progress/cache с локальным mock, auto/manual languages, RTL, themed logos |
| Локализация / ширина | 16 UI locales в options при 320/390/1280 px; popup при 320/390 px без горизонтального overflow |
| Production builds / resources | Chrome и Firefox PASS; по 21 file и 17 referenced assets; PNG 16/32/48/128 px |
| Chrome build / ZIP | 1 039 979 / 404 164 bytes |
| Firefox build / ZIP | 1 040 142 / 404 248 bytes |
| ZIP payload / duplicates / secrets | Побайтно совпадает с production; одинаковых entry names и ошибок проверки ресурсов/секретов нет |
| Mozilla Add-ons Linter 10.13.0 | Firefox ZIP: 0 errors, 0 notices, 0 warnings |

Paper/graphite options и popup просмотрены визуально. UI не запросил внешние ресурсы, page errors нет. Контраст проверенных текстовых токенов ≥4.5:1; это не полный accessibility audit. Общий UI chunk 568 216 bytes сохраняет прежний Vite warning >500 kB (16 локальных словарей, TD-002); warning не скрыт. Background 75 015 bytes и content script 30 526 bytes совпадают по SHA-256 с предыдущим полным Firefox smoke; полный translation smoke для этого изменения логотипов не повторялся. Browser UI проверяет перевод локальным mock, реальный оплачиваемый provider не вызывался.

## Ресурсы и evidence

Промежуточный и финальный hygiene: suspicious/source duplicates/hash skips 0, прежний `.cache` 203 426 930 bytes / 5 652 files. Firefox собственный working set около 1.02 GB перед закрытием → 0, remainingOwnedProcesses=0, профиль удалён. Chromium profiles закрыты; loopback mocks завершены с activeRequests=0 и pendingTimers=0. Финальный замер: свободная RAM 16 209 674 240 bytes, одна физическая node_modules 193 592 370 bytes; snapshot использует junction к ней. Замер RAM/filesystem не доказывает отсутствие всех возможных утечек.

Автоматическая проверка отклонила recursive cleanup собственного snapshot, а также более узкую попытку удалить только его dependency junction; обе причины — «blocked by policy», подробнее не сообщено. Ничего из этих команд не выполнено. В `test-results/linguisty-rebrand/logo-snapshot/` остаётся 292 files / 7 689 994 bytes и junction к общей node_modules; пакеты и browser reports уже сохранены отдельно. Чужие процессы/кэш не затронуты. Это остаток проверки, а не вторая физическая установка зависимостей.

Evidence: `test-results/linguisty-rebrand/logo-snapshot-source.json`, `test-results/linguisty-rebrand/logos/{manifests-logo,amo-logo,archives-logo,cleanup-logo}.json`, `{unit-logo-snapshot,browser-logo,packaging-logo}.log`; browser reports и screenshots в `logos/linguisty-{rebrand,ui}/`. Hygiene до/во время/после — `test-results/linguisty-rebrand/hygiene-{before,mid,after}-logo.json`.

Ограничения: общая приёмка WI-021 остаётся у его исполнителя; эта проверка её не заменяет. Реальная языковая точность модели, native popup geometry и signed install не проверены.

## Уточнение пользователя: компактный popup

Было → стало: крупный вводный блок между шапкой и языками → сразу выбор языков и управление переводом. Удалены JSX `.popup-intro` и его неиспользуемые CSS rules. Крупный заголовок в options сохранён; Options.tsx для этой правки не менялся. Словари, локализованный footer Isty, logo variants и логика перевода не изменены. В browser test readiness переведён с удалённого заголовка на language controls.

Использована та же отдельная API-копия, без новой установки зависимостей и без изменений общего `.output`/`.wxt` CLI-чата. Typecheck и lint PASS; существующие Popup/Options tests — 37 PASS / 2 files. Packaged UI с local mock и Firefox languages прошли. Chromium language test сначала остановился на сохранении manual→browser: ожидал browser mode/ru-RU, получил прежние manual/sr-Latn-RS. Повтор только этого сценария прошёл. Options production code в копии не менялся; точная причина ранее отмеченного transient расхождения по-прежнему не установлена. Первый неуспешный лог сохранён, он не считается PASS.

Обе production builds прошли: Chrome 1 039 204 bytes, Firefox 1 039 367 bytes; по 21 file и 17 referenced assets. Актуальные `.output/linguisty-0.2.0-logo-{chrome,firefox}.zip` заменяют предыдущие пакеты логотипов: 403 995 / 404 079 bytes. Каждый ZIP побайтно совпадает с соответствующей production build, duplicate entries отсутствуют. Manifest/secrets/assets PASS; Firefox AMO linter 0 errors/notices/warnings. Background/content SHA-256 совпадает с прежним smoke. Общий UI chunk остаётся 568 216 bytes; Vite warning сохраняется.

Новый popup визуально просмотрен. При ширине 390 px в manual-target/idle/Russian UI высота body screenshot 608 → 461 px, выигрыш 147 px; browser-target state имеет дополнительную строку auto и ту же экономию баннера. Settings header проверен существующими браузерными assertions. Это измерение content page, native toolbar geometry отдельно не проверена.

Hygiene после правки: source duplicates/suspicious/hash skips 0, `.cache` не вырос — 203 426 930 bytes / 5 652 files; свободная RAM 14 628 294 656 bytes. Собственные Firefox processes после закрытия — 0, профиль удалён; mock activeRequests/pendingTimers — 0. Ранее запрещённый cleanup snapshot не повторялся; тот же временный snapshot и dependency junction остаются. Новую временную копию не создавали.

Evidence: `test-results/linguisty-rebrand/compact-popup/` — `{archives,geometry}.json`, `compact-popup-{unit,packaging,browser,language-repeat}.log`, `compact-popup-{manifests,amo}.json`, browser reports и screenshots; hygiene — `test-results/linguisty-rebrand/hygiene-{before,mid,after}-compact-popup.json`.
