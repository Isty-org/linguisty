# WORK-ITEM-PROTOCOL

## 1. Purpose {#purpose}

A work item is a bounded unit of work with a separate outcome and its own readiness check.

A specification records project canon. A work item records a particular pass that brings code, tests, documents, or infrastructure into alignment with that canon.

One specification may be implemented through several work items. One work item may reference several specifications if they contribute to one verifiable outcome.

## 2. When a work item is needed {#when}

Create a work item if the work has at least one of these characteristics:
- separate scope or acceptance;
- several substantive steps;
- risk, blocker, or dependency;
- a separate owner or priority;
- work may continue in the next session;
- coordination or explicit status for the human is needed;
- the human asked to put the work on the board.

A small single-step change completed in the current session may proceed without a work item, `BOARD`, or `WAL`.

The registration rule is simple: if work receives a `BOARD.md` row, it has a `WI-NNN` file.

## 3. Identifier and storage {#naming}

Work items use a separate namespace:
- `WI-001`
- `WI-024`
- `WI-105`

An active file is named `specs/work/WI-NNN-short-slug.md`.

A completed file is moved to `specs/work/archive/YYYY/`. A recent `Done` row in `BOARD.md` may already link to the archive path.

Before creating a new work item:
- scan `specs/work/**/*.md`;
- check `BOARD.md` and `WAL.md`;
- choose the next available `WI-NNN`;
- do not reuse numbers from completed or canceled items.

A work item ID is distinct from a spec ID. The relationship is stored in the `Specs` section and the board's compact `Specs` column.

## 4. Minimal format {#format}

```md
# WI-024: Fix empty rows in the personal report

- Kind: `fix`
- Canon action: `none`

## Outcome

The code matches canonical empty-row behavior.

## Specs

- Governing: `spec://modules/report/FEAT-001-management-report#scenarios.compact-empty-rows`

## Scope

- In: row construction, rendering, regression test.
- Out: metric selection and access permissions.

## Acceptance

- [ ] The bug is reproduced by a test.
- [ ] The fix passes the test.
- [ ] The explicit-zero scenario is preserved.

## Result

Filled in at completion: outcome, checks, commits, or release evidence.
```

Required parts:
- a heading with `WI-NNN`;
- `Kind`;
- `Canon action`;
- one verifiable `Outcome`;
- links to specs;
- boundaries of the current pass;
- work item acceptance;
- `Result`, populated at completion.

Allowed `Kind` values:
- `implement` — implementation of already described canon;
- `fix` — bringing code into alignment with the current spec;
- `change` — an agreed change to canon and implementation;
- `migration` — transition between states or systems;
- `research` — research with a separate verifiable outcome.

Allowed `Canon action` values:
- `none` — canon text is preserved;
- `direct-edit` — the current spec is updated;
- `new-spec` — the work produces a new spec;
- `supersede` — one or more specs are replaced or removed from active canon.

## 5. Links to specifications {#specs}

A work item links to exact `spec://...#anchor` addresses.

Link roles:
- `Governing` — defines required behavior;
- `Affected` — changes along with the outcome;
- `Constraint` — defines a mandatory constraint.

`implement`, `fix`, `change`, and `migration` require at least one `Governing` spec if current canon for the outcome already exists.

A WorkItem with `Canon action: new-spec` is created before the new spec file and uses:
- existing higher-level canon in `Governing`, if any;
- current constraints in `Constraint`;
- the planned full address of the new spec with `#root` in `Affected`.

The first spec-space may start a `new-spec` WorkItem without an existing `Governing` link. After registering and moving the new spec to `active`, add its exact responsible anchor to `Governing`, keep the created document's address in `Affected`, and update scope and acceptance before dependent implementation.

`research` may start without a resolved spec. Before implementing its outcome, research must resolve the owning spec or explicitly record that `new-spec` is required.

A work item contains the current pass's boundaries and does not copy scenarios, data models, or contracts from specifications.

