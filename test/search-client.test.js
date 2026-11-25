import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import pug from 'pug'
import { Window } from 'happy-dom'

// The shipped client is a plain browser script, not a module. It is run with
// `document`, `fetch` and `DOMParser` passed in as parameters so each test gets its own
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

const runClient = async (html, entries = index) => {
    const window = new Window()
    const { document } = window
    document.body.innerHTML = html

    const requested = []
    const fetchStub = (url) => {
        requested.push(url)

        return Promise.resolve({ json: () => Promise.resolve(entries) })
    }

    new Function('document', 'fetch', 'DOMParser', clientSource)(
        document,
        fetchStub,
        window.DOMParser
    )
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

    // Pinned before the escaping went in: a plain title and snippet must come
    // out exactly as 2.3.1 built them.
    it('renders an ordinary result exactly as before', async () => {
        const { document } = await runClient(markup())

        type(document, 'install')

        const html = document.querySelector('[data-search__results]').innerHTML
        expect(html.replace(/\s+/g, ' ').trim()).toBe(
            '<li class="search__item"> ' +
            '<a class="search__link" href="/start">Getting started</a> ' +
            '<p class="search__description">...<span class="search__highlight">Install</span> Nera first...</p> ' +
            '</li>'
        )
    })

    // Until 2.4.0 the snippet was stored on the index entry and searched by
    // the next query, so a query for the highlight markup itself matched.
    it('does not match the markup of an earlier snippet', async () => {
        const { document } = await runClient(markup())

        type(document, 'install')
        type(document, 'highlight')

        expect(
            document.querySelectorAll('[data-search__results] .search__item')
        ).toHaveLength(0)
    })

    it('skips an input whose results list does not exist', async () => {
        const { requested } = await runClient(
            '<input data-search-input data-results="[data-missing]">'
        )

        expect(requested).toEqual([])
    })
})

const resultItems = (document) =>
    document.querySelectorAll('[data-search__results] .search__item')

const emptyStates = (document) => document.querySelectorAll('.search__empty')

describe('no-results message', () => {
    it('shows one .search__empty with the attribute text after the list', async () => {
        const { document } = await runClient(
            markup('data-search-empty="Keine Treffer"')
        )

        type(document, 'zzz')

        const states = emptyStates(document)
        expect(states).toHaveLength(1)
        expect(states[0].tagName).toBe('P')
        expect(states[0].hidden).toBe(false)
        expect(states[0].textContent).toBe('Keine Treffer')
        expect(
            document.querySelector('[data-search__results]').nextElementSibling
        ).toBe(states[0])
        expect(resultItems(document)).toHaveLength(0)
    })

    it('falls back to "No results" without the attribute', async () => {
        const { document } = await runClient(markup())

        type(document, 'zzz')

        expect(emptyStates(document)[0].textContent).toBe('No results')
        expect(emptyStates(document)[0].hidden).toBe(false)
    })

    // A live region announces a text change only when it is already in the
    // DOM, so the element exists, empty, before the first query.
    it('exists as an empty, hidden role="status" before the first query', async () => {
        const { document } = await runClient(markup())

        const states = emptyStates(document)
        expect(states).toHaveLength(1)
        expect(states[0].hidden).toBe(true)
        expect(states[0].getAttribute('role')).toBe('status')
        expect(states[0].textContent).toBe('')
    })

    it('clears its text when hidden by a match or an empty query', async () => {
        const { document } = await runClient(
            markup('data-search-empty="Keine Treffer"')
        )
        const state = () => emptyStates(document)[0]

        type(document, 'zzz')
        expect(state().textContent).toBe('Keine Treffer')

        type(document, 'install')
        expect(state().hidden).toBe(true)
        expect(state().textContent).toBe('')

        type(document, 'zzz')
        expect(state().textContent).toBe('Keine Treffer')

        type(document, '')
        expect(state().hidden).toBe(true)
        expect(state().textContent).toBe('')
        expect(emptyStates(document)).toHaveLength(1)
        expect(state().getAttribute('role')).toBe('status')
    })

    it('hides again for an empty query and for a later match', async () => {
        const { document } = await runClient(markup())
        const state = () => emptyStates(document)[0]

        type(document, 'zzz')
        type(document, '')
        expect(state().hidden).toBe(true)

        type(document, 'zzz')
        type(document, 'install')
        expect(state().hidden).toBe(true)
        expect(resultItems(document)).toHaveLength(1)
    })

    it('never adds a second element on repeated no-match queries', async () => {
        const { document } = await runClient(markup())

        for (const query of ['zzz', 'zzzz', '', 'qqq', 'install', 'xyz']) {
            type(document, query)
        }

        expect(emptyStates(document)).toHaveLength(1)
        expect(emptyStates(document)[0].hidden).toBe(false)
    })

    it('leaves the results list itself empty', async () => {
        const { document } = await runClient(markup())

        type(document, 'zzz')

        expect(
            document.querySelector('[data-search__results]').innerHTML
        ).toBe('')
    })

    it('sets the text as text, not as HTML', async () => {
        const { document } = await runClient(
            markup('data-search-empty="&lt;b&gt;none&lt;/b&gt;"')
        )

        type(document, 'zzz')

        const state = emptyStates(document)[0]
        expect(state.textContent).toBe('<b>none</b>')
        expect(state.querySelector('b')).toBe(null)
    })

    it('gives each input its own element', async () => {
        const { document } = await runClient(`
            <input data-search-input data-results="[data-a]">
            <ul data-a></ul>
            <input data-search-input data-results="[data-b]">
            <ul data-b></ul>
        `)

        expect(emptyStates(document)).toHaveLength(2)
        expect(document.querySelector('[data-a]').nextElementSibling.className)
            .toBe('search__empty')
        expect(document.querySelector('[data-b]').nextElementSibling.className)
            .toBe('search__empty')
    })
})

