# Linguisty development plan

Historical plan for the first release and the 2026-10-12 implementation wave. Current status is maintained in the [BOARD](../../specs/BOARD.md).

The first-release goal is a complete page-translation workflow in **Firefox and Chrome**, with OpenRouter/BYOK and OpenAI-compatible services, without a project server. The plan follows the original materials; the integration sequence is retained while independent internal modules are developed in parallel against established contracts.

## Waves

| Wave | Work | Result and transition condition |
|---|---|---|
| 0 | WI-001, WI-002 | Documentation, ownership, shared types, tools, and one dependency installation |
| 1, parallel | WI-003…WI-008 | Storage/cache, engine/providers, page DOM, background, UI, fixtures/manifest checks/assets |
| 2 | WI-009: coordinator + assigned fixes within the same WIs | Integrated pipeline; conflicts and defects resolved based on integration results |
| 3, parallel acceptance | WI-008, WI-010, and final coordinator verification | Typecheck, lint, contract/DOM tests, both builds, Chromium and Firefox runtime, report, and hygiene |

Do not confuse parallel module development with premature implementation of future features. Native provider adapters from later milestones are not implemented alongside the MVP. Shared-contract correctness matters more than the number of open chats.

## Dependencies

```text
WI-001 → WI-002 → ┬ WI-003 Storage ────────┐
                 ├ WI-004 Engine ────────┤
                 ├ WI-005 DOM ──────────┼→ WI-006 Background → Integrated smoke
                 ├ WI-007 UI ───────────┤
                 └ WI-008 QA/assets ────┴→ Acceptance / artifacts
```

Wave 1 starts after shared/contracts is created; each module writes its own tests. The background can implement handlers before dependency implementations exist by importing the established interfaces. QA prepares independent fixtures/assets/checks, then tests the live pipeline after integration. WI-010 independently checks installed Firefox in a temporary profile: Chromium smoke does not establish Firefox runtime behavior.

## Coordination

The contributors for the 2026-10-12 pass were separate local **gpt-6-sol / max** chats, with **gpt-6-astra / high** as independent auditor, as explicitly requested by the user. Earlier waves used gpt-6.1-sol / max. The coordinator assigns WIs and permitted paths, observes results/status through wait_threads, reviews code, and returns specific defects to the same contributor. New chats are needed only for independently verifiable outcomes. Shared files and the lockfile are not edited concurrently.

That pass assigned WI-029 to remove eager loading of all dictionaries, WI-030 to fix local-data recovery, and WI-031 to verify version 0.4.7. After implementation and acceptance, WI-032 performs an independent audit; confirmed findings receive separate Sol/max fix WIs and rechecking. Actual statuses live only in BOARD.

## Checkpoints

1. Before starting: new requirements are recorded, all WIs and links exist, and imports are known.
2. After modules: results/tests are reviewed; secret boundaries are preserved; API/types are not duplicated; queues/cache/memory are bounded.
3. After integration: background and page use the same messages; stopping/restoration are tested.
4. Before completion: checks are performed; artifacts and installation are available; actual limitations are stated plainly.

Paid-account setup, real language evaluation without a key, and store publication cannot be replaced by fictional success.

## After local version 0.1.0

1. Live language evaluation using the user's OpenRouter account: French property listings, numbers/areas/names, several models, time and cost; native toolbar/activeTab and installation consent.
2. Independent product tasks next: bilingual/selection/context menu, native provider adapters, glossary, and per-site automatic translation. Each needs its own canonical requirements, WI, and verifiable scenario first.
3. Firefox signing and store publication are a separate release after listing/privacy materials are prepared and the user explicitly requests it.

Waves 0–3 were implemented; actual results and limitations are in the [QA report](QA-REPORT.md) and [BOARD](../../specs/BOARD.md). These subsequent stages were not started automatically.
