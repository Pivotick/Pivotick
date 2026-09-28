import type { Node, SimulationNodeDTO } from './Node'
import type { Edge, SimulationEdgeDTO } from './Edge'
import type { SimulationOptions } from './interfaces/SimulationOptions'
import SimulationWorker from './workers/SimulationWorker.ts?worker&inline'
import { communityLadder, type CommunityGraph } from './plugins/analytics/Leiden'
import { COMMUNITIES_JOB, type CommunitiesJob } from './workers/jobs'


export function createSimulationWorker() {
    return new SimulationWorker()
}

/**
 * Find communities at each resolution in a copy of the compute worker. Where no worker can
 * start (a CSP blocking blob workers, say), the same code runs on the page instead.
 */
export function findCommunities(graph: CommunityGraph, resolutions: number[], useWorker = true): Promise<Int32Array[]> {
    const onPage = () => new Promise<Int32Array[]>((resolve, reject) => {
        // A task later, so the card can say it is grouping first.
        setTimeout(() => {
            try {
                resolve(communityLadder(graph, resolutions))
            } catch (error) {
                reject(error)
            }
        }, 0)
    })
    if (!useWorker) return onPage()
    let worker: Worker
    try {
        worker = createSimulationWorker()
    } catch {
        return onPage()
    }
    return new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
            if (e.data?.type !== 'done') return
            resolve(e.data.levels)
            worker.terminate()
        }
        worker.onerror = () => {
            worker.terminate()
            onPage().then(resolve, reject)
        }
        const job: CommunitiesJob = { source: COMMUNITIES_JOB, graph, resolutions }
        worker.postMessage(job)
    })
}

export const runSimulationInWorker = (
    nodes: SimulationNodeDTO[],
    edges: SimulationEdgeDTO[],
    options: SimulationOptions,
    canvasBCR: DOMRect,
    onProgress?: (progress: number, elapsedTime: number) => void,
    groups: string[][] = []
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
    return new Promise((resolve, reject) => {
        const worker = createSimulationWorker()

        worker.postMessage({ source: 'simulation-worker-wrapper', nodes, edges, options, canvasBCR, groups })

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
