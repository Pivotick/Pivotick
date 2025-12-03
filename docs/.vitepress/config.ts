import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Pivotick',
  description: 'Pivotick documentation',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
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
      {
        text: 'Configuration',
        link: '/configuration',
        items: [
          { text: 'Callbacks', link: '/callbacks' },
          { text: 'Layout', link: '/layout' },
          { text: 'Render', link: '/render' },
          { text: 'Simulation', link: '/simulation' },
          {
            text: 'Customizing UI',
            link: '/ui',
            collapsed: true,
            items: [
              { text: 'Sidebar', link: '/ui-sidebar' },
              { text: 'Tooltip', link: '/ui-tooltip' },
              { text: 'Context Menu', link: '/ui-context-menu' },
              { text: 'Selection Menu', link: '/ui-selection-menu' },
              { text: 'Styling UI', link: '/ui-styling' },
            ]
          },
          { text: 'Pivotick API', link: '/api' },
        ]
      },
      { text: 'Generated API docs', link: '/generated-api' },
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
    ],
    search: {
      provider: 'local'
    }
  },
  markdown: {
  }
})
