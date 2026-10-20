---
status: active
---

# INFRA-002: Локальные настройки, секреты и кэш {#root}

Настройки и переводы остаются на устройстве пользователя. Сохранение ключа выбирается явно; повторный перевод использует ограниченный кэш с полным контекстом.

## Управление и границы {#governing}

`spec://common/PROP-000-product#invariants`, `spec://common/PROP-001-contracts#types`, `spec://common/PROP-002-quality#resources`. Входит settings schema/migration, secret modes, IndexedDB, stats/pruning. Cloud sync и import/export вне v1.

## Настройки {#settings}

CLI-режимы используют ту же schemaVersion=1. При нормализации служебный baseUrl не используется как HTTP endpoint; пустая модель становится default, concurrency=1 и streaming=false. Переключение в CLI не удаляет прежний API-ключ; новый ключ из CLI-настроек не сохраняется. Provider/model сохраняют разделение кэша. Токены сторонних CLI не читаются.

Codex сохраняет ту же schemaVersion=1: фиксированный OpenAI baseUrl, пустая модель становится default, concurrency=1 и streaming=false. Предыдущий API-ключ сохраняется для возврата в API-режим. Только несекретные host/client регистрационные ID хранятся отдельно. Access/refresh/ID tokens не записываются в browser storage, DOM или журнал; sub/email не сохраняются в storage или журнал. Подтверждённый email можно показать на странице подключения. Account scope кэша поступает из проверенной RAM-сессии по INFRA-004 и не хранится в Settings.

Settings schemaVersion=1, defaults из shared/constants, provider/model/languages/style/instructions/theme/keyMode/concurrency/batch/timeouts. Settings не содержат apiKey. Валидировать enum, длины, HTTP(S) endpoint, отсутствие credentials/query/hash, max customInstructions 4 000 chars. targetLanguageMode=browser/manual и uiLanguage=auto/поддержанный UI locale — независимые настройки. Fresh target определяется из browser preferred languages с fallback en при загрузке; DEFAULT_SETTINGS имеет безопасный статический en. В browser режиме loadSettings возвращает актуальный target; manual сохраняет BCP 47 выбор, распознаваемый Intl.getCanonicalLocales. Прежний валидный target без mode мигрирует в manual; секреты/model/source не сбрасываются. Сохранять только нормализованные разрешённые поля, неизвестные отбрасывать. Старый/повреждённый state безопасно нормализуется или отклоняется с понятной ошибкой. Save не стирает ключ, если поле ключа пустое/не передано; удаление отдельным действием.

Settings.streaming — boolean, default true; отсутствующее поле прежней schemaVersion=1 получает default без изменения keyMode/секрета. Выбор транспорта не входит в cache key, потому что не меняет язык/контекст перевода.

## Секреты {#secrets}

`persistent` — browser.storage.local, `session` — browser.storage.session. Default session. Переключение mode переносит существующий ключ в новый store и удаляет старую копию; удаление очищает обе. Session переживает остановку service worker, но заканчивается с browser session. Если API session storage недоступен, нельзя молча сохранять persistent; показать ограничение. Chrome storage local/session accessLevel TRUSTED_CONTEXTS устанавливается, когда API доступен. Content script не импортирует секретный helper и не читает storage. getSecretStatus возвращает hasKey/mode, getApiKey разрешён только background caller. Никогда не обещать шифрование local storage.

При сохранении конфигурации persistent ключ и settings.keyMode записываются вместе одной операцией browser.storage.local.set. Переход в session сначала подготавливает session ключ, затем одной local записью сохраняет настройки и удаляет persistent значение; допустим null tombstone с последующим remove. При отказе операции прежние ключ/настройки восстанавливаются. Обычный перезапуск браузера и обновление браузера/постоянно установленного расширения не меняют local ключ или стабильный Firefox gecko ID. Удаление расширения, очистка профиля и снятие temporary install имеют ограничения браузера: расширение не может отменить удаление своих данных Firefox.

Устаревший popup или options без явного изменения режима не переносит persistent ключ в session; актуальный режим берётся фоном при сохранении.

## Ключ кэша {#cache.key}

