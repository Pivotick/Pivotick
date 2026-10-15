import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'

function preserveLanguageSection(event) {
    const link = event.target instanceof Element
        ? event.target.closest('.VPNavBarTranslations a, .VPNavScreenTranslations a, .VPNavBarExtra .translations a') : null
    if (!link) return
    // Fragments are absent from server-rendered links. Set the current section
    // before VitePress handles the language navigation, including keyboard clicks.
    const target = new URL(link.href)
    target.hash = window.location.hash
    link.href = target.href
}

/** @type {import('vitepress').Theme} */
export default {
    extends: DefaultTheme,
    Layout: () => h(DefaultTheme.Layout, {
        onClickCapture: preserveLanguageSection,
        onAuxclickCapture: preserveLanguageSection,
        onFocusinCapture: preserveLanguageSection,
    }),
    enhanceApp({ app }) {
        // Auto-register all Vue components in .vitepress/components
        const modules = import.meta.glob('../components/*.vue', { eager: true })

        for (const path in modules) {
            const component = modules[path].default
            if (!component.name) continue
            
            app.component(component.name, component)
        }
    }
}
