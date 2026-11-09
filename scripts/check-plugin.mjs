import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(root, 'plugin');
const manifestPath = path.join(pluginRoot, 'plugin.json');
const mcpPath = path.join(pluginRoot, 'mcp.json');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const mcp = JSON.parse(await readFile(mcpPath, 'utf8'));
const extension = manifest.extensions?.['com.openai'];
const iface = extension?.interface;

assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
assert.match(manifest.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.ok(manifest.description.length <= 4000);
assert.ok(iface, 'extensions.com.openai.interface is required');
assert.ok(iface.displayName.length <= 30);
assert.ok(iface.shortDescription.length <= 30);
assert.ok(iface.longDescription.length <= 4000);
assert.ok(iface.developerName.length <= 80);
assert.ok(Array.isArray(iface.capabilities) && iface.capabilities.length <= 20);

for (const field of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
  assert.match(iface[field], /^https:\/\//, `${field} must be HTTPS`);
}

const iconFields = ['composerIcon', 'composerIconDark', 'logo', 'logoDark'];
for (const field of iconFields) {
  assert.ok(iface[field].startsWith('./assets/'));
  const iconPath = path.join(pluginRoot, iface[field]);
  const info = await stat(iconPath);
  assert.ok(info.size > 0 && info.size <= 5 * 1024 * 1024, `${field} must be non-empty and <=5 MiB`);
  const text = await readFile(iconPath, 'utf8');
  assert.match(text, /width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/);
  const [, width, height] = text.match(/width="(\d+)" height="(\d+)"/);
  assert.equal(width, height);
  assert.ok(Number(width) >= 48);
}

assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
const servers = Object.entries(mcp.mcpServers);
assert.equal(servers.length, 1, 'public submission connects exactly one MCP server');
const [serverName, server] = servers[0];
assert.equal(serverName, 'daily_persona');
assert.equal(server.type, 'streamable-http');
assert.ok(!server.headers || Object.keys(server.headers).length === 0, 'public submission rejects server headers');
assert.ok(!server.auth || server.auth.type === 'none', 'do not package protected headers or credentials');

const positive = extension.review?.test_cases?.positive ?? [];
const negative = extension.review?.test_cases?.negative ?? [];
assert.equal(positive.length, 5);
assert.equal(negative.length, 3);
for (const testCase of positive) {
  for (const field of ['description', 'prompt', 'tools_triggered', 'expected_behavior']) {
    assert.ok(typeof testCase[field] === 'string' && testCase[field].length > 0, `${field} is required`);
  }
}
for (const testCase of negative) {
  assert.ok(testCase.description && testCase.prompt);
}

assert.ok(!JSON.stringify(manifest).includes('test_credentials'));
assert.ok(!JSON.stringify(manifest).includes('reviewer_instructions'));
assert.ok(!JSON.stringify(manifest).includes('REPLACE-WITH-PUBLIC-HOST'));

const skillPath = path.join(pluginRoot, extension.onboardingSkill);
const skill = await readFile(skillPath, 'utf8');
assert.match(skill, /^---\nname: daily-persona\ndescription: .+\n---/);

const files = await readdir(pluginRoot, { recursive: true });
assert.ok(files.includes('plugin.json'));
assert.ok(files.includes('mcp.json'));

const warnings = [];
if (mcp.mcpServers.daily_persona.url.includes('REPLACE-WITH-PUBLIC-HOST')) {
  warnings.push('MCP URL is still a placeholder; provide a deployed HTTPS endpoint before portal upload.');
}
if (extension.review.demo_recording_url.startsWith('https://example.com/')) {
  warnings.push('Demo recording URL is still a placeholder; provide a reviewer-accessible recording.');
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  manifest: path.relative(root, manifestPath),
  mcpServers: servers.length,
  positiveCases: positive.length,
  negativeCases: negative.length,
  warnings,
}, null, 2)}\n`);
