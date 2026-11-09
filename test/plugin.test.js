import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('plugin manifest has MCP review metadata', async () => {
  const manifest = JSON.parse(await readFile(new URL('../plugin/plugin.json', import.meta.url), 'utf8'));
  const openai = manifest.extensions['com.openai'];
  assert.equal(openai.review.test_cases.positive.length, 5);
  assert.equal(openai.review.test_cases.negative.length, 3);
  assert.match(openai.interface.privacyPolicyURL, /^https:\/\//);
  assert.match(openai.interface.termsOfServiceURL, /^https:\/\//);
});

test('plugin MCP config declares one public-shaped server and no embedded headers', async () => {
  const mcp = JSON.parse(await readFile(new URL('../plugin/mcp.json', import.meta.url), 'utf8'));
  const entries = Object.entries(mcp.mcpServers);
  assert.equal(entries.length, 1);
  assert.equal(entries[0][1].type, 'streamable-http');
  assert.deepEqual(entries[0][1].headers, undefined);
});

test('site policy pages include required disclosures', async () => {
  const privacy = await readFile(new URL('../site/privacy/index.html', import.meta.url), 'utf8');
  const terms = await readFile(new URL('../site/terms/index.html', import.meta.url), 'utf8');
  assert.match(privacy, /categories|Data returned/i);
  assert.match(privacy, /Retention/i);
  assert.match(terms, /Untrusted data/i);
  assert.ok(root.endsWith('/'));
});
