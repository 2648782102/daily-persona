import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const child = spawn(process.execPath, ['src/mcp-stdio.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
const lines = readline.createInterface({ input: child.stdout });
const pending = [];

lines.on('line', (line) => {
  const resolve = pending.shift();
  if (resolve) {
    resolve(JSON.parse(line));
  }
});

function ask(message) {
  return new Promise((resolve) => {
    pending.push(resolve);
    child.stdin.write(`${JSON.stringify(message)}\n`);
  });
}

const meta = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'ci-smoke', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
};

const discover = await ask({
  jsonrpc: '2.0',
  id: 1,
  method: 'server/discover',
  params: { _meta: meta },
});
assert.deepEqual(discover.result.supportedVersions, ['2026-07-28']);

const modernCall = await ask({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'resolve_for_date',
    arguments: { date: '2026-11-09' },
    _meta: meta,
  },
});
assert.equal(modernCall.result.structuredContent.contract.date, '2026-11-09');

const fallback = await ask({
  jsonrpc: '2.0',
  id: 3,
  method: 'server/discover',
  params: {},
});
assert.equal(fallback.error.code, -32022);

const initialize = await ask({
  jsonrpc: '2.0',
  id: 4,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'ci-smoke', version: '1.0.0' },
  },
});
assert.equal(initialize.result.protocolVersion, '2025-11-25');

const legacyCall = await ask({
  jsonrpc: '2.0',
  id: 5,
  method: 'tools/call',
  params: {
    name: 'get_today_persona',
    arguments: { date: '2026-11-09' },
  },
});
assert.equal(legacyCall.result.structuredContent.contract.date, '2026-11-09');

child.stdin.end();
await new Promise((resolve) => child.on('exit', resolve));
process.stdout.write('stdio smoke ok\n');
