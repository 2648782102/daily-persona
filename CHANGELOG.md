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

## [0.2.0] - 2026-11-10

### Added

- Canonical catalog signing with Ed25519, a trusted public-key ring, active/retired key rotation, and independent raw-catalog verification.
- `npm run verify`, `src/sign-cli.js`, `/v1/signature.json`, and `/v1/catalog.raw.json`.
- A 15-case deterministic eval suite covering trigger, safety, factual caution, task completion, and style, plus an optional structured rubric schema.
- `docs/HOSTS.md` with official Codex MCP and skill integration guidance, host acceptance checklist, and `agents/openai.yaml` MCP dependency metadata.
- `Dockerfile`, `fly.toml`, `.dockerignore`, and `deploy/README.md` for a self-hosted Streamable HTTP endpoint.
- CI steps for signature verification, evals, and container image build.

### Changed

- The bundled catalog is now canonical JSON; its digest is `sha256:7adfcff3d69f191cd46dfe14833fb3831abd70bc7be730a4f1d5afb02d5cd82b`.
- `/health` now reports verified signature status and fails closed when verification fails.
- README and protocol docs describe signing, key rotation, eval limits, and deployment boundaries.

### Limitations

- No public hosted endpoint is operated by this repository; `fly.toml` is a deployment template.
- Deterministic evals do not prove third-party model behavior; host runs still need captured traces and rubric grading.

[0.2.0]: https://github.com/2648782102/daily-persona/releases/tag/v0.2.0
