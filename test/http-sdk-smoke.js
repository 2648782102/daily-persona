import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 3461;
const serverPath = path.join(root, 'src', 'http-server.js');
const child = spawn(process.execPath, [serverPath], {
  cwd: root,
  env: {
    ...process.env,
    DAILY_PERSONA_HOST: '127.0.0.1',
    DAILY_PERSONA_PORT: String(port),
    DAILY_PERSONA_CHALLENGE_TOKEN: 'sdk-smoke-token',
    DAILY_PERSONA_RATE_LIMIT: '0',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});

let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => { stderr += chunk; });

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${stderr}`);
}

try {
  await waitForHealth();
  const challenge = await fetch(`http://127.0.0.1:${port}/.well-known/openai-apps-challenge`);
  assert.equal(challenge.status, 200);
  assert.equal(await challenge.text(), 'sdk-smoke-token');
  assert.equal(challenge.headers.get('x-frame-options'), 'DENY');

  const init = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'sdk-smoke', version: '1.0.0' },
      },
    }),
  });
  assert.ok(init.ok);
  assert.match(init.headers.get('content-type') || '', /application\/json|text\/event-stream/);
  const initPayload = await init.json();
  assert.equal(initPayload.result.serverInfo.name, 'daily-persona');
  assert.match(initPayload.result.instructions, /untrusted data/);

  const tools = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }),
  });
  assert.ok(tools.ok);
  const toolsPayload = await tools.json();
  assert.deepEqual(toolsPayload.result.tools.map((tool) => tool.name), [
    'get_today_persona',
    'resolve_for_date',
    'list_catalog',
  ]);
  assert.equal(toolsPayload.result.tools[0].annotations.readOnlyHint, true);

  process.stdout.write('sdk http smoke ok\n');
} finally {
  child.kill('SIGTERM');
  if (child.exitCode === null) await once(child, 'exit');
}
