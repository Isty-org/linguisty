# SPEC-PROTOCOL

## 1. Priority hierarchy {#priority}

**human → spec → tests → code**

The human sets intent and approves canon. The spec records canon. Tests verify canon. Code implements canon.

A work item defines the boundaries of the current pass. It does not change the priority of canonical sources.

If the task is to create a new spec or deeply rework an existing one, open `SPEC-AUTHORING-PROTOCOL.md`.

## 2. Role of a specification {#role}

A specification describes lasting current behavior, a contract, or an invariant.

A specification contains:
- its area of responsibility;
- scenarios and rules;
- data and states;
- external contracts;
- errors;
- canonical readiness criteria;
- lasting relationships with neighboring documents;
- canon change history.

Owner, priority, current implementation status, session checkpoint, and checkboxes for a particular pass live in `BOARD`, the WI, and `WAL`.

## 3. Document types {#types}

- `PROP` — lasting project or module canon.
- `FEAT` — a product capability or independent area of product behavior.
- `INFRA` — service lifecycle: environments, deployment, storage, queues, observability, recovery.

A work item has a separate `WI-NNN` ID and follows `WORK-ITEM-PROTOCOL.md`.

## 4. Required properties {#required}

Every `PROP`, `FEAT`, or `INFRA` must:
- have `#root`;
- be addressable through `spec://...#anchor`;
- begin with a plain-language block;
- contain enough detail to serve as canon;
- have change history or document notes;
- be registered in `SPEC-MAP.md`.

`FEAT` and `INFRA` additionally require:
- governing specs;
- boundaries of the current canon;
- state and data if the document changes them;
- contracts for external behavior or runtime points;
- error scenarios;
- readiness criteria;
- relationships with neighboring documents.

`PROP` requires:
- canon boundaries;
- links to neighboring or subordinate documents;
- a completeness checklist;
- change history.

`PROP-000` may be the project's root document without a governing spec.

## 5. Specification lifecycle {#lifecycle}

Allowed states:
- `draft` — a proposal or unfinished canon;
- `active` — current governing canon;
- `superseded` — the document has been replaced by other canon;
- `retired` — the area has been removed from the product without a direct replacement.

New and substantially changed documents declare their state in YAML:

```yaml
---
status: active
---
```

A legacy document in `specs/common/` or `specs/modules/` without `status` is considered `active`. Teaching documents in `specs/examples/` are outside the lifecycle of working canon.

Rules:
- production code references `active` specs through `@spec`;
- `draft` may be used during authoring and planning; implementation starts after the governing spec moves to `active`;
- a `superseded` or `retired` file retains its original path and `spec://` address;
- the active `SPEC-MAP.md` catalog moves a replaced document to `Superseded and retired`;
- `common/structure.md` preserves the technical connection between a historical namespace and code if it is still needed;
- a retired spec's ID is not reused.

For supersession, the old spec contains:

```md
## Superseded by {#superseded-by}

- `spec://modules/core/FEAT-070-new-canon#root`
```

The new spec contains a reciprocal relationship:

```md
## Supersedes {#supersedes}

- `spec://modules/core/FEAT-041-old-canon#root`
```

If one document is split into several, `Superseded by` lists all new owning specs. When only part is extracted, the original spec remains `active`; its scope is updated by direct edit and points to the new document as neighboring canon.

## 6. Naming and addressing {#naming}

A spec file is named as follows:
- `PROP-000-short-slug.md`;
- `FEAT-041-billing-ledger.md`;
- `INFRA-007-production-env.md`.

Legacy change specs such as `FEAT-041.A-...md` remain valid.

For new documents:
- the type prefix is required: `PROP`, `FEAT`, `INFRA`;
- the number is unique throughout spec-space within its type;
- the slug is short, stable, and reflects the document's responsibility;
- a new independent area receives a new `TYPE-NNN`;
- a letter suffix is created only by explicit human decision for compatibility with an existing document series.

Before creating a spec:
- scan `specs/common/**/*.md` and `specs/modules/**/*.md`;
- check `SPEC-MAP.md`;
- include `superseded` and `retired` documents;
- do not reuse the number of a deleted, archived, or renamed document;
- assign a new available number to teaching files in the `900-999` range when copying them.

Canonical address:
- `spec://common/PROP-005-RUNTIME#processes`;
- `spec://modules/core/FEAT-010-account-lifecycle#api.create`;
- `spec://modules/core/INFRA-020-data-baseline#migrations`.

