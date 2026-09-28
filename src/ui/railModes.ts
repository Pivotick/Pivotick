import type { GraphUI, RailModeDefinition, RailTool } from '../interfaces/GraphUI'
import type { RailModeKind } from './ModeStore'

/**
 * A registered mode's tools, whether it declared a fixed array or a function. The
 * function form is re-read on every render, so a mode's tools can follow the selection.
 */
export function resolveRailTools(mode: RailModeDefinition): RailTool[] {
    const tools = mode.tools
    if (!tools) return []
    return typeof tools === 'function' ? tools() : tools
}

/** A registered mode's kind, defaulted. */
export function railModeKind(mode: RailModeDefinition): RailModeKind {
    return mode.kind ?? 'pointer'
}

/**
 * Is the Simplify rail mode offered? Declared rules decide; with none declared, `full`
 * mode offers the built-ins. `UI.simplify.enabled: false` removes it everywhere.
 */
export function simplifyOffered(options: GraphUI): boolean {
    if (options.simplify?.enabled === false) return false
    const rules = options.simplify?.rules
    return rules ? rules.length > 0 : options.mode === 'full'
}
