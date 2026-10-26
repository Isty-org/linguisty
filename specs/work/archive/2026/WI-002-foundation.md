# WI-002: Shared contracts and build

- Kind: `implement`
- Canon action: `none`

## Outcome

The shared contract is available to all implementers; one dependency installation and configuration produce two browser targets.

## Specs

- Governing: `spec://common/PROP-001-contracts#types`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In: package/lock, TypeScript/WXT/Vitest/ESLint, shared contracts/constants/errors/messaging, entrypoint skeleton.
- Out: provider, storage, DOM, and UI implementation.
- Owned paths: root configurations, `src/shared/**`, package/lock.

## Dependencies

- Depends on: WI-001.

## Acceptance

- [x] Dependencies are installed once; shared foundation prepare/typecheck pass.
- [x] Shared types and imports match the specification; there are no duplicate contracts.
- [x] WXT supports Chrome and Firefox MV3, activeTab/script injection, and optional API origins.
- [x] Configuration limits test workers and excludes derived folders.

## Result

2026-10-07: created shared contracts/constants/errors/messaging, WXT/TS/ESLint/Vitest configs, and two entrypoint skeletons. Ran npm install and wxt prepare. Foundation typecheck/lint passed. npm audit initially found 4 vulnerable packages; Vitest was updated to 5.0.3 and sharp to 0.35.5; repeat audit: 0 vulnerabilities. One node_modules, 184.62 MiB at the foundation stage, .wxt ~0.01 MiB, available RAM 14.87 GiB. Six implementers were launched with gpt-6.1-sol/max; unverified integration was not declared ready. Minimum Firefox 140 with correct provider data transmission declarations.
