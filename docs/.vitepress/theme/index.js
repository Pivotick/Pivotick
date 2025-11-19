import DefaultTheme from 'vitepress/theme'


/** @type {import('vitepress').Theme} */
export default {
    extends: DefaultTheme,
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