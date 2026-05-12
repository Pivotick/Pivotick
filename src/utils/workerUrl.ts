export function resolveWorkerUrl(customPath?: string) {
    // 1. User override (highest priority)
    if (customPath) return customPath

    // 2. ESM / bundler environments
    try {
        if (typeof import.meta !== 'undefined' && import.meta.url) {
            return new URL('../workers/simulation.worker.js', import.meta.url).href
        }
    } catch { /* empty */ }

    // 3. Browser fallback (IIFE / script tag)
    if (typeof document !== 'undefined') {
        const currentScript = document.currentScript
        if (currentScript instanceof HTMLScriptElement && currentScript.src) {
            const base = currentScript.src.replace(/\/[^/]*$/, '')
            return `${base}/workers/simulation.worker.js`
        }
    }

    // 4. Last resort (user must configure)
    throw new Error(
        '[Pivotick] Unable to resolve worker path. Please provide `workerPath` in config.'
    )
}