import { marked } from 'marked'
import DOMPurify, { type Config } from 'dompurify'

import { nodeReferenceExtension } from './extensions/nodeReferenceExtension'

marked.use(nodeReferenceExtension)

/**
 * What a note is allowed to render: the tags `marked` emits, plus the `<span>` the
 * node-reference extension adds.
 *
 * An allow-list rather than a deny-list, because note content is as untrusted as the rest of
 * the graph data. DOMPurify's default profile is wider than Markdown needs: it keeps `<style>`,
 * which is not scoped to the note and so styles the whole host page, and `<form>`/`<button>`,
 * which post from the host's own origin.
 */
const NOTE_POLICY: Config = {
    // `input` is absent, which costs task lists their checkbox: dropping a tag keeps its
    // children, so allowing the box would have left a `<form>`'s password field standing in
    // the note once the form around it went.
    ALLOWED_TAGS: [
        'a', 'blockquote', 'br', 'code', 'del', 'em', 'hr', 'img', 'li', 'ol', 'p',
        'pre', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ],
    // No `style`: inline CSS reaches the host page the same way a `<style>` element does.
    // `data-*` passes regardless of this list, which is how `data-node-name` survives.
    ALLOWED_ATTR: ['align', 'alt', 'class', 'href', 'src', 'title'],
}

/**
 * Render and sanitize the passed markdown text
 * @param text The markdown text to be renderer
 */
export function renderMarkdown(text: string): string {
    const rawHtml = marked.parse(text) as string
    const safeHtml = DOMPurify.sanitize(rawHtml, NOTE_POLICY)
    return safeHtml
}

/**
 * Render and sanitize the passed markdown text as inline
 * @param text The markdown text to be renderer
 */
export function renderMarkdownInline(text: string): string {
    const rawHtml = marked.parseInline(text) as string
    const safeHtml = DOMPurify.sanitize(rawHtml, NOTE_POLICY)
    return safeHtml
}
