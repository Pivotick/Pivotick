import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import { show, snapGrid, grid, pin, graphNavigationReset } from '../../icons'
import './viewflyout.scss'

/** The canvas background patterns, in the order the button group offers them. */
const BG_MODES: Array<{ id: string, label: string, desc: string }> = [
    { id: 'grid', label: 'Grid', desc: 'Rule the canvas with grid lines.' },
    { id: 'dots', label: 'Dots', desc: 'Mark the grid with dots instead of lines.' },
    { id: 'none', label: 'None', desc: 'Leave the canvas plain.' },
    { id: 'image', label: 'Image', desc: 'Paint an image behind the graph.' },
]

/** The patterns that have a grid colour to pick and can be highlighted. */
const PATTERNED_MODES = ['grid', 'dots']

/**
 * How a background image sits on the canvas. The first entry is the default,
 * and `id` doubles as the `background-size` the two scaling fits want.
 */
const FIT_MODES: Array<{ id: string, label: string, desc: string }> = [
    { id: 'cover', label: 'Cover', desc: 'Scale the image to fill the canvas, cropping whatever overflows.' },
    { id: 'contain', label: 'Contain', desc: 'Scale the image until all of it fits on the canvas.' },
    { id: 'repeat', label: 'Tile', desc: 'Keep the image at its own size and repeat it across the canvas.' },
]

/**
 * The swatch row offered for both the canvas and the grid colour. The empty
 * `color` is the reset swatch: it drops the override and hands the colour back
 * to the theme. Neutrals only — the theme's own accent is where the custom
 * picker beside them starts, so it costs the row no slot.
 */
const COLOR_SWATCHES: Array<{ color: string, title: string, cls?: string }> = [
    { color: '', title: 'Theme default', cls: 'swatch-default' },
    { color: '#ffffff', title: 'White' },
    { color: '#d4d4d4', title: 'Light grey' },
    { color: '#525252', title: 'Dark grey' },
    { color: '#171717', title: 'Black' },
]

/** A colour input takes a plain hex and nothing else. */
const HEX = /^#[0-9a-f]{6}$/i

/**
 * The View flyout: the canvas background card and the canvas-behaviour
 * switches, opened by the mode rail's View button (via
 * {@link UIManager.modeStore}). Layout and physics used to live here too — they
 * now have their own rail mode, see {@link PhysicsFlyout}.
 *
 * The switches drive pre-existing {@link Simulation} / renderer state; the
 * background controls write pattern classes and CSS custom properties onto the
 * canvas element, which `styles/_pivotick.scss` paints. The {@link Flyout} base
 * owns the panel chrome and the open/closed binding.
 */
export class ViewFlyout extends Flyout {
    protected readonly mode: FlyoutMode = 'view'

