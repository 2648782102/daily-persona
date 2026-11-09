import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalCatalog, validateCatalog } from './catalog.js';

const DEFAULT_CATALOG_PATH = fileURLToPath(new URL('../catalog/personas.v1.json', import.meta.url));
const DEFAULT_SIGNATURE_PATH = fileURLToPath(new URL('../catalog/personas.v1.sig.json', import.meta.url));
const DEFAULT_KEYS_PATH = fileURLToPath(new URL('../catalog/trusted-keys.json', import.meta.url));
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const PEM_PATTERN = /^-----BEGIN PUBLIC KEY-----\r?\n[\s\S]+\r?\n-----END PUBLIC KEY-----\r?\n?$/;

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

export function catalogDigest(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function signaturePayload(digest, signature) {
  return Buffer.from(`daily-persona-catalog-v1\n${digest}\n${signature.keyId}\n${signature.createdAt}\n`, 'utf8');
}

function parsePem(value, name) {
  if (typeof value !== 'string' || !PEM_PATTERN.test(value.trim())) {
    throw new Error(`${name} must be a PEM SPKI public key`);
  }
  return createPublicKey(value);
}

function validateSignatureFile(value) {
  assertPlainObject(value, 'signature');
  if (value.version !== 'daily-persona-signature/v1') {
    throw new Error('signature.version must be daily-persona-signature/v1');
  }
  if (typeof value.keyId !== 'string' || !KEY_ID_PATTERN.test(value.keyId)) {
    throw new Error('signature.keyId must be a lowercase key id');
  }
  if (typeof value.algorithm !== 'string' || value.algorithm !== 'Ed25519') {
    throw new Error('signature.algorithm must be Ed25519');
  }
  if (typeof value.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.digest)) {
    throw new Error('signature.digest must be a SHA-256 digest');
  }
  if (typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))) {
    throw new Error('signature.createdAt must be an ISO timestamp');
  }
  if (typeof value.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.signature)) {
    throw new Error('signature.signature must be base64');
  }
  return value;
}

function validateKeyRing(value) {
  assertPlainObject(value, 'key ring');
  if (value.version !== 'daily-persona-keys/v1') {
    throw new Error('key ring.version must be daily-persona-keys/v1');
  }
  if (!Array.isArray(value.keys) || value.keys.length === 0) {
    throw new Error('key ring.keys must be a non-empty array');
  }
  const seen = new Set();
  for (const [index, entry] of value.keys.entries()) {
    assertPlainObject(entry, `key ring.keys[${index}]`);
    if (typeof entry.keyId !== 'string' || !KEY_ID_PATTERN.test(entry.keyId)) {
      throw new Error(`key ring.keys[${index}].keyId must be a lowercase key id`);
    }
    if (seen.has(entry.keyId)) {
      throw new Error(`duplicate key id: ${entry.keyId}`);
    }
    seen.add(entry.keyId);
    if (entry.status !== 'active' && entry.status !== 'retired') {
      throw new Error(`key ring.keys[${index}].status must be active or retired`);
    }
    parsePem(entry.publicKey, `key ring.keys[${index}].publicKey`);
  }
  return value;
}

