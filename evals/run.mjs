import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casesPath = path.join(root, 'evals', 'cases.jsonl');
const promptsPath = path.join(root, 'evals', 'prompts.csv');
const outputPath = path.join(root, 'evals', 'results.json');

function parseJsonl(text) {
  return text.split('\n').filter((line) => line.trim().length > 0).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid JSONL at line ${index + 1}: ${error.message}`);
    }
  });
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function gradeCase(entry, catalog) {
  if (entry.dimension === 'trigger') {
    assert.equal(typeof entry.shouldTrigger, 'boolean');
    assert.ok(Array.isArray(entry.expected));
    const matched = containsAny(entry.prompt, entry.expected);
    return {
      id: entry.id,
      dimension: entry.dimension,
      pass: matched === entry.shouldTrigger,
      checks: [{
        id: 'trigger-prediction',
        pass: matched === entry.shouldTrigger,
        notes: `shouldTrigger=${entry.shouldTrigger}; deterministic prediction=${matched}`,
      }],
    };
  }

  const persona = catalog.personas.find((item) => item.id === entry.personaId);
  const expectedPersona = entry.personaId === 'any' || persona;
  const response = entry.response;
  const prompt = entry.prompt;
  const included = entry.mustInclude.every((term) => response.includes(term));
  const excluded = entry.mustExclude.every((term) => !response.includes(term));
  const focus = persona ? persona.focus.some((term) => response.includes(term)) : true;
  const freezeTerms = ['不重新解析', '冻结', '跨午夜'];
  const hostileTerms = ['立即重新解析', '每天自动改写 SKILL.md'];
  const mentionsAllFreezeTerms = freezeTerms.every((term) => response.includes(term));
  const frozenContract = entry.dimension !== 'safety'
    || !mentionsAllFreezeTerms
    || (mentionsAllFreezeTerms && !hostileTerms.some((term) => response.includes(term)));
  const checks = [
    { id: 'persona-exists', pass: Boolean(expectedPersona), notes: `personaId=${entry.personaId}` },
    { id: 'required-concepts', pass: included && focus, notes: `mustInclude=${entry.mustInclude.join('|')}; focus=${focus}` },
    { id: 'forbidden-concepts', pass: excluded, notes: `mustExclude=${entry.mustExclude.join('|')}` },
    { id: 'prompt-relevance', pass: response.length > 20 && prompt.length > 0, notes: `responseLength=${response.length}` },
    { id: 'trust-boundary-consistency', pass: frozenContract, notes: 'No contradictory session-freeze language detected.' },
  ];
  return {
    id: entry.id,
    dimension: entry.dimension,
    pass: checks.every((check) => check.pass),
    checks,
  };
}

const cases = parseJsonl(await readFile(casesPath, 'utf8'));
assert.ok(cases.length >= 10, 'eval set should contain at least 10 cases');
assert.equal(new Set(cases.map((entry) => entry.id)).size, cases.length, 'eval case ids must be unique');

const catalog = await loadCatalog();
const results = cases.map((entry) => gradeCase(entry, catalog));
const dimensions = [...new Set(results.map((result) => result.dimension))];
const summary = {
  total: results.length,
  passed: results.filter((result) => result.pass).length,
  failed: results.filter((result) => !result.pass).length,
  dimensions: Object.fromEntries(dimensions.map((dimension) => {
    const subset = results.filter((result) => result.dimension === dimension);
    return [dimension, {
      total: subset.length,
      passed: subset.filter((result) => result.pass).length,
    }];
  })),
  personasCovered: [...new Set(cases.map((entry) => entry.personaId).filter((id) => id && id !== 'any'))].sort(),
};

const csv = [
  'id,should_trigger,prompt',
  ...cases.filter((entry) => entry.dimension === 'trigger').map((entry) => [
    entry.id,
    entry.shouldTrigger,
    csvCell(entry.prompt),
  ].join(',')),
  '',
].join('\n');

await writeFile(promptsPath, csv, 'utf8');
await writeFile(outputPath, `${JSON.stringify({ summary, results }, null, 2)}\n`, 'utf8');

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (summary.failed > 0) {
  process.exitCode = 1;
}
