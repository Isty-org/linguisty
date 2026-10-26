# TECHDEBT-PROTOCOL

## 1. Purpose {#purpose}

`TECHDEBT.md` stores deliberate engineering tradeoffs and risks that remain relevant after the current work is completed.

## 2. When to create an entry {#when}

Create an entry if:
- implementation leaves a temporary bridge or limitation;
- a known risk remains outside the current WI's scope;
- canon is fulfilled with an agreed technical tradeoff;
- the information needs to survive beyond one work session.

A product idea belongs in the product backlog. A current checkpoint belongs in `WAL.md`. Tracked work is recorded as a `WI-NNN`.

## 3. Relationship to canon {#canon}

- Canonical behavior changes follow `SPEC-PROTOCOL.md#change-model`.
- A question about canon text is marked `REVIEW` in the owning spec.
- Technical debt describes implementation state, risk, and the condition that triggers it.
- One risk has one canonical entry in `TECHDEBT.md`.

## 4. Format {#format}

```md
### TD-001: Short title
- Area: `module` / subsystem
- Related specs: `spec://...#...`
- Introduced by: `WI-024` or commit/release
- Current state: what remains in the implementation
- Risk: what this may cause
- Trigger: when the risk occurs
- Mitigation: how to eliminate or reduce the risk
- Work: —
```

Required fields: `Area`, `Related specs`, `Current state`, `Risk`, `Trigger`, `Mitigation`.

## 5. Lifecycle {#lifecycle}

- A current entry lives in `Open`.
- When resolving it becomes independent work, create a WI file and one `BOARD.md` row, then set `Work: WI-NNN`.
- `WAL.md` does not change before the first checkpoint.
- After eliminating the risk, move the entry to `Resolved` with a date and a link to the WI or evidence.

`TECHDEBT.md` stores the lasting risk. The WI file stores the scope and acceptance of a particular pass to resolve it.
