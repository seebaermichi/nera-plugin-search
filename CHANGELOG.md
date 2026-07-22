# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-07-22

### Fixed

-   Generated Output no longer tells you to leave `folders.assets` at its
    default. Nera v4.5.0 makes the key take effect for the render as well as
    for plugins, so the index folder does follow it from that version on;
    below it the advice stands


## [2.0.0] - 2026-07-22

### Changed

-   **BREAKING**: the shipped `search.js` now emits the BEM class names this
    README has documented since 1.0.0. Each result is
    `.search__item` > `.search__link` + `.search__description`, and the matched
    term inside a snippet is wrapped in `.search__highlight`. It previously
    emitted `list-none` on the item, empty `class` attributes on the link and
    the description, and a `bg-yellow-100` highlight — a Tailwind utility name
    from a plugin that ships no Tailwind. Any stylesheet targeting the old
    names must be updated

### Fixed

-   **BREAKING**: pages without a `layout` in their frontmatter are no longer
    indexed. The generator renders HTML only for pages that define one
    (`render.js`), and plugins run before it — so such a page was indexed but
    never published: every result for it linked to a 404, and its full body
    text was written verbatim into the index, which *is* copied into `public/`.
    A layout-less page is the usual idiom for a draft, so this leaked
    unpublished content. Sites relying on layout-less pages appearing in search
    results will see them disappear
-   corrected the README's Usage section, which showed Pug markup directly
    below a Markdown page's frontmatter. Nera renders `pages/**/*.md` as
    Markdown, so following it published the entire search UI as escaped text,
    silently. Usage now shows the real sequence: publish the template, include
    it from a view, point a Markdown page at that view
-   corrected the claim that the index location follows `folders.assets` in
    `config/app.yaml`. The generator's render pipeline copies `./assets`
    regardless of that key, so setting it wrote the index somewhere the built
    site never serves from and every search request 404'd
-   corrected `fields` documentation: setting it **replaces** the default list
    rather than extending it, `content` is only indexed when listed, and
    `description` was shown as if it were a default when it is not. The real
    defaults are now stated

### Added

-   `## 🤝 Contributing` section, linking to the Nera contributing guide
-   `Plugin Utils` line in Compatibility, and the reason the Nera floor is what
    it is
-   Styling section now lists every class the template and the client actually
    emit, in a table naming which of the two produces each, and states that
    these names are a public contract
-   tests covering the emitted class names and the layout-less-page exclusion

### Migration from v1.x

**1. Re-publish the client script.** Nothing else delivers the new markup:

```bash
npx nera-search --force
```

`--force` overwrites `views/vendor/plugin-search/search.pug` and
`assets/js/search.js` wholesale, discarding local edits. If you customised
either — translated strings in the template are common — diff first, or make
the one edit by hand in `assets/js/search.js`: the result template near the end
of the file, plus the highlight `<span>`.

**2. Update your stylesheet.** The rename, in full:

| v1.x | v2.0.0 |
|---|---|
| `.list-none` (on the result `<li>`) | `.search__item` |
| *(no class on the result link)* | `.search__link` |
| *(no class on the description)* | `.search__description` |
| `.bg-yellow-100` | `.search__highlight` |

The plugin ships no CSS, so `.search__highlight` renders unstyled until you give
it a rule — `bg-yellow-100` was equally unstyled unless your site ran Tailwind.

**3. Check for layout-less pages you expected to find in search.** If a page
should be searchable it must be renderable: give it a `layout`. If it was in the
index only by accident, nothing to do — but do check whether its content was
published in an older `search-index.json` you have committed.


## [1.3.0] - 2026-07-21

### Added

-   `group_by_lang` (default `false`): build one index per `meta.lang` instead
    of one index from every page, so the search box on a German page stops
    returning English and Spanish hits. Pages without `meta.lang` belong to the
    site's default language (`app.lang`, itself defaulting to `en`)
-   the language code is inserted before the final extension of
    `output_filename`, and appended when there is none —
    `search-index.json` → `search-index.de.json`, `searchdata` →
    `searchdata.de`. The default language keeps the configured filename
    unchanged, so a site whose vendored templates predate this release keeps
    finding an index and degrades to searching the default language
-   `app.searchIndexPaths`, a `{ <lang>: <url> }` map of every index. Present
    in both modes; with grouping off it holds the single index under the
    default language key
-   `meta.searchIndexPath` on every page, the index URL for that page's
    language. Only added when `group_by_lang` is enabled, via a new
    `getMetaData` hook
-   a `lang` field on every index entry, again only when grouping is on

### Changed

-   the shipped `search.pug` reads `meta.searchIndexPath` and falls back to
    `app.searchIndexPath`. No markup or BEM class changed, but sites that
    published templates before need `npx nera-search --force` to pick it up
-   `app.searchIndexPath` is unchanged with grouping off; with grouping on it
    holds the default language's index, keeping its string shape


## [1.2.1] - 2026-07-21

### Fixed

-   the shipped `search.js` no longer hardcodes `/search-index.json`. It reads
    the index URL from `data-search-index` on the search input, which the
    shipped `search.pug` fills from `app.searchIndexPath` — so a site that set
    `output_filename` now loads the index it actually generated. The literal
    remains as a fallback, so a page whose template predates the attribute
    keeps working. Sites that published templates before need
    `npx nera-search --force` to pick this up


## [1.2.0] - 2026-07-21

### Changed

-   raised minimum Node from 18 to 20; Node 18 reached end-of-life on
    2025-04-30 and the dev toolchain requires Node 20+


## [1.1.0] - 2026-07-20

### Added

-   `--force` flag on the `nera-search` publish command, to deliberately
    overwrite already-published templates and `assets/js/search.js`
-   `assets/js/search.js` is now skipped when it already exists, instead of
    being overwritten silently. Re-running the publish command no longer
    discards local edits to the search script

### Fixed

-   **`getAppData` is now synchronous.** Nera only began awaiting plugin hooks
    in generator 4.3.0, and that fix does not reach already-cloned sites. On
    any earlier generator the previous `async` signature replaced the entire
    `app` object with a Promise, silently discarding every `app.yaml` value —
    `lang`, `translations`, `folders` — for this plugin and every plugin
    ordered after it. Builds still exited 0, so the damage was invisible:
    pages rendered with untranslated raw keys and no `lang` attribute
-   the search index path no longer throws `Path must be a string` when
    `app.yaml` defines a `folders` block without an `assets` key. It now falls
    back to `./assets`, the generator's own default for that key

### Changed

-   configuration is read inside `getAppData` rather than at module load, so
    edits to `config/search.yaml` take effect without a restart
-   `@nera-static/plugin-utils` range raised to `^1.2.0`, which is where the
    `force` option lands. The previous `^1.1.0` permitted but did not
    guarantee it, so `--force` could be accepted and then silently ignored

### Documentation

-   corrected three false README claims: the search script is **not**
    auto-included (the publish command copies it), the index path is **not**
    fixed at `assets/search-index.json` (it follows `folders.assets` and
    `output_filename`), and `app.searchIndexPath` is available to your own
    templates but is not used by the shipped `search.pug`
-   documented that the index is written into the **source** assets folder,
    with a `.gitignore` note. Writing to `public/` is not possible — Nera
    deletes and repopulates it after plugins run
-   fixed an invalid `npx` invocation; the command is `npx nera-search`

## [1.0.3] - 2025-07-25

### Change
- Enhance search.js to show parts of the results text

## [1.0.2] - 2025-07-25

### Fix
- publish serach.js with publish-template command

## [1.0.1] - 2025-07-25

### Added
- missing script to publish templates

### Fix
- publish templates command


## [1.0.0] - 2025-07-25

### Added

- Initial release of `@nera-static/plugin-search`
- Generates a `search-index.json` file from page metadata and content
- Supports configurable fields via `config/search.yaml`
- Option to strip HTML tags from content before indexing
- Auto-injects `search.js` script to `assets/js/search.js`
- Simple search interface and results rendering via `views/search.pug`
- Allows multiple search inputs per page via `[data-search-input]` selectors
- Provides `publish-template` command to copy `search.pug` for customization
- Comprehensive test suite to validate index generation and file handling
