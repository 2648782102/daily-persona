import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const child = spawn(process.execPath, [path.join(root, 'src', 'mcp-stdio-sdk.js')], {
  cwd: root,
  stdio: ['pipe', 'pipe', 'inherit'],
});

const responses = [];
let buffer = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines.filter(Boolean)) responses.push(JSON.parse(line));
});

function send(request) {
  child.stdin.write(`${JSON.stringify(request)}\n`);
}

async function waitForResponses(count) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (responses.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('timed out waiting for SDK stdio responses');
}

try {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'sdk-stdio-test', version: '1.0.0' },
    },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'resolve_for_date', arguments: { date: '2026-11-09' } },
  });
  await waitForResponses(3);
  assert.equal(responses[0].result.serverInfo.name, 'daily-persona');
  assert.deepEqual(responses[1].result.tools.map((tool) => tool.name), [
    'get_today_persona',
    'resolve_for_date',
    'list_catalog',
  ]);
  assert.equal(responses[2].result.structuredContent.contract.date, '2026-11-09');
  process.stdout.write('sdk stdio smoke ok\n');
} finally {
  child.stdin.end();
  if (child.exitCode === null) await once(child, 'exit');
}
