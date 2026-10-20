# WI-013: Подробные ошибки OpenRouter/API в настройках

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

В настройках пользователь открывает локальный журнал ошибок и видит, что именно сообщил OpenRouter или совместимый API, чтобы понять причину отказа перевода или проверки подключения.

## Specs

- Governing: `spec://modules/translation/FEAT-001-engine#errors`
- Governing: `spec://modules/interface/FEAT-003-controls#options`
- Constraint: `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/translation/FEAT-001-engine#errors`
- Affected: `spec://modules/interface/FEAT-003-controls#errors`
- Affected: `spec://common/PROP-001-contracts#messages`
- Affected: `spec://modules/platform/INFRA-001-extension#errors`
- Affected: `spec://modules/storage/INFRA-002-local-data#root`

## Scope

- In: извлечение диагностических полей в provider/background, ограниченное локальное хранение и раздел журнала в options; просмотр, копирование и очистка записей.
- Сохранять время, операцию, provider/model, HTTP status, код/тип ошибки, возвращённое API сообщение и request ID, когда эти данные доступны. Отсутствующие сведения не выдумывать; собственную сетевую ошибку отличать от ответа API.
- До реализации обновить канон: сейчас публичный ответ содержит только общую безопасную ошибку и запрещает raw provider response. Для журнала разрешить отдельные очищенные поля с сохранением конкретного смысла сообщения API; полное тело запроса/ответа не сохранять.
- Out: сервер, телеметрия, автоматическая отправка журнала, запись API-ключа, Authorization или текста переводимой страницы.

## Acceptance

- [x] Ошибки перевода, test connection и discovery появляются в настройках с конкретным сообщением сервиса, а не только общей фразой «сервис недоступен».
- [x] Mock-сценарии покрывают 401/402/403/429/5xx, error envelope при HTTP 200, timeout/network и некорректный ответ; журнал показывает только реально доступные данные.
- [x] Ключи, заголовки авторизации и текст страницы не попадают в записи, UI или копируемый журнал; недоверенные сообщения выводятся как текст, redaction проверена тестами.
- [x] Число, размер и срок хранения записей ограничены и закреплены в каноне; копирование/очистка работают, журнал не дублирует retry-записи без пояснения.
- [x] Проверены Chrome/Firefox, обе темы настроек, кэш, дубли, память и очистка собственных обработчиков. Реальный API без ключа остаётся непроверенным.

## Research starting points

- [OpenRouter: errors and debugging](https://openrouter.ai/docs/api_reference/errors-and-debugging) — официальный формат ошибки и диагностические поля.
- [Reddit: ошибки и ограничения наблюдаемости OpenRouter](https://www.reddit.com/r/openrouter/comments/1teqe6e/things_i_figured_out_about_openrouter_after/) — проблемы для воспроизведения, не контракт API.

## Result

2026-10-08: реализованы provider diagnostics/reporter окончательной ошибки, protected ErrorJournal (100 / 4 KiB / 256 KiB / 7 дней), UI-only сообщения и независимый раздел options. PublicError, page state и snapshots не получают diagnostics. Metadata.raw не хранится; допускается очищенное message известного upstream JSON error. При echo текста запроса сообщение скрывается, fetch exception messages исключены.

449 Vitest tests / 24 suites, <=2 workers; typecheck/lint; обе builds. Provider tests обоих адаптеров: HTTP 401/402/403/429/503/200-error, network/timeout/malformed, test/discovery, cancellation, redaction. Storage: count/UTF-8 bytes/TTL/concurrency/corruption/timeout. UI: inert markup, copying/clear/retry/unmount timers. Security: content denied journal read/clear.

Production packages Chrome/Firefox: три mock операции дают три записи; 429 после 3 попыток даёт одну дополнительную запись; сообщения/HTTP/code/type/request ID читаются, обе темы проверены визуально, clear сохраняет cache. `test-results/linguisty-{smoke,firefox}/observations-focused-journal.json`. Clipboard boundary перехвачен в тестовом окне и совпадает с очищенным журналом; системный clipboard пользователя не менялся. Native OS clipboard/платный API не проверены.

Собственные browser profiles удалены, Firefox remainingOwnedProcesses=0. Кэш исходный 203 426 930 bytes; RAM 18.00 GB free. Журнал не создаёт poll/listener, unmount освобождает ожидание.
