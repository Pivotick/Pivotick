import { defineConfig } from 'vite'

/**
 * misp-modules answers with no CORS headers, so the browser cannot call it
 * directly. `/misp-modules.html` talks to this proxy instead. Point it elsewhere
 * with MISP_MODULES_URL.
 */
const mispModules = process.env.MISP_MODULES_URL ?? 'http://127.0.0.1:6677'

export default defineConfig({
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    },
    server: {
        proxy: {
            '/misp-api': {
                target: mispModules,
                changeOrigin: true,
                // Modules that reach out to a slow third party need the room.
                timeout: 120000,
                proxyTimeout: 120000,
                rewrite: path => path.replace(/^\/misp-api/, '')
            }
        }
    }
})
