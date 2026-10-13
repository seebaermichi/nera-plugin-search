import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import pug from 'pug'
import { Window } from 'happy-dom'

// The shipped client is a plain browser script, not a module. It is run with
// `document` and `fetch` passed in as parameters so each test gets its own
// window and its own request log, instead of sharing one global document.
const clientSource = fs.readFileSync(
    path.resolve('views/search.js'),
    'utf-8'
)

const renderTemplate = (locals) =>
    pug.renderFile(path.resolve('views/search.pug'), locals)

const index = [
    { title: 'Getting started', href: '/start', content: 'Install Nera first' },
    { title: 'Erste Schritte', href: '/de/start', content: 'Zuerst Nera einrichten' }
]

const runClient = async (html) => {
    const window = new Window()
    const { document } = window
    document.body.innerHTML = html

    const requested = []
    const fetchStub = (url) => {
        requested.push(url)

        return Promise.resolve({ json: () => Promise.resolve(index) })
    }

    new Function('document', 'fetch', clientSource)(document, fetchStub)
    document.dispatchEvent(new window.Event('DOMContentLoaded'))

    // Let the fetch chain settle before anything is asserted.
    await new Promise(resolve => setTimeout(resolve, 0))

    return { window, document, requested }
}

const type = (document, query) => {
    const input = document.querySelector('[data-search-input]')
    input.value = query
    input.dispatchEvent(new document.defaultView.Event('input'))
}

const markup = (attributes = '') => `
    <input class="search__input" type="search" data-search-input
        data-results="[data-search__results]" ${attributes}>
    <ul class="search__results" data-search__results></ul>
`

describe('shipped search.js client', () => {
    it('loads the index URL the template passed in', async () => {
        const { requested } = await runClient(
            markup('data-search-index="/search-index.de.json"')
        )

        expect(requested).toEqual(['/search-index.de.json'])
    })

    // A site that upgrades the package without re-publishing templates keeps
    // its old `search.pug`, which emits no `data-search-index`. It must still
    // find the default index rather than fetching `undefined`.
    it('falls back to /search-index.json without the data attribute', async () => {
        const { requested } = await runClient(markup())

        expect(requested).toEqual(['/search-index.json'])
    })

    it('renders matching entries and ignores the rest', async () => {
        const { document } = await runClient(markup())

        type(document, 'install')

        const results = document.querySelector('[data-search__results]')
        expect(results.innerHTML).toContain('/start')
        expect(results.innerHTML).not.toContain('/de/start')
    })

    it('clears results when the query is emptied', async () => {
        const { document } = await runClient(markup())

        type(document, 'install')
        type(document, '')

        expect(
            document.querySelector('[data-search__results]').innerHTML
        ).toBe('')
    })

    // The class names below are the plugin's public contract: sites style them
    // from their own CSS. Until 2.0.0 the client emitted `list-none`, two empty
    // class attributes and a `bg-yellow-100` highlight — none of them the BEM
    // names the README had documented since 1.0.0.
    it('emits the documented BEM classes on every result', async () => {
        const { document } = await runClient(markup())

        type(document, 'install')

        const results = document.querySelector('[data-search__results]')
        expect(results.querySelectorAll('.search__item')).toHaveLength(1)
        expect(results.querySelector('.search__link').getAttribute('href'))
            .toBe('/start')
        expect(results.querySelector('.search__description')).not.toBe(null)
    })

    it('wraps the matched term in .search__highlight', async () => {
        const { document } = await runClient(markup())

        type(document, 'install')

        const highlight = document
            .querySelector('[data-search__results]')
            .querySelector('.search__highlight')

        expect(highlight).not.toBe(null)
        expect(highlight.textContent.toLowerCase()).toBe('install')
    })

    it('emits no unstyleable or framework class names', async () => {
        const { document } = await runClient(markup())

        type(document, 'install')

        const html = document.querySelector('[data-search__results]').innerHTML
        expect(html).not.toContain('list-none')
        expect(html).not.toContain('bg-yellow-100')
        expect(html).not.toContain('class=""')
    })

    it('skips an input whose results list does not exist', async () => {
        const { requested } = await runClient(
            '<input data-search-input data-results="[data-missing]">'
        )

        expect(requested).toEqual([])
    })
})

