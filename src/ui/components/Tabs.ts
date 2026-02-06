import { createButton } from './Button'
import '../../styles/components/tabs.scss'

type TabItem = {
    id: string
    label: string
    content: HTMLElement
}

export function createTabs(items: TabItem[], activeId?: string, container?: HTMLDivElement, controlContainer?: HTMLDivElement) {

    const tabsRoot = document.createElement('div')
    tabsRoot.className = 'pivotick-tabs'

    const controls = document.createElement('div')
    controls.className = 'pivotick-tab-controls'

    const panels = document.createElement('div')
    panels.className = 'pivotick-tab-panels'

    if (controlContainer && container) {
        controlContainer.appendChild(controls)
        container.appendChild(panels)
    } else if (container) {
        container.appendChild(tabsRoot)
    } else {
        tabsRoot.append(controls, panels)
    }

    function activate(tabId: string) {
        panels.querySelectorAll<HTMLElement>('[data-tab-panel]')
            .forEach(p => p.style.display = 'none')

        controls.querySelectorAll('.pivotick-button')
            .forEach(b => { 
                b.classList.toggle('pivotick-button-primary', false)
                b.classList.toggle('pivotick-button-outline-secondary', true)
            })

        const activePanel = panels.querySelector<HTMLElement>(`[data-tab-panel="${tabId}"]`)
        const activeControl = controls.querySelector<HTMLElement>(`[data-tab-control="${tabId}"]`)

        if (activePanel) activePanel.style.display = 'block'
        if (activeControl) {
            activeControl.classList.remove('pivotick-button-outline-secondary')
            activeControl.classList.add('pivotick-button-primary')
        }
    }

    items.forEach(item => {
        const tabBtn = createButton({
            text: item.label,
            variant: 'outline-secondary',
            'data-tab-control': item.id,
            onclick: () => activate(item.id)
        })

        controls.appendChild(tabBtn)

        const panel = document.createElement('div')
        panel.dataset.tabPanel = item.id
        panel.style.display = 'none'
        panel.appendChild(item.content)

        panels.appendChild(panel)
    })

    activate(activeId ?? items[0].id)

    if (controlContainer && container) {
        return panels
    }
    return tabsRoot

}
