# Issue conventions

Review rules for work on `@nera-static/plugin-search`, run through Snagio from
`nera-plugin-search/`. Its issues live in the Snagio project **"Nera AI"** (which
tracks `../nera-cli/ROADMAP-ai.md`) and carry the target repo as a title prefix.
**Work an issue only from the repo it names** — the step skills commit in the
current repo.

The workspace `../CLAUDE.md` holds the fleet-wide rules (semver, CHANGELOG,
releases, plugin contract); this file only adds what a reviewer checks per diff.

## Non-negotiables

- **`ROADMAP.md` in this repo is the plugin's spec** for larger features. A decision
  made while working an issue that belongs to a ROADMAP section is written back into
  it in the same commit — never only into the issue. Extend it, never fork it.
- **Semver + `CHANGELOG.md` in the same commit as the change** (Keep a Changelog,
  four-space bullets, `**BREAKING**:` prefix, a `### Migration from vX.x` section on a
  major). Bump with `npm version <bump> --no-git-tag-version`, never by hand-editing
  `package.json`. Config keys (`config/search.yaml`), the `app.<key>`/`meta.<key>`
  the plugin writes (`searchIndexPath`), the index file's path and JSON shape, and the
  published template's markup and BEM classes are the public contract — classify
  changes by what an existing site would notice.
- **Never publish or push.** No `npm publish`, no `git push`, no tags pushed, no posts
  anywhere public. Releases go out via CI OIDC on a `v*` tag; the session hands over
  the exact commands.
- **Hooks stay synchronous** and return the right shape (`getAppData` → plain object,
  `getMetaData` → array); a wrong shape is dropped silently by core.
- Config is read from the **site** (`config/search.yaml` via `getConfig` from
  `@nera-static/plugin-utils`), every key has a JS fallback, and a missing config file
  still yields a working index.
- Paste-ready text for the maintainer goes in a fenced code block between
  `----- START: … -----` and `----- END -----` lines, never in a blockquote.

## Framework correctness

- ESM only; eslint style: 4-space indent, no semicolons, single quotes. No new
  runtime dependency without a stated reason — every site installs this one.
- The index honours `group_by_lang` (per-language indexes, `meta.searchIndexPath`)
  and drops `data-search-ignore` elements; changes keep both working.
- Output is deterministic: the same site gives a byte-identical index.

## UI / template rules

- `views/search.pug` and `views/search.js` are copied into a site by
  `npx nera-search` (`bin/publish-template.js`, `publishTemplates` from plugin-utils),
  which **skips an existing vendor folder** — a template change never reaches a site
  that published once; say so in the CHANGELOG.
- Template markup and BEM classes (`.search`, `.search__title`, `.search__input`,
  `.search__results`) are a public contract: renaming or removing them is major;
  adding attributes or opt-in elements is minor.
- The template must pass `nera build --check` (`@nera-static/validate` output pass)
  without `a11y-*` warnings when included in a page whose layout carries the `h1`.
  User-facing strings go through the site's `t()` with an English fallback.
- Interface language of messages and docs: English.

## UI walkthrough

- Browser tooling: Playwright MCP (`mcp__playwright__browser_navigate`,
  `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_console_messages`).
- Boot (a throwaway site with the *local* plugin, never from npm):
  `R=$PWD; T=$(mktemp -d) && cd "$T" && npx @nera-static/nera new site --no-install && cd site && npm install && npm install "$R" && npx nera-search && npx nera build && npx nera serve --port 3124`
  (Node 22 if npm crashes: `PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH`), then
  include the published template in a page. Delete `$T` afterwards.
- Base URL / login: http://localhost:3124/, no login.
- Surfaces:
    | surface | url | role | how to open |
    |---|---|---|---|
    | search page | the page that includes `vendor/plugin-search/search` | visitor | open it, type a query |
    | search index | `/search-index.json` (or per language) | client script | open the URL |

## Tests & hygiene

- `npx vitest run && npm run lint` must pass (`npm test` is watch mode — never use
  it here). Run from the package root (template tests resolve paths cwd-relative).
- New behaviour has a test in `test/`; template changes render `views/search.pug`
  with pug and assert on the markup. No network.

## Reconciliation steps (run when resolving an issue)

- Version bump + `CHANGELOG.md` entry in the change's commit, if it ships in the
  tarball; none for ROADMAP, tests, CI or `.claude/`. README changes get a patch.
- Update this repo's `ROADMAP.md` when the issue belongs to one of its sections, and
  the spec the issue names in a sibling repo (e.g. `../nera-cli/ROADMAP-ai.md`, or a
  recipe under `../nera-cli/skills/nera/`) — those are commits in other repos; hand
  them over or file them as issues, as the maintainer prefers.
- Hand over the release commands (`git push`, `git tag -a v<x.y.z> …`,
  `git push origin v<x.y.z>`) — do not run them.
- If the release changes a config key or default, a command, template markup or
  paths, `app.*`/`meta.*` output or a hook (minor or major): check the nera.js.org
  tutorials that stamp this package (`grep -l 'plugin-search:'
  ../nera-website/pages/tutorials/*.md`) — still right → bump their
  `verified_with`; stale → fix in en/de/es or file a `[nera-website] Tutorial …`
  issue. See "Check the tutorials too" in `../CLAUDE.md` and `/tutorial-review`.
- Remove the issue's plan files last, once nothing else needs them:
  `git rm` its tracked files under `plans/` (`plans/issues/<id>-*`,
  `plans/issues/browser-tests/<id>-*`, `plans/cloud/<id>-*`), delete the
  untracked ones, and commit
  `chore(plan): remove the plan files of the resolved <short title> issue`.
  Git history keeps them; `plans/` holds only open issues.

## Step order

<!-- The dependency ladder /plan-issue orders steps by: one rung per line, in
     dependency order, each with what it holds in THIS codebase and the Verify
     that proves a step on it is done. Leave "…" to use the skill's default
     (Data → Contract → Behaviour → UI → Docs). Examples to replace:

     Laravel:
     1. Data — migration, enum, model cast / relation, seeder — migrates up and down
     2. Contract — route + middleware, policy, Form Request, feature flag — feature
        test: valid input accepted, invalid refused
     3. Behaviour — actions, services, jobs, events, queries — `php artisan test --filter=…`
     4. UI — Livewire / Blade / Vue pages and components, labels — tests + walkthrough
     5. Docs — handbook, README

     Node / TypeScript:
     0. Toolchain — dependencies, tsconfig, build config — build and `tsc --noEmit` pass
     1. Data — Prisma / Drizzle migration, schema — applies and rolls back
     2. Contract — handler registration, guard, zod schema — `vitest run -t …`
     3. Behaviour — services, repositories, jobs — `vitest run -t …`
     4. Client — API functions, hooks, stores — `tsc --noEmit`
     5. UI — components, i18n strings — `tsc` + walkthrough
     6. Docs — README, ADRs -->

- …

## Static analysis

<!-- Read by /implement-step, /review-step and /work-issue: the command runs over the
     WHOLE project before review, in review and before resolving; red blocks all three. -->

- Command: `npm run lint` (ESLint over the whole package; plain JavaScript, no type checker)
- Green: exit code 0, no output
- Suppressions: fix every finding at its cause — no `eslint-disable` comments, no rule switched off to get green.
