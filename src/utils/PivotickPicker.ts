type Option = {
    value: string
    label: string
    disabled?: boolean
}

type PickerMode = 'single' | 'multi'

interface PickerOptions {
    mode?: PickerMode
    placeholder?: string
    searchable?: boolean
}

export class PivotickPicker {
    private root: HTMLElement
    private select: HTMLSelectElement
    private options: Option[] = []
    private selected: Set<string> = new Set()
    private mode: PickerMode
    private searchable: boolean

    private dropdown!: HTMLDivElement
    private input!: HTMLInputElement
    private chipsContainer!: HTMLDivElement
    private listContainer!: HTMLDivElement
    private clearButton!: HTMLButtonElement
    private singleCloseButton!: HTMLButtonElement
    private inputWrap!: HTMLDivElement
    private searchWrap!: HTMLDivElement
    private searchInput!: HTMLInputElement

    constructor(select: HTMLSelectElement, options: PickerOptions = {}) {
        this.select = select
        this.root = document.createElement('div')
        this.root.className = 'pvt-picker'

        this.mode = options.mode ?? (select.multiple ? 'multi' : 'single')
        this.searchable = options.searchable ?? true

        this.parseOptions()
        this.build()
        this.syncFromSelect()
        this.attach()
    }

    private parseOptions() {
        this.options = Array.from(this.select.options)
            .filter((o) => o.value) // skip placeholder/empty options
            .map((o) => ({
                value: o.value,
                label: o.text,
                disabled: o.disabled
            }))
    }

    private build() {
        this.select.style.display = 'none'
        this.select.parentElement?.insertBefore(this.root, this.select)

        // control bar
        const container = document.createElement('div')
        container.className = 'pvt-picker__control'

        // chips area
        this.chipsContainer = document.createElement('div')
        this.chipsContainer.className = 'pvt-picker__chips'

        // clear button
        this.clearButton = document.createElement('button')
        this.clearButton.className = 'pvt-picker__clear'
        this.clearButton.textContent = '×'
        this.clearButton.tabIndex = -1
        this.clearButton.style.display = 'none'

        // input wrapper (for positioning close button)
        this.inputWrap = document.createElement('div')
        this.inputWrap.className = 'pvt-picker__input-wrap'

        // input
        this.input = document.createElement('input')
        this.input.className = 'pvt-picker__input'
        this.input.placeholder = this.select.getAttribute('placeholder') || 'Select...'
        this.input.type = 'text'

        // single-select close button
        this.singleCloseButton = document.createElement('button')
        this.singleCloseButton.className = 'pvt-picker__single-close'
        this.singleCloseButton.textContent = '×'
        this.singleCloseButton.type = 'button'
        this.singleCloseButton.style.display = 'none'

        this.inputWrap.appendChild(this.input)
        this.inputWrap.appendChild(this.singleCloseButton)

        // dropdown
        this.dropdown = document.createElement('div')
        this.dropdown.className = 'pvt-picker__dropdown'

        this.listContainer = document.createElement('div')
        this.listContainer.className = 'pvt-picker__list'

        this.dropdown.appendChild(this.listContainer)

        if (this.mode === 'multi') {
            container.appendChild(this.chipsContainer)
            container.appendChild(this.clearButton)
        } else {
            container.appendChild(this.inputWrap)
        }

        // search box inside the dropdown (fixed position, multi-only)
        if (this.mode === 'multi') {
            this.searchWrap = document.createElement('div')
            this.searchWrap.className = 'pvt-picker__search'
            this.searchInput = document.createElement('input')
            this.searchInput.className = 'pvt-picker__search-input'
            this.searchInput.placeholder = this.select.getAttribute('placeholder') || 'Search...'
            this.searchWrap.appendChild(this.searchInput)
            this.dropdown.insertBefore(this.searchWrap, this.listContainer)
        }

        this.root.appendChild(container)
        this.root.appendChild(this.dropdown)

        this.renderList()
        this.renderChips()
    }

