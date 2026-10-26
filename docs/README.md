# Linguisty documentation

Start with the [project README](../README.md) to install a release and translate a page. Documentation is in English; the extension's interface remains available in 16 languages.

## Guides

- [Development and installation](guides/development.md): prerequisites, building, Chrome/Firefox installation, and key persistence.
- [ChatGPT subscription connection](guides/chatgpt-connection.md): sign-in, connection lifetime, safe error codes, and preview limitations.
- [Testing and acceptance](guides/testing.md): automated checks, browser scenarios, and live-provider evaluation.
- [Legacy CLI connection](guides/legacy-cli.md): historical Windows connector instructions; these providers are no longer offered in the current UI.

## Product and design

- [Current product scope](../specs/common/PROP-000-product.md) and [architecture/contracts](../specs/common/PROP-001-contracts.md) are the canonical requirements.
- [Original product plan](product/original-plan.md) preserves the source material; later user decisions and specifications take priority.
- [Current design](design/README.md) explains the Retro Orbit Editorial adaptation for Linguisty.
- [Retro Orbit source](design/isty-retro-orbit-reference.md) and [superseded Cloudline source](design/isty-cloudline-superseded.md) retain the complete design references.
- [Original PNG reference](design/assets/original-logo.png) is a historical reference asset. Runtime brand assets live in `public/brand/`.
- [Research](RESEARCH.md) records external sources, decisions, and evidence limitations.

## Releases and evidence

- [v0.4.10 release notes](releases/v0.4.10.md): MIT license and packages.
- [v0.4.9 release notes](releases/v0.4.9.md): first GitHub release.
- [Historical reports](archive/README.md): full QA results, audits, and development history, with their original dates and limitations.

## Contributor workflow

- [AGENTS](../AGENTS.md) and [BOOT](../specs/protocols/BOOT.md): entry points for development.
- [Technical map](../specs/common/structure.md): repository layout and ownership.
- [Specification catalog](../specs/SPEC-MAP.md): active requirements.
- [Work board](../specs/BOARD.md), [work items](../specs/work/README.md), and [completed work archive](../specs/work/archive/2026): current work and accepted results.
- [Technical debt](../specs/TECHDEBT.md) and [continuation checkpoints](../specs/WAL.md): known tradeoffs and unfinished work.

Generated builds, test output, caches, credentials, and local identities are excluded from Git. Historical reports are evidence from their recorded runs, not claims that those checks were repeated for every later change.
