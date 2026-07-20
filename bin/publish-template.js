#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { publishAllTemplates } from '@nera-static/plugin-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginName = 'plugin-search'
const sourceDir = path.resolve(__dirname, '../views/')
const force = process.argv.includes('--force')

// Publish all pug templates to views/vendor/plugin-search/
const result = publishAllTemplates({
    pluginName,
    sourceDir,
    force,
})

// Also publish search.js into assets/js/. Same skip-if-exists rule as the
// templates above — re-running this command must not discard user edits.
const publishSearchJS = () => {
    const jsSource = path.join(sourceDir, 'search.js')
    const jsTarget = path.resolve(process.cwd(), 'assets/js/search.js')

    if (fs.existsSync(jsTarget) && !force) {
        console.log(
            '⚠️  assets/js/search.js already exists — skipping.\n' +
            '    Re-run with --force to overwrite (this will discard your edits).'
        )
        return true
    }

    try {
        fs.mkdirSync(path.dirname(jsTarget), { recursive: true })
        fs.copyFileSync(jsSource, jsTarget)

        console.log('✓ search.js copied to assets/js/search.js')
        return true
    } catch (err) {
        console.error('✗ Failed to copy search.js to assets/js/', err)
        return false
    }
}

process.exit(result && publishSearchJS() ? 0 : 1)
