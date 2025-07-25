import path from 'path'
import fs from 'fs/promises'
import { getConfig } from '@nera-static/plugin-utils'
import { fileURLToPath } from 'url'

const CONFIG_PATH = path.resolve(process.cwd(), 'config/search.yaml')

function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export async function getAppData({ app, pagesData }) {
    const config = getConfig(CONFIG_PATH)
    const filename = config.output_filename || 'search-index.json'
    const outputPath = path.join(app.folders.assets, filename)

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

    fs.writeFile(outputPath, JSON.stringify(index, null, 2), 'utf-8')

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const sourceJS = path.join(__dirname, 'views', 'search.js')
    const targetJS = path.join(app.folders.assets, 'js', 'search.js')
    await fs.mkdir(path.dirname(targetJS), { recursive: true })
    await fs.copyFile(sourceJS, targetJS)

    return {
        ...app,
        searchIndexPath: `/${filename}`
    }
}
