import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { formatCatalog } from './catalog.js';
import { generateSigningKeyPair, loadSignedCatalog, signCatalog } from './signing.js';

const DEFAULT_CATALOG_PATH = fileURLToPath(new URL('../catalog/personas.v1.json', import.meta.url));
const DEFAULT_SIGNATURE_PATH = fileURLToPath(new URL('../catalog/personas.v1.sig.json', import.meta.url));
const DEFAULT_KEYS_PATH = fileURLToPath(new URL('../catalog/trusted-keys.json', import.meta.url));

function usage() {
  return `daily-persona signing tool

Commands:
  keygen <dir>              Generate a private key, public key, and suggested key id
  verify                    Verify the bundled catalog signature
  sign <private-key> [id]   Write the catalog signature file using a local private key
  format                    Rewrite the catalog in canonical JSON form
  help                      Show this message
`;
}

function parseOptions(args) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--catalog') options.catalogPath = args[++index];
    else if (arg === '--signature') options.signaturePath = args[++index];
    else if (arg === '--keys') options.keysPath = args[++index];
    else positionals.push(arg);
  }
  return { options, positionals };
}

async function keygen(directory) {
  const { privateKey, publicKey } = generateSigningKeyPair();
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const keyId = `key-${createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 12)}`;
  const resolved = path.resolve(directory);
  await mkdir(resolved, { recursive: true });
  await writeFile(path.join(resolved, 'private-key.pem'), privatePem, { mode: 0o600 });
  await writeFile(path.join(resolved, 'public-key.pem'), publicPem, 'utf8');
  await writeFile(path.join(resolved, 'key-id.txt'), `${keyId}\n`, 'utf8');
  process.stdout.write([
    `wrote ${path.join(resolved, 'private-key.pem')}`,
    `wrote ${path.join(resolved, 'public-key.pem')}`,
    `keyId: ${keyId}`,
    'Keep the private key out of version control.',
    '',
  ].join('\n'));
}

async function verify(options) {
  const result = await loadSignedCatalog(options);
  process.stdout.write([
    `OK ${result.catalog.version} ${result.catalog.digest}`,
    `Signature: ${result.signature.keyId} (${result.signature.keyStatus}) ${result.signature.createdAt}`,
    '',
  ].join('\n'));
}

async function sign(privateKeyPath, keyId, options) {
  const privateKey = await readFile(path.resolve(privateKeyPath), 'utf8');
  const result = await signCatalog({ ...options, privateKey, keyId });
  const signaturePath = path.resolve(options.signaturePath ?? DEFAULT_SIGNATURE_PATH);
  await writeFile(signaturePath, `${JSON.stringify(result.signature, null, 2)}\n`, 'utf8');
  process.stdout.write([
    `wrote ${signaturePath}`,
    `keyId: ${result.signature.keyId}`,
    `digest: ${result.signature.digest}`,
    'Add the matching public key to catalog/trusted-keys.json before publishing.',
    '',
  ].join('\n'));
}

async function format(options) {
  const catalogPath = await formatCatalog(options.catalogPath ?? DEFAULT_CATALOG_PATH);
  process.stdout.write(`formatted ${catalogPath}\n`);
}

const [command = 'help', ...args] = process.argv.slice(2);
const { options, positionals } = parseOptions(args);

if (command === 'help' || command === '--help' || command === '-h') {
  process.stdout.write(usage());
} else if (command === 'keygen') {
  if (positionals.length !== 1) throw new Error('keygen requires one output directory');
  await keygen(positionals[0]);
} else if (command === 'verify') {
  await verify(options);
} else if (command === 'sign') {
  if (positionals.length < 1 || positionals.length > 2) throw new Error('sign requires <private-key> [key-id]');
  await sign(positionals[0], positionals[1], options);
} else if (command === 'format') {
  await format(options);
} else {
  throw new Error(`unknown command: ${command}`);
}
