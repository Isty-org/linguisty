# Linguisty 0.3.0 — фактическая проверка CLI

Автор разработки: Никита Цыжман ([@tsyzhman](https://github.com/tsyzhman)); AI-инструменты и фактические проверки указаны ниже. См. [AUTHORS](../AUTHORS.md).

Дата: 2026-10-08. WI-021. Дополняет предыдущий [QA-REPORT](QA-REPORT.md), не заменяет его исторические результаты.

Было: только OpenRouter/OpenAI-совместимый API с ключом. Стало: дополнительно четыре установленных CLI через автоматически запускаемый Native Messaging соединитель; интерфейс расширения, прежние API, кэш и восстановление оригинала сохранены.

## Выполнено

| Проверка | Фактический результат |
|---|---|
| TypeScript / ESLint | PASS |
| Vitest | 589 PASS, 37 файлов, максимум 2 worker |
| Node native tests | 15 PASS: frame/Unicode/лимиты, queue/cancel/timeout/disconnect, Windows cmd/ps1 shim resolution, четыре subprocess adapters и cleanup |
| Manifest checker tests | 8 PASS |
| Chrome и Firefox builds / ZIP | PASS, версия 0.3.0 |
| Manifests / секреты / локальные assets | PASS, по 21 файлу, required permissions прежние, optional nativeMessaging |
| Mozilla addons-linter | 0 errors, 0 notices, 0 warnings |
| Chrome API/UI + native smoke | 16 PASS; Chromium 152.0.7977.8 |
| Firefox API regression smoke | 14 PASS; Firefox 157.0.1 |
| Firefox native smoke | 5 checks PASS: штатный optional grant, keyless save, presence и четыре page translations |
| Hygiene | PASS, исходных дубликатов и подозрительных копий нет |

Windows installer фактически запущен: собственные manifests зарегистрированы в HKCU, файлы скопированы в LocalAppData/Linguisty/native-host. Реальный Native Messaging status обнаружил Codex из desktop установки и Grok Build. Claude Code и Antigravity CLI не найдены через поддержанные пути в этом окружении. Проверка присутствия не выполняла inference.

Для Chrome native transport использована **отдельная временная копия** пакета с nativeMessaging в required permissions: безоконный Chromium не управляет собственным native approval bubble. JavaScript/assets не менялись; производственный manifest сохраняет optional permission. Попытка grant через временные preferences не пережила повторную загрузку unpacked extension и не считается успешной. Основные Chrome API/UI scenarios работали с неизменённым production пакетом.

Firefox native scenario использует **неизменённый пакет** и штатное optional разрешение, принятое кнопкой реального prompt через privileged область изолированного test driver.

Native page translations обоих браузеров — детерминированный host fixture, ответы четырёх CLI subprocess adapters — локальные Node fixtures. Они проверяют канал, framing, запуск, строгие IDs и page pipeline, **не подтверждают** совместимость живого аккаунта или качество модели.

Evidence: test-results/linguisty-native/chrome.json, firefox.json, cli-options.png; test-results/linguisty-smoke/observations.json; test-results/linguisty-firefox/observations.json; test-results/linguisty-ui/observations.json.

## Ресурсы

Client и host ограничены 16 pending, CLI inference последовательно, frame 900 KiB, stdout 4 MiB, stderr 32 KiB. Проверены 30 connect/reply циклов без накопления timers/listeners; 100 отмен очереди без удержания текста; реальные fixture children завершились и удалили собственные temp workspaces. Кэш/dedup повторных CLI запросов проверены через существующий engine.

После браузерных проверок найдено **0** процессов созданного соединителя/CLI fixtures, нет созданных этой задачей temp CLI/native/Chromium directories. Firefox driver фиксирует 0 принадлежащих ему процессов и удаление своего profile. Чужие процессы и кэш не очищались.

Последний замер до записи отчёта: node_modules 193 592 668 B; .wxt 6 664 B; .output 8 136 550 B; .cache 203 426 930 B; test-results 17 421 351 B; свободная RAM 14 913 101 824 / 34 282 012 672 B. Во время Firefox run .cache росла из-за временного profile, затем вернулась к прежним 203 426 930 B. Эти числа — наблюдения, не доказательство отсутствия всех утечек. Остатки WI-011 и отдельного UI snapshot сохранены.

Общий UI chunk 586 435 B вызывает предупреждение Vite >500 kB; предыдущий API chunk с логотипами был 568 216 B. Предупреждение не скрыто; компромисс записан в TD-002.

## Пакеты

| ZIP | Размер | SHA-256 |
|---|---:|---|
| .output/linguisty-0.3.0-chrome.zip | 413 183 B | 21458db533a9b965a007b890b6afe4d85106e278c243627f80e85e070c40017c |
| .output/linguisty-0.3.0-firefox.zip | 413 266 B | d9c1387ed28f578b258f43f1efb5e823eb6a24132a00bfeea69043a74dba550d |
| .output/linguisty-0.3.0-cli-helper.zip | 11 932 B | 0799c92e46655a62c74a290ae1ad6ad968606da7f2a5a5288eebe0dca0139c81 |

CLI installer ZIP содержит только 7 runtime/installer файлов и LOCAL-CLI.md, без Node, сторонних CLI, токенов или пользовательских config.

## Воспроизведение и границы

Основные команды: npm run typecheck, npm run lint, npm test, npm run test:native, node --test --test-concurrency=2 scripts/check-manifests.test.mjs, npm run zip:chrome, npm run zip:firefox, npm run zip:cli, npm run check:manifests, npm run check:hygiene.

Для доступного Chromium задайте LINGUISTY_CHROMIUM_EXECUTABLE=C:/Users/Nik/AppData/Local/ms-playwright/chromium-1237/chrome-win64/chrome.exe; node --test --test-concurrency=1 tests/ui/browser-ui.test.mjs tests/e2e/chromium-smoke.test.mjs tests/e2e/native-chrome.test.mjs. Firefox: node scripts/firefox-smoke.mjs и node tests/e2e/native-firefox.mjs. Native smoke устанавливает host и временно подменяет только его собственную registration; fixture registration восстанавливается после закрытия test browser.

Живые ответы всех четырёх инструментов, авторизация, язык/качество/скорость моделей и расходы аккаунта **не проверены**. Не проверены физическое Chrome подтверждение native permission, toolbar-only activeTab, signed/store install, minimum-version browsers, macOS/Linux installer и аварийное завершение всего компьютера. Отмена не гарантирует отмену расходов в облаке. CLI может самостоятельно вести историю.
