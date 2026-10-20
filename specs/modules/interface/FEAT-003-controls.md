---
status: active
---

# FEAT-003: Управление и настройки Linguisty {#root}

Popup даёт перевод, прогресс, отмену и оригинал. Отдельные настройки содержат провайдера, ключ и модель. Все действия работают через проверенные сообщения фону.

## Управление и границы {#governing}

`spec://common/PROP-000-product#scope.in`, `spec://common/PROP-001-contracts#messages`, `spec://common/PROP-002-quality#ui`. Визуальный референс DESIGN.md: приложенная пользователем Retro Orbit Editorial, темы Paper / Graphite. Пользовательский текст и manifest только Linguisty; его логотип предоставлен отдельно. Isty остаётся названием design reference и авторской подписью в footer.

## Popup {#popup}

Ширина около 360–400 px, компактная шапка Linguisty, затем сразу выбор целевого языка, source auto/explicit, текущие provider/model, основная кнопка «Перевести страницу». Крупного вводного баннера в popup нет; редакционный заголовок остаётся только в настройках. Progress aria-live, реальные discovered/translated/failed. Actions cancel/show original/show translation и открыть настройки. Без ключа/модели понятный onboarding с переходом в настройки. Protected page предупреждает. Повторное открытие popup восстанавливает настоящий status, а не сбрасывает progress. Ошибки читаемы и retryable actions соответствуют ошибке.

Кнопка настроек в шапке — шестерёнка без видимой текстовой подписи. Размер области нажатия 44×44 px; локализованные accessible name и tooltip сохраняются, SVG декоративен. Работают keyboard, focus-visible, обе темы и RTL.

## Настройки {#options}

Provider OpenRouter / OpenAI-compatible, custom baseUrl только когда нужен, password input для ключа (пустой по умолчанию; сохранённый ключ не подставляется), session/persistent выбор, model discovery/search плюс manual ID, source/target, natural/accurate/literal, custom instructions. Test connection, save, delete key, cache stats/clear. Origin permission запрашивается из синхронного пользовательского жеста перед сохранением или test; denied grant не сохраняет новую provider config. Пустой apiKey означает сохранить существующий ключ, удаление — отдельной кнопкой. Изменение keyMode переносит существующий ключ. Test введённого ключа не обязан его сохранять. Нет необязательного общего API-key.

Третий и единственный новый keyless вариант — локализованная «Подписка ChatGPT» (English: ChatGPT subscription). Кнопка «Подключить ChatGPT» сохраняет форму без API-ключа и открывает/фокусирует codex.html с четырьмя шагами, входом ChatGPT, проверкой, выбором модели, отменой/отключением и возвратом в настройки с сохранением вкладки. Старые CLI не предлагаются: их сохранённая конфигурация показывается формой подключения подписки, но сохраняется лишь явным действием. Popup проверяет наличие подключённой страницы и предлагает подключение без требования ключа. Все строки/ошибки и callback доступны в 16 локалях; язык и RTL едины с настройками. Токены только в памяти отдельной страницы по spec://modules/platform/INFRA-004-codex-connection#root; это исключение из ограничения импортов для popup/options. Внутренний provider ID `codex` сохраняется.

При temporary Firefox install настройки объясняют удаление дополнения и возможное удаление данных после перезапуска. Optional management.getSelf читает только собственный installType без management permission, не задерживает форму и не меняет browser preferences. Для обычного использования после перезапуска нужен подписанный постоянно установленный пакет.

«Показывать перевод постепенно» включено по умолчанию. Готовые фразы появляются до окончания ответа; на ошибке неподтверждённый перевод откатывается. Выключение выбирает обычный запрос следующей сессии. Не обещать, что произвольный generic API/выбранная модель отдаёт данные рано или что abort гарантированно прекращает биллинг upstream.

## Темы и доступность {#design}

CSS semantic tokens соответствуют DESIGN.md: violet #b9a6f2 / #8d71cb, sage #9eb58f / #6f8a65, graphite #121018 / #17131d, cream/paper #f5f0e6 / #f3ead8. Контраст текста соблюдается через semantic variants. Onest и JetBrains Mono bundled с лицензиями, системные fallback для других систем письма; без remote fetch. Крупные наклонные заголовки, прямоугольные тонкие панели, restrained orbit lines; product controls важнее landing poster. В шапке — предоставленный логотип Linguisty: монохромный на paper, цветной на graphite, с соседним доступным названием продукта. Он декоративен для screen reader; размеры 64×64 px в options и 44×44 px в popup. Цветной SVG служит источником PNG toolbar icons 16/32/48/128 px на графитовой подложке, без дополнительной орбиты; Isty используется только в авторской подписи footer. Светлая/тёмная/system настройка сохраняется и применяется до визуального paint где возможно без inline script. 44 px click targets, focus-visible, labels, keyboard, reduced motion; status не только цвет. Настройки имеют навигацию по реальным разделам; popup около 390 px. Не создавать отдельный landing/backend.

## Языки {#languages}

