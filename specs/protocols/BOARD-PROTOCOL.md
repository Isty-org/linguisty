# BOARD-PROTOCOL

## 1. Purpose {#purpose}

`BOARD.md` is a compact operational index of work items.

It shows:
- the work queue;
- current assignees;
- active blockers;
- recent completions;
- links between work items and canonical specs.

Related sources:
- `SPEC-MAP.md` — catalog of specs and their responsibilities;
- `specs/work/WI-NNN-*.md` — outcome, scope, and acceptance;
- `WAL.md` — checkpoint for an unfinished session;
- `TECHDEBT.md` — deliberate tradeoffs;
- Git — complete implementation history.

## 2. Basic columns {#columns}

Minimum columns:
- `Backlog`;
- `In Progress`;
- `Blocked`;
- `Done`.

The project may add administrative columns while preserving these meanings.

Each work item is in only one column.

## 3. Tracking unit {#item}

One board row corresponds to one `WI-NNN` and links to its file.

A WI file is required for every new row. Legacy rows with `FEAT-*` or `INFRA-*` remain valid during forward-only migration; new items receive an independent `WI-NNN`.

One spec may appear in multiple work items. One work item may list multiple spec IDs.

The `Specs` column contains compact IDs for human review. Full `spec://...#anchor` links live in the WI file.

## 4. Minimal format {#format}

```md
### Backlog

| Work | Title | Specs | Owner | Priority |
|---|---|---|---|---|
| [WI-010](work/WI-010-account-lifecycle.md) | Implement account creation | FEAT-010, PROP-006 | @handle | P1 |

### In Progress

| Work | Title | Specs | Owner | Started | Blocker |
|---|---|---|---|---|---|
| [WI-011](work/WI-011-account-invite.md) | Invite a member | FEAT-010 | @handle | YYYY-MM-DD | — |

### Blocked

| Work | Title | Owner | Reason | Waiting for |
|---|---|---|---|---|
| [WI-012](work/WI-012-production-access.md) | Production access | @handle | No access | Human decision |

### Done

| Work | Title | Owner | Date |
|---|---|---|---|
| [WI-009](work/archive/YYYY/WI-009-runtime-baseline.md) | Runtime baseline | @handle | YYYY-MM-DD |

```

Scope, acceptance, dependencies, and long outcome descriptions are not repeated in `BOARD.md`.

## 5. Who changes BOARD {#ownership}

- A human may change any row.
- AI changes items belonging to its own `@handle`.
- Reassigning the owner requires a human decision.
- `BOARD.md` is the source of status, owner, and priority; these fields are not duplicated in the WI file or WAL.

An agent must read `specs/.me` before claiming or changing a row.

## 6. Creation and start {#start}

### Backlog

Place a WI in `Backlog` if:
- the work has been recognized as necessary;
- a WI file has been created;
- owning specs are resolved or the item has `Kind: research` / `Canon action: new-spec`;
- active implementation has not started.

### Immediate start

If the human instructs you to start work now, add the new WI directly to `In Progress`. An intermediate move through `Backlog` is not required.

`In Progress` requires:
- an owner;
- actual work start;
- a WI file with outcome, specs, scope, and acceptance.

A WAL checkpoint is not a condition of starting. It appears only for an unfinished session or handoff.

## 7. Blocked {#blocked}

Move a WI to `Blocked` when continuation depends on an external condition:
- a human decision;
- another work item or assignee;
- access, environment, or an external resource;
- confirmation without which the outcome cannot honestly be completed.

Ordinary implementation complexity and local uncertainty resolvable by reading code remain `In Progress`.

The reason and `Waiting for` live on the board. A detailed checkpoint is added to WAL only when needed for resumption.

## 8. Done {#done}

Move a WI to `Done` when:
- the outcome is achieved;
- acceptance has passed;
- `Result` contains the performed checks;
- code, tests, and active canon are aligned;
- the spec changelog is updated if `direct-edit` or `supersede` was used;
- the WAL checkpoint is removed;
- open tradeoffs are recorded in `TECHDEBT.md`.

On completion, the WI file is moved to `specs/work/archive/YYYY/`.

`Done` keeps the last ten items or the current release's items; the project chooses one stable limit. Older rows are removed from the board; files remain in the archive and Git.

The next wave receives a new `WI-NNN`. Its related spec retains its role as living canon.

## 9. Synchronization {#sync}

Check these invariants:
- every new board row links to an existing WI;
- a given `WI-NNN` appears in one column;
- the owner in an active WAL heading matches the board owner;
- a checkpoint for a particular WI exists only for `In Progress` or `Blocked`;
- board `Specs` match the full links in the WI file;
- a completed WI has a populated `Result` and an archive path.

A status change usually affects only `BOARD.md`. `WAL.md` changes when a checkpoint is needed; the WI file changes when scope/acceptance changes or a result is recorded.
