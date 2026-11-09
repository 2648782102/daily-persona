# Deployment and review operations

This runbook is for the person who owns a public `daily-persona` MCP deployment. It does not claim that a deployment, domain verification, OpenAI Platform review, or publication has happened.

## Ownership prerequisites

Before creating a public endpoint, record these outside the repository:

- platform/account owner and billing responsibility;
- stable hostname and TLS certificate owner;
- log retention, availability monitoring, alert destination, and rollback owner;
- public support and incident contact;
- out-of-band location for the trusted Ed25519 public-key ring;
- OpenAI Platform developer identity and `api.apps.write` / `api.apps.read` status.

Do not use a temporary tunnel, localhost URL, or an API-key header for public plugin submission. Official submission guidance rejects nonempty server headers in the portal connection flow, and the published MCP scheme/hostname/port must remain stable between plugin versions.

## Deploy

The container binds `0.0.0.0:3399` and terminates TLS at the platform or a reverse proxy. Required process settings:

```text
DAILY_PERSONA_HOST=0.0.0.0
DAILY_PERSONA_PORT=3399
DAILY_PERSONA_CHALLENGE_TOKEN=<exact portal token>
DAILY_PERSONA_ALLOWED_ORIGINS=<explicit browser origins, if any>
DAILY_PERSONA_TRUST_PROXY=1
DAILY_PERSONA_HSTS=1
DAILY_PERSONA_RATE_LIMIT=120
```

Deploy the catalog, signature, and trusted-key ring together. Publish `catalog/trusted-keys.json` through an out-of-band channel; do not ask clients to bootstrap trust from `/v1/signature.json` alone. See `docs/KEY-TRUST.md`.

## External acceptance

From a machine outside the hosting network:

```bash
curl -fsS https://<host>/health
curl -fsS https://<host>/.well-known/openai-apps-challenge
DAILY_PERSONA_CHALLENGE_TOKEN=<exact portal token> \
  npm run smoke:live --silent -- https://<host>
```

The smoke script checks health, the exact challenge text, MCP initialize, tools/list, read-only annotations, and all three tool calls. Save its output as deployment evidence. Then verify rate limiting and HTTPS/TLS behavior from the platform dashboard or reverse-proxy logs.

Only after those checks pass:

1. Replace `plugin/mcp.json`'s `REPLACE-WITH-PUBLIC-HOST` with the verified `https://<host>/mcp`.
2. Replace `demo_recording_url` in `plugin/plugin.json` with a reviewer-accessible recording.
3. Run `npm run package:check`, `npm run package:zip`, and inspect the ZIP root.
4. Run `npm run readiness` and update only the statuses that live evidence supports.

## Monitoring

At minimum, alert on:

- `/health` failures or a non-verified catalog signature;
- sustained 4xx/5xx from `/mcp`;
- challenge-route changes or disappearance;
- rate-limit saturation;
- TLS certificate expiry and origin unreachability.

The reference server is stateless and does not persist tool inputs or outputs. Hosting infrastructure can still receive IP addresses, request times, and standard network metadata; the privacy policy describes this boundary. Keep request bodies out of logs.

## Rollback and key compromise

- Roll back the application by redeploying the previous immutable image/tag; do not silently replace an already published catalog version.
- If the private signing key may be exposed, follow `docs/KEY-TRUST.md`: publish a replacement active key out of band, sign with the new key, retire the old key with a cutoff, invalidate caches, and publish an incident note.
- If the MCP hostname/scheme/port changes, treat it as a new plugin because published versions require a stable MCP origin.

## Review evidence binder

Keep these artifacts together for submission:

- plugin ZIP and `npm run package:check` output;
- `npm run readiness` output after real URL replacement;
- external `npm run smoke:live` output;
- Portal Connect and Scan Tools results;
- `evals/host-report.json` and `evals/host-rubric.json` for local Codex stdio evidence;
- demo walkthrough URL and five positive-case script below;
- release notes and the privacy/support/terms URLs.

The local Codex report is not a substitute for an installed ChatGPT plugin trace or OpenAI Platform approval.

## Demo walkthrough script

Record a continuous, reviewer-accessible video showing:

1. Resolve today's persona once; state the frozen date and timezone.
2. Resolve `2026-11-09` in `Asia/Shanghai`; show that repeated resolution returns the same persona and digest.
3. List the catalog; show metadata and persona IDs without full prompt text.
4. Apply the resolved persona as a short review checklist while preserving factual accuracy and the untrusted-data contract.
5. Pin `2026-11-09` for a task and explain that local midnight does not re-resolve the frozen result.

Then show one negative case: ask for admin permissions or a safety-rule override and show that the host refuses without a privilege-changing tool call. Do not include credentials, private keys, personal data, or portal tokens in the recording.
