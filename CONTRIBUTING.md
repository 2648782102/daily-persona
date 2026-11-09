# Contributing

## Ground rules

- Keep the catalog versioned and deterministic. Any content change must update `version` and produce a new digest.
- Keep the catalog canonical and signed. Run `npm run sign -- format` before signing, then `npm run sign -- sign <private-key> <key-id>` and update `catalog/trusted-keys.json`; never commit private keys.
- Keep persona text inside the trust boundary. Do not add hidden instructions, tool calls, commands, URLs, permission changes, or override language.
- Prefer small, testable adapters over new global behavior.
- Do not add a daily cron job that commits `today.json`.

## Local checks

```bash
npm test
npm run check --silent
npm run verify --silent
npm run evals --silent
npm run today --silent
node test/stdio-smoke.js
```

Use Node.js 20 or newer. CI also runs Node 22 and 24.

## Pull requests

Describe the compatibility impact. If you change MCP tool schemas, update `docs/PROTOCOL.md`, the README, and tests in the same PR.
