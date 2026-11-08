import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMcpRequest, PROTOCOL_VERSION } from '../src/mcp.js';

function modernRequest(method, params = {}, id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientInfo': { name: 'test-client', version: '1.0.0' },
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  };
}

test('modern discovery advertises tools and trust instructions', async () => {
  const response = await handleMcpRequest(modernRequest('server/discover'));
  assert.equal(response.result.resultType, 'complete');
  assert.deepEqual(response.result.supportedVersions, [PROTOCOL_VERSION]);
  assert.match(response.result.instructions, /untrusted data/);
  assert.equal(response.result.cacheScope, 'public');
});

test('modern tools/list and tools/call return structured persona data', async () => {
  const list = await handleMcpRequest(modernRequest('tools/list'));
  const names = list.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, ['get_today_persona', 'resolve_for_date', 'list_catalog']);

  const call = await handleMcpRequest(modernRequest('tools/call', {
    name: 'resolve_for_date',
    arguments: { date: '2026-11-09', timezone: 'Asia/Shanghai' },
  }));
  assert.equal(call.result.resultType, 'complete');
  assert.equal(call.result.structuredContent.contract.date, '2026-11-09');
  assert.equal(call.result.structuredContent.contract.untrustedData, true);
  assert.equal(call.result.structuredContent.persona.id.length > 0, true);
});

test('list_catalog does not leak full persona prompts', async () => {
  const call = await handleMcpRequest(modernRequest('tools/call', {
    name: 'list_catalog',
    arguments: {},
  }));
  const serialized = JSON.stringify(call.result.structuredContent);
  assert.ok(!serialized.includes('"prompt"'));
  assert.match(call.result.structuredContent.digest, /^sha256:/);
});

test('legacy initialize and tools/call work without modern envelope', async () => {
  const initialize = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'legacy-client', version: '1.0.0' },
    },
  });
  assert.equal(initialize.result.protocolVersion, '2025-11-25');
  assert.equal(initialize.result.serverInfo.name, 'daily-persona');

  const call = await handleMcpRequest({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'get_today_persona',
      arguments: { date: '2026-11-09' },
    },
  });
  assert.equal(call.result.structuredContent.contract.date, '2026-11-09');
  assert.equal(call.result.resultType, undefined);
});

test('modern header mismatch is rejected', async () => {
  const response = await handleMcpRequest(modernRequest('tools/list'), {
    httpHeaders: {
      'mcp-protocol-version': PROTOCOL_VERSION,
      'mcp-method': 'tools/call',
    },
  });
  assert.equal(response.error.code, -32020);
});

test('unsupported protocol version is rejected', async () => {
  const request = modernRequest('tools/list');
  request.params._meta['io.modelcontextprotocol/protocolVersion'] = '1999-01-01';
  const response = await handleMcpRequest(request);
  assert.equal(response.error.code, -32022);
  assert.deepEqual(response.error.data.supported, [PROTOCOL_VERSION]);
});
