import { createIcon } from './../../../src/utils/ElementCreation'


function renderDropper() {
    const div = document.createElement('div')
    div.id = 'json-dropper'
    div.style.background = 'var(--pvt-bg-color-8)'
    div.style.padding = '4px 8px'
    div.style.borderRadius = '4px'
    div.style.height = '200px'
    div.style.position = 'relative'
    div.style.display = 'flex'
    div.style.justifyContent = 'center'
    div.style.alignItems = 'center'
    div.style.flexDirection = 'column'
    div.style.gap = '1em'
    div.style.border = '2px dashed var(--pvt-text-color-5)'

    const span = document.createElement('span')
    span.style.display = 'inline-block'
    span.style.fontWeight = 'bold'
    span.style.color = 'var(--pvt-text-color-5)'
    span.style.textAlign = 'center'
    span.style.width = '100%'
    span.style.cursor = 'pointer'
    span.textContent = 'Drop a JSON to load the graph'

    const icon = createIcon({ svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" d="M14 4.5V11h-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5zM4.151 15.29a1.2 1.2 0 0 1-.111-.449h.764a.58.58 0 0 0 .255.384q.105.073.25.114q.142.041.319.041q.245 0 .413-.07a.56.56 0 0 0 .255-.193a.5.5 0 0 0 .084-.29a.39.39 0 0 0-.152-.326q-.152-.12-.463-.193l-.618-.143a1.7 1.7 0 0 1-.539-.214a1 1 0 0 1-.352-.367a1.1 1.1 0 0 1-.123-.524q0-.366.19-.639q.192-.272.528-.422q.337-.15.777-.149q.456 0 .779.152q.326.153.5.41q.18.255.2.566h-.75a.56.56 0 0 0-.12-.258a.6.6 0 0 0-.246-.181a.9.9 0 0 0-.37-.068q-.324 0-.512.152a.47.47 0 0 0-.185.384q0 .18.144.3a1 1 0 0 0 .404.175l.621.143q.326.075.566.211a1 1 0 0 1 .375.358q.135.222.135.56q0 .37-.188.656a1.2 1.2 0 0 1-.539.439q-.351.158-.858.158q-.381 0-.665-.09a1.4 1.4 0 0 1-.478-.252a1.1 1.1 0 0 1-.29-.375m-3.104-.033a1.3 1.3 0 0 1-.082-.466h.764a.6.6 0 0 0 .074.27a.5.5 0 0 0 .454.246q.285 0 .422-.164q.137-.165.137-.466v-2.745h.791v2.725q0 .66-.357 1.005q-.355.345-.985.345a1.6 1.6 0 0 1-.568-.094a1.15 1.15 0 0 1-.407-.266a1.1 1.1 0 0 1-.243-.39m9.091-1.585v.522q0 .384-.117.641a.86.86 0 0 1-.322.387a.9.9 0 0 1-.47.126a.9.9 0 0 1-.47-.126a.87.87 0 0 1-.32-.387a1.55 1.55 0 0 1-.117-.641v-.522q0-.386.117-.641a.87.87 0 0 1 .32-.387a.87.87 0 0 1 .47-.129q.265 0 .47.129a.86.86 0 0 1 .322.387q.117.255.117.641m.803.519v-.513q0-.565-.205-.973a1.46 1.46 0 0 0-.59-.63q-.38-.22-.916-.22q-.534 0-.92.22a1.44 1.44 0 0 0-.589.628q-.205.407-.205.975v.513q0 .562.205.973q.205.407.589.626q.386.217.92.217q.536 0 .917-.217q.384-.22.589-.626q.204-.41.205-.973m1.29-.935v2.675h-.746v-3.999h.662l1.752 2.66h.032v-2.66h.75v4h-.656l-1.761-2.676z"/></svg>' })
    icon.style.width = '4em'

    const fileInput = document.createElement('input')
    fileInput.id = 'json-dropper-input'
    fileInput.type = 'file'
    fileInput.accept = '.json,application/json'
    fileInput.style.display = 'none'
    document.body.appendChild(fileInput)

    div.appendChild(icon)
    div.appendChild(span)
    return div
}

function loadedCb(pivotick) {
    const container = document.getElementById('json-dropper')
    const parent = container.parentElement
    const fileInput = document.getElementById('json-dropper-input')

    parent.addEventListener('dragover', (event) => {
        event.preventDefault() // Necessary to allow drop
        container.style.backgroundColor = 'color-mix(in srgb, var(--pvt-bg-color-8) 70%, #fff)'
    })

    parent.addEventListener('dragleave', () => {
        container.style.backgroundColor = ''
    })

    parent.addEventListener('drop', (event) => {
        event.preventDefault()
        container.style.backgroundColor = ''

        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return

        handleJsonFile(pivotick, files[0])
    })

    parent.addEventListener('click', () => {
        fileInput.click() // trigger file dialog
    })

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleJsonFile(pivotick, fileInput.files[0])
            fileInput.value = ''
        }
    })
}

function handleJsonFile(pivotick, file) {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('Please drop a JSON file.')
        return
    }

    const reader = new FileReader()

    reader.onload = (e) => {
        try {
            const jsonData = JSON.parse(e.target.result)
            if (!jsonData.nodes) {
                console.error('Invalid JSON file. Most contain the key `nodes`', err)
                return
            }
            if (!jsonData.edges) {
                console.error('Invalid JSON file. Most contain the key `edges`', err)
                return
            }
            loadGraphData(pivotick, jsonData)
        } catch (err) {
            console.error('Invalid JSON file', err)
        }
    }

    reader.readAsText(file)
}

function loadGraphData(pivotick, data) {
    pivotick.setData(data.nodes, data.edges)
}

const data = {
    'nodes': [
    ],
    'edges': [
    ]
}

const options = {
    UI: {
        mode: 'full',
        extraPanels: [
            {
                alwaysVisible: true,
                title: 'Load your graph',
                render: renderDropper,
            }
        ]
    }
}

export { data, options, loadedCb }