import { defineConfig } from 'vitepress'
import { galleryExamples } from './gallery-files'
import { languages, siteText, localizedLink, searchTerms, type SiteLanguage } from './site-i18n'
import type { DefaultTheme, HeadConfig } from 'vitepress'

const baseurl = '/Pivotick/'
const joinUrl = (base: string, path: string) => `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

// https://vitepress.dev/reference/site-config
const sharedTheme: DefaultTheme.Config = {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'Gallery', link: '/gallery' },
      { text: 'Try it out!', link: '/tool' },
      { text: 'Generated API docs', link: '/reference/classes/Pivotick', },
    ],

    sidebar: [
      { text: 'Getting Started', link: '/getting-started' },
      {
        text: 'Configuration',
        link: '/configuration',
        items: [
          { text: 'Callbacks', link: '/callbacks' },
          { text: 'Edge layers', link: '/edge-layers' },
          { text: 'Simplify', link: '/simplify' },
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
              { text: 'Filters', link: '/ui-filter' },
              { text: 'Legend', link: '/ui-legend' },
              { text: 'Data table', link: '/ui-table' },
              { text: 'Styling UI', link: '/ui-styling' },
            ]
          },
          { text: 'Translating the UI', link: '/i18n' },
          { text: 'Plugins', link: '/plugins' },
          { text: 'Pivotick API', link: '/api' },
        ]
      },
      { text: 'Pivots & enrichment', link: '/pivots' },
      { text: 'Saving pivot results', link: '/pivots-saving' },
      { text: 'Undo & history', link: '/history' },
      { text: 'Security', link: '/security' },
      { text: 'API docs', link: '/generated-api' },
      {
        text: 'Gallery',
        link: '/gallery',
        items: galleryExamples(),
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Pivotick/Pivotick' }
    ],
}

function localeTheme(language: SiteLanguage): DefaultTheme.Config {
  const text = (value: string) => siteText(value, language)
  const translate = (items: unknown): unknown => {
    if (Array.isArray(items)) return items.map(translate)
    if (!items || typeof items !== 'object') return items
    return Object.fromEntries(Object.entries(items).map(([key, value]) => [key,
      key === 'text' && typeof value === 'string' ? text(value)
        : key === 'link' && typeof value === 'string' ? localizedLink(value, language) : translate(value)]))
  }
  return {
    nav: translate(sharedTheme.nav) as DefaultTheme.NavItem[],
    sidebar: translate(sharedTheme.sidebar) as DefaultTheme.Sidebar,
    outline: { label: text('On this page') },
    docFooter: { prev: text('Previous page'), next: text('Next page') },
    lastUpdated: { text: text('Last updated') },
    langMenuLabel: text('Change language'), skipToContentLabel: text('Skip to content'),
    darkModeSwitchLabel: text('Appearance'), lightModeSwitchTitle: text('Switch to light theme'),
    darkModeSwitchTitle: text('Switch to dark theme'), sidebarMenuLabel: text('Menu'),
    returnToTopLabel: text('Return to top'),
    notFound: { title: text('Page not found'), quote: text('This page does not exist.'), linkText: text('Take me home'), linkLabel: text('Take me home') },
  }
}

const labels = { en: 'English', zh: '简体中文', fr: 'Français', de: 'Deutsch', pt: 'Português' }
const searchLocales = Object.fromEntries(languages.map(language => {
  const text = (value: string) => siteText(value, language)
  return [language === 'en' ? 'root' : language, { translations: {
    button: { buttonText: text('Search'), buttonAriaLabel: text('Search documentation') },
    modal: {
      displayDetails: text('Display detailed list'), resetButtonTitle: text('Reset search'),
      backButtonTitle: text('Back'), noResultsText: text('No results for'),
      footer: {
        selectText: text('to select'), selectKeyAriaLabel: text('Enter'),
        navigateText: text('to navigate'), navigateUpKeyAriaLabel: text('Up arrow'),
        navigateDownKeyAriaLabel: text('Down arrow'), closeText: text('to close'), closeKeyAriaLabel: text('Escape'),
      },
    },
  } }]
}))

export default defineConfig({
  title: 'Pivotick', description: 'Pivotick documentation', base: baseurl,
  srcExclude: ['translations/**'],
  buildConcurrency: 8,
  lastUpdated: true, ignoreDeadLinks: true,
  locales: Object.fromEntries(languages.map(language => [language === 'en' ? 'root' : language, {
    label: labels[language], lang: language === 'zh' ? 'zh-CN' : language,
    description: siteText('Pivotick documentation', language),
    link: language === 'en' ? '/' : `/${language}/`, themeConfig: localeTheme(language),
  }])),
  themeConfig: { ...sharedTheme, search: { provider: 'local', options: {
    locales: searchLocales, miniSearch: { options: { tokenize: searchTerms } },
  } } },
  transformHead({ pageData }) {
    const page = pageData.relativePath.replace(/^(?:zh|fr|de|pt)\//, '').replace(/index\.md$/, '').replace(/\.md$/, '.html')
    const url = (language: string) => `https://pivotick.github.io${baseurl}${language === 'en' ? '' : language + '/'}${page}`
    return languages.map(language => ['link', { rel: 'alternate', hreflang: language === 'zh' ? 'zh-CN' : language, href: url(language) }] as HeadConfig)
  },
  markdown: {
    config(md) {
      const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options)
      }

      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const hrefIndex = tokens[idx].attrIndex('href')
        if (hrefIndex >= 0) {
          const href = tokens[idx].attrs![hrefIndex][1]
          
          const language = env.relativePath?.split('/')[0] ?? 'en'
          const target = localizedLink(href, language)
          if (target.startsWith('/') && !target.startsWith(baseurl)) tokens[idx].attrs![hrefIndex][1] = joinUrl(baseurl, target)
        }
        return defaultRender(tokens, idx, options, env, self)
      }
    }
  }
})
