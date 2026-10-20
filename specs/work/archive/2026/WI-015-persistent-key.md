# WI-015: Сохранение ключа при перезапуске и обновлении

- Kind: `fix`
- Canon action: `direct-edit`

## Outcome

Постоянный ключ и выбранный режим не теряются из-за устаревшего UI или раздельного сохранения настроек и ключа; границы временной установки Firefox явно описаны.

## Specs

- Governing / Affected: `spec://modules/storage/INFRA-002-local-data#secrets`
- Governing / Affected: `spec://modules/interface/FEAT-003-controls#options`
- Governing / Affected: `spec://common/PROP-001-contracts#messages`
- Constraint: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-002-quality#checks`

## Scope

- In: storage/settings/secrets, background save, UI save callers, regression tests, Firefox lifecycle evidence, installation documentation, updated packages.
- Out: чужие профили Firefox, ключи пользователя, публикация или подпись от его имени.

## Acceptance

- [x] Тест воспроизводит возврат persistent в session через устаревшее окно.
- [x] Сохранение языка/темы без явной смены режима сохраняет актуальный keyMode.
- [x] Persistent ключ и keyMode сохраняются одним local write; прерванное сохранение и отказ хранилища не стирают прежний ключ.
- [x] Session, явная смена режима и удаление обеих копий проходят regression tests.
- [x] Firefox reload/restart/update проверены в доступном изолированном окружении, ограничения temporary/signing записаны без обещания непроверенного.
- [x] Typecheck/lint/tests, обе сборки и package checks выполнены; ресурсы и дубли проверены.

## Result

Было → стало: stale UI мог вернуть persistent в session, а ключ и mode сохранялись раздельно → preserveKeyMode сохраняет текущий выбор под mutation queue, saveConfiguration пишет local ключ и настройки вместе и откатывает отказ. При остаточной копии от прерванного обновления source определяется committed mode. Key/status остаются разделены, публичный ответ не содержит секрет.

0.1.1: typecheck/lint PASS; 417 unit/contract/DOM tests (20 suites, <=2 workers), 7 manifest/hygiene tests, 5 fixtures. Обе production build/ZIP, manifest/secret/resource checks и byte comparison PASS. Chromium: 9 pipeline scenarios + UI + startup (12 Node tests с parent); Firefox157.0.1: 10 groups и 2 key lifecycle scenarios PASS. Actual reload/higher-version same-ID install сохраняют local ключ; после настоящего browser exit/start и temporary reinstall в том же профиле ключ сохранился с default и test preservation preferences. Signed permanent install и обновление Firefox executable не проверялись. Mozilla linter10.13.0: 0 errors/notices/warnings. Подробности/ZIP hashes: docs/QA-REPORT.md и test-results/linguisty-key-lifecycle/.

Успешные собственные профили/Firefox processes очищены; новых cache/source дублей нет, источник dependencies не дублировался и install не выполнялся. Старый cache WI-011 не изменялся. Реальный API и ключ пользователя не использовались.
