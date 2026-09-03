import type { Keybinding } from '../interfaces/GraphUI'

export class KeybindingManager {
    // A stack per key: the most recent binding wins, and disposing it restores the
    // one underneath — so a plugin binding e.g. Escape shadows the built-in only
    // while it's alive, instead of clobbering it for the lifetime of the UI.
    private bindings = new Map<string, Array<(evt: KeyboardEvent) => void>>()
    private container: HTMLElement

    constructor(container: HTMLElement) {
        this.container = container
    }

    /** Register a keybinding (most recent wins). Returns a disposer that restores the previous binding. */
    register(binding: Keybinding): () => void {
        const stack = this.bindings.get(binding.key) ?? []
        if (stack.length > 0) {
            console.warn(`Pivotick: keybinding "${binding.key}" is already bound; the new handler shadows it until disposed.`)
        }
        stack.push(binding.callback)
        this.bindings.set(binding.key, stack)
        return () => {
            const current = this.bindings.get(binding.key)
            if (!current) return
            const idx = current.lastIndexOf(binding.callback)
            if (idx !== -1) current.splice(idx, 1)
            if (current.length === 0) this.bindings.delete(binding.key)
        }
    }

    handleKeyPress(event: KeyboardEvent) {
        // Ignore typing targets
        const target = event.target as HTMLElement | null

        // Only run when container owns focus
        const active = document.activeElement
        if (!this.container.contains(active)) {
            return
        }

        if (this.isEditableTarget(target)) {
            return
        }

        const keyCombo = this.getKeyCombo(event)
        // The exact combo first, then the platform-agnostic alias: a `Mod+z` binding
        // answers to Ctrl and to Cmd, while `Ctrl+z` still means Ctrl alone.
        const stack = this.bindings.get(keyCombo) ?? this.bindings.get(modAlias(keyCombo))
        const callback = stack?.[stack.length - 1]
        if (callback) {
            event.preventDefault()
            callback(event)
        }
    }

    private isEditableTarget(target: HTMLElement | null): boolean {
        if (!target) return false

        return (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            target.isContentEditable
        )
    }

    private getKeyCombo(event: KeyboardEvent): string {
        const keys = []
        if (event.ctrlKey) keys.push('Ctrl')
        // Cmd on macOS. Its own token rather than folded into Ctrl, so a binding can
        // still ask for one specifically; `Mod` is how you ask for either.
        if (event.metaKey) keys.push('Meta')
        if (event.shiftKey) keys.push('Shift')
        if (event.altKey) keys.push('Alt')
        keys.push(event.key)
        return keys.join('+')
    }
}

/**
 * `Ctrl+z` and `Meta+z` both as `Mod+z`. Anything else is returned unchanged, so the
 * second lookup simply misses.
 */
function modAlias(combo: string): string {
    if (combo.startsWith('Ctrl+')) return `Mod+${combo.slice(5)}`
    if (combo.startsWith('Meta+')) return `Mod+${combo.slice(5)}`
    return combo
}
