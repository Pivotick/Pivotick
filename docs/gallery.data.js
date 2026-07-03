import { galleryByCategory } from './.vitepress/gallery-files.js'

// VitePress build-time data loader: runs in Node, so it can read the gallery
// folder off disk and serialise the discovered cards into the client bundle.
// Consumed via `import { data } from './gallery.data.js'`.
export default {
    watch: ['./examples/gallery/*/content.md', './examples/gallery/*/pic.png'],
    load() {
        return galleryByCategory()
    },
}
