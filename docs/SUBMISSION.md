# Submission readiness

This document tracks the gap between a working repository and a public plugin directory listing. It is intentionally explicit about external prerequisites. Local passing checks are not evidence that hosting, domain verification, OpenAI Platform review, or publication has happened.

Official OpenAI Docs used for this checklist:

- [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission)
- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [Remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)

Run `npm run readiness` for the machine-readable status and `npm run package:check` for the plugin shape.

## What the official submission requires

- A stable, public HTTPS MCP endpoint submitted through **With MCP**. The endpoint must be reachable by OpenAI and must not be a local or testing URL.
- Exactly one connected MCP server for the plugin. The package declares one server in `plugin/mcp.json`.
- Domain verification by serving the portal's exact challenge token as plain text at `https://<challenge-base-host>/.well-known/openai-apps-challenge`.
- A portable plugin ZIP with root `plugin.json`, root `mcp.json`, `skills/`, and referenced assets. It must not contain app references or lifecycle hooks for public submission.
- Listing metadata: display name, short and long descriptions, developer name, category, capabilities, logo/composer icons, and four accessible HTTPS URLs for website, support, privacy, and terms.
- Exactly five positive and three negative review cases, release notes, and an accessible video walkthrough URL.
- Verified individual or business developer identity in the OpenAI Platform Dashboard, `api.apps.write` permission, and a project with global data residency.
- A successful **Connect / Scan Tools** flow with no unresolved automated findings. Read-only tools must advertise `readOnlyHint: true`, `destructiveHint: false`, and `openWorldHint: false` when those values match their behavior.
- Clear privacy policy covering data categories, purposes, recipients, retention, and user controls; no unnecessary personal or internal identifiers in tool responses.

## Done in this repository

| Item | Evidence | Limits |
| --- | --- | --- |
| Deterministic signed catalog | `npm run verify`, `npm run check`, `catalog/` | Signature proves bytes, not semantic trust. |
| Official SDK MCP server | `src/mcp-sdk.js`, `test/mcp-sdk.test.js`, `test/http-sdk-smoke.js` | Local in-memory and TCP checks only. |
| Explicit read-only tool annotations | `test/mcp-sdk.test.js` | Must be confirmed by OpenAI's live Scan Tools. |
| Domain challenge route | `src/http-server.js`, `test/http.test.js` | Token and public host come from the portal/deployment. |
| Portable plugin package | `plugin/plugin.json`, `plugin/mcp.json`, `plugin/skills/`, `plugin/assets/` | `npm run package:check` passes with warnings; ZIP is intentionally blocked until real URLs exist. |
| Review cases | `plugin/plugin.json` | Cases are authored and shape-validated; installed-plugin ChatGPT runs remain an external blocker. |
| Deployed policy pages | `site/`, GitHub Actions run `42663629516` attempt 2 | Website, support, privacy, and terms returned public HTTPS 200 on 2026-11-10. |
| Key rotation procedure and drill | `docs/KEY-TRUST.md`, `scripts/rotation-drill.mjs` | Out-of-band distribution still requires an operator channel. |
| CI and dependency audit | `.github/workflows/ci.yml`, GitHub Actions run `42663629663`, `npm audit --audit-level=low` | Passed on Node 20/22/24; CI success is not deployment or directory approval. |
| Real local Codex host trace | `evals/host-report.json`, `evals/host-rubric.json`, ignored raw traces in `evals/artifacts/` | A 6/6 `codex exec --json` run used an ephemeral stdio MCP override and a derived trace rubric. This covers local Codex CLI only, not ChatGPT plugin behavior or a public HTTPS endpoint. |
| Deployment and review runbook | `docs/OPERATIONS.md`, `deploy/workers/`, `.github/workflows/deploy-workers.yml` | Runbook, Workers source, local Worker tests, locked dependencies, Wrangler dry bundle, and a secret-gated deploy workflow exist; the public host, monitoring, incident owner, and demo recording still require an operator. |

## External blockers

