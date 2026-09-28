import type { CommunityGraph } from '../plugins/analytics/Leiden'

/** The compute worker's community job, beside its layout job. */
export const COMMUNITIES_JOB = 'pivotick-communities'

export interface CommunitiesJob {
    source: typeof COMMUNITIES_JOB
    graph: CommunityGraph
    resolutions: number[]
}
