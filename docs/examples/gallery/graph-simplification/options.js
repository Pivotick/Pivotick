// #region data
// Two events share eight IPs, the first alone has six domains, a host has nine
// files, and the second event has ten sightings from two sensors.
const ips = Array.from({ length: 8 }, (_, i) => ({ id: `ip-${i}`, data: { type: 'ip', label: `198.51.100.${10 + i}` } }))
const domains = Array.from({ length: 6 }, (_, i) => ({ id: `dom-${i}`, data: { type: 'domain', label: `site-${i}.example` } }))
const files = Array.from({ length: 9 }, (_, i) => ({ id: `file-${i}`, data: { type: 'file', label: `sample-${i}.bin` } }))
const sightings = Array.from({ length: 10 }, (_, i) => ({
    id: `seen-${i}`,
    data: { type: 'sighting', label: `Sighting ${i + 1}`, sensor: i < 6 ? 'north' : 'south' },
}))

const data = {
    nodes: [
        { id: 'ev-1', data: { type: 'event', label: 'Event 1' } },
        { id: 'ev-2', data: { type: 'event', label: 'Event 2' } },
        { id: 'host', data: { type: 'host', label: 'Build host' } },
        ...ips, ...domains, ...files, ...sightings,
    ],
    edges: [
        ...ips.flatMap(ip => [{ from: 'ev-1', to: ip.id }, { from: 'ev-2', to: ip.id }]),
        ...domains.map(domain => ({ from: 'ev-1', to: domain.id })),
        ...files.map(file => ({ from: 'host', to: file.id })),
        ...sightings.map(sighting => ({ from: 'ev-2', to: sighting.id })),
        { from: 'ev-2', to: 'host' },
    ],
}
// #endregion data

// #region rules
const plural = { ip: 'IPs', domain: 'domains', file: 'files', sighting: 'sightings' }

const simplify = {
    rules: [
        // An app rule: a key per node, and nodes sharing a key become one group.
        // It runs first, so the sightings split by sensor before the neighbour
        // rule would fold all ten of them together.
        {
            kind: 'custom',
            id: 'bySensor',
            label: 'By sensor',
            description: 'Sightings reported by the same sensor.',
            partition: (view) => new Map(view.nodes
                .filter(node => view.typeOf(node) === 'sighting')
                .map(node => [node.id, node.getData().sensor])),
        },
        // The built-in rule: one type, exactly the same neighbours, five or more.
        { kind: 'neighbours', minSize: 5 },
    ],
    typeLabel: (type, count) => `${count} ${plural[type] ?? type}`,
}
// #endregion rules

// #region options
const options = {
    UI: {
        mode: 'full',
        // Off: this card is about neither the minimap nor the data dock.
        minimap: false,
        table: false,
        simplify,
    },
    // Longer links, so the labels under the groups have room.
    simulation: { physics: 'manual', d3LinkDistance: 70 },
    render: {
        nodeTypeAccessor: (node) => node.getData().type,
        nodeStyleMap: {
            event: { color: '#7c3aed', size: 16 },
            host: { color: '#475569', size: 14 },
            ip: { color: '#0ea5e9' },
            domain: { color: '#10b981' },
            file: { color: '#e11d48' },
            sighting: { color: '#f59e0b' },
        },
        // A group made by the app's rule names its sensor.
        groupStyle: (group) => group.rule === 'bySensor'
            ? { text: () => `${group.members.length} from ${group.members[0].getData().sensor}` }
            : undefined,
    },
}
// #endregion options

export { data, options }
