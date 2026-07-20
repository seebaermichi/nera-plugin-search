# @nera-static/plugin-search

[![Test](https://github.com/seebaermichi/nera-plugin-search/actions/workflows/test.yml/badge.svg)](https://github.com/seebaermichi/nera-plugin-search/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@nera-static/plugin-search)](https://www.npmjs.com/package/@nera-static/plugin-search)

A plugin for the [Nera](https://github.com/seebaermichi/nera) static site generator that adds a lightweight client-side search functionality. It builds a searchable JSON index from your content and provides a ready-to-use search interface – all without requiring a backend.

## ✨ Features

- Creates a `search-index.json` from page content and metadata
- Fully client-side – no backend or JavaScript framework needed
- Configurable search fields (e.g., `title`, `excerpt`, `description`)
- Option to strip HTML from content before indexing
- Ships a client-side search script, published on request
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

The plugin writes the index into your **source** assets folder, and Nera copies
that folder into `public/` at the end of the render — so the built site serves
it from `/search-index.json`. See [Generated Output](#-generated-output) for
what this means for version control.

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
npx nera-search
```

This will copy:

```
views/vendor/plugin-search/search.pug
```

to your local project. You can now edit or extend the search markup freely.

The command also copies the `search.js` file to `assets/js/`. It handles DOM bindings and result generation.

Both steps **skip if the destination already exists**, so re-running the command
never discards your edits. To deliberately overwrite them with the packaged
versions:

```bash
npx nera-search --force
```

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

- `<assets folder>/<output_filename>`: contains all indexed page data. The
  location follows `folders.assets` in your `config/app.yaml` (default
  `./assets`) and `output_filename` in `config/search.yaml` (default
  `search-index.json`) — it is **not** fixed at `assets/search-index.json`.
- `assets/js/search.js`: minimal client-side logic for filtering and rendering,
  copied by the publish command rather than by the render.
- `app.searchIndexPath`: the index's public URL, added to `app` data. Available
  to your own templates; the shipped `search.pug` does not use it, since
  `search.js` resolves the path itself.

### ⚠️ The index is written into your source tree

The index has to be written into the **source** assets folder, not into
`public/`. Nera deletes `public/` and then copies assets into it *after*
plugins run, so anything a plugin writes directly to `public/` is discarded.

That means each render creates or updates a generated file inside a directory
you probably track in git. To keep it out of version control while still
serving it, add it to `.gitignore`:

```
assets/search-index.json
```

Do **not** add it to `.neraignore` — that would stop Nera copying it into
`public/`, and the search would find no index at runtime.

## 🧪 Development

```bash
npm install
npm test
npm run lint
```

Tests use [Vitest](https://vitest.dev) and cover:

- Index creation from `pagesData`
- Correct JSON structure and file writing
- That `getAppData` stays synchronous and preserves existing `app` values
- Fallback to `./assets` when `folders.assets` is absent
- Config-driven field control, custom output filename, and HTML stripping

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
