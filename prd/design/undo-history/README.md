# Four designs for the undo/redo history dropdown

Built 2026-09-03 against [`../../undo-history.md`](../../undo-history.md). The PRD is the
authority on behaviour; these four differ only in how the menu presents it. Each is one
self-contained page — no network, no build step, open it by double-click.

Every variant honours the same hard rules: contiguous undo only (H8), a sealed entry inside a
span is skipped and the hover says so before the click (H12), both directions have their own
list and Redo empties on any new action (H13), each row carries a kind icon (H14), two runs of
one pivot are tellable apart (H15), hovering a row highlights its elements on the mock canvas
(H16), and the list survives 30 entries (H17).

| File | Direction | In one line |
|---|---|---|
| [`variant-a-faithful.html`](variant-a-faithful.html) | **A · Faithful** | Maltego and Office, done precisely and nothing more. |
| [`variant-b-time-travel.html`](variant-b-time-travel.html) | **B · Time travel** | One timeline through both stacks, with a *now* line you drag. |
| [`variant-c-consequence.html`](variant-c-consequence.html) | **C · Consequence forward** | A footer that states the exact blast radius before you commit. |
| [`variant-d-grouped.html`](variant-d-grouped.html) | **D · Grouped for density** | 30 entries in 9 rows, grouped by where the analyst stopped working. |
| [`variant-b2-newest-first.html`](variant-b2-newest-first.html) | **B2 · Time travel, reversed** | B with newest at the top, and a ruler in the gutter. |

**B is the chosen direction** (2026-09-03). B2 is the same design with the list reversed; which
of the two ships is the one open question, and it is an ordering rather than a direction.

## What each one bet on

**A — Faithful.** A true split button: the icon half steps once, a 16px caret opens a 288px
single-line menu. Hovering paints an unbroken left rail down the span and dissolves the dividers
inside it, so the block reads as one thing. Its best move is the sealed row — instead of greying
it, the tint and the rail are *withheld* there and the rail crosses as a dashed thread, so the
skip is visible before the footer explains it. Times are absolute `HH:MM`, on the argument that
the colon aligns down thirty rows and never goes stale.
*Weakest:* only 11 of 30 rows fit, so at the cap it is a scroll-and-hunt list with no landmarks.

**B — Time travel.** One list from either button, running chronologically with the oldest at the
top and a *now* line through it: done above, undone below. Clicking drags the line past the row
you pointed at, which works identically in both directions. Direction is carried by an arrow
gutter and by ink — an undo span drains to grey and takes a strike, a redo span fills back in —
rather than by a second accent, since the four kind colours already spend most of the palette. A
sealed row below the line keeps full ink: it is undone by position but applied in fact, and
greying it would be a lie.
*Weakest:* aiming deep at 30 rows selects 21 entries and floods the visible list, and the
now-line — the whole point — is off-screen at that moment.

**C — Consequence forward.** Rows plus a fixed three-line footer stating what the hovered span
will actually do: how many nodes and edges leave, how many hidden ones return, how many sealed
items stay. Every number is simulated against a copy of the state and diffed — the same function
the click commits — so the footer and the canvas cannot drift apart, and awkward cases come out
right for free: a hide cancelled by a later unhide nets to zero and the row honestly says
nothing changes. No danger tokens anywhere; the remove mark is the app's own selection
amaranth, so it reads as *marked* rather than as *warning*. Idle is not empty — it describes
undoing the top step, which is literally what the button does.
*Weakest:* 446px of menu hanging off a 28px button, with reserved whitespace that reads as slack
when the answer is short.

**D — Grouped for density.** Opens at the full 30 entries in five groups, newest expanded and
the rest collapsed: 9 rows, no scrollbar. Groups break on an **idle gap** — more than 8 minutes,
or 8 entries — rather than on clock buckets, because fixed buckets cut through the middle of a
sweep while idle gaps cut where the analyst stopped. Derived group titles ("AIL sweep",
"Cleanup") were built and thrown away: three of five came out "Mixed work". The contiguous rule
is drawn rather than stated — one unbroken rail from the top of the list to the cursor, past
collapsed headers and through sealed rows, ending in a dashed cut labelled `↑ reversed · ↓
kept`. Hovering the disclosure chevron *cancels* the span preview, so "I only meant to expand
this" never flashes a 20-action undo at you.
*Weakest:* the collapsed summary line is at capacity at 360px — one more kind or a longer
provider name wraps it.

**B2 — Time travel, reversed.** Newest at the top, so the redo stack sits *above* the now-line
and the undo stack below it: clicking below the line undoes, and travelling back means dragging
the line down. Within the undo section a span is then "the pointed-at row and everything between
it and the line", which reading downward is literally Maltego's rule — B had to reinterpret it,
B2 satisfies it as written. Its own addition is the **ruler**: every row shows how many steps a
click on it travels, counted away from the line, and the armed row's number is the `M` in
`Undoes N of M`, so the list and the footer cannot disagree. Worth back-porting to B whichever
wins.
*What the reversal does and does not fix:* the 30-row flood is order-invariant — aiming 25 steps
deep paints 25 of 30 rows and pushes the line off-screen in both, measured off the DOM. What
changes is resting scroll: B2 needs none when the redo stack is empty (the common state) and
full scroll when it is deep; B is the exact mirror. B2 also survives a "scroll to top", which
restores its line and destroys B's.

## Judge them on

The three walkthroughs in §8 of the PRD, at 30 entries as well as at five, in both themes. The
question is not which looks best empty. It is which is still legible on the day the analyst
needs it, which is the day they have done thirty things and one of them was wrong.
