import { Flyout } from '../Flyout/Flyout'
import type { FlyoutMode } from '../../ModeStore'
import type { SimplifyRuleStatus } from '../../../interfaces/Simplify'
import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from '../../../Simplification/Simplification'
import { groupNodes } from '../../icons'
import './simplifyflyout.scss'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The **Simplify** rail mode: what the canvas holds now, then one card per rule in the order
 * they run, each with its switch, what it folds, its setting and what it did.
 */
export class SimplifyFlyout extends Flyout {
    protected readonly mode: FlyoutMode = 'simplify'
    /** The rule ids the cards were built for; a different set rebuilds them. */
    private builtFor = ''

    protected template(): string {
        return `
            ${this.headerRow(groupNodes, 'Simplify')}
            <div class="pvt-simplifyflyout-summary">
                <div class="pvt-simplifyflyout-summary-row"><span>On the canvas</span><b data-summary="shown"></b></div>
                <div class="pvt-simplifyflyout-bar"><i></i></div>
                <div class="pvt-simplifyflyout-summary-row"><span data-summary="groups"></span><span data-summary="folded"></span></div>
            </div>
            <div class="pvt-simplifyflyout-rules"></div>`
    }

    protected wire(): void {
        this.render()
        this.track(this.uiManager.graph.simplify.onChange(() => this.render()))
    }

    protected onGraphReady() {
        super.onGraphReady()
        this.render()
    }

    private get simplify() {
        return this.uiManager.graph.simplify
    }

    private render(): void {
        const rules = this.simplify.getRules()
        const ids = rules.map(rule => rule.id).join('\u0001')
        if (ids !== this.builtFor) this.buildCards(rules)
        rules.forEach(rule => this.syncCard(rule))
        this.syncSummary()
    }

    private syncSummary(): void {
        const { shown, total, groups, folded } = this.simplify.summary()
        const set = (key: string, text: string) => {
            const el = this.query<HTMLElement>(`[data-summary="${key}"]`)
            if (el) el.textContent = text
        }
        set('shown', `${shown} of ${plural(total, 'node', 'nodes')}`)
        set('groups', plural(groups, 'group', 'groups'))
        set('folded', `${folded} folded`)
        const bar = this.query<HTMLElement>('.pvt-simplifyflyout-bar i')
        if (bar) bar.style.width = `${total ? Math.round(100 * shown / total) : 100}%`
    }

    private buildCards(rules: SimplifyRuleStatus[]): void {
        const list = this.query<HTMLElement>('.pvt-simplifyflyout-rules')
        if (!list) return
        this.builtFor = rules.map(rule => rule.id).join('\u0001')
        list.replaceChildren(...rules.map((rule, index) => this.buildCard(rule, index)))
    }

    private buildCard(rule: SimplifyRuleStatus, index: number): HTMLElement {
        const card = document.createElement('div')
        card.className = 'pvt-simplifyflyout-rule'
        card.dataset.rule = rule.id

        const head = document.createElement('div')
        head.className = 'pvt-simplifyflyout-rule-head'
        const order = document.createElement('span')
        order.className = 'pvt-simplifyflyout-rule-order'
        order.textContent = String(index + 1)
        const title = document.createElement('span')
        title.className = 'pvt-simplifyflyout-rule-title'
        title.textContent = rule.label
        head.append(order, title)
        if (rule.custom) {
            const tag = document.createElement('span')
            tag.className = 'pvt-simplifyflyout-rule-app'
            tag.textContent = 'app'
            head.appendChild(tag)
        }
        const toggle = document.createElement('button')
        toggle.type = 'button'
        toggle.className = 'pvt-simplifyflyout-rule-switch'
        toggle.setAttribute('role', 'switch')
        toggle.setAttribute('aria-label', rule.label)
        toggle.innerHTML = '<span class="pvt-flyout-switch"></span>'
        this.listen(toggle, 'click', () => {
            const current = this.simplify.getRules().find(candidate => candidate.id === rule.id)
            this.simplify.setRuleEnabled(rule.id, !current?.enabled)
        })
        head.appendChild(toggle)
        card.appendChild(head)

        if (rule.description) {
            const description = document.createElement('div')
            description.className = 'pvt-simplifyflyout-rule-desc'
            description.textContent = rule.description
            card.appendChild(description)
        }

        if (rule.minSize !== undefined) card.appendChild(this.buildStepper(rule))

        const result = document.createElement('div')
        result.className = 'pvt-simplifyflyout-rule-result'
        card.appendChild(result)
        return card
    }

