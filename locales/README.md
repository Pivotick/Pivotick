# Pivotick translations

Select a bundled language with `i18n: { locale: 'fr' }` (or `zh`, `de`, `pt`, `nl`, `ja`, `ar`, `es`).
English remains the default. Chinese uses Simplified characters. Regional locale tags
share the language catalogue and retain regional formatting and plural rules.

Edit the UTF-8 `.po` files here, using Poedit or a text editor. `msgctxt` is the stable
message key, `msgid` is the English source, and `msgstr` is the translation. Preserve all
`{placeholders}`. For plural messages, Chinese and Japanese have one slot (`other`);
Arabic has six (`zero`, `one`, `two`, `few`, `many`, `other`); the other bundled
languages have two (`one`, `other`). `Intl.PluralRules` chooses the runtime category;
categories without a dedicated slot, such as Spanish `many`, fall back to `other`.

From a source checkout after `npm ci`:

```sh
npm run i18n:extract  # Refresh POT and merge English changes into PO files
# Translate empty entries and review/remove fuzzy flags after source changes
npm run i18n:compile  # Validate and generate src/i18n/locales/*.ts
npm run i18n:check    # Check completeness, placeholders, plurals and generated files
npm run test:i18n
```

Commit the PO files, POT and generated TypeScript together. Do not edit generated
catalogues directly. `npm run build` includes the catalogue check. Extraction preserves
existing translations and translator comments, marks changed source text as fuzzy, and
adds new messages with empty translations. Compilation refuses unfinished translations.

The PO files and POT ship in the npm package; rebuilding translations requires a source
checkout. See [Translating the UI](../docs/i18n.md) for overrides and additional languages.
