# @nera-static/plugin-search

A plugin for the [Nera](https://github.com/seebaermichi/nera) static site generator that adds a lightweight client-side search functionality. It builds a searchable JSON index from your content and provides a ready-to-use search interface – all without requiring a backend.

## ✨ Features

- Creates a `search-index.json` from page content and metadata
- Fully client-side – no backend or JavaScript framework needed
- Configurable search fields (e.g., `title`, `excerpt`, `description`)
- Option to strip HTML from content before indexing
- Auto-includes search script in assets
- Includes ready-to-use Pug template with BEM-compatible markup
- Supports multiple search inputs per page
- Full compatibility with Nera v4.2.0+

## 🚀 Installation

Install the plugin in your Nera project:

```bash
npm install @nera-static/plugin-search
```

The plugin is automatically detected and run during the render process.

## ⚙️ Configuration

Configure the plugin via `config/search.yaml` (optional):

```yaml
output_filename: search-index.json

fields:
  - title
  - excerpt
  - content
  - description
  - href

strip_html: true
```

### Field Notes

- `fields`: List of metadata fields to include in the index.
- `content`: Always pulled from the markdown content itself.
- `strip_html`: If `true`, HTML is removed from content before indexing.

## 🧩 Usage

### Add Search Page

```yaml
---
title: Search
layout: pages/default.pug
---
```

```pug
.section.search
  h1.search__title Search

  input.search__input(
    type="search",
    placeholder="Search...",
    data-search-input,
    data-results="[data-search__results]"
  )

  ul.search__results(data-search__results)
script(src="/js/search.js")
```

The plugin will create the `search-index.json` into your `/public` output.

You can include multiple search inputs on a page by using different `[data-results]` selectors.

### Example Search Result Output

```html
<li class="search__item">
    <a class="search__link" href="${item.href}">${title}</a>
    ${desc ? `<p class="search__description">${desc}</p>` : ''}
</li>
```

## 🛠️ Template Publishing

To customize the default view:

```bash
npx @nera-static/plugin-search run publish-template
```

This will copy:

```
views/vendor/plugin-search/search.pug
```

to your local project. You can now edit or extend the search markup freely.

The command also copies the `search.js` file to `assets/js/`. It handles DOM bindings and result generation.

## 🎨 Styling

Default template uses semantic HTML and includes minimal structure. Recommended BEM class names:

- `.search`
- `.search__input`
- `.search__results`
- `.search__item`
- `.search__title`
- `.search__description`

Customize freely via your own stylesheets.

## 📊 Generated Output

- `assets/search-index.json`: contains all indexed page data
- `assets/js/search.js`: minimal client-side logic for filtering and rendering
- `app.searchIndexPath`: injected into `app` data for template access

## 🧪 Development

```bash
npm install
npm test
npm run lint
```

Tests use [Vitest](https://vitest.dev) and cover:

- Index creation from `pagesData`
- Correct JSON structure and file writing
- `search.js` copy to assets folder
- Config-driven field control and HTML stripping

## 🧑‍💻 Author

Michael Becker
[https://github.com/seebaermichi](https://github.com/seebaermichi)

## 🔗 Links

- [Plugin Repository](https://github.com/seebaermichi/nera-plugin-search)
- [NPM Package](https://www.npmjs.com/package/@nera-static/plugin-search)
- [Nera Static Site Generator](https://github.com/seebaermichi/nera)

## 🧩 Compatibility

- **Nera**: v4.2.0+
- **Node.js**: >= 18
- **Plugin API**: Uses `getAppData()` for index creation and asset copying

## 📦 License

MIT
