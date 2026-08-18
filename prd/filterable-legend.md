# Feature — a canvas legend that doubles as a filter

**Status:** Implemented — 2026-08-18, branch `worktree-worktree-filterable-legend`. Not merged.
**Owner:** Sami Mokaddem
**Requested:** 2026-08-18
**Area:** `src/ui/elements/Legend/` (new), `src/ui/elements/Layout.ts` (new canvas slot), `src/ui/UIManager.ts` (`UI_ELEMENTS` row), `src/interfaces/GraphUI.ts` (new `UI.legend`), `src/GraphQueryEngine.ts` + `src/interfaces/GraphQueryEngine.ts` (synthetic facet registration), `src/Graph.ts` (`setLegend`, `legendToggle` event)
**Type:** UI element / filtering capability
**Related:** [`misp/declarative-filter-facets.md`](misp/declarative-filter-facets.md) (the facet vocabulary this reuses, and the panel it must stay in sync with); [`graph-app-b3-control-layout.md`](graph-app-b3-control-layout.md) (the canvas chrome it has to share corners with); [`misp/runtime-sidebar-panels.md`](misp/runtime-sidebar-panels.md) (the runtime-registration pattern `setLegend` mirrors)

---

## Implementation (2026-08-18)

Shipped on `worktree-worktree-filterable-legend`. `tsc`, `eslint` and `npm run build`
clean; `npx vitepress build docs` clean (no dead links); the new `legend.spec.ts` is
20/20, and `filter` / `filter-facets` / `facets` / `ui-chrome` / `extra-panels` /
`mode-rail` / `tool-panel` / `view-flyout` / `node-panel` stay green (90 tests) — the
suite's ~16 pre-existing canvas-drift failures on this machine were not re-run.

### Where things landed

| Area | File |
|---|---|
| Types (`LegendEntry` / `LegendOptions` / `LegendToggleState` / `LegendPosition`) | `src/interfaces/GraphUI.ts` |
| `legendToggle` on the data bus | `src/interfaces/GraphOptions.ts`, `src/Graph.ts` |
| `graph.setLegend()` | `src/Graph.ts` → `UIManager.setLegend` |
| Additive facet registration | `src/GraphQueryEngine.ts` (`registerFacet` / `unregisterFacet` / `facetFor` / `allFacets`) |
| Canvas slot + element row | `src/ui/elements/Layout.ts`, `src/ui/UIManager.ts` |
| The component | `src/ui/elements/Legend/Legend.ts` + `legend.scss` |
| Tests | `tests/visual/specs/legend.spec.ts`, harness `loadWithLegend` / `legendRows` / `legendEvents` / `warnings` / `nodeColor` |
| Docs | `docs/ui-legend.md`, gallery card `filterable-legend`, cross-links from `ui.md` / `ui-filter.md` / `color-by-category` |

### Decisions that refine the spec

- **§5.3 the reserved predicate is negative.** A node is hidden when it matches a
  **hidden** entry — not "visible when it matches a visible one". Written the other way
  round, a node whose key is blank matches no entry and would be hidden the moment any
  legend filter existed, contradicting D9. As a consequence "hide everything" empties
  the canvas *except* the nodes no entry covers, which is the honest reading of D9.
  This also side-steps a trap in `matches()`: an empty array filter value matches
  **everything**, so a value-list approach would have shown the whole graph back.
- **Adopted mode cannot express "hide everything".** For a declared facet an empty
  multiselect means *no constraint*, so the last shown row is `disabled` (with a title
  saying why) and invert is refused when it would empty the set. The legend's own key
  has no such limit. Also inherited from the panel's vocabulary: in adopted mode,
  blank-valued nodes *are* hidden by any selection — exactly as the panel hides them.
- **`entries` + `key` combine** instead of "entries wins and warns": the entries give
  labels/colours and `key` supplies the default predicate for entries without one. An
  entry with neither warns and matches nothing.
- **Derived labels are the raw value**, not a prettified one — matching the filter
  panel, whose auto-derived option labels are `String(value)`. Only the *title* is
  prettified from the key.
- **The list cap is `maxVisibleEntries` + a quarter row**, so the next entry's top edge
  peeks through and says "there is more". An exact cap looked like a clean edge with no
  scroll affordance (Chromium renders no gutter here); a half row sliced a label
  through the middle.