    /** Smallest group: − / + regroup on each click, and the number can be typed. */
    private buildStepper(rule: SimplifyRuleStatus): HTMLElement {
        const row = document.createElement('div')
        row.className = 'pvt-simplifyflyout-rule-setting'
        row.textContent = 'Smallest group'
        const stepper = document.createElement('span')
        stepper.className = 'pvt-simplifyflyout-stepper'
        const minus = document.createElement('button')
        minus.type = 'button'
        minus.dataset.step = '-1'
        minus.textContent = '−'
        minus.setAttribute('aria-label', 'Smaller')
        const input = document.createElement('input')
        input.type = 'text'
        input.inputMode = 'numeric'
        input.setAttribute('aria-label', 'Smallest group')
        const plus = document.createElement('button')
        plus.type = 'button'
        plus.dataset.step = '1'
        plus.textContent = '+'
        plus.setAttribute('aria-label', 'Larger')
        stepper.append(minus, input, plus)
        row.appendChild(stepper)

        const current = () => this.simplify.getRules().find(candidate => candidate.id === rule.id)?.minSize ?? MIN_GROUP_SIZE
        for (const button of [minus, plus]) {
            this.listen(button, 'click', () => this.simplify.setRuleMinSize(rule.id, current() + Number(button.dataset.step)))
        }
        const commit = () => {
            const typed = parseInt(input.value, 10)
            if (Number.isFinite(typed)) this.simplify.setRuleMinSize(rule.id, typed)
            input.value = String(current())
        }
        this.listen(input, 'change', commit)
        this.listen(input, 'keydown', (event) => {
            if ((event as KeyboardEvent).key === 'Enter') commit()
        })
        return row
    }

    private syncCard(rule: SimplifyRuleStatus): void {
        const card = this.query<HTMLElement>(`.pvt-simplifyflyout-rule[data-rule="${CSS.escape(rule.id)}"]`)
        if (!card) return
        card.classList.toggle('pvt-simplifyflyout-rule-off', !rule.enabled)
        card.classList.toggle('pvt-simplifyflyout-rule-failed', rule.failed)
        card.querySelector('.pvt-simplifyflyout-rule-switch')?.setAttribute('aria-pressed', String(rule.enabled))

        const input = card.querySelector<HTMLInputElement>('.pvt-simplifyflyout-stepper input')
        if (input && document.activeElement !== input) input.value = String(rule.minSize)
        const minus = card.querySelector<HTMLButtonElement>('[data-step="-1"]')
        const plus = card.querySelector<HTMLButtonElement>('[data-step="1"]')
        if (minus) minus.disabled = (rule.minSize ?? MIN_GROUP_SIZE) <= MIN_GROUP_SIZE
        if (plus) plus.disabled = (rule.minSize ?? MAX_GROUP_SIZE) >= MAX_GROUP_SIZE

        const result = card.querySelector<HTMLElement>('.pvt-simplifyflyout-rule-result')
        if (!result) return
        if (rule.failed) result.textContent = 'This rule failed'
        else if (!rule.enabled) result.textContent = ''
        else if (rule.groups === 0) result.textContent = rule.minSize !== undefined ? `Nothing to fold at ${rule.minSize} or more` : 'Nothing to fold'
        else result.textContent = `${plural(rule.groups, 'group', 'groups')} · ${plural(rule.folded, 'node', 'nodes')}`
    }
}
