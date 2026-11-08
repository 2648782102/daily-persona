# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-09

### Added

- Deterministic `date -> persona` resolution with timezone, seed, catalog version, and SHA-256 digest.
- Versioned persona catalog with schema validation and command-like text rejection.
- CLI with `check`, `today`, `date`, and `dump` commands.
- REST/JSON endpoints with `ETag` and `Cache-Control`.
- MCP adapters for stdio and Streamable HTTP, compatible with MCP `2026-07-28` and 2025 handshake-era clients.
- `get_today_persona`, `resolve_for_date`, and `list_catalog` tools.
- A thin `daily-persona` skill and explicit untrusted-data contract.
- Node.js test suite and CI workflow for Node 20, 22, and 24.

### Known limitations

- No cryptographic signature or key rotation for remote catalogs.
- No cross-persona factual-accuracy, task-completion, or safety evaluation suite.
- No plugin directory publication or hosted remote endpoint.

[0.1.0]: https://github.com/2648782102/daily-persona/releases/tag/v0.1.0
