/**
 * Visual-test harness.
 *
 * Boots a Pivotick graph into `#app` with deterministic options and exposes a
 * small, serialisable control API on `window.__pivotick`. Tests drive the app
 * either through this API (for setup / non-visual triggers) or through real
 * Playwright pointer events against the elements it makes locatable.
 *
 * This file is internal test code, so it imports internal modules directly
 * (`../../../src/...`). Importing from `index` also pulls in the stylesheet.
 */
import { Pivotick, Node, Edge } from '../../../src/index'
import { Note } from '../../../src/Note'
import { fixtures, type FixtureName, type RawNote } from './fixtures'

/**
 * Deterministic baseline options shared by every fixture:
 *  - `mode: 'light'`  → interactions enabled, minimal chrome
 *  - `theme: 'light'` → pin colours (otherwise follows prefers-color-scheme)
 *  - simulation off   → no physics, positions come straight from the fixture
 *  - zoom animation off → no transitions to wait on / diff against
 */
const BASE_OPTIONS = {
    isDirected: true,
    UI: {
        mode: 'light',
        theme: 'light',
        sidebar: { collapsed: true },
    },
    simulation: { enabled: false, useWorker: false },
    render: { zoomAnimation: false },
}

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Recursively merge `override` into a deep copy of `base` (arrays are replaced). */
function mergeOptions(base: PlainObject, override: PlainObject): PlainObject {
    const out: PlainObject = { ...base }
    for (const [key, value] of Object.entries(override)) {
        const current = out[key]
        if (isPlainObject(current) && isPlainObject(value)) {
            out[key] = mergeOptions(current, value)
        } else {
            out[key] = value
        }
    }
    return out
}

export interface HarnessApi {
    /** Build a graph from a named fixture; resolves once it has finished rendering. */
    load(name: FixtureName, overrides?: PlainObject): Promise<void>
    /** Select a node by id (renders the selection visuals). */
    selectNode(id: string): void
    /** Select an edge by id. */
    selectEdge(id: string): void
    /** Clear all selection. */
    deselectAll(): void
    /** Add a node with a fixed position and stable domID (`#node-<id>`). */
    addNode(id: string, x: number, y: number, label?: string): void
    /** Create an edge directly through the editing layer. */
    connect(fromId: string, toId: string): void
    /** Enter click-to-connect mode. */
    startClickConnect(): void
    /** Pick a node as source/target while in click-to-connect mode. */
    pickConnectNode(id: string): void
    /** Open the in-place node edit session (surfaces the edit-node modal). */
    openNodeEditor(id: string): void
    /** Add a note; returns its domID for `#note-<id>` lookups. */
    addNote(note: RawNote): string
    /** Re-fit and centre all content (including notes) into the viewport. */
    fit(scale?: number): void
    /** Current element counts — handy for non-visual assertions. */
    counts(): { nodes: number; edges: number; notes: number }
}

class Harness implements HarnessApi {
    public graph?: Pivotick
    private readonly container: HTMLElement

    constructor(container: HTMLElement) {
        this.container = container
    }

    private get g(): Pivotick {
        if (!this.graph) throw new Error('No graph loaded — call load() first')
        return this.graph
    }

    private destroy(): void {
        try {
            this.graph?.destroy()
        } catch {
            /* ignore teardown errors */
        }
        this.container.innerHTML = ''
        this.graph = undefined
    }

    /** Resolves when the graph emits `ready` (layout done, zoom layer revealed). */
    private whenReady(graph: Pivotick): Promise<void> {
        return new Promise<void>((resolve) => {
            let settled = false
            const finish = () => {
                if (settled) return
                settled = true
                resolve()
            }
            graph.on('ready', finish)
        })
    }

    async load(name: FixtureName, overrides: PlainObject = {}): Promise<void> {
        this.destroy()
        const data = fixtures[name]()
        const options = mergeOptions(BASE_OPTIONS, overrides)
        // `data.notes` carries raw note options; the graph normalises them to Notes.
        const graph = new Pivotick(this.container, data as never, options as never)
        this.graph = graph
        await this.whenReady(graph)
        // Wait for web fonts so text metrics (and thus layout/labels) are stable.
        if (document.fonts?.ready) await document.fonts.ready
    }

    selectNode(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.selectElement(node)
    }

    selectEdge(id: string): void {
        const edge = this.g.getMutableEdge(id)
        if (edge) this.g.selectElement(edge)
    }

    deselectAll(): void {
        this.g.deselectAll()
    }

    addNode(id: string, x: number, y: number, label?: string): void {
        const node = new Node(id, { label: label ?? id.toUpperCase() }, {}, id)
        node.x = x
        node.y = y
        node.fx = x
        node.fy = y
        this.g.addNode(node)
    }

    connect(fromId: string, toId: string): void {
        const from = this.g.getMutableNode(fromId)
        const to = this.g.getMutableNode(toId)
        if (from && to) this.g.editing.connectManager.createEdge(from, to)
    }

    startClickConnect(): void {
        this.g.editing.connectManager.startClickConnection()
    }

    pickConnectNode(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.editing.connectManager.selectOrConnectNode(node)
    }

    openNodeEditor(id: string): void {
        const node = this.g.getMutableNode(id)
        if (node) this.g.editing.openNodeSession(node)
    }

    addNote(note: RawNote): string {
        const instance = new Note(note, note.id)
        this.g.noteManager.addNote(instance)
        return instance.domID
    }

    fit(scale?: number): void {
        this.g.renderer.fitAndCenter(scale)
    }

    counts(): { nodes: number; edges: number; notes: number } {
        return {
            nodes: this.g.getNodeCount(),
            edges: this.g.getEdgeCount(),
            notes: this.g.getNotes().length,
        }
    }
}

declare global {
    interface Window {
        __pivotick: HarnessApi
    }
}

const app = document.getElementById('app')
if (!app) throw new Error('#app container not found')
window.__pivotick = new Harness(app)
