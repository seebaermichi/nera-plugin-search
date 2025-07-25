import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs/promises'
import fssync from 'fs'
import { fileURLToPath } from 'url'
import { getAppData } from '../index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, '.tmp-test-search-plugin')
const ASSETS_DIR = path.join(TMP_DIR, 'assets')
const SEARCH_JSON = path.join(ASSETS_DIR, 'search-index.json')

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
})
