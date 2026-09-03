import { SEED_SOURCE, type SourceRecord } from './interfaces/Pivot'

/**
 * Which sources vouch for one element, and under which run. Stored on the node or
 * edge itself and mutated only through the helpers below.
 *
 * The set is what matters: a node can arrive from one pivot, then another, and
 * have been in the seed data all along. Removal is one uniform rule — drop the
 * vouching, delete the element only if nothing vouches for it any more.
 *
 * @private
 */
export type SourceLedger = Map<string, SourceRecord[]>

/**
 * The sources vouching for an element. An empty ledger means the element came
 * from the seed data, so that is what it reports — the seed is a source like any
 * other, which is what makes removal uniform.
 *
 * @private
 */
export function ledgerSources(ledger: SourceLedger | undefined): string[] {
    if (!ledger || ledger.size === 0) return [SEED_SOURCE]
    return [...ledger.keys()]
}

/**
 * A copy nothing shares with the element, so a history preview can play a span
 * against it without the canvas noticing.
 *
 * @private
 */
export function ledgerClone(ledger: SourceLedger | undefined): SourceLedger {
    if (!ledger) return new Map()
    return new Map([...ledger].map(([source, records]) => [source, [...records]]))
}

/** @private */
export function ledgerHasSource(ledger: SourceLedger | undefined, source: string): boolean {
    if (!ledger || ledger.size === 0) return source === SEED_SOURCE
    return ledger.has(source)
}

/**
 * Record that `source` vouches for this element under `runId`. Two runs of the
 * same pivot each leave their own record, so undoing one leaves the other's
 * vouching standing.
 *
 * @private
 */
export function ledgerVouch(ledger: SourceLedger, source: string, runId: string, at = Date.now()): void {
    const records = ledger.get(source)
    if (records) {
        if (!records.some(r => r.runId === runId)) records.push({ runId, at })
        return
    }
    ledger.set(source, [{ runId, at }])
}

/**
 * Drop one run's vouching. Returns `true` when nothing vouches for the element
 * any more, which is the caller's cue to delete it.
 *
 * @private
 */
export function ledgerRevokeRun(ledger: SourceLedger | undefined, source: string, runId: string): boolean {
    if (!ledger) return false
    const records = ledger.get(source)
    if (records) {
        const kept = records.filter(r => r.runId !== runId)
        if (kept.length) ledger.set(source, kept)
        else ledger.delete(source)
    }
    return ledger.size === 0
}

/**
 * Drop a source's vouching entirely, whatever runs it holds. Returns `true` when
 * nothing vouches for the element any more.
 *
 * @private
 */
export function ledgerDropSource(ledger: SourceLedger | undefined, source: string): boolean {
    // No ledger means the seed is the only claim, so dropping the seed's leaves nothing.
    if (!ledger) return source === SEED_SOURCE
    ledger.delete(source)
    return ledger.size === 0
}
