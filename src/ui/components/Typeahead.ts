/** A single suggestion offered by a {@link Typeahead}. */
export interface TypeaheadItem {
    /** Text inserted in place of the active query when this item is chosen. */
    value: string
    /** Text shown in the suggestion row when no custom {@link TypeaheadConfig.renderItem} is given. */
    label: string
    /** Arbitrary payload carried through to {@link TypeaheadConfig.onSelect}. */
    data?: unknown
}

export interface TypeaheadConfig {
    /** Sequence that opens the typeahead, e.g. `'[['`. */
    trigger: string
    /** Sequence appended after the value on select, e.g. `']]'`. Skipped if already present after the caret. */
    closing?: string
    /** Minimum characters typed after the trigger before the source is queried. Defaults to `0`. */
    minQueryLength?: number
    /** Maximum rows shown at once. Defaults to `8`. */
    maxResults?: number
    /** Return the suggestions matching the current query (may be async). */
    source: (query: string) => TypeaheadItem[] | Promise<TypeaheadItem[]>
    /** Called after an item's text has been inserted into the field. */
    onSelect?: (item: TypeaheadItem) => void
    /** Build a custom suggestion row. Defaults to a plain text row of `item.label`. */
    renderItem?: (item: TypeaheadItem, query: string) => HTMLElement
}

type EditableField = HTMLTextAreaElement | HTMLInputElement

/**
 * A trigger-based inline autocomplete for a text field.
 *
 * Watches the field for a {@link TypeaheadConfig.trigger} sequence before the caret; while an
 * "active query" is present it queries {@link TypeaheadConfig.source} and shows a caret-anchored
 * floating list. Choosing a row replaces the query with the item's value (plus the optional
 * closing sequence). The list is keyboard-navigable (↑/↓/Enter/Tab/Esc).
 *
 * The dropdown is appended to `document.body` and positioned in screen pixels, so it works even
 * when the field lives inside a zoomed/transformed subtree (e.g. a note foreignObject) — the
 * current on-screen scale of the field is measured and applied to the caret offset.
 */
export class Typeahead {

    private field: EditableField
    private config: Required<Pick<TypeaheadConfig, 'trigger' | 'minQueryLength' | 'maxResults'>> & TypeaheadConfig

    private dropdown: HTMLDivElement
    private isOpen = false
    private items: TypeaheadItem[] = []
    private highlightedIndex = 0

    /** Index in the field value right after the trigger — the start of the replaceable query. */
    private queryStart = -1
    /** Guards async source results against a newer keystroke landing first. */
    private requestToken = 0

    constructor(field: EditableField, config: TypeaheadConfig) {
        this.field = field
        this.config = {
            minQueryLength: 0,
            maxResults: 8,
            ...config,
        }

        this.dropdown = document.createElement('div')
        this.dropdown.className = 'pvt-typeahead'
        // Keep focus in the field when a row is clicked (mousedown would blur it otherwise).
        this.dropdown.addEventListener('mousedown', (evt) => evt.preventDefault())

        this.field.addEventListener('input', this.onInput)
        this.field.addEventListener('blur', this.onBlur)
        this.field.addEventListener('scroll', this.reposition)
    }

    /** Tear down all listeners and remove the dropdown from the DOM. */
    public destroy(): void {
        this.close()
        this.field.removeEventListener('input', this.onInput)
        this.field.removeEventListener('blur', this.onBlur)
        this.field.removeEventListener('scroll', this.reposition)
    }

    // -------------------------------------------------------------------------
    // Trigger detection
    // -------------------------------------------------------------------------

    /**
     * Find the active query: the text between the last {@link TypeaheadConfig.trigger} before the
     * caret and the caret itself. Returns `null` when there is no open trigger (no trigger found,
     * or the run was already closed / spans a line break).
     */
    private findActiveQuery(): { start: number, query: string } | null {
        const caret = this.field.selectionStart ?? 0
        // Only a collapsed caret opens the typeahead — a selection means the user is not typing a name.
        if ((this.field.selectionEnd ?? 0) !== caret) return null

        const before = this.field.value.slice(0, caret)
        const idx = before.lastIndexOf(this.config.trigger)
        if (idx === -1) return null

        const query = before.slice(idx + this.config.trigger.length)
        // A query never crosses a line, re-opens the trigger, or already contains its closing run.
        if (query.includes('\n')) return null
        if (query.includes(this.config.trigger)) return null
        if (this.config.closing && query.includes(this.config.closing)) return null

        return { start: idx + this.config.trigger.length, query }
    }

    // -------------------------------------------------------------------------
    // Field events
    // -------------------------------------------------------------------------

