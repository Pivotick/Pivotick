// The entry imports the stylesheet for its side effect, and tsc copies that
// import into the declarations, where it points at a .scss the package does not
// ship. Drop it: a consumer compiling without skipLibCheck would fail on it.
import { readFileSync, writeFileSync } from 'fs'

const file = 'dist/types/index.d.ts'
const source = readFileSync(file, 'utf8')
const stripped = source.replace(/^import\s+['"][^'"]+\.(?:scss|sass|css)['"];?\r?\n/gm, '')

if (stripped !== source) writeFileSync(file, stripped)
