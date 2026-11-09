# Deployment

The HTTP server is a stateless Node.js process. It serves REST/JSON and MCP Streamable HTTP from the same port. The container binds `0.0.0.0:3399`; local `npm run http` still binds `127.0.0.1:3399` by default.

## Build and run locally

```bash
docker build -t daily-persona:local .
docker run --rm -p 3399:3399 daily-persona:local
curl http://127.0.0.1:3399/health
curl http://127.0.0.1:3399/v1/today.json
```

If the Docker daemon is not running, the command fails with a socket connection error. Start Docker Desktop or OrbStack first. CI only builds the image when a daemon is available; this keeps the test suite reproducible on runners without container support.

The health endpoint includes the verified catalog signature status. If signature verification fails, the endpoint returns HTTP 500 instead of serving stale or tampered data.

The container now installs production dependencies from `package-lock.json`. The default HTTP MCP path uses the official MCP SDK Streamable HTTP transport. Set `DAILY_PERSONA_SDK_MCP=0` only for compatibility with the earlier hand-written adapter.

## Production environment

```text
DAILY_PERSONA_HOST=0.0.0.0
DAILY_PERSONA_PORT=3399
DAILY_PERSONA_CHALLENGE_TOKEN=<OpenAI portal domain challenge token>
DAILY_PERSONA_ALLOWED_ORIGINS=<explicit browser origins, if any>
DAILY_PERSONA_TRUST_PROXY=1
DAILY_PERSONA_HSTS=1
DAILY_PERSONA_RATE_LIMIT=120
```

The challenge endpoint returns 404 unless `DAILY_PERSONA_CHALLENGE_TOKEN` is set. Serve only the exact token as plain text. Do not put secrets or tokens in `plugin/mcp.json`: public plugin submission rejects nonempty server headers.

After DNS and TLS are active, run the external smoke test from a machine outside the hosting network:

```bash
DAILY_PERSONA_CHALLENGE_TOKEN=<portal challenge token> \
  npm run smoke:live --silent -- https://<host>
```

It checks `/health`, the exact challenge text, MCP initialize, tool listing, read-only annotations, and all three tool calls. A passing run is deployment evidence, not an OpenAI Platform approval.

## Fly.io

`fly.toml` is a minimal deployment definition. Replace the placeholder app name, create the app, and deploy:

```bash
fly apps create daily-persona-your-name
fly deploy
```

Then configure Codex with `https://<your-app>.fly.dev/mcp`. This repository does **not** deploy infrastructure and does not claim a hosted endpoint is live. Flight credentials, DNS, TLS, and app ownership remain the operator's responsibility.

## Cloudflare Workers

`deploy/workers/` provides a Web Standard Streamable HTTP MCP Worker with a free-tier-compatible deployment definition. Run `npm run workers:build` and `npm run workers:check` locally, then see `docs/OPERATIONS.md` for the `Deploy Workers` workflow, required secrets, and domain-challenge token. The Worker source passes local HTTP/MCP tests and a Wrangler dry bundle; no public Worker is deployed by this repository.

## Reverse proxy and TLS

For any other host, terminate TLS at a reverse proxy and forward `/mcp`, `/health`, and `/v1/*` to the container. Set `DAILY_PERSONA_ALLOWED_ORIGINS` if browser clients send an `Origin` header. If the proxy or host adds bearer-token authentication, configure it at the proxy or through the MCP host's header/bearer settings; this reference server does not store secrets.

## Signature rotation

Follow the out-of-band trust and rotation procedure in `docs/KEY-TRUST.md`, then run `npm run rotation:drill` to verify the overlap and retirement behavior. The short version is:

1. Generate a new key pair locally with `node src/sign-cli.js keygen /private/key/dir`.
2. Publish the new public key out of band and add it to `catalog/trusted-keys.json` with `status: "active"` while the old key remains active.
3. Confirm clients have the updated key ring.
4. Sign the canonical catalog with `node src/sign-cli.js sign /private/key/dir/private-key.pem <new-key-id>`.
5. Deploy the catalog, signature, and key ring together; verify externally.
6. After clients have updated, mark the old key `retired` with a `retiredAt` timestamp. Re-signing after that timestamp with the old key is rejected.

Never commit the private key. `*.pem` and `deploy/private-keys/` are ignored by Git.
