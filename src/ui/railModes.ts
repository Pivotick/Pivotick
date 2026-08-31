import type { RailModeDefinition, RailTool } from '../interfaces/GraphUI'
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
