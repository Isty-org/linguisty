---
status: active
---

# INFRA-003: Локальный CLI перевода {#root}

Linguisty использует официальный установленный CLI пользователя через небольшой Native Messaging host. Модели остаются сервисами выбранного CLI; офлайн-инференс не обещается. Браузер запускает host сам; постоянно слушающего сервера нет.

## Режим и интерфейс {#settings}

После WI-022 этот модуль обслуживает только совместимость ранее сохранённых конфигураций. Dropdown больше не предлагает четыре CLI. При загрузке прежних CLI-настроек форма показывает Codex по INFRA-004, но не перезаписывает настройки до явного сохранения/подключения. Описанная ниже установка host остаётся контрактом старого native transport, а не новым пользовательским сценарием.

Отдельные provider IDs: codex-cli, claude-code, antigravity-cli, grok-build. Собственный API-ключ расширения не нужен и не передаётся host. Вход выполняется пользователем в исходном CLI; токены не читаются, не копируются и не сохраняются Linguisty. Пустой model означает default модель CLI, вручную заданный ID передаётся отдельным аргументом. API-режимы сохраняют прежние контракты. CLI работает с финальным проверенным ответом batch; streaming UI для CLI отключён. Выбор CLI устанавливает concurrency=1 и timeout=120 s. Настройки явно объясняют установку host и расход лимитов аккаунта.

## Native Messaging {#protocol}

Имя host: com.linguisty.cli. Optional permission nativeMessaging запрашивается только пользовательским действием в UI. Один background client мультиплексирует ограниченные запросы по уникальному ID; версия протокола 1. Operations: status, translate, cancel. Host принимает только четыре provider IDs и ограниченные messages/model/timeout; путей программ, команд shell, секретов и произвольных флагов в wire нет. Ответ возвращает только ограниченный content или фиксированный error code. Никаких сырых stdout/stderr/учётных данных в журнале. Status проверяет существование CLI без inference и явно не подтверждает аккаунт/модель. Default model discovery не делает сетевых запросов.

## CLI запуск {#execution}

Процессы запускаются без shell, скрыто на Windows, из отдельного временного рабочего каталога. Используются документированные headless/JSON режимы. Codex — ephemeral/read-only, shell/web/apps/MCP отключены; Claude — инструменты и MCP отключены, без persistence; Grok — без tools/subagents/web и auto-update; Antigravity — собственный workspace agent tools=[] и sandbox. Штатные бинарные CLI не изменяются. Windows npm cmd shims разрешаются в известный JS entrypoint пакета и запускаются через Node без shell. Не найденный бинарник даёт CLI_NOT_FOUND, отсутствующий host — CLI_HOST_MISSING, отказ авторизации — CLI_LOGIN_REQUIRED. Ни автологина, ни установки сторонних программ, ни взаимодействия с существующими чатами.

## Ресурсы и отмена {#resources}

Native frame максимум 900 KiB; CLI stdout максимум 4 MiB, stderr 32 KiB; финальный content/response bounded и строго проверяется прежним parser по ID. Host выполняет один перевод одновременно, очередь максимум 16; client максимум 16 pending. Общий timeout включает очередь. Cancel/timeout/disconnect завершают только созданное host дерево процессов, удаляют timers/listeners и принадлежащий запросу temp workspace. Кэш и dedup прежние; provider/model входят в scope. Idle native port закрывается, host не остаётся работать без запросов. Кэш/история сторонних CLI не очищаются и не обещаются отсутствующими, если CLI самостоятельно ведёт их.

## Установка и проверка {#acceptance}

Одноразовый Windows installer копирует только файлы host в LocalAppData/Linguisty, находит Node и CLI, регистрирует собственные HKCU native host manifests Chrome/Firefox. Chrome ID передаётся явно (или берётся из локального build smoke); Firefox ID стабилен. Чужие записи реестра не трогаются. Tests проверяют кадры, лимиты, адаптеры, отсутствие shell/секретов, отмену, missing executable/host, работу без API-ключа и API regression. Браузерный mock smoke проверяет native канал и перевод, не подтверждает смысловую точность. Реальные CLI-вызовы модели требуют отдельного тестового поручения пользователя.

## Связи и история {#changelog}

- 2026-10-08: CLI-выбор убран из нового UI; модуль сохранён для совместимости, основной Codex-сценарий определяет INFRA-004.

Проверка Chrome native transport в headless использует отдельную временную копию пакета с nativeMessaging в required permissions; JS/assets остаются байтово теми же. Production optional grant и физический Chrome диалог не подтверждаются этим тестом. Firefox smoke проверяет неизменённый пакет и штатный optional permission prompt через privileged тестовую область. Оба smoke используют детерминированные переводы, не живую модель.

Related: `spec://modules/translation/FEAT-001-engine#providers`, `spec://modules/storage/INFRA-002-local-data#cache.key`, `spec://modules/interface/FEAT-003-controls#options`, `spec://common/PROP-002-quality#resources`.
- 2026-10-08: новый режим по прямому поручению пользователя.
