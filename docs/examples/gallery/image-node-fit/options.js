// #region data
// A landscape raster shared by all three nodes so the fit modes differ visibly
// (a square/vector image would make `cover` and `contain` look identical).
const pic = new URL('./sample.png', import.meta.url).href
const data = {
    nodes: [
        { id: 'icon', fx: -190, fy: 0, data: { name: "imageFit: 'icon'" },
          style: { shape: 'square', imagePath: pic, imageFit: 'icon', color: '#f1f5f9' } },
        { id: 'cover', fx: 0, fy: 0, data: { name: "imageFit: 'cover'" },
          style: { shape: 'square', imagePath: pic, imageFit: 'cover',
                   strokeColor: 'rgba(255,255,255,.55)', strokeWidth: 2 } },
        { id: 'contain', fx: 190, fy: 0, data: { name: "imageFit: 'contain'" },
          style: { shape: 'square', imagePath: pic, imageFit: 'contain', color: '#1f2937',
                   strokeColor: 'rgba(255,255,255,.55)', strokeWidth: 2 } }
    ],
    edges: []
}
// #endregion data

// #region options
const options = {
    // Static legend: fx/fy pin the row, no forces so nothing drifts.
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
