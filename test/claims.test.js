import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineSchema, parseArgs } from '../dist/index.js';

test('does not mutate argv input', () => {
  const schema = defineSchema({
    name: { type: 'string', flags: ['--name'] }
  });
  const argv = ['--name', 'value'];
  const snapshot = argv.slice();
  parseArgs(schema, { argv });
  assert.deepStrictEqual(argv, snapshot);
});

test('deterministic output for identical argv', () => {
  const schema = defineSchema({
    name: { type: 'string', flags: ['--name'] },
    verbose: { type: 'boolean', flags: ['--verbose'] }
  });
  const argv = ['--name', 'value', '--verbose'];
  const first = parseArgs(schema, { argv });
  const second = parseArgs(schema, { argv });
  assert.deepStrictEqual(first, second);
});

test('default arrays are cloned per parse call', () => {
  const defaultItems = ['base'];
  const schema = defineSchema({
    items: { type: 'array', flags: ['--items'], default: defaultItems }
  });
  const result = parseArgs(schema, { argv: [] });
  assert.deepStrictEqual(result.values.items, ['base']);
  assert.notStrictEqual(result.values.items, defaultItems);
  assert.ok(Array.isArray(result.values.items));
  result.values.items.push('mutated');
  assert.deepStrictEqual(defaultItems, ['base']);
  const second = parseArgs(schema, { argv: [] });
  assert.deepStrictEqual(second.values.items, ['base']);
});

test('present marks explicit flags, not defaults', () => {
  const schema = defineSchema({
    verbose: { type: 'boolean', flags: ['--verbose'], default: false }
  });
  const absent = parseArgs(schema, { argv: [] });
  assert.strictEqual(absent.values.verbose, false);
  assert.strictEqual(absent.present.verbose, false);
  const present = parseArgs(schema, { argv: ['--verbose'] });
  assert.strictEqual(present.values.verbose, true);
  assert.strictEqual(present.present.verbose, true);
});

test('stopAtDoubleDash=false does not terminate parsing', () => {
  const schema = defineSchema({
    name: { type: 'string', flags: ['--name'] }
  });
  const result = parseArgs(schema, {
    argv: ['--', '--name', 'x'],
    stopAtDoubleDash: false,
    allowUnknown: true
  });
  assert.deepStrictEqual(result.unknown, ['--']);
  assert.deepStrictEqual(result.rest, []);
  assert.strictEqual(result.values.name, 'x');
});

test('non-flag tokens go to rest', () => {
  const schema = defineSchema({
    name: { type: 'string', flags: ['--name'] }
  });
  const result = parseArgs(schema, { argv: ['value', '--name', 'x'] });
  assert.deepStrictEqual(result.rest, ['value']);
  assert.strictEqual(result.values.name, 'x');
});

test('empty string is rejected unless allowEmpty is true', () => {
  const schema = defineSchema({
    name: { type: 'string', flags: ['--name'] }
  });
  const result = parseArgs(schema, { argv: ['--name', ''] });
  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'EMPTY_VALUE'));
});

test('ok is false when any error exists (even with warnings)', () => {
  const schema = defineSchema({
    flag: { type: 'boolean', flags: ['--flag'] }
  });
  const result = parseArgs(schema, { argv: ['--flag', '--flag', '--unknown'] });
  assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE'));
  assert.ok(result.issues.some((issue) => issue.code === 'UNKNOWN_FLAG'));
  assert.strictEqual(result.ok, false);
});

test('allowUnknown collects flags without erroring', () => {
  const schema = defineSchema({
    name: { type: 'string', flags: ['--name'] }
  });
  const result = parseArgs(schema, { argv: ['--unknown', '--name', 'x'], allowUnknown: true });
  assert.deepStrictEqual(result.unknown, ['--unknown']);
  assert.strictEqual(result.ok, true);
});

test('invalid schema definitions throw early', () => {
  assert.throws(
    () => parseArgs(null),
    /Schema must be an object\./u
  );
  assert.throws(
    () =>
      parseArgs(
        defineSchema({
          one: { type: 'string', flags: ['--dup'] },
          two: { type: 'string', flags: ['--dup'] }
        })
      ),
    /already assigned/u
  );
  assert.throws(
    () =>
      parseArgs(
        defineSchema({
          count: { type: 'number', flags: ['--count'], default: 'nope' }
        })
      ),
    /default must be a finite number/u
  );
});
