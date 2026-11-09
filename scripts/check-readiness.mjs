import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = JSON.parse(await readFile(path.join(root, 'plugin', 'plugin.json'), 'utf8'));
const mcp = JSON.parse(await readFile(path.join(root, 'plugin', 'mcp.json'), 'utf8'));
const endpoint = mcp.mcpServers.daily_persona.url;
const demo = plugin.extensions['com.openai'].review.demo_recording_url;

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
    id: 'policy-pages-source',
    status: 'done',
    evidence: 'site/ contains homepage, support, privacy, and terms pages',
  },
  {
    id: 'public-mcp-endpoint',
    status: endpoint.includes('REPLACE-WITH-PUBLIC-HOST') ? 'blocked' : 'needs-verification',
    evidence: endpoint,
  },
  {
    id: 'public-policy-urls',
    status: 'needs-verification',
    evidence: 'GitHub Pages URLs must return HTTPS 200 after deployment',
  },
  {
    id: 'domain-verification-challenge',
    status: 'blocked',
    evidence: 'Portal challenge token and deployed HTTPS host are required',
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
    id: 'portal-tool-scan',
    status: 'blocked',
    evidence: 'Requires uploaded ZIP, connected public MCP endpoint, and Platform dashboard access',
  },
  {
    id: 'codex-host-trace-evals',
    status: 'blocked',
    evidence: 'Run npm run host:eval with CODEX_HOME or an installed plugin after deployment',
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