- **`setLegend(undefined)` keeps the component and empties it**, rather than
  unregistering the element — reversible, and it still removes the filter, unregisters
  the reserved facet and clears the DOM. Conversely `setLegend(config)` on a graph that
  never declared one constructs and registers the element on the spot.
- **Counts** are over `getMutableNodes()` minus `isChild` (§7.2 as proposed): the
  top-level nodes, so expanding a cluster doesn't move the numbers. The *predicates*
  still match children, so a hidden category is hidden inside a subgraph too.

### The automatic legend (D10)

`UI.legend` became `LegendOptions | boolean`, and the element is now built in
`full` / `light` **unless** suppressed — the colour check needs the renderer and the
data, so only the component can make the call, and it renders nothing when the answer
is no. Details worth keeping:

- **The candidate is never a guess.** It is `render.nodeTypeAccessor`, which the
  consumer declared to drive `nodeStyleMap`. A data scan would have repeated the filter
  panel's auto-derivation footgun (§3.3 of the facets PRD): a legend keyed on `uuid`.
- **The cardinality ceiling is load-bearing, not decoration.** An id-like dimension
  gives one value per node *and* one colour each, so it passes "every category resolves
  to one colour" trivially. Only the ≤24 cap rules it out.
- **A legend nobody asked for warns about nothing.** The blank-value and multi-colour
  warnings are suppressed while the legend is merely being *considered* — hence
  `derive(…, quiet)` and the `conflicted` flag on its result. The one exception is the
  >5000-node skip, which warns so the absence is explainable.
- **No facet adoption in automatic mode:** there is an accessor, not a key, so there is
  nothing to match a declared facet against.
- `setLegend(undefined)` now means *automatic* (it used to mean *remove*);
  `setLegend(false)` removes. The API had not shipped, so this replaces rather than
  breaks.
- Gallery fallout: only `filter-query-engine` actually gains a legend (`mode: 'full'`
  plus `nodeTypeAccessor` + `nodeStyleMap` colours) — its `pic.png` is regenerated. The
  other five cards declaring an accessor run in the library's default `viewer` mode, so
  nothing changes. **Note for whoever reads `docs/ui.md` next:** it claims `full` is the
  default mode, but `DEFAULT_UI_OPTIONS.mode` is `'viewer'` — a pre-existing doc bug,
  left alone here.

### Found on the way in

- `queryEngine.getFilters()` **always** appends a `manuallyHidden` entry, so "no
  filter" can only ever mean "no legend key present" — the tests assert on
  `activeFilterKeys()` minus that entry.
- `setFacets()` replaces the registry wholesale, which is why the legend needed
  `registerFacet`. `applyFiltersOnSubgraph` now hands **declared + reserved** facets
  down: the `__legend` filter key travels in `mainFilters`, and without its facet the
  subgraph would match it against a non-existent data key and hide every child.
- The legend renders from a `requestAnimationFrame` after `afterMount`, not from
  `graphReady`: `graphReady` only fires once the simulation has settled (seconds on a
  big graph), while `graph.renderer` — whose styles the swatches sample — only exists
  after the `UIManager` constructor returns.

### Not done

- §7.5 (legend vs. a tall View flyout on a short viewport) is handled only by
  `z-index` + the collapse affordance, as specced. No auto-collapse or auto-reposition.
- A `viewer`-mode legend stays out of scope per D6, so a published `static` graph still
  has no key.

---

## 0. Instructions

Relentlessly ask me questions whenever you have a doubt on the implementation.

## 1. What we're trying to achieve

Give a colour-coded graph a **key the user can read, and click**. A legend docked on the
canvas that lists each category with its swatch, its label and how many nodes it covers —
and where clicking an entry hides or restores that category, driven through the filter
subsystem that already exists.

The legend is **descriptive**: the integrator remains the sole owner of what colour a node
is. The legend reports the mapping and filters on it; it never assigns a colour.

### Explicitly out of scope

The original request also asked for a control panel where the **end user** picks a palette
and re-maps colours to nodes. That is **dropped** (decision D0, §4): choosing a palette and
mapping it onto data is the integrator's job, in code. Consequences:

- No runtime palette picker, no per-category colour override, no user-switchable colour
  dimension.
- `ColorPaletteMapper` and `PALETTE_REGISTRY` (`src/plugins/colors/`) stay exactly as they
  are — integrator-side helpers the library still never calls itself.
