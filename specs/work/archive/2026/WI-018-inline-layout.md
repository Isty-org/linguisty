# WI-018: Пробелы CJK → русский и сохранение оформления

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Переведённые соседние фрагменты буквенного текста внутри предложения разделяются пробелами, а изменение шрифта не затрагивает встроенные ссылки и элементы интерфейса.

## Specs

- Governing: `spec://modules/page/FEAT-002-page-translation#render`
- Governing: `spec://modules/translation/FEAT-001-engine#validation`
- Constraint: `spec://modules/page/FEAT-002-page-translation#sessions`
- Constraint: `spec://common/PROP-002-quality#resources`
- Affected: `spec://modules/page/FEAT-002-page-translation#render`
- Affected: `spec://modules/translation/FEAT-001-engine#validation`

## Scope

- In: inline границы Text nodes, prompt и cache version; conservative typography; ссылки, сноски, формы, restore, streaming и внешний DOM; mock Chrome/Firefox.
- Out: переписывание DOM/HTML, разделение слов внутри ошибочного слитного ответа модели по словарю.

## Acceptance

- [x] Китайский текст с inline ссылками воспроизведён; русский результат имеет пробелы, пунктуация/сноски/BR/разные блоки сохраняются.
- [x] Порядок готовности батчей/stream previews, original/translated, внешние правки не создают дублей пробелов или устаревших записей.
- [x] Ссылки/события/формы и их оформление сохранены, увеличение шрифта ограничено смысловыми блоками.
- [x] Новая версия prompt изолирует старые кэшированные ответы; регрессии и браузерные проверки обеих платформ выполнены.
- [x] Ресурсы проверены; языковая точность real API не объявлена проверенной.

## Dependencies

- Related: `WI-012`, `WI-014`, `WI-017`.

## Result

2026-10-08: было сохранение только исходных краевых пробелов, из-за чего CJK inline nodes склеивали русские слова → renderer сохраняет модельные краевые пробелы для CJK и добавляет один owned пробел между буквенными переводами на непосредственно касающейся CJK границе. Обход ограничен 64 шагами/8 уровнями, не пересекает block/BR/images и не добавляет пробел перед punctuation/sup/sub. Изначально буквенная склейка сохраняется, включая `请用i<b>Phone</b>阅读。` → «Используйте iPhone для чтения.». Нет новых wrappers/HTML, текущие Text/Element objects остаются прежними. Внутри ошибочно слитного русского ответа слова не угадываются.

Было изменение размера любого простого текстового HTML parent → коррекция только смысловых leaf-блоков вне nav/aside/forms/buttons/tables/nowrap. Ссылки, inline spans, пользовательский ввод и обработчики сохраняются. Original восстанавливает исходный Text; принадлежащие font-size/line-height снимаются. CSSOM в отдельных браузерах может оставить пустой `style=""`; browser restore сравнивает весь HTML с нормализацией только этого пустого атрибута. Это не восстановление HTML из модели и не обещание идентичного layout при любой длине перевода.

Prompt явно требует обычного разделения слов целевого языка и согласования inline фрагментов без переноса текста между ID. `PROMPT_VERSION` linguisty-1→linguisty-2 изолирует прежние ответы в ограниченном TTL/LRU cache; исходные данные пользователя не удаляются.

Проверки: unit tests для обратного порядка готовности соседей, Unicode seams, punctuation/sup/BR/Latin joins, внешних правок, восьми toggles без новых requests и консервативной typography. Общий прогон 566 tests / 33 suites, typecheck/lint и 8 package/hygiene tests PASS. Финальные Chrome/Firefox сборки и manifests PASS. После упаковки полный smoke Chrome 13 scenarios + parent / Firefox 14 groups PASS. Большая fixture переводит все 28 исходных узлов при обычных и искусственно обрезанных ответах; inline вывод «Искусственный интеллект может обучаться.[1]», element identity/events/input/styles сохранены, четыре toggles восстановили source без сети. Снимки `test-results/linguisty-smoke/large-page-translated.png` и `test-results/linguisty-firefox/large-page-translated.png` осмотрены. Прочие lifecycle/cache/streaming регрессии также прошли; final Firefox fingerprint неизменен, ZIP побайтно совпадают со сборками.

Ресурсы проверены вместе с WI-017: duplicates/suspicious/hash-skipped=0, project .cache без роста, собственные браузерные процессы и profiles очищены, mock requests/timers=0. Никаких paid API запросов: журнал пользовательской попытки, реальная языковая точность и скорость Gemini Flash Lite не проверены. Детали исследования — `docs/RESEARCH.md`.
