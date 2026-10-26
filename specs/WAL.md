# Linguisty continuation context

## Active Checkpoints

### WI-011: Mozilla package warnings (@tsyzhman)
- Work: [WI-011](work/WI-011-amo-warnings.md)
- Updated: 2026-10-26
- Checkpoint: Code, documentation, both builds, browser checks, and the Firefox ZIP were completed in the original run; Mozilla validation was clean. Only temporary tool files and first-launch Firefox residue remain; related processes have ended.
- Next: After a policy change or manual removal, verify absence of only `.cache/amo-lint-npm`, `.cache/firefox-qa/profile-MaLnaU`, `.cache/firefox-qa/mozilla-temp-files`, and `.cache/firefox-qa/tmp-w5y.xpi`, update the evidence, and close the WI. Do not bypass the rejection or request authorization already provided.
- Blocker: The user explicitly authorized this deletion on 2026-10-12 and requested cleanup again on 2026-10-26. A command checking directory boundaries and processes using the paths was again rejected by automatic approval review: `blocked by policy`; no detailed reason was supplied. Deletion was not performed.

## Cross-work

## Decisions Pending

