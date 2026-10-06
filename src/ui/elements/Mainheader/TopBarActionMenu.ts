import type { MenuActionItemOptions } from '../../../interfaces/GraphUI'
import type { UIElement } from '../../UIManager'
import { createActionList } from '../../../utils/ElementCreation'

/**
 * The rows behind a top-bar action's caret. Drawn as a context-menu panel, so the rows,
 * the chrome and the theme are the context menu's stylesheet, and parented to the
 * `.pivotick` root: the header clips its overflow, and the root is what stays on screen
 * in fullscreen.
 */
export class TopBarActionMenu {
    private panel?: HTMLDivElement
    private caret?: HTMLButtonElement
    private readonly root: HTMLElement
    private readonly thisContext: UIElement
    /** Called after a row's `onclick`, and again once a promise it returned settles. */
    private readonly onRowRun: () => void

    constructor(root: HTMLElement, thisContext: UIElement, onRowRun: () => void) {
        this.root = root
        this.thisContext = thisContext
        this.onRowRun = onRowRun
    }

    public isOpenFor(caret: HTMLButtonElement): boolean {
        return this.caret === caret
    }

    /** Open below `anchor`, the whole pill, so the panel lines up with it rather than the caret. */
    public open(caret: HTMLButtonElement, anchor: HTMLElement, rows: MenuActionItemOptions[]): void {
        this.close()
        const items = rows.map(row => this.wrapRow(row))
        if (!items.length) return

        const panel = document.createElement('div')
        panel.className = 'pvt-contextmenu pvt-contextmenu-flyout pvt-topbar-menu'
        panel.setAttribute('role', 'menu')
        const list = document.createElement('div')
        list.className = 'pvt-contextmenu-mainmenu'
        list.appendChild(createActionList(this.thisContext, items, null))
        // After the row's own handler, which is on the row and so runs first.
        list.addEventListener('click', event => {
            if ((event.target as Element | null)?.closest('.pvt-action-item')) this.close()
        })
        panel.appendChild(list)
        this.root.appendChild(panel)
        this.panel = panel
        this.caret = caret

        this.place(panel, anchor)
        panel.classList.add('shown')
        caret.setAttribute('aria-expanded', 'true')
        document.addEventListener('pointerdown', this.onOutsidePointerDown, true)
        document.addEventListener('keydown', this.onKeydown, true)
    }

    public close(): void {
        if (!this.panel) return
        this.panel.remove()
        this.caret?.setAttribute('aria-expanded', 'false')
        this.panel = undefined
        this.caret = undefined
        document.removeEventListener('pointerdown', this.onOutsidePointerDown, true)
        document.removeEventListener('keydown', this.onKeydown, true)
    }

    /** No submenu here: one level is all a strip action needs. */
    private wrapRow(row: MenuActionItemOptions): MenuActionItemOptions {
        const onclick = row.onclick
        if (!onclick) return { ...row, submenu: undefined }
        return {
            ...row,
            submenu: undefined,
            onclick: (event) => {
                const result: unknown = onclick.call(this.thisContext, event, null)
                this.onRowRun()
                if (result instanceof Promise) result.finally(() => this.onRowRun())
            },
        }
    }

    /** Below the pill, left edges together, pulled back in rather than off the viewport. */
    private place(panel: HTMLDivElement, anchor: HTMLElement): void {
        const anchorBox = anchor.getBoundingClientRect()
        const box = panel.getBoundingClientRect()
        const margin = 8
        let left = anchorBox.left
        if (left + box.width + margin > window.innerWidth) {
            left = Math.max(margin, anchorBox.right - box.width)
        }
        panel.style.left = `${left}px`
        panel.style.top = `${anchorBox.bottom + 6}px`
    }

    private readonly onOutsidePointerDown = (event: PointerEvent): void => {
        const target = event.target as globalThis.Node | null
        // The caret toggles itself; closing here first would reopen it on the click.
        if (target && (this.panel?.contains(target) || this.caret?.contains(target))) return
        this.close()
    }

    private readonly onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        event.preventDefault()
        const caret = this.caret
        this.close()
        caret?.focus()
    }
}
