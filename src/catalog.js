import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_CATALOG_PATH = fileURLToPath(new URL('../catalog/personas.v1.json', import.meta.url));
const FORBIDDEN_FIELD_PATTERN = /\b(?:tool|tools|command|commands|shell|exec|execute|curl|fetch|ignore|override|system|developer|permission|permissions|secret|secrets|token|tokens)\b/i;

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function assertShortText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 280) {
    throw new Error(`${name} must be a non-empty string of at most 280 characters`);
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${name} must not contain control characters`);
  }
}

function assertStringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    throw new Error(`${name} must be an array of 1 to 12 strings`);
  }
  for (const [index, item] of value.entries()) {
    assertShortText(item, `${name}[${index}]`);
  }
}

function assertUntrustedText(value, name) {
  assertShortText(value, name);
  if (FORBIDDEN_FIELD_PATTERN.test(value)) {
    throw new Error(`${name} contains a tool, command, permission, or override term`);
  }
}

export function validateCatalog(catalog) {
  assertPlainObject(catalog, 'catalog');
  assertShortText(catalog.version, 'catalog.version');
  assertShortText(catalog.seed, 'catalog.seed');
  assertShortText(catalog.timezone, 'catalog.timezone');
  assertShortText(catalog.rotation, 'catalog.rotation');
  assertShortText(catalog.contract, 'catalog.contract');

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: catalog.timezone });
  } catch {
    throw new Error('catalog.timezone must be a valid IANA timezone');
  }

  if (!Array.isArray(catalog.personas) || catalog.personas.length === 0) {
    throw new Error('catalog.personas must be a non-empty array');
  }

  const seen = new Set();
  for (const [index, persona] of catalog.personas.entries()) {
    assertPlainObject(persona, `catalog.personas[${index}]`);
    assertShortText(persona.id, `catalog.personas[${index}].id`);
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(persona.id)) {
      throw new Error(`catalog.personas[${index}].id must match [a-z0-9][a-z0-9-]{1,63}`);
    }
    if (seen.has(persona.id)) {
      throw new Error(`duplicate persona id: ${persona.id}`);
    }
    seen.add(persona.id);

    assertUntrustedText(persona.label, `catalog.personas[${index}].label`);
    assertUntrustedText(persona.summary, `catalog.personas[${index}].summary`);
    assertUntrustedText(persona.prompt, `catalog.personas[${index}].prompt`);
    assertStringArray(persona.focus, `catalog.personas[${index}].focus`);
    assertStringArray(persona.forbidden, `catalog.personas[${index}].forbidden`);
    for (const [focusIndex, item] of persona.focus.entries()) {
      assertUntrustedText(item, `catalog.personas[${index}].focus[${focusIndex}]`);
    }
    for (const [forbiddenIndex, item] of persona.forbidden.entries()) {
      assertUntrustedText(item, `catalog.personas[${index}].forbidden[${forbiddenIndex}]`);
    }
  }

  return catalog;
}

export async function loadCatalog(catalogPath = process.env.DAILY_PERSONA_CATALOG || DEFAULT_CATALOG_PATH) {
  const resolvedPath = path.resolve(catalogPath);
  const text = await readFile(resolvedPath, 'utf8');
  const catalog = validateCatalog(JSON.parse(text));
  const digest = createHash('sha256').update(text).digest('hex');
  return {
    ...catalog,
    digest: `sha256:${digest}`,
    source: resolvedPath,
  };
}