Anchor rules:
- the document has `#root`;
- anchors are stable and human-readable;
- nesting uses dotted segments: `scope.in`, `api.create`, `data.workspace`.

## 7. Relationships between specs {#references}

Where an actual relationship exists, use:
- `Related`;
- `Depends on`;
- `Supersedes`;
- `Superseded by`;
- `See also`.

Links point to exact `spec://...#anchor` addresses.

## 8. Canon change model {#change-model}

### Direct edit

Use direct edit when the current area of responsibility is retained:
- wording, a term, anchor, scope, or acceptance is clarified;
- an omitted detail is added;
- agreed new behavior becomes the current canon for the same area;
- old behavior ceases to apply.

Update the text and `Change history`. If tracked implementation is required, create a `WI-NNN` with `Canon action: direct-edit`.

### New independent spec

Create a new `TYPE-NNN` when there is:
- a new product capability;
- a new process;
- a new runtime subsystem;
- a separate responsibility that can be used and changed independently.

For a tracked outcome, use this order:
1. before the first change, determine type, namespace, the planned full spec address with the `#root` anchor, existing higher-level canon, and constraints;
2. create and start a WorkItem with `Canon action: new-spec`, placing the planned address in `Affected`; the first spec-space may have no existing `Governing` link;
3. create and register the spec, retaining `draft` while its ownership, scenarios, or contracts are ambiguous;
4. before dependent implementation, move the spec to `active`, add its exact anchor to `Governing`, and update WorkItem scope and acceptance;
5. continue implementation in the same WorkItem for one atomic outcome, or create related WIs for independent outcomes before coding.

### Supersession

Use supersession when the previous document entirely loses its role as governing canon because responsibilities are replaced, split, or merged.

Create a new spec with a new ID, update lifecycle and reciprocal links, then perform the transition through a WI with `Canon action: supersede`.

### Coexistence and migration

If old and new behavior temporarily coexist, both owning specs remain `active` and explicitly describe their conditions of applicability.

Migration execution is tracked by a work item. A lasting migration/rollout/rollback contract receives a separate `FEAT` or `INFRA` with a new ID.

### Historical snapshots

Release and audit snapshots are preserved through a Git tag, release, or another immutable artifact accepted by the project.

A new task, wave, or repeated implementation pass does not by itself create a new spec. Use `WI-NNN` for these.

## 9. Conflict between code and spec {#conflict}

If code contradicts a clear active spec:
1. reproduce the discrepancy;
2. follow the current canon;
3. fix code and tests;
4. preserve the spec text if it is sufficiently specific;
5. for tracked work, use `Kind: fix` and `Canon action: none`.

If the spec lacks a detail needed for an unambiguous fix:
- perform a direct edit when intent is confirmed;
- add a changelog entry;
- implement the clarification in the same WI.

If desired behavior has changed, first update canon according to section `8`.

If implementation can proceed from the current text and a question remains, add:

```md
<!-- REVIEW: briefly describe the question and why it matters -->
```

A high risk of data loss, security harm, financial loss, or harm to the main user scenario moves the work into planning until a human decision.

## 10. `@spec` in code {#code-traceability}

New or substantially changed spec-owned code receives a marker:

```ts
/**
 * @spec spec://modules/core/FEAT-010-account-lifecycle#api.create
 * @spec spec://common/PROP-006-API#errors
 */
```

Markers are placed at points of responsibility:
- a file;
- a handler;
- a service or class;
- a major component;
- a worker;
- a migration;
- a materializer or importer;
- a test directly verifying a spec-owned contract.

During supersession, update `@spec` to the current governing canon at affected points. A legacy marker is allowed only for code that continues to serve an explicitly described legacy subsystem.

## 11. Consistency check {#done}

Before completing spec work, check:
- type and lifecycle are selected correctly;
- `spec://` addresses and anchors exist;
- `SPEC-MAP.md` shows current responsibility and lifecycle;
- `common/structure.md` reflects namespace and code connections if the technical map changed;
- direct edits have changelog entries;
- supersession has reciprocal links;
- IDs are not duplicated or reused;
- disputed points are marked `REVIEW`;
- code responsibility points have current `@spec` markers;
- tracked implementation is recorded in separate `WI-NNN` items;
- the specification does not store owner, session status, or progress of a particular WI.
