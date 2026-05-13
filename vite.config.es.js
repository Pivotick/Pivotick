import base, { entry } from './vite.config.base'
import { defineConfig } from 'vite'

export default defineConfig({
    ...base,
    build: {
        ...base.build,
        lib: {
            entry,
            formats: ['es'],
            fileName: () => 'pivotick.es.js'
        },
        rollupOptions: {
            external: [
                'd3-drag',
                'd3-force',
                'd3-hierarchy',
                'd3-selection',
                'd3-transition',
                'd3-zoom',
                'lodash.merge'
            ],
            ...base.rollupOptions
        }
    }
})