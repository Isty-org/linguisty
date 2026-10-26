# Linguisty technical map {#root}

## Modules and ownership {#modules}

| Module | Namespace | Code / tests | Path owner during initial implementation |
|---|---|---|---|
| common | spec://common/ | src/shared/**, package.json, lockfile, configuration, docs/** | coordinator |
| storage | spec://modules/storage/ | src/storage/**, src/cache/**, tests/storage/**, tests/cache/** | storage chat |
| translation | spec://modules/translation/ | src/providers/**, src/translation/**, tests/providers/**, tests/translation/** | engine chat |
| page | spec://modules/page/ | src/content/**, entrypoints/translate.ts, tests/content/** | page chat |
| platform | spec://modules/platform/ | src/background/**, entrypoints/background.ts, tests/background/** | background chat |
| local-cli | spec://modules/platform/INFRA-003-local-cli#root | native-host/**, src/providers/nativeClient.ts, src/providers/cliProvider.ts, tests/native/** | coordinator |
| codex-connection | spec://modules/platform/INFRA-004-codex-connection#root | src/codex/**, src/providers/codexProvider.ts, entrypoints/codex/**, entrypoints/codex-callback/**, tests/codex/** | coordinator |
| interface | spec://modules/interface/ | src/ui/**, entrypoints/popup/**, entrypoints/options/**, tests/ui/** | UI chat |
| quality | spec://common/PROP-002-quality#checks | scripts/**, tests/fixtures/**, tests/e2e/**, public/icon/**, docs/archive/QA-REPORT.md | QA chat |

These are the assigned implementation paths; their presence is verified at acceptance. The table does not claim that modules are complete. Work items record the actual baseline and progress.

## Operational documents {#operations}

SPEC-MAP is the catalog; BOARD holds status/owner; work/WI holds scope/acceptance/results; archive/2026 holds completed work items; WAL holds only active checkpoints; TECHDEBT holds long-term tradeoffs. Local `.me` is ignored by Git. Stock examples are not copied into the project.

## Repository layout {#layout}

| Location | Purpose |
|---|---|
| Root README, AUTHORS, LICENSE, THIRD_PARTY_NOTICES | Project entry, authorship, and distribution terms |
| Root package/build/tool configuration | Files required by npm, WXT, TypeScript, ESLint, and Vitest |
| `src/`, `entrypoints/`, `native-host/` | Extension implementation, WXT entry points, and legacy CLI connector |
| `public/` | Assets packaged with the extension |
| `tests/`, `scripts/` | Verification and build utilities |
| `docs/README.md` | Human-facing documentation index |
| `docs/guides/` | Installation, connection, development, and testing guides |
| `docs/design/` | Current design, source references, and reference-only assets |
| `docs/product/` | Original product plan, distinct from current canonical requirements |
| `docs/releases/` | Release notes |
| `docs/archive/` | Historical audits, QA evidence, and development plans |
| `docs/RESEARCH.md` | Research sources and decision evidence |
| `specs/` | Canonical requirements and the existing work-item workflow |
| `.output/`, `.wxt/`, `.cache/`, `test-results/`, `node_modules/` | Ignored local outputs, caches, evidence, and dependencies |

Do not move runtime modules or tool configuration merely to reduce the root file count. Documentation moves must update relative links and plain path references together. Keep `spec://` namespaces, IDs, and explicit anchors stable.

## Documentation language {#documentation}

English is the default for all repository documentation, including specifications, protocols, work items, historical reports, and future commit/PR/release text. Preserve evidence and exact legal notices; proper names and localized UI/test examples may retain their original spelling with English context. This rule does not change the extension's UI languages or the user's conversation language.

## Changelog {#changelog}

- 2026-10-26: adopted English throughout repository documentation and grouped guides, references, releases, and historical evidence by purpose; source-module ownership and spec addresses remain unchanged.

