# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

