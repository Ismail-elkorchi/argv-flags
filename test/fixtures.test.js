import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { defineSchema, parseArgs, toJsonResult } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.join(__dirname, 'fixtures', 'parse-cases.json');

const loadFixtures = async () => {
  const raw = await readFile(fixturesPath, 'utf8');
  return JSON.parse(raw);
};

const fixtures = await loadFixtures();

for (const fixture of fixtures) {
  test(fixture.name, () => {
    const schema = defineSchema(fixture.schema);
    const options = { ...(fixture.options ?? {}), argv: fixture.argv };
    const result = parseArgs(schema, options);
    const json = toJsonResult(result);
    assert.deepStrictEqual(json, fixture.expect);
  });
}
