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
- Optional per-language indexes, so each language searches only its own content
- Indexes only pages the generator will actually render
- Full compatibility with Nera v4.3.0+

## 🚀 Installation

Install the plugin in your Nera project:

```bash
npm install @nera-static/plugin-search
```

The plugin is automatically detected and run during the render process.

## ⚙️ Configuration

Configure the plugin via `config/search.yaml`. The file is optional — every key
below falls back to the default shown, so the plugin works with no config at
all. This block **is** the defaults:

```yaml
output_filename: search-index.json

fields:
  - title
  - excerpt
  - content
  - href

strip_html: true

# Opt-in: one index per language instead of one for the whole site
group_by_lang: false
```

### Field Notes

- `fields`: the metadata fields to include in each index entry. Setting it
  **replaces** the default list rather than extending it — list every field you
  want, including the two that carry the search itself:
    - `content` is the page's rendered Markdown body. Omit it from `fields` and
      the index holds titles only, so body-text queries match nothing.
    - `href` is the result's link. Omit it and results render with no
      destination.
- Any other frontmatter key works — `description`, `keywords`, `tags` — as long
  as the page defines it. A field whose value is empty or missing on a page is
  left off that entry rather than stored as `""`.
- `strip_html`: If `true`, HTML is removed from content before indexing.
- `group_by_lang`: If `true`, pages are indexed per `meta.lang`. See
  [Multilingual sites](#-multilingual-sites).

## 🧩 Usage

The search markup is **Pug, and belongs in a view** — a layout or a partial
under `views/`. Nera renders `pages/**/*.md` as Markdown, so Pug pasted into a
Markdown page is published as literal text, with no error and no warning.

### 1. Publish the template

```bash
npx nera-search
```

This copies `search.pug` to `views/vendor/plugin-search/` and the client script
to `assets/js/search.js`. See **Template Publishing** below for the
skip-if-exists rule and `--force`.

### 2. Include it from a view

```pug
//- views/pages/search.pug
extends ../layouts/default

block content
  article!= content
  include /vendor/plugin-search/search.pug
```

The leading slash makes the path resolve from your `views/` folder regardless of
where the including file sits — Nera compiles templates with `basedir` set, from
v4.3.0 on. A relative `include ../vendor/plugin-search/search.pug` also works,
but only from a view exactly one level below `views/`.

### 3. Point a Markdown page at that view

```markdown
---
title: Search
layout: pages/search.pug
---

Search across the documentation. Results are generated at build time.
```

Only the frontmatter and prose live here. A page **without** a `layout` key is
skipped by the generator entirely — and, since v2.0.0, left out of the index too.

### Writing your own markup

You do not have to use the shipped template. Any input carrying
`data-search-input` and `data-results` is picked up by `search.js`, so a view of
your own works the same way:

```pug
input.search__input(
  type="search",
  placeholder="Search...",
  data-search-input,
  data-search-index=(meta && meta.searchIndexPath) || (app && app.searchIndexPath),
  data-results="[data-search__results]"
)

ul.search__results(data-search__results)

script(src="/js/search.js")
```

Keep the `data-search-index` attribute: it carries the configured
`output_filename`, and the page's own language when `group_by_lang` is on.
Multiple search inputs per page work as long as each points `[data-results]` at
a different list.

The plugin writes the index into your **source** assets folder, and Nera copies
that folder into `public/` at the end of the render — so the built site serves
it from `/<output_filename>`, `/search-index.json` by default. See
[Generated Output](#-generated-output) for what this means for version control.

### Search result markup

Each match renders as one list item:

```html
<li class="search__item">
    <a class="search__link" href="/start">Getting started</a>
    <p class="search__description">...how to <span class="search__highlight">install</span> Nera...</p>
</li>
```

The description is the entry's `excerpt`, then its `description`, then a snippet
built around the match, whichever exists first.

## 🌍 Multilingual sites

By default every page lands in one index, so the search box on a German page
also returns English and Spanish hits. Enable `group_by_lang` to give each
language an index of its own:

```yaml
group_by_lang: true
```

A page's language is `meta.lang`, set in its frontmatter:

```yaml
---
title: Erste Schritte
layout: pages/default.pug
lang: de
---
```

Pages without a `lang` belong to the site's default language — `lang` in
`config/app.yaml`, itself defaulting to `en`. Set that key deliberately: it
decides which language keeps the unsuffixed filename.

```
pages/index.md         lang: en    ─┐
pages/imprint.md       (no lang)   ─┴─→  assets/search-index.json
pages/de/index.md      lang: de     ──→  assets/search-index.de.json
pages/es/index.md      lang: es     ──→  assets/search-index.es.json
```

### Filenames

The language code goes before the final extension, and the default language
keeps the configured filename unchanged — so the URL your site already serves
stays valid:

| `output_filename` | `en` (default) | `de` |
|---|---|---|
| `search-index.json` | `/search-index.json` | `/search-index.de.json` |
| `data/pages.json` | `/data/pages.json` | `/data/pages.de.json` |
| `searchdata` | `/searchdata` | `/searchdata.de` |

### Template and client

The shipped `search.pug` emits `data-search-index` from `meta.searchIndexPath`,
which is the index for the page's own language, and `search.js` fetches that
URL. Nothing in your own markup needs to change.

```pug
input.search__input(
  data-search-input,
  data-search-index=(meta && meta.searchIndexPath) || (app && app.searchIndexPath),
  data-results="[data-search__results]"
)
```

If your site published templates before upgrading, its vendored `search.pug` and
`assets/js/search.js` keep requesting `/search-index.json`, and search falls
back to the default language on every page. Refresh them with
`npx nera-search --force` — but **only if you never edited them**: `--force`
overwrites your copies wholesale. If they are customised, merge the two changes
by hand instead:

- `search.pug`: add
  `data-search-index=(meta && meta.searchIndexPath) || (app && app.searchIndexPath)`
  to the input.
- `search.js`: fetch `input.dataset.searchIndex || '/search-index.json'`, per
  input rather than once per page.

### Data exposed

- `app.searchIndexPath` keeps its existing string shape and points at the
  default language's index.
- `app.searchIndexPaths` is `{ en: '/search-index.json', de:
  '/search-index.de.json', … }`. Present in both modes.
- `meta.searchIndexPath` is added to every page, only when `group_by_lang` is
  enabled.
- Each index entry carries a `lang` field, again only when grouping is on. The
  shipped client does not need it — the split already scopes results — but it
  lets a custom client load one index and filter, and it makes a
  misfiled page obvious when you open the JSON.

### Pages generated by other plugins

Plugins run in sequence and hand `pagesData` on to the next one, so only pages
that exist **before** `plugin-search` runs get indexed. Plugins are ordered
alphabetically by default, which puts `plugin-search` ahead of
`plugin-tags` — its generated tag overview pages would be missing from the
index entirely. Run search last in `config/plugin-order.yaml`:

```yaml
plugin-order:
  - end:
      - plugin-search
```

This matters more on a multilingual site, where those generated pages carry
their own `meta.lang` and would otherwise be absent from every language's
index.

### If a search box comes up empty

- **Every page returns default-language results.** The vendored template is
  stale and emits no `data-search-index`. Re-run `npx nera-search --force`.
- **The request 404s.** Your own template hardcodes an index URL that no
  longer exists — read it from `meta.searchIndexPath` instead.
- **A page's hits are in the wrong language.** Check its frontmatter `lang`
  against the `lang` field on its entry in the JSON; a typo makes it its own
  language, and produces an index file named after the typo.

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

> **A template change only reaches your site when you re-publish.** Upgrading
> the package is safe but does nothing to `views/vendor/plugin-search/` or
> `assets/js/search.js` — the published copies are yours, and are left alone.
> **v2.0.0 changed the class names `search.js` emits**, so a site that published
> before it keeps the old markup until it runs `--force`. That discards local
> edits wholesale, so diff first if you have customised either file.

## 🎨 Styling

The template and the client script emit these class names:

| Class | Emitted by | On |
|---|---|---|
| `.section` | `search.pug` | the wrapper |
| `.search` | `search.pug` | the wrapper |
| `.search__title` | `search.pug` | the heading |
| `.search__input` | `search.pug` | the search field |
| `.search__results` | `search.pug` | the results list |
| `.search__item` | `search.js` | one result |
| `.search__link` | `search.js` | the result's link |
| `.search__description` | `search.js` | the excerpt or match snippet |
| `.search__highlight` | `search.js` | the matched term inside a snippet |

The last four are written by `assets/js/search.js` at query time, not by the
template — there is no markup in `search.pug` to read them from. The plugin
ships no CSS, so `.search__highlight` is invisible until you style it.

> **These names are a public contract.** Sites style them from their own
> stylesheets, so renaming one is a **breaking change** and ships as a major.
> v2.0.0 is exactly that: the client previously emitted `list-none`, empty
> `class` attributes and a `bg-yellow-100` highlight.

## 📊 Generated Output

- `assets/<output_filename>`: contains all indexed page data. The filename
  follows `output_filename` in `config/search.yaml` (default
  `search-index.json`), so it is **not** fixed at `assets/search-index.json`.
  With `group_by_lang` enabled there is one such file per language.

  The **folder** follows `folders.assets` in your `config/app.yaml`, default
  `./assets` — **on Nera v4.5.0 and later**. Below that, leave the key alone:
  the plugin honoured it but the render pipeline copied `./assets` regardless,
  so the index landed somewhere the built site never served it from and every
  search request 404'd. Fixed in generator v4.5.0.
- `assets/js/search.js`: minimal client-side logic for filtering and rendering,
  copied by the publish command rather than by the render.
- `app.searchIndexPath`: the index's public URL, added to `app` data. The
  shipped `search.pug` passes it to the client as `data-search-index`, so a
  custom `output_filename` is honoured end to end. `search.js` falls back to
  `/search-index.json` when the attribute is absent.
- `app.searchIndexPaths` and `meta.searchIndexPath`: see
  [Multilingual sites](#-multilingual-sites).

### ⚠️ The index is written into your source tree

The index has to be written into the **source** assets folder, not into
`public/`. Nera deletes `public/` and then copies assets into it *after*
plugins run, so anything a plugin writes directly to `public/` is discarded.

That means each render creates or updates a generated file inside a directory
you probably track in git. To keep it out of version control while still
serving it, add it to `.gitignore`:

```
assets/search-index*.json
```

Do **not** add it to `.neraignore` — that would stop Nera copying it into
`public/`, and the search would find no index at runtime.

Each render writes the indexes it needs and leaves everything else alone, so an
index that stops being generated is **not** cleaned up: turn `group_by_lang`
back off, rename `output_filename`, or remove the last page of a language, and
the orphaned file stays in your assets folder and keeps being copied into
`public/`. Delete it by hand when that happens.

### What gets indexed

Every page Nera will render, and nothing else:

- A page **without a `layout`** in its frontmatter is skipped by the generator,
  so it is left out of the index too. This is what makes a layout-less draft
  safe: before v2.0.0 its full body text was written into the index — a file
  that *is* published — while no HTML page for it ever existed, so results
  linked to a 404.
- Pages **generated by other plugins** are indexed only if that plugin ran
  first. See [Pages generated by other plugins](#pages-generated-by-other-plugins).

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
- Per-language indexes: partitioning, filename derivation, and that opting out
  reproduces the single-index output
- That pages without a `layout` are excluded, and their content never reaches
  the index
- The shipped `search.pug` and `search.js`, rendered and run against a DOM,
  including the exact class names the client emits

## 🤝 Contributing

Issues and pull requests are welcome. See the
[Nera contributing guide](https://github.com/seebaermichi/nera/blob/main/CONTRIBUTING.md)
for plugin development, the hook contract, and local setup.

For this repo specifically:

- `npx vitest run` and `npm run lint` must pass (`npm test` is watch mode).
- Bump the version and update `CHANGELOG.md` **in the same commit** as the change.
- Template markup and BEM class names are a **public contract** — users style
  them from their own CSS, so changing one is a **major** bump.
- Releases publish from CI on a pushed `v*` tag. Never run `npm publish`.

## 🧑‍💻 Author

Michael Becker  
[https://github.com/seebaermichi](https://github.com/seebaermichi)

## 🔗 Links

- [Plugin Repository](https://github.com/seebaermichi/nera-plugin-search)
- [NPM Package](https://www.npmjs.com/package/@nera-static/plugin-search)
- [Nera Static Site Generator](https://github.com/seebaermichi/nera)

## 🧩 Compatibility

- **Nera**: v4.3.0+ — v4.2.0 for the `config/plugin-order.yaml` ordering this
  plugin needs to run last, and v4.3.0 for the `basedir` that makes the
  `include /vendor/plugin-search/search.pug` form in Usage resolve. On v4.2.x,
  use the relative include instead.
- **Node.js**: >= 20
- **Plugin Utils**: ^1.2.0
- **Plugin API**: Uses `getAppData()` for index creation and `getMetaData()`
  to expose each page's index path when `group_by_lang` is enabled

## 📦 License

MIT
