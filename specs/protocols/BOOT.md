# BOOT — standalone {#root}

Workflow mode: standalone

Local adaptation of the Isty-org/prist skill router. Operational data is maintained in this repository. First read the user's instructions and the project AGENTS.md; then select a route below. Read only the context you need.

## Entry {#entry}

When an explicit `WI-NNN` is given, open its file in `specs/work/` or `specs/work/archive/`, its single BOARD row, that task's checkpoint if present, and the listed governing/constraint/affected specs.

Without a WI, search in order: active BOARD rows, SPEC-MAP, `common/structure.md`, spec names and headings, `@spec` markers in code and tests, and affected modules. Stop when responsibility is clear.

Before claiming a WI or changing ownership, BOARD, or WAL, read `specs/.me`. Preserve the existing identity. If an agent is assigned to set up the workflow, a missing file may be created from `.me.template` with the agent's known identity and the role `agent`. Do not substitute invented human data. A single-step change and reading do not require `.me`. The file remains local and is excluded from Git.

## Routes {#routing}

| Situation | What to read | What to change |
|---|---|---|
| Single-step work, clear owning spec, no handoff or separate tracking | responsible specs | outcome and necessary checks; the spec only if canon changes |
| Existing WI | [WORK-ITEM-PROTOCOL](WORK-ITEM-PROTOCOL.md), [BOARD-PROTOCOL](BOARD-PROTOCOL.md) | current WI and board row when an event requires it |
| New tracked work | the same two protocols | one WI per atomic outcome and one BOARD row |
| New or reworked spec | [SPEC-AUTHORING-PROTOCOL](SPEC-AUTHORING-PROTOCOL.md), [SPEC-PROTOCOL](SPEC-PROTOCOL.md) | spec, SPEC-MAP; structure if module or ownership changes |
| Stop, handoff, resume | [WAL-PROTOCOL](WAL-PROTOCOL.md) | one checkpoint for an unfinished WI |
| Deliberate engineering tradeoff | [TECHDEBT-PROTOCOL](TECHDEBT-PROTOCOL.md) | current TECHDEBT entry |
| Adoption in an existing project | [adoption instructions](ADOPTION.md) | minimal factual baseline |

A separate WI is needed for independent scope/acceptance, multiple steps, risk, dependency, blocker, coordination, continuation between sessions, or an explicit request. Single-step work does not create a WI, BOARD row, or WAL checkpoint.

## Execution order {#work}

1. Resolve the owning spec and the human's current intent. Decision priority: human → spec → tests → code.
2. When an active spec is clear and implementation is wrong, reproduce the discrepancy and fix the code; `Canon action: none`. Do not rewrite a correct spec to match a bug.
3. For new behavior, choose `direct-edit`, `new-spec`, or `supersede`. For tracked `new-spec` work, first create a WI with the planned address in Affected; register and prepare the canon; update Governing, scope, and acceptance before dependent implementation. Single-step authoring does not require a WI.
4. Place a WI started immediately in In Progress. No initial checkpoint is needed.
5. Implement the agreed outcome and perform checks appropriate to acceptance.
6. Add full `@spec spec://modules/<module>/<TYPE-NNN-slug>#anchor` markers to new or substantially changed code responsibility points and direct contract tests. Small helpers inherit ownership from the nearest block.

## Completion {#finish}

Completed WI: acceptance has actually passed; Result contains the outcome and performed checks; canon, code, and tests are aligned. Move the file to `specs/work/archive/YYYY/`, update its link and status in Done, and remove its active checkpoint. Changed canon receives a changelog entry.

Unfinished WI: retain In Progress or Blocked; when stopping, create a short checkpoint with the current state and next step. Do not copy scope or acceptance into it.

Single-step work: report the outcome, changed files, and checks without operational tracking.

Do not claim an unperformed mandatory check passed. If it is unavailable, perform the available checks and record the limitation. Mark disputed details REVIEW; ask for a separate human decision only when it is actually necessary and has not already been given.

## Minimal records and memory {#write-matrix}

SPEC-MAP stores the catalog and lifecycle; structure stores modules, namespaces, and links to code; WI stores outcome, scope, acceptance, and result; BOARD stores status, owner, and priority; WAL stores only current continuation context; TECHDEBT stores engineering tradeoffs.

Do not duplicate these details between files. The archive is the history of completed WIs; BOARD keeps recent completions according to BOARD-PROTOCOL. After work, report “before → after” and check links, duplicates, and created temporary files. Do not delete others' caches or history without justification.
