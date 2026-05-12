import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
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