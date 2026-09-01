import type { Graph } from '../Graph'
import { closeIcon } from './icons'
import type { UIManager } from './UIManager'

/** @internal */
export const NotificationLevel = {
    Success: 'success',
    Warning: 'warning',
    Danger: 'danger',
    Info: 'info',
} as const

export type NotificationLevel = (typeof NotificationLevel)[keyof typeof NotificationLevel]

/**
 * A button on the toast itself — the door for an outcome the user may want to take
 * back, such as the pivot pipeline's "Ingested 12 — Undo".
 */
export interface NotificationAction {
    label: string;
    /**
     * Run on click, with the toast's own handle so it can rewrite itself in place
     * (`Ingested 12 — Undo` becoming `Undone — Redo`). The toast is dismissed
     * afterwards unless the handler already updated it.
     */
    onClick: (notification: NotificationHandle) => void;
}

export interface Notification {
    level: NotificationLevel;
    title: string;
    message?: string;
    /** A single action, rendered as a button beside the dismiss control. */
    action?: NotificationAction;
    /**
     * How long the toast stays, in ms. `0` keeps it until it is dismissed.
     * @default 4000, or 12000 when there is an `action` — long enough to read the
     * outcome *and* decide about it.
     */
    duration?: number;
}

/** Lifetime of a plain toast, and of one carrying an action. */
const DEFAULT_DURATION = 4000
const ACTIONABLE_DURATION = 12_000

/**
 * A toast on screen: the handle {@link Notifier.notify} returns, so the same toast
 * can be rewritten or taken away rather than stacked on top of.
 */
export interface NotificationHandle {
    /**
     * Rewrite the toast in place, keeping its position in the stack and restarting
     * its lifetime. Anything omitted is left as it was; pass `action: null` to drop
     * the action.
     */
    update(notification: Partial<Omit<Notification, 'action'>> & { action?: NotificationAction | null }): void;
    dismiss(): void;
    /** Whether it has already gone — by timeout, by dismissal, or with the UI. */
    readonly dismissed: boolean;
}

/**
 * Build one toast and mount it. Kept beside {@link Notifier} rather than in the
 * `UIManager` because it is all DOM and no coordination.
 *
 * @internal
 */
export function mountToast(container: HTMLElement, notification: Notification): NotificationHandle {
    let current = notification
    let dismissed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let hovered = false

    const toast = document.createElement('div')
    toast.className = 'pivotick-toast'
    toast.setAttribute('role', 'status')

    const titleRow = document.createElement('div')
    titleRow.className = 'pivotick-toast-title'
    const titleText = document.createElement('span')
    titleRow.appendChild(titleText)

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'pivotick-toast-close'
    close.innerHTML = closeIcon
    close.setAttribute('aria-label', 'Dismiss')
    close.addEventListener('click', () => dismiss())
    titleRow.appendChild(close)
    toast.appendChild(titleRow)

    const body = document.createElement('div')
    body.className = 'pivotick-toast-body'
    toast.appendChild(body)

    const actions = document.createElement('div')
    actions.className = 'pivotick-toast-actions'
    toast.appendChild(actions)

    const handle: NotificationHandle = {
        update: patch => {
            if (dismissed) return
            current = {
                ...current,
                ...patch,
                action: patch.action === null ? undefined : patch.action ?? current.action,
            }
            paint()
            arm()
        },
        dismiss: () => dismiss(),
        get dismissed() { return dismissed },
    }

    function paint(): void {
        toast.className = `pivotick-toast pivotick-toast-${current.level}${toast.classList.contains('show') ? ' show' : ''}`
        titleText.textContent = current.title
        body.textContent = current.message ?? ''
        body.hidden = !current.message

        actions.replaceChildren()
        actions.hidden = !current.action
        if (current.action) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'pivotick-toast-action'
            button.textContent = current.action.label
            button.addEventListener('click', () => {
                const acted = current.action
                acted?.onClick(handle)
                // Left alone by its own handler means the action is spent: a toast
                // still saying "Undo" after the undo landed would lie.
                if (!dismissed && current.action === acted) dismiss()
            })
            actions.appendChild(button)
        }
    }

    /** (Re)start the lifetime. Paused while the pointer is on the toast. */
    function arm(): void {
        if (timer !== undefined) clearTimeout(timer)
        timer = undefined
        if (hovered) return
        const duration = current.duration ?? (current.action ? ACTIONABLE_DURATION : DEFAULT_DURATION)
        if (duration <= 0) return
        timer = setTimeout(() => dismiss(), duration)
    }

    function dismiss(): void {
        if (dismissed) return
        dismissed = true
        if (timer !== undefined) clearTimeout(timer)
        toast.classList.remove('show')
        toast.addEventListener('transitionend', () => toast.remove(), { once: true })
        // The transition never fires for a toast that was never shown (a detached
        // container, a dismiss in the same frame), so it must not be the only door out.
        setTimeout(() => toast.remove(), 400)
    }

    // Hover pauses rather than merely extends: a toast being read must not vanish
    // mid-sentence. Leaving restarts the full lifetime, so the decision window is the
    // same one the analyst just took their eyes off.
    toast.addEventListener('mouseenter', () => { hovered = true; arm() })
    toast.addEventListener('mouseleave', () => { hovered = false; arm() })

    paint()
    container.appendChild(toast)
    requestAnimationFrame(() => toast.classList.add('show'))
    arm()

    return handle
}

/**
 * Manages and displays notification messages in the graph UI.
 *
 * Use this component to show success, warning, error, or info messages
 * to the user.
 *
 * @example
 * ```ts
 * graph.notifier.warning('This is a warning', 'Content of the message goes here.')
 * ```
 *
 * A notification can also carry one action and outlive the default four seconds,
 * which is how an outcome offers to undo itself:
 *
 * @example
 * ```ts
 * const toast = graph.notifier.success('Ingested 12 nodes', undefined, {
 *     action: { label: 'Undo', onClick: (t) => { undo(); t.update({ title: 'Undone' }) } },
 * })
 * ```
 */
export class Notifier {
    private graph: Graph
    private UIManager: UIManager

    constructor(graph: Graph) {
        this.graph = graph
        this.UIManager = this.graph.UIManager
    }

    /**
     * Dispatch a notification to the UIManager.
     *
     * @param level - The severity level of the notification.
     * @param title - The title to display in the notification.
     * @param message - Optional detailed message for the notification.
     * @param options - An action to offer, and how long to stay.
     * @returns A handle onto the toast, or `undefined` where there is nowhere to
     * show one (a UI mode with no notification slot).
     */
    public notify(
        level: NotificationLevel,
        title: string,
        message?: string,
        options?: Pick<Notification, 'action' | 'duration'>,
    ): NotificationHandle | undefined {
        const notification: Notification = { level, title, message, ...options }
        return this.UIManager.showNotification(notification)
    }

    public success(title: string, message?: string, options?: Pick<Notification, 'action' | 'duration'>): NotificationHandle | undefined {
        return this.notify(NotificationLevel.Success, title, message, options)
    }

    public warning(title: string, message?: string, options?: Pick<Notification, 'action' | 'duration'>): NotificationHandle | undefined {
        return this.notify(NotificationLevel.Warning, title, message, options)
    }

    public error(title: string, message?: string, options?: Pick<Notification, 'action' | 'duration'>): NotificationHandle | undefined {
        return this.notify(NotificationLevel.Danger, title, message, options)
    }

    public info(title: string, message?: string, options?: Pick<Notification, 'action' | 'duration'>): NotificationHandle | undefined {
        return this.notify(NotificationLevel.Info, title, message, options)
    }
}
