# Documentation translations

English Markdown and TypeScript documentation comments remain the sources. The site
generates Chinese (`zh`), French (`fr`), German (`de`) and Portuguese (`pt`) pages from
the catalogues here. English stays at the existing URLs; translated URLs have a language
prefix. The language selector keeps the current page and section. No browser-language
redirect or external translation service is used by the built site.

`source.json` maps stable message IDs to English prose and the pages using it. Each
language JSON maps those IDs to translated prose. `⟦n⟧` placeholders protect inline code,
links, markup and API names. Keep every placeholder exactly once. Validation also checks
Markdown links and image targets. Code fences, executable
Vue scripts, signatures and example data remain in their original language.

The initial prose translations were prepared with Google Translate, with the project
owner’s approval, and shared navigation labels were translated separately. The catalogues
are editable translation sources; corrections need no network access or translation account.

After changing a guide or a TypeScript documentation comment:

```sh
npm ci
npm run typedoc:build
npm run docs:i18n:extract
# Translate new IDs in zh.json, fr.json, de.json and pt.json.
npm run docs:i18n:build
npm run test:docs
npm run docs:build
# Optional browser checks against the production build:
npx playwright install chromium
npm run test:docs:browser
```

Commit the English sources and catalogues together. Do not commit generated `docs/zh`,
`docs/fr`, `docs/de`, `docs/pt` or `docs/reference` pages. The generated API reference uses
the same VitePress theme and language selector as the guides. Navigation points there
instead of opening an English-only TypeDoc site in a separate window.

`docs:build` and `vitepress:dev` generate all pages locally. A missing translation, changed
placeholder or new untranslated source causes the build to fail rather than publishing a
partially translated page. Code-only source-link changes do not invalidate prose.

Shared navigation, search, accessibility and gallery labels live in
`docs/.vitepress/site-i18n.ts`. Gallery thumbnails and JavaScript examples are shared by
all languages. Embedded graphs receive the selected documentation language.
