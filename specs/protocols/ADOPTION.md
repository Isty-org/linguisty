# Agent instructions: adopting the workflow in an existing project

## 1. Goal {#goal}

Prepare the project for further work through shared canon, independent `WI-NNN` items, a compact `BOARD`, and a checkpoint-only `WAL`.

Adoption records the actual baseline and creates a minimal route for the next task. Bulk rewriting of existing documents and operational history is not a required outcome.

## 2. Research {#research}

Study:
- project instructions and README;
- existing `specs/`, `BOARD`, `WAL`, roadmap, and technical notes;
- code structure, entrypoints, and tests;
- data, APIs, UI, runtime, deployment, and integrations;
- existing `@spec` markers.

Distinguish the confirmed current state from future improvements and questions for the human.

## 3. Establishing the model {#install}

1. Add current protocols, `SPEC-MAP.md`, and `specs/work/README.md`.
2. Fill in `common/main.md` and `common/structure.md` based on the actual project.
3. Register current specs in `SPEC-MAP.md` with a brief description of their responsibility.
4. Add `status` when creating or substantially changing a spec. A legacy document in `common/` or `modules/` without this field is considered `active`.
5. Add `@spec` to affected points of responsibility; a separate full annotation of all legacy code is tracked by a WI if needed.

## 4. Forward-only migration {#migration}

Apply the new rules to all new work:
- each new tracked item receives a `WI-NNN` ID and a file in `specs/work/`;
- one `BOARD` row links to one WI;
- a new WAL checkpoint is created for an unfinished session or handoff;
- a new spec ID is selected according to current lifecycle and uniqueness rules.

Legacy state remains valid:
- `FEAT-*` and `INFRA-*` rows in `BOARD` may be completed in the previous format;
- an existing `Completed` section in WAL may remain until a separate migration;
- `.A/.B/.C` change specs retain their IDs and links;
- existing specs receive lifecycle metadata as substantive changes are made.

## 5. Roadmap migration {#roadmap}

If `ROADMAP.md` was used as a spec catalog:
1. move the list of current documents and their responsibilities to `SPEC-MAP.md`;
2. move useful waves and lasting dependencies to the corresponding sections of the map;
3. preserve unique information and backlinks;
4. leave the legacy file with a short link to `SPEC-MAP.md`, or delete it after the human's decision.

## 6. BOARD and work items {#work}

For future or assigned implementation:
1. create one or more WIs according to `WORK-ITEM-PROTOCOL.md`;
2. specify exact governing specs;
3. add compact rows to `BOARD`;
4. place work that has started directly in `In Progress`;
5. leave WAL empty until the first actual checkpoint.

An inventory of existing canon alone does not create a WI for every spec.

## 7. Completing adoption {#done}

- `SPEC-MAP.md` gives the human an overview of existing specs and their responsibilities;
- `structure.md` shows modules, namespaces, and code ownership;
- new WIs have separate files and `BOARD` rows;
- `WAL.md` contains only current handoff context;
- legacy identifiers and useful history are preserved;
- open questions are marked `REVIEW`;
- the report lists changed documents and remaining decisions.
