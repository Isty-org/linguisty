# WAL-PROTOCOL

## 1. Purpose {#purpose}

`WAL.md` is short-term memory for unfinished work between sessions.

It stores a checkpoint and next step for an active `WI-NNN`. Scope and acceptance live in the WI file, status and owner in `BOARD.md`, and implementation history in Git.

## 2. When WAL is needed {#when}

Create or update a WAL checkpoint if:
- the session ends before the WI is completed;
- work is handed to another assignee or agent;
- the assignee switches to another WI;
- a significant destructive step is imminent;
- an important next step, temporary blocker, or awaited decision needs to be preserved.

WAL is not required:
- for `Backlog`;
- when starting a work item;
- for a task completed in one session;
- as a log of small actions;
- after moving the WI to `Done`.

## 3. Structure {#structure}

WAL contains three sections:
- `## Active Checkpoints`;
- `## Cross-work`;
- `## Decisions Pending`.

Completed history is stored in `specs/work/archive/` and Git. New projects do not use a `Completed` section. Existing legacy entries may be preserved until a separate migration.

## 4. Checkpoint format {#format}

```md
### WI-011: Invite a member (@handle)
- Work: [WI-011](work/WI-011-account-invite.md)
- Updated: YYYY-MM-DD
- Checkpoint: The API and successful-scenario test are ready.
- Next: add repeat-invitation errors and check the UI.
- Blocker: —
```

Required fields:
- `Work`;
- `Updated`;
- `Checkpoint`;
- `Next`;
- `Blocker`.

One WI has one active WAL section.

## 5. Writing rules {#rules}

- AI edits checkpoints for its own `@handle`.
- Others' checkpoints serve as read-only context.
- A new section is appended to `Active Checkpoints`.
- The summary does not copy scope, acceptance, the spec list, or commit history.
- `Checkpoint` describes the state already achieved.
- `Next` contains the nearest concrete step.
- `Blocker` matches the meaning in `BOARD.md` if the WI is `Blocked`.

`specs/.me` is required before changing WAL.

## 6. Resuming {#resume}

When continuing work:
1. open the WI file;
2. check status and owner in `BOARD.md`;
3. read the checkpoint;
4. perform `Next`;
5. update the checkpoint only at a new handoff or session end.

Starting a new session alone does not require a no-op WAL edit.

## 7. Completion {#finish}

At `Done`:
1. move significant checks and the outcome into the WI file's `Result`;
2. remove the active WAL section;
3. update `BOARD.md`;
4. move the WI to the archive.

If the item remains `In Progress` or `Blocked`, preserve one current checkpoint. Do not accumulate old intermediate wording.

## 8. Shared sections {#shared}

`Cross-work` contains only live dependencies affecting the imminent work of several WIs.

`Decisions Pending` contains decisions awaiting the human. After a decision, its canonical outcome moves to the owning spec or WI, and the entry is removed.

AI writes WAL; the human verifies the actual state.
