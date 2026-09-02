# Pivot UI at scale — findings from a real misp-modules backend

Observations only. Nothing here is decided, and no library code was changed to
produce it.

`/misp-modules.html` registers one pivot per expansion module a live
[misp-modules](https://github.com/MISP/misp-modules) service advertises. Against
the instance used here that is **118 pivots**, plus one meta-pivot, against a
23-node seed of real public indicators. The measurements below come from that
page driven in a 1600×1000 viewport.

## What the numbers are

| | |
| --- | --- |
| Modules in the catalogue | 157 (118 expansion with declared inputs) |
| Pivots registered | 119 |
| Apply to one `ip-src` node | **51** |
| Apply to one `domain` | 44 · `hostname` 37 · `url` 34 · `md5` 28 |
| Apply to one `AS` | 2 |
| Modules wanting an API key | 86 of 118 |
| No-key modules returning real data | 19 of 32 |

The distribution is the important part: the panel has to work at 51 entries and
at 2, and the same seed produces both.

## What breaks down

### 1. The list has no search

With 51 entries there is no way to reach a named provider except by scrolling.
`PivotPanel` has no filter input — the only `input` listener in the file is on
the narrowing form. The triage pane has a row search; the provider list, which is
an order of magnitude longer, has none.

This is the single biggest win available. A one-line filter over label and id
would make 51 entries as usable as 6.

### 2. One expanded facet buries every other provider

The meta-pivot's "Modules to query" facet is a `multiselect`, which
`facetToField` renders as `checkboxes` — an unbounded list, by deliberate design:
its options *are* the breakdown the summary reported, so a picker would hide the
counts. That reasoning holds at four options. At fifty:

- first entry height: **1061px**
- median height of the other 50: **43px**
- the second entry starts **1069px** down, in a **376px** viewport
- whole list: **3611px**

So opening the first entry pushes provider #2 nearly three screens below the
fold. `.pvt-pivot-scroll` scrolls, but nothing caps the facet itself.

A `max-height` with its own scroll on the checkbox list — the treatment
`.pvt-triage-suppressed` already gets at 140px — fixes this without giving up the
inline counts.

### 3. Nothing separates a provider that cannot work from one that can

86 of the 118 modules need an API key this instance does not have. They render
identically to the 32 that do not, and the only way to find out is to run one and
read the error.

`appliesTo` cannot express this: returning `false` removes the entry entirely,
which is wrong — the pivot *does* apply, it is just not configured. There is no
third state between "in the list, looks ready" and "absent".

Worth considering: an optional `PivotDefinition.availability?: (nodes) => { ready: boolean, reason?: string }`,
read alongside `appliesTo`, rendering the entry present but disabled with the
reason on it. It would also cover rate-limited and quota-exhausted providers,
which a real deployment hits constantly.

### 4. With no counts, the panel degrades to a button list

misp-modules has no "how much is out there" endpoint — the only question it
answers is the expensive one. So the per-module pivots declare no `summarize`,
and with it go the advertised total, the narrowing facets and the cap. 118 of 119
entries are bare Runs.

That is the contract working as documented, not a bug. But it means the panel's
most informative affordances are dead for essentially every entry, and a backend
like this is the common case, not the exotic one. A denser row for the
no-summarize case — no reserved space for a count that will never arrive — would
buy back a lot of the 3611px.

### 5. A 58-child container is one undifferentiated triage row

`cve` on CVE-2021-44228 returns one MISP object carrying **58 attributes**. It
stages as a single row labelled `vulnerability`. `TriagePane` never reads
`raw.children`, so the analyst cannot see, count, or pick among what is inside
before ingesting it. MISP objects are routinely this size.

A child count in the row, and ideally an expandable row, would make the decision
an informed one. (The page's `Objects: flattened` knob shows the alternative:
58 separate rows, which is worse in a different way.)

### 6. A pivot applies to the whole origin or not at all

`appliesTo` gets the origin as a set and answers once. So a selection mixing a
domain and an IP only offers providers accepting *both* types, and the count
silently collapses. There is no way to say "this applies to 3 of your 5 selected
nodes" — which for enrichment is the normal situation.

### 7. Rim badges have no notion of "how many enrichments apply"

`setPotential` is keyed per pivot. With 118 of them there is no sensible
per-provider badge, so the page hangs the count off the meta-pivot instead. The
number an analyst actually wants on the rim — how many enrichments this node
could take — has no first-class expression.

### 8. One dock tab per run

Each staged set opens its own tab. Two runs gave `CVE Lookup` and `DNS Resolver`;
at 51 available providers the strip is a queue waiting to happen.

## Five ways out

[`pivot-panel-designs.html`](pivot-panel-designs.html) is a design bench: five
interactive panels at real size, running on the real 118-module catalogue, each
reporting its own list height as you use it. Open it alongside this document.

| | | Answers |
| --- | --- | --- |
| **A** | Search first | a filter box pinned above the list, keyboard to run | #1 |
| **B** | One line each | 28px rows instead of 43px cards: 2192px → 1400px | #4 |
| **C** | Ready, then the rest | keyless providers at full size, the other 47 folded away | #3 |
| **D** | Pick, then run | the list *is* the selection, which retires the 1061px facet | #2 |
| **E** | Off the panel | origin and recents stay; the catalogue moves to a palette | #1, #4 |

They compose. A is the floor and costs least; C stacks on any of the others and is
the only one needing a contract change.

**Grouping was tried and the data killed it.** Group the 50 IP providers by the
attribute types they accept and 46 land in one bucket; by the verb in their name
and 32 are `Lookup`; by what they return and 50 of the 118 declare nothing at all.
Fifty ways to look an address up do not sort into six drawers, so none of the five
tries.

## Cheapest first

1. Filter box on the provider list (#1) — design **A**.
2. `max-height` + scroll on the checkbox facet (#2), or retire it with **D**.
3. Child count on container triage rows (#5).
4. Availability state on `PivotDefinition` (#3) — design **C**, the only one
   needing a contract change.
