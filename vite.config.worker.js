import { defineConfig } from 'vite'
import { resolve } from 'path'
import { minifyWhitespace } from './vite.config.base'

export default defineConfig({
    plugins: [minifyWhitespace()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/workers/SimulationWorker.ts'),
            formats: ['es'],
            fileName: () => 'simulation.worker.js'
        },
        outDir: 'dist/workers',
        emptyOutDir: false
    },
    publicDir: false
})