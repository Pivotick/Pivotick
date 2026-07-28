import type { MarkedExtension, Tokens } from 'marked'
import { escapeHtml } from '../../../../utils/utils'

interface NodeReferenceToken extends Tokens.Generic {
    type: 'node-reference'
    raw: string
    nodeName: string
}

export const nodeReferenceExtension: MarkedExtension = {
    extensions: [
        {
            name: 'node-reference',
            level: 'inline',

            start(src: string) {
                return src.match(/\[\[/)?.index
            },

            tokenizer(src: string): NodeReferenceToken | undefined {

                const match = /^\[\[([^[\]]+)\]\]/.exec(src)

                if (!match) return

                return {
                    type: 'node-reference',
                    raw: match[0],
                    nodeName: match[1].trim(),
                }
            },

            renderer(token: Tokens.Generic) {

                const { nodeName } = token as NodeReferenceToken
                // The tokenizer only rejects [ and ], so nodeName can still carry quotes and
                // angle brackets: escape it rather than leaning on the consumer to sanitize.
                const safeName = escapeHtml(nodeName)
                return `
                    <span
                        class="pvt-node-reference"
                        data-node-name="${safeName}"
                    >
                        ${safeName}
                    </span>
                `
            }
        }
    ]
}