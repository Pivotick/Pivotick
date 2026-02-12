import { PALETTE_REGISTRY, type AvailablePalettes } from './ColorPalettes'

export class ColorPaletteMapper {
    private readonly palette: string[]
    private readonly valueToColor = new Map<string, string>()
    private nextIndex = 0

    constructor()
    constructor(palette: AvailablePalettes)
    constructor(palette: string[])

    constructor(palette?: string[] | AvailablePalettes) {
        this.palette = this.resolvePalette(palette)
    }

    private resolvePalette(palette?: string[] | AvailablePalettes): string[] {
        if (!palette) {
            return PALETTE_REGISTRY['pivotick']?.colors ?? Object.values(PALETTE_REGISTRY)[0].colors
        }

        if (Array.isArray(palette)) {
            if (palette.length === 0) {
                throw new Error('Custom palette array cannot be empty.')
            }
            return palette
        }

        // If it's a string key, look up in registry
        const registryEntry = PALETTE_REGISTRY[palette]
        if (!registryEntry) {
            throw new Error(`Palette "${palette}" not found in PALETTE_REGISTRY.`)
        }

        return registryEntry.colors
    }

    /**
     * Returns a color for the given value.
     * - If the value was already mapped, returns the same color.
     * - If not, assigns the next palette color (cycles if needed).
     */
    public getColor(value: string | undefined | null): string {
        if (value == null) {
            return this.palette[0]
        }

        const existing = this.valueToColor.get(value)
        if (existing) {
            return existing
        }

        const color = this.palette[this.nextIndex % this.palette.length]
        this.valueToColor.set(value, color)
        this.nextIndex++

        return color
    }

    /**
     * Clears all mappings and restarts from the beginning of the palette.
     */
    public reset(): void {
        this.valueToColor.clear()
        this.nextIndex = 0
    }

    /**
     * Returns current internal mapping (read-only snapshot).
     */
    public getMapping(): ReadonlyMap<string, string> {
        return new Map(this.valueToColor)
    }
}
