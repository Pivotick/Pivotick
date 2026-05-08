import base, { entry } from './vite.config.base'
import { defineConfig } from 'vite'

// vite.config.browser.js
export default defineConfig({
    ...base,
    build: {
        ...base.build,
        lib: {
            entry,
            name: 'Pivotick',
            formats: ['umd', 'iife'],
            fileName: (format) => `pivotick.${format}.js`,
        },
        rollupOptions: {
            external: [], // bundle everything
            output: {
                ...base.build.rollupOptions.output,
                globals: {},
                footer: 'if(typeof window!="undefined"){var C=window.Pivotick;window.Pivotick=C.Pivotick;window.Pivotick.Node=C.Node;window.Pivotick.Edge=C.Edge;window.Pivotick.ColorPaletteMapper=C.ColorPaletteMapper}'
            }
        }
    }
})