Codex дополнительно включает проверенный accountScope из RAM-сессии в hash контекста; отсутствие валидного scope отклоняется. Смена аккаунта не получает прежний перевод из постоянного кэша. Токены и email не входят в ключ; API-провайдеры сохраняют прежний digest.

SHA-256 от JSON с версией prompt, точным исходным текстом (допустима безопасная нормализация пробелов только если сохранено whitespace отображения), source/target, providerId, canonical baseUrl, model, style, customInstructions hash, pageContext.title/domain/contentType и соседними текстами/семантическими группами входного batch без transient node IDs. Ключи API исключены. Контекст cache lookup одинаков с фактическим prompt context: фраза не получает перевод из другой группы/batch на той же странице. TranslationEngine выполняет conservative dedup внутри равного контекста и remaps IDs без слияния узлов.

## Данные и операции {#cache.data}

IndexedDB запись: key, translated text, createdAt, accessedAt, estimatedBytes; schema version 1. TTL 30 дней; <=10 000 entries/50 MiB; LRU eviction. При quota/IDB unavailable перевод продолжает работать без кэша, ошибка не превращается в провал перевода. stats сообщает entries/estimatedBytes/hits/misses, timestamps не выдумываются. Clear действительно удаляет записи. Очистка и запись сериализованы там, где требуется атомарность.

## Контракт и восстановление {#contracts}

Локальный журнал API хранится отдельной allowlist-записью в protected browser.storage.local: максимум 100 entries, 4 KiB на запись, 256 KiB суммарно, TTL 7 дней. Время/ID создаются фоном, неизвестные поля отбрасываются. Чтение/запись/clear сериализованы; TTL/count/size prune при чтении и записи. Хранилище журналов не содержит запросов, ключей или переводов. Диагностика очищается до передачи storage helper; ошибка записи журнала не заменяет исходную API-ошибку. UI читает журнал независимо от основной формы и может очистить только журнал.

Provider message/upstream message/request ID не входят в сохраняемые поля; API code/type допускаются только из конечного безопасного словаря. Ограниченная model поступает из собственных настроек запроса и очищается от секретов до передачи журналу. При чтении старых записей свободные поля отбрасываются и очищенные записи сохраняются обратно: старый нежелательный текст не возвращается в UI/clipboard.

Экспорты storage/settings.ts, storage/secrets.ts, cache/translationCache.ts, cache/cacheKey.ts перечислены в PROP-001. getTranslationCache возвращает один instance на background lifetime. dispose закрывает DB/отпускает ссылки. Миграция настройки не обнуляет ключ или переводы. По невозможности session mode сообщение соответствует фактическому браузеру.

## Ошибки и готовность {#acceptance}

Тесты normalization, no-secret settings, session/persistent перехода, удаления обеих копий, cache context invalidation, TTL/LRU/size, concurrent writes, clear и отказа IDB. Секрет отсутствует в cache keys/data и public responses. `@spec` на helpers и tests.

## Связи и история {#changelog}

- 2026-10-12: ужесточена allowlist постоянного API-журнала после воспроизведённого сохранения короткого текста страницы; legacy свободные поля санируются при чтении.

- 2026-10-08: Codex использует RAM-сессию, сохраняет только несекретную регистрацию и разделяет кэш по проверенному аккаунту.

- 2026-10-08: нормализация четырёх CLI provider IDs без миграции или удаления прежнего API-ключа.
Related: `spec://modules/translation/FEAT-001-engine#dedup`, `spec://modules/platform/INFRA-001-extension#permissions`.
- 2026-10-07: bounded local storage и две формы сохранения ключа.
- 2026-10-07: уточнено включение соседнего текстового контекста batch без transient IDs для коротких неоднозначных фраз.
- 2026-10-08: совместная local запись ключа/режима, защита от устаревшего UI и явная граница temporary Firefox install.
- 2026-10-08: отдельный ограниченный локальный журнал очищенных API diagnostics.
- 2026-10-08: streaming default и совместимая миграция прежних настроек без изменения ключа.
- 2026-10-08: targetLanguageMode/uiLanguage, browser-based fresh defaults и сохранение прежнего явно заданного target при миграции.

