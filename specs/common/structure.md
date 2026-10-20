# Техническая карта Linguisty {#root}

## Модули и ownership {#modules}

| Module | Namespace | Код / тесты | Владелец пути при первой реализации |
|---|---|---|---|
| common | spec://common/ | src/shared/**, package.json, lockfile, конфигурация, docs/** | координатор |
| storage | spec://modules/storage/ | src/storage/**, src/cache/**, tests/storage/**, tests/cache/** | storage chat |
| translation | spec://modules/translation/ | src/providers/**, src/translation/**, tests/providers/**, tests/translation/** | engine chat |
| page | spec://modules/page/ | src/content/**, entrypoints/translate.ts, tests/content/** | page chat |
| platform | spec://modules/platform/ | src/background/**, entrypoints/background.ts, tests/background/** | background chat |
| local-cli | spec://modules/platform/INFRA-003-local-cli#root | native-host/**, src/providers/nativeClient.ts, src/providers/cliProvider.ts, tests/native/** | координатор |
| codex-connection | spec://modules/platform/INFRA-004-codex-connection#root | src/codex/**, src/providers/codexProvider.ts, entrypoints/codex/**, entrypoints/codex-callback/**, tests/codex/** | координатор |
| interface | spec://modules/interface/ | src/ui/**, entrypoints/popup/**, entrypoints/options/**, tests/ui/** | UI chat |
| quality | spec://common/PROP-002-quality#checks | scripts/**, tests/fixtures/**, tests/e2e/**, public/icon/**, docs/QA-REPORT.md | QA chat |

Это назначенные пути реализации; их наличие проверяется при приёмке. Таблица не утверждает, что модули уже готовы. Фактический baseline и прогресс отражены в WI.

## Операционные документы {#operations}

SPEC-MAP — каталог; BOARD — status/owner; work/WI — scope/acceptance/results; archive/2026 — завершённые WI; WAL — только актуальные checkpoints; TECHDEBT — долгоживущие компромиссы. Локальная `.me` игнорируется Git. Stock examples в проект не копируются.

