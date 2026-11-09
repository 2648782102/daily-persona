import assert from 'node:assert/strict';
import process from 'node:process';

const baseUrl = process.argv[2]?.replace(/\/+$/, '');
if (!baseUrl) {
  console.error('usage: node scripts/smoke-live-endpoint.mjs https://<public-host>');
  process.exit(2);
}
if (!baseUrl.startsWith('https://') || baseUrl.includes('REPLACE-WITH-PUBLIC-HOST')) {
  throw new Error('a real public HTTPS host is required');
}

const timeoutMs = Number.parseInt(process.env.DAILY_PERSONA_SMOKE_TIMEOUT_MS || '10000', 10);
const challengeExpected = process.env.DAILY_PERSONA_CHALLENGE_TOKEN || '';
const results = [];

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(new URL(path, `${baseUrl}/`), { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function record(name, pass, detail) {
  results.push({ name, status: pass ? 'pass' : 'fail', detail });
  assert.ok(pass, `${name}: ${detail}`);
}

const healthResponse = await request('/health');
const health = await healthResponse.json().catch(() => ({}));
record('health', healthResponse.ok && health.ok === true && health.signature?.status === 'verified', `HTTP ${healthResponse.status}`);

const challengeResponse = await request('/.well-known/openai-apps-challenge');
const challengeText = await challengeResponse.text();
record('challenge', challengeExpected
  ? challengeResponse.ok && challengeText === challengeExpected
  : challengeResponse.status === 404,
challengeExpected ? 'exact plain-text token' : '404 without a configured token');

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

async function mcpRequest(id, method, params = {}) {
  const response = await request('/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  assert.ok(response.ok, `${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  assert.ok(!payload.error, `${method} returned ${JSON.stringify(payload.error)}`);
  return payload.result;
}

const initialized = await mcpRequest(1, 'initialize', {
  protocolVersion: '2025-11-25',
  capabilities: {},
  clientInfo: { name: 'daily-persona-live-smoke', version: '0.3.0' },
});
record('initialize', initialized.serverInfo?.name === 'daily-persona' && /untrusted data/i.test(initialized.instructions || ''), initialized.protocolVersion || 'missing protocol version');

await request('/mcp', {
  method: 'POST',
  headers,
  body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
});

const listed = await mcpRequest(2, 'tools/list');
const names = listed.tools.map((tool) => tool.name);
record('tools/list', JSON.stringify(names) === JSON.stringify([
  'get_today_persona',
  'resolve_for_date',
  'list_catalog',
]), names.join(', '));
record('annotations', listed.tools.every((tool) => tool.annotations?.readOnlyHint === true
  && tool.annotations?.destructiveHint === false
  && tool.annotations?.idempotentHint === true
  && tool.annotations?.openWorldHint === false), 'all three tools advertise the read-only contract');

for (const [id, name, params] of [
  [3, 'get_today_persona', {}],
  [4, 'resolve_for_date', { date: '2026-11-09', timezone: 'Asia/Shanghai' }],
  [5, 'list_catalog', {}],
]) {
  const result = await mcpRequest(id, 'tools/call', { name, arguments: params });
  const content = result.structuredContent ?? JSON.parse(result.content?.[0]?.text ?? 'null');
  record(`tools/call:${name}`, Boolean(content) && !result.isError, 'structured response');
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  baseUrl,
  timestamp: new Date().toISOString(),
  checks: results,
  limitation: 'This is a live endpoint smoke test, not OpenAI Platform Connect/Scan Tools or directory approval.',
}, null, 2)}\n`);
