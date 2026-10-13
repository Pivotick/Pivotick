import type { Node } from '../../../Node'
import type { GroupInfo } from '../../../interfaces/Simplify'
import type { Simplification } from '../../../Simplification/Simplification'
import { createHtmlElement } from '../../../utils/ElementCreation'
import type { I18n } from '../../../i18n/I18n'
import './groupsummary.scss'

/** Past this many anchors the list ends in "N more". */
const MAX_ANCHOR_CHIPS = 8

export interface GroupSummaryOptions {
    /** A drawn node's name, as the header would show it. */
    nameOf: (node: Node) => string
    /** A line under the lists, e.g. how to open the group. */
    hint?: string
}

function chip(label: string, color: string): HTMLElement {
    const dot = createHtmlElement('i', { class: 'pvt-group-summary-dot' })
    dot.style.background = color
    const text = createHtmlElement('span', { class: 'pvt-group-summary-chip-label' })
    text.textContent = label
    text.title = label
    return createHtmlElement('span', { class: 'pvt-group-summary-chip' }, [dot, text])
}

function section(title: string, chips: HTMLElement[]): HTMLElement {
    const heading = createHtmlElement('div', { class: 'pvt-group-summary-heading' })
    heading.textContent = title
    return createHtmlElement('div', { class: 'pvt-group-summary-section' }, [
        heading,
        createHtmlElement('div', { class: 'pvt-group-summary-chips' }, chips),
    ])
}

/**
 * What a group stands for, for the tooltip and the sidebar: its members by type when it
 * mixes them, and the nodes it links to.
 */
export function buildGroupSummary(simplify: Simplification, info: GroupInfo, options: GroupSummaryOptions, i18n: I18n): HTMLElement {
    const container = createHtmlElement('div', { class: 'pvt-group-summary' })

    const matched = simplify.matchesIn(info)
    if (matched > 0) {
        const line = createHtmlElement('div', { class: 'pvt-group-summary-match' })
        const query = simplify.matchQuery
        line.textContent = query
            ? i18n.t('groupSummary.matchQuery', { count: matched, total: info.members.length, query })
            : i18n.t('groupSummary.match', { count: matched, total: info.members.length })
        container.append(line)
    }

    const types = Object.entries(info.typeCounts).sort((a, b) => b[1] - a[1])
    if (types.length > 1) {
        container.append(section(i18n.t('groupSummary.members'), types.map(([type, count]) =>
            chip(simplify.typeLabel(type === '' ? undefined : type, count), simplify.typeColor(info, type)))))
    }

    if (info.anchors.length > 0) {
        const shown = info.anchors.slice(0, MAX_ANCHOR_CHIPS)
        const chips = shown.map(anchor => chip(options.nameOf(anchor), simplify.colorOf(anchor)))
        const rest = info.anchors.length - shown.length
        if (rest > 0) {
            const more = createHtmlElement('span', { class: 'pvt-group-summary-more' })
            more.textContent = i18n.t('groupSummary.more', { count: rest })
            chips.push(more)
        }
        container.append(section(i18n.t('groupSummary.linkedTo'), chips))
    }

    if (options.hint) {
        const hint = createHtmlElement('div', { class: 'pvt-group-summary-hint' })
        hint.textContent = options.hint
        container.append(hint)
    }
    return container
}
