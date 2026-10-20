# Linguisty v0.4.9 — проверка первого GitHub-релиза

Дата: 2026-10-20, Europe/Moscow. WI-038. Автор и владелец разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты реализации и аудита указаны в [AUTHORS](../AUTHORS.md) и исторических отчётах.

## Было → стало

- Локальный репозиторий не имел коммитов и remote → подготовлена публикация текущей версии 0.4.9 в `Isty-org/linguisty`.
- `.me` и владельцы задач обозначали AI-координатора или отдельные AI-чаты → локальная `.me`: `@tsyzhman`, Никита Цыжман, `human`; все владельцы BOARD и авторство текущей разработки приведены к @tsyzhman по прямому поручению пользователя. Сведения об AI-инструментах и фактические старые результаты не удалены.
- `.gitignore` исключал основные generated folders → дополнительно исключены остальные локальные identity/credential-файлы, private keys, временные файлы и `output/`. `.gitattributes` задаёт текстовые окончания строк и бинарные файлы.
- Metadata не содержала автора и repository URL → package metadata, manifest обеих платформ и README указывают автора и репозиторий.
- Тест приватности сравнивал PII sentinel `250` со случайным UUID и текущим timestamp → legacy fixture использует фиксированный ID и часы; проверка удаления нежелательных полей сохранена. Production-логика журнала не менялась.

Первый прогон действительно завершился 779 PASS / 1 FAIL: случайный UUID начинался с `250`. После исправления тестовых данных полный suite прошёл 780/780. Исходный локальный лог сохранён отдельно; неудачный проход не объявлен успешным.

## Проверки

| Проверка | Результат |
|---|---|
| Typecheck и lint | PASS |
| Vitest, максимум 2 worker | 780 PASS / 50 файлов |
| Native runtime | 15 PASS |
| Manifest/hygiene contracts | 9 PASS |
| Локальные HTML fixtures | 5 PASS |
| Chrome и Firefox production builds | PASS |
| Manifest, permissions, CSP, resources и secret patterns | PASS; по 56 файлов |
| Chrome full smoke | 14 PASS |
| Firefox full smoke | 14 PASS |
| ChatGPT mock Chrome/Firefox | Chrome 1 сценарий PASS; Firefox 8 проверок PASS |
| Long batch Chrome/Firefox | 2 PASS; Firefox HTTP reply 40 046 ms, перевод 40 133 ms, штатная выгрузка через 31 665 ms после завершения |
| Mozilla Add-ons Linter 10.13.0, Firefox ZIP | 0 errors / 0 notices / 0 warnings |
| Direct dependencies и package-lock | 21 версия совпала с установленной |

Команды: `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=2`, `npm run test:native`, `node --test --test-concurrency=2 scripts/check-manifests.test.mjs`, `node scripts/check-fixtures.mjs`, `npm run build:chrome`, `npm run build:firefox`, `npm run check:manifests`. Браузерные команды и методика описаны в [TESTING](TESTING.md).

Runtime: изолированный Chromium 152.0.7977.8 и Firefox 158.0 / geckodriver 0.37.1 через отдельный temporary-профиль. Production packages не патчатся; provider/OAuth ответы подставляются только тестами.

## Артефакты и исходники

Пакеты созданы из проверяемых production-каталогов без повторной сборки. В каждом ZIP побайтно сверены по SHA-256 все 56 файлов, включая manifest с автором и homepage. `SHA256SUMS.txt` содержит контрольные суммы обоих ZIP.

После всех browser runs SHA-256 всех 112 production-файлов совпал с исходным снимком: изменённых файлов 0. Проверены 146 локальных ссылок и 642 ссылки на канон с якорями; ошибок нет. 38 WI имеют уникальные ID, все строки BOARD принадлежат @tsyzhman.

- Chrome: 487 765 B; SHA-256 `2d6d8933696b588d66abeb81e92cfa5c103d8132779ec3b4e966293abfb5897c`.
- Firefox: 487 843 B; SHA-256 `01e32ec0bf2532a86675efdffe13b3ce17871ce2917d8bc942b1d20c32d92a4e`.

Полные исходники и тесты входят в Git tag `v0.4.9`. Локальная `.me`, browser profiles, node_modules, generated builds, credentials и сырые QA-артефакты исключены из Git. Первичный source scan не нашёл секретов вне тестов; четыре совпадения credential-URL в тестах проверены как заведомо фиктивные строки для отказа небезопасным endpoint.

Локальное evidence текущего прохода: `test-results/first-release-2026-10-20/`; browser JSON и screenshots используют существующие каталоги сценариев. Они не включаются в исходники релиза.

Дополнительная диагностика `git diff --cached --check` показала прежние пустые строки в конце ряда файлов и trailing spaces в оригинальных OFL-лицензиях шрифтов. Массовое форматирование и изменение сторонних лицензий не выполнялись. Проверка остальных trailing spaces / space-before-tab проходит; это не заявляется как чистый результат исходной команды.

## Ресурсы и ограничения

Начальный снимок: node_modules 193 594 094 B, `.wxt` 6 713 B, `.output` 23 786 054 B, `.cache` 203 426 930 B, test-results 23 436 592 B. После browser runs: node_modules 193 594 197 B, `.wxt` 6 713 B, `.output` 23 776 730 B. Точных source duplicates, suspicious copies и hash skips нет. Свободная RAM 13 350 580 224 / 34 282 012 672 B; RSS инспектора 63 389 696 B. Это снимок ресурсов, а не доказательство отсутствия любых утечек.

После завершения сценариев связанных с Linguisty helper-процессов не найдено. Firefox mock OAuth и long-batch дополнительно подтвердили `profileRemoved=true`, `remainingOwnedProcesses=0`; long-batch завершился с `pendingTimers=0` и `ownedMemoryAfterBytes=0`. Постоянные watchers или серверы не оставлены.

Старый кэш WI-011 не удалялся. Зависимости не переустанавливались и не очищались; дополнительные platform packages в общей node_modules не изменялись. Тесты не используют watch или платные запросы.

Не проверены: реальный вход ChatGPT и доступность плана для каждого пользователя/распространяемого приложения, реальные платные API и языковая точность, ревью локализаций носителями, фактический запуск на Chrome 120 / Firefox 142, подпись и постоянная установка Firefox, публикация в магазинах. Browser mock не подтверждает эти свойства.
