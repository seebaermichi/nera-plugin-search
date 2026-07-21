// The index URL comes from the template (`data-search-index`), which knows the
// configured `output_filename`. The literal below is only a fallback for a
// page whose template predates that attribute.
const DEFAULT_SEARCH_INDEX = '/search-index.json'

document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('[data-search-input]')

    inputs.forEach((input) => {
        const resultSelector = input.getAttribute('data-results')
        const resultList = document.querySelector(resultSelector)
        if (!resultList) return

        fetch(input.dataset.searchIndex || DEFAULT_SEARCH_INDEX)
            .then((res) => res.json())
            .then((data) => {
                input.addEventListener('input', () => {
                    const query = input.value.toLowerCase()

                    if (!query) {
                        resultList.innerHTML = ''
                        return
                    }

                    const results = data.filter((item) => {
                        return Object.values(item).some(val => {
                            if (typeof val === 'string') {
                                const lowerVal = val.toLowerCase()
                                const matchIndex = lowerVal.indexOf(query)
                                if (matchIndex !== -1) {
                                    const words = val.split(/\s+/)
                                    const matchWordIndex = words.findIndex(word => word.toLowerCase().includes(query))

                                    const snippetStart = Math.max(0, matchWordIndex - 5)
                                    const snippetEnd = Math.min(words.length, matchWordIndex + 6)
                                    const snippet = words.slice(snippetStart, snippetEnd).join(' ')

                                    const highlighted = snippet.replace(
                                        new RegExp(`(${query})`, 'ig'),
                                        '<span class="bg-yellow-100">$1</span>'
                                    )
                                    item.resultText = `...${highlighted}...`
                                    return true
                                }
                            }

                            return false
                        })
                    })

                    resultList.innerHTML = results.map((item) => {
                        const title = item.title || item.href || 'Untitled'
                        const desc = item.excerpt || item.description || item.resultText
                        return `
                            <li class="list-none">
                                <a class="" href="${item.href}">${title}</a>
                                ${desc ? `<p class="">${desc}</p>` : ''}
                            </li>
                    `
                    }).join('')
                })
            })
    })
})
