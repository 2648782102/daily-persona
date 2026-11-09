import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = JSON.parse(await readFile(path.join(root, 'plugin', 'plugin.json'), 'utf8'));
const mcp = JSON.parse(await readFile(path.join(root, 'plugin', 'mcp.json'), 'utf8'));
const hostReport = JSON.parse(await readFile(path.join(root, 'evals', 'host-report.json'), 'utf8'));
const hostRubric = JSON.parse(await readFile(path.join(root, 'evals', 'host-rubric.json'), 'utf8'));
const endpoint = mcp.mcpServers.daily_persona.url;
const demo = plugin.extensions['com.openai'].review.demo_recording_url;
const hostChecksPass = hostReport.mode === 'real-codex-exec'
  && hostReport.checks.every((check) => check.status === 'pass');
const rubricPass = hostRubric.overall_pass === true;

const checks = [
  {
    id: 'portable-plugin-package',
    status: 'done',
    evidence: 'plugin/plugin.json, plugin/mcp.json, plugin/skills/, plugin/assets/',
  },
  {
    id: 'review-cases',
    status: 'done',
    evidence: '5 positive and 3 negative cases are validated by npm run package:check',
  },
  {
    id: 'sdk-mcp-conformance',
    status: 'done',
    evidence: 'test/mcp-sdk.test.js connects the official SDK client to the server in memory',
  },
  {
    id: 'domain-challenge-route',
    status: 'done',
    evidence: 'GET /.well-known/openai-apps-challenge returns DAILY_PERSONA_CHALLENGE_TOKEN as plain text',
  },
  {
    id: 'ci-matrix',
    status: 'done',
    evidence: 'GitHub Actions run 42663629663 passed npm ci, audit, tests, evals, SDK smoke, plugin check, and readiness on Node 20/22/24',
  },
  {
    id: 'policy-pages-source',
    status: 'done',
    evidence: 'site/ contains homepage, support, privacy, and terms pages',
  },
  {
    id: 'public-policy-urls',
    status: 'done',
    evidence: 'GitHub Pages workflow 42663629516 attempt 2 succeeded; website, support, privacy, and terms URLs returned public HTTPS 200 on 2026-11-10',
  },
  {
    id: 'codex-host-trace-evals',
    status: hostChecksPass && rubricPass ? 'done' : 'blocked',
    evidence: hostChecksPass
      ? 'evals/host-report.json records a 6/6 local Codex CLI stdio MCP run and evals/host-rubric.json records a passing trace rubric'
      : 'run npm run host:eval -- --run with CODEX_BIN, then npm run host:rubric',
  },
  {
    id: 'deployment-runbook',
    status: 'done',
    evidence: 'docs/OPERATIONS.md covers ownership, deployment, external acceptance, monitoring, rollback, evidence binder, and demo script',
  },
  {
    id: 'public-mcp-endpoint',
    status: endpoint.includes('REPLACE-WITH-PUBLIC-HOST') ? 'blocked' : 'needs-verification',
    evidence: endpoint,
  },
  {
    id: 'domain-verification-challenge',
    status: 'blocked',
    evidence: 'Portal challenge token and deployed HTTPS host are required',
  },
  {
    id: 'deployment-operations',
    status: 'blocked',
    evidence: 'Stable host ownership, TLS, logs, availability monitoring, incident contact, and an out-of-band key channel are not deployed; the runbook and Workers deploy workflow are ready',
  },
  {
    id: 'demo-recording-url',
    status: demo.startsWith('https://example.com/') ? 'blocked' : 'needs-verification',
    evidence: demo,
  },
  {
    id: 'openai-platform-identity',
    status: 'blocked',
    evidence: 'Verified developer identity and api.apps.write are external account prerequisites',
  },
  {
    id: 'live-mcp-conformance',
    status: 'blocked',
    evidence: 'Requires external HTTPS verification of initialize, tools/list, all tools/call cases, annotations, challenge, and rate limiting',
  },
  {
    id: 'portal-tool-scan',
    status: 'blocked',
    evidence: 'Requires uploaded ZIP, connected public MCP endpoint, and Platform dashboard access',
  },
  {
    id: 'directory-review-and-publish',
    status: 'blocked',
    evidence: 'Requires user-authorized OpenAI Platform submission and approval',
  },
];

assert.ok(checks.every((check) => ['done', 'blocked', 'needs-verification'].includes(check.status)));
const summary = Object.fromEntries(['done', 'blocked', 'needs-verification'].map((status) => [
  status,
  checks.filter((check) => check.status === status).length,
]));
process.stdout.write(`${JSON.stringify({ summary, checks }, null, 2)}\n`);
if (summary.blocked > 0 || summary['needs-verification'] > 0) {
  process.stdout.write('\nNOT READY: unresolved external prerequisites are listed above.\n');
}
