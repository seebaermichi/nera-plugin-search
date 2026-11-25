// The index URL comes from the template (`data-search-index`), which knows the
// configured `output_filename`. The literal below is only a fallback for a
// page whose template predates that attribute.
const DEFAULT_SEARCH_INDEX = '/search-index.json'

// The no-results text comes from the template (`data-search-empty`), which
// translates it through the site's `t()`. The literal is the fallback for a
// page whose template predates that attribute.
const DEFAULT_EMPTY_TEXT = 'No results'

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;'
}

// Index values are page text, not markup: a title like `A <b> & "C"` must
// render as written, and an href must not close its attribute.
const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])

// The index stores `content` as markdown-it output with only the tags
// stripped, so its entities (`&amp;`, `&lt;`, `&quot;`, `&#39;`) are still
// encoded, and with `strip_html: false` it is raw HTML. Parse it once into
// plain text, so it matches and escapes like every other field. A parsed
// document runs no scripts and loads no images. The index itself stays as it
// is: an older vendored client puts `content` into innerHTML, where decoded
// `<…>` would render as markup.
const parser = new DOMParser()

const TEXT_NODE = 3

const textNodes = (node) => node.nodeType === TEXT_NODE
    ? [node.nodeValue]
    : [...node.childNodes].flatMap(textNodes)

// Default-mode content parses into one text node and decodes exactly as
// `textContent` would. Raw HTML parses into several, which `textContent`
// would glue together (`<p>a</p><p>b</p>` → `ab`), so a query could match
// across two blocks: join them with a space and collapse the whitespace.
const toText = (html) => {
    const parts = textNodes(parser.parseFromString(html, 'text/html').body)

    return parts.length === 1
        ? parts[0]
        : parts.join(' ').replace(/\s+/g, ' ').trim()
}

const decodeContent = (item) => typeof item.content === 'string'
    ? { ...item, content: toText(item.content) }
    : item

// The query is literal text, so `(`, `[`, `*` and friends must not reach the
// RegExp as syntax.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Split the raw snippet on the query first and escape each piece afterwards,
// so a query like `&` still matches its raw character. With a capture group
// in the pattern, `split` puts every match at an odd index.
const highlight = (snippet, query) =>
    snippet
        .split(new RegExp(`(${escapeRegExp(query)})`, 'ig'))
        .map((piece, index) => index % 2
            ? `<span class="search__highlight">${escapeHtml(piece)}</span>`
            : escapeHtml(piece))
        .join('')

// The snippet of the first string value that contains the query, as escaped
// HTML with the match highlighted, or null when nothing matches.
const findSnippet = (item, query) => {
    for (const val of Object.values(item)) {
        if (typeof val !== 'string' || !val.toLowerCase().includes(query)) {
            continue
        }

        const words = val.split(/\s+/)
        const matchWordIndex = words.findIndex(word => word.toLowerCase().includes(query))

        const snippetStart = Math.max(0, matchWordIndex - 5)
        const snippetEnd = Math.min(words.length, matchWordIndex + 6)
        const snippet = words.slice(snippetStart, snippetEnd).join(' ')

        return `...${highlight(snippet, query)}...`
    }

    return null
}

document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('[data-search-input]')

    inputs.forEach((input) => {
        const resultSelector = input.getAttribute('data-results')
        const resultList = document.querySelector(resultSelector)
        if (!resultList) return

        const emptyText = input.dataset.searchEmpty || DEFAULT_EMPTY_TEXT

        fetch(input.dataset.searchIndex || DEFAULT_SEARCH_INDEX)
            .then((res) => res.json())
            .then((entries) => {
                const data = entries.map(decodeContent)

                // One empty-state element per input, created once the index
                // has loaded and before any query, so the live region is in
                // the DOM before its text first changes. It sits after the
                // list rather than in it: it is not a result, and
                // `.search__results:empty` keeps matching. Its text is set
                // when it is shown and cleared when it is hidden, so a screen
                // reader announces a miss that follows a match or an empty
                // query.
                const empty = document.createElement('p')
                empty.className = 'search__empty'
                empty.setAttribute('role', 'status')
                empty.hidden = true
                resultList.after(empty)

                const showEmpty = (show) => {
                    empty.hidden = !show
                    empty.textContent = show ? emptyText : ''
                }

                input.addEventListener('input', () => {
                    const query = input.value.toLowerCase()

                    if (!query) {
                        resultList.innerHTML = ''
                        showEmpty(false)
                        return
                    }

                    const results = data
                        .map((item) => ({ item, snippet: findSnippet(item, query) }))
                        .filter(({ snippet }) => snippet !== null)

                    resultList.innerHTML = results.map(({ item, snippet }) => {
                        const title = escapeHtml(item.title || item.href || 'Untitled')
                        const text = item.excerpt || item.description
                        const desc = text ? escapeHtml(text) : snippet
                        // BEM throughout, matching the block the template emits.
                        // These names are a public contract — sites style them
                        // from their own CSS, so renaming one is a major.
                        return `
                            <li class="search__item">
                                <a class="search__link" href="${escapeHtml(item.href)}">${title}</a>
                                ${desc ? `<p class="search__description">${desc}</p>` : ''}
                            </li>
                    `
                    }).join('')

                    showEmpty(results.length === 0)
                })
            })
    })
})
