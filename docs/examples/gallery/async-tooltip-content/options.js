// #region data
const data = {
    nodes: [
        { id: 'attr-1', data: { label: '8.8.8.8', type: 'ip-dst', uuid: 'a1' } },
        { id: 'attr-2', data: { label: 'evil.example', type: 'domain', uuid: 'a2' } },
        { id: 'attr-3', data: { label: 'd41d8cd98f00b204', type: 'md5', uuid: 'a3' } },
        { id: 'attr-4', data: { label: 'payload.exe', type: 'filename', uuid: 'a4' } },
        { id: 'attr-5', data: { label: 'bad@example.com', type: 'email-src', uuid: 'a5' } }
    ],
    edges: [
        { from: 'attr-1', to: 'attr-2', data: { label: 'resolves' } },
        { from: 'attr-2', to: 'attr-3', data: { label: 'served' } },
        { from: 'attr-3', to: 'attr-4', data: { label: 'is' } },
        { from: 'attr-2', to: 'attr-5', data: { label: 'registered by' } }
    ]
}
// #endregion data

// #region endpoint
// Stands in for a real endpoint. A genuine integration would `fetch(url, { signal })`
// — the point is that it takes time and can be called off.
function fetchEnrichment(uuid, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({
            tags: ['tlp:amber', 'malware'],
            sightings: (uuid.charCodeAt(1) % 7) + 1
        }), 900)
        signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new DOMException('aborted', 'AbortError'))
        })
    })
}
// #endregion endpoint

// #region options
const options = {
    UI: {
        tooltip: {
            nodeHeaderMap: {
                title: (node) => node.getData().label,
                subtitle: (node) => node.getData().type
            },
            // Return a promise and the tooltip shows a placeholder until it resolves.
            // Hover from node to node: the abandoned fetch is aborted, and its result
            // is dropped rather than painted into the tooltip you are now looking at.
            renderNodeExtra: async (node, { signal }) => {
                const { tags, sightings } = await fetchEnrichment(node.getData().uuid, signal)

                const box = document.createElement('div')
                box.style.cssText = 'margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;align-items:center'
                for (const tag of tags) {
                    const chip = document.createElement('span')
                    chip.textContent = tag
                    chip.style.cssText = 'font-size:11px;padding:1px 6px;border-radius:9px;background:#f0ad4e33;border:1px solid #f0ad4e'
                    box.appendChild(chip)
                }
                const count = document.createElement('span')
                count.textContent = `· ${sightings} sightings`
                count.style.cssText = 'font-size:11px;opacity:.75'
                box.appendChild(count)
                return box
            }
        },
        // Optional: replace the built-in skeleton and error line.
        asyncContent: {
            placeholder: () => {
                const line = document.createElement('div')
                line.textContent = 'Loading enrichment…'
                line.style.cssText = 'margin-top:6px;font-size:11px;opacity:.6'
                return line
            },
            error: 'Enrichment unavailable'
        }
    }
}
// #endregion options

export { data, options }
