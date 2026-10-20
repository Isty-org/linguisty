# Linguisty — технические ограничения

## Open

### TD-001: Две области ключа без общей транзакции

- Area: storage/secrets.
- Related specs: `spec://modules/storage/INFRA-002-local-data#secrets`.
- Introduced by: WI-003.
- Current state: persistent ключ и keyMode коммитятся одной local записью; переход в session сначала готовит session, затем коммитит local. Browser API не предоставляет общую транзакцию двух областей.
- Risk: аварийная остановка между операциями может оставить временную копию в неактивной области.
- Trigger: остановка процесса между записью и удалением.
- Mitigation: WI-030 сериализовал repair/settings/configuration, добавил best-effort rollback каждой начатой записи и запретил возвращать stale ключ из неактивной области при известном committed mode. Чтение/сохранение следуют committed mode; следующее сохранение убирает остаток, отдельное удаление очищает обе области. Это не обещание атомарности при kill браузера.
- Work: [WI-030](work/archive/2026/WI-030-storage-recovery.md), завершён 2026-10-12. Физическое ограничение API остаётся; подтверждённые дефекты recovery исправлены.

Непроведённые проверки перечисляются в QA report и не являются автоматически принятыми дефектами реализации.

## Resolved

### TD-002: Все словари в общем UI chunk

- Area: interface/localization build.
- Related specs: `spec://modules/interface/FEAT-003-controls#languages`, `spec://common/PROP-002-quality#resources`.
- Introduced by: WI-020.
- Current state: исправлено 2026-10-12 в [WI-029](work/archive/2026/WI-029-locale-loading.md). en/ru доступны синхронно; остальные 14 языков и дополнительные CLI/ChatGPT строки загружаются локальными chunks по выбору.
- Risk removed: загрузка и разбор всех 16 полных packs при открытии каждого UI.
- Evidence: общий UI chunk 609125 → 259999 bytes (-57.3%); обе production builds 0.4.7 без предупреждения >500 kB. Callback 843 bytes + compact labels 11491 bytes, background 88243 bytes без полных словарей. Chrome resource check подтвердил 0 eager locale chunks, затем только выбранные de/fr; Firefox locale/offline проверены, Resource Timing там не измеряет module requests.
- Mitigation: английский fallback при недоступном chunk, защита от устаревшей загрузки, bounded cache на 16 локалей и cleanup подписок покрыты UI regression tests.
- Work: WI-029; browser evidence в WI-031 и `docs/QA-2026-10-12.md`.