describe('query and index text are literal', () => {
    const highlights = (document) => [
        ...document.querySelectorAll('[data-search__results] .search__highlight')
    ].map((node) => node.textContent)

    for (const char of ['(', '[', '*', '+', '?', '.', '\\', '$', '|']) {
        it(`highlights ${char} literally and keeps responding`, async () => {
            const { document } = await runClient(markup(), [
                { title: 'Syntax', href: '/syntax', content: `a ${char} b` },
                ...index
            ])

            expect(() => type(document, char)).not.toThrow()
            expect(resultItems(document)).toHaveLength(1)
            expect(highlights(document)).toEqual([char])

            type(document, 'install')
            expect(resultItems(document)).toHaveLength(1)
            expect(
                document.querySelector('.search__link').getAttribute('href')
            ).toBe('/start')
        })
    }

    it('escapes the title, href and excerpt', async () => {
        const { document } = await runClient(markup(), [{
            title: 'A <b> & "C"',
            href: '/a"b',
            excerpt: 'x < y <img src=x>',
            content: 'needle'
        }])

        type(document, 'needle')

        const link = document.querySelector('.search__link')
        expect(link.textContent).toBe('A <b> & "C"')
        expect(link.querySelector('b')).toBe(null)
        expect(link.getAttribute('href')).toBe('/a"b')

        const desc = document.querySelector('.search__description')
        expect(desc.textContent).toBe('x < y <img src=x>')
        expect(desc.querySelector('img')).toBe(null)
    })

    it('escapes the description field too', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            description: '<i>raw</i>',
            content: 'needle'
        }])

        type(document, 'needle')

        const desc = document.querySelector('.search__description')
        expect(desc.textContent).toBe('<i>raw</i>')
        expect(desc.querySelector('i')).toBe(null)
    })

    // `content` is what the plugin really indexes: markdown-it output with
    // the tags stripped and the entities kept.
    it('shows the entities of the indexed content as characters', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: 'It&#39;s: find (pages) &amp; things. Say &quot;hi&quot; &lt;b&gt;'
        }])

        type(document, 'pages')

        const desc = document.querySelector('.search__description')
        expect(desc.textContent).toBe(
            '...It\'s: find (pages) & things. Say "hi" <b>...'
        )
        expect(desc.querySelector('b')).toBe(null)
        expect(highlights(document)).toEqual(['pages'])
    })

    it('matches & against the encoded content and highlights it once', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: 'salt &amp; pepper'
        }])

        type(document, '&')

        const desc = document.querySelector('.search__description')
        expect(highlights(document)).toEqual(['&'])
        expect(desc.textContent).toBe('...salt & pepper...')
        // Escaping before the split would leave `&amp;` as visible text.
        expect(desc.innerHTML).toContain(
            '<span class="search__highlight">&amp;</span>'
        )
        expect(desc.innerHTML).not.toContain('&amp;amp;')
    })

    it('does not match the entity names themselves', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: 'salt &amp; pepper'
        }])

        type(document, 'amp')

        expect(resultItems(document)).toHaveLength(0)
    })

    // `strip_html: false` indexes raw HTML: it shows as text without its tags.
    it('renders raw-HTML content as text without its tags', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: '<p>x &amp; <em>needle</em></p> <script>alert(1)</script>'
        }])

        type(document, 'needle')

        const desc = document.querySelector('.search__description')
        expect(desc.textContent).toBe('...x & needle alert(1)...')
        expect(desc.querySelector('em')).toBe(null)
        expect(desc.querySelector('script')).toBe(null)
        expect(highlights(document)).toEqual(['needle'])
    })

    it('puts a space between the blocks of raw-HTML content', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: '<p>a</p><p>b</p>\n<ul><li>needle</li></ul>'
        }])

        type(document, 'needle')

        expect(document.querySelector('.search__description').textContent)
            .toBe('...a b needle...')
    })

    it('does not match across two raw-HTML blocks', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: '<p>a</p><p>b</p>'
        }])

        type(document, 'ab')
        expect(resultItems(document)).toHaveLength(0)

        type(document, 'a b')
        expect(resultItems(document)).toHaveLength(1)
    })

    // Default mode indexes one text node per page: its inner whitespace is
    // kept as it was, not collapsed, so matching works exactly as before.
    it('decodes entity-encoded content exactly as before', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: 'salt  &amp;\npepper &lt;b&gt;'
        }])

        type(document, 'salt')

        expect(document.querySelector('.search__description').textContent)
            .toBe('...salt & pepper <b>...')

        type(document, 'salt  &')
        expect(resultItems(document)).toHaveLength(1)
    })

    it('does not match the tag names of raw-HTML content', async () => {
        const { document } = await runClient(markup(), [{
            title: 'T',
            href: '/t',
            content: '<em>needle</em>'
        }])

        type(document, 'em')

        expect(resultItems(document)).toHaveLength(0)
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

    const scriptTag = '<script src="/js/search.js"></script>'

    it('renders the script by default', () => {
        for (const locals of [
            {},
            { app: {} },
            { app: { searchIncludeScript: true } }
        ]) {
            const html = renderTemplate(locals)

            expect(html).toContain(scriptTag)
        }
    })

    it('leaves out the script with app.searchIncludeScript false', () => {
        const html = renderTemplate({ app: { searchIncludeScript: false } })

        expect(html).not.toContain('<script')
        expect(html).toContain('class="search__input"')
        expect(html).toContain('class="search__results"')
    })

    it('passes the no-results text to the client', () => {
        expect(renderTemplate({ app: {} }))
            .toContain('data-search-empty="No results"')
        expect(renderTemplate({ app: {}, t: coreT({}) }))
            .toContain('data-search-empty="No results"')
        expect(renderTemplate({ app: {}, t: () => ' ' }))
            .toContain('data-search-empty="No results"')
        expect(renderTemplate({
            app: {},
            t: coreT({ search_no_results: 'Keine Treffer' })
        })).toContain('data-search-empty="Keine Treffer"')
    })

    // Rendered from the 2.3.1 template (`git show v2.3.1:views/search.pug`)
    // with `{ app: {} }`, so the comparison is against the released markup,
    // not against a string written from the new template. The one
    // difference is the additive `data-search-empty` attribute of 2.4.0.
    it('renders like 2.3.1 plus data-search-empty without the option', () => {
        const released = fs.readFileSync(
            path.resolve('test/fixtures/search-2.3.1.html'),
            'utf-8'
        )
        const resultsAttribute = 'data-results="[data-search__results]"'
        expect(released).toContain(resultsAttribute)
        const expected = released.replace(
            resultsAttribute,
            `${resultsAttribute} data-search-empty="No results"`
        )

        expect(renderTemplate({ app: {} })).toBe(expected)
        expect(renderTemplate({ app: { searchIncludeScript: true } })).toBe(
            expected
        )
    })
})
