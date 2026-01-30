import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import { defineSchema, parseArgs, toJsonResult } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '..', 'schema', 'parse-result.schema.json');

const loadSchema = async () => {
  const raw = await readFile(schemaPath, 'utf8');
  return JSON.parse(raw);
};

test('parse results validate against JSON Schema', async () => {
  const jsonSchema = await loadSchema();
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile(jsonSchema);

  const cliSchema = defineSchema({
    src: { type: 'string', flags: ['--src'], required: true },
    dest: { type: 'string', flags: ['--dest'], required: true },
    exclude: { type: 'array', flags: ['--exclude'], default: [] },
    verbose: { type: 'boolean', flags: ['--verbose'], default: false },
    count: { type: 'number', flags: ['--count'] }
  });

  const result = parseArgs(cliSchema, {
    argv: ['--src', './in', '--dest', './out.zip', '--exclude', 'node_modules', '--verbose', '--count', '-3']
  });

  const jsonResult = toJsonResult(result);
  const valid = validate(jsonResult);
  assert.strictEqual(valid, true);
});

test('schema rejects invalid shapes', async () => {
  const jsonSchema = await loadSchema();
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validate = ajv.compile(jsonSchema);

  const invalid = {
    values: { name: { nested: true } },
    present: { name: true },
    rest: [],
    unknown: [],
    issues: [],
    ok: true
  };

  const valid = validate(invalid);
  assert.strictEqual(valid, false);
});
