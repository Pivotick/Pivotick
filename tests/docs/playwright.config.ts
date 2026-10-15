import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.DOCS_PORT ?? 4174)

export default defineConfig({
    testDir: '.',
    testMatch: '*.spec.ts',
    outputDir: '../../work/docs-browser-results',
    reporter: [['list']],
    timeout: 90000,
    use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: `http://localhost:${port}`,
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
    },
    webServer: {
        command: `npx vitepress preview docs --port ${port} --host 127.0.0.1`,
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        url: `http://localhost:${port}/Pivotick/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
})
