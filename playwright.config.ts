import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression test configuration.
 *
 * Boots the Vite dev server, drives a deterministic harness page in Chromium,
 * and compares screenshots against committed baselines with a small pixel
 * tolerance (anti-aliasing differs slightly even on the same engine).
 *
 * Determinism strategy: a single browser (Chromium) and a pinned viewport.
 * Baselines are suffixed with the platform so a future Linux CI run matches
 * local Linux runs; regenerate them on a different OS with `--update-snapshots`.
 */
// Override with PW_PORT to dodge a stale dev server from another worktree
// squatting on the default port (reuseExistingServer would serve its code).
const PORT = Number(process.env.PW_PORT) || 5173

export default defineConfig({
    testDir: './tests/visual/specs',
    // Keep all generated artefacts under tests/visual so the repo root stays clean.
    outputDir: './tests/visual/.results',
    snapshotPathTemplate:
        './tests/visual/__screenshots__/{testFileName}/{arg}-{platform}{ext}',

    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,

    reporter: [
        ['list'],
        ['html', { outputFolder: './tests/visual/.report', open: 'never' }],
    ],

    use: {
        baseURL: `http://localhost:${PORT}`,
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        trace: 'on-first-retry',
        // Watch it happen: `SLOWMO=600 npm run test:visual:headed` delays each
        // action so the interactions are visible. No effect on normal/CI runs.
        launchOptions: {
            slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0,
        },
    },

    expect: {
        toHaveScreenshot: {
            // Tolerate a handful of stray pixels (sub-pixel AA), fail on real drift.
            maxDiffPixelRatio: 0.01,
            // Per-pixel colour sensitivity (0 strict … 1 lax). Default 0.2.
            threshold: 0.2,
            animations: 'disabled',
            caret: 'hide',
        },
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
})
