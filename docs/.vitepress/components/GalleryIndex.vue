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
                    :aria-label="`${siteText('Permalink to', lang)} “${category.title}”`"
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
                        <span v-else class="pvt-gallery__thumb--empty">{{ siteText('No preview yet', lang) }}</span>
                    </span>
                    <span class="pvt-gallery__title">{{ card.title }}</span>
                </a>
            </div>
            <p v-else class="pvt-gallery__soon">{{ siteText('Coming soon.', lang) }}</p>
        </section>
    </div>
</template>

<script setup>
import { withBase, useData } from 'vitepress'
import { computed } from 'vue'
import { siteText, siteLanguage } from '../site-i18n'
import { data } from '../../gallery.data.js'

const { lang } = useData()
const categories = computed(() => (data[siteLanguage(lang.value)] ?? []).map(category => ({
    ...category, title: siteText(category.title, lang.value),
})))

defineOptions({ name: 'GalleryIndex' })

// Resolve each card's thumbnail through Vite's asset pipeline so it gets a
// hashed, base-prefixed URL — the file stays in the card folder.
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
