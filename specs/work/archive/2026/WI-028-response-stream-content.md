# WI-028: Сохранять завершённый текст Responses stream

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Завершённые сообщения из Responses SSE не теряются при пустом terminal output; отказ без текста имеет точный безопасный код.

## Specs

- Governing / Affected: `spec://modules/platform/INFRA-004-codex-connection#requests`.
- Constraint: `spec://common/PROP-002-quality#checks`, `spec://common/PROP-002-quality#resources`, `spec://common/PROP-002-quality#hygiene`.

## Scope

- In: reader Responses, fixed diagnostic labels, contract/security tests, реалистичные browser fixtures обеих платформ, production packages и QA.
- Out: чтение пользовательских токенов/сырых ответов, live paid inference, смена Luna 6, ослабление parser/cache, публикация и WI-011 cleanup.

## Acceptance

- [x] До/после воспроизведена потеря final_answer из output_item.done при completed.output=[].
- [x] Завершённый текст используется только после response.completed/status=completed, commentary/refusal/incomplete/abort не становятся успехом.
- [x] При повторении aggregate/stream текст не дублируется; противоречия и malformed events отклоняются; ограничения bytes/reader cleanup сохранены.
- [x] Остаточные content-ошибки имеют фиксированные причины без body/claims/токенов/текста страницы.
- [x] Typecheck/lint/unit, Chrome/Firefox builds, browser fixture и manifest/пакеты проверены; live причина пользовательского отказа явно не выдумана.
- [x] Кэш/дубли/RAM и освобождение QA ресурсов проверены до, между и после основной задачи.

## Dependencies

- Related: `WI-026`, `WI-027`.

## Result

Было → стало: reader игнорировал завершённые message events и использовал только terminal output → text из output_item.done сохраняется по output_index, подтверждается terminal response.completed/status=completed и объединяется с aggregate без дублей. До правки регрессия воспроизвела точный LGT-response-content; после PASS. Пустой aggregate больше не теряет завершённый текст. Commentary/raw deltas/refusal/incomplete не становятся переводом; conflicting items отвергаются. Map ≤128 slots, wire/output ≤1 MiB, reader cancel/release и очистка Map в finally.

Общий content код разделён на фиксированные output/message/phase/status/part/empty/commentary/conflict причины. Код проходит port/public progress/localization без arbitrary body, metadata или текста; parser/cache не ослаблены и выбранный gpt-6-luna сохранён.

Typecheck/lint, 739 Vitest tests / 47 files, 9 manifest/hygiene tests, обе production builds и ZIP PASS. По 28 файлов / 24 referenced assets; ZIP Chrome 441 258 / Firefox 441 344 bytes, manifest=0.4.6, все архивные файлы совпадают через SHA-256 с проверенными сборками. Mozilla: errors/notices/warnings=0. В каждой платформе 8 browser groups, 1 340/1 340 узлов / 84 fixture requests, repeat из кэша 1 340 / 0 requests. Incomplete и empty completed ошибки не меняют исходный DOM/cache, фиксированные коды доходят до progress, pending=0.

.cache до/между/после 5 652 files / 203 426 930 bytes, source duplicates/suspicious=0; QA/watch=0. Firefox освобождает 13 своих процессов / 1 368 829 952 bytes working set и собственный profile; Chrome context/profile закрыты. RAM snapshots сохранены, отсутствие всех возможных утечек не обещается. Свидетельства: docs/QA-SUBSCRIPTION.md, test-results/linguisty-response-stream/. Прежний UI chunk TD-002 остаётся открытым: 609 125 bytes.

Реальный ответ пользователя не получен; совпадение причины LGT-response-content и live inference/точность Luna 6 не утверждаются. Подпись/публикация и native Chrome toolbar geometry не выполнены. Чужие процессы/кэш и WAL/WI-011 сохранены.