- No new `render.colorBy` config, and therefore no new node-style precedence rules and no
  restyle-repaint path. **The legend never triggers a repaint for colour reasons.**

## 2. What professional tools do

- **Gephi / Cytoscape** — the legend is a partition panel: value, swatch, count, and a
  visibility checkbox per value. Clicking filters; the count is stable.
- **Kibana / Grafana** — clicking a legend series toggles it, and modifier-click solos it.
  The legend is the primary filter control, not a decoration.
- **Maltego / Linkurious** — a docked, collapsible key in a canvas corner, with counts,
  surviving pan/zoom. Colour assignment lives in the configuration, not the legend.

The common thread: the legend is *the* affordance for "show me only these", and it is
authoritative about what the colours mean because the mapping is declared, not guessed.

## 3. Gap in Pivotick today

### 3.1 There is no legend at all

`grep -ri legend src/` returns nothing. A colour-coded graph is currently unreadable
without out-of-band documentation.

### 3.2 The library cannot see the colour mapping

Node colour is resolved from `render.defaultNodeStyle.color`, which is
`string | ((node: Node) => string)`, plus `render.nodeStyleMap` keyed by
`render.nodeTypeAccessor`. The canonical integrator pattern (`src/main.ts:280`) is:

```ts
const colorPaletteMapper = new ColorPaletteMapper('pivotick')
// …
defaultNodeStyle: {
    color: (node: Node) => colorPaletteMapper.getColor(node.getData()?.type)
}
```

That closure is opaque. The library cannot enumerate the categories, cannot know which
field drives colour, and cannot reassign anything. This is why the legend must either be
**declared** or **sampled** — see §5.2.

The one thing the library *can* do is ask for the already-resolved style:
`GraphRenderer.getNodeStyle(node): NodeStyle` is abstract (`src/GraphRenderer.ts:30`) and
implemented by both the SVG and canvas renderers. Sampling `getNodeStyle(node).color` is
therefore renderer-agnostic and truthful by construction — it returns what is actually
painted.

### 3.3 Filtering exists, and a second mechanism would fight it

`GraphQueryEngine` already offers `setFilter` / `setFilters` / `removeFilter` /
`resetFilters`, a per-node `excludeNode` escape hatch, a `filterChange` event, and a facet
registry (`setFacets` / `getFacets`) that gives `accessor` / `predicate` semantics to
programmatic filters as well as panel-driven ones. `GraphFilter` renders the panel and
re-syncs its form from `filterChange`.

A legend keeping its own private hidden-node set would duplicate all of that and drift out
of sync (notably: per-node exclusions do not cover nodes added later). The legend must
therefore express itself as a filter.

### 3.4 Every free canvas corner is nearly taken

Current absolutely-positioned canvas overlays:

| Slot | Position | Notes |
|---|---|---|
| `pvt-moderail` | `top:header+14px; left:14px` | 54px wide, `z-index:6` |
| `pvt-toolpanel` | `top:header+14px; left:84px` | 216px wide, grows downward |
| `pvt-viewflyout` | `top:header+14px; left:84px` | 252px wide, tall |
| `pvt-graphnavigation` | `top:header+14px; right:14px` | `z-index:5` |
| `pvt-notification` | `top:header+1em; right:3em` | max 280px |
| `pvt-slide-panel` | `top:header+14px; right:14px; bottom:14px` | up to 30% width when open |

**Bottom-left is the only genuinely free corner**, and it is also the conventional legend
position. The tall left-edge panels (tool panel, view flyout) grow down into it on short
viewports, which is what the collapse affordance and a capped height are for.

## 4. Decisions taken (grilling session, 2026-08-18)