| Blocker | Why it is external | What must be supplied |
| --- | --- | --- |
| Public HTTPS MCP host | The repository has no hosting credentials, domain, or deployed process. | A stable host/URL, deployment credentials, TLS, and monitoring. Do not create paid resources without explicit confirmation. |
| Domain challenge | OpenAI generates the exact token in the portal. | Portal token plus deployment of `DAILY_PERSONA_CHALLENGE_TOKEN` on the MCP host. |
| Public MCP operations and key trust | A stable deployment needs an owner, TLS, logs, monitoring, incident contact, and an out-of-band public-key channel. | Hosting credentials/domain, active monitoring and incident owner, and independent distribution of `catalog/trusted-keys.json`. The runbook is now authored. |
| Video walkthrough | Reviewer-accessible recording URL is a submission field. | A real recording URL demonstrating the five positive cases and the plugin behavior. |
| Verified developer identity | OpenAI Platform account verification is user/account-specific. | Verified identity and `api.apps.write`/`api.apps.read`; global data residency. |
| Live MCP conformance | In-memory and localhost smoke tests do not prove OpenAI can reach the public endpoint. | External initialize, tools/list, all tools/call, annotations, challenge, health, and rate-limit checks. |
| Portal ZIP upload and tool scan | Requires OpenAI Platform dashboard access. | Upload the corrected ZIP, connect the MCP server, resolve findings, and confirm scan metadata. |
| Installed ChatGPT plugin traces | Requires a signed-in ChatGPT host with the submitted plugin installed. | Captured positive/negative host traces after portal upload; the local Codex stdio run cannot substitute for this. |
| Submit for review and publish | Account-authorized action with policy attestations. | User-confirmed submission, approval, then publication. |

## Deployment contract

The production process must set:

```text
DAILY_PERSONA_HOST=0.0.0.0
DAILY_PERSONA_PORT=3399
DAILY_PERSONA_CHALLENGE_TOKEN=<portal challenge token>
DAILY_PERSONA_ALLOWED_ORIGINS=<explicit browser origins, if any>
DAILY_PERSONA_TRUST_PROXY=1
DAILY_PERSONA_HSTS=1
DAILY_PERSONA_RATE_LIMIT=120
```

Terminate TLS at the platform or reverse proxy. Keep the MCP origin stable: the submission docs say `scheme`, `hostname`, or `port` cannot change between versions of a published plugin. A later path change is allowed; a host change requires a new plugin.

Do not use API-key headers for public portal setup: the official submission page says the portal does not provide an API-key connection flow and rejects nonempty server headers. This plugin is designed as a no-auth, read-only public endpoint with rate limiting at the edge; if authentication becomes necessary, use a supported OAuth configuration and reviewer credentials in the dashboard.

Before replacing `plugin/mcp.json`, verify the live endpoint from outside the local network:

```bash
curl -fsS https://<host>/health
curl -fsS https://<host>/.well-known/openai-apps-challenge
```

Then run the external smoke script, which initializes MCP, lists tools, calls all three tools, checks annotations, and validates the challenge route:

```bash
DAILY_PERSONA_CHALLENGE_TOKEN=<portal challenge token> \
  npm run smoke:live --silent -- https://<host>
```

Record the script output as deployment evidence. It is a live endpoint smoke test, not OpenAI Platform Connect/Scan Tools or directory approval. Only after a passing external run should the placeholder URL, demo URL, and readiness statuses be changed.

## Validated local host eval

`evals/host-report.json` is a sanitized, reproducible summary from four `codex exec --json` runs using `codex-cli 0.167.0-alpha.3.2`:

- a dated resolution called `daily_persona.resolve_for_date` and returned `incident-commander` plus the expected catalog digest;
- a catalog listing called `daily_persona.list_catalog` and returned the catalog version without full persona prompts;
- a pinned task resolved once, stated the frozen persona/local-midnight contract, and made no second lookup;
- a privilege-escalation request was refused, invoked no privilege-changing tool, and preserved the untrusted-data boundary.

Raw JSONL traces and final messages are written to the ignored `evals/artifacts/` directory because they can contain model reasoning. Run the real harness with:

```bash
CODEX_BIN=/absolute/path/to/codex npm run host:eval -- --run
npm run host:rubric
```

The harness uses a single-command `-c mcp_servers.daily_persona=...` override and does not modify global Codex MCP configuration. This is evidence for a local Codex stdio integration only. It does not demonstrate that a public Streamable HTTP endpoint, ChatGPT plugin installation, portal Scan Tools, domain verification, or directory review works.

`evals/host-rubric.json` derives a structured rubric from the deterministic trace checks. It is not an independent model judge and does not claim qualitative persona-styling coverage.

## Packaging

`npm run package:zip` deliberately fails while `plugin/mcp.json` contains `REPLACE-WITH-PUBLIC-HOST` or the demo URL is `example.com`. This prevents accidentally uploading a package that cannot pass connection checks.

The ZIP is written to `dist/daily-persona-plugin.zip` and has the plugin directory as its root. It contains no private keys, local configs, `node_modules`, or repository history.

## Definition of done

The objective is met only when one of these is true:

1. The plugin is actually approved and published in the OpenAI plugin directory; or
2. Every repository-controlled item is done, every external blocker is explicitly documented with the required user/account action, and the user confirms that "ready to submit" is the desired stopping point.

Until then, do not describe the project as listed, approved, deployed, domain-verified, publicly host-evaluated, or submitted. Local Codex stdio host evaluation may be described only with its scope and limits.
