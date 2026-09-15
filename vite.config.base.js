// vite.config.base.js
import { defineConfig } from 'vite'
import { resolve } from 'path'
import { transform } from 'esbuild'

export const entry = resolve(__dirname, 'src/index.js')

/**
 * Squeeze the whitespace out of an ES build.
 *
 * Vite hard-codes `minifyWhitespace: false` for ES library output and offers no way to
 * override it, on the assumption that a downstream bundler will minify. Nothing
 * downstream does here — `dist` is consumed as-is — so the newlines would ship.
 * Runs last, since esbuild reprints the source and would otherwise put them back.
 */
export const minifyWhitespace = () => ({
    name: 'pivotick-minify-whitespace',
    enforce: 'post',
    async renderChunk(code) {
        const result = await transform(code, { minifyWhitespace: true })
        return { code: result.code, map: null }
    }
})

export default defineConfig({
    build: {
        sourcemap: false,
        emptyOutDir: false,
        rollupOptions: {
            output: {
                entryFileNames: 'pivotick.[format].js',
                chunkFileNames: 'chunks/[name].js',
                // Root, not `assets/`: `dist/pivotick.css` is the path the docs import.
                assetFileNames: '[name][extname]',
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
