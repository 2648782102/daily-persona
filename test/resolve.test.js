import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCatalog } from '../src/catalog.js';
import { cycleOffset, resolveForDate, zonedDate } from '../src/resolve.js';

test('zonedDate respects Asia/Shanghai around UTC midnight', () => {
  const instant = new Date('2026-11-08T16:30:00.000Z');
  assert.equal(zonedDate(instant, 'UTC'), '2026-11-08');
  assert.equal(zonedDate(instant, 'Asia/Shanghai'), '2026-11-09');
});

test('resolveForDate is deterministic and includes trust metadata', async () => {
  const catalog = await loadCatalog();
  const first = resolveForDate(catalog, { date: '2026-11-09', timezone: 'Asia/Shanghai' });
  const second = resolveForDate(catalog, { date: '2026-11-09', timezone: 'Asia/Shanghai' });
  assert.deepEqual(first, second);
  assert.equal(first.contract.untrustedData, true);
  assert.equal(first.contract.scope, 'style-and-review-focus-only');
  assert.equal(first.contract.date, '2026-11-09');
  assert.ok(first.persona.id);
});

test('one cycle uses every persona exactly once', async () => {
  const catalog = await loadCatalog();
  const size = catalog.personas.length;
  const epochDay = Math.floor(Date.parse('2026-01-01T00:00:00.000Z') / 86_400_000);
  const cycleStart = epochDay - (((epochDay % size) + size) % size);
  const indices = Array.from({ length: size }, (_, offset) => cycleOffset({
    date: new Date((cycleStart + offset) * 86_400_000).toISOString().slice(0, 10),
    seed: catalog.seed,
    version: catalog.version,
    size,
  }));
  assert.equal(new Set(indices).size, size);
});

test('seed and catalogVersion change the rotation', async () => {
  const catalog = await loadCatalog();
  const base = resolveForDate(catalog, { date: '2026-11-09' });
  const differentSeed = resolveForDate(catalog, { date: '2026-11-09', seed: 'another-seed' });
  const differentVersion = resolveForDate(catalog, { date: '2026-11-09', version: 'persona-catalog-v2' });
  assert.notDeepEqual(base.persona, differentSeed.persona);
  assert.notDeepEqual(base.persona, differentVersion.persona);
});

test('invalid dates are rejected', async () => {
  const catalog = await loadCatalog();
  assert.throws(() => resolveForDate(catalog, { date: '2026-02-30' }), /valid calendar date/);
  assert.throws(() => resolveForDate(catalog, { date: '11/09/2026' }), /YYYY-MM-DD/);
});
