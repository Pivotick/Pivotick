import type { UIManager } from '../../../UIManager'
import type { Edge } from '../../../../Edge'
import './editEdgeModal.scss'
import { createHtmlTemplate } from '../../../../utils/ElementCreation'
import { nodeNameGetter } from '../../../../utils/GraphGetters'
import { FormFactory, type FieldConfig } from '../../../../utils/FormFactory'
import type { EdgeEditSession } from '../../../../editing/EdgeEditSession'
import { edit } from '../../../icons'
import { applyMessages, i18nText } from '../../../../i18n/dom'

/**
 * The edge edit modal — the edge twin of the node one. Its body is either the
 * declarative form (from `editors.edgeEditor.fields`, else inferred from the edge's
 * data) or whatever a custom handler returns.
 *
 * A custom body owns the draft: there is no form to read on submit, so Save commits
 * `session.draft` as the handler left it.
 */
export function createEdgeEditModal(
    edge: Edge,
    session: EdgeEditSession,
    uiManager: UIManager,
    customHandler?: ((session: EdgeEditSession) => HTMLDivElement)
): void {
    const header = createHtmlTemplate(`
        <div class="main-container">
            <div class="edgeinfo-container">
                <div ${i18nText('modal.editEdge.heading')}></div>
                <div class="edgeinfo-name"></div>
            </div>
        </div>
    `) as HTMLDivElement
    applyMessages(header, uiManager.graph.i18n)
    // Endpoint labels are graph data: assign them as text, never interpolate as markup.
    const nameEl = header.querySelector('.edgeinfo-name')
    if (nameEl) nameEl.textContent = describeEndpoints(edge, uiManager)

    let form: HTMLFormElement | null = null
    let body: HTMLDivElement

    if (customHandler) {
        body = customHandler(session)
    } else {
        const built = createEditModalBody(edge, uiManager, uiManager.getOptions().editors?.edgeEditor?.fields)
        body = built.body
        form = built.form
    }

    uiManager.createModal({
        id: 'edit-edge-modal',
        rawHeader: true,
        header: header,
        body: body,
        rawBody: true,
        // Any dismissal that isn't a commit (×, Cancel, backdrop) must end the session,
        // or it stays `active` and openEdgeSession short-circuits — so a second Edit on
        // the same edge would never reopen. A commit already deactivated it, hence the guard.
        onHide: () => { if (session.active) session.cancel() },
        buttons: [
            {
                variant: 'secondary',
                text: uiManager.graph.i18n.t('prompt.cancel'),
                iconUnicode: '×',
                onClick: (evt, hideModal) => {
                    hideModal()
                }
            },
            {
                variant: 'primary',
                text: uiManager.graph.i18n.t('modal.editEdge.submit'),
                svgIcon: edit,
                onClick: async (evt, hideModal) => {
                    // With a custom body the handler owns `session.draft`; otherwise the
                    // form is the draft.
                    if (form) session.setDraft(FormFactory.getValues(form))
                    const committed = await session.commit()
                    if (committed) {
                        hideModal()
                    }
                }
            }
        ],
        position: 'top',
        size: 'lg',
        noBodyPadding: true,
    })
}

/** "Alice → Project Atlas", falling back to node ids when there's nothing to show. */
function describeEndpoints(edge: Edge, uiManager: UIManager): string {
    const mainHeader = uiManager.getOptions().mainHeader
    const from = nodeNameGetter(edge.from, mainHeader, uiManager.graph.i18n).trim() || edge.from.id
    const to = nodeNameGetter(edge.to, mainHeader, uiManager.graph.i18n).trim() || edge.to.id
    return uiManager.graph.i18n.t('modal.editEdge.endpoints', { from, to })
}

function createEditModalBody(edge: Edge, uiManager: UIManager, configured?: FieldConfig[]): { body: HTMLDivElement, form: HTMLFormElement } {
    const body = document.createElement('div')
    body.classList.add('edit-edge-modal-body')

    const form = FormFactory.createForm({ fields: configured ?? inferFields(edge, uiManager), i18n: uiManager.graph.i18n })

    body.append(form)
    return { body, form }
}

/**
 * One text field per data key, as the node editor does. An edge with no data at all
 * still gets a `label` field — otherwise the modal would be an empty box.
 */
function inferFields(edge: Edge, uiManager: UIManager): FieldConfig[] {
    const entries = Object.entries(edge.getData() as Record<string, unknown>)

    if (!entries.length) {
        return [{ key: 'label', label: uiManager.graph.i18n.t('modal.editEdge.labelField'), type: 'text', defaultValue: '' }]
    }

    return entries.map(([key, value]) => ({
        key,
        label: FormFactory.niceLabelFromKey(key),
        type: 'text',
        defaultValue: value == null ? '' : String(value),
    }))
}
