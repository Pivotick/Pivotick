import base, { entry, minifyWhitespace } from './vite.config.base'
import { defineConfig } from 'vite'

export default defineConfig({
    ...base,
    plugins: [minifyWhitespace()],
    build: {
        ...base.build,
        lib: {
            entry,
            formats: ['es'],
            fileName: () => 'pivotick.es.js'
        },
        rollupOptions: {
            // Nothing external. `dist` is consumed as it ships, where a bare
            // `import 'd3-force'` has nothing to resolve against.
            external: [],
            output: {
                ...base.build.rollupOptions.output
            }
        }
    }
})
