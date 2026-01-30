export interface GraphQueryEvents {
    filterAdd: (key: string, value: FilterFieldConfig) => void
    filterRemove: (key: string) => void
    filterReset: () => void
    filterChange: (filters: GraphFilters) => void
}

export type FilterValue = string | string[] |
                          number | number[] |
                          boolean |
                          { min: number | undefined, max: number | undefined } |
                          undefined // Means the filter is inactive and should be removed

export type FilterMatchMode = 'exact' | 'partial'
export interface FilterFieldConfig {
    /** @default 'exact'  */
    matchMode?: FilterMatchMode
    value: FilterValue
}

export type GraphFilters = Record<string, FilterFieldConfig>