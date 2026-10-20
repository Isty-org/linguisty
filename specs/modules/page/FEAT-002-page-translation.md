---
status: active
---

# FEAT-002: Перевод страницы и динамический DOM {#root}

Страница переводится заменой значений Text nodes. DOM-структура, события и пользовательский ввод сохраняются; оригинал и перевод переключаются из памяти.

## Управление и границы {#governing}

`spec://common/PROP-000-product#invariants`, `spec://common/PROP-001-contracts#sessions`, `spec://common/PROP-002-quality#resources`. Событие — пользовательская команда start. Только top frame обычной HTTP(S) страницы; cross-origin iframe, closed shadow DOM, PDF и editable values вне v1.

## Сканирование {#scan}

TreeWalker по text nodes; skip script/style/noscript/code/pre/textarea/svg/canvas/input/select/option, contenteditable ancestry, translate=no, hidden/inert/aria-hidden и элементы без видимых rect, whitespace/punctuation-only, чистые URLs/email/hash. Не игнорировать семантическую фразу с числами. Элементы вне viewport, но имеющие layout, переводимы. WeakMap<Text, state>, bounded iterable registry для toggle; detached nodes удаляются. Не сканировать весь DOM при каждой мутации.

## Очередь и контекст {#queue}

Сначала viewport, затем near-viewport, затем rest; IntersectionObserver может повышать приоритет. Logical grouping common parent/nearest semantic container не объединяет output nodes. Title/domain берутся из страницы; title max 300 chars, domain без query/path. Контент не получает apiKey. Не более установленной concurrent batches и 5 000 queued nodes. Progress считает реальное число discovered/translated/failed/inFlight, cache hits по фактическим узлам.

Обычный запрос ориентируется на 16 узлов и 3 000 условных символов (CJK считается с весом 3), не превышая пользовательских лимитов 40/10 000. Длинный узел до 100 000 UTF-16 code units дробится по предложениям/пробелам, сохраняя все символы и surrogate pairs; максимум 128 частей. Части отправляются последовательно внутри одного занятого слота, другие батчи страницы идут параллельно. Только полный проверенный набор частей меняет исходный Text node; progress/cache-hit считает исходный узел. Отмена, original, navigation и внешняя правка прекращают запуск следующих частей. Более крупный узел явно отклоняется без обрезания.

Watchdog каждой части/обычного batch учитывает весь bounded retry/recovery бюджет фона плюс 5 s доставки; он не обрывает восстановление на первом per-attempt timeout.

## Применение и режимы {#render}

Для исходного CJK без межсловных пробелов renderer сохраняет запрошенные моделью краевые пробелы и при необходимости вставляет один принадлежащий пробел на границе соседних буквенных inline фрагментов одного предложения. Пробел не переносится через block/BR/изображение, к знакам пунктуации или сноскам sup/sub, не меняет намеренно склеенные буквенные исходники. Повторное применение не накапливает пробелы; original возвращает точный исходный текст. Внутреннее слитное слово ответа модели не разделяется предположениями.

Менять Text.data, сохранять leading/trailing whitespace. Перед apply проверить Text.isConnected, sessionId, batchId и то, что текущий текст равен ожидаемому original/owned value. Внешняя мутация становится новым original; устаревший ответ пропускается. original/translated сохраняются; show original прекращает новые batch и observer auto-translate до возобновления translated. Уже готовые переводы восстанавливаются без сети; pending resume допускает только новые/неготовые nodes. Cancel прекращает batch, abort отправляется фону, готовый текст остаётся. Никогда не вызывать innerHTML для перевода.

При смене CJK ↔ Latin/Cyrillic renderer может владеть только `font-size` и `line-height` непосредственного HTML-родителя одного смыслового Text node без дочерних элементов. Это исключает изменение оформления непереводимых детей. Семейство шрифта и DOM-структура сохраняются. Canvas TextMetrics сравнивает видимую высоту CJK и прописных букв в исходном computed font. Уменьшать CJK ради высоты латинских букв нельзя: сложные знаки должны оставаться читаемыми. Коррекция только увеличивает размер, максимум в 1.4 раза относительно исходного; обычный текст ориентируется на минимум 14 px для букв и 16 px для CJK, подписи small/figcaption/caption/sup/sub — 12/13 px. Размеры заголовков сохраняют исходную иерархию. Это ограниченная эвристика читаемости, а не гарантия для любого шрифта и сайта.

Автоматическая коррекция шрифта применяется только к leaf-блокам p/h1–h6/li/blockquote/dt/dd/figcaption/caption/small/sup/sub в свободном текстовом потоке. Встроенные ссылки/span, навигация, aside, формы, кнопки, таблицы и nowrap-презентация сохраняют исходный размер и межстрочный интервал.

Перед коррекцией фиксируются только два принадлежащих свойства с priority. Повторное применение не накапливает масштаб. Если коррекция увеличила переполнение скрывающего/обрезающего предка (максимум 8 предков), оба свойства восстанавливаются. `font-size-adjust` сайта имеет приоритет: при заданном значении коррекция пропускается. На original, внешнем изменении текста/стиля, удалении узла, reset и dispose принадлежащие значения снимаются; новые внешние inline-значения сохраняются. Записи ограничены registry (5 000), кэш метрик — 128 значений; собственные стили входят в guarded writes observer.

## Динамический DOM и SPA {#sessions}

Потоковые previews привязаны к текущим sessionId/batchId/revision исходного узла. Фон отправляет cumulative snapshot не чаще одного сообщения за 100 ms и монотонный sequence; старые frames отбрасываются. Preview хранит отдельное принадлежащее Text-значение, не меняет original и не увеличивает committed translated/fromCache. Reset/failure/cancel/original возвращает затронутые originals/стили, сохраняя внешний текст/новое оформление. Финальный валидный batch фиксирует translation. Detached prune, navigation и dispose освобождают previews, callbacks и timers. Resume пропускает уже committed переводы.

MutationObserver с debounce ~400 ms: added subtree + characterData, guarded own writes. Нет translation-of-translation loops. history navigation проверяется без внедрения скрипта в page MAIN world: попstate/hashchange и bounded URL check пока сессия активна; DOM replacement обнаруживается observer. На изменении route cancel old session/clear registry, новый контекст и новая сессия согласуются с background. Безопасное возобновление сохраняет активный режим и settings, не применяет старые ответы. Один bootstrap marker/listener на документ; повторный inject не умножает обработчики.

## Ошибки, cleanup и готовность {#acceptance}

DOM tests на filtering, whitespace, event listeners/form state, external changes, own-mutation loop, dynamic inserts, viewport order, cancel/stale replies, restore, route reset, detached prune и dispose timers/observers. При лимите показывается понятная ошибка/ограничение. `@spec` на scanner/registry/renderer/controller и tests. getState отдаёт безопасный snapshot. dispose освобождает listeners/timers/registry и aborts sessions.

## Связи и история {#changelog}

Related: `spec://modules/platform/INFRA-001-extension#runtime`, `spec://modules/translation/FEAT-001-engine#dedup`.
- 2026-10-07: первая версия DOM pipeline и восстановление страницы.
- 2026-10-08: ограниченная коррекция читаемости CJK ↔ буквенные системы по фактическим метрикам и восстановление двух принадлежащих свойств.
- 2026-10-08: отдельное provisional отображение целых потоковых items и rollback по session/batch/sequence.
- 2026-10-08: небольшие CJK-aware батчи, длинные узлы без обрезания, inline пробелы и консервативная коррекция шрифта.

