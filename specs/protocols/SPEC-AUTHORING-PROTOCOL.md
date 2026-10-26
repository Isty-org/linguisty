# SPEC-AUTHORING-PROTOCOL

## 1. Purpose {#purpose}

This protocol applies when creating a new specification or deeply reworking an existing one.

A specification describes lasting canon. A particular implementation plan and its acceptance live in one or more `WI-NNN` items.

## 2. Minimum research {#research}

Before drafting, read:
- `specs/common/main.md`;
- `specs/SPEC-MAP.md`;
- `specs/common/structure.md`;
- relevant `common PROP` and neighboring specs;
- the existing WI, if authoring is part of tracked work;
- code and tests when the document describes existing behavior.

Stop searching when ownership, current canon, and affected contracts are understood.

## 3. Choosing a type {#type}

Use:
- `PROP` for lasting invariants, terms, models, shared contracts, and module boundaries;
- `FEAT` for an independent product capability or area of behavior;
- `INFRA` for runtime, environments, deployment, storage, queues, observability, and recovery.

If a document combines several independent responsibilities, split them into separate specs and connect them with exact `spec://` addresses.

## 4. Decision before drafting {#before-draft}

Determine:
- change format: `direct-edit`, `new-spec`, or `supersede`;
- type and next available `TYPE-NNN`;
- module and `spec://` namespace;
- lifecycle: `draft` or `active`;
- governing and neighboring specs;
- canon boundaries;
- questions requiring `REVIEW`.

Apply the change and lifecycle rules from `SPEC-PROTOCOL.md`.

Choose a new number after searching `specs/common/**/*.md`, `specs/modules/**/*.md`, and `SPEC-MAP.md`. Include `active`, `draft`, `superseded`, and `retired` documents. Numbers are not reused.

Letter series `.A`, `.B`, `.C` are preserved in legacy projects. New independent canon receives a new `TYPE-NNN`, unless the human explicitly chooses a compatible lettered ID.

## 5. Lifecycle during authoring {#lifecycle}

Use `status: draft` while ownership, scenarios, or contracts remain uncertain.

Move the document to `status: active` when:
- purpose and boundaries are unambiguous;
- canonical scenarios and contracts are sufficient for use;
- significant questions are resolved or marked `REVIEW` with acceptable risk;
- the human has instructed you to accept this document as canon or explicitly instructed implementation from it.

This transition requires changing the spec itself and one row in `SPEC-MAP.md`.

## 6. Registration {#registration}

After creation or a lifecycle change:
1. update one spec row in `SPEC-MAP.md`;
2. update `common/structure.md` only if a module, namespace, directory ownership, or connection between spec-space and code changes;
3. add a link in `common/main.md` if a new shared top-level `PROP` appears;
4. for an already started `new-spec` WorkItem, update exact governing/affected links, scope, and acceptance once the spec is ready; do not duplicate the WI here.

Single-step spec creation alone does not create a `BOARD.md` row or a `WAL.md` checkpoint. Tracked authoring or a combined “spec + implementation” outcome receives a WorkItem before the first change under the general protocol.

Teaching files from `specs/examples/` are registered after being copied to a working module and assigned a new available ID.

## 7. Dividing implementation {#work-items}

Once canon is ready, refine the already selected work structure:
- a tracked `new-spec` WorkItem may continue implementing a small spec in the same WI if authoring and code produce one atomic outcome;
- before coding, the new governing spec has `active` status and the WorkItem contains its exact anchor and current scope and acceptance;
- a large spec is divided before implementation into several related WIs, each delivering a complete user or runtime outcome;
- one WI may reference several specs if they share one atomic outcome;
- single-step authoring or implementation within the current session may proceed without a WI only if the single-step work criteria are met.

The WI stores the current pass's scope, acceptance, and result. The spec retains scenarios, contracts, and canonical behavior criteria without session progress.

## 8. PROP readiness {#readiness.prop}

A `PROP` contains:
- a plain-language block;
- purpose and boundaries;
- invariants, terms, or shared rules;
- neighboring or subordinate documents;
- a completeness checklist;
- change history;
- `REVIEW` for disputed points.

`PROP-000` may be a root document without a governing spec.

## 9. FEAT readiness {#readiness.feat}

A `FEAT` contains:
- a plain-language block and goal;
- governing specs;
- canon boundaries;
- actors and trigger;
- scenarios;
- data and states;
- UI, API, events, or other external contracts;
- errors and validation;
- expected `@spec` points;
- canonical readiness criteria;
- relationships and change history.

## 10. INFRA readiness {#readiness.infra}

An `INFRA` contains:
- a plain-language block and goal;
- governing specs;
- canon boundaries;
- environments and dependencies;
- canonical runtime decisions;
- data, state, and migrations;
- entrypoints and operational scenarios;
- rollout, rollback, and recovery;
- observability;
- expected `@spec` points;
- canonical readiness criteria;
- relationships and change history.

## 11. Minimal FEAT structure {#feat-template}

```md
---
status: draft
---

# FEAT-<NNN>: <title> {#root}

## In plain language {#plain-language}
...

## 1. Goal {#goal}
...

## 2. Governing specs {#governing-specs}
- `spec://...#...`

## 3. Scope {#scope}
### 3.1. Included {#scope.in}
...
### 3.2. Out of scope {#scope.out}
...

## 4. Actors and trigger {#actors}
...

## 5. Scenarios {#scenarios}
...

## 6. Data and state {#data}
...

## 7. Contracts {#contracts}
...

## 8. Errors and validation {#errors}
...

## 9. Implementation traceability {#traceability}
...

## 10. Readiness criteria {#acceptance}
...

## 11. Relationships {#relationships}
...

## 12. Change history {#changelog}
- [YYYY-MM-DD] created.
```

## 12. Minimal INFRA structure {#infra-template}

```md
---
status: draft
---

# INFRA-<NNN>: <title> {#root}

## In plain language {#plain-language}
...

## 1. Goal {#goal}
...

## 2. Governing specs {#governing-specs}
- `spec://...#...`

## 3. Scope {#scope}
...

## 4. Environments and dependencies {#environments}
...

## 5. Canonical decisions {#decisions}
...

## 6. Runtime and operations {#runtime}
...

## 7. Data, state, and migrations {#data}
...

## 8. Contracts and entrypoints {#contracts}
...

## 9. Rollout, rollback, and recovery {#recovery}
...

## 10. Observability {#observability}
...

## 11. Implementation traceability {#traceability}
...

## 12. Readiness criteria {#acceptance}
...

## 13. Relationships {#relationships}
...

## 14. Change history {#changelog}
- [YYYY-MM-DD] created.
```

## 13. Style {#style}

- Write in the project's language.
- State who performs the action, when it starts, what changes, and what outcome is considered correct.
- Preserve stable anchors.
- Mark disputed points `REVIEW`.
- Record deliberate engineering tradeoffs in `TECHDEBT.md`.

## 14. Completing authoring {#done}

Check:
- type, ID, and lifecycle are consistent;
- ownership does not duplicate a neighboring spec;
- the document is registered in `SPEC-MAP.md`;
- `structure.md` is updated only if the technical map changes;
- all `spec://` links and anchors exist;
- implementation is divided into WIs only as much as necessary;
- the spec contains no owner, priority, session status, or implementation progress.
