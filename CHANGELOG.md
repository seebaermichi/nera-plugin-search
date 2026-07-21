# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
