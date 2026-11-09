import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogText = await readFile(path.join(root, 'catalog', 'personas.v1.json'), 'utf8');
const signature = JSON.parse(await readFile(path.join(root, 'catalog', 'personas.v1.sig.json'), 'utf8'));
const keyRing = JSON.parse(await readFile(path.join(root, 'catalog', 'trusted-keys.json'), 'utf8'));
const outputPath = path.join(root, 'deploy', 'workers', 'embedded-catalog.js');

await writeFile(outputPath, `export const CATALOG_TEXT = ${JSON.stringify(catalogText)};\nexport const SIGNATURE = ${JSON.stringify(signature, null, 2)};\nexport const KEY_RING = ${JSON.stringify(keyRing, null, 2)};\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  ok: true,
  output: path.relative(root, outputPath),
  bytes: Buffer.byteLength(catalogText),
  digest: signature.digest,
}, null, 2)}\n`);
