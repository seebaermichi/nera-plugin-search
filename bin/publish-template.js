#!/usr/bin/env node

import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { publishAllTemplates } from '@nera-static/plugin-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginName = 'plugin-search'
const sourceDir = path.resolve(__dirname, '../views/')

// Publish all pug templates to views/vendor/plugin-search/
const result = publishAllTemplates({
    pluginName,
    sourceDir,
    expectedPackageName: 'dummy', // for test-only override
})

// Also publish search.js into assets/js/
const publishSearchJS = async () => {
    try {
        const jsSource = path.join(sourceDir, 'search.js')
        const jsTarget = path.resolve(process.cwd(), 'assets/js/search.js')

        await fs.mkdir(path.dirname(jsTarget), { recursive: true })
        await fs.copyFile(jsSource, jsTarget)

        console.log('✓ search.js copied to assets/js/search.js')
    } catch (err) {
        console.error('✗ Failed to copy search.js to assets/js/', err)
        process.exit(1)
    }
}

publishSearchJS().then(() => {
    process.exit(result ? 0 : 1)
})
