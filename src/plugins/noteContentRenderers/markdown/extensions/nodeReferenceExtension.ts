import type { MarkedExtension, Tokens } from 'marked'

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

            renderer(token: NodeReferenceToken) {

                return `
                    <span
                        class="pvt-node-reference"
                        data-node-name="${token.nodeName}"
                    >
                        ${token.nodeName}
                    </span>
                `
            }
        }
    ]
}