    private attach() {
        // control bar
        const control = this.root.querySelector('.pvt-picker__control') as HTMLElement

        control?.addEventListener('click', (e) => {
            if (this.mode === 'single') {
                this.dropdown.classList.toggle('open')
                if (this.dropdown.classList.contains('open')) {
                    // Preserve current selection display
                    if (this.selected.size === 0) {
                        const placeholder = this.select.getAttribute('placeholder') || 'Select...'
                        this.input.placeholder = placeholder
                        this.input.value = ''
                    }
                    this.renderList()
                }
                return
            }
            // multi-select: toggle dropdown
            if ((e.target as HTMLElement).tagName !== 'BUTTON' &&
                !(e.target as HTMLElement).classList.contains('pvt-picker__chip-remove')) {
                this.dropdown.classList.toggle('open')
                if (this.dropdown.classList.contains('open')) {
                    this.searchInput.focus()
                }
            }
        })

        // search input events (multi-select only)
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                this.renderList(this.searchInput.value)
            })

            this.searchInput.addEventListener('focus', (e) => {
                e.stopPropagation()
                this.dropdown.classList.add('open')
            })
        }

        // close on outside click
        document.addEventListener('click', (e) => {
            if (!this.root.contains(e.target as Node)) {
                this.dropdown.classList.remove('open')
            }
        })

        // clear button
        this.clearButton.addEventListener('click', () => this.clear())

        // single-select close button
        this.singleCloseButton.addEventListener('click', (e) => {
            e.stopPropagation()
            this.selected.clear()
            this.syncToSelect()
            this.syncFromSelect()
            this.dropdown.classList.remove('open')
        })

        // observe DOM changes on original select to auto-sync
        // Only watch for option element additions/removals (not attribute changes)
        const observer = new MutationObserver((mutations) => {
            let changed = false
            for (const m of mutations) {
                for (const node of m.addedNodes as unknown as Element[]) {
                    if (node.tagName === 'OPTION') { changed = true; break }
                }
                for (const node of m.removedNodes as unknown as Element[]) {
                    if (node.tagName === 'OPTION') { changed = true; break }
                }
                if (changed) break
            }
            if (changed) this.syncFromSelect()
        })
        observer.observe(this.select, { childList: true, subtree: true })
    }

    private renderList(filter = '') {
        this.listContainer.innerHTML = ''

        const filtered = this.searchable
            ? this.options.filter((o) =>
                filter ? o.label.toLowerCase().includes(filter.toLowerCase()) : true
            )
            : this.options

        if (filtered.length === 0) {
            const msg = document.createElement('div')
            msg.className = 'pvt-picker__no-options'
            msg.textContent = 'No options available'
            this.listContainer.appendChild(msg)
        }

        filtered.forEach((opt) => {
            const item = document.createElement('div')
            item.className = 'pvt-picker__option'
            if (opt.disabled) item.classList.add('disabled')
            if (this.selected.has(opt.value)) item.classList.add('selected')
            item.textContent = opt.label

            item.addEventListener('click', (e) => {
                e.stopPropagation()
                if (opt.disabled) return
                if (this.mode === 'single') {
                    this.selected.clear()
                    this.selected.add(opt.value)
                    const selectedOpt = this.options.find((o) => o.value === opt.value)
                    this.input.value = selectedOpt ? selectedOpt.label : ''
                    this.input.placeholder = ''
                    this.dropdown.classList.remove('open')
                    this.syncToSelect()
                    this.syncFromSelect()
                    return
                } else {
                    if (this.selected.has(opt.value)) {
                        this.selected.delete(opt.value)
                    } else {
                        this.selected.add(opt.value)
                    }
                }
                this.syncToSelect()
                this.renderList(this.mode === 'multi' ? this.searchInput.value : this.input.value)
                this.renderChips()
            })

            this.listContainer.appendChild(item)
        })
    }

    private renderChips() {
        if (this.mode === 'single') return

        this.chipsContainer.innerHTML = ''

        if (this.selected.size > 0) {
            this.selected.forEach((val) => {
                const opt = this.options.find((o) => o.value === val)
                if (!opt) return

                const chip = document.createElement('span')
                chip.className = 'pvt-picker__chip'

                const label = document.createElement('span')
                label.className = 'pvt-picker__chip-label'
                label.textContent = opt.label

                const remove = document.createElement('button')
                remove.className = 'pvt-picker__chip-remove'
                remove.textContent = '×'
                remove.setAttribute('aria-label', `Remove ${opt.label}`)

                remove.addEventListener('click', (e) => {
                    e.stopPropagation()
                    this.selected.delete(val)
                    this.syncToSelect()
                    this.renderChips()
                    this.renderList(this.searchInput.value)
                })

                chip.appendChild(label)
                chip.appendChild(remove)
                this.chipsContainer.appendChild(chip)
            })
        } else {
            const placeholder = document.createElement('span')
            placeholder.className = 'pvt-picker__placeholder'
            placeholder.textContent = this.select.getAttribute('placeholder') || 'Select...'
            this.chipsContainer.appendChild(placeholder)
        }

        this.clearButton.style.display = this.selected.size > 0 ? '' : 'none'
    }

    private syncToSelect() {
        Array.from(this.select.options).forEach((opt) => {
            opt.selected = this.selected.has(opt.value)
        })
        this.select.dispatchEvent(new Event('change', { bubbles: true }))
    }

    private syncFromSelect() {
        this.selected.clear()
        Array.from(this.select.selectedOptions).forEach((o) => {
            // skip placeholder/empty options
            if (!o.value) return
            const exists = this.options.find((opt) => opt.value === o.value)
            if (exists) this.selected.add(o.value)
        })
        // Update single-select display when syncing
        if (this.mode === 'single') {
            if (this.selected.size === 1) {
                const val = this.selected.values().next().value
                const opt = this.options.find((o) => o.value === val)
                if (opt) {
                    this.input.value = opt.label
                    this.input.placeholder = ''
                }
            } else {
                const placeholder = this.select.getAttribute('placeholder') || 'Select...'
                this.input.value = ''
                this.input.placeholder = placeholder
            }
            // Show/hide close button
            if (this.mode === 'single') {
                this.singleCloseButton.style.display = this.selected.size > 0 ? '' : 'none'
            }
        }
        this.renderChips()
        this.renderList(this.input.value)
    }

    /**
     * Manual sync — call after programmatically changing options on the original <select>.
     * Also watches DOM mutations automatically, but this is useful for JS-driven changes
     * that don't touch the DOM (e.g., adding/removing <option> elements via framework).
     */
    public sync() {
        this.syncFromSelect()
    }

    private clear() {
        this.selected.clear()
        this.syncToSelect()
        this.syncFromSelect()
        this.renderList(this.searchInput.value)
        this.dropdown.classList.remove('open')
    }

    /**
     * Get the currently selected values.
     */
    public getValues(): string[] {
        return Array.from(this.selected)
    }

    /**
     * Programmatically set selected values.
     */
    public setValues(values: string[]) {
        this.selected = new Set(values)
        this.syncToSelect()
        if (this.mode === 'single' && this.selected.size === 1) {
            const val = this.selected.values().next().value
            const opt = this.options.find((o) => o.value === val)
            if (opt) {
                this.input.value = opt.label
                this.input.placeholder = ''
            }
        }
        this.renderChips()
        this.renderList(this.input.value)
    }

    /**
     * Access the underlying PivotickPicker from the original <select> element.
     * Usage: (element as HTMLSelectElement)._picker
     */
    public get picker() {
        return this
    }
}
