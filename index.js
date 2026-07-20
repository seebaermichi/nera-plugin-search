import path from 'path'
import fs from 'fs'
import { getConfig } from '@nera-static/plugin-utils'

const DEFAULT_ASSETS_FOLDER = './assets'

function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Must stay synchronous. The generator only started awaiting plugin hooks in
// 4.3.0, and that fix never reaches already-cloned sites — an async hook there
// replaces `app` with a Promise, silently wiping every `app.*` value for each
// plugin that runs later.
export function getAppData({ app, pagesData }) {
    const config = getConfig(path.resolve(process.cwd(), 'config/search.yaml'))
    const filename = config.output_filename || 'search-index.json'
    const assetsFolder = app?.folders?.assets || DEFAULT_ASSETS_FOLDER
    const outputPath = path.join(assetsFolder, filename)

    const fields = config.fields || ['title', 'excerpt', 'content', 'href']
    const strip = config.strip_html ?? true

    const index = pagesData.map(({ meta, content }) => {
        const item = {}

        for (const field of fields) {
            if (field === 'content') {
                item.content = strip ? stripHtml(content) : content
            } else if (meta[field]) {
                item[field] = meta[field]
            }
        }

        return item
    })

    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8')

    return {
        ...app,
        searchIndexPath: `/${filename}`
    }
}