## 6. Size and splitting {#slicing}

One work item has:
- one observable outcome;
- one completion decision;
- a related set of checks.

Create separate work items if parts of the work:
- can be released or rolled back independently;
- can be verified independently;
- may be in different statuses;
- have different external blockers;
- belong to different sequential waves.

A small spec may receive one work item to implement its entire `#root`.

A large spec receives several work items linked to specific anchors. Prefer divisions by complete user or runtime outcomes.

A cross-spec work item is allowed when several specs contribute to one atomic outcome. Several independent outcomes receive separate `WI-NNN` items.

Relationships between work items use simple IDs:

```md
## Dependencies

- Depends on: `WI-018`
- Related: `WI-021`
```

## 7. Refining and expanding an active work item {#expansion}

Before registering a new work item, compare the human's exact new request with `Outcome`, `Scope`, `Acceptance`, and `Specs` of the current active WI.

| Situation | Decision |
|---|---|
| The same atomic outcome remains, and the request adds a small amount: states, errors, responsiveness, or checks for one flow | Expand the current active WI |
| An independent outcome appears, with separate acceptance, release or rollback, another owner or blocker, or actual independent parallel work | Create a related new WI |
| The current WI is completed | Create a related follow-up WI |

During expansion, the outcome is preserved. Merge the complete scope and spec links, then add new acceptance criteria to the complete previous list. Removing or weakening previous acceptance is allowed only by explicit human decision; the decision and reason remain in the existing comment/audit/history system.

## 8. Fixes and canon changes {#changes}

If code contradicts a clear active spec:
- `Kind: fix`;
- `Canon action: none`;
- the link points to the exact governing anchor;
- acceptance includes reproduction and a regression test;
- the spec changes only if an actual gap in canon is found.

If desired behavior changes within the previous area of responsibility:
- `Kind: change`;
- `Canon action: direct-edit`;
- the spec is updated before or together with implementation;
- the spec changelog records the change.

If the outcome creates a new independent responsibility:
- `Canon action: new-spec`;
- the WorkItem is created and started before authoring and may include subsequent implementation of the same atomic outcome;
- governing links and acceptance are refined once the new active spec is ready and before coding;
- separate implementation WorkItems are created only for independent outcomes, separate acceptance, or an explicit authoring task.

If an area of responsibility is replaced, split, or removed from the product:
- `Canon action: supersede`;
- the work item connects old and new canon;
- lifecycle and reciprocal links are updated according to `SPEC-PROTOCOL.md#lifecycle`.

Disputed points follow `SPEC-PROTOCOL.md#conflict`.

## 9. Relationship to BOARD and WAL {#operations}

`BOARD.md` is the only source of status, owner, and priority.

The work item file stores outcome, specs, scope, acceptance, dependencies, and result. These fields are not repeated on the board as lengthy text.

A WAL checkpoint is created only for unfinished work:
- the session ends before the WI is closed;
- a handoff is needed;
- the assignee switches to another WI;
- a significant destructive step is imminent;
- an important next step or decision needs preserving.

Starting and completing a work item in one session does not require WAL.

## 10. Traceability {#traceability}

- Code and tests contain lasting `@spec` markers.
- Commits, PRs, and reports mention `WI-NNN`.
- A work item connects operational work to one or more specs.
- A short-lived `WI-NNN` is not added to production code as an ownership marker.

## 11. Completion {#done}

A work item is ready for `Done` when:
- its outcome is achieved;
- acceptance has passed;
- checks are listed in `Result`;
- code, tests, and current specs are aligned;
- the changelog is updated if canon changed;
- `REVIEW` and `TECHDEBT` are recorded if any arose;
- the active WAL checkpoint is removed;
- `BOARD.md` reflects completion.

After completion, the file is moved to `specs/work/archive/YYYY/`. `BOARD.md` keeps only recently completed items; complete history remains in the WI archive and Git.
