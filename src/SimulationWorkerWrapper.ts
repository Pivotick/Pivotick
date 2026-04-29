import type { Node } from './Node'
import type { Edge } from './Edge'
import type { SimulationOptions } from './interfaces/SimulationOptions'
import { resolveWorkerUrl } from './utils/workerUrl'
// import SimulationWorker from './SimulationWorker.ts?worker'
import SimulationWorker from './workers/SimulationWorker.ts?worker'


export function createSimulationWorker(options: Partial<SimulationOptions> = {}) {
    if (import.meta.env.DEV) {
        return new SimulationWorker()
    }

    const workerUrl = resolveWorkerUrl(options.workerPath)
    return new Worker(workerUrl, { type: 'module' })
}

export const runSimulationInWorker = (
    nodes: Node[],
    edges: Edge[],
    options: SimulationOptions,
    canvasBCR: DOMRect,
    onProgress?: (progress: number, elapsedTime: number) => void
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
    return new Promise((resolve, reject) => {
        const worker = createSimulationWorker(options)

        worker.postMessage({ source: 'simulation-worker-wrapper', nodes, edges, options, canvasBCR })

        worker.onmessage = (e) => {
            const { type, progress, nodes, edges, elapsedTime } = e.data

            if (type === 'tick' && typeof progress === 'number') {
                onProgress?.(progress, elapsedTime)
                return
            }

            if (type === 'done') {
                resolve({ nodes, edges })
                worker.terminate()
            }
        }

        worker.onerror = reject
    })
}
