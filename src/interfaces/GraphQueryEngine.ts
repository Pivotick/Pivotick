export interface GraphQueryEvents {
    filterAdd: (key: string, value: FilterValue) => void
    filterRemove: (key: string) => void
    filterReset: () => void
    filterChange: (filters: GraphFilters) => void
}

export type FilterValue = string | string[] |
                          number | number[] |
                          boolean |
                          { min: number | undefined, max: number | undefined } |
                          undefined // Means the filter is inactive and should be removed

export type GraphFilters = Record<string, FilterValue>