import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { getAppData } from '../index.js'

let cwd
let originalCwd

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

const readIndex = (file = 'search-index.json') =>
    JSON.parse(fs.readFileSync(path.join(cwd, 'assets', file), 'utf-8'))

const writeConfig = (yaml) => {
    fs.mkdirSync(path.join(cwd, 'config'), { recursive: true })
    fs.writeFileSync(path.join(cwd, 'config/search.yaml'), yaml, 'utf-8')
}

// Every test runs in its own temp cwd: the plugin reads config from
// process.cwd() and writes the index relative to it, so running in the repo
// would both pick up the shipped config and litter the working tree.
beforeEach(() => {
    originalCwd = process.cwd()
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nera-search-'))
    process.chdir(cwd)
})

afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(cwd, { recursive: true, force: true })
})

describe('plugin-search getAppData()', () => {
    it('creates search-index.json with expected content', () => {
        const app = { folders: { assets: './assets' } }

        const resultApp = getAppData({ app, pagesData })

        const json = readIndex()
        expect(Array.isArray(json)).toBe(true)
        expect(json[0].title).toBe('Search Page')
        expect(json[0].content).toContain('This is the main content')

        expect(resultApp.searchIndexPath).toBe('/search-index.json')
    })

    // Regression: the generator did not await plugin hooks before 4.3.0, and
    // that fix never reaches already-cloned sites. An async hook there returns
    // a Promise that replaces `app` wholesale, wiping every app.* value.
    it('is synchronous — returns a plain object, not a thenable', () => {
        const app = { lang: 'en', folders: { assets: './assets' } }

        const result = getAppData({ app, pagesData })

        expect(typeof result.then).not.toBe('function')
        expect(result.lang).toBe('en')
    })

    it('preserves existing app values for later plugins', () => {
        const app = {
            lang: 'en',
            translations: { en: { greeting: 'Hello' } },
            folders: { assets: './assets' }
        }

        const result = getAppData({ app, pagesData })

        expect({ ...result, added: true }).toMatchObject({
            lang: 'en',
            translations: { en: { greeting: 'Hello' } },
            added: true
        })
    })

    it('falls back to ./assets when folders.assets is missing', () => {
        const app = { folders: { dist: './public' } }

        expect(() => getAppData({ app, pagesData })).not.toThrow()
        expect(readIndex()[0].title).toBe('Search Page')
    })

    it('falls back to ./assets when app has no folders at all', () => {
        expect(() => getAppData({ app: {}, pagesData })).not.toThrow()
        expect(readIndex()[0].title).toBe('Search Page')
    })

    it('reads config/search.yaml from the site root', () => {
        writeConfig('fields:\n  - title\n')

        getAppData({ app: { folders: { assets: './assets' } }, pagesData })

        const entry = readIndex()[0]
        expect(entry.title).toBe('Search Page')
        expect(entry).not.toHaveProperty('excerpt')
        expect(entry).not.toHaveProperty('content')
    })

    it('honours a custom output_filename', () => {
        writeConfig('output_filename: custom-index.json\n')

        const result = getAppData({
            app: { folders: { assets: './assets' } },
            pagesData
        })

        expect(readIndex('custom-index.json')[0].title).toBe('Search Page')
        expect(result.searchIndexPath).toBe('/custom-index.json')
    })

    it('keeps raw HTML when strip_html is false', () => {
        writeConfig('strip_html: false\n')

        getAppData({ app: { folders: { assets: './assets' } }, pagesData })

        expect(readIndex()[0].content).toBe(
            '<p>This is the <em>main</em> content</p>'
        )
    })
})
