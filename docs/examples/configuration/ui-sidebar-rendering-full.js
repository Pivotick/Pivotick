import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { Pivotick } from './../../../src/index'
import './../../../src/styles/style.scss'

export default defineComponent({
    setup() {
        const graphContainer = ref(null)
        let graph = null
        const data = {
            nodes: [
                { id: 1, data: { label: 'A', type: 'hub' } },
                { id: 2, data: { label: 'B', type: 'spoke' } }
            ],
            edges: [{ from: 1, to: 2, data: { label: 'edge1' } }]
        }
        const options = {
            simulation: {
                enabled: false,
                useWorker: false,
            },
            render: {
                zoomEnabled: false,
                selectionBox: {
                    enabled: false,
                },
            },
            UI: {
                mode: 'full',
                sidebar: {
                    collapsed: false,
                },
                mainHeader: {
                    render: (element) => {
                        const div = document.createElement('div')
                        div.textContent = 'Main Header'
                        div.style.fontWeight = 'bold'
                        div.style.color = 'darkred'
                        return div
                    }
                },
                propertiesPanel: {
                    render: (element) => {
                        const div = document.createElement('div')
                        div.textContent = 'Properties Panel'
                        div.style.fontWeight = 'bold'
                        div.style.color = 'darkred'
                        return div
                    }
                },
                extraPanels: [
                    {
                        title: 'Extra panel #1',
                        render: (node) => {
                            const div = document.createElement('div')
                            div.textContent = 'Extra Panel #1'
                            div.style.fontWeight = 'bold'
                            div.style.color = 'darkred'
                            return div
                        },
                    },
                    {
                        title: 'Extra panel #2',
                        render: (node) => {
                            const div = document.createElement('div')
                            div.textContent = 'Extra Panel #2'
                            div.style.fontWeight = 'bold'
                            div.style.color = 'darkred'
                            return div
                        },
                    },
                ],
                tooltip: {
                    enabled: false,
                },
                contextMenu: {
                    enabled: false,
                },
            },
        }

        onMounted(() => {
            graph = new Pivotick(graphContainer.value, data, options)
            graphContainer.value.querySelector('.pvt-canvas').style.filter = 'blur(0.095rem)'
            graphContainer.value.querySelector('.pvt-canvas').style.opacity = '0.2'
            graphContainer.value.querySelector('.pvt-toolbar').style.filter = 'blur(0.095rem)'
            graphContainer.value.querySelector('.pvt-toolbar').style.opacity = '0.2'
            setTimeout(() => { // FIXME: Add callback for graph fully loaded
                graph.selectElement(graph.getNodes()[0])
            }, 200)
        })
    
        onBeforeUnmount(() => {
            if (graph?.destroy)
                graph.destroy()
        })

        return { graphContainer }
    },
    template: '<div ref="graphContainer" :class="$style.pivotick" data-theme="light"></div>'
})