
export type AvailablePalettes = keyof typeof PALETTE_REGISTRY

export interface PaletteInfo {
    colors: string[]
    maxColors: number
    colorblindSafe?: boolean
    description?: string
}

export const PALETTE_REGISTRY: Record<string, PaletteInfo> = {
    'pivotick': {
        colors: [
            '#7EA2FB', // vibrant-blue
            '#A666F4', // vibrant-indigo
            '#85CB33', // vibrant-green
            '#FFB74D', // amber-orange
            '#4DD0E1', // cyan-light
            '#FFD54F', // yellowish accent
            '#BA68C8', // purple accent
            '#81C784', // green-light
            '#00BCD4', // cyan-light
            '#FFA726', // orange accent
        ],
        maxColors: 10,
        colorblindSafe: false,
        description: 'Official Pivotick palette',
    },
    'd3-category10': {
        colors: [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
        ],
        maxColors: 10,
        colorblindSafe: false,
        description: 'Classic D3 categorical palette',
    },
    'd3-tableau10': {
        colors: [
            '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
            '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
        ],
        maxColors: 10,
        colorblindSafe: false,
        description: 'Modern Tableau 10 palette',
    },
    'okabe-ito': {
        colors: [
            '#E69F00', '#56B4E9', '#009E73', '#F0E442',
            '#0072B2', '#D55E00', '#CC79A7', '#000000',
        ],
        maxColors: 8,
        colorblindSafe: true,
        description: 'Colorblind-safe Okabe-Ito palette',
    },
    'brewer-set3': {
        colors: [
            '#8DD3C7', '#FFFFB3', '#BEBADA', '#FB8072', '#80B1D3',
            '#FDB462', '#B3DE69', '#FCCDE5', '#D9D9D9', '#BC80BD',
            '#CCEBC5', '#FFED6F',
        ],
        maxColors: 12,
        colorblindSafe: false,
        description: 'Large ColorBrewer Set3 palette',
    },
    'tol-bright': {
        colors: [
            '#4477AA', '#EE6677', '#228833', '#CCBB44', '#66CCEE',
            '#AA3377', '#BBBBBB',
        ],
        maxColors: 7,
        colorblindSafe: true,
        description: 'Paul Tol bright palette',
    },

    'kelly-22': {
        colors: [
            '#F2F3F4', '#222222', '#F3C300', '#875692', '#F38400', '#A1CAF1', '#BE0032', '#C2B280', '#848482', '#008856',
            '#E68FAC', '#0067A5', '#F99379', '#604E97', '#F6A600', '#B3446C', '#DCD300', '#882D17', '#8DB600', '#654522',
            '#E25822', '#2B3D26'
        ],
        maxColors: 22,
        colorblindSafe: false,
        description: 'Kelly\'s 22 colors of maximum contrast',
    },
    'tableau-40': {
        colors: [
            '#4E79A7', '#A0CBE8', '#F28E2B', '#FFBE7D', '#59A14F', '#8CD17D', '#B6992D', '#F1CE63',
            '#499894', '#86BCB6', '#E15759', '#FF9D9A', '#79706E', '#BAB0AC', '#D37295', '#FABFD2',
            '#B07AA1', '#D4A6C8', '#9D7660', '#D7B5A6',
        ],
        maxColors: 40,
        colorblindSafe: false,
        description: 'Tableau extended palette, 40 colors',
    }
}
