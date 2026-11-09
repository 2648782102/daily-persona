import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadSignedCatalog, generateSigningKeyPair, signCatalog, verifyCatalogSignature } from '../src/signing.js';

const signed = await loadSignedCatalog();
const first = generateSigningKeyPair();
const second = generateSigningKeyPair();

function publicPem(keyPair) {
  return keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

function privatePem(keyPair) {
  return keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function ring(entries) {
  return { version: 'daily-persona-keys/v1', keys: entries };
}

const activeFirst = ring([
  { keyId: 'key-old', status: 'active', publicKey: publicPem(first) },
]);
const overlap = ring([
  { keyId: 'key-old', status: 'active', publicKey: publicPem(first) },
  { keyId: 'key-new', status: 'active', publicKey: publicPem(second) },
]);
const retiredOld = ring([
  { keyId: 'key-old', status: 'retired', retiredAt: '2026-11-10T00:00:00.000Z', publicKey: publicPem(first) },
  { keyId: 'key-new', status: 'active', publicKey: publicPem(second) },
]);

const temp = await mkdtemp(path.join(os.tmpdir(), 'daily-persona-rotation-'));
try {
  const catalogPath = path.join(temp, 'catalog.json');
  const catalogText = await readFile(signed.paths.catalogPath, 'utf8');
  await writeFile(catalogPath, catalogText, 'utf8');
  const oldSignature = await signCatalog({
    catalogPath,
    privateKey: privatePem(first),
    keyId: 'key-old',
    now: new Date('2026-11-09T00:00:00.000Z'),
  });
  const newSignature = await signCatalog({
    catalogPath,
    privateKey: privatePem(second),
    keyId: 'key-new',
    now: new Date('2026-11-10T01:00:00.000Z'),
  });

  assert.equal(verifyCatalogSignature(catalogText, oldSignature.signature, activeFirst, {
    now: new Date('2026-11-09T00:00:00.000Z'),
  }).keyId, 'key-old');
  assert.equal(verifyCatalogSignature(catalogText, newSignature.signature, overlap, {
    now: new Date('2026-11-10T01:00:00.000Z'),
  }).keyId, 'key-new');
  assert.equal(verifyCatalogSignature(catalogText, oldSignature.signature, retiredOld, {
    now: new Date('2026-11-09T00:00:00.000Z'),
  }).keyStatus, 'retired');
  assert.throws(() => verifyCatalogSignature(catalogText, {
    ...oldSignature.signature,
    createdAt: '2026-11-10T01:00:00.000Z',
  }, retiredOld, { now: new Date('2026-11-10T01:00:00.000Z') }), /retired/);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    rotationOrder: [
      'publish old active key out of band',
      'publish new active key alongside old key',
      'sign catalog with new key',
      'clients refresh key ring and verify new signature',
      'retire old key with retiredAt',
      'revoke immediately on suspected compromise',
    ],
    verified: ['old-key signature', 'overlap signature', 'retired-key pre-cutoff signature', 'post-cutoff rejection'],
  }, null, 2)}\n`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