    private onInput = (): void => {
        const active = this.findActiveQuery()
        if (!active || active.query.length < this.config.minQueryLength) {
            this.close()
            return
        }

        this.queryStart = active.start
        const token = ++this.requestToken

        Promise.resolve(this.config.source(active.query)).then((results) => {
            // A newer keystroke already fired, or the trigger closed while we awaited — drop this.
            if (token !== this.requestToken) return
            if (!this.findActiveQuery()) {
                this.close()
                return
            }

            this.items = results.slice(0, this.config.maxResults)
            if (this.items.length === 0) {
                this.close()
                return
            }

            this.highlightedIndex = 0
            this.renderItems(active.query)
            this.open()
        })
    }

    private onBlur = (): void => {
        // Row clicks preventDefault their mousedown, so a genuine blur means focus left the field.
        this.close()
    }

    private onKeyDown = (evt: KeyboardEvent): void => {
        if (!this.isOpen || document.activeElement !== this.field) return

        switch (evt.key) {
            case 'ArrowDown':
                evt.preventDefault()
                evt.stopPropagation()
                this.move(1)
                break
            case 'ArrowUp':
                evt.preventDefault()
                evt.stopPropagation()
                this.move(-1)
                break
            case 'Enter':
            case 'Tab':
                evt.preventDefault()
                evt.stopPropagation()
                this.select(this.highlightedIndex)
                break
            case 'Escape':
                // Swallow Escape so it closes the list rather than bubbling to host handlers
                // (e.g. a note editor that would cancel the whole edit).
                evt.preventDefault()
                evt.stopPropagation()
                this.close()
                break
        }
    }

    private onOutsidePointerDown = (evt: PointerEvent): void => {
        const target = evt.target as globalThis.Node
        if (!this.dropdown.contains(target) && target !== this.field) {
            this.close()
        }
    }

    // -------------------------------------------------------------------------
    // Selection
    // -------------------------------------------------------------------------

    private move(delta: number): void {
        const count = this.items.length
        this.highlightedIndex = (this.highlightedIndex + delta + count) % count
        this.updateHighlight()
    }

    private select(index: number): void {
        const item = this.items[index]
        if (!item) return

        const caret = this.field.selectionStart ?? 0
        const value = this.field.value
        const after = value.slice(caret)
        const { closing } = this.config

        // Re-use a closing run already sitting after the caret (re-editing `[[|]]`) instead of doubling it.
        let insertedTail = ''
        let skipExistingClosing = 0
        if (closing) {
            if (after.startsWith(closing)) {
                skipExistingClosing = closing.length
            } else {
                insertedTail = closing
            }
        }

        const insert = item.value + insertedTail
        const newValue = value.slice(0, this.queryStart) + insert + after
        const newCaret = this.queryStart + insert.length + skipExistingClosing

        this.field.value = newValue
        this.field.setSelectionRange(newCaret, newCaret)
        // Let host listeners (and this typeahead's own input handler) see the mutation.
        this.field.dispatchEvent(new Event('input', { bubbles: true }))

        this.config.onSelect?.(item)
        this.close()
        this.field.focus()
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------

    private renderItems(query: string): void {
        this.dropdown.replaceChildren()

        this.items.forEach((item, index) => {
            const row = document.createElement('div')
            row.className = 'pvt-typeahead__item'
            row.setAttribute('role', 'option')

            if (this.config.renderItem) {
                row.appendChild(this.config.renderItem(item, query))
            } else {
                row.textContent = item.label
            }

            row.addEventListener('mouseenter', () => {
                this.highlightedIndex = index
                this.updateHighlight()
            })
            row.addEventListener('click', () => this.select(index))

            this.dropdown.appendChild(row)
        })

        this.updateHighlight()
    }

    private updateHighlight(): void {
        const rows = this.dropdown.children
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const active = i === this.highlightedIndex
            row.classList.toggle('active', active)
            if (active) row.scrollIntoView({ block: 'nearest' })
        }
    }

    // -------------------------------------------------------------------------
    // Open / close / position
    // -------------------------------------------------------------------------

    private open(): void {
        if (!this.isOpen) {
            document.body.appendChild(this.dropdown)
            document.addEventListener('keydown', this.onKeyDown, true)
            document.addEventListener('pointerdown', this.onOutsidePointerDown, true)
            window.addEventListener('scroll', this.reposition, true)
            window.addEventListener('resize', this.reposition)
            this.isOpen = true
        }
        this.reposition()
    }

