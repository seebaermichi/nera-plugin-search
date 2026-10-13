# Work log — 01a133d2-fb82-7139-bd52-3094ec888a1d-nera-plugin-search-published-search-template-passes-nera

- **Issue:** `01a133d2-fb82-7139-bd52-3094ec888a1d`

## Issue snapshot (2026-10-13)

- **Id:** `01a133d2-fb82-7139-bd52-3094ec888a1d`
- **Type:** improvement
- **Group:** —
- **Status:** in_progress
- **Title:** [nera-plugin-search] Published search template passes nera build --check (no a11y-h1, labelled input)

## Today

`@nera-static/plugin-search` 2.2.0 ships `views/search.pug`, which `npx nera-search` copies to `views/vendor/plugin-search/` (or the theme's vendor folder) and the site includes by hand. Its markup:

- `h1.search__title Search` — its own top-level heading;
- `input.search__input(type="search", placeholder="Search...", data-search-input, …)` — no `<label>`, no `aria-label`; a placeholder is not an accessible name.

## The problem

Every site that uses the template as published gets two warnings from `nera build --check` (`@nera-static/validate` ≥ 1.2.0, output pass):

- `a11y-h1` — the search page's layout or Markdown usually brings its own `h1`, so the page ends up with two;
- `a11y-form-label` — the search input has no accessible name.

Found 2026-10-12 while building the search recipe of the Nera skill (`nera-cli/skills/nera/recipes/search.md`, issue 01a1260d-8ec6-701e-98a0-816bd8ad9c4f) in a scaffolded site. The recipe works around it today: no `#` heading on the search page, and `aria-label="Search"` added to the site's copy.

## How it should work

The published template passes `nera build --check` without `a11y-*` warnings when included in a page whose layout has the page's `h1`:

- the search input gets an accessible name, translatable via the site's `t()` (e.g. a visually hidden `label(for=…)` or `aria-label=t('search_label')`, falling back to "Search");
- the template no longer forces an `h1`: drop it, or demote it / make it optional (e.g. a mixin parameter or a config key `show_title`).

## Semver

Template markup is a contract (users style the BEM classes). Adding an `aria-label` or a hidden label is additive → minor. Removing or demoting `h1.search__title` changes markup sites may style → **major**, with a `### Migration from v2.x` CHANGELOG section — unless it is made opt-out via a config key with today's default (minor). Decide while planning; prefer the non-breaking route.

## Also update

- `nera-plugin-search/README.md` (template section).
- Note: `publishTemplates` skips an existing vendor folder, so existing sites keep the old copy; say so in the CHANGELOG.
- Afterwards, simplify steps 4–5 of `nera-cli/skills/nera/recipes/search.md` (and the `add-search` tutorial on nera.js.org if it shows the template).

## Acceptance criteria

1. A test in `nera-plugin-search` renders `views/search.pug` and asserts the input has an accessible name.
2. A throwaway site with the published template and a layout that has the page `h1` reports no `a11y-h1` and no `a11y-form-label` from `npx nera build --check`.
3. The semver level matches the change, CHANGELOG + version bump in the same commit.

## Cloud launch (2026-10-13)

- **Worked in a Claude Code cloud session**, outside the local plan → implement → review → approve loop (to use the cloud credit). The gate was not armed.
- **Brief:** `plans/cloud/01a133d2-fb82-7139-bd52-3094ec888a1d-brief.md` · **Branch:** `issue/01a133d2-search-template-a11y` · **Session:** launched by the user (URL to be added)
- **Route:** minor 2.3.0, as the issue prefers: `aria-label` via `t('search_label')` (fallback "Search"); `h1.search__title` opt-out via `show_title: false` (`app.searchShowTitle`), default unchanged. `a11y-h1` is clean only with the opt-out set — confirmed with the user 2026-10-13.
- **On return:** `/work-issue-cloud 01a133d2-fb82-7139-bd52-3094ec888a1d` — verify locally, triage, merge, reconcile, resolve.

## Cloud result (2026-10-13)

- **Branch:** `issue/01a133d2-search-template-a11y` (also pushed as `claude/search-template-a11y-x4ifb0`, same commit `ae1cb29`) · 6 commits · result file `plans/cloud/01a133d2-fb82-7139-bd52-3094ec888a1d-result.md`
- **Summary:** `views/search.pug` gives `input.search__input` an `aria-label` from `t('search_label')` (fallback `Search`); `h1.search__title` is opt-out via `show_title: false` → `app.searchShowTitle`, default markup unchanged. Index untouched. README + `config/search.yaml` documented, 11 new tests. Proposed minor 2.3.0.
- **Verified locally:** Node 22.22.0, `npm ci && npm run lint && npx vitest run` → lint clean, 65/65 tests.
- **Verified locally:** throwaway `nera new` site (nera from npm, plugin from this branch by path), `theme/views/pages/search.pug` including the vendored template, `pages/search.md` with `# Search`: without `config/search.yaml` → `a11y-h1` on `public/search.html`, no `a11y-form-label`; with `show_title: false` → neither. Remaining warnings (`a11y-skip-link`, `legal-imprint-link`, `legal-privacy-link`) come from the scaffold layout.
- **Review findings:** none blocking. `origin/main` unchanged.

### Decisions
- Minor 2.3.0: `aria-label` is additive; the `h1` opt-out defaults to today's markup.
- Label trimmed/validated: a non-string, empty, whitespace-only or key-echo `t()` result falls back to `Search`.
- Label computed in an unbuffered `- var` before `.section.search`, so the wrapper stays untouched.
- Condition `if !(app && app.searchShowTitle === false)` so rendering without `app` does not throw.
- `h1` text stays literal `Search`; `show_title` lives on `app` only (no `getMetaData` change).

### Carry forward
- `views/search.pug` — `placeholder="Search..."` not translatable.
- `views/search.pug` — `h1.search__title` text `Search` not translatable.
- `nera-cli` scaffold layout — every page warns `a11y-skip-link`, `legal-imprint-link`, `legal-privacy-link` under `nera build --check` (other repo; no board issue covers it).
- `.claude/issue-conventions.md` vs brief (push rule, bullet style) — conventions target the local loop; CHANGELOG `-   ` is the four-column bullet. No change.
- `README.md:482` Development tells contributors `npm test` (watch mode).
- README Compatibility "Node.js >= 20.0.0" — matches `package.json` engines; no change.

## Triage (2026-10-13)

| item | verdict |
|---|---|
| placeholder + h1 text not translatable | fix — `t('search_placeholder')` / `t('search_title')`, same fallback rule, default markup identical |
| README:482 `npm test` | fix — `npx vitest run` |
| scaffold layout skip-link/imprint/privacy warnings | file — other repo (`nera-cli`) |
| conventions-file mismatch | drop — no change needed |
| Node engines note | drop — README matches `package.json` |

User: "fix both here" (2026-10-13).
