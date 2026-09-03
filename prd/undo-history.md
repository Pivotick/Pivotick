# Feature — undo/redo with a history dropdown: taking back what the canvas holds

**Status:** **M1 shipped and half of M2** 2026-09-03 on `worktree-undo-history` —
`graph.history` is complete, both top-bar buttons are wired with keyboard undo/redo, and the
toast is a plain report again. 16 behavioural tests in `tests/visual/specs/history.spec.ts`.
What is left of M2 is the dropdown (gated on B vs B2) and the hover highlight (gated on the
legend-hover merge); M3 (re-staging, docs, gallery) is untouched. Grilled with Sami 2026-09-03;
twenty-four decisions taken (§6). Four competing designs for the dropdown were built as
prototypes (§10) and **B, the timeline, is chosen**; a reversed draft, B2, followed. Still open
before M2: B against B2 (§10.2) — an ordering, not a direction — and merging the legend-hover
work (`develop`'s `a17e138`) that H16 needs.
**Owner:** Sami Mokaddem
**Requested:** 2026-09-03
**Area:** greenfield `src/GraphHistory.ts` + history types in `src/interfaces/`, with touch
points in `src/PivotManager.ts` (its undo/redo moves out), `src/editing/GraphEditingManager.ts`
(deletions and hand-created elements record themselves), `src/GraphQueryEngine.ts`
(`excludeNode`/`includeNode` record themselves), `src/ui/elements/Mainheader/` (the two buttons
get wired and gain menus), `src/ui/KeybindingManager.ts` (`metaKey`), and
`src/interfaces/InterractionCallbacks.ts` (one `persisted` field on three decisions). Adds
**public types** and a **new public accessor**, `graph.history`.
**Type:** data-path capability plus one UI surface — a bounded command history, not the general
engine.

**Related:** [`pivot-enrichment-interface.md`](pivot-enrichment-interface.md) — D25 built the
pivot-run undo this generalises, and its §12 said the Mainheader buttons stay unwired; this PRD
reverses that. [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) §7 holds the
open-ended "command/history stack over the mutation API"; this is a deliberately smaller thing
and closes that roadmap line at the size §6 chooses.
[`pivot-enrichment-ui-states.md`](pivot-enrichment-ui-states.md) — **C10 is retired** (H20).
[`pivot-enrichment-ui-prototype-brief.md`](pivot-enrichment-ui-prototype-brief.md) §8 listed
"a general undo/redo history (and wiring the Mainheader buttons)" as out of scope; also
reversed. [`pivot-persistence.md`](pivot-persistence.md) — P13's undo-after-save warning and
this PRD's `persisted` flag (H6) are the same concern reached from two directions; §12 says how
they meet.

**Depends on:** the legend-hover work (`emphasiseElements` / `clearEmphasis`), merged before
implementation starts. H16 needs a multi-element highlight; today's `highlightElement` takes one
element and clears the last.

---

## 0. Instructions

Read §4 before proposing anything: several of the obvious moves are already half-built, and two
are built in ways that look right and are not. §6 is the authority — a decision numbered there
is settled and is not to be re-litigated in code review. Where this PRD and an older one
disagree, this one wins and says so explicitly.

---

## 1. Why

Enrichment is additive, fast, and easy to get wrong. One pivot lands twelve nodes; the wrong
pivot on the wrong selection lands two hundred, and the analyst who wanted to look at one domain
is now looking at a hairball they have to disentangle by hand. That is the pattern this library
now actively encourages, because pivots ship.

What it offers in return is a toast that lives twelve seconds. Miss it — read the room, take a
call, look at the graph first — and the run is permanent. Everything else the analyst does is
permanent from the outset: delete five nodes and they are gone, hide a subgraph and the only way
back is remembering precisely what you hid.

Meanwhile the top bar carries two greyed-out buttons that say the opposite. They have been
disabled placeholders since the B3 chrome landed. A user reads an Undo button as a promise, and
this one has been lying for two releases.

The fix is not the general command stack from `graph-app-b3-control-layout.md` §7 — that
proposes recording every mutation the library can perform, including property edits, which Sami
does not want and which no integration would trust anyway, because a property edit is backend
state and the library has no authority over it. The fix is a history of **what the canvas holds
and shows**: what was brought in, what was taken out, what was hidden. That is a much smaller
object, and it is exactly the object an analyst reasons about.

---

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **entry** | One reversible thing that happened, as one row in the menu. |
| **kind** | Which of the four sorts of entry it is: pivot, delete, visibility, create. |
| **span** | The contiguous block from the newest entry down to the one you clicked. Undo works on spans, never on single old entries. |
| **sealed** | An entry the consumer wrote through to a backend. Listed, never reversed. |
| **ledger** | The per-element record of which sources vouch for it, under which run (`src/Provenance.ts`). What makes removal uniform. |
| **run** | One pivot ingest, already a first-class record (`PivotRun`). Becomes one entry of kind `pivot`. |

---

## 3. What professional tools do

- **Maltego** — the closest prior art, again. Undo and Redo are both split buttons with
  dropdowns: "clicking the dropdown will display a list of graph actions that can either be
  undone or redone… Hovering over an action will also select all actions before it." So:
  contiguous, both directions, hover previews the span. Their list covers graph actions
  generally — undo/redo for deleting entities and links shipped as its own release note — not
  just transform runs. Separately they keep daily-backed-up **version history** as a backstop
  for what undo cannot reach, which is a different feature and is not this one.
- **Microsoft Office** — the same dropdown, up to a hundred actions deep, and selecting one
  undoes every action down to it in a single step. Terse labels: a verb and an object, no counts
  and no timestamps.
- **Photoshop** — a resident *panel* rather than a menu, with a pointer at the current state
  and one click to jump anywhere in the list. Non-linear history, which permits deleting one
  state without the ones after it, exists as an option, is off by default, and is widely
  reported as confusing.
- **git** — the tool that does have first-class selective reversal, and it is careful to call it
  something else. `git revert` of an old commit is a **new commit going forward**, not a rewind.

**What is taken from this.** The menu is contiguous, in both directions, with a hover span —
Maltego and Office agree and there is no reason to be clever. Selective reversal of one old
operation is a real need in an enrichment tool, and every serious tool that offers it puts it
somewhere other than the undo menu, or forward-only. So it stays out of the menu (H9).

---

## 4. Gap in Pivotick today

1. **Only pivots are reversible.** `PivotManager` keeps `undoStack`/`redoStack` of `PivotRun`,
   with `undo(runId?)`, `redo()`, `runs()`, `canUndo()`, `canRedo()`. It works, it batches
   through `graph.batchChanges`, and redo re-lands the recorded delta with no provider call.
2. **`undo(runId)` is quietly selective.** It splices by index, so it can already pull a run out
   of the middle of the stack — and pushes it onto the redo stack, where its position is then a
   lie. This is the one existing behaviour that has to change (H9, H13).
3. **The only surface is a toast.** `PivotTriage` raises `Ingested 12 nodes, 14 edges — Undo`,
   flipping to `Undone — Redo`. Twelve seconds, one run, and nothing else in the library can be
   taken back at all.
4. **The Mainheader buttons are hardcoded `disabled`** and wired to nothing
   (`Mainheader.ts:79-90`). `undoButton` / `redoButton` are already public fields.
5. **No keyboard undo anywhere.** `Ctrl+Z` and `Ctrl+Shift+Z` are free — the whole library
   registers only `Shift+J/K/N`, `Shift+T`, `v`, `Escape` and `Enter`. But
   `KeybindingManager.getKeyCombo` reads `ctrlKey`, `shiftKey` and `altKey` and **not
   `metaKey`**, so Cmd+Z cannot be expressed at all (H24).
6. **Two hides, only one of which survives.** `queryEngine.excludeNode()` writes a durable
   exclusion set; `graph.hideNode()` is transient and is silently undone the next time filters
   re-derive — the code says so at `GraphQueryEngine.ts:364`. Only the durable one can carry an
   entry (H5).
7. **Highlighting is single-element.** `highlightElement(element)` clears the previous highlight
   on every call, so a whole run cannot be lit up. The multi-element API arrives with the
   legend-hover work.
8. **A hand-created node is indistinguishable from seed data.** Its ledger is empty, and an
   empty ledger reports `'seed'`. Giving creations a real source is a contract change (§12).
9. **None of this has shipped.** The pivot feature — provenance, `pivots.undo`, the toast — sits
   under **Unreleased** in `CHANGELOG.md`. Moving undo/redo onto `graph.history` therefore costs
   no migration, no deprecation and no breaking change (H19).

---

## 5. What ships

- **`graph.history`** — a bounded, session-scoped history of what the canvas holds and shows,
  with four kinds of entry, contiguous undo and redo, and a change bus.
- **Two wired split buttons** in the Mainheader, each with a dropdown listing its direction,
  hover-previewing the span both in the menu and on the canvas.
- **Keyboard undo/redo**, and the `metaKey` support the key manager needs to have it on macOS.
- **One field on three hooks** (`persisted`) so a consumer that writes through can say so, and
  the entry seals itself.
- **Provenance-preserving deletion** — a deletion remembers each element's ledger, so undoing it
  restores who vouched for what rather than resurrecting orphans.

---

## 6. Decisions taken

### What the history is a history of

**H1 — The history records what the canvas *holds and shows*, not what the data *says*.**
Four kinds, a closed set: **pivot** (an ingest), **delete**, **visibility** (the durable
`excludeNode`/`includeNode`), **create** (a node or edge drawn by hand). This is the line Sami
drew and it is a better one than either option originally offered: it is exactly the set of
operations whose reversal the library has the authority to perform, because each is a change to
composition, and composition is the library's own.

**H2 — Property edits are out.** A node's data is backend state; the library did not author it
and cannot speak for it. An undo that reverted a field locally while the record of truth
disagreed would be worse than no undo. `onBeforeNodeEditCommit` remains the place a consumer
implements its own.

**H3 — Filter, legend and hide-disconnected state are out.** They are settings with visible
state and their own Clear, not acts. The filter form applies live on every keystroke, so typing
`domain` would push six entries; any coalescing rule would be arbitrary. And undo would fight
the panel, which would still be showing the filter the list claims to have removed.

**H4 — Notes are out.** Not asked for, and note content is authored text rather than graph
composition; deleting one is closer to an edit than to a deletion. Revisit if it bites.

**H5 — Visibility means the durable hide.** `excludeNode`/`includeNode` only. `graph.hideNode()`
is wiped by the next filter re-derive (§4.6), so an entry for it would reverse something that
had already reverted itself.

### Sealed entries

**H6 — A consumer that persisted an operation says so, and the entry is listed but never
reversed.** `NodeCreateDecision`, `EdgeCreateDecision` and `DeleteDecision` all already have an
object form with `accept`; each gains an optional `persisted?: boolean`. A consumer that wrote
the new node to its backend returns `{ accept: true, persisted: true }` and the entry seals.
Only the consumer can know this, so only the consumer can declare it.

Sealing deletions as well as creations extends Sami's rule to its mirror case: a delete that was
propagated to a backend cannot be undone canvas-side without the canvas and the record of truth
disagreeing. The rule is the same rule; flag it if the symmetry is unwanted.

**H7 — Sealed entries are listed.** They are part of the story of the graph, and a history that
silently omitted them would misexplain how the canvas got this way.

### The mechanic

**H8 — Contiguous only. Clicking the row three down undoes those three.** What Maltego and
Office both do, and hovering marks the span, as Maltego's does. No mechanism exists in the menu
for reversing one old entry alone.

**H9 — Selective reversal is API-only.** `graph.removeBySource(source)` already drops one
source's contribution and deletes only what nothing else vouches for; that is the honest home
for "that provider returned junk, drop it and keep the rest". It is a **forward operation** — it
appears in the history as a new entry and does not touch the redo stack.
`pivots.undo(runId)`'s current ability to splice an old run out of the middle of the stack is
removed with it: it is that splice, pushing onto a redo stack whose order then means nothing,
that this decision forbids. A UI for it was designed in this pass (a sources view) and cut; §13
keeps the record.

**H10 — A deletion snapshots each element's provenance ledger.** Without it: a run adds twelve,
the analyst deletes three, undoes the deletion, and the three come back with empty ledgers —
which the library reports as `'seed'`. Undoing the run afterwards then leaves three orphans that
nothing accounts for. With it, the counts stay honest and removal stays uniform. It costs one
`Map` copy per deleted element.

**H11 — Undo touches only what is still there.** A run whose nodes were later deleted by hand
undoes what remains and says nothing. This is already how `PivotManager.undo` behaves and it is
right: the alternative is refusing to undo because the graph moved, which helps no one.

**H12 — A sealed entry inside a span is skipped, not a wall, and the hover says so before the
click.** Skipping is only coherent because every entry here names the specific elements it
touched — there are no state diffs to get out of order. The hover state must state the outcome,
e.g. `Undoes 2 of 3 · 1 saved item kept`. A wall was the alternative and it fails badly in an
integration that persists every creation: the wall lands early and everything below it becomes
decoration.

### The rows

**H13 — Redo is strictly linear, has its own dropdown, and is emptied by any new action.**
Maltego gives Redo the same treatment, so the symmetry is prior art rather than invention. A run
that was undone and then stranded by a new action is gone; recovering it means re-running the
pivot. A restorable section for stranded runs was designed and rejected as a second meaning for
a menu that should have one.

**H14 — Every row carries a kind icon**, so pivot / delete / visibility / create is readable at a
glance without parsing the label. Icons come from `src/ui/icons.ts`: `sparkles` (the pivot
mode's own), `trash`, `hide`/`show`, `addCircle`.

**H15 — A row must let you tell two runs of the same pivot apart.** The same pivot run twice
must never render as two identical rows. Office and Photoshop both get away with terse
verb-and-object labels; an enrichment history cannot, because running the same pivot repeatedly
is the normal case. Counts, time, origin node — the composition is a design variable, and §10
is where it is decided.

**H16 — Hovering a row highlights the elements it touched, on the canvas.** The affordance a
graph tool can offer that a text editor's undo menu never could: it answers "which run was
that?" without committing to anything. Rows whose elements are gone — a deletion — light
nothing, honestly. Needs `emphasiseElements`/`clearEmphasis`.

### Shape and limits

**H17 — 30 entries, oldest evicted.** Office keeps a hundred; thirty is Sami's call and is
plenty for a session's real work. Eviction loses the ability to **restore** an old run, not to
**remove** it — provenance lives on the elements, so `removeBySource` still reaches an evicted
run. Document the asymmetry rather than hiding it.

**H18 — The entry kinds are closed; consumers read and drive the history but cannot record into
it.** Every entry naming specific elements is precisely what makes H12's skipping and H10's
restoration sound; an arbitrary consumer callback in the stack could throw halfway through a
span or fail to be idempotent, and the history would have no way to know. Opening it later is
purely additive.

**H19 — `graph.pivots.undo/redo/runs/canUndo/canRedo` move to `graph.history`.** Free: the
pivot feature is unreleased (§4.9), so this is a rewrite of an unreleased changelog entry rather
than a deprecation. `graph.removeBySource` stays where it is — it is a data API, not a history
one.

**H20 — The post-ingest toast loses its Undo action.** It goes back to being a plain report of
what landed, on the default four-second lifetime. With a history in the top bar, a second undo
affordance on a twelve-second fuse is a race the analyst can lose for no reason. **This retires
C10** in `pivot-enrichment-ui-states.md`. `Notifier`'s action API stays — it was built for this,
other callers may still want it, and it is documented.

**H21 — Undoing an ingest re-stages its candidates in the triage pane, but only when that
ingest is still the newest entry.** An immediate "wrong twelve" costs nothing: the rows go back
where they came from, the pane reopens if the ingest had closed it, earlier rejections still
hold, and no provider is called — which matters when the alternative is refetching two thousand
correlations through a rate-limited API. If anything at all has happened since, undo removes the
nodes and no pane appears; a pane resurrecting itself over later work would be worse than the
refetch.

**H22 — The buttons are wired, in `full` and `light`.** `UI_ELEMENTS` already gates the
Mainheader to those two modes, so `viewer` and `static` get no history for free. This reverses
D25's "the Mainheader's disabled undo/redo buttons stay unwired",
`pivot-enrichment-ui-states.md` C10, and the prototype brief's §5 and §8.

### Assumed, not asked — flag if wrong

**H23 — Session-only.** The history does not survive a reload. Maltego treats restoring an
earlier graph as a separate feature (version history) and so should this;
`pivot-persistence.md` is where that conversation lives.

**H24 — `Ctrl+Z` / `Ctrl+Shift+Z`, plus `metaKey` support so macOS gets `Cmd+Z`.** All four are
free. The key manager's editable-target guard already means Ctrl+Z inside a filter box falls
through to the browser's own text undo, which is correct. One wrinkle for whoever implements it:
`getKeyCombo` appends `event.key` raw, so the shifted combo arrives as `Ctrl+Shift+Z` with a
capital Z while the unshifted one is `Ctrl+z`.

---

## 7. The shape of the door

```ts
/** One reversible thing that happened. @category History */
export interface HistoryEntry {
    id: string
    kind: 'pivot' | 'delete' | 'visibility' | 'create'
    /** What the row says: 'AIL correlations', 'Deleted 3 nodes', 'Hid 5 nodes'. */
    label: string
    /** Elements this entry touched — the row's counts, and what hover highlights. */
    nodeIds: string[]
    edgeIds: string[]
    /** Set when the consumer reported the operation persisted (H6). Never reversed. */
    sealed: boolean
    /** For a pivot entry, which pivot produced it — two runs of one pivot share it. */
    pivotId?: string
    at: number
}

/** What a span would do, before it is committed. @category History */
export interface HistoryPreview {
    entries: HistoryEntry[]
    /** Reversed by this span. */
    nodes: Node[]
    edges: Edge[]
    /** In the span, left alone (H12). */
    skipped: HistoryEntry[]
}

/** @category History */
export interface GraphHistory {
    /** Newest first — the order the menu renders. */
    entries(): HistoryEntry[]
    /** Undone and still reachable, newest first. Emptied by any new action (H13). */
    redoable(): HistoryEntry[]
    canUndo(): boolean
    canRedo(): boolean
    /** Undo the span from newest through `throughEntryId`; the newest entry alone by default. */
    undo(throughEntryId?: string): HistoryEntry[]
    redo(throughEntryId?: string): HistoryEntry[]
    /** What that span would touch — drives the hover highlight and the menu's own copy. */
    preview(throughEntryId: string, direction?: 'undo' | 'redo'): HistoryPreview
    /** Fires on every change to either stack. Returns a disposer. */
    on(listener: (history: GraphHistory) => void): () => void
    clear(): void
}
```

`graph.history` exposes it. One field is added to three existing hook decisions:

```ts
type NodeCreateDecision = boolean | { accept: boolean, /* … */ persisted?: boolean }
type EdgeCreateDecision = boolean | { accept: boolean, /* … */ persisted?: boolean }
type DeleteDecision     = boolean | { accept: boolean, /* … */ persisted?: boolean }
```

`undo`/`redo` take an entry id rather than a count, so a click on a row cannot land on the wrong
span if the stack moved between render and click. Both land as a single `dataBatchChanged`,
through `graph.batchChanges`, exactly as `PivotManager.undo` already does.

---

## 8. What the analyst does

**The wrong pivot.** Select a domain, run AIL correlations, and two hundred nodes land where
twelve were wanted. Ctrl+Z, or the Undo button, and they are gone — and because the ingest is
still the newest entry, the candidates are back in the triage pane with the earlier rejections
intact, ready to be triaged properly without a second provider call (H21).

**Three steps back.** Ingest twelve, hide five neighbours, delete three stragglers, then decide
the whole line of enquiry was wrong. Open the Undo menu and hover the third row: those three
rows mark, and on the canvas the elements they touched light up. Click. All three reverse as
one, one `dataBatchChanged`, one re-render.

**The saved node.** The same three steps, but one of them created a node the integration wrote
back to MISP. It is listed, marked as saved, and the hover reads `Undoes 2 of 3 · 1 saved item
kept`. Click, and the two reverse while the saved node stays exactly where it is — the canvas
and the backend still agree (H6, H12).

**The bad provider.** Five runs deep, run three turns out to be junk, and runs four and five are
good. The menu will not do this, by design. `graph.removeBySource('ail-correlation')` will,
dropping that source's vouching and deleting only what nothing else vouches for — a node run
five also found stays, one claim lighter (H9).

---

## 9. Why this is cheap — what already holds

- **The hard half is built.** `PivotRun` already records nodes, edges, children, unions and
  vouched-existing elements; `undo`/`redo` already batch, already handle containers
  children-first, and already delete only what nothing else vouches for. Three of the four entry
  kinds are strictly simpler than the one that exists.
- **Provenance is the arbitration layer.** `src/Provenance.ts` already answers "does anything
  still vouch for this?", which is the only question undo has to ask. H10 is a `Map` copy.
- **The buttons, icons and menu styling exist.** `pvt-undoredo-group`, the `undo`/`redo` glyphs,
  `dropdown.scss`, and a `KeybindingManager` that needs one property added.
- **Nothing has shipped.** The API move (H19) and the toast change (H20) are edits to an
  unreleased changelog entry.
- **Mode gating is free.** The Mainheader is already `['full', 'light']`.

---

## 10. The four prototypes

Four competing designs of the dropdown, built as self-contained interactive pages in
`prd/design/undo-history/`. Each shows the Mainheader in situ, a mock canvas that reacts to row
hover, a fake history covering all four kinds with a sealed row mid-stack and two runs of one
pivot, both menus including Redo's empty state, and a light/dark toggle.

| | Direction | The bet |
|---|---|---|
| **A** | **Faithful** — two compact single-line menus, minimal ornament, the span shown by a rail. | That the pattern needs no invention and everything rides on craft. The control: if the others cannot beat it, they were decoration. |
| **B** | **Time travel** — one menu from either button, with a *now* line: done above, undone below and greyed. Click anywhere to travel there. | That undo and redo are one timeline, and splitting them into two menus is an artefact of there being two buttons. Photoshop's history panel, compressed. |
| **C** | **Consequence forward** — richer rows plus a footer stating the exact net effect of the hovered span before it is committed. | That undoing an enrichment is scarier than undoing a typo: twelve nodes leaving is invisible on a 200-node canvas, and an analyst who cannot predict the blast radius will never click past one step. |
| **D** | **Grouped for density** — the list grouped and collapsible, opening at the full 30 entries, with a group-level click undoing a whole group. | That thirty flat rows is a wall, and the cap is thirty. Must keep H8 intact: collapsing may never become a back door to undoing out of order. |

Every variant honours H8 (contiguous), H12 (sealed skipped, announced on hover), H13 (both
directions, Redo emptied), H14 (kind icons), H15 (two runs of one pivot distinguishable), H16
(canvas highlight on hover) and H17 (survives 30 rows).

**How the winner is chosen.** Against the §8 walkthroughs, at 30 entries as well as at five, in
both themes. The question is not which looks best empty; it is which is still legible on the day
the analyst actually needs it, which is the day they have done thirty things and one of them was
wrong.

### 10.1 What building them surfaced

Four things came out of the drawing that belong in the implementation whichever variant wins.
[`design/undo-history/README.md`](design/undo-history/README.md) has the per-variant detail.

- **`preview()` must simulate, not describe.** C and D arrived at this independently: replay the
  span against a copy of the state and diff it, using the same code path the click commits.
  Authored strings drift from the canvas; a simulated one cannot, and it gets the awkward cases
  right for nothing — a hide cancelled by a later unhide nets to zero, and the row honestly says
  so. §7's `preview` should be specified this way rather than as a summary of the entries.
- **The menu covers the canvas, which fights H16.** A right-anchored panel of 288–446px sits
  over the graph whose elements the hover is highlighting. A and B both raised it and neither
  solved it; C only dodged it by laying its mock graph around the open menu, which the real
  canvas will not do. Whoever implements M2 owns this — anchoring, width, or a highlight that
  survives occlusion.
- **H15 has a hole that counts and clocks do not close.** Two runs of one pivot, in the same
  minute, returning the same number of elements, still render as two identical rows. The
  tie-break has to be the origin node or a run ordinal, not the time.
- **The contiguity rule reads better drawn than written.** All four converged on a continuous
  rail from the top of the list to the cursor rather than a per-row treatment, and D's dashed
  cut labelled `↑ reversed · ↓ kept` is the clearest statement of the rule any of them found.

### 10.2 B is chosen; B2 is the same design, reversed

Sami picked **B, the timeline**: one list from either button with a *now* line through it,
travelled by clicking rather than two separate stacks. **B2** followed as a draft of the same
design with the list reversed — newest at the top, as every other menu in the app runs.

Reversing is not a rendering detail. In B, the redo stack sits *below* the line and the undo
stack above; in B2 they swap, so clicking below the line undoes and travelling back means
dragging the line *down*. The reason to want it: within the undo section, a span becomes "the
pointed-at row and everything between it and the line", which reading downward is literally
Maltego's "hovering over an action selects all actions before it". **B had to reinterpret H8 to
work; B2 satisfies it as written.**

Two findings from building it, both of which outlive the choice:

- **The gutter should be a ruler.** Each row carries how many steps a click on it travels,
  counted away from the line — so the undo list reads 1, 2, 3 downward, and the armed row's
  number is the `M` in `Undoes N of M`. The list and the footer then cannot disagree, and the
  magnitude of a click is readable on the row rather than only in the footer. It back-ports to
  B unchanged, and it is the strongest thing either draft added.
- **The 30-row flood is order-invariant, and neither draft fixes it.** Measured off the DOM
  rather than argued: aiming 25 steps deep paints 25 of 30 rows and pushes the now-line
  off-screen in *both*. It falls out of the contiguous rule itself, not out of the ordering, so
  closing it needs a separate move — a cap on the previewed span, or eliding the middle of a
  long one — and that move works identically either way. §12 keeps it.

What the reversal does change is resting scroll position, and it is a redistribution rather than
a free win: B2 needs no scroll when the redo stack is empty and full scroll when it is deep, and
B is the exact mirror. B2 wins on frequency, since "nothing undone" is the overwhelmingly common
state, and on one thing that is not frequency — B2's resting position *is* scroll-top, so
"scroll to top", the reflexive gesture, restores the now-line in B2 and destroys it in B.

---

## 11. Work plan

- **M1 — the engine. Done.** `src/GraphHistory.ts` (the timeline, the cursor, recording) plus
  `src/HistoryWorld.ts` (the reversal) and `src/interfaces/History.ts`. `PivotManager`'s stacks
  moved out (H19) and the selective splice went with them (H9). Deletions, visibility and
  hand-created elements record themselves; `persisted` landed on the three decisions (H6);
  hand-drawn elements are vouched for by `MANUAL_SOURCE` (§4.8). No UI. Eight deviations from
  what this section assumed, all deliberate:
  - **`preview()` simulates.** The reversal is written once against a `HistoryWorld`
    interface with two implementations — `LiveWorld` mutates the canvas, `ScratchWorld`
    mirrors presence, ledgers and the exclusion set. §10.1 asked for this and §7 did not
    specify it; `HistoryPreview` therefore gained an `effect: HistoryEffect` carrying the
    six net counts the footer states.
  - **`HistoryEntry.ordinal`**, closing §10.1's H15 hole: two runs of one pivot in the same
    minute returning the same count are told apart by a run ordinal, not a clock.
  - **H10 by construction, not by copy.** A delete entry keeps the live `Node`/`Edge`
    objects rather than a snapshot, so the ledger comes back with the element. Same outcome
    as the `Map` copy H10 costed, with no second copy of the truth to drift.
  - **`GraphHistoryLike` is the interface, `GraphHistory` the class** — mirroring
    `PivotManagerLike` / `PivotManager`, rather than §7's single `GraphHistory` interface.
  - **`redoable()` is newest-first and `redo(id)` travels up through that entry**, because
    the implementation is the one timeline B and B2 both assume: entries plus a cursor, not
    two stacks. A sealed entry is inert — the cursor passes over it in both directions.
  - **`history.group(fn)`** (internal) coalesces the visibility changes made inside one act,
    so hiding a selection of five is one entry. Bulk-hide is its only caller today.
  - **The toast keeps its Undo**, repointed at `graph.history.undo(runId)`. H20 removes it
    in M2; taking it out now would leave the release with no undo surface at all.
  - **A note deleted alongside nodes is not restored.** H4 keeps notes out of the kinds, so
    a mixed delete records and reverses its nodes and edges only. Flag if that bites.

  Small public additions the wiring needed: `queryEngine.getExcludedNodeIds()`, and
  `connectManager.createEdge` now returns the `Edge` it made.
- **M2 — the surface.** Half done. **Shipped:** both buttons wired and following the history,
  naming what they would take back (H22); `Meta` in the key manager plus a `Mod+` alias that
  matches Ctrl *or* Cmd, so `Mod+z` / `Mod+Shift+Z` is one binding for both platforms (H24);
  the toast reduced to a plain report (H20). **Left:** the dropdown itself, which waits on B
  against B2 (§10.2), and the hover highlight (H16), which waits on the legend-hover merge —
  `emphasiseElements` is in `develop` as `a17e138`, one commit away.
- **M3 — triage re-staging (H21), docs and the gallery card.** Re-staging is separable from M2
  and is the one behaviour that reaches back into `PivotManager`, so it goes last.

---

## 12. Open questions

- **B or B2** (§10.2) — an ordering, not a direction. The evidence leans B2: it satisfies H8 as
  written, it rests at scroll-top in the common case, and newest-first is how every other menu in
  the app runs. B keeps the cleaner timeline metaphor, top-to-bottom as time flowing forward.
- **How a long span is previewed without flooding the menu** (§10.2). Aiming 25 steps deep
  paints 25 of 30 rows and pushes the now-line out of view, in both drafts. Wanted: a cap on the
  previewed span, or an elision of its middle, that keeps both ends and the line on screen.
- **How H6 meets P13.** `pivot-persistence.md` P13 decided that undoing a *saved* pivot run
  stays possible and warns that it is canvas-only. H6 seals persisted *creations* outright. Both
  are defensible — an explicit Save is a deliberate act the analyst remembers, while a
  write-through on create is invisible — but if save-back ever ships, the two rules should be
  settled together rather than inherited separately.
- ~~**What a `manual` source tag does to `getSources()`.**~~ **Taken in M1.** A hand-created
  node or edge now reports `['manual']`, exported as `MANUAL_SOURCE`, and
  `graph.removeBySource('manual')` reaches hand-drawn work. The changelog carries it as
  breaking. Say so if the old `'seed'` answer was load-bearing somewhere.

---

## 13. Not in scope

- **A general command stack over every mutation** — `graph-app-b3-control-layout.md` §7's
  open-ended version. H1 draws the line at composition and visibility.
- **A resident history panel** (a dock tab, Photoshop-style). Designed in this pass and cut. The
  dropdown is the surface.
- **A sources view** — a panel listing the canvas by origin with per-source removal, and a
  restorable zone holding runs that were undone and then stranded. Designed in this pass and
  cut; `removeBySource` is the API that would back it, and H9 keeps the behaviour reachable
  without the surface.
- **Per-node provenance in the detail view** — select a node, see which run put it there, and
  reverse it from the sidebar. Explicitly **kept for a later stage**, not built now. It is the
  one cut idea that answers a question the dropdown cannot: not "what did I do" but "where did
  this come from".
- **Persistence across reloads** (H23), a timeline scrubber, a searchable history overlay, and
  on-canvas run hulls — the last of these largely subsumed by H16's hover highlight.

---

## 14. Tests and docs

**Visual (`tests/visual/`)** — the menu open at five entries and at thirty, in both themes; a
hover span including a sealed row, showing the skip copy; Redo's empty state. Note the standing
trap: the suite's 0.2 threshold is colour-blind, so a span marking that differs only in colour
can pass against a stale baseline.

**Behavioural, and worth asserting numerically rather than visually** — undo of a span lands as
exactly one `dataBatchChanged`; a node two runs vouch for survives undoing one of them; undoing
a deletion restores the ledger, and undoing the run afterwards then removes those elements too
(H10); a span containing a sealed entry reverses n−1 entries and the sealed element is still on
canvas; the stack holds at 30 and the 31st evicts the oldest; a new action empties the redo
stack; `Ctrl+Z` inside a filter input does not reach the graph.

**Docs** — a `docs/history.md` covering the four kinds, the contiguous rule, what `persisted`
does and who sets it, the eviction asymmetry (H17), and the fact that selective removal is
`removeBySource` and why. The `pivots.undo` lines in `docs/pivots.md` and in the unreleased
changelog entry are rewritten to point at `graph.history` (H19).
