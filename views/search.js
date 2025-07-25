document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('[data-search-input]')

    fetch('/search-index.json')
        .then((res) => res.json())
        .then((data) => {
            inputs.forEach((input) => {
                const resultSelector = input.getAttribute('data-results')
                const resultList = document.querySelector(resultSelector)
                if (!resultList) return

                input.addEventListener('input', () => {
                    const query = input.value.toLowerCase()

                    const results = data.filter((item) => {
                        return Object.values(item).some(val =>
                            typeof val === 'string' && val.toLowerCase().includes(query)
                        )
                    })

                    resultList.innerHTML = results.map((item) => {
                        const title = item.title || item.href || 'Untitled'
                        const desc = item.excerpt || item.description || ''
                        return `
                <li class="search__item">
                    <a class="search__link" href="${item.href}">${title}</a>
                    ${desc ? `<p class="search__description">${desc}</p>` : ''}
                </li>
            `
                    }).join('')
                })
            })
        })
})
