---
status: active
---

# INFRA-004: Подключение подписки ChatGPT {#root}

Пользователь выбирает «Подписка ChatGPT» в Linguisty и подключает свой ChatGPT plan через официальный Sign in with ChatGPT для OSS/local приложения. Установка CLI, Native Messaging host и наш сервер этому режиму не нужны. Сетевые запросы выполняет собственная страница расширения; OAuth browser compatibility не выдаётся за проверенный live вход по mock-тестам.

## Настройки и шаги {#settings}

Provider ID `codex` сохранён для совместимости; он использует фиксированный OpenAI endpoint, не принимает API-ключ или пользовательский auth endpoint. Видимые варианты: OpenRouter, OpenAI-compatible, локализованная «Подписка ChatGPT» (English: ChatGPT subscription). Старые CLI адаптеры остаются совместимым историческим режимом, но в dropdown не предлагаются.

«Подключить ChatGPT» сохраняет текущую форму без передачи API-ключа и открывает/фокусирует собственную codex.html. Страница объясняет четыре шага: открыть вход ChatGPT; разрешить использование плана; проверить доступ и выбрать модель; вернуться к переводу. Указаны требования доступного плана, общие лимиты аккаунта, облачная обработка текста и необходимость оставить страницу открытой. Есть действия входа, отмены, проверки, отключения и возврата в настройки. Название, инструкция, статусы и ошибки доступны на всех 16 языках UI. Короткая callback page использует тот же выбранный язык или язык браузера; lang/dir соответствуют locale. Она загружает только компактные подписи, без полных словарей интерфейса.

## Авторизация {#auth}

Authorization Code + PKCE S256, криптографические state/nonce/verifier на каждую попытку. Первичная регистрация использует dynamic_agent_client, фактическое имя Linguisty и стабильный непрозрачный host ID; возвращённый issued client ID сохраняется отдельно от токенов. Callback — http://127.0.0.1:1455/auth/callback. Session DNR rule действует только на собственный auth tab и свежий state, перенаправляет в собственную callback page и удаляется в finally. Никаких общих перехватов входа CLI или других приложений.

declarativeNetRequestWithHostAccess объявлен required: Firefox не поддерживает его как optional, Chrome имеет подтверждённое зависание updateSessionRules после optional grant. Host access остаётся optional и выдаётся кликом только auth.openai.com, api.openai.com и 127.0.0.1. В правиле сохранены owner tab ID и отдельный случайный rule ID; фон удаляет только свои правила и auth tabs при закрытии владельца или обнаружении оставшегося правила после пробуждения.

ID token проверяется WebCrypto по trusted OpenAI JWKS: алгоритм RS256, подпись, issuer, issued audience, expiry, nonce и sub. Разрешение chatgpt.tokens.use.direct обязательно. Токены находятся только в памяти страницы подключения: без chrome.storage/browser.storage/localStorage/IndexedDB, DOM, URL или сообщений другим контекстам. При закрытии вкладки/перезапуске доступа нет; интерфейс предлагает снова подключиться. Только несекретные host/client идентификаторы сохраняются локально. Refresh сериализован; отключение очищает память и подтверждает либо явно не подтверждает удалённый revoke.

Audience допускает строку или массив строк OIDC. Единственный aud=[issued client ID] не требует azp; присутствующий azp должен совпадать с issued client ID, для нескольких audiences azp обязателен. Локальный отказ подключения содержит ограниченный код этапа/проверки и HTTP status при наличии. Код показывается только в своей странице, не содержит token/claims values, email, callback URL, provider body или произвольного текста ошибки; долговременный диагностический журнал не создаётся.

## Запросы и изоляция {#requests}

Фон обращается к собственной странице через именованный внутренний port. Страница проверяет sender, protocol/version, bounded payload и request ID; секреты не возвращаются. Status показывает проверенную авторизацию, discovery — фактически доступные модели, test не выполняет платный inference. Строгий перевод возвращает только content для прежнего parser. account scope кэша — SHA-256 проверенных sub/client_id, не токен и не email.

Responses HTTP: store=false, stream=true, input array с developer instructions, без запрещённых полей или tools. Общая строгая schema перевода передаётся через text.format={type:json_schema,name,strict,schema}, без Chat Completions envelope. Модель default разрешается через доступный список; выбранная модель не подменяется. Ответ собирается только после response.completed со status=completed: assistant commentary исключается, final_answer и совместимые сообщения без phase читаются; failed/incomplete/abort/refusal не считаются успехом. SSE поддерживает LF/CRLF/CR и разрывы UTF-8/разделителей между chunks. Источник страницы — текст, не HTML. Перевод использует прежние prompt/parser/cache/dedup.

Reader сохраняет завершённые assistant messages из response.output_item.done по output_index, максимум 128 slots, без metadata/annotations и commentary текста. Успех возможен только после response.completed/status=completed. Если terminal output не повторяет сообщения, используется завершённый stream text; совпадающий aggregate не дублируется, противоречащий текст отклоняется. Raw deltas/added items без завершённого message не заменяют final_answer. Общий parser по-прежнему проверяет полный набор IDs/переводов до cache/DOM commit.

Отказы перевода различают только фиксированные LGT-response-body/json/completion/content/refusal/limit/output/message/phase/status/part/empty/commentary/conflict и LGT-translation-json коды. Через собственный port передаётся только код из allowlist; произвольные ошибки, body/claims/токены/текст страницы не передаются. Popup сохраняет этот код при локализации общей ошибки. Постоянный журнал Responses и provider responses не создаётся.

## Ресурсы {#resources}

Не больше 16 pending port requests и 4 одновременно обслуживаемых запросов страницы; payload до 900 KiB, response до 1 MiB. Timeout ограничен 120 s; cancel/disconnect/закрытие страницы освобождают контроллеры, listeners, timers и порты. Модели максимум 1 000, TTL 15 минут. Нет постоянного polling/keepalive и слушающего localhost процесса. Открытие страницы сериализовано и повторно использует существующую вкладку.

В Chrome повторное открытие ищет только собственный TAB/documentUrl через runtime.getContexts: tabs.query не показывает собственный extension URL без широкого tabs permission и не подходит для dedup. Firefox использует собственный tabs.query. После пробуждения фона поиск не зависит от сохранённого в RAM tab ID.

## Проверка и история {#changelog}

Контрактные тесты охватывают OAuth валидацию, SSE completion, secret boundary, cancellation и повторные lifecycle. Chrome/Firefox smoke проверяет неизменённый пакет и собственный UI/mock auth/перевод. Реальные вход, доступность плана и качество модели остаются отдельно непроверенными без пользователя.

- 2026-10-09: исправлена совместимость единственного OIDC audience в массиве; зафиксированы ограниченные локальные коды причин отказа подключения.
- 2026-10-08: по уточнению пользователя видимый Codex переименован в локализованную «Подписка ChatGPT»; callback локализован на 16 языков, внутренние ID и протокол сохранены.
- 2026-10-08: новый режим и страница по прямому поручению пользователя.
- 2026-10-09: строгий Responses text.format, разделение commentary/final_answer, совместимые SSE окончания строк и ограниченные коды отказа перевода.
- 2026-10-09: завершённый text из output_item.done сохраняется до terminal completion; пустой aggregate не теряет перевод, повторы не дублируются, content причины различаются безопасными кодами.
