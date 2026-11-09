import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { canonicalCatalog, loadCatalog } from '../src/catalog.js';
import { loadSignedCatalog, signCatalog, verifyCatalogSignature } from '../src/signing.js';

const catalogPath = fileURLToPath(new URL('../catalog/personas.v1.json', import.meta.url));
const signaturePath = fileURLToPath(new URL('../catalog/personas.v1.sig.json', import.meta.url));
const keysPath = fileURLToPath(new URL('../catalog/trusted-keys.json', import.meta.url));

async function fixture() {
  const [catalogText, signature, keyRing] = await Promise.all([
    readFile(catalogPath, 'utf8'),
    readFile(signaturePath, 'utf8').then(JSON.parse),
    readFile(keysPath, 'utf8').then(JSON.parse),
  ]);
  return { catalogText, signature, keyRing };
}

test('bundled catalog is canonical and has a verified signature', async () => {
  const catalog = await loadCatalog();
  const raw = await readFile(catalog.source, 'utf8');
  assert.equal(raw, canonicalCatalog(catalog));
  const signed = await loadSignedCatalog();
  assert.equal(signed.catalog.digest, catalog.digest);
  assert.equal(signed.signature.ok, true);
  assert.equal(signed.signature.keyStatus, 'active');
});

test('signature verification rejects modified catalog bytes', async () => {
  const { catalogText, signature, keyRing } = await fixture();
  const modified = catalogText.replace('安全评审', '安全评审（改）');
  assert.throws(
    () => verifyCatalogSignature(modified, signature, keyRing),
    /catalog digest mismatch|invalid catalog signature/,
  );
});

test('signature verification rejects an unknown key id', async () => {
  const { catalogText, signature, keyRing } = await fixture();
  const modified = { ...signature, keyId: 'key-unknown' };
  assert.throws(
    () => verifyCatalogSignature(catalogText, modified, keyRing),
    /unknown signing key/,
  );
});

test('key ring supports active and retired keys for rotation', async () => {
  const { catalogText, signature, keyRing } = await fixture();
  const rotated = {
    ...keyRing,
    keys: [
      { ...keyRing.keys[0], status: 'retired', retiredAt: '2026-01-01T00:00:00.000Z' },
      { ...keyRing.keys[0], keyId: 'key-next', status: 'active' },
    ],
  };
  assert.throws(
    () => verifyCatalogSignature(catalogText, signature, rotated),
    /signing key is retired/,
  );
  const original = verifyCatalogSignature(catalogText, signature, keyRing);
  assert.equal(original.ok, true);
});

test('signing rejects non-canonical catalog files', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const { catalogText, keyRing } = await fixture();
  const nonCanonicalPath = `${catalogPath}.non-canonical.test.json`;
  const nonCanonicalText = catalogText.replace('"personas": [', '"personas":[');
  await writeFile(nonCanonicalPath, nonCanonicalText, 'utf8');
  try {
    await assert.rejects(
      signCatalog({ catalogPath: nonCanonicalPath, privateKey }),
      /catalog is not canonical/,
    );
    const result = await signCatalog({
      catalogPath,
      privateKey,
      keyId: 'key-test-rotate',
      now: new Date('2026-11-10T00:00:00.000Z'),
    });
    assert.equal(result.signature.keyId, 'key-test-rotate');
    assert.equal(
      result.signature.digest,
      `sha256:${createHash('sha256').update(catalogText).digest('hex')}`,
    );
    assert.equal(verifyCatalogSignature(catalogText, result.signature, {
      ...keyRing,
      keys: [...keyRing.keys, {
        keyId: 'key-test-rotate',
        status: 'active',
        publicKey: result.publicKeyPem,
      }],
    }, { now: new Date('2026-11-10T00:00:00.000Z') }).ok, true);
  } finally {
    await unlink(nonCanonicalPath).catch(() => {});
  }
});