| # | Question | Decision |
|---|---|---|
| D0 | Does the library take ownership of colouring? | **No.** Descriptive legend only. The user-facing palette picker / colour re-mapping idea is dropped entirely — that belongs to the integrator, in code. |
| D1 | Where does it live? | **Canvas-docked**, bottom-left by default, collapsible, with its header carrying the legend's own actions. |
| D2 | What does clicking an entry do? | **Toggles that category's visibility through the query engine** — one reserved predicate facet, so it round-trips with the filter panel. |
| D3 | Where do entries come from? | **All three forms:** a derived `key` shorthand (distinct values, swatch sampled from the resolved node style), an explicit `entries` array, and an `entries` function re-resolved against the live graph. |
| D4 | Swatch vocabulary? | **Node colour swatches only** for v1. No shape / line / icon swatches, no edge entries, no multi-section legends. |
| D5 | Affordances? | Per-entry **counts**, **collapse/expand**, **show-all + invert**. **No** hover-to-highlight. |
| D6 | Which UI modes? | **`full` and `light` only.** The legend is chrome; `viewer` and `static` have none. |
| D7 | Legend key collides with a declared filter facet? | **Adopt the facet.** The legend writes that facet's key instead of the reserved one, so panel and legend become two views of one filter. |
| D8 | API surface? | `UI.legend` config + `graph.setLegend(config)` runtime setter + a `legendToggle` data-bus event. **No** custom-render override in v1. |
| D9 | Derived-mode awkward data? | **Skip blanks** (null/undefined key values get no entry and are never hidden by the legend); if a category resolves to several colours, **the first sampled colour wins**, with a dev-time warning. |
| D10 | Should the legend be on by default? | **Yes, but only when it can be truthful.** With no `UI.legend`, key on the already-declared `render.nodeTypeAccessor` and show a legend *only* if that dimension explains the colours (one colour per category, ≥2 colours, ≤24 categories, ≤5000 nodes). `legend: false` suppresses, `legend: true` skips the vetting. Added 2026-08-18 after the first pass shipped. |

Smaller calls made in the same session, open to revision:

- The legend `title` is a verbatim string, so it can be translated.
- Toggle state is keyed by entry `id`, and an id that vanishes from re-resolved entries
  loses its state (it does not linger as a hidden ghost).
- **Counts are computed over the whole graph**, not over the visible set, so they don't
  flicker while you toggle. Hidden-ness is expressed by the swatch state instead.
- A zero-count entry stays listed but dimmed (explicit `entries` can legitimately declare
  categories that are currently absent).
- `alt`-click solos an entry (everything else off); invert is the way back.

## 5. Proposal

### 5.1 Config

New `UI.legend` block, declared in `interfaces/GraphUI.ts`. The entry type belongs with the
UI options (it is presentation + a predicate), and the query engine never imports it.

```ts
/** One row in the legend: a swatch, a label, and how to tell which nodes it stands for. */
export interface LegendEntry {
    /** Stable identity: the toggle key, and the value written to the filter. */
    id: string
    /** Used verbatim (so it can be translated). @default a prettified `id` */
    label?: string
    /** The swatch colour — any CSS colour. In derived mode, sampled from the renderer. */
    color: string
    /**
     * Which nodes this entry stands for.
     * @default derived mode — `node.getData()[key] === id`
     */
    predicate?: (node: Node) => boolean
    /** Display order, ascending. @default declaration order (explicit) / first-seen (derived) */
    order?: number
}

/** `UI.legend` — the canvas legend. Present ⇒ enabled, unless `enabled: false`. */
export interface LegendOptions {
    /** @default true when the block is present */
    enabled?: boolean
    /** Header text, used verbatim. @default a prettified `key`, else `'Legend'` */
    title?: string
    /**
     * Derived mode: the node-data key whose distinct values become the entries.
     * Swatch colours are *sampled* from the renderer's resolved node style — the
     * legend never assigns a colour. Ignored when `entries` is set.
     */
    key?: string
    /** Explicit mode: the entries, or a function re-resolved on `dataBatchChanged`. */
    entries?: LegendEntry[] | ((graph: Graph) => LegendEntry[])
    /** @default 'bottom-left' */
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
    /** @default true */
    collapsible?: boolean
    /** Start collapsed. @default false */
    collapsed?: boolean
    /** Per-entry node counts. @default true */
    showCounts?: boolean
    /** Clicking an entry filters the graph. @default true — `false` ⇒ a pure key. */
    filterable?: boolean
    /** Cap before the list scrolls internally, in entries. @default 12 */
    maxVisibleEntries?: number
}
```

`entries` wins over `key` when both are given (and warns). Neither ⇒ the legend does not
mount.

### 5.2 Resolving entries

Three input forms, one internal shape (`LegendEntry[]`, ordered):

1. **Explicit array** — used as-is.
2. **Function** — `entries(graph)`, re-resolved on `dataBatchChanged` and on `setLegend`.
   Mirrors `FilterFacet.options`, so option lists follow the data without the declaration
   churning.
