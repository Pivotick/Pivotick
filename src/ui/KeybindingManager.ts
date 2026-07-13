import type { Keybinding } from '../interfaces/GraphUI'

export class KeybindingManager {
    private bindings = new Map<string, (evt: KeyboardEvent) => void>()
    private container: HTMLElement

    constructor(container: HTMLElement) {
        this.container = container
    }

    /** Register a keybinding. Returns a disposer that removes it again. */
    register(binding: Keybinding): () => void {
        this.bindings.set(binding.key, binding.callback)
        return () => {
            if (this.bindings.get(binding.key) === binding.callback) {
                this.bindings.delete(binding.key)
            }
        }
    }

    unregister(key: string) {
        this.bindings.delete(key)
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
        const callback = this.bindings.get(keyCombo)
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
        if (event.shiftKey) keys.push('Shift')
        if (event.altKey) keys.push('Alt')
        keys.push(event.key)
        return keys.join('+')
    }
}
