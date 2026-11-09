import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { loadCatalog, validateCatalog } from './catalog.js';
import { resolveForDate } from './resolve.js';
import { loadSignedCatalog } from './signing.js';

function usage() {
  return `daily-persona

Commands:
  check              Validate the persona catalog
  verify             Verify the catalog signature with trusted keys
  today [--json]     Resolve today's persona
  date <YYYY-MM-DD>  Resolve a specific date
  dump [path]        Write today.json to a file or stdout
  help               Show this message
`;
}

function parseOptions(args) {
  const options = { json: false, signed: false };
  const positionals = [];
  for (const arg of args) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--signed') {
      options.signed = true;
    } else {
      positionals.push(arg);
    }
  }
  return { options, positionals };
}

function printResolution(resolution, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(resolution, null, 2)}\n`);
    return;
  }
  const { contract, persona } = resolution;
  process.stdout.write([
    `${contract.date}  ${persona.label} (${persona.id})`,
    persona.summary,
    `Focus: ${persona.focus.join(' / ')}`,
    `Catalog: ${contract.catalogVersion} ${contract.catalogDigest}`,
    '',
  ].join('\n'));
}

async function main() {
  const [command = 'today', ...args] = process.argv.slice(2);
  const { options, positionals } = parseOptions(args);
  const catalog = options.signed
    ? (await loadSignedCatalog()).catalog
    : await loadCatalog();

  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(usage());
    return;
  }

  if (command === 'check') {
    validateCatalog(catalog);
    process.stdout.write(`OK ${catalog.version} ${catalog.digest} (${catalog.personas.length} personas)\n`);
    return;
  }

  if (command === 'verify') {
    const signed = await loadSignedCatalog();
    process.stdout.write([
      `OK ${signed.catalog.version} ${signed.catalog.digest}`,
      `Signature: ${signed.signature.keyId} (${signed.signature.keyStatus}) ${signed.signature.createdAt}`,
      '',
    ].join('\n'));
    return;
  }

  if (command === 'today') {
    printResolution(resolveForDate(catalog), options.json);
    return;
  }

  if (command === 'date') {
    if (positionals.length !== 1) {
      throw new Error('date requires exactly one YYYY-MM-DD argument');
    }
    printResolution(resolveForDate(catalog, { date: positionals[0] }), options.json);
    return;
  }

  if (command === 'dump') {
    const payload = resolveForDate(catalog);
    const text = `${JSON.stringify(payload, null, 2)}\n`;
    if (positionals.length > 0) {
      await writeFile(positionals[0], text, 'utf8');
      process.stdout.write(`wrote ${positionals[0]}\n`);
    } else {
      process.stdout.write(text);
    }
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
});
