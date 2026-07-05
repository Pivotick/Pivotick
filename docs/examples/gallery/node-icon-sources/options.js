// #region data
// A raw inline SVG (fill="currentColor" resolves to the node's strokeColor).
const shieldSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3z"/></svg>'

// A misp-iconify icon delivered "class only" via CSS mask (see misp-mask.css):
// a <span> whose background is masked by the icon's SVG — coloured by `color`.
// `html` must return an HTMLElement, so build the node rather than a string.
const mispMask = () => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#fff;font-size:34px'
    const icon = document.createElement('span')
    icon.className = 'misp-icon misp-icon-event misp-hexagone'
    wrap.append(icon)
    return wrap
}

// One node per icon-delivery mechanism, pinned in a row (x/y) so nothing drifts.
const data = {
    nodes: [
        { id: 'fa',    fx: -320, fy: 0, data: { name: 'iconClass' },   style: { color: '#f59e0b', textColor: '#ffffff', iconClass: 'fa-solid fa-star' } },
        { id: 'misp',  fx: -160, fy: 0, data: { name: 'html + mask' }, style: { color: '#2563eb', html: mispMask } },
        { id: 'svg',   fx:    0, fy: 0, data: { name: 'svgIcon' },     style: { color: '#16a34a', strokeColor: '#ffffff', svgIcon: shieldSvg } },
        { id: 'img',   fx:  160, fy: 0, data: { name: 'imagePath' },   style: { color: '#f1f5f9', imagePath: import.meta.env.BASE_URL + 'pivotick.svg' } },
        { id: 'emoji', fx:  320, fy: 0, data: { name: 'iconUnicode' }, style: { color: '#7c3aed', iconUnicode: '🚀' } }
    ],
    edges: []
}
// #endregion data

// #region options
const options = {
    // Static demo: no forces; fx/fy pin every node so the row never drifts.
    simulation: { enabled: false },
    render: {
        defaultNodeStyle: {
            size: 26,
            strokeColor: '#ffffff',
            strokeWidth: 2,
            // Caption sits below each node (shift ≥ 1 ⇒ themed, readable pill).
            text: (node) => node.getData()?.name,
            textVerticalShift: -1.9
        }
    }
}
// #endregion options

export { data, options }
