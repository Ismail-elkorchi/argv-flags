import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineSchema, parseArgs } from '../dist/index.js';

const schema = defineSchema({
  name: { type: 'string', flags: ['--name'] },
  enabled: { type: 'boolean', flags: ['--enabled'] },
  count: { type: 'number', flags: ['--count'] },
  items: { type: 'array', flags: ['--items'] },
  required: { type: 'string', flags: ['--required'], required: true }
});

const withArgv = (argv) => argv;

test('string flag returns next value', () => {
  const result = parseArgs(schema, { argv: withArgv(['--name', 'dir-archiver']) });
  assert.strictEqual(result.values.name, 'dir-archiver');
  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'REQUIRED'));
});

test('string flag returns inline value', () => {
  const result = parseArgs(schema, { argv: withArgv(['--name=dir-archiver', '--required', 'ok']) });
  assert.strictEqual(result.values.name, 'dir-archiver');
  assert.strictEqual(result.ok, true);
});

test('boolean flag returns true when present without value', () => {
  const result = parseArgs(schema, { argv: withArgv(['--enabled', '--required', 'ok']) });
  assert.strictEqual(result.values.enabled, true);
  assert.strictEqual(result.ok, true);
});

test('boolean flag respects explicit values', () => {
  const trueResult = parseArgs(schema, { argv: withArgv(['--enabled', 'true', '--required', 'ok']) });
  const falseResult = parseArgs(schema, { argv: withArgv(['--enabled=false', '--required', 'ok']) });
  assert.strictEqual(trueResult.values.enabled, true);
  assert.strictEqual(falseResult.values.enabled, false);
});

test('boolean flag supports --no- form', () => {
  const result = parseArgs(schema, { argv: withArgv(['--no-enabled', '--required', 'ok']) });
  assert.strictEqual(result.values.enabled, false);
  assert.strictEqual(result.ok, true);
});

test('number flag parses numeric values', () => {
  const result = parseArgs(schema, { argv: withArgv(['--count', '42', '--required', 'ok']) });
  assert.strictEqual(result.values.count, 42);
  assert.strictEqual(result.ok, true);
});

test('number flag accepts negative values', () => {
  const result = parseArgs(schema, { argv: withArgv(['--count', '-5', '--required', 'ok']) });
  assert.strictEqual(result.values.count, -5);
  assert.strictEqual(result.ok, true);
});

test('number flag rejects invalid values', () => {
  const result = parseArgs(schema, { argv: withArgv(['--count', 'NaN', '--required', 'ok']) });
  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_VALUE'));
});

test('array flag collects values until next flag', () => {
  const result = parseArgs(schema, { argv: withArgv(['--items', 'a', 'b', '--required', 'ok']) });
  assert.deepStrictEqual(result.values.items, ['a', 'b']);
  assert.strictEqual(result.ok, true);
});

test('array flag accepts inline values and additional values', () => {
  const result = parseArgs(schema, { argv: withArgv(['--items=a', 'b', '--required', 'ok']) });
  assert.deepStrictEqual(result.values.items, ['a', 'b']);
  assert.strictEqual(result.ok, true);
});

test('missing required flag produces an issue', () => {
  const result = parseArgs(schema, { argv: withArgv(['--name', 'ok']) });
  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'REQUIRED'));
});

test('unknown flags are errors by default', () => {
  const result = parseArgs(schema, { argv: withArgv(['--unknown', '--required', 'ok']) });
  assert.strictEqual(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'UNKNOWN_FLAG'));
});

test('unknown flags can be collected', () => {
  const result = parseArgs(schema, { argv: withArgv(['--unknown=1', '--required', 'ok']), allowUnknown: true });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.unknown, ['--unknown=1']);
});

test('-- stops flag parsing and preserves rest', () => {
  const result = parseArgs(schema, { argv: withArgv(['--required', 'ok', '--', '--name', 'x']) });
  assert.deepStrictEqual(result.rest, ['--name', 'x']);
  assert.strictEqual(result.values.name, undefined);
});
