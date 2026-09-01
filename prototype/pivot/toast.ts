// The actionable notification the library does not have. Today's Notifier builds a
// title+body toast and removes it on a hard 4,000 ms timer, with no hover-pause, no dismiss
// and no returned handle (UIManager.ts:1096-1106) — so "Ingested 12 nodes, 14 edges — Undo"
// has neither the time nor the handle it needs. This is the minimal shape that fixes it, and
// the prototype exists partly to demonstrate that this shape is what M3 should build.

export interface ToastAction {
    label: string
    onClick: () => void
}

export interface ToastOptions {
    level?: 'success' | 'info' | 'warning' | 'danger'
    title: string
    message?: string
    action?: ToastAction
    /** Defaults to 12s when an action is present, 4s otherwise. */
    timeout?: number
    dismissible?: boolean
}

export interface ToastHandle {
    /** Replace what the toast says without stacking a second one — how Undo flips to Redo. */
    update(options: ToastOptions): void
    dismiss(): void
}

export function showToast(host: HTMLElement, options: ToastOptions): ToastHandle {
    const el = document.createElement('div')
    el.className = 'pvtp-toast'
    host.appendChild(el)

    let timer: number | undefined
    let remaining = 0
    let startedAt = 0
    let dismissed = false

    const clear = () => {
        if (timer !== undefined) window.clearTimeout(timer)
        timer = undefined
    }

    const dismiss = () => {
        if (dismissed) return
        dismissed = true
        clear()
        el.classList.remove('show')
        el.addEventListener('transitionend', () => el.remove(), { once: true })
        // Belt and braces: a toast never outlives its animation even if the event is missed.
        window.setTimeout(() => el.remove(), 400)
    }

    const arm = (ms: number) => {
        clear()
        remaining = ms
        startedAt = performance.now()
        timer = window.setTimeout(dismiss, ms)
    }

    // Hovering pauses the countdown — the whole point is that the analyst gets to read it.
    el.addEventListener('mouseenter', () => {
        if (timer === undefined) return
        remaining -= performance.now() - startedAt
        clear()
    })
    el.addEventListener('mouseleave', () => {
        if (dismissed || remaining <= 0) return
        arm(remaining)
    })

    const render = (opts: ToastOptions) => {
        const level = opts.level ?? 'success'
        el.className = `pvtp-toast pvtp-toast-${level}${el.classList.contains('show') ? ' show' : ''}`
        el.textContent = ''

        const text = document.createElement('div')
        text.className = 'pvtp-toast-text'
        const title = document.createElement('div')
        title.className = 'pvtp-toast-title'
        title.textContent = opts.title
        text.appendChild(title)
        if (opts.message) {
            const message = document.createElement('div')
            message.className = 'pvtp-toast-message'
            message.textContent = opts.message
            text.appendChild(message)
        }
        el.appendChild(text)

        if (opts.action) {
            const button = document.createElement('button')
            button.className = 'pvtp-toast-action'
            button.textContent = opts.action.label
            button.addEventListener('click', () => opts.action?.onClick())
            el.appendChild(button)
        }

        if (opts.dismissible !== false) {
            const close = document.createElement('button')
            close.className = 'pvtp-toast-close'
            close.setAttribute('aria-label', 'Dismiss')
            close.textContent = '✕'
            close.addEventListener('click', dismiss)
            el.appendChild(close)
        }

        const bar = document.createElement('div')
        bar.className = 'pvtp-toast-life'
        const fill = document.createElement('div')
        bar.appendChild(fill)
        el.appendChild(bar)

        const ms = opts.timeout ?? (opts.action ? 12_000 : 4_000)
        fill.style.transitionDuration = `${ms}ms`
        requestAnimationFrame(() => { fill.style.width = '0%' })
        arm(ms)
    }

    render(options)
    requestAnimationFrame(() => el.classList.add('show'))

    return {
        update(next) {
            dismissed = false
            render(next)
        },
        dismiss,
    }
}