export function verifyCatalogSignature(catalogText, signature, keyRing, options = {}) {
  const now = options.now ?? new Date();
  const parsedSignature = validateSignatureFile(signature);
  const parsedKeys = validateKeyRing(keyRing);
  const expectedDigest = catalogDigest(catalogText);
  if (parsedSignature.digest !== expectedDigest) {
    throw new Error(`catalog digest mismatch: expected ${expectedDigest}`);
  }
  const createdAt = new Date(parsedSignature.createdAt);
  if (createdAt.getTime() > now.getTime() + 300_000) {
    throw new Error('signature.createdAt is in the future');
  }
  const keyEntry = parsedKeys.keys.find((entry) => entry.keyId === parsedSignature.keyId);
  if (!keyEntry) {
    throw new Error(`unknown signing key: ${parsedSignature.keyId}`);
  }
  if (keyEntry.status === 'retired' && keyEntry.retiredAt && createdAt >= new Date(keyEntry.retiredAt)) {
    throw new Error(`signing key is retired: ${parsedSignature.keyId}`);
  }
  const publicKey = parsePem(keyEntry.publicKey, 'trusted public key');
  const valid = verify(
    null,
    signaturePayload(expectedDigest, parsedSignature),
    publicKey,
    Buffer.from(parsedSignature.signature, 'base64'),
  );
  if (!valid) {
    throw new Error('invalid catalog signature');
  }
  return {
    ok: true,
    digest: expectedDigest,
    keyId: parsedSignature.keyId,
    keyStatus: keyEntry.status,
    createdAt: parsedSignature.createdAt,
  };
}

export async function loadSignedCatalog(options = {}) {
  const catalogPath = path.resolve(options.catalogPath ?? process.env.DAILY_PERSONA_CATALOG ?? DEFAULT_CATALOG_PATH);
  const signaturePath = path.resolve(options.signaturePath ?? process.env.DAILY_PERSONA_SIGNATURE ?? DEFAULT_SIGNATURE_PATH);
  const keysPath = path.resolve(options.keysPath ?? process.env.DAILY_PERSONA_TRUSTED_KEYS ?? DEFAULT_KEYS_PATH);
  const [catalogText, signatureText, keysText] = await Promise.all([
    readFile(catalogPath, 'utf8'),
    readFile(signaturePath, 'utf8'),
    readFile(keysPath, 'utf8'),
  ]);
  const catalog = validateCatalog(JSON.parse(catalogText));
  const proof = verifyCatalogSignature(catalogText, JSON.parse(signatureText), JSON.parse(keysText), options);
  return {
    catalog: {
      ...catalog,
      digest: proof.digest,
      source: catalogPath,
    },
    signature: proof,
    paths: { catalogPath, signaturePath, keysPath },
  };
}

export { canonicalCatalog };

export function generateSigningKeyPair() {
  return generateKeyPairSync('ed25519');
}

export async function signCatalog(options = {}) {
  const catalogPath = path.resolve(options.catalogPath ?? DEFAULT_CATALOG_PATH);
  const catalogText = await readFile(catalogPath, 'utf8');
  const canonicalText = canonicalCatalog(JSON.parse(catalogText));
  if (catalogText !== canonicalText) {
    throw new Error('catalog is not canonical; run `npm run catalog:format` before signing');
  }
  const privateKey = typeof options.privateKey === 'string'
    ? createPrivateKey(options.privateKey)
    : options.privateKey;
  if (!privateKey) {
    throw new Error('privateKey is required');
  }
  const publicKey = createPublicKey(privateKey);
  const keyId = typeof options.keyId === 'string'
    ? options.keyId
    : `key-${createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 12)}`;
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error('keyId must match [a-z0-9][a-z0-9._-]{1,63}');
  }
  const signature = {
    version: 'daily-persona-signature/v1',
    keyId,
    algorithm: 'Ed25519',
    digest: catalogDigest(canonicalText),
    createdAt: options.now instanceof Date ? options.now.toISOString() : (options.now ?? new Date()).toISOString(),
    signature: '',
  };
  signature.signature = sign(
    null,
    signaturePayload(signature.digest, signature),
    privateKey,
  ).toString('base64');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return {
    signature,
    publicKeyPem,
    catalogText: canonicalText,
  };
}

export async function writeSignedCatalog(options = {}) {
  const result = await signCatalog(options);
  const signaturePath = path.resolve(options.signaturePath ?? DEFAULT_SIGNATURE_PATH);
  await writeFile(signaturePath, `${JSON.stringify(result.signature, null, 2)}\n`, 'utf8');
  return { ...result, signaturePath };
}
