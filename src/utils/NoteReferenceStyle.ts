import { isSafeColor } from './colorSafety'

/**
 * Applies the per-element CSS custom properties that color a `.pvt-node-reference`
 * element to match its referenced node. Shared by the note-to-node link
 * (NoteDrawer) and inline markdown node references so both render identically.
 *
 * The colour comes from the node's `style` bag, so it is checked first: the stylesheet drops
 * `--pvt-note-node-reference-dot` into a `background`, where a non-colour would render as an
 * outbound request. A rejected colour leaves the element on its stylesheet defaults.
 */
export function applyNodeReferenceColor(ref: HTMLElement, color: string | undefined): void {
    if (!color || !isSafeColor(color)) return
    ref.style.setProperty('--pvt-note-node-reference-dot', color)
    ref.style.setProperty(
        '--pvt-note-node-reference-bg',
        'color-mix(in oklab, var(--pvt-note-node-reference-dot) 30%, white)',
    )
    ref.style.setProperty(
        'border-color',
        'color-mix(in srgb, var(--pvt-note-node-reference-dot) 45%, transparent)',
    )
}
