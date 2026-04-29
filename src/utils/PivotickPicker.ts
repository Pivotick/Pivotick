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
        this.options = Array.from(this.select.options).map((o) => ({
            value: o.value,
            label: o.text,
            disabled: o.disabled
        }))
    }

    private build() {
        this.select.style.display = 'none'
        this.select.parentElement?.insertBefore(this.root, this.select)

        // container
        const container = document.createElement('div')
        container.className = 'pvt-picker__control'

        // chips (multi)
        this.chipsContainer = document.createElement('div')
        this.chipsContainer.className = 'pvt-picker__chips'

        // input
        this.input = document.createElement('input')
        this.input.className = 'pvt-picker__input'
        this.input.placeholder = this.select.getAttribute('placeholder') || 'Select...'
        this.input.type = 'text'

        // dropdown
        this.dropdown = document.createElement('div')
        this.dropdown.className = 'pvt-picker__dropdown'

        this.listContainer = document.createElement('div')
        this.listContainer.className = 'pvt-picker__list'

        this.dropdown.appendChild(this.listContainer)

        container.appendChild(this.chipsContainer)
        container.appendChild(this.input)

        this.root.appendChild(container)
        this.root.appendChild(this.dropdown)

        this.renderList()
        this.renderChips()
    }

    private attach() {
        this.input.addEventListener('focus', () => {
            this.dropdown.classList.add('open')
        })

        this.input.addEventListener('input', () => {
            this.renderList(this.input.value)
        })

        document.addEventListener('click', (e) => {
            if (!this.root.contains(e.target as Node)) {
                this.dropdown.classList.remove('open')
            }
        })
    }

    private renderList(filter = '') {
        this.listContainer.innerHTML = ''

        const filtered = this.options.filter((o) =>
            o.label.toLowerCase().includes(filter.toLowerCase())
        )

        filtered.forEach((opt) => {
            const item = document.createElement('div')
            item.className = 'pvt-picker__option'
            item.textContent = opt.label

            if (this.selected.has(opt.value)) {
                item.classList.add('selected')
            }

            item.onclick = () => this.toggle(opt.value)

            this.listContainer.appendChild(item)
        })
    }

    private renderChips() {
        if (this.mode === 'single') return

        this.chipsContainer.innerHTML = ''

        this.selected.forEach((val) => {
            const opt = this.options.find((o) => o.value === val)
            if (!opt) return

            const chip = document.createElement('div')
            chip.className = 'pvt-picker__chip'

            const label = document.createElement('span')
            label.textContent = opt.label

            const remove = document.createElement('button')
            remove.className = 'pvt-picker__chip-remove'
            remove.textContent = '×'

            remove.onclick = (e) => {
                e.stopPropagation()
                this.remove(val)
            }

            chip.appendChild(label)
            chip.appendChild(remove)

            this.chipsContainer.appendChild(chip)
        })

        // clear button
        if (this.selected.size > 0) {
            const clear = document.createElement('button')
            clear.className = 'pvt-picker__clear'
            clear.textContent = 'Clear'
            clear.onclick = () => this.clear()
            this.chipsContainer.appendChild(clear)
        }
    }

    private toggle(value: string) {
        if (this.mode === 'single') {
            this.selected.clear()
            this.selected.add(value)
            this.dropdown.classList.remove('open')
        } else {
            if (this.selected.has(value)) {
                this.selected.delete(value)
            } else {
                this.selected.add(value)
            }
        }

        this.syncToSelect()
        this.renderList(this.input.value)
        this.renderChips()
    }

    private remove(value: string) {
        this.selected.delete(value)
        this.syncToSelect()
        this.renderList(this.input.value)
        this.renderChips()
    }

    private clear() {
        this.selected.clear()
        this.syncToSelect()
        this.renderList(this.input.value)
        this.renderChips()
    }

    private syncToSelect() {
        Array.from(this.select.options).forEach((opt) => {
            opt.selected = this.selected.has(opt.value)
        })

        this.select.dispatchEvent(new Event('change'))
    }

    private syncFromSelect() {
        Array.from(this.select.selectedOptions).forEach((o) => {
            this.selected.add(o.value)
        })
        this.renderChips()
    }

    public sync() {
        this.syncFromSelect()
        this.renderChips()
    }
}