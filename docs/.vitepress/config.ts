import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Pivotick',
  description: 'Pivotick documentation',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'Generated API docs', link: '/api' },
      { text: 'Examples', link: '/examples' },
    ],

    sidebar: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'API', link: '/api' },
      {
        text: 'Examples',
        link: '/examples',
        items: [
          { text: 'Example 1', link: '/examples/example1' },
          { text: 'Example 2', link: '/examples/example2' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Pivotick/Pivotick' }
    ]
  },
  markdown: {
  }
})
