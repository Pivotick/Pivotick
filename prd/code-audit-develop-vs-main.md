# Code audit — develop vs main (2026-07-18)

Adversarially-verified code review of `git diff main...develop` (main @ `397e89a`, develop @ `7fe6476`, 100 changed files).
Method: 6 independent finder agents (5 correctness angles + 1 cleanup) produced 39 candidates; every distinct location got an
independent verifier told to refute it. 30 verdicts came back, all CONFIRMED, 0 refuted, collapsing to 23 distinct defects.
File:line references are against develop @ `7fe6476`.

Pickup notes for the fixing agent/session:
- Check off items as they land; one commit per defect (or per cluster) is fine.
- Findings 4–8 are one subsystem (async `onBeforeEdgeCreate` lifecycle) — read `src/editing/EdgeCreationSession.ts`,
  `GraphConnectManager`, and `src/editing/EdgeLabelPrompt.ts` together before fixing any of them.
- The "Unverified candidates" section at the bottom is finder output whose verifier died on a rate limit — re-verify before acting.

## Critical

- [x] **1. XSS via `javascript:` URLs in property links** — `src/ui/elements/Sidebar/PropertyList.ts:101`
  Link-like values are rendered as `<a href>` with no scheme validation: `looksLikeLink()` accepts any non-empty string under a
  link-named key (`url`/`uri`/`href`/`link`/`website`/`homepage`), and `createLinkValue` sets `href` verbatim.
  *Failure:* a node with `{ url: 'javascript:alert(document.cookie)' }` (the demo domain is crawled threat-intel data, i.e.
  untrusted by design) becomes a clickable script-executing anchor in the sidebar, tooltip, and inspect modal. The old
  `createHtmlDL` rendered these as plain text, so the diff introduces the vector. Fix: allowlist schemes (the existing
  `ABSOLUTE_URL` regex `/^(https?:|mailto:|ftp:|tel:)/i` is a good gate) and render everything else as text.

- [x] **2. `graphReady` re-broadcast on every `setData()` duplicates plugin handlers** — `src/ui/UIManager.ts:468`
  `callGraphReady()` re-emits the `graphReady` phase each time `Graph.setData()` runs (`setData → startAndRender →
  callGraphReady → emitPhase('graphReady')`), so `UIComponent.onGraphReady` (documented "run once the graph data is ready") and
  plugin `ctx.onPhase('graphReady', cb)` hooks re-run on every data refresh.
  *Failure:* an element that calls `this.trackInteraction('nodeClick', h)` in `onGraphReady` registers a second handler per
  `setData()` — after N refreshes the plugin's click action fires N+1 times, and the disposables list grows unboundedly until
  destroy.

- [x] **3. Silent note-content loss while an editor is open** — `src/renderers/svg/GraphSvgRenderer.ts:599`
  The note dirty-rebuild branch changed from `} else {` to `} else if (!note.isEditing()) {`, but `note.clearDirty()` above it
  runs unconditionally and there is no catch-up render when the edit session ends.
  *Failure:* app code calls `note.setContent()` while the user has that note's editor open (sync from another tab, API refresh):
  the card and textarea keep the stale text, and saving overwrites the programmatic update — the API-written content is silently
  lost. Main re-rendered the card on such changes.

## Async `onBeforeEdgeCreate` lifecycle cluster (`src/editing/`)

- [x] **4. Zombie connect mode resurrected after cancelling during a pending decision** — `EdgeCreationSession.ts:448` (drag), `:141` (click)
  `.then(() => this.connectManager.restart())` / `.then(() => finishInteraction(true))` run unconditionally when the async hook
  decision settles, with no check that connect mode is still active. Escape (GraphToolbar → `exitClickConnectionMode()`) is not
  blocked by the `deciding` lock.
  *Failure:* user drags an edge, hook decision pends (e.g. 600ms backend save), user presses Escape — mode exits, listeners
  removed. Promise settles → `restart()` sees `!modeActive` → `startClickConnection()`: toolbar re-lights, simulation re-disabled,
  connect styling back — but nodeClick/nodePointerDown handlers were never re-registered. Frozen-simulation zombie connect mode
  until edit mode is toggled. (Related unverified candidate: `finishInteraction(true)` at :142 re-enters the manager's global
  `activeSession` slot without checking the session still owns it.)

