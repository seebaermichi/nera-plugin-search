import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs/promises'
import fssync from 'fs'
import { fileURLToPath } from 'url'
import { getAppData } from '../index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, '.tmp-test-search-plugin')
const ASSETS_DIR = path.join(TMP_DIR, 'assets')
const JS_DIR = path.join(ASSETS_DIR, 'js')
const SEARCH_JSON = path.join(ASSETS_DIR, 'search-index.json')
const SEARCH_JS = path.join(JS_DIR, 'search.js')
const SOURCE_JS = path.resolve(__dirname, '../views/search.js')

beforeEach(async () => {
    if (fssync.existsSync(TMP_DIR)) {
        await fs.rm(TMP_DIR, { recursive: true, force: true })
    }
    await fs.mkdir(ASSETS_DIR, { recursive: true })
})

afterEach(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true })
})

describe('plugin-search getAppData()', () => {
    it('creates search-index.json with expected content', async () => {
        const app = { folders: { assets: ASSETS_DIR } }
        const pagesData = [
            {
                meta: {
                    title: 'Search Page',
                    href: '/search',
                    excerpt: 'Test description'
                },
                content: '<p>This is the <em>main</em> content</p>'
            }
        ]

        const resultApp = await getAppData({ app, pagesData })

        const exists = fssync.existsSync(SEARCH_JSON)
        expect(exists).toBe(true)

        const json = JSON.parse(await fs.readFile(SEARCH_JSON, 'utf-8'))
        expect(Array.isArray(json)).toBe(true)
        expect(json[0].title).toBe('Search Page')
        expect(json[0].content).toContain('This is the main content')

        expect(resultApp.searchIndexPath).toBe('/search-index.json')
    })

    it('copies search.js from views to assets/js', async () => {
        const app = { folders: { assets: ASSETS_DIR } }
        const pagesData = []

        await getAppData({ app, pagesData })

        // Check existence
        expect(fssync.existsSync(SEARCH_JS)).toBe(true)

        // Compare with source file content
        const expected = await fs.readFile(SOURCE_JS, 'utf-8')
        const actual = await fs.readFile(SEARCH_JS, 'utf-8')

        expect(actual.trim()).toBe(expected.trim())
    })

    it('does not overwrite other files in js folder', async () => {
    // Simulate user file
        const otherFilePath = path.join(JS_DIR, 'user-script.js')
        await fs.mkdir(JS_DIR, { recursive: true })
        await fs.writeFile(otherFilePath, '// user script')

        const app = { folders: { assets: ASSETS_DIR } }
        await getAppData({ app, pagesData: [] })

        // Check that user-script.js still exists and is untouched
        const userContent = await fs.readFile(otherFilePath, 'utf-8')
        expect(userContent).toBe('// user script')

        // Also check that search.js was created
        const searchContent = await fs.readFile(SEARCH_JS, 'utf-8')
        expect(searchContent.length).toBeGreaterThan(10)
    })
})
