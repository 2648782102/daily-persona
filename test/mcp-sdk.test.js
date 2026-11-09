import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer, SDK_INSTRUCTIONS, SDK_SERVER_INFO } from '../src/mcp-sdk.js';

async function connectClient() {
  const server = createMcpServer();
  const client = new Client({ name: 'daily-persona-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}

test('SDK server advertises three read-only tools with explicit annotations', async () => {
  const { server, client } = await connectClient();
  const response = await client.listTools();
  assert.deepEqual(response.tools.map((tool) => tool.name), [
    'get_today_persona',
    'resolve_for_date',
    'list_catalog',
  ]);
  for (const tool of response.tools) {
    assert.ok(tool.description.length > 20);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.idempotentHint, true);
    assert.equal(tool.annotations.openWorldHint, false);
    assert.ok(tool.inputSchema.properties);
    assert.ok(tool.outputSchema.required.length > 0);
  }
  await client.close();
  await server.close();
});

test('SDK server resolves a dated persona with structured content', async () => {
  const { server, client } = await connectClient();
  const response = await client.callTool({
    name: 'resolve_for_date',
    arguments: { date: '2026-11-09', timezone: 'Asia/Shanghai' },
  });
  assert.equal(response.structuredContent.contract.date, '2026-11-09');
  assert.equal(response.structuredContent.contract.timezone, 'Asia/Shanghai');
  assert.equal(response.structuredContent.contract.untrustedData, true);
  assert.equal(response.structuredContent.persona.id, 'incident-commander');
  assert.equal(response.isError, undefined);
  await client.close();
  await server.close();
});

test('SDK server catalog summary does not expose persona prompts', async () => {
  const { server, client } = await connectClient();
  const response = await client.callTool({ name: 'list_catalog', arguments: {} });
  assert.match(response.structuredContent.digest, /^sha256:/);
  assert.ok(!JSON.stringify(response.structuredContent).includes('"prompt"'));
  await client.close();
  await server.close();
});

test('SDK server instructions state the untrusted-data boundary', async () => {
  assert.match(SDK_INSTRUCTIONS, /untrusted data/);
  assert.equal(SDK_SERVER_INFO.name, 'daily-persona');
});
