# Roadmap — @nera-static/plugin-search

Planned/possible enhancements. Nothing here is committed work; items are ideas
with enough detail to pick up later.

## Per-language search index

**Status:** shipped in 1.3.0 on 2026-07-21 · **Filed:** 2026-07-21 ·
**Semver:** minor (opt-in). See "Resolved 2026-07-21" at the end of this
section for what was actually built and what was deliberately left out; the
proposal below is kept as the reasoning that led there.

> The sibling feature shipped in `@nera-static/plugin-tags` 3.2.0 on
> 2026-07-21. Read "Context added 2026-07-21 — lessons from shipping the same
> feature in plugin-tags" at the end of this section **before** starting: it
> settles several of the open questions below by precedent, and records two
> dead ends that cost real work in that repo.

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

### Context added 2026-07-21 — lessons from shipping the same feature in plugin-tags

`@nera-static/plugin-tags` 3.2.0 shipped per-language tags on 2026-07-21 (see
`nera-plugin-tags/ROADMAP.md`, section "Resolved 2026-07-21"). It is the same
feature shape — opt-in `group_by_lang`, partition by `meta.lang`, keep the old
single-namespace output as the default — so several of its decisions transfer
directly, and two of its wrong turns are worth not repeating. The decisions
below are **recommendations carried over, not settled facts for this repo**;
they are recorded so the next session starts from evidence rather than a blank
page.

#### Settled by precedent — copy these

**No new frontmatter key.** Pages already carry `lang:` — every one of the 63
pages in `nera-website` sets it. Read `meta.lang`, fall back to `app.lang`
(itself defaulting to `'en'`), and that is the entire per-page input. A
search-specific key would be a second source of truth to keep in sync by hand.

```js
function getPageLang(meta, defaultLang) {
    const lang = typeof meta.lang === 'string' ? meta.lang.trim() : ''
    return lang || defaultLang
}
```

**The language code *is* the suffix — do not add a mapping config.** The tags
implementation grew a `lang_path_prefixes` key letting each language override
its URL segment. It was built, documented, tested, and **dropped before
release**: its only distinguishing power was pointing two languages at one
output location, which no site can use, since two languages sharing a path or a
filename would collide in the site's own content long before the plugin got
involved. The search analogue would be a `lang_index_filenames` map. Do not
build it. If a site with locale-style codes (`de-DE` served from `/de/`) ever
turns up, add it then as its own minor bump.

**Group by language, and let the filename be derived.** Tags briefly keyed its
grouping by *resolved output path* instead of by language, to guarantee two
languages could never write to one file. Once the segment became the language
code that was unreachable, and the guard cost ~70 lines that made the code
describe something more complicated than the feature. A plain
`Map<lang, pages[]>` is the whole model:

```js
const byLang = new Map()
pagesData.forEach(page => {
    const lang = groupByLang ? getPageLang(page.meta, defaultLang) : defaultLang
    if (!byLang.has(lang)) byLang.set(lang, [])
    byLang.get(lang).push(page)
})
```

Note the `groupByLang ? … : defaultLang` — with grouping off every page lands in
one group, so **the existing single-index behaviour is this same code path with
one entry**, not a parallel branch. That is what let tags keep its entire
pre-existing test file passing untouched, which is the strongest evidence the
opt-out path is genuinely unchanged.

**Answer the default-language question explicitly, and answer it the same way.**
Tags leaves the default language unprefixed (`/tags/…`, with `/de/tags/…` for
the rest) because one language is served from the site root. The search
analogue: **the default language keeps the plain `output_filename`**, and only
other languages get a suffix:

- `search-index.json` (default language, unchanged) ·
  `search-index.de.json` · `search-index.es.json`

This is not cosmetic here — see the client-side hazard below, where it is the
whole backward-compatibility mechanism.

**Filename derivation** (the open question above): insert the language before
the final extension, and append if there is none. `search-index.json` →
`search-index.de.json`; `searchdata` → `searchdata.de`. `path.parse` gives
`{ name, ext }` for this in one call, and it is worth a unit test per branch
because it is the kind of string handling that silently produces
`search-index.de` (no `.json`) and 404s.

**Keep the hook synchronous.** `index.js` already carries the comment about
generator 4.3.0 and D2 — writing N files instead of one is not a reason to
reach for `fs.promises` and `await`. Loop `fs.writeFileSync`.

#### The hazard specific to this plugin

**The shipped client ignores `app.searchIndexPath` entirely.** `views/search.js`
hardcodes:

```js
fetch('/search-index.json')
```

So the config's `output_filename` already only half-works today: rename the
index and the shipped client still requests the old URL. Per-language indexes
make this the central problem rather than a latent bug, and it shapes the whole
design:

- The **template must tell the client which index to load** — the
  `data-search-index` attribute on `.search__input` floated above is the right
  shape. Adding an attribute is additive; it renames no BEM class, so it stays
  a minor bump under the workspace's template rules.
- **`search.js` must keep a fallback**: `input.dataset.searchIndex ||
  '/search-index.json'`. Users hold vendored copies of *both* `search.pug` and
  `search.js` under `views/vendor/plugin-search/`, and `publishTemplates` skips
  a directory that already exists — so a site that upgrades the package without
  running `npx nera-search --force` keeps its **old** client and its **old**
  template. With the default language at the unsuffixed filename, that site
  degrades to "search works, in the default language" instead of 404ing the
  index and silently returning no results for everyone. Verify exactly this
  combination: new plugin + stale vendored templates.
