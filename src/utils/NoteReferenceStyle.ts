/**
 * Applies the per-element CSS custom properties that color a `.pvt-node-reference`
 * element to match its referenced node. Shared by the note-to-node link
 * (NoteDrawer) and inline markdown node references so both render identically.
 */
export function applyNodeReferenceColor(ref: HTMLElement, color: string | undefined): void {
    if (!color) return
    ref.style.setProperty('--pvt-note-node-reference-dot', color)
    ref.style.setProperty('--pvt-note-node-reference-bg', `color-mix(in oklab, ${color} 30%, white)`)
    ref.style.setProperty('border-color', `color-mix(in srgb, ${color} 45%, transparent)`)
}