    protected template(): string {
        const modes = BG_MODES.map(m =>
            `<button type="button" class="pvt-flyout-btn-group-btn" data-bg="${m.id}"
                aria-pressed="${m.id === 'grid'}" title="${m.desc}">${m.label}</button>`
        ).join('')
        const swatches = COLOR_SWATCHES.map(s =>
            `<button type="button" class="pvt-viewflyout-swatch ${s.cls ?? ''}" data-color="${s.color}"
                title="${s.title}" style="${s.color ? `--swatch: ${s.color}` : ''}"></button>`
        ).join('')
        const fits = FIT_MODES.map((f, i) =>
            `<button type="button" class="pvt-flyout-btn-group-btn" data-fit="${f.id}"
                aria-pressed="${i === 0}" title="${f.desc}">${f.label}</button>`
        ).join('')

        return this.headerRow(show, 'View')
            + this.sectionLabel('GRID &amp; CANVAS')
            + `
            <div class="pvt-flyout-card">
                <div class="pvt-flyout-card-head">
                    <span class="pvt-flyout-card-title">Background</span>
                </div>
                <div class="pvt-flyout-btn-group">${modes}</div>
                <div class="pvt-viewflyout-swatch-label">Canvas colour</div>
                <div class="pvt-viewflyout-swatches" data-swatches="canvas">${swatches}
                    <input type="color" class="pvt-viewflyout-color-picker" title="Custom canvas colour">
                </div>
                <div class="pvt-viewflyout-swatch-label" data-pattern-only>Grid colour</div>
                <div class="pvt-viewflyout-swatches" data-swatches="grid" data-pattern-only>${swatches}
                    <input type="color" class="pvt-viewflyout-color-picker" title="Custom grid colour">
                </div>
                <div class="pvt-viewflyout-bg-toggles" data-pattern-only>
                    ${this.toggleRow('highlight', grid, 'Highlight grid', 'Make the background grid lines more visible.')}
                </div>
                <div class="pvt-viewflyout-bg-image" hidden>
                    <div class="pvt-viewflyout-bg-image-row">
                        <input type="text" class="pvt-viewflyout-bg-image-url" placeholder="Image URL...">
                        <button type="button" class="pvt-viewflyout-bg-image-pick"
                            title="Pick an image file from this device.">Browse</button>
                        <input type="file" class="pvt-viewflyout-bg-image-file" accept="image/*" hidden>
                    </div>
                    <div class="pvt-flyout-btn-group">${fits}</div>
                    <button type="button" class="pvt-viewflyout-bg-image-clear">Remove image</button>
                </div>
            </div>`
            + this.toggleRow('snap', snapGrid, 'Snap to grid', 'Align nodes to the grid while you drag them.')
            + this.toggleRow('freeze', pin, 'Freeze on drag', 'Keep nodes pinned where you drop them instead of letting physics move them again.')
            + this.toggleRow('fit', graphNavigationReset, 'Fit on expand/collapse', 'Zoom and re-center to fit the graph when clusters are expanded or collapsed.')
    }

    protected wire() {
        // Highlight the grid on the layout root so the canvas AND the transparent
        // top-bar strip (which continues the grid) brighten together.
        const root = this.uiManager.layout?.layout
        this.wireToggle('snap', () => this.sim.toggleGridSnapping(), () => this.sim.isGridSnappingEnabled())
        this.wireToggle('highlight',
            () => root?.classList.toggle('grid-highlighted'),
            () => root?.classList.contains('grid-highlighted') ?? false)
        this.wireToggle('freeze', () => this.sim.toggleFreezeNodesOnDrag(), () => this.sim.isFreezeNodesOnDrag())
        this.wireToggle('fit', () => this.sim.toggleFitViewOnExpandCollapse(), () => this.sim.isFitViewOnExpandCollapse())
        this.wireBackground()
    }

    /* ---------- background ---------- */

    private wireBackground() {
        const canvas = this.uiManager.layout?.canvas
        if (!canvas) return
        this.wireBackgroundMode(canvas)
        this.wireSwatches('canvas', canvas, '--pvt-bg')
        this.wireSwatches('grid', canvas, '--pvt-graph-grid-color')
        this.wireBackgroundImage(canvas)
    }

    /**
     * The pattern picker. The pattern is a class on the canvas — `grid` is the
     * stylesheet's default, so it is the absence of the other three. Which
     * controls the card shows follows from it: a grid colour and the highlight
     * only mean something under a pattern, the image inputs only under `image`.
     */
    private wireBackgroundMode(canvas: HTMLElement) {
        const buttons = this.queryAll<HTMLButtonElement>('.pvt-flyout-btn-group-btn[data-bg]')
        const patternOnly = this.queryAll('[data-pattern-only]')
        const image = this.query<HTMLElement>('.pvt-viewflyout-bg-image')

        const apply = (mode: string) => {
            canvas.classList.remove('pvt-bg-dots', 'pvt-bg-none', 'pvt-bg-image')
            if (mode !== 'grid') canvas.classList.add(`pvt-bg-${mode}`)
            for (const el of patternOnly) el.hidden = !PATTERNED_MODES.includes(mode)
            if (image) image.hidden = mode !== 'image'
        }

        for (const button of buttons) {
            this.listen(button, 'click', () => {
                for (const other of buttons) other.setAttribute('aria-pressed', String(other === button))
                apply(button.dataset.bg ?? 'grid')
            })
        }
    }

