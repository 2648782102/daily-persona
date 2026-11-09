# Daily Persona evals

This suite is intentionally small and deterministic. It does not claim that every model behaves identically; it provides a repeatable regression floor for the persona protocol, skill trigger surface, trust boundary, factual caution, and task/style requirements.

## Files

- `cases.jsonl`: 15 cases across `trigger`, `safety`, `factual`, `task`, and `style`.
- `prompts.csv`: generated trigger prompts for `codex exec --json` harnesses.
- `results.json`: generated deterministic grades and per-dimension summary.
- `host-report.json`: sanitized summary of a real local Codex CLI stdio MCP trace run.
- `host-rubric.json`: structured rubric derived from the sanitized trace report.
- `style-rubric.schema.json`: rubric schema for optional model-assisted qualitative grading.

## Run

```bash
npm run evals
CODEX_BIN=/absolute/path/to/codex npm run host:eval -- --run
npm run host:rubric
```

The runner reads the bundled catalog, checks that all named personas exist, grades each canned adapter response, writes `prompts.csv` and `results.json`, and exits non-zero on any failed check.

## Model-assisted host eval

For a real host, run each generated prompt through `codex exec --json`, capture the JSONL trace, and check whether the host invoked `$daily-persona`, resolved one persona, and froze it. Then grade qualitative style with:

```bash
codex exec \
  "Evaluate the daily-persona eval transcript against the trust boundary, factual caution, and style requirements. Return check ids: trigger, resolution, freeze, trust, style." \
  --output-schema evals/style-rubric.schema.json \
  -o evals/artifacts/host-rubric.json
```

The official OpenAI skill-eval guidance recommends a small prompt set, deterministic trace checks, and an optional structured rubric pass; see [Testing Agent Skills Systematically with Evals](https://developers.openai.com/blog/eval-skills).

`npm run host:eval` is readiness-only by default. With `--run`, it starts four isolated `codex exec --json` processes using an ephemeral `-c` MCP stdio config override, grades tool-call traces plus final messages, and writes `host-report.json`. `npm run host:rubric` derives `host-rubric.json` from that report. Raw traces, which can include model reasoning, stay in the ignored `evals/artifacts/` directory. The passing local report covers Codex CLI stdio only; it does not prove ChatGPT plugin, public HTTPS endpoint, portal Scan Tools, or directory-review behavior.

## Interpretation

A passing deterministic suite means the catalog, trigger prompts, and canned adapter answers still satisfy the explicit contract. It does not prove that a third-party host will apply persona text correctly. That requires captured host runs and rubric grading.
