import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Render and sanitize the passed markdown text
 * @param text The markdown text to be renderer
 */
export function renderMarkdown(text: string): string {
    const rawHtml = marked.parse(text) as string
    const safeHtml = DOMPurify.sanitize(rawHtml)
    return safeHtml
}

/**
 * Render and sanitize the passed markdown text as inline
 * @param text The markdown text to be renderer
 */
export function renderMarkdownInline(text: string): string {
    const rawHtml = marked.parseInline(text) as string
    const safeHtml = DOMPurify.sanitize(rawHtml)
    return safeHtml
}