- Consider fixing the hardcoded URL **first, as its own patch release**, so the
  per-language work is not also carrying a pre-existing bug. `search.js` has no
  test coverage at all today (`test/plugin-search.test.js` covers `getAppData`
  only — 8 tests, none touching the client), so that patch is also the natural
  place to add the first client-side test.

#### Reconsider the "single index + `lang` field" alternative

The alternative above (one index, filter client-side) looked like the lesser
option when this was filed. Two things argue for it more strongly now:

- The client already loads the whole index into memory and filters it in JS.
  Adding `.filter(item => item.lang === pageLang)` is a two-line change to
  code that already exists, versus a new fetch-URL plumbing path through the
  template.
- Adding a field to index entries is additive for anyone who wrote their own
  client, so it is a clean minor bump on its own.

It still ships every language's text to every visitor — for `nera-website` at
63 pages that is negligible; for a large site it is the reason to split. A
defensible sequencing: **ship the `lang` field first** (small, useful
immediately, unblocks the site), then split files behind `group_by_lang` when
index size justifies it. Both can coexist — the field is worth including in
each entry even after splitting, for debugging.

#### What to expose on `app`

Mirror the shape tags settled on, which kept it a minor bump:

- `app.searchIndexPath` keeps its **existing string shape**, pointing at the
  default language's index. A template or client that never learned about
  languages keeps working.
- `app.searchIndexPaths` is the additive `{ en: '/search-index.json', de:
  '/search-index.de.json' }` map.
- Per-page, expose the resolved index URL for *that page's* language, so the
  template can emit the data attribute without doing the lookup itself. Tags
  did the equivalent with `meta.tagCloud`, and only when `group_by_lang` is on —
  with grouping off it would be a per-page copy of a global value for no gain.
  Note this requires a `getMetaData` hook; `plugin-search` currently exports
  only `getAppData`.

#### Testing

The house pattern (`plugin-tags`, `plugin-navigation`) is a temp directory as
cwd, a real `config/<name>.yaml` written into it, and the shipped templates
rendered with pug against real hook output — no generator process. `plugin-tags`
has 75 tests after this work; the ~18 covering the feature are worth skimming as
a checklist, since the equivalents mostly transfer:

- one file per language, at the derived filenames, default language unsuffixed
- entries partitioned correctly — a German page's text absent from the English
  index, which is the actual bug being fixed
- pages with no `lang` land in the default language's index
- **both** `group_by_lang: false` and "no `meta.lang` anywhere" reproduce
  today's single-index output byte for byte
- the shipped `search.pug` emits the right index URL for a non-default-language
  page, asserted through a real pug render
- stale-vendored-template degradation, per the hazard above

`plugin-search` has an advantage tags did not: it writes real files, so a test
can assert what landed on disk rather than inferring it from returned metadata.
Use that — it is the closest thing to end-to-end proof available without running
the generator.

#### Sequencing with the site

Develop and validate here; wiring `nera-website` is a separate follow-up, for
the same reason it was for tags — two streams of work editing the same site
files at once. Note the site's search-related state before assuming defaults:
it has its own `config/search.yaml`, and its vendored templates under
`views/vendor/plugin-search/` will need `npx nera-search --force`.

### Resolved 2026-07-21 — shipped in 1.2.1 and 1.3.0

Built in two releases, in the sequence recommended above.

**1.2.1 (patch) — the hardcoded client URL.** `search.pug` now emits
`data-search-index`, `search.js` reads `input.dataset.searchIndex` and keeps
`/search-index.json` as its fallback. That made `output_filename` work end to
end for the first time, independently of any language work. It also brought
the first client-side tests: `happy-dom` (devDependency, so no release impact)
plus running `views/search.js` through `new Function('document', 'fetch', …)`,
which gives every test its own window and its own request log instead of one
shared global document.

One change fell out of it: the client used to fetch the index **once** for all
inputs, then attach a handler per input. It now fetches per input, since each
input carries its own URL. Nesting depth is unchanged.

**1.3.0 (minor) — per-language indexes.** Every recommendation above was
followed as written: no new frontmatter key, no filename-mapping config, a
plain `Map<lang, pages[]>` whose `groupByLang ? … : defaultLang` line makes the
single-index path the same code with one entry, the default language at the
unsuffixed filename, `path.parse` for derivation, and synchronous
`fs.writeFileSync` in a loop.

Deliberately **not** built:

- **No `suffix_default_lang`.** Tags has `prefix_default_lang` because a site
  can plausibly serve every language from its own directory, including the
  default one. Index filenames have no such symmetry to preserve — and the
  unsuffixed default filename *is* the backward-compatibility mechanism for
  stale vendored templates, so making it configurable would offer a switch
  whose only effect is to break them.
- **No combined/`x-default` index.** Nothing asked for it, and the `lang` field
  on every entry means a site that wants one client for all languages can
  filter instead of splitting.

The "single index + `lang` field" alternative was not treated as an either/or:
entries carry `lang` when grouping is on, so both approaches are available from
one build.

34 tests pass (8 → 34 across both releases; the 8 pre-existing ones are
untouched, which is the evidence the opt-out path is unchanged — plus a test
that asserts the file written with `group_by_lang` absent is byte for byte the
one written with it set to `false`).

**Still open:** wiring `nera-website`, exactly as scoped above.
