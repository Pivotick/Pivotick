import type { UIManager } from '../../../UIManager'
import type { Node } from '../../../../Node'
import './editNodeModal.scss'
import { createHtmlTemplate } from '../../../../utils/ElementCreation'
import { nodeNameGetter } from '../../../../utils/GraphGetters'
import type { ModalHTMLElement } from '../../../components/Modal'
import { FormFactory, type FieldConfig, type FormValues } from '../../../../utils/FormFactory'
import type { NodeEditSession } from '../../../../editing/NodeEditSession'
import { edit } from '../../../icons'
import { createButton } from '../../../components/Button'

export function createNodeEditModal(node: Node, session: NodeEditSession, uiManager: UIManager): void {
    const fixedPreviewSize = 42
    const element = node.getGraphElement()
    let clonedGroup
    if (element && element instanceof SVGGElement) {
        clonedGroup = element.cloneNode(true) as SVGGElement
        const bbox = element.getBBox()
        const scale = fixedPreviewSize / Math.max(bbox.width, bbox.height)
        clonedGroup.setAttribute(
            'transform',
            `translate(${(fixedPreviewSize - bbox.width * scale) / 2 - bbox.x * scale}, ${(fixedPreviewSize - bbox.height * scale) / 2 - bbox.y * scale}) scale(${scale})`
        )
    }
    const header = createHtmlTemplate(`
        <div class="main-container">
            <div class="icon-container">
                <svg class="icon" width="${fixedPreviewSize}" height="${fixedPreviewSize}" viewBox="0 0 ${fixedPreviewSize} ${fixedPreviewSize}" preserveAspectRatio="xMidYMid meet">${clonedGroup?.outerHTML}</svg>
            </div>
            <div class="nodeinfo-container">
                <div>Editing node: </div>
                <div class="nodeinfo-name">${nodeNameGetter(node, uiManager.getOptions().mainHeader)}</div>
            </div>
        </div>
    `) as HTMLDivElement

    const { body, form } = createEditModalBody(node, session, uiManager)

    const previousInstance = document.querySelector('#inspect-node-modal') as ModalHTMLElement | null
    if (previousInstance) {
        previousInstance.__modalInstance?.destroy()
    }
    
    uiManager.createModal({
        id: 'edit-node-modal',
        rawHeader: true,
        header: header,
        body: body,
        rawBody: true,
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
                onClick: () => {
                    const nodeData: FormValues = FormFactory.getValues(form)
                    console.log(nodeData)
                }
            }
        ],
        position: 'top',
        size: 'xl',
        noBodyPadding: true,
        onHidden: () => {
            session.cancel()
        }
    })
}

function createEditModalBody(node: Node, session: NodeEditSession, uiManager: UIManager): { body: HTMLDivElement, form: HTMLFormElement } {
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