- [x] **5. A rejecting hook wedges the session (no `.catch`)** — `EdgeCreationSession.ts:448` / `:141`
  On main, `restart()`/`finishInteraction(true)` ran unconditionally right after `createConnection`; the replacement chains them
  with `.then()` and no rejection handler. `runDecision`'s `finally` only clears the `deciding` flag, then rethrows.
  *Failure:* a consumer's async `onBeforeEdgeCreate` rejects (validation fetch fails): drag path leaves state `'dragging'` with
  the shadow-edge preview stuck on the cursor; click path leaves the source highlighted; unhandled promise rejection in console.
  Edge creation stays wedged until the user right-clicks to abort.

- [x] **6. Duplicate-edge guard bypassed by static `labelPrompt`** — `EdgeCreationSession.ts:269`
  `const allowDuplicate = Boolean(hook) || Boolean(staticPromptMode)` — but with only `editors.edgeEditor.labelPrompt` set there
  is no `onBeforeEdgeCreate` consumer to own a duplicate policy.
  *Failure:* connect A→B twice with `labelPrompt` enabled and no hook: a second identical edge stacks on the first and enters the
  data model, where main's `if (exists) return` silently refused it. Only the hook should imply `allowDuplicate`.

- [x] **7. Modal prompts silently veto everything outside full/light modes** — `EdgeLabelPrompt.ts:164`
  `runModal()` resolves `null` (indistinguishable from user cancel) when `UIManager.createModal` returns undefined — which it
  always does in `viewer`/`static` modes because `Layout.ts` only creates the modal slot for `full`/`light`
  (`UIManager.ts:516-517`).
  *Failure:* an app in `viewer` mode starting a connect session programmatically with `labelPrompt: 'modal'` (or a hook calling
  `ctx.promptData`/`ctx.promptLabel({ mode: 'modal' })`) never creates any edge: no modal appears, every gesture resolves as
  cancelled, no error or notification explains why.

- [x] **8. Enter/Escape dead in the modal label prompt** — `EdgeLabelPrompt.ts:67`
  `makeInput` attaches `keydown → e.stopPropagation()` (needed for the inline variant), which stops events before they bubble to
  `runModal`'s body-level keydown handler (line 166: Escape cancel, Enter submit). `Modal.ts` has no key handling of its own.
  *Failure:* in the modal prompt, Enter doesn't submit and Escape doesn't cancel — only the mouse buttons work, despite the code
  comment promising "Enter on a single-line input submits". The shipped visual test clicks the Add button, masking this.

## Consumer-facing regressions

- [x] **9. `UIComponent` missing from UMD/IIFE bundles** — `src/index.ts:18`
  `UIComponent` is exported from the ES entry but never attached to the `Graph` class; the `vite.config.browser.js` footer
  replaces the global with `Graph` and copies over only `Node`/`Edge`/`ColorPaletteMapper`.
  *Failure:* `class StatsOverlay extends Pivotick.UIComponent` throws `TypeError: Class extends value undefined is not a
  constructor` in both browser bundles — the headline plugin feature is unusable there. Fix: `Graph.UIComponent = UIComponent`
  alongside the existing attachments.

- [x] **10. Dead copy buttons in pinned tooltips** — `src/ui/elements/Tooltip/Tooltip.ts:527`
  `pinTooltip()` clones with `cloneNode(true)`, which drops the listeners of the new PropertyList copy buttons and the auto-fit
  title's copy button; line 533 re-wires only the lightbox click.
  *Failure:* every copy affordance in a pinned tooltip silently does nothing — precisely the workflow pinning exists for (the
  unpinned tooltip disappears on mouse-out before the button can be reached).

- [x] **11. HTML string property values now render as literal text** — `src/ui/elements/Sidebar/PropertyList.ts:169`
  `createPropertyList` replaced `createHtmlDL` in the sidebar Properties panel, the Tooltip, and the InspectNodeModal, dropping
  `tryResolveHTMLElement` (which parsed string values/names as HTML via `template.innerHTML`).
  *Failure:* a consumer whose `nodePropertiesMap` returns `{ name: 'status', value: '<span class="badge">active</span>' }` —
  valid under the public `PropertyEntry` string type and rendered as a real element on main — now sees raw markup printed
  verbatim in all three surfaces after upgrading, with no code change on their side. Decide: restore HTML resolution (mind
  finding 1 — sanitize) or document the break.

