import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GALLERY_DIR = path.resolve(__dirname, '../examples/gallery')

/**
 * Ordered category taxonomy for the gallery — the single source of truth shared
 * by the index page (grid headings + anchors) and the VitePress sidebar nav.
 * A card opts into a category through the `category:` letter in its frontmatter.
 */
export const GALLERY_CATEGORIES = [
    { id: 'A', title: 'Basics', anchor: 'basics' },
    { id: 'B', title: 'Node styling', anchor: 'node-styling' },
    { id: 'C', title: 'Edge styling', anchor: 'edge-styling' },
    { id: 'D', title: 'Layouts', anchor: 'layouts' },
    { id: 'E', title: 'Events & callbacks', anchor: 'events-callbacks' },
    { id: 'F', title: 'UI customization', anchor: 'ui-customization' },
    { id: 'G', title: 'Editing & authoring', anchor: 'editing-authoring' },
    { id: 'H', title: 'Notes & annotations', anchor: 'notes-annotations' },
    { id: 'I', title: 'Filtering, search & hierarchy', anchor: 'filtering-search-hierarchy' },
    { id: 'J', title: 'Programmatic control', anchor: 'programmatic-control' },
    { id: 'K', title: 'Theming & performance', anchor: 'theming-performance' },
    { id: 'L', title: 'Showpieces', anchor: 'showpieces' },
]

/** Pull the handful of scalar frontmatter fields the gallery cares about. */
function readFrontmatter(file) {
    const content = fs.readFileSync(file, 'utf-8')
    const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    const block = fm ? fm[1] : ''
    const get = (key) => {
        const m = block.match(new RegExp(`^\\s*${key}\\s*:\\s*["']?(.+?)["']?\\s*$`, 'm'))
        return m ? m[1].trim() : undefined
    }
    return { title: get('title'), category: get('category'), order: get('order') }
}

/**
 * Scan `docs/examples/gallery/<slug>/content.md` and return one descriptor per
 * card. Dropping a folder in (with the right frontmatter) is all it takes to
 * register a card — nothing here is hand-maintained.
 */
export function discoverCards() {
    if (!fs.existsSync(GALLERY_DIR)) return []
    return fs
        .readdirSync(GALLERY_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .reduce((cards, slug) => {
            const contentPath = path.join(GALLERY_DIR, slug, 'content.md')
            if (!fs.existsSync(contentPath)) return cards
            const { title, category, order } = readFrontmatter(contentPath)
            cards.push({
                slug,
                title: title || slug,
                category: (category || '').toUpperCase(),
                order: order != null ? Number(order) : null,
                link: `/examples/gallery/${slug}/content`,
                hasThumb: fs.existsSync(path.join(GALLERY_DIR, slug, 'pic.png')),
            })
            return cards
        }, [])
}

/** Cards grouped under every category (empty categories included for stable anchors). */
export function galleryByCategory() {
    const cards = discoverCards()
    return GALLERY_CATEGORIES.map((category) => ({
        ...category,
        cards: cards
            .filter((card) => card.category === category.id)
            .sort((a, b) => {
                if (a.order != null && b.order != null) return a.order - b.order
                if (a.order != null) return -1
                if (b.order != null) return 1
                return a.slug.localeCompare(b.slug)
            }),
    }))
}

/** Sidebar nav entries — one anchor link per category on the gallery page. */
export function galleryExamples() {
    return GALLERY_CATEGORIES.map((category) => ({
        text: category.title,
        link: `/gallery#${category.anchor}`,
    }))
}
