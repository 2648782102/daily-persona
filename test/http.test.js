import assert from 'node:assert/strict';
import test from 'node:test';
import { handleHttpRequest } from '../src/http-server.js';
import { PROTOCOL_VERSION } from '../src/mcp.js';

function request(method, url, headers = {}, body = '') {
  return { method, url, headers, body };
}

function parseBody(result) {
  return JSON.parse(result.body);
}

test('today.json returns deterministic persona and cache headers', async () => {
  const result = await handleHttpRequest(request(
    'GET',
    '/v1/today.json?date=2026-11-09&timezone=Asia%2FShanghai',
  ));
  assert.equal(result.status, 200);
  assert.match(result.headers.ETag, /^"/);
  assert.match(result.headers['Cache-Control'], /max-age=/);
  const payload = parseBody(result);
  assert.equal(payload.contract.date, '2026-11-09');
  assert.equal(payload.contract.untrustedData, true);
});

test('health reports verified catalog signature', async () => {
  const result = await handleHttpRequest(request('GET', '/health'));
  assert.equal(result.status, 200);
  const payload = parseBody(result);
  assert.equal(payload.signature.status, 'verified');
  assert.match(payload.signature.digest, /^sha256:[a-f0-9]{64}$/);
});

test('signature endpoint exposes a verifiable public key and signature', async () => {
  const result = await handleHttpRequest(request('GET', '/v1/signature.json'));
  assert.equal(result.status, 200);
  const payload = parseBody(result);
  assert.equal(payload.verification, 'verified-by-server');
  assert.equal(payload.algorithm, 'Ed25519');
  assert.match(payload.publicKey, /BEGIN PUBLIC KEY/);
  assert.match(payload.signature, /^[A-Za-z0-9+/]+={0,2}$/);
});

test('raw catalog is served for independent verification', async () => {
  const result = await handleHttpRequest(request('GET', '/v1/catalog.raw.json'));
  assert.equal(result.status, 200);
  assert.equal(parseBody(result).version, 'persona-catalog-v1');
});

test('ETag conditional request returns 304', async () => {
  const first = await handleHttpRequest(request('GET', '/v1/catalog.json'));
  const second = await handleHttpRequest(request('GET', '/v1/catalog.json', {
    'if-none-match': first.headers.ETag,
  }));
  assert.equal(second.status, 304);
  assert.equal(second.body, '');
});

test('MCP POST validates headers and returns structured persona', async () => {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: {
      name: 'resolve_for_date',
      arguments: { date: '2026-11-09' },
      _meta: {
        'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  });
  const result = await handleHttpRequest(request('POST', '/mcp', {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    'Mcp-Method': 'tools/call',
    'Mcp-Name': 'resolve_for_date',
  }, body));
  assert.equal(result.status, 200);
  assert.equal(parseBody(result).result.structuredContent.contract.date, '2026-11-09');
});

test('MCP POST rejects header mismatch', async () => {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 8,
    method: 'tools/list',
    params: {
      _meta: {
        'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  });
  const result = await handleHttpRequest(request('POST', '/mcp', {
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    'Mcp-Method': 'tools/call',
  }, body));
  assert.equal(result.status, 400);
  assert.equal(parseBody(result).error.code, -32020);
});

test('foreign Origin is rejected for MCP POST', async () => {
  const result = await handleHttpRequest(request('POST', '/mcp', {
    'Content-Type': 'application/json',
    Origin: 'https://evil.example',
  }, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })));
  assert.equal(result.status, 403);
});

test('unknown paths and unsupported methods are rejected', async () => {
  const missing = await handleHttpRequest(request('GET', '/nope'));
  assert.equal(missing.status, 404);
  const badMethod = await handleHttpRequest(request('PUT', '/v1/catalog.json'));
  assert.equal(badMethod.status, 405);
});
