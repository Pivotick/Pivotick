
import { arrowDown, arrowEnter, arrowUp, magnifyingGlass } from '../../icons'
import type { UIElement, UIManager } from '../../UIManager'
import type { Node } from '../../../Node'
import './searchbox.scss'
import { nodeNameGetter } from '../../../utils/GraphGetters'

interface Match {
    key: string,
    value: string,
}

export class SearchBox implements UIElement {
    private uiManager: UIManager

    public searchBox?: HTMLDivElement
    public searchInput?: HTMLInputElement
    private searchResultsContainer?: HTMLDivElement
    private results: [Node, Match][] | undefined
    private highlightedIndex = 0

    private MAX_RESULT_COUNT = 20

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager
    }

    mount(container: HTMLElement | undefined) {
        if (!container) return

        this.searchBox = this.build()
        container.appendChild(this.searchBox)
    }

    build(): HTMLDivElement {
        /** Searchbox */
        const template = document.createElement('template')
        template.innerHTML = `
  <div id="pvt-searchbox" class="pvt-searchbox">
    <div class="search-container">
        <div class="input-container">
            <span class="icon-container">${magnifyingGlass}</span>
            <input id="pvt-search-input" type="text" name="pvt-search" placeholder="Search" class="search-text" autocomplete="off" />
        </div>
    </div>
    <div class="pvt-search-results"></div>
    <div class="pvt-search-hints">
        <span>
            <span class="pvt-search-icon">${arrowUp}</span>
            <span class="pvt-search-icon">${arrowDown}</span>
            <span class="pvt-search-text">to navigate</span>
        </span>
        <span>
            <span class="pvt-search-icon">${arrowEnter}</span>
            <span class="pvt-search-text">to select</span>
        </span>
        <span>
            <span class="pvt-search-icon">esc</span>
            <span class="pvt-search-text">to close</span>
        </span>
    </div>
  </div>
`
        this.searchBox = template.content.firstElementChild as HTMLDivElement
        this.searchInput = this.searchBox.querySelector('#pvt-search-input') ?? undefined
        this.searchResultsContainer = this.searchBox.querySelector('.pvt-search-results') ?? undefined

        this.searchInput?.addEventListener('input', () => {
            this.searchAndShowResults(this.searchInput!.value)
            this.updateHighlight()
        })

        this.searchInput?.addEventListener('keydown', (event) => {
            if (!this.results || this.results.length < 1) return

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault() // prevent cursor move
                    this.highlightedIndex = (this.highlightedIndex + 1) % this.results.length
                    this.updateHighlight()
                    break
                case 'ArrowUp':
                    event.preventDefault()
                    this.highlightedIndex = (this.highlightedIndex - 1 + this.results.length) % this.results.length
                    this.updateHighlight()
                    break
                case 'Enter':
                    event.preventDefault()
                    if (this.highlightedIndex >= 0) {
                        const el = this.searchResultsContainer?.children[this.highlightedIndex] as HTMLElement | undefined
                        el?.click()
                    }
                    break
                case 'Escape':
                    this.dispatchEvent('pvt-searchbox-close')
                    break
            }
        })

        return this.searchBox
    }

    destroy() {
        this.searchBox?.remove()
        this.searchBox = undefined
    }

    afterMount() {
    }

    graphReady(): void { }

    private buildResult(result: [Node, Match]): HTMLDivElement {
        const fixedPreviewSize = 30

        const template = document.createElement('template')
        template.innerHTML = `
  <div class="pvt-search-result">
    <div>
        <div class="pvt-search-result__nodepreview">
            <svg class="pvt-mainheader-icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet"></svg>
        </div>
        <div class="pvt-search-result__name"></div>
    </div>
    <div class="pvt-search-result__info">
        <div class="pvt-search-result__info_key"></div>
        <div class="pvt-search-result__info_value"></div>
    </div>
  </div>
`
        const node = result[0]
        const match = result[1]

        const container = template.content.firstElementChild as HTMLDivElement
        const preview = container.querySelector('.pvt-search-result__nodepreview .pvt-mainheader-icon') ?? undefined
        const name = container.querySelector('.pvt-search-result__name') ?? undefined
        const infoKey = container.querySelector('.pvt-search-result__info_key') ?? undefined
        const infoValue = container.querySelector('.pvt-search-result__info_value') ?? undefined

        container.addEventListener('click', () => { this.clickHandler(node) })

        // preview!.textContent = node.id
        const element = node.getGraphElement()
        if (element && element instanceof SVGGElement) {
            const clonedGroup = element.cloneNode(true) as SVGGElement
            const bbox = element.getBBox()
            const scale = fixedPreviewSize / Math.max(bbox.width, bbox.height)
            clonedGroup.setAttribute(
                'transform',
                `translate(${(fixedPreviewSize - bbox.width * scale) / 2 - bbox.x * scale}, ${(fixedPreviewSize - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
            )
            preview!.appendChild(clonedGroup)
        }
        name!.textContent = nodeNameGetter(node, this.uiManager.getOptions().mainHeader)
        infoKey!.textContent = `.${match.key}: `
        infoValue!.textContent = match.value

        return container
    }

    private updateHighlight() {
        if (!this.results || !this.searchResultsContainer) return

        this.results.forEach((_item, index) => {
            const el = this.searchResultsContainer?.children[index]
            if (!el) return
            if (index === this.highlightedIndex) {
                el.classList.add('active')
            } else {
                el.classList.remove('active')
            }
        })
    }

    private search(needle: string): [Node, Match][] | undefined {
        const result: [Node, Match][] = []

        const query = needle.trim().toLowerCase()
        if (!query || query.length < 2) return

        for (const node of this.uiManager.graph.getMutableNodes()) {
            if (result.length >= this.MAX_RESULT_COUNT) break

            const data = node.getData()
            for (const key in data) {
                const value = data[key]
                if (value == null) continue 

                const text = String(value).toLowerCase()

                let searchTerm = query.startsWith('"') ? query.slice(1) : query
                const isExactSearch = query.startsWith('"') && query.endsWith('"')
                if (isExactSearch) {
                    searchTerm = searchTerm.slice(0, -1).trim()
                }

                const searchResult = isExactSearch ? text === searchTerm : text.includes(searchTerm)

                if (searchResult) {
                    const match: Match = { key, value: String(value) }
                    result.push([node, match])
                    break
                }

            }
        }

        return result
    }

    private clickHandler(node: Node): void {
        this.dispatchEvent('pvt-searchbox-select', node)
    }

    private searchAndShowResults(needle: string): void {
        if (!this.searchResultsContainer) return

        this.results = undefined
        this.searchResultsContainer.innerHTML = ''
        this.results = this.search(needle)
        if (this.results) {
            const resultsHtml = this.results.map((result: [Node, Match]) => this.buildResult(result))
            resultsHtml.forEach((result: HTMLDivElement) => {
                this.searchResultsContainer?.appendChild(result)
            })
        }
    }


        private dispatchEvent(name: string, node?: Node): void {
            if (!this.searchBox) return

            const evt = new CustomEvent(name, {
                detail: node,
                bubbles: true,
                cancelable: true,
            })
            this.searchBox.dispatchEvent(evt)
        }
}