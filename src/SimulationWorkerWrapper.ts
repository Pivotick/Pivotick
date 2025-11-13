import type { Node } from './Node'
import type { Edge } from './Edge'
import type { SimulationOptions } from './interfaces/SimulationOptions'
import SimulationWorker from './SimulationWorker.ts?worker'

export const runSimulationInWorker = (
    nodes: Node[],
    edges: Edge[],
    options: SimulationOptions,
    canvasBCR: DOMRect,
    onProgress?: (progress: number, elapsedTime: number) => void
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
    return new Promise((resolve, reject) => {
        const worker = new SimulationWorker()

        worker.postMessage({ nodes, edges, options, canvasBCR })

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
