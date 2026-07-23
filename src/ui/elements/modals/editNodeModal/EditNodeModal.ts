import type { UIManager } from '../../../UIManager'
import type { Node } from '../../../../Node'
import './editNodeModal.scss'
import { createHtmlTemplate } from '../../../../utils/ElementCreation'
import { nodeNameGetter } from '../../../../utils/GraphGetters'
import { createNodePreview } from '../../../../utils/NodePreview'
import type { ModalHTMLElement } from '../../../components/Modal'
import { FormFactory, type FieldConfig, type FormValues } from '../../../../utils/FormFactory'
import type { NodeEditSession } from '../../../../editing/NodeEditSession'
import { edit } from '../../../icons'


export function createNodeEditModal(node: Node, session: NodeEditSession, uiManager: UIManager, customHandler?: ((session: NodeEditSession) => HTMLDivElement)): void {
    const fixedPreviewSize = 42
    const header = createHtmlTemplate(`
        <div class="main-container">
            <div class="icon-container"></div>
            <div class="nodeinfo-container">
                <div>Editing node: </div>
                <div class="nodeinfo-name">${nodeNameGetter(node, uiManager.getOptions().mainHeader)}</div>
            </div>
        </div>
    `) as HTMLDivElement
    header.querySelector('.icon-container')?.appendChild(createNodePreview(node, { size: fixedPreviewSize, className: 'icon' }))

    let body, form: HTMLFormElement
    if (customHandler) {
        body = customHandler(session)
    } else {
        const result = createEditModalBody(node)
        body = result.body
        form = result.form
    
        const previousInstance = document.querySelector('#inspect-node-modal') as ModalHTMLElement | null
        if (previousInstance) {
            previousInstance.__modalInstance?.destroy()
        }
    }

    // ALSO, CHANGE SHORTCUTS TO ACTUALLY NOT TRIGGER WHEN IN A MODAL OR IN AN INPUT BOX
    uiManager.createModal({
        id: 'edit-node-modal',
        rawHeader: true,
        header: header,
        body: body,
        rawBody: true,
        // Any dismissal that isn't a commit (×, Cancel, backdrop) must end the
        // session — otherwise it stays `active` and openNodeSession short-circuits,
        // so a second Edit on the same node never reopens. A commit already
        // deactivated it, hence the guard.
        onHide: () => { if (session.active) session.cancel() },
        buttons: [
            {
                variant: 'secondary',
                text: 'Cancel',
                iconUnicode: '×',
                onClick: (evt, hideModal) => {
                    hideModal()
                }
            },
            {
                variant: 'primary',
                text: 'Edit Node',
                svgIcon: edit,
                onClick: async (evt, hideModal) => {
                    const nodeData: FormValues = FormFactory.getValues(form)
                    session.setDraft(nodeData)
                    const committed = await session.commit()
                    if (committed) {
                        hideModal()
                    }
                }
            }
        ],
        position: 'top',
        size: 'xl',
        noBodyPadding: true,
    })
}

function createEditModalBody(node: Node): { body: HTMLDivElement, form: HTMLFormElement } {
    const body = document.createElement('div')
    body.classList.add('edit-node-modal-body')

    const fields: FieldConfig[] = []
    Object.entries(node.getData() as Record<string, unknown>).forEach(([k, v]) => {
        const fieldConfig: FieldConfig = {
            key: k,
            label: k,
            type: 'text',
            defaultValue: (v as string).toString()
        }
        fields.push(fieldConfig)
    })

    const editForm = FormFactory.createForm({
        fields: fields
    })

    body.append(editForm)
    return { body, form: editForm }
}