# Roadmap — @nera-static/plugin-search

Planned/possible enhancements. Nothing here is committed work; items are ideas
with enough detail to pick up later.

## Per-language search index

**Status:** proposed · **Filed:** 2026-07-21 · **Likely semver:** minor (opt-in)

**Motivation.** Surfaced while building a trilingual site (English/German/Spanish)
with Nera. The plugin currently builds **one** index from every page, so on a
multilingual site the search box on a German page returns English and Spanish
results mixed in. Each language should search only its own content.

**Current behaviour** (`index.js`, `getAppData`). All `pagesData` are mapped into
a single `index`, written once to `assets/<output_filename>` (default
`search-index.json`), and exposed as `app.searchIndexPath`. There is no notion of
`meta.lang`.

**Proposed behaviour** (opt-in, backward compatible). Add a config switch in
`config/search.yaml`, e.g.:

```yaml
# default false → today's single-index behaviour is unchanged
group_by_lang: false
```

When enabled, partition `pagesData` by `meta.lang` and write one index per
language, deriving the filename from `output_filename`:

- `search-index.json`  → `search-index.en.json`, `search-index.de.json`, …
- expose a map instead of a single path, e.g.
  `app.searchIndexPaths = { en: '/search-index.en.json', de: '/…', … }`,
  while keeping `app.searchIndexPath` pointing at the default language for
  backward compatibility.

Pages without a `meta.lang` fall into the default language bucket (`app.lang`).

**Client side.** `assets/js/search.js` must load the index matching the current
page's language. Options:
- read a `lang` attribute the template already has (e.g. `<html lang>`), or
- let the published `search.pug` template pass the right index URL via a
  `data-search-index` attribute.

**Alternative (single index + field).** Instead of splitting files, always include
`lang` in each index entry and filter client-side by the current page language.
Simpler output, one request, but ships every language's text to every visitor.
Prefer the split-file approach for larger sites; the field approach is a fine
minimal first step and is itself backward compatible (just an extra field).

**Open questions.**
- Filename scheme when `output_filename` has no `.json` suffix.
- Whether to emit an `x-default`/combined index alongside the per-language ones.
- Interaction with sites that have no `meta.lang` anywhere (should be a no-op).

**Acceptance.** A trilingual site produces one index per language; the search box
on a `/de/` page returns only German results; a single-language site (no
`group_by_lang`, or no `meta.lang`) behaves exactly as it does today.
