# WI-016: Устойчивое открытие интерфейса расширения

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Popup и настройки открываются при медленном старте фона и отказе кэша; ожидание ограничено, при ошибке доступны повторная загрузка и понятное сообщение.

## Specs

- Governing / Affected: `spec://modules/interface/FEAT-003-controls#errors`
- Governing / Affected: `spec://modules/platform/INFRA-001-extension#recovery`
- Constraint: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In: bounded messaging/retry, независимая загрузка настроек/кэша, восстановление фона, bootstrap/render fallback, unit/UI/browser checks.
- Out: платные API-запросы и обход browser CSP.

## Acceptance

- [x] Зависание кэша воспроизводится тестом; оно не блокирует форму настроек.
- [x] Медленный/недоступный фон завершает ожидание понятной ошибкой; read-only команды допускают ограниченный retry, mutations не дублируются.
- [x] Отказ восстановления session snapshots не блокирует настройки и persistent secret status.
- [x] React/bootstrap сбой показывает доступный fallback вместо пустого окна.
- [x] Повторные открытия/unmount освобождают listeners и timers; late replies не заменяют новое состояние.
- [x] Typecheck/lint/tests, обе сборки и browser smoke выполнены; ресурсы и дубли проверены.

## Result

Было → стало: cache stats и session restore блокировали конфигурацию, чтения не имели deadline → форма независима от stats, конфигурация независима от snapshots, reads ограничены 5s, transient transport имеет один retry, mutations не повторяются. Abort при закрытии UI снимает ожидание/таймеры пользовательских действий; late replies не меняют новую загрузку. HTML startup fallback и React boundary дают безопасное сообщение с reload без raw error/form values.

Unit regression сначала подтвердил зависшую форму, затем прошёл с независимой загрузкой. Отдельный packaged Chromium run подтвердил pending cache, первый missing receiver и pending settings → timeout/error/retry → восстановленная форма. Typecheck/lint, 417 unit/contract/DOM tests/20 suites (<=2 workers), 7 manifest/hygiene tests и 5 fixtures PASS. Обе production build/ZIP/byte comparison, полный Chromium pipeline/UI/startup (12 Node tests с parent), 10 Firefox groups и 2 Firefox key lifecycle scenarios PASS. Mozilla package validation: 0 errors/notices/warnings. Evidence: test-results/linguisty-ui-startup/, стандартные browser reports и docs/QA-REPORT.md.

После unmount нет transport timers/listeners; браузерные lifecycle checks подтверждают zero observers/timers/snapshots после завершения сессий, 0 активных mock requests и оставшихся собственных Firefox processes. RAM/filesystem snapshot и отсутствие source дублей проверены отдельно; чужие процессы и старый WI-011 cache не удалялись. Непроверенные signed install, browser executable upgrade и live provider оставлены явными в отчёте.
