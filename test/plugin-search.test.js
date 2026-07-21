import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { getAppData, getMetaData } from '../index.js'

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

    it('exposes the single index under the default language too', () => {
        const result = getAppData({
            app: { lang: 'en', folders: { assets: './assets' } },
            pagesData
        })

        expect(result.searchIndexPaths).toEqual({ en: '/search-index.json' })
    })
})

const app = { lang: 'en', folders: { assets: './assets' } }

const multilingualPages = [
    {
        meta: { title: 'Getting started', href: '/start', lang: 'en' },
        content: '<p>Install Nera</p>'
    },
    {
        meta: { title: 'Erste Schritte', href: '/de/start', lang: 'de' },
        content: '<p>Nera einrichten</p>'
    },
    {
        meta: { title: 'Primeros pasos', href: '/es/start', lang: 'es' },
        content: '<p>Instalar Nera</p>'
    },
    {
        // No `lang` — belongs to the site's default language.
        meta: { title: 'Imprint', href: '/imprint' },
        content: '<p>Legal notice</p>'
    }
]

const listIndexes = () =>
    fs.readdirSync(path.join(cwd, 'assets')).sort()

describe('plugin-search group_by_lang', () => {
    beforeEach(() => {
        writeConfig('group_by_lang: true\n')
    })

    it('writes one index per language, default language unsuffixed', () => {
        getAppData({ app, pagesData: multilingualPages })

        expect(listIndexes()).toEqual([
            'search-index.de.json',
            'search-index.es.json',
            'search-index.json'
        ])
    })

    // The actual bug: a German page's text showing up in English results.
    it('keeps each language out of the other languages indexes', () => {
        getAppData({ app, pagesData: multilingualPages })

        const hrefs = (file) => readIndex(file).map(entry => entry.href)

        expect(hrefs()).toEqual(['/start', '/imprint'])
        expect(hrefs('search-index.de.json')).toEqual(['/de/start'])
        expect(hrefs('search-index.es.json')).toEqual(['/es/start'])
        expect(JSON.stringify(readIndex())).not.toContain('einrichten')
    })

    it('indexes pages without meta.lang under the default language', () => {
        getAppData({ app, pagesData: multilingualPages })

        expect(readIndex().map(entry => entry.title)).toContain('Imprint')
    })

    it('tags every entry with its language', () => {
        getAppData({ app, pagesData: multilingualPages })

        expect(readIndex().map(entry => entry.lang)).toEqual(['en', 'en'])
        expect(readIndex('search-index.de.json')[0].lang).toBe('de')
    })

    it('exposes a path per language and keeps searchIndexPath a string', () => {
        const result = getAppData({ app, pagesData: multilingualPages })

        expect(result.searchIndexPath).toBe('/search-index.json')
        expect(result.searchIndexPaths).toEqual({
            en: '/search-index.json',
            de: '/search-index.de.json',
            es: '/search-index.es.json'
        })
    })

    it('follows app.lang when the default language is not English', () => {
        const result = getAppData({
            app: { lang: 'de', folders: { assets: './assets' } },
            pagesData: multilingualPages
        })

        expect(result.searchIndexPaths).toEqual({
            de: '/search-index.json',
            en: '/search-index.en.json',
            es: '/search-index.es.json'
        })
        // The page without a `lang` follows the default language, whichever
        // one that is.
        expect(readIndex().map(entry => entry.href)).toEqual([
            '/de/start',
            '/imprint'
        ])
        expect(readIndex('search-index.en.json').map(e => e.href)).toEqual([
            '/start'
        ])
    })

    it('inserts the language before the extension of a custom filename', () => {
        writeConfig('group_by_lang: true\noutput_filename: data/pages.json\n')

        const result = getAppData({ app, pagesData: multilingualPages })

        expect(result.searchIndexPaths.de).toBe('/data/pages.de.json')
        expect(
            fs.existsSync(path.join(cwd, 'assets/data/pages.de.json'))
        ).toBe(true)
    })

    it('appends the language when the filename has no extension', () => {
        writeConfig('group_by_lang: true\noutput_filename: searchdata\n')

        const result = getAppData({ app, pagesData: multilingualPages })

        expect(result.searchIndexPaths).toMatchObject({
            en: '/searchdata',
            de: '/searchdata.de'
        })
        expect(listIndexes()).toEqual([
            'searchdata',
            'searchdata.de',
            'searchdata.es'
        ])
    })

    it('writes a single index when no page has a lang', () => {
        getAppData({ app, pagesData })

        expect(listIndexes()).toEqual(['search-index.json'])
    })

    // A site that upgrades the package but keeps its vendored templates and
    // client still requests the hardcoded `/search-index.json`. That URL must
    // stay populated, so such a site degrades to "search works, in the default
    // language" rather than 404ing its index for everyone.
    it('leaves the default language where a stale client looks for it', () => {
        getAppData({ app, pagesData: multilingualPages })

        expect(fs.existsSync(path.join(cwd, 'assets/search-index.json'))).toBe(
            true
        )
        expect(readIndex().map(entry => entry.href)).toEqual([
            '/start',
            '/imprint'
        ])
    })

    it('stays synchronous', () => {
        const result = getAppData({ app, pagesData: multilingualPages })

        expect(typeof result.then).not.toBe('function')
    })
})

// Opting out must be indistinguishable from the version before the feature.
describe('plugin-search group_by_lang disabled', () => {
    it('builds one index from every language, without a lang field', () => {
        getAppData({ app, pagesData: multilingualPages })

        expect(listIndexes()).toEqual(['search-index.json'])
        expect(readIndex().map(entry => entry.href)).toEqual([
            '/start',
            '/de/start',
            '/es/start',
            '/imprint'
        ])
        readIndex().forEach(entry =>
            expect(entry).not.toHaveProperty('lang')
        )
    })

    it('produces the same file with group_by_lang: false written out', () => {
        getAppData({ app, pagesData: multilingualPages })
        const implicit = fs.readFileSync(
            path.join(cwd, 'assets/search-index.json'),
            'utf-8'
        )

        writeConfig('group_by_lang: false\n')
        getAppData({ app, pagesData: multilingualPages })

        expect(
            fs.readFileSync(path.join(cwd, 'assets/search-index.json'), 'utf-8')
        ).toBe(implicit)
    })
})

describe('plugin-search getMetaData()', () => {
    it('returns pagesData untouched when grouping is off', () => {
        const result = getMetaData({ app, pagesData: multilingualPages })

        expect(result).toBe(multilingualPages)
    })

    it('adds each page its own language index path', () => {
        writeConfig('group_by_lang: true\n')

        const result = getMetaData({ app, pagesData: multilingualPages })

        expect(result.map(page => page.meta.searchIndexPath)).toEqual([
            '/search-index.json',
            '/search-index.de.json',
            '/search-index.es.json',
            '/search-index.json'
        ])
        expect(Array.isArray(result)).toBe(true)
        expect(result[0].meta.title).toBe('Getting started')
        expect(result[0].content).toBe('<p>Install Nera</p>')
    })

    it('does not mutate the pages it was given', () => {
        writeConfig('group_by_lang: true\n')

        getMetaData({ app, pagesData: multilingualPages })

        expect(multilingualPages[1].meta).not.toHaveProperty('searchIndexPath')
    })
})
