# WI-039: MIT с авторством Никиты Цыжмана

- Kind: `change`
- Canon action: `direct-edit`

## Outcome

Linguisty опубликован под MIT с copyright Никиты Цыжмана @tsyzhman; исходники и пакеты Chrome/Firefox нового релиза v0.4.10 содержат лицензию.

## Specs

- Governing: `spec://common/PROP-000-product#licensing`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://common/PROP-002-quality#hygiene`
- Affected: `spec://common/PROP-000-product#licensing`
- Affected: `spec://modules/platform/INFRA-001-extension#build`

## Scope

- In: LICENSE, сторонние notices, metadata и version 0.4.10, автоматическое включение лицензий в build/ZIP, проверки пакетов, документация, tag и GitHub Release.
- Out: изменение runtime-поведения, перезапись опубликованного v0.4.9, магазинная публикация, подпись Firefox, реальные платные запросы и чужой кэш.

## Acceptance

- [x] MIT содержит `Copyright (c) 2026 Никита Цыжман (@tsyzhman)`; сторонние copyright и OFL сохранены.
- [x] Metadata и канон согласованы; Chrome/Firefox автоматически включают точные LICENSE/notices из корня.
- [x] Проверки build/manifest, необходимые тесты и доступный browser smoke проходят; фактические ограничения записаны.
- [ ] v0.4.10 опубликован; GitHub распознаёт MIT, скачанные assets совпадают по SHA-256, проверены ресурсы и дубли.

## Result

Локальная приёмка завершена: typecheck/lint, 780 unit, 15 native, 10 manifest/license contracts, обе сборки и целевой browser smoke Chrome/Firefox PASS; Mozilla 0/0/0. Все прежние runtime/assets совпадают с v0.4.9, manifest отличается только номером версии; каждый из двух ZIP содержит 58 проверенных файлов. Root MIT и original third-party notices сверены. QA: `docs/QA-MIT-2026-10-20.md`. Следующий шаг — commit/tag, публикация v0.4.10 и проверка GitHub license detection/assets; WI закрывается после фактической публикации.
