# WI-034: Повторить восстановление после временных отказов storage

- Kind: `fix`
- Canon action: `none`

## Outcome

Устранить подтверждённое аудитом WI-032 постоянное залипание session recovery после двух ошибок browser storage.

## Specs

- Governing: `spec://modules/platform/INFRA-001-extension#recovery`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- Assigned paths: `src/background/controller.ts`, `src/background/sessions.ts`, `tests/background/**`, этот WI.
- In: восстановление по следующему запросу после transient failures, дедупликация concurrent restore, bounded retry и dispose.
- Out: storage modules, contracts, content/messaging, provider diagnostics, dependencies/build/docs/BOARD/WAL.

## Acceptance

- [x] Регрессия воспроизводит два отказа и последующее восстановившееся storage.
- [x] Следующее допустимое обращение восстанавливает сессии без перезапуска extension.
- [x] Concurrent запросы не порождают duplicate restore; бесконечного retry loop нет; dispose освобождает state.
- [x] Профильные тесты проходят; Result содержит было → стало и ограничения.

## Result

Было → стало:

- После второго отказа `recoverSessions()` оставлял отклонённый Promise в `recovery`; все следующие page-команды повторяли прежний `INTERNAL_ERROR` без чтения уже здорового `storage.session` → неуспешная попытка освобождает Promise после settlement. Следующий явный page-запрос запускает новую попытку; успешная остаётся общей. `recoveryAttempts` удалён.
- Одновременные запросы во время одной попытки по-прежнему ждут один restore. Нет фонового цикла повторов: при отказе код ждёт нового обращения. Каждая попытка сохраняет прежний 5-секундный deadline; отмена и завершение удаляют controller из resource set.
- После неудачного initial `ready` обработчик закрытия вкладки навсегда ссылался на rejected initial Promise → после успешного retry использует текущий `recovery`, поэтому удаление вкладки сохраняет пустой snapshot.
- Dispose отменяет и дожидается текущей попытки; ожидающий запрос получает `CANCELLED`. Поздний ответ старого `storage.session.get` не записывает snapshot и не создаёт сессию.

Воспроизведение и проверки:

- До правки: `vitest run tests/background/controller.test.ts --maxWorkers 2 --no-file-parallelism -t 'retries on the next page request'` — тест падал: после двух отказов было только 2 чтения вместо третьего.
- После правки: `vitest run tests/background --maxWorkers 2` — 7 файлов, 81 тест пройден, включая два отказа → здоровое storage → успешный восстановленный `GET_TAB_STATE`, concurrent coalescing, timeout/late result, dispose и очистку при tab close.
- `tsc --noEmit` — 0 ошибок. `eslint src/background/controller.ts src/background/sessions.ts tests/background` — 0 ошибок.
- Промежуточный контроль ресурсов: `node_modules` 184.6 MiB, `.wxt` 0 MiB, `.output` 20.8 MiB; доступная RAM около 14.1 GiB, 62 общих Node процесса. Чужие процессы и кэш не менялись. Один `recoverSessions` и один `SessionRegistry.restore`, дубль реализации не добавлен.

Исследование до решения: [Reddit о холодном MV3 worker](https://www.reddit.com/r/chrome_extensions/comments/1tjbrz7/whats_your_simplest_recovery_pattern_when_the_mv3/) и [Stack Overflow об асинхронной инициализации MV3](https://stackoverflow.com/questions/71255886/how-to-initialize-chrome-extension-storage-local-under-manifest-v3-service-wor) использованы как сценарии; поведение проверено по [Chrome service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) и [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

Ограничения: тесты используют mock WebExtensions API; реальный kill/browser smoke и общие production builds в этом WI не проводились. `browser.storage.session.get` не имеет отмены на уровне API: после timeout/dispose поздний Promise может завершиться, но проверка AbortSignal в `SessionRegistry.restore` не даёт результату этого чтения изменить sessions. Поведение бесконечно ожидающей операции `storage.session.set` этим проходом не проверялось; физическую отмену browser API исправление не добавляет. Изменений вне Assigned paths не требуется.