- [x] **12. Stack overflow on cyclic node data** — `src/ui/elements/Sidebar/PropertyList.ts:38`
  `jsonToHtml` recurses (`:55`) with no cycle guard or depth limit — `depth` is only used for indentation.
  *Failure:* a node whose data contains a self-reference (`data.meta.parent === data.meta`) throws `RangeError: Maximum call
  stack size exceeded` inside the select/hover handler on every interaction with that node; the panel/tooltip renders empty or
  half-built.

- [x] **13. Uncapped facet rows freeze the properties panel** — `src/utils/ElementCreationAggregatedProperties.ts:127`
  The 10-row cap ("… N more") and the "- N other unique values -" merge were both removed; line 72 now passes
  `sortAggregatedProperties(aggregatedProperties, false)`, explicitly disabling the `MERGE_UNIQUE_THRESHOLD` collapse.
  *Failure:* multi-select a few hundred nodes with a high-cardinality property where at least two share a value (hostnames,
  timestamps): the sidebar builds hundreds of DOM rows and sliver-width bar segments per such facet — unusably long, janky panel
  where main showed at most 10 rows + summary line.

- [x] **14. Loose equality in facet filtering** — `src/ui/elements/Sidebar/Properties.ts:236`
  `applyNodeFacetFilter` compares with `==`/`!=` while the facet aggregation Map is type-sensitive.
  *Failure:* `{ port: 80 }` and `{ port: '80' }` display as two facet rows with separate counts, but "keep only" on the 3-node
  numeric row keeps all 6 nodes (`'80' == 80`), contradicting the count the user clicked; "exclude" likewise drops both groups.
  Use strict equality (values come raw from `Object.entries(data)` via `GraphGetters.ts:60`).

- [x] **15. Plugin keybindings silently clobber built-ins** — `src/ui/KeybindingManager.ts:13`
  `register()` is `this.bindings.set(binding.key, binding.callback)` — one callback per key, silent overwrite. The new
  `PluginContext.addKeybinding` (`UIManager.ts:405`) makes this third-party-reachable, and the identity-guarded disposer can't
  restore a displaced original.
  *Failure:* a plugin registers `{ key: 'Escape' }` to close its panel; from then on Escape no longer exits connect/lasso mode
  anywhere, for the lifetime of the UI, with no warning.

## Confirmed but below the severity cap

- [x] **16. Note drag/resize triggers a full renderer tick per mousemove** — `src/renderers/svg/NoteDrawer.ts:541` (drag), `:618` (resize)
  Both handlers end their per-mousemove closure with `this.graphSvgRenderer.nextTick()`, rewriting every node/edge/note position
  when only the dragged note and its single connector moved. O(N+E) DOM writes per move — janky on large graphs.

- [x] **17. Cluster expand/collapse no longer re-fits the view by default** — `src/renderers/svg/NodeDrawer.ts:611` (collapse), `:667` (expand)
  *Resolution (2026-07-20):* intentional — kept `fitViewOnExpandCollapse` default false; it's a documented opt-in with a GraphNavigation toggle. No code change.
  Main called `fitAndCenterWhenSettled()` unconditionally on both paths; develop gates them behind
  `simulation.isFitViewOnExpandCollapse()`, whose new option defaults to **false** — a silent behavior change for every existing
  embedder. Possibly intentional; if so, flip the default or call it out in release notes. (Related unverified candidate: the
  option lives in `SimulationOptions.ts:68` but nothing in the simulation reads it — it only gates the renderer.)

- [x] **18. `middleTruncate` can split surrogate pairs** — `src/ui/elements/Sidebar/titleFit.ts:42`
  `text.slice(0, head) + ellipsis + text.slice(text.length - tail)` slices UTF-16 code units, so astral chars / ZWJ emoji
  sequences can be cut mid-pair at either end (a long identifier-like title of emoji reaches this path), rendering U+FFFD
  garbage in the fitted title.

