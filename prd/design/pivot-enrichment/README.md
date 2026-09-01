# Phase A artboards — pivot/enrichment UI

Source for the design canvas published from
[`../../pivot-enrichment-ui-prototype-brief.md`](../../pivot-enrichment-ui-prototype-brief.md)
Phase A. Every `.dc.html` is one artboard; `canvas.json` places them on two pages.

Published canvas: <https://claude.ai/code/artifact/5cb54730-fbfd-4e14-8f35-b9a9cb8e8be4>

| Artboard | Shows |
|---|---|
| `Main` | the recommendation and the three variants side by side |
| `EntryStates` | S1–S10 of one pivot entry, plus the five narrowing controls |
| `VariantA/B/C` | each placement in the full 1600×950 chrome |
| `Triage` | the candidate pane: header line, row lifecycle, edge-only section |
| `TriageStates` | fetching, failed, ceiling refusal, all-deduped, zero, finished |
| `Concurrency` | two panes coexisting, and a replacing re-run |
| `Toast` | ingest / undo / redo, and the `Notifier` extension this needs |
| `Badges` | declared potential on the rim, including the container case |
| `OriginLess` | the entry point for pivots that need no selection |
| `Themes` | the same surfaces in light and dark |

## Re-seeding after an edit

Edit the `.dc.html` files (never the seeded output), then re-run the `design` skill's helper
from this directory with every artboard and `canvas.json`, and republish to the same URL. The
seeded `pivot-enrichment-ui.html` is gitignored: it is 2.6 MB of editor payload, rebuilt from
these sources.

## Where the numbers come from

Colours, type sizes, control heights and radii were read off the running dev server rather than
guessed — see [`../../pivot-enrichment-ui-groundwork.md`](../../pivot-enrichment-ui-groundwork.md).
States and copy are fixed in
[`../../pivot-enrichment-ui-states.md`](../../pivot-enrichment-ui-states.md); the artboards vary
placement only.
