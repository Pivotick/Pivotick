// #region data
// A landscape raster shared by all nodes so the fit modes differ visibly
// (a square/vector image would make `cover` and `contain` look identical).
const pic = new URL('./sample.png', import.meta.url).href
// A sibling path with no file behind it, to show the missing-image fallback.
// Derived from `pic` at runtime so the build never tries to resolve a missing asset.
const missingPic = new URL('missing.png', pic).href
const data = {
    nodes: [
        { id: 'icon', fx: -285, fy: 0, data: { name: "'icon'" },
          style: { shape: 'square', imagePath: pic, imageFit: 'icon', color: '#f1f5f9' } },
        { id: 'cover', fx: -95, fy: 0, data: { name: "'cover'" },
          style: { shape: 'square', imagePath: pic, imageFit: 'cover',
                   strokeColor: 'rgba(255,255,255,.55)', strokeWidth: 2 } },
        { id: 'contain', fx: 95, fy: 0, data: { name: "'contain'" },
          style: { shape: 'square', imagePath: pic, imageFit: 'contain', color: '#1f2937',
                   strokeColor: 'rgba(255,255,255,.55)', strokeWidth: 2 } },
        // Missing source: the picture can't load, so the node degrades to a
        // crossed-out-picture placeholder instead of a broken-image glyph. The
        // same fallback appears in the hover preview, tooltip and lightbox.
        { id: 'missing', fx: 285, fy: 0, data: { name: 'missing' },
          style: { shape: 'square', imagePath: missingPic, imageFit: 'cover', color: '#1f2937',
                   strokeColor: 'rgba(255,255,255,.55)', strokeWidth: 2 } },
        // 'frame': the node takes the picture's own aspect ratio, so the whole
        // screenshot shows at full resolution with the stroke hugging it — no crop,
        // no letterbox bars. Bigger `size` just makes the framed picture bigger.
        { id: 'frame', fx: 0, fy: 360, data: { name: "'frame'" },
          style: { imagePath: pic, imageFit: 'frame', size: 176,
                   strokeColor: 'rgba(255,255,255,.55)', strokeWidth: 2 } }
    ],
    edges: []
}
// #endregion data

// #region options
const options = {
    // Static legend: fx/fy pin the nodes, no forces so nothing drifts.
    simulation: { enabled: false },
    render: {
        defaultNodeStyle: {
            size: 44,
            text: (node) => node.getData()?.name,
            textVerticalShift: -1.6
        }
    }
}
// #endregion options

export { data, options }
