# WI-009: Координация и приёмка интеграции

- Kind: `implement`
- Canon action: `direct-edit`

## Outcome

Независимые результаты исполнителей соединены в проверяемую локальную версию Linguisty; документация, доска и фактическая готовность согласованы.

## Specs

- Governing: `spec://common/PROP-001-contracts#root`
- Affected: `spec://common/PROP-001-contracts#modules`
- Governing: `spec://common/PROP-002-quality#checks`
- Constraint: `spec://common/PROP-000-product#acceptance`

## Scope

- In: управление назначенными чатами, review результатов, исправления shared/config интеграции, return defects своим владельцам, финальные builds/checks, документы/доска/архив.
- Owned: shared/config/package/lock/docs/specs как у координатора; production-owned paths при активном исполнителе не переписываются.
- Out: future features, реальная языковая оценка без предоставленного ключа, публикация в магазинах.

## Dependencies

- Depends on: WI-002; независимые модули WI-003…WI-008.

## Acceptance

- [x] Контракты совпадают; нет альтернативных типов/дублирующих модулей или конфликтов ownership.
- [x] Промежуточные дефекты устранены и результаты исполнителей просмотрены.
- [x] Финальные typecheck/lint/tests, Chrome/Firefox builds и manifest checks выполнены после исправлений.
- [x] Browser smoke доступного runtime выполнен; непроведённые browser/real-provider проверки прямо указаны.
- [x] Кэш/дубли/ресурсы проверены; нет забытых собственных helper/watch-процессов.
- [x] Доска, WI Results, ссылки, документация и артефакты соответствуют фактам.

## Result

Принято координатором 2026-10-07. Было: исходный план/дизайн без реализации и Chrome вне v1. Стало: Linguisty 0.1.0, общий канон, план, shared contracts, Chrome/Firefox production packages и проверенный локальный pipeline.

- Созданы и проконтролированы 7 локальных чатов gpt-6.1-sol / max: storage/cache, engine/providers, page DOM, background, UI, QA/assets и Firefox runtime. Пути не пересекались; одна node_modules/lock. Все результаты просмотрены, модули и acceptance приняты.
- Root подготовил спецификации/контракты/сборку; согласовал включение Chrome и имя; Firefox min140/data consent, обновление зависимостей до 0 audit vulnerabilities. Интеграционные дефекты возвращались владельцам до проверки, а не маскировались изменением acceptance.
- SPA loading/same-document, cancellation/original, secret migration rollback, contextual cache/dedup и stable group labels исправлены. Добавлены cacheHitIds для точного live-node progress; root синхронизировал UI raw authority/C0/DEL validation с чистой normalization, model200, key4096. Неподдерживаемое отсутствие session API не вызывает silent persistent fallback.
- Финальные checks: typecheck PASS, lint PASS, 391 unit/contract/DOM tests PASS; 6 manifest/hygiene tests и 5 fixtures PASS; production build/zip обоих браузеров и manifest/assets/permission/CSP/heuristic credential checks PASS.
- Browser final: 9 Chromium scenarios PASS на 152.0.7977.8 и 10 Firefox groups PASS на 157.0/geckodriver0.37.1. Обе неизменённые сборки использовали loopback mock, по52 requests/max2 concurrent; конец activeRequests/timers0, временные profiles/server и собственные процессы закрыты. Firefox три repeated lifecycle cycles обнуляют session timers/observers/listeners; closed snapshots удалены.
- QA report, FIREFOX-QA, README, DEVELOPMENT, TESTING и PLAN согласованы. BOARD хранит Done текущего релиза, WAL без незавершённых checkpoints. Результаты и screenshots — ignored test-results. Derived folders исключены из source ZIP; ZIP contents сверяются с проверенными production bytes. Source archive дополнительно пересобирается с общей установкой dependencies.
- Кэш/дубли/RAM проверены промежуточно и в конце; node_modules около184.6 MiB, QA driver cache4.1MB с metadata, без скачанного дубля ZIP или profiles. RAM snapshot не объявляется доказательством отсутствия всех утечек; lifecycle tests проверяют конкретные ресурсы. Чужие процессы/кэш не удалялись.
- Real OpenRouter/semantic accuracy, native toolbar/activeTab-only, signed store install и полный accessibility audit остаются непроверенными и прямо перечислены в QA report. Crash-atomic перенос двух key stores — TD-001. Следующие продуктовые этапы сохранены в PLAN, автоматически не начаты.

