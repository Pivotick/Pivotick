import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import { show, snapGrid, grid, hide, pin, graphNavigationReset } from '../../icons'
import { i18nAttr, i18nText } from '../../../i18n/dom'
import type { MessageKey } from '../../../interfaces/I18n'
import './viewflyout.scss'

/** The canvas background patterns, in the order the button group offers them. */
const BG_MODES: Array<{ id: string, label: MessageKey, desc: MessageKey }> = [
    { id: 'grid', label: 'viewFlyout.background.grid', desc: 'viewFlyout.background.grid.title' },
    { id: 'dots', label: 'viewFlyout.background.dots', desc: 'viewFlyout.background.dots.title' },
    { id: 'none', label: 'viewFlyout.background.none', desc: 'viewFlyout.background.none.title' },
    { id: 'image', label: 'viewFlyout.background.image', desc: 'viewFlyout.background.image.title' },
]

/** The patterns that have a grid colour to pick and can be highlighted. */
const PATTERNED_MODES = ['grid', 'dots']

/**
 * How a background image sits on the canvas. The first entry is the default,
 * and `id` doubles as the `background-size` the two scaling fits want.
 */
const FIT_MODES: Array<{ id: string, label: MessageKey, desc: MessageKey }> = [
    { id: 'cover', label: 'viewFlyout.image.fit.cover', desc: 'viewFlyout.image.fit.cover.title' },
    { id: 'contain', label: 'viewFlyout.image.fit.contain', desc: 'viewFlyout.image.fit.contain.title' },
    { id: 'repeat', label: 'viewFlyout.image.fit.tile', desc: 'viewFlyout.image.fit.tile.title' },
]

/**
 * The swatch row offered for both the canvas and the grid colour. The empty
 * `color` is the reset swatch: it drops the override and hands the colour back
 * to the theme. Neutrals only — the theme's own accent is where the custom
 * picker beside them starts, so it costs the row no slot.
 */
const COLOR_SWATCHES: Array<{ color: string, title: MessageKey, cls?: string }> = [
    { color: '', title: 'viewFlyout.colour.default', cls: 'swatch-default' },
    { color: '#ffffff', title: 'viewFlyout.colour.white' },
    { color: '#d4d4d4', title: 'viewFlyout.colour.lightGrey' },
    { color: '#525252', title: 'viewFlyout.colour.darkGrey' },
    { color: '#171717', title: 'viewFlyout.colour.black' },
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
        const t = (key: MessageKey) => this.i18n.t(key)
        const modes = BG_MODES.map(m =>
            `<button type="button" class="pvt-flyout-btn-group-btn" data-bg="${m.id}"
                aria-pressed="${m.id === 'grid'}" ${i18nAttr('title', m.desc)} ${i18nText(m.label)}></button>`
        ).join('')
        const swatches = COLOR_SWATCHES.map(s =>
            `<button type="button" class="pvt-viewflyout-swatch ${s.cls ?? ''}" data-color="${s.color}"
                ${i18nAttr('title', s.title)} style="${s.color ? `--swatch: ${s.color}` : ''}"></button>`
        ).join('')
        const fits = FIT_MODES.map((f, i) =>
            `<button type="button" class="pvt-flyout-btn-group-btn" data-fit="${f.id}"
                aria-pressed="${i === 0}" ${i18nAttr('title', f.desc)} ${i18nText(f.label)}></button>`
        ).join('')

        return this.headerRow(show, t('viewFlyout.title'))
            + this.sectionLabel(t('viewFlyout.section'))
            + `
            <div class="pvt-flyout-card">
                <div class="pvt-flyout-card-head">
                    <span class="pvt-flyout-card-title" ${i18nText('viewFlyout.background')}></span>
                </div>
                <div class="pvt-flyout-btn-group">${modes}</div>
                <div class="pvt-viewflyout-swatch-label" ${i18nText('viewFlyout.canvasColour')}></div>
                <div class="pvt-viewflyout-swatches" data-swatches="canvas">${swatches}
                    <input type="color" class="pvt-viewflyout-color-picker" ${i18nAttr('title', 'viewFlyout.canvasColour.custom.title')}>
                </div>
                <div class="pvt-viewflyout-swatch-label" data-pattern-only ${i18nText('viewFlyout.gridColour')}></div>
                <div class="pvt-viewflyout-swatches" data-swatches="grid" data-pattern-only>${swatches}
                    <input type="color" class="pvt-viewflyout-color-picker" ${i18nAttr('title', 'viewFlyout.gridColour.custom.title')}>
                </div>
                <div class="pvt-viewflyout-bg-toggles" data-pattern-only>
                    ${this.toggleRow('highlight', grid, t('viewFlyout.highlightGrid'), t('viewFlyout.highlightGrid.title'))}
                </div>
                <div class="pvt-viewflyout-bg-image" hidden>
                    <div class="pvt-viewflyout-bg-image-row">
                        <input type="text" class="pvt-viewflyout-bg-image-url" ${i18nAttr('placeholder', 'viewFlyout.image.url.placeholder')}>
                        <button type="button" class="pvt-viewflyout-bg-image-pick"
                            ${i18nAttr('title', 'viewFlyout.image.browse.title')} ${i18nText('viewFlyout.image.browse')}></button>
                        <input type="file" class="pvt-viewflyout-bg-image-file" accept="image/*" hidden>
                    </div>
                    <div class="pvt-flyout-btn-group">${fits}</div>
                    <button type="button" class="pvt-viewflyout-bg-image-clear" ${i18nText('viewFlyout.image.remove')}></button>
                </div>
            </div>`
            + this.toggleRow('snap', snapGrid, t('viewFlyout.snap'), t('viewFlyout.snap.title'))
            + this.toggleRow('freeze', pin, t('viewFlyout.freeze'), t('viewFlyout.freeze.title'))
            + this.toggleRow('fit', graphNavigationReset, t('viewFlyout.fit'), t('viewFlyout.fit.title'))
            + this.toggleRow('orphans', hide, t('viewFlyout.orphans'), t('viewFlyout.orphans.title'))
    }

    protected onGraphReady() {
        super.onGraphReady()
        // A graph that declared the rule hid its orphans before anything was drawn, so no
        // filter change ever announced them — the row has to read the count itself.
        this.syncOrphanNote()
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
        this.wireOrphans()
        this.wireBackground()
    }

    /**
     * The unconnected-nodes switch, which drives the query engine's own rule
     * (`UI.filter.hideDisconnected`). Its note follows every filter change, not just its
     * own clicks: switching a relationship layer off strands more nodes.
     */
    private wireOrphans() {
        const engine = this.uiManager.graph.queryEngine
        const sync = () => this.syncOrphanNote()
        this.wireToggle('orphans',
            () => engine.setHideDisconnected(!engine.isHideDisconnected()),
            () => engine.isHideDisconnected())
        engine.on('filterChange', sync)
        this.track(() => engine.off('filterChange', sync))
    }

    /**
     * How many nodes the switch is hiding, on the row itself. Blank while it hides none.
     * The bare count is what fits: the row has 238px, and the label plus "1 hidden" needs
     * 253 — so the words go in the note's own tooltip, and the number reads like the
     * filter panel's layer counts.
     */
    private syncOrphanNote() {
        const hidden = this.uiManager.graph.queryEngine.getDisconnectedNodeCount()
        if (hidden === 0) return this.toggleNote('orphans', '')
        this.toggleNote('orphans', this.i18n.formatNumber(hidden), this.i18n.t('viewFlyout.orphans.note.title', { count: hidden }))
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
