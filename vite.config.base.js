// vite.config.base.js
import { defineConfig } from 'vite'
import { resolve } from 'path'

export const entry = resolve(__dirname, 'src/index.js')

export default defineConfig({
    build: {
        sourcemap: false,
        emptyOutDir: false,
        rollupOptions: {
            output: {
                entryFileNames: 'pivotick.[format].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: 'assets/[name][extname]',
            }
        }
    },
    publicDir: false,
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    }
})
