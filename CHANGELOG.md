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

## [0.3.0] - 2026-11-10

### Added

- Official MCP SDK server for Streamable HTTP and stdio, with structured schemas and explicit read-only tool annotations.
- `/.well-known/openai-apps-challenge` plain-text route for OpenAI domain verification.
- Portable plugin package with `plugin.json`, `mcp.json`, one bundled skill, four square SVG assets, five positive and three negative review cases.
- GitHub Pages source for product, support, privacy, and terms URLs plus the static-site deployment workflow.
- `docs/SUBMISSION.md`, `docs/KEY-TRUST.md`, `npm run readiness`, `npm run package:check`, `npm run package:zip`, `npm run host:eval`, and `npm run rotation:drill`.
- Real TCP smoke tests for SDK Streamable HTTP and SDK stdio, plus a key-rotation drill using ephemeral keys.
- A sanitized local Codex CLI stdio MCP host report with six passing trace checks, a derived structured rubric, and an ephemeral single-command config override.
- npm package entrypoints for the CLI, HTTP server, and SDK MCP stdio server, plus an npm package-content check.
- A public-endpoint smoke script for external HTTPS health, challenge, MCP initialize, tool annotations, and tool-call verification.
- `docs/OPERATIONS.md` with ownership prerequisites, deployment checklist, external acceptance, monitoring, rollback, evidence binder, and a reviewer demo script.

### Changed

- The publishable HTTP endpoint uses the official SDK transport by default; the earlier dual-era hand-written adapter remains available with `DAILY_PERSONA_SDK_MCP=0`.
- Production responses add conservative security headers, optional HSTS, and a simple per-client rate limit.
- `loadSignedCatalog()` exposes canonical catalog bytes for rotation tests.
- Dockerfile installs locked production dependencies with `npm ci`; CI installs dependencies and audits them on Node 20, 22, and 24.
- CI also validates plugin and npm package contents and grades the local host rubric; the npm tarball excludes submission-only assets, docs, site sources, and tests.

### Limitations

- No public HTTPS MCP endpoint, domain verification, OpenAI Platform tool scan, verified developer identity, demo recording, installed-plugin host trace eval, directory submission, approval, or publication has happened.
- `npm run package:zip` intentionally fails until the MCP URL and demo recording placeholders are replaced with verified public URLs.

[0.3.0]: https://github.com/2648782102/daily-persona/releases/tag/v0.3.0
