# WI-036: Приёмка исправлений независимого аудита

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Версия 0.4.9 содержит проверенные исправления A1–A3 из WI-032 и дополнительный Firefox lifecycle fix WI-037, новые ZIP и честный итог QA; Astra повторно проверяет устранение своих находок.

## Specs

- Governing: `spec://common/PROP-002-quality#checks`
- Governing: `spec://common/PROP-002-quality#hygiene`
- Constraint: `spec://common/PROP-000-product#acceptance`
- Affected: `spec://modules/translation/FEAT-001-engine#errors`
- Affected: `spec://modules/storage/INFRA-002-local-data#contracts`

## Scope

- Coordinator paths: version metadata в package/lock/wxt, общие docs, specs/BOARD/WAL/TECHDEBT/архивирование и этот WI.
- Auditor follow-up paths: только дополнение closure к `docs/AUDIT-2026-10-12.md`; production read-only.
- In: интеграционная проверка WI-033…035, long-batch и journal browser scenarios, обе сборки/manifest/ZIP/Mozilla, ресурсы и повторная проверка Astra.
- Out: live paid/login, публикация/подпись, обход blocked cleanup WI-011.

## Acceptance

- [x] A1–A3 исправлены и подтверждены регрессиями; повторная проверка Astra завершена.
- [x] Typecheck/lint/unit/native, обе сборки и manifests проходят.
- [x] Затронутые браузерные сценарии Chrome/Firefox и long-batch проходят; ограничения явно записаны.
- [x] ZIP точно совпадают с проверенными сборками; Mozilla linter без warnings.
- [x] Проверены ссылки/дубли/cache/RAM и отсутствие собственных helpers, обновлены docs/BOARD.

## Result

0.4.8: 767 tests, typecheck/lint/native/manifests, оба full browser14/14, mockChatGPT и journal PASS. Long-batch Chrome PASS, Firefox FAIL из-за подтверждённой выгрузки event page около30s. Продолжение: WI-037, новые build0.4.9 и окончательная приёмка.

Принято 2026-10-13: 0.4.9, 780 tests/50 files, typecheck/lint/native15, обе сборки/manifests, полные browser14/14 на каждой платформе, long-batch2/2 и mockChatGPT PASS. ZIP56/56 побайтно проверены, Mozilla0/0/0. Astra closure A1–A3/WI037: новых находок нет. README/QA/TESTING обновлены; ссылки, дубли, RAM и отсутствие QA helpers проверены. WI011 остаётся отдельно Blocked из-за automatic approval review, не объявлен завершённым. Отчёт: docs/QA-2026-10-13.md.