    private close(): void {
        if (!this.isOpen) return
        this.isOpen = false
        this.requestToken++

        this.dropdown.remove()
        document.removeEventListener('keydown', this.onKeyDown, true)
        document.removeEventListener('pointerdown', this.onOutsidePointerDown, true)
        window.removeEventListener('scroll', this.reposition, true)
        window.removeEventListener('resize', this.reposition)
    }

    /** Anchor the dropdown just under the caret, in screen space, flipping up near the viewport edge. */
    private reposition = (): void => {
        if (!this.isOpen) return

        const rect = this.field.getBoundingClientRect()
        // The field may be inside a zoomed/transformed subtree; map its own CSS px to screen px.
        const scaleX = this.field.offsetWidth ? rect.width / this.field.offsetWidth : 1
        const scaleY = this.field.offsetHeight ? rect.height / this.field.offsetHeight : 1

        const caret = getCaretCoordinates(this.field, this.field.selectionStart ?? 0)
        const caretLeft = rect.left + (caret.left - this.field.scrollLeft) * scaleX
        const caretTop = rect.top + (caret.top - this.field.scrollTop) * scaleY
        const caretBottom = caretTop + caret.height * scaleY

        this.dropdown.style.position = 'fixed'
        this.dropdown.style.left = '0'
        this.dropdown.style.top = '0'
        this.dropdown.style.visibility = 'hidden'
        this.dropdown.style.display = 'block'

        const menuWidth = this.dropdown.offsetWidth
        const menuHeight = this.dropdown.offsetHeight
        const spacing = 8

        let left = caretLeft
        if (left + menuWidth > window.innerWidth - spacing) {
            left = window.innerWidth - menuWidth - spacing
        }
        if (left < spacing) left = spacing

        // Prefer below the caret; flip above when it would overflow the viewport bottom.
        let top = caretBottom + 4
        if (top + menuHeight > window.innerHeight - spacing) {
            const above = caretTop - menuHeight - 4
            top = above >= spacing ? above : Math.max(spacing, window.innerHeight - menuHeight - spacing)
        }

        this.dropdown.style.left = `${left}px`
        this.dropdown.style.top = `${top}px`
        this.dropdown.style.visibility = ''
    }
}

// -----------------------------------------------------------------------------
// Caret coordinates
// -----------------------------------------------------------------------------

/** Style properties copied onto the mirror so its text wraps and measures exactly like the field. */
const MIRROR_PROPERTIES: string[] = [
    'boxSizing', 'width', 'height',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
    'lineHeight', 'fontFamily',
    'textAlign', 'textTransform', 'textIndent', 'textDecoration',
    'letterSpacing', 'wordSpacing', 'tabSize',
]

/**
 * Pixel offset of the caret (at `position` in the field's value) relative to the field's own
 * border box, in the field's *unscaled* CSS pixels. Uses the well-known hidden-mirror technique:
 * a div is styled to match the field, filled with the text up to the caret, and the offset of a
 * marker span appended at the caret is read back.
 */
function getCaretCoordinates(
    field: EditableField,
    position: number
): { top: number, left: number, height: number } {

    const isInput = field.nodeName === 'INPUT'
    const style = window.getComputedStyle(field)

    const mirror = document.createElement('div')
    mirror.className = 'pvt-typeahead-mirror'
    const ms = mirror.style
    ms.position = 'absolute'
    ms.visibility = 'hidden'
    ms.whiteSpace = isInput ? 'nowrap' : 'pre-wrap'
    ms.setProperty('word-wrap', isInput ? 'normal' : 'break-word')
    ms.overflow = 'hidden'

    // Cast to a plain string map: some copied keys (tabSize, fontStretch…) aren't on the typed surface.
    const msMap = ms as unknown as Record<string, string>
    const styleMap = style as unknown as Record<string, string>
    for (const prop of MIRROR_PROPERTIES) {
        msMap[prop] = styleMap[prop]
    }
    // A single-line input reports no useful height; let the mirror size to its content instead.
    if (isInput) ms.height = 'auto'

    document.body.appendChild(mirror)

    // `textContent` up to the caret positions the marker; a textarea keeps its trailing spaces via pre-wrap.
    mirror.textContent = field.value.slice(0, position)
    if (isInput) mirror.textContent = mirror.textContent.replace(/\s/g, ' ')

    const marker = document.createElement('span')
    // Non-empty content so the span has geometry even at the very end of the text.
    marker.textContent = field.value.slice(position) || '.'
    mirror.appendChild(marker)

    const top = marker.offsetTop + parseInt(style.borderTopWidth || '0', 10)
    const left = marker.offsetLeft + parseInt(style.borderLeftWidth || '0', 10)
    const height = parseInt(style.lineHeight || '0', 10) || marker.offsetHeight

    document.body.removeChild(mirror)

    return { top, left, height }
}