    /**
     * One swatch row plus its custom-colour input, both writing `property` on
     * the canvas. The reset swatch carries no colour: it removes the override
     * so the theme's own value shows through again.
     */
    private wireSwatches(row: string, canvas: HTMLElement, property: string) {
        const container = this.query<HTMLElement>(`.pvt-viewflyout-swatches[data-swatches="${row}"]`)
        if (!container) return
        const swatches = container.querySelectorAll<HTMLButtonElement>('.pvt-viewflyout-swatch')
        const highlight = (active: HTMLButtonElement | null) => {
            for (const swatch of swatches) swatch.classList.toggle('active', swatch === active)
        }

        for (const swatch of swatches) {
            this.listen(swatch, 'click', () => {
                highlight(swatch)
                const color = swatch.dataset.color
                if (color) canvas.style.setProperty(property, color)
                else canvas.style.removeProperty(property)
            })
        }

        const picker = container.querySelector<HTMLInputElement>('.pvt-viewflyout-color-picker')
        if (!picker) return
        // Open the picker on the theme's accent: the colour worth reaching for,
        // reachable without spending a swatch slot on it.
        const accent = this.themeAccent()
        if (accent) picker.value = accent
        this.listen(picker, 'input', () => {
            highlight(null)
            canvas.style.setProperty(property, picker.value)
        })
    }

    /**
     * `--pvt-theme-primary` as a hex, or `null` if the theme states it in a form
     * a colour input would refuse (a function, a named colour, an alpha).
     */
    private themeAccent(): string | null {
        if (!this.panel) return null
        const accent = getComputedStyle(this.panel).getPropertyValue('--pvt-theme-primary').trim()
        return HEX.test(accent) ? accent : null
    }

    /**
     * The image controls. A URL and a picked file are the same thing to the
     * canvas — a `url()` for `--pvt-bg-image-url` — so setting either clears
     * the other's input.
     */
    private wireBackgroundImage(canvas: HTMLElement) {
        const url = this.query<HTMLInputElement>('.pvt-viewflyout-bg-image-url')
        const file = this.query<HTMLInputElement>('.pvt-viewflyout-bg-image-file')
        const pick = this.query<HTMLButtonElement>('.pvt-viewflyout-bg-image-pick')
        const clear = this.query<HTMLButtonElement>('.pvt-viewflyout-bg-image-clear')
        const fits = this.queryAll<HTMLButtonElement>('.pvt-flyout-btn-group-btn[data-fit]')
        const highlightFit = (id: string) => {
            for (const button of fits) button.setAttribute('aria-pressed', String(button.dataset.fit === id))
        }

        if (url) {
            this.listen(url, 'input', () => {
                if (url.value) canvas.style.setProperty('--pvt-bg-image-url', `url("${url.value}")`)
                else canvas.style.removeProperty('--pvt-bg-image-url')
                if (file) file.value = ''
            })
        }

        // The native file input is kept off-screen and opened from a button, so
        // the row holds the chrome's own controls rather than the browser's.
        if (pick && file) this.listen(pick, 'click', () => file.click())

        if (file) {
            this.listen(file, 'change', () => {
                const picked = file.files?.[0]
                if (!picked) return
                const reader = new FileReader()
                reader.onload = () => {
                    canvas.style.setProperty('--pvt-bg-image-url', `url("${reader.result}")`)
                    if (url) url.value = ''
                }
                reader.readAsDataURL(picked)
            })
        }

        for (const button of fits) {
            this.listen(button, 'click', () => {
                const id = button.dataset.fit ?? FIT_MODES[0].id
                highlightFit(id)
                // Tiling is a size *and* a repeat; the scaling fits are a size alone.
                const tile = id === 'repeat'
                canvas.style.setProperty('--pvt-bg-image-size', tile ? 'auto' : id)
                canvas.style.setProperty('--pvt-bg-image-repeat', tile ? 'repeat' : 'no-repeat')
            })
        }

        if (clear) {
            this.listen(clear, 'click', () => {
                for (const property of ['--pvt-bg-image-url', '--pvt-bg-image-size', '--pvt-bg-image-repeat']) {
                    canvas.style.removeProperty(property)
                }
                // Cleared is the default state, so the fit group has to say so.
                highlightFit(FIT_MODES[0].id)
                if (url) url.value = ''
                if (file) file.value = ''
            })
        }
    }
}
