import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { handleWorkerRequest } from '../deploy/workers/src/server.js';
import { loadCatalog } from '../src/catalog.js';
import { resolveForDate } from '../src/resolve.js';

const env = { DAILY_PERSONA_CHALLENGE_TOKEN: 'worker-domain-token' };

function request(url, options = {}) {
  return new Request(`https://daily-persona.example${url}`, options);
}

async function callMcp(id, method, params) {
  const response = await handleWorkerRequest(request('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  }), env, {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(!payload.error, JSON.stringify(payload.error));
  return payload.result;
}

test('Worker verifies the embedded catalog signature', async () => {
  const health = await handleWorkerRequest(request('/health'), env, {});
  assert.equal(health.status, 200);
  const payload = await health.json();
  assert.equal(payload.signature.status, 'verified');
  assert.match(payload.signature.digest, /^sha256:[a-f0-9]{64}$/);
});

test('Worker serves the exact plain-text domain challenge', async () => {
  const response = await handleWorkerRequest(request('/.well-known/openai-apps-challenge'), env, {});
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'worker-domain-token');
  assert.match(response.headers.get('content-type'), /^text\/plain/);
});

test('Worker resolution matches the Node protocol for a dated persona', async () => {
  const catalog = await loadCatalog();
  const expected = resolveForDate(catalog, { date: '2026-11-09', timezone: 'Asia/Shanghai' });
  const raw = await handleWorkerRequest(request('/v1/resolve?date=2026-11-09&timezone=Asia%2FShanghai'), env, {});
  assert.equal(raw.status, 200);
  assert.deepEqual(await raw.json(), expected);
});

test('Worker MCP initializes, lists read-only tools, and calls tools', async () => {
  const initialized = await callMcp(1, 'initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'worker-test', version: '1.0.0' },
  });
  assert.equal(initialized.serverInfo.name, 'daily-persona');
  assert.match(initialized.instructions, /untrusted data/i);

  await handleWorkerRequest(request('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  }), env, {});

  const listed = await callMcp(2, 'tools/list', {});
  assert.deepEqual(listed.tools.map((tool) => tool.name), [
    'get_today_persona',
    'resolve_for_date',
    'list_catalog',
  ]);
  assert.ok(listed.tools.every((tool) => tool.annotations.readOnlyHint === true
    && tool.annotations.destructiveHint === false
    && tool.annotations.idempotentHint === true
    && tool.annotations.openWorldHint === false));

  for (const [id, name, args] of [
    [3, 'get_today_persona', {}],
    [4, 'resolve_for_date', { date: '2026-11-09', timezone: 'Asia/Shanghai' }],
    [5, 'list_catalog', {}],
  ]) {
    const result = await callMcp(id, 'tools/call', { name, arguments: args });
    assert.ok(result.structuredContent, `${name} returned structured content`);
  }
});

test('Worker embedded catalog remains byte-identical to the signed source', async () => {
  const source = await readFile(new URL('../catalog/personas.v1.json', import.meta.url), 'utf8');
  const embedded = await readFile(new URL('../deploy/workers/embedded-catalog.js', import.meta.url), 'utf8');
  assert.ok(embedded.startsWith(`export const CATALOG_TEXT = ${JSON.stringify(source)};\n`));
});