describe('shipped search.pug template', () => {
    it('passes app.searchIndexPath to the client', () => {
        const html = renderTemplate({
            app: { searchIndexPath: '/custom-index.json' }
        })

        expect(html).toContain('data-search-index="/custom-index.json"')
    })

    it('prefers the page language index over the site-wide one', () => {
        const html = renderTemplate({
            app: { searchIndexPath: '/search-index.json' },
            meta: { searchIndexPath: '/search-index.de.json' }
        })

        expect(html).toContain('data-search-index="/search-index.de.json"')
    })

    it('falls back to app.searchIndexPath when the page has none', () => {
        const html = renderTemplate({
            app: { searchIndexPath: '/search-index.json' },
            meta: { title: 'Search' }
        })

        expect(html).toContain('data-search-index="/search-index.json"')
    })

    it('omits the attribute when no index path is available', () => {
        const html = renderTemplate({ app: {} })

        expect(html).not.toContain('data-search-index')
        expect(html).toContain('data-search-input')
    })

    // Core builds `t` per page and returns the key itself when the site has
    // no translation for it.
    const coreT = (translations) => (key) => translations[key] || key

    // The check `a11y-form-label` in @nera-static/validate runs: a non-empty
    // aria-label, aria-labelledby, a <label for> matching the id, or a
    // wrapping <label>.
    const accessibleName = (html) => {
        const { document } = new Window()
        document.body.innerHTML = html
        const input = document.querySelector('input.search__input')

        const ariaLabel = (input.getAttribute('aria-label') || '').trim()
        if (ariaLabel) return ariaLabel

        if (input.getAttribute('aria-labelledby')) {
            return input.getAttribute('aria-labelledby')
        }

        const id = input.getAttribute('id')
        const forLabel = id && document.querySelector(`label[for="${id}"]`)
        if (forLabel) return forLabel.textContent.trim()

        return input.closest('label')?.textContent.trim() || ''
    }

    it('names the input "Search" when no t() is passed', () => {
        const html = renderTemplate({ app: {} })

        expect(html).toContain('aria-label="Search"')
        expect(accessibleName(html)).toBe('Search')
    })

    it('falls back to "Search" when t() has no search_label', () => {
        const html = renderTemplate({ app: {}, t: coreT({}) })

        expect(html).toContain('aria-label="Search"')
        expect(html).not.toContain('search_label')
    })

    it('falls back to "Search" when the translation is empty', () => {
        const html = renderTemplate({ app: {}, t: () => '' })

        expect(accessibleName(html)).toBe('Search')
    })

    it('names the input from t(\'search_label\')', () => {
        const html = renderTemplate({
            app: {},
            t: coreT({ search_label: 'Suche' })
        })

        expect(html).toContain('aria-label="Suche"')
        expect(accessibleName(html)).toBe('Suche')
    })

    it('translates the title and placeholder through t()', () => {
        const html = renderTemplate({
            app: {},
            t: coreT({ search_title: 'Suche', search_placeholder: 'Suchen …' })
        })

        expect(html).toContain('<h1 class="search__title">Suche</h1>')
        expect(html).toContain('placeholder="Suchen …"')
    })

    it('keeps the English title and placeholder without translations', () => {
        const html = renderTemplate({ app: {}, t: coreT({}) })

        expect(html).toContain('<h1 class="search__title">Search</h1>')
        expect(html).toContain('placeholder="Search..."')
        expect(html).not.toContain('search_title')
        expect(html).not.toContain('search_placeholder')
    })

    it('keeps every other input attribute', () => {
        const { document } = new Window()
        document.body.innerHTML = renderTemplate({
            app: { searchIndexPath: '/search-index.json' }
        })
        const input = document.querySelector('input.search__input')

        expect(input.getAttribute('type')).toBe('search')
        expect(input.getAttribute('placeholder')).toBe('Search...')
        expect(input.hasAttribute('data-search-input')).toBe(true)
        expect(input.getAttribute('data-search-index')).toBe('/search-index.json')
        expect(input.getAttribute('data-results')).toBe('[data-search__results]')
    })

    it('renders h1.search__title by default', () => {
        for (const locals of [{}, { app: {} }, { app: { searchShowTitle: true } }]) {
            const html = renderTemplate(locals)

            expect(html).toContain('<h1 class="search__title">Search</h1>')
        }
    })

    it('leaves out the h1 with app.searchShowTitle false', () => {
        const html = renderTemplate({ app: { searchShowTitle: false } })

        expect(html).not.toContain('<h1')
        expect(html).not.toContain('search__title')
        expect(html).toContain('class="search__input"')
        expect(html).toContain('class="search__results"')
    })
})