Авторский знак Isty размещён в footer popup/options с локализованным «Powered by», а в шапке остаётся Linguisty. Полный шаблон credit поддерживает положение бренда внутри фразы; SVG имеет доступное имя Isty, без внешнего запроса или выдуманной ссылки.

Каталог перевода содержит ISO 639-1 языки и распространённые варианты BCP 47, с названиями на текущем языке UI и собственным названием. Он означает доступный выбор для prompt; возможности выбранной модели не гарантируются. Ручной BCP 47 code, распознаваемый Intl.getCanonicalLocales, сохраняется даже вне каталога; отдельный parser grandfathered/private-only tags не добавляется.

Новый профиль использует source=auto, targetLanguageMode=browser, uiLanguage=auto. Target выбирается из предпочтений navigator.languages, затем i18n.getUILanguage/navigator.language, затем English. UI auto предпочитает browser i18n.getUILanguage, затем navigator.languages; неподдержанный UI locale использует English. UI и язык перевода — независимые настройки. Режим browser заново разрешает target при чтении настроек; manual не изменяется. Прежний сохранённый target без mode мигрирует в manual. Указанный пользователем uiLanguage хранится отдельно; regional/script matching учитывает simplified/traditional Chinese. Локальные словари полного UI как минимум en/ru/uk/de/fr/es/it/pt/pl/tr/ja/ko/zh-CN/zh-TW/ar/hi; lang и dir соответствуют locale, Arabic RTL. Нет попытки напрямую читать язык ОС. Нативная клавиатурная навигация и ввод длинных/редких языковых кодов сохраняются.

## Ошибки и данные {#errors}

UI не импортирует secret/provider/cache helpers. Введённый ключ очищается после сохранения и не логируется. Validation errors показываются у поля/общим alert, raw provider response исключён. Button busy state устойчив к rejection; подписки/poll timers освобождаются при unmount. Cache clear требует ясного действия; перевод страницы не уничтожается.

Раздел «Журнал ошибок API» показывает очищенные диагностические поля, время, операцию и число попыток отдельно от PublicError. Недоверенные сообщения — текстовые React children. Доступны обновить, скопировать и очистить; явные пустое/загрузка/ошибка состояния. Копирование пишет только отображаемые очищенные данные в clipboard по пользовательскому жесту, результат не выдумывается. Загрузка независима от формы, имеет timeout и cleanup при unmount; после test/discovery журнал обновляется. Серверной отправки нет.

Загрузка кэша не задерживает форму настроек. Чтения фона имеют конечный timeout и один ограниченный retry только при транспортном сбое запуска; команды с побочными эффектами автоматически не повторяются. После timeout доступны понятное сообщение и повторная загрузка. Закрытие UI отменяет ожидание и освобождает timers. Bootstrap и ошибка React render оставляют видимый безопасный fallback с перезагрузкой страницы; сырые ошибки и ключи в нём не показываются. Старое окно сохраняет актуальный keyMode, если пользователь не менял его явно.

## Готовность и трассировка {#acceptance}

Полный onboarding и повторный запуск; manual model при отказе discovery; denied permission; session/persistent; clear cache; progress/cancel/toggle; light/dark/system; mobile options и keyboard. Нет фиктивных цифр или успешных test connection без ответа. `@spec` на крупные React components/hooks и прямые interaction tests.

## Связи и история {#changelog}

- 2026-10-08: видимое имя сервиса — «Подписка ChatGPT» на 16 языках; локализованы кнопки, статусы и короткая страница возврата после входа.
- 2026-10-08: API + один Codex в dropdown, отдельная страница четырёх шагов и входа, проверенный status в popup; инструкции переведены на 16 языков.

- 2026-10-08: четыре CLI в selector; keyless options/popup, установка соединителя, default модель и честная проверка присутствия вместо обещания проверенного model ответа. Инструкции и CLI errors доступны на всех 16 UI локалях.
Related: `spec://modules/storage/INFRA-002-local-data#settings`, `spec://modules/platform/INFRA-001-extension#permissions`.
- 2026-10-07: popup/options и адаптация Isty Cloudline для Linguisty.
- 2026-10-08: bounded UI startup, независимые cache stats, безопасный fallback и сохранение актуального режима ключа.
- 2026-10-08: локальный раздел очищенных API errors, ручное обновление/копирование/очистка.
- 2026-10-08: пользовательский выбор постепенного/обычного отображения.
- 2026-10-08: Retro Orbit Editorial, supplied SVG, локальные шрифты; расширенный каталог переводов и независимые auto/manual UI/target preferences с сохранением прежнего выбора.
- 2026-10-08: уточнение пользователя — знак Isty и локализованный credit перенесены из шапки в footer.
- 2026-10-08: новые пользовательские SVG Linguisty в шапке по теме и в PNG toolbar icons; локализованный footer Isty сохранён.
- 2026-10-08: по уточнению пользователя вводный баннер удалён из popup; в options крупный заголовок сохранён.
- 2026-10-09: по запросу пользователя текстовая кнопка настроек popup заменена шестерёнкой с доступным именем и tooltip.

