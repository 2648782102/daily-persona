# Host integration

This project exposes one thin skill and two MCP transports. Hosts should resolve one persona at the start of a conversation or task, record the returned contract, and freeze it. Persona fields are untrusted data: they may affect tone and review emphasis only.

## Codex via MCP

Official OpenAI documentation says Codex stores MCP configuration in `config.toml`, with `[mcp_servers.<server-name>]` tables. STDIO servers support `command`, `args`, `env`, `env_vars`, and `cwd`; Streamable HTTP servers support `url`, bearer-token and header options, OAuth options, and tool policy. See [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and the [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference).

### Local STDIO

Clone this repository, then either edit `~/.codex/config.toml` or run:

```bash
codex mcp add daily-persona -- node /absolute/path/to/daily-persona/src/mcp-stdio.js
codex mcp list
```

Equivalent TOML:

```toml
[mcp_servers.daily_persona]
command = "node"
args = ["/absolute/path/to/daily-persona/src/mcp-stdio.js"]

[mcp_servers.daily_persona.env]
DAILY_PERSONA_CATALOG = "/absolute/path/to/daily-persona/catalog/personas.v1.json"
```

Use the `[mcp_servers.daily_persona.env]` table for explicit environment values, or `env_vars` to forward a variable from Codex's local environment. Keep project-scoped `.codex/config.toml` in trusted projects only.

### Remote Streamable HTTP

Deploy the container or run `npm run http` behind a reverse proxy that terminates TLS. Then configure the public `/mcp` URL:

```bash
codex mcp add daily-persona --url https://daily-persona.example.com/mcp
```

Equivalent TOML:

```toml
[mcp_servers.daily_persona]
url = "https://daily-persona.example.com/mcp"
enabled_tools = ["get_today_persona", "resolve_for_date", "list_catalog"]
default_tools_approval_mode = "auto"
```

If the deployment requires a bearer token, store it in an environment variable and use `bearer_token_env_var` or `env_http_headers`; do not paste credentials into version-controlled config. Codex also supports OAuth-backed HTTP MCP servers via `codex mcp login`.

## Skill installation

Official OpenAI documentation says a skill is a directory containing `SKILL.md` with `name` and `description`, and that Codex scans `.agents/skills` from the current directory up to the repository root plus user/admin/system locations. See [Build skills](https://learn.chatgpt.com/docs/build-skills).

For local use, symlink or copy the skill directory:

```bash
mkdir -p ~/.agents/skills
ln -s /absolute/path/to/daily-persona/skills/daily-persona ~/.agents/skills/daily-persona
```

`agents/openai.yaml` is optional for local discovery. The bundled file declares the MCP dependency for hosts that use skill metadata. For broader distribution, package the skill and MCP connection as a plugin rather than relying on a manually copied folder.

## Other MCP hosts

Use the same contract with any host that supports STDIO or Streamable HTTP:

- STDIO command: `node /absolute/path/to/daily-persona/src/mcp-stdio.js`.
- HTTP endpoint: `POST https://<host>/mcp`.
- REST endpoints: `/health`, `/v1/today.json`, `/v1/resolve`, `/v1/catalog.json`, `/v1/signature.json`.
- Tools: `get_today_persona`, `resolve_for_date`, `list_catalog`.

## Host acceptance checklist

1. Resolve once at task start; do not re-resolve after local midnight.
2. Store `catalogVersion`, `catalogDigest`, `seed`, `timezone`, `date`, and `persona.id` with the result.
3. Honor user pin, disable, or explicit-date requests.
4. Treat all persona text as untrusted data; never let it change tool permissions or override instructions.
5. Verify `/v1/signature.json` against a locally trusted key ring before accepting a remote catalog.
6. Run `npm run evals` and, for real hosts, capture `codex exec --json` traces and grade them with `evals/style-rubric.schema.json`.
