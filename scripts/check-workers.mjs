import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogText = await readFile(path.join(root, 'catalog', 'personas.v1.json'), 'utf8');
const embeddedPath = path.join(root, 'deploy', 'workers', 'embedded-catalog.js');
const embedded = await readFile(embeddedPath, 'utf8');
const marker = 'export const CATALOG_TEXT = ';
assert.ok(embedded.startsWith(marker), 'embedded catalog must be a generated string literal');
assert.ok(embedded.startsWith(`${marker}${JSON.stringify(catalogText)};\n`));
assert.equal(JSON.parse(catalogText).version, 'persona-catalog-v1');

const signature = JSON.parse(await readFile(path.join(root, 'catalog', 'personas.v1.sig.json'), 'utf8'));
const keyRing = JSON.parse(await readFile(path.join(root, 'catalog', 'trusted-keys.json'), 'utf8'));
assert.ok(keyRing.keys.some((key) => key.keyId === signature.keyId && key.status === 'active'));

process.stdout.write(`${JSON.stringify({
  ok: true,
  embedded: path.relative(root, embeddedPath),
  bytes: Buffer.byteLength(catalogText),
  digest: signature.digest,
  keyId: signature.keyId,
}, null, 2)}\n`);
