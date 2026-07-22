import path from 'path'
import fs from 'fs'
import { getConfig } from '@nera-static/plugin-utils'

const DEFAULT_ASSETS_FOLDER = './assets'
const DEFAULT_OUTPUT_FILENAME = 'search-index.json'
const DEFAULT_FIELDS = ['title', 'excerpt', 'content', 'href']

function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Read per call rather than at module scope: `process.cwd()` is captured at
// import time otherwise, which is both untestable and wrong for any host that
// changes directory between import and render.
function loadConfig() {
    const config = getConfig(path.resolve(process.cwd(), 'config/search.yaml'))

    return {
        fields: config.fields || DEFAULT_FIELDS,
        stripHtml: config.strip_html ?? true,
        outputFilename: config.output_filename || DEFAULT_OUTPUT_FILENAME,
        // Opt-in: off means one index built from every page, exactly as before.
        groupByLang: config.group_by_lang === true
    }
}

// The language every page without an explicit `meta.lang` belongs to, and the
// one whose index stays at the unsuffixed filename.
function getDefaultLang(app) {
    const lang = typeof app?.lang === 'string' ? app.lang.trim() : ''

    return lang || 'en'
}

/**
 * The language a page's content is indexed under.
 *
 * Pages without `meta.lang` fall into the site's default language rather than
 * an index of their own, so a single-language site — where nothing sets
 * `lang` at all — keeps producing exactly one index.
 */
function getPageLang(meta, defaultLang) {
    const lang = typeof meta?.lang === 'string' ? meta.lang.trim() : ''

    return lang || defaultLang
}

/**
 * The index filename for one language.
 *
 * The language code is inserted before the final extension, and appended when
 * there is none — `search-index.json` → `search-index.de.json`, `searchdata` →
 * `searchdata.de`. The default language keeps the configured filename
 * untouched: that is what lets a site whose templates still point at
 * `/search-index.json` degrade to "search works, in the default language"
 * instead of 404ing its index.
 */
function getIndexFilenameForLang(lang, options) {
    const { outputFilename, groupByLang, defaultLang } = options

    if (!groupByLang || lang === defaultLang) return outputFilename

    // posix throughout: the filename doubles as the public URL, so a backslash
    // separator on Windows would produce an unfetchable path.
    const { dir, name, ext } = path.posix.parse(outputFilename)

    return path.posix.join(dir, `${name}.${lang}${ext}`)
}

/**
 * The pages the generator will actually render.
 *
 * `render.js` writes HTML only for pages whose frontmatter defines `layout`,
 * and plugins run before it — so an unfiltered index lists pages that never
 * exist. Two consequences, both silent: every result for such a page 404s, and
 * the full body text of a layout-less page (the usual idiom for a draft) is
 * published verbatim in a JSON file that *is* copied into `public/`.
 */
function getIndexablePages(pagesData) {
    return pagesData.filter(page => Boolean(page?.meta?.layout))
}

/**
 * Groups pages by the language their content is indexed under.
 *
 * With grouping off every page lands under the default language, so the
 * single-index behaviour is this same code with one group.
 *
 * @returns {Map<string, Array>} - language → its pages, alphabetical by
 *   language so output does not depend on the order pages were read in
 */
function getPagesByLang(pagesData, options) {
    const byLang = new Map()

    getIndexablePages(pagesData).forEach(page => {
        const lang = options.groupByLang
            ? getPageLang(page.meta, options.defaultLang)
            : options.defaultLang

        if (!byLang.has(lang)) byLang.set(lang, [])

        byLang.get(lang).push(page)
    })

    return new Map([...byLang.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function buildIndex(pages, lang, options) {
    const { fields, stripHtml: strip, groupByLang } = options

    return pages.map(({ meta, content }) => {
        const item = {}

        for (const field of fields) {
            if (field === 'content') {
                item.content = strip ? stripHtml(content) : content
            } else if (meta[field]) {
                item[field] = meta[field]
            }
        }

        // Only when grouping: with one index this would be the same value on
        // every entry, and it would change output that is otherwise byte for
        // byte what it has always been. Set last so the resolved language wins
        // over a `lang` listed in `fields`.
        if (groupByLang) item.lang = lang

        return item
    })
}

// Must stay synchronous. The generator only started awaiting plugin hooks in
// 4.3.0, and that fix never reaches already-cloned sites — an async hook there
// replaces `app` with a Promise, silently wiping every `app.*` value for each
// plugin that runs later. Writing N files instead of one is not a reason to
// reach for `fs.promises`.
export function getAppData({ app, pagesData }) {
    const options = { ...loadConfig(), defaultLang: getDefaultLang(app) }
    const assetsFolder = app?.folders?.assets || DEFAULT_ASSETS_FOLDER
    const searchIndexPaths = {}

    getPagesByLang(pagesData, options).forEach((pages, lang) => {
        const filename = getIndexFilenameForLang(lang, options)
        const outputPath = path.join(assetsFolder, filename)

        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(
            outputPath,
            JSON.stringify(buildIndex(pages, lang, options), null, 2),
            'utf-8'
        )

        searchIndexPaths[lang] = `/${filename}`
    })

    return {
        ...app,
        // Stays the string it has always been, pointing at the default
        // language's index, so a template that never learned about languages
        // keeps loading something coherent.
        searchIndexPath: `/${getIndexFilenameForLang(
            options.defaultLang,
            options
        )}`,
        // Present in both modes; with grouping off it holds the single index
        // under the default language's key.
        searchIndexPaths
    }
}

// Adds the index URL for each page's own language, so the shipped template can
// emit `data-search-index` without looking the language up itself. Only when
// grouping: otherwise it would be a per-page copy of `app.searchIndexPath`,
// and the template falls back to that anyway.
export function getMetaData({ app, pagesData }) {
    const options = { ...loadConfig(), defaultLang: getDefaultLang(app) }

    if (!options.groupByLang) return pagesData

    return pagesData.map(({ content, meta }) => ({
        content,
        meta: {
            ...meta,
            searchIndexPath: `/${getIndexFilenameForLang(
                getPageLang(meta, options.defaultLang),
                options
            )}`
        }
    }))
}