3. **Derived from `key`** — for each node in `graph.getMutableNodes()` (raw, to avoid
   cloning the whole graph for a count), read `node.getData()[key]`:
   - `null` / `undefined` / `''` → **skipped** (D9). Count how many were skipped and
     `console.warn` once per resolution when non-zero, naming the key: those nodes are
     unrepresented and the legend can never hide them.
   - otherwise, `id = String(value)`, `label = prettify(id)`,
     `color = renderer.getNodeStyle(firstNodeSeenForThisValue).color`.
   - If a later node of the same value resolves to a **different** colour, keep the first
     and `console.warn` once that the legend is approximating this category (D9).
   - Order = first-seen.
   - An **array-valued** key contributes one entry per element (a node with
     `tags: ['a','b']` appears under both), and the derived predicate is membership.

`getNodeStyle(node).color` is typed `((node) => string) | string` on `NodeStyle`; the
resolved value out of the drawer is a `string` in practice — the implementation must assert
that and fall back to skipping the entry (with a warning) rather than rendering a swatch of
`[object Function]`.

Re-resolution never repaints the graph; it rebuilds the legend DOM only.

### 5.3 Filter wiring

**Reserved facet.** When the legend is filterable, it registers one synthetic facet:

```ts
{
    key: '__legend',
    label: 'Legend',
    type: 'multiselect',
    matchMode: 'exact',
    // ORs the visible entries' predicates
    predicate: (node, value) => visibleIdsFrom(value)
        .some(id => entryById(id)?.predicate?.(node) ?? false),
}
```

Toggling writes the **remaining visible ids**:

```ts
queryEngine.setFilter('__legend', { value: ['hub', 'ip'], matchMode: 'exact' })
```

- **All entries visible ⇒ `removeFilter('__legend')`**, so `getFilters()` stays clean and
  the filter panel's active-filter count doesn't show a phantom filter.
- **All entries hidden ⇒ `value: []`**, which honestly empties the canvas. Not prevented.
- The legend subscribes to `filterChange` and re-derives its lit/unlit state from
  `getFilters()`, so `resetFilters()` from the panel restores every entry and the two can
  never disagree.
- Because the predicate lives in the facet registry, nodes added *after* the toggle obey it
  automatically — the failure mode a private `excludeNode` set would have had.

**Registration must not clobber `UI.filter.facets`.** `setFacets(facets)` replaces the
registry wholesale. The engine needs an additive path (e.g. `registerFacet(facet)` /
`unregisterFacet(key)`, or an internal reserved-facet slot merged at match time) so the
legend's facet coexists with declared facets and survives a `setFacets` call. Two places
must be checked when this lands:

- `Graph` populating the registry from merged UI options at construction.
- `applyFiltersOnSubgraph` — cluster subgraphs are built with a **fresh** `UI` options
  object and have facets handed down explicitly. A cluster subgraph gets no legend (it has
  its own UI), but the reserved facet must not leak in as an unmatched key either.

**Facet adoption (D7).** If `UI.legend.key` equals the `key` of a declared
`UI.filter.facets` entry, the legend drives **that** key instead of `__legend`:

- Only for facet `type: 'select' | 'multiselect'` — a value list is meaningful there. For
  `text` / `regex` / `numberRange` / `boolean`, fall back to `__legend` and warn.
- Entry ids must be that facet's option values. In derived mode they are (both are the raw
  data values stringified); for an explicit `entries` array, ids that are not among the
  facet's options are toggled but match nothing — warn at resolution time.
- The filter value written is the visible ids, using the facet's own `matchMode`.
- Round-trip: clicking a swatch updates the panel's multiselect; picking in the panel
  re-lights the legend. One filter, two views.

**Non-adoption is intersection.** A `__legend` filter and any other facet AND together, as
all filters do. That is the documented behaviour and needs no special casing.

### 5.4 Placement & DOM

- `Layout.ts` gains a `legend?: HTMLDivElement` slot with class `pvt-legend`, appended to
  `pvt-canvas` for `mode === 'full' | 'light'` (alongside the existing `moderail` /
  `toolpanel` / `viewflyout` block).
- One `UI_ELEMENTS` row in `UIManager.ts`:
  `{ key: 'legend', modes: ['full', 'light'], enabled: o => o.legend?.enabled !== false && hasEntries(o.legend), make: ui => new Legend(ui), slot: ui => ui.layout?.legend }`
