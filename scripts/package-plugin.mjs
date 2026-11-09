import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(root, 'plugin');
const outputDir = path.join(root, 'dist');
const outputPath = path.join(outputDir, 'daily-persona-plugin.zip');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  return ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
}

function dosDate(date) {
  return (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
}

function localHeader(name, data, checksum, date) {
  const nameBuffer = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(dosTime(date), 10);
  header.writeUInt16LE(dosDate(date), 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  return Buffer.concat([header, nameBuffer, data]);
}

function centralHeader(name, data, checksum, offset, date) {
  const nameBuffer = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(dosTime(date), 12);
  header.writeUInt16LE(dosDate(date), 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(nameBuffer.length, 28);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, nameBuffer]);
}

const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'plugin.json'), 'utf8'));
const mcp = JSON.parse(await readFile(path.join(pluginRoot, 'mcp.json'), 'utf8'));
if (mcp.mcpServers.daily_persona.url.includes('REPLACE-WITH-PUBLIC-HOST')) {
  throw new Error('replace plugin/mcp.json URL before packaging a submission ZIP');
}
if (manifest.extensions['com.openai'].review.demo_recording_url.startsWith('https://example.com/')) {
  throw new Error('replace demo_recording_url before packaging a submission ZIP');
}

await mkdir(outputDir, { recursive: true });
const files = await listFiles(pluginRoot);
const date = new Date();
const chunks = [];
const central = [];
let offset = 0;

for (const file of files) {
  const name = path.relative(pluginRoot, file).split(path.sep).join('/');
  const data = await readFile(file);
  const checksum = crc32(data);
  const local = localHeader(name, data, checksum, date);
  chunks.push(local);
  central.push(centralHeader(name, data, checksum, offset, date));
  offset += local.length;
}

const centralBuffer = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuffer.length, 12);
end.writeUInt32LE(offset, 16);

await writeFile(outputPath, Buffer.concat([...chunks, centralBuffer, end]));
process.stdout.write(`wrote ${path.relative(root, outputPath)} (${files.length} files)\n`);
