import type { Keybinding } from '../interfaces/GraphUI'

export class KeybindingManager {
    private bindings = new Map<string, (evt: KeyboardEvent) => void>()

    register(binding: Keybinding) {
        this.bindings.set(binding.key, binding.callback)
    }

    handleKeyPress(event: KeyboardEvent) {
        const keyCombo = this.getKeyCombo(event)
        const callback = this.bindings.get(keyCombo)
        if (callback) {
            event.preventDefault()
            callback(event)
        }
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
