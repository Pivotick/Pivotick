# Design mockups — B3 control layout (vendored, temporary)

Reference copies of the Claude Design mockups behind
[`../graph-app-b3-control-layout.md`](../graph-app-b3-control-layout.md).

**⚠️ Remove this folder before merging the branch.** These are throwaway design
references, not source. They are checked in only so a handoff session has the
mockups without needing Claude Design MCP access.

## Files
- **`Graph App - B3.dc.html`** — the target: the fully-realized B3 screen (mode rail + contextual panels + selection sidebar + top bar + viewport rail). Authoritative for the PRD's M1 spec.
- **`Graph Controls - Rail Options.dc.html`** — the B1/B2/B3 exploration (why B3 was chosen "most scalable"). B3 here uses a physics *flyout* variant; the standalone `Graph App - B3` inlines physics instead.
- **`PhysicsPanel.dc.html`** — the reusable physics child component (presets + 4 sliders + play/pause).

## Provenance
- Claude Design project **"Graph application controls layout"** — id `ab310b4e-b570-47af-9cbc-c6a8aba7716b`.
- Not vendored: `Graph Controls.dc.html` (the A–D families overview) and `support.js` (the Claude Design render harness these files reference via `<script src="./support.js">`). Without `support.js` the `{{ … }}` bindings and `<x-dc>` shell won't render locally — read them as source, or re-open the originals in the design project. Re-fetch any file via the design MCP (`get_file`) against the project id above.
- The mockups use Phosphor icon classes (`ph …`) and a CDN font purely for the mock; per the PRD (D8) the implementation uses Pivotick's inline-SVG `icons.ts` instead.