- `src/ui/elements/Legend/Legend.ts` + `legend.scss`, a `UIComponent` like its neighbours
  (`onMount` / `onAfterMount` / `onGraphReady` / `onDestroy`).
- Positioning: `position: absolute`, 14px inset on the configured corner, `z-index: 5`
  (below the mode rail's 6 so the left panels win a collision), `max-height` capped by
  `maxVisibleEntries` with the list scrolling internally. The scroll container opts into
  the themed scrollbar via the shared `_scrollbars.scss` mixin.
- Themed with the existing CSS custom properties; no hard-coded colours except the swatch
  fills, which come from the data.

```
┌─ canvas ──────────────────────────────────────┐
│ [rail][tool panel]              [zoom][notif] │
│                                               │
│                                               │
│ ┌ Node type          ↺  ⇄  ▾ ┐                │
│ │ ● Hub                   12 │                │
│ │ ● Leaf                   8 │                │
│ │ ○ IP address             3 │ ← hidden       │
│ │ ● Domain                 1 │                │
│ └────────────────────────────┘                │
└───────────────────────────────────────────────┘
```

### 5.5 Interaction

| Gesture | Effect |
|---|---|
| Click an entry (row or swatch) | Toggle that category's visibility |
| `alt`-click an entry | Solo it — every other entry off |
| Header `↺` | Show all (removes the legend's filter) |
| Header `⇄` | Invert the visible set |
| Header `▾` | Collapse to the title bar (session-remembered) |
| Keyboard | Rows are `<button>`s: tab-reachable, `Enter`/`Space` toggle, `aria-pressed` reflects state |

Hidden entries render with a hollow swatch **and** dimmed text — colour alone must not be
the only signal. Counts stay put when an entry is hidden.

`filterable: false` renders a pure key: no buttons, no gear, no hover affordance.

### 5.6 API

- **Declare:** `UI.legend` in `GraphOptions`.
- **Replace at runtime:** `graph.setLegend(config?: LegendOptions)` — re-resolves entries
  and re-renders; `undefined` / `{ enabled: false }` tears the legend down and removes its
  filter. Mirrors the runtime-panel pattern.
- **Observe:** a `legendToggle` entry on the existing data event bus
  (`interfaces/GraphOptions.ts` `GraphEvents`):
  `legendToggle: (state: { hidden: string[], visible: string[] }) => void`
  — fired after the filter is applied, so an integrator can persist the user's choice.
- No `UI.legend.render` override in v1 (D8): a custom body would have to re-implement
  toggling or the filter wiring goes dark. Revisit if someone asks.

Persistence across page loads is **not** the library's job: `legendToggle` out,
`setLegend` + `queryEngine.setFilter` in.

## 6. What the integrator does

**Derived — the one-liner.** Colours already come from a palette mapper; the legend just
reports it:

```ts
new Pivotick(container, data, {
    render: {
        defaultNodeStyle: {
            color: (node) => mapper.getColor(node.getData()?.type),
        },
    },
    UI: {
        legend: { key: 'type', title: 'Node type' },
    },
})
```

**Explicit — full control over labels, colours and matching:**

```ts
UI: {
    legend: {
        title: 'Threat level',
        entries: (graph) => distinctLevels(graph).map(level => ({
            id: level,
            label: t(`level.${level}`),          // translated, used verbatim
            color: LEVEL_COLORS[level],
            predicate: (node) => node.getData()?.level === level,
        })),
    },
}
```

**Adopting a declared facet (D7) — legend and filter panel as one control:**

```ts
UI: {
    filter: {
        facets: [
            { key: 'type', label: 'Type', type: 'multiselect', options: typeOptions },
        ],
    },
    legend: { key: 'type' },   // ⇒ writes setFilter('type', …), panel stays in sync
}
```

**Persisting the user's choice:**

```ts
graph.on('legendToggle', ({ hidden }) => localStorage.setItem('legend', JSON.stringify(hidden)))
```

## 7. Open questions / risks

1. **Derived-mode cost.** Entry resolution walks every node and calls `getNodeStyle` once
   per new category. On a 50k-node graph that is one full pass per `dataBatchChanged`.
   Mitigation: resolve on a `requestAnimationFrame`, coalesce bursts of data events (the
   runtime-sidebar-panels work already established that pattern), and bail out early once
   every distinct value has a colour if a cheap distinct-value scan is available first.
2. **Counts vs. clusters.** `getMutableNodes()` includes collapsed clusters' children while
   `getNodes()` filters `isChild`. Which set counts — and does an expanded cluster change
   the number? Proposal: count non-child nodes only (what the user can see on canvas), and
   revisit if it reads wrong on cluster-heavy data.
3. **`filterChange` → entry state, with adoption.** When the legend adopts a facet, a panel
   value containing options that are *not* legend entries has no legend representation. The
   legend should light only what it knows about and leave unknown values untouched when it
   writes back, rather than silently dropping them from the filter.
4. **Legend + `excludeNode`.** A node hidden by hand is not "hidden by the legend". The
   legend's counts and swatch states ignore manual exclusions by design (counts are
   whole-graph) — worth confirming that reads correctly next to the panel's hidden-node
   list.
5. **Short viewports.** Legend at bottom-left vs. an open View flyout growing down from
   `top:header+14px`. `z-index` gives the flyout priority, but on a ~500px-tall canvas they
   overlap. Options: auto-collapse the legend while a left panel is open, or shift the
   legend to bottom-right when it would collide. Needs a look on real geometry.
6. **`light` mode has no sidebar**, so it has no filter panel — the legend becomes the only
   filter UI there, and `↺` the only reset. Verify that reads as complete on its own.

## 8. Acceptance criteria

1. `UI: { legend: { key: 'type' } }` on a graph coloured by a palette mapper renders a
   bottom-left legend whose swatches match the painted node colours, with correct counts,
   in both `full` and `light` mode — and renders nothing in `viewer` / `static`.
2. Clicking an entry hides exactly that category's nodes; the entry goes hollow + dimmed;
   the count does not change; `getFilters()` shows one filter; `legendToggle` fires with
   the right `hidden` / `visible` split.
3. Re-clicking restores them. Once every entry is visible again, `getFilters()` is empty
   (no phantom filter).
4. `alt`-click solos; `⇄` inverts; `↺` shows all; `▾` collapses and re-expands.
5. Nodes added after a toggle, in a hidden category, arrive **hidden** (the facet predicate
   applies to them).
6. `resetFilters()` — or Reset in the filter panel — re-lights every legend entry.
7. With `legend: { key: 'type' }` **and** a declared `type` multiselect facet: clicking a
   swatch updates the panel's multiselect and vice versa, and only one filter key exists.
8. Explicit `entries` as an array and as a function both work; the function re-resolves on
   `dataBatchChanged` while preserving the toggle state of surviving ids.
9. Nodes with a missing `type` are absent from a derived legend, are never hidden by it,
   and produce exactly one dev-time warning naming the key.
10. A category rendering two colours produces one entry with the first colour and one
    dev-time warning.
11. `graph.setLegend(...)` swaps the legend live; `setLegend(undefined)` removes it and
    clears its filter.
12. `filterable: false` renders a non-interactive key.
13. 30+ entries scroll inside the legend without the canvas scrolling or the legend
    covering the viewport.
14. `tsc`, `eslint` and `npm run build` clean; the visual suite green with new specs for
    the legend (default, one entry off, collapsed, adopted-facet sync, long list) and no
    unrelated baseline churn.
15. Docs: a `UI.legend` reference page and a gallery card demonstrating derived mode +
    click-to-filter.

## 9. Work plan

| Step | Scope |
|---|---|
| 1 | `LegendEntry` / `LegendOptions` in `interfaces/GraphUI.ts`; `legendToggle` in `GraphEvents` |
| 2 | Additive facet registration in `GraphQueryEngine` (+ the `applyFiltersOnSubgraph` check) |
| 3 | `Layout` slot + `UI_ELEMENTS` row + `Legend` component skeleton, mounting in `full`/`light` |
| 4 | Entry resolution: explicit / function / derived-with-sampling, plus the two warnings |
| 5 | Filter wiring: reserved facet, toggle/solo/invert/show-all, `filterChange` re-sync |
| 6 | Facet adoption when `key` names a declared select/multiselect facet |
| 7 | `legend.scss` — themed, capped height, themed scrollbar, hollow+dimmed hidden state |
| 8 | `graph.setLegend()` + `legendToggle` emission |
| 9 | Visual specs (§8.14) |
| 10 | `docs/ui-legend.md` + gallery card |
