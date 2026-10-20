# WI-002: Общие контракты и сборка

- Kind: `implement`
- Canon action: `none`

## Outcome

Общий контракт доступен всем исполнителям, одна установка зависимостей и конфигурация выпускают две browser targets.

## Specs

- Governing: `spec://common/PROP-001-contracts#types`
- Governing: `spec://modules/platform/INFRA-001-extension#build`
- Constraint: `spec://common/PROP-002-quality#resources`

## Scope

- In: package/lock, TypeScript/WXT/Vitest/ESLint, shared contracts/constants/errors/messaging, entrypoint skeleton.
- Out: provider, storage, DOM, UI реализация.
- Owned paths: корневые конфиги, `src/shared/**`, package/lock.

## Dependencies

- Depends on: WI-001.

## Acceptance

- [x] Зависимости установлены один раз, prepare/typecheck shared foundation проходят.
- [x] Shared types и imports совпадают со спецификацией; нет дублированных contracts.
- [x] WXT знает Chrome и Firefox MV3, activeTab/script injection и optional API origins.
- [x] Конфигурация ограничивает test workers и исключает производные папки.

## Result

2026-10-07: общие contracts/constants/errors/messaging, WXT/TS/ESLint/Vitest configs и два entrypoint skeleton созданы. npm install и wxt prepare выполнены. Foundation typecheck/lint прошли. npm audit сначала обнаружил 4 уязвимых пакета; Vitest обновлён до 5.0.3 и sharp до 0.35.5, повторный audit: 0 vulnerabilities. Одна node_modules, 184.62 MiB на этапе foundation, .wxt ~0.01 MiB, доступная RAM 14.87 GiB. Шесть исполнителей запущены gpt-6.1-sol/max, непроверенная интеграция не объявлена готовой. Minimum Firefox 140 с корректными declarations provider data transmission.

