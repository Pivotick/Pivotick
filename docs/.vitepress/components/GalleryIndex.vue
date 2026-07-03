<template>
    <div class="pvt-gallery">
        <section
            v-for="category in categories"
            :key="category.id"
            class="pvt-gallery__category"
        >
            <h2 :id="category.anchor" tabindex="-1">
                {{ category.title }}
                <a
                    class="header-anchor"
                    :href="`#${category.anchor}`"
                    :aria-label="`Permalink to “${category.title}”`"
                >&ZeroWidthSpace;</a>
            </h2>

            <div v-if="category.cards.length" class="pvt-gallery__grid">
                <a
                    v-for="card in category.cards"
                    :key="card.slug"
                    class="pvt-gallery__card"
                    :href="withBase(card.link)"
                >
                    <span class="pvt-gallery__thumb">
                        <img
                            v-if="thumbFor(card.slug)"
                            :src="thumbFor(card.slug)"
                            :alt="card.title"
                            loading="lazy"
                        />
                        <span v-else class="pvt-gallery__thumb--empty">No preview yet</span>
                    </span>
                    <span class="pvt-gallery__title">{{ card.title }}</span>
                </a>
            </div>
            <p v-else class="pvt-gallery__soon">Coming soon.</p>
        </section>
    </div>
</template>

<script setup>
import { withBase } from 'vitepress'
import { data as categories } from '../../gallery.data.js'

defineOptions({ name: 'GalleryIndex' })

// Resolve each card's thumbnail through Vite's asset pipeline so it gets a
// hashed, base-prefixed URL — the file stays in the card folder (PRD §4.1).
const thumbs = import.meta.glob('../../examples/gallery/*/pic.png', {
    eager: true,
    query: '?url',
    import: 'default',
})

function thumbFor(slug) {
    const match = Object.entries(thumbs).find(([file]) =>
        file.includes(`/gallery/${slug}/pic.png`)
    )
    return match ? match[1] : null
}
</script>
