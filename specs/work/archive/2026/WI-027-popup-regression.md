# WI-027: Компактные настройки popup и проверка регрессий

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Проверенная сборка Linguisty с шестерёнкой настроек в popup и исправленными воспроизведёнными регрессиями.

## Specs

- Governing / Affected: `spec://modules/interface/FEAT-003-controls#popup`.
- Governing: `spec://modules/interface/FEAT-003-controls#design`, `spec://modules/interface/FEAT-003-controls#errors`.
- Governing / Affected: `spec://common/PROP-001-contracts#messages`.
- Governing: `spec://modules/storage/INFRA-002-local-data#settings`.
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`, `spec://common/PROP-002-quality#hygiene`.

## Scope

- In: popup gear, доступное имя и tooltip, обзор и regression checks UI/перевода/кэша/отмены, исправление доказанных сбоев, production packages обеих платформ.
- Out: платный inference, публикация/подпись Firefox, изменение выбранной пользователем Luna 6, очистка чужого кэша и WI-011.

## Acceptance

- [x] Шестерёнка вместо видимой подписи, локализованное доступное имя, click target 44 px; keyboard/theme/RTL проверены.
- [x] Старый popup сохраняет только языки; новая модель, провайдер, режим ключа и остальные настройки не откатываются. Регрессия подтверждена тестом до/после.
- [x] Выполнены typecheck, lint, осмысленные unit и browser regression проверки Chrome/Firefox; найденные баги описаны по фактам.
- [x] Подготовлены и проверены ZIP обеих платформ с совпадающими manifest versions.
- [x] Кэш, дубли, память и освобождение собственных QA ресурсов проверены в промежуточных и финальном этапах.
- [x] Непроверенные live-сценарии явно указаны; Result и канон согласованы.

## Dependencies

- Related: `WI-026`.

## Result

Было → стало: текстовая кнопка настройки → шестерёнка 44×44 px с локализованными aria-label/title и декоративным SVG. Обе темы, 16 локалей, RTL, клавиатурный focus и Enter проверены в обеих платформах.

Воспроизведён новый баг: язык из старого popup возвращал прежние provider/model/theme/instructions. До правки регрессия FAIL, после PASS. languagesOnly=true применяет только язык/режим поверх последней конфигурации под существующей очередью; ключ в этом режиме отклоняется. Новая модель Luna 6 не заменяется. Есть queue/security проверки и actual Chrome popup/Firefox background evidence.

Проверки: typecheck/lint PASS; 705 Vitest tests / 47 files, 15 Native fixtures, 9 manifest/hygiene tests PASS. Chrome: 13 групп общего smoke, Firefox: 14, все PASS. Подписка: по 8 групп, 1 340/1 340 узлов / 84 fixture requests, повтор целиком из кэша, incomplete отклонён и не кэшируется. Ошибка Chrome UI test с закрытым API URL исправлена на проверку tab IDs; production permissions не расширены.

Версия 0.4.5 совпадает в package.json/lock/WXT и ZIP manifest. ZIP Chrome 440 832 / Firefox 440 918 bytes; по 28 файлов совпадают через SHA-256 с проверенными сборками. Mozilla: 0 errors/notices/warnings. .cache 5 652 files / 203 426 930 bytes неизменён на контрольных этапах, source duplicates/suspicious=0, remaining QA/watch processes=0; собственные browser profiles удалены. Firefox working-set/lifecycle и RAM snapshots сохранены, отсутствие любых утечек не обещается. Sources ZIP исключает временные результаты/кэш; собственная документация и архив WI включены.

Полные факты: docs/QA-POPUP.md и test-results/linguisty-popup-regression/. Live Luna 6 и причина исходных 22 пользовательских отказов без реального ответа остаются неподтверждёнными. Firefox signing/store install/native Chrome toolbar geometry не выполнены; прежний UI chunk 608 946 bytes остаётся TD-002. WAL/WI-011 и чужие процессы/кэш сохранены.
