---
status: active
---

# FEAT-002: Page translation and dynamic DOM {#root}

The page is translated by replacing Text node values. DOM structure, events, and user input are preserved; original and translated text switch from memory.

## Governing specs and scope {#governing}

`spec://common/PROP-000-product#invariants`, `spec://common/PROP-001-contracts#sessions`, `spec://common/PROP-002-quality#resources`. The trigger is the user's start command. Only the top frame of an ordinary HTTP(S) page; cross-origin iframes, closed shadow DOM, PDF, and editable values are outside v1.

## Scanning {#scan}

TreeWalker over text nodes; skip script/style/noscript/code/pre/textarea/svg/canvas/input/select/option, contenteditable ancestry, translate=no, hidden/inert/aria-hidden, elements without visible rects, whitespace/punctuation-only content, and bare URLs/email/hash. Do not ignore a meaningful phrase containing numbers. Elements outside the viewport that have layout are translatable. WeakMap<Text, state>, bounded iterable registry for toggling; detached nodes are removed. Do not rescan the entire DOM for every mutation.

## Queue and context {#queue}

Viewport first, then near-viewport, then rest; IntersectionObserver may raise priority. Logical grouping by common parent/nearest semantic container does not merge output nodes. Title/domain come from the page; title max 300 chars, domain without query/path. Content does not receive apiKey. At most the configured concurrent batches and 5 000 queued nodes. Progress counts actual discovered/translated/failed/inFlight; cache hits count actual nodes.

An ordinary request targets 16 nodes and 3 000 weighted characters (CJK has weight 3), without exceeding user limits of 40/10 000. A long node of up to 100 000 UTF-16 code units is split at sentence/space boundaries, preserving every character and surrogate pair; at most 128 parts. Parts are sent sequentially within one occupied slot while other page batches run in parallel. Only a complete validated set of parts changes the original Text node; progress/cache-hit counts the original node. Cancel, original, navigation, and external changes stop subsequent parts from starting. A larger node is explicitly rejected without truncation.

The watchdog for each part/ordinary batch accounts for the background's entire bounded retry/recovery budget plus 5 s delivery; it does not interrupt recovery at the first per-attempt timeout.

## Applying results and modes {#render}

For original CJK without spaces between words, the renderer preserves model-requested edge spaces and, when needed, inserts one owned space between adjacent alphabetic inline fragments of one sentence. The space does not cross a block/BR/image, attach to punctuation or sup/sub footnotes, or change intentionally joined alphabetic source fragments. Repeated application does not accumulate spaces; original restores the exact source text. An internally joined word in the model response is not split by guesswork.

Change Text.data and preserve leading/trailing whitespace. Before applying, check Text.isConnected, sessionId, batchId, and that current text equals the expected original/owned value. An external mutation becomes the new original; a stale response is skipped. Original/translated values are retained; show original stops new batches and observer auto-translation until translated mode resumes. Completed translations restore without network access; pending resume allows only new/unfinished nodes. Cancel stops batches, sends abort to the background, and retains completed text. Never use innerHTML for translation.

When switching CJK ↔ Latin/Cyrillic, the renderer may own only `font-size` and `line-height` on the immediate HTML parent of one meaningful Text node without child elements. This prevents styling changes to untranslatable children. Font family and DOM structure are preserved. Canvas TextMetrics compares the visible height of CJK and uppercase letters in the original computed font. Do not shrink CJK to match Latin-letter height: complex characters must remain readable. Adjustment only increases size, to at most 1.4 times the original; ordinary text targets a minimum of 14 px for letters and 16 px for CJK, while small/figcaption/caption/sup/sub captions target 12/13 px. Heading sizes preserve the original hierarchy. This is a bounded readability heuristic, not a guarantee for every font and site.

Automatic font adjustment applies only to leaf blocks p/h1–h6/li/blockquote/dt/dd/figcaption/caption/small/sup/sub in free-flowing text. Inline links/spans, navigation, aside, forms, buttons, tables, and nowrap presentation preserve the original size and line spacing.

Before adjustment, record only the two owned properties with priority. Repeated application does not accumulate scaling. If adjustment increases overflow in a hiding/clipping ancestor (at most 8 ancestors), restore both properties. The site's `font-size-adjust` takes priority: skip adjustment when it has a set value. On original, external text/style changes, node removal, reset, and dispose, remove owned values; preserve new external inline values. Records are bounded by the registry (5 000), the metrics cache by 128 values; owned styles are included in the observer's guarded writes.

## Dynamic DOM and SPA {#sessions}

Streaming previews are tied to the source node's current sessionId/batchId/revision. The background sends a cumulative snapshot at most once per 100 ms with a monotonically increasing sequence; old frames are discarded. A preview stores a separate owned Text value, does not change original, and does not increase committed translated/fromCache counts. Reset/failure/cancel/original restores affected originals/styles while preserving external text/new styling. A final valid batch commits translation. Detached prune, navigation, and dispose release previews, callbacks, and timers. Resume skips already committed translations.

MutationObserver with ~400 ms debounce: added subtree + characterData, guarded owned writes. No translation-of-translation loops. History navigation is checked without injecting a script into the page MAIN world: popstate/hashchange and bounded URL checks while a session is active; DOM replacement is detected by the observer. On route change, cancel the old session/clear registry; new context and a new session are coordinated with the background. Safe resumption preserves active mode and settings and does not apply old responses. One bootstrap marker/listener per document; repeated injection does not multiply handlers.

## Errors, cleanup, and readiness {#acceptance}

DOM tests cover filtering, whitespace, event listeners/form state, external changes, owned-mutation loops, dynamic inserts, viewport order, cancel/stale replies, restore, route reset, detached prune, and dispose timers/observers. At the limit, show an understandable error/limitation. `@spec` on scanner/registry/renderer/controller and tests. getState returns a safe snapshot. dispose releases listeners/timers/registry and aborts sessions.

## Relationships and history {#changelog}

- 2026-10-26: translated into English and updated documentation paths; existing behavior, contracts, and limits preserved.

Related: `spec://modules/platform/INFRA-001-extension#runtime`, `spec://modules/translation/FEAT-001-engine#dedup`.
- 2026-10-07: initial DOM pipeline and page restoration.
- 2026-10-08: bounded CJK ↔ alphabetic-script readability adjustment using actual metrics and restoration of two owned properties.
- 2026-10-08: separate provisional display of complete streaming items and rollback by session/batch/sequence.
- 2026-10-08: small CJK-aware batches, long nodes without truncation, inline spaces, and conservative font adjustment.