- [x] **19. Resizing a pinned tooltip never refits its title** — `src/ui/elements/Tooltip/Tooltip.ts:115`
  The title-refit ResizeObserver only observes the live tooltip element, and `refitTitle()` routes through the singleton
  `fitCurrentTitle` closure (the most recent hover's name element) — so the pinned copy, the case the comment at :112 claims to
  handle, is never refit. (Related unverified candidate: `fitCurrentTitle` is never cleared on `hide()`, retaining the last
  hover's replaced DOM subtree — minor leak, `:124`.)

- [x] **20. Visual-test harness leaks `edgeAdd` listeners** — `tests/visual/harness/harness.ts:682`
  `configureConnect()` registers a new `graph.on('edgeAdd')` listener on every call without removing the previous one while
  resetting `recordedEdges` — multiple `configureConnect` calls in one spec double-count recorded edges.

- [x] **21. Title-fit controller copy-pasted** — `src/ui/elements/Tooltip/Tooltip.ts:123-134` vs `src/ui/elements/Sidebar/MainHeader.ts:272-285`
  The whole controller (fitCurrentTitle closure, titleLastWidth guard, renderTitle/refitTitle, ResizeObserver wiring) plus its
  strategy doc-comment is duplicated character-identically. Extract into `titleFit.ts`.

- [x] **22. `escapeHtml`/`jsonPrimitiveHtml` re-implement JsonViewer helpers** — `src/ui/elements/Sidebar/PropertyList.ts:24`
  Identical to `JsonViewer.ts`'s `escapeHtml` and `createPrimitive`. Import instead.

- [x] **23. Dead export `getDislayableValue`** — `src/utils/ElementCreationAggregatedProperties.ts:239`
  A typo-named (`Dislayable`) exported alias of `displayValue()` with zero callers in src/, tests/, or docs/. Delete.

## Unverified candidates (finder output; verifier lost to rate limits — re-verify before acting)

- [x] `CLAUDE.md:20` still says "There is no test framework configured" while the diff adds the Playwright visual suite (doc drift).
  *Verdict (2026-07-20): REAL, fixed* — CLAUDE.md now documents the `tests/visual/` Playwright suite.
- [x] `EdgeCreationSession.ts:153` — the `deciding` lock returns inconsistent "handled" values: `handleNoteClick` returns false
  while a decision pends, `selectOrConnectNode` (`:117`) returns true.
  *Verdict (2026-07-20): REAL but inert* (both returns are ignored at every call site) — made handleNoteClick return true for consistency.
- [x] `SimulationOptions.ts:68` — `fitViewOnExpandCollapse` misplaced in SimulationOptions (see finding 17).
  *Verdict (2026-07-20): REAL but WON'T FIX* — it's public API (`GraphOptions.simulation.fitViewOnExpandCollapse` + the `isFitViewOnExpandCollapse`/`toggle` accessors on Simulation); relocating it breaks embedders for a cosmetic gain.
- [x] `GraphSvgRenderer.ts:632` and `~:1141` — dashed-connector styling hardcoded as inline attrs in two places despite
  `.pvt-note-edge`/`.pvt-shadow-edge` classes existing.
  *Verdict (2026-07-20): REAL, fixed* — moved the shared dashed look into a `.pvt-note-edge, .pvt-shadow-edge` CSS rule (invalid stroke via `--invalid`); only the dynamic `marker-end` toggle stays inline. Verified by notes + edge-create-veto specs (incl. reject-all invalid preview).
- `GraphSvgRenderer.ts:891` — `noteEdgePath` radius fallback `getNodeStyle(target).size as number` hides that `size` can be a
  function, which then flows into arithmetic as NaN.
- `ContextMenu.ts:250` / `GraphControls.ts:84` — `declare public uiManager` re-declarations exist only to widen a protected field.
- `PropertyList.ts:125` — `createPropertyRow` typed `HTMLElement | null` but no path returns null; caller guard is dead.
- `UIManager.ts:320` — `onPhase()` lacks the `destroyed` guard its siblings `installPlugin` (`:397`) and `addElement` (`:427`) have.
- `Tooltip.ts:124` — `fitCurrentTitle` closure retained after `hide()` (see finding 19).

## Caveats

- The final sweep pass (an extra finder round over the verified set) died on a session rate limit and never ran, so tail-end
  coverage is slightly thinner than a clean xhigh run; the finder and verify phases completed fully.
- All 30 obtained verdicts were CONFIRMED with code-level evidence; nothing was refuted. The "unverified" list above is the gap
  between 39 candidates and 30 verdicts.
