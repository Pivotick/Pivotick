import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      semi: ['error', 'never'],       // Enforce semicolons
      quotes: ['error', 'single'],     // Enforce single quotes
    },
    ignores: ['node_modules', 'dist', 'build']
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
]