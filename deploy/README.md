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

## Fly.io

`fly.toml` is a minimal deployment definition. Replace the placeholder app name, create the app, and deploy:

```bash
fly apps create daily-persona-your-name
fly deploy
```

Then configure Codex with `https://<your-app>.fly.dev/mcp`. This repository does **not** deploy infrastructure and does not claim a hosted endpoint is live. Flight credentials, DNS, TLS, and app ownership remain the operator's responsibility.

## Reverse proxy and TLS

For any other host, terminate TLS at a reverse proxy and forward `/mcp`, `/health`, and `/v1/*` to the container. Set `DAILY_PERSONA_ALLOWED_ORIGINS` if browser clients send an `Origin` header. If the proxy or host adds bearer-token authentication, configure it at the proxy or through the MCP host's header/bearer settings; this reference server does not store secrets.

## Signature rotation

1. Generate a new key pair locally with `node src/sign-cli.js keygen /private/key/dir`.
2. Add the new public key to `catalog/trusted-keys.json` with `status: "active"`.
3. Sign the canonical catalog with `node src/sign-cli.js sign /private/key/dir/private-key.pem <new-key-id>`.
4. Deploy the catalog, signature, and key ring together.
5. After clients have updated, mark the old key `retired` with a `retiredAt` timestamp. Re-signing after that timestamp with the old key is rejected.

Never commit the private key. `*.pem` and `deploy/private-keys/` are ignored by Git.
