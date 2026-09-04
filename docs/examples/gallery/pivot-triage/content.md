---
title: "Reject & retry"
category: M
order: 2
aside: false
pageClass: gallery-wide
---

# Reject & retry

What happens after the fetch. A triage count moves for three different reasons, and a
provider that fails is a state you can recover from rather than a dead end.

Press `P`, click `mail.example`, then fetch **Correlations**.

- **Reject five rows, then Re-run.** The header reads `40 fetched · 5 rejected earlier`.
  Rejections are remembered for the session and keyed per pivot, so rows you have ruled on
  stop coming back. Click the segment to reveal and restore them.
- **Ingest three and re-run again.** Now it reads
  `40 fetched · 3 already on canvas (skipped) · 5 rejected earlier`. Three reasons, one line.
- **Closing a provider rejects nothing.** Its row in the **Review** tab carries the ×. Only
  *Reject selected* and *Reject all remaining* are decisions; anything you never ruled on is
  offered again.
- **A failed summary** costs one entry, not the panel: *Reputation lookup* shows
  `Couldn't reach the source.` with a **Retry**.
- **A failed fetch** surfaces in the pane: *Enrich from feed* opens with
  `Couldn't fetch candidates.` and stages nothing at all.

Both providers recover on their first **Retry**. Throwing is the whole error protocol.

<script setup>
import { data, options } from './options.js'
</script>

<Pivotick :data="data" :options="options" useInlineStyle="margin: 1em 0; height: 860px; border: 1px solid #cccccc99; border-radius: 8px"></Pivotick>

::: code-group
<<< ./options.js#options [Options]
<<< ./options.js#data [Data]
:::

Full reference: [Pivots & enrichment](/pivots).
