import assert from 'node:assert/strict';
import { test } from 'node:test';

const schemaSpecifier = 'argv-flags/schema/parse-result.schema.json';
let schema;
try {
  const moduleWith = await import(schemaSpecifier, { with: { type: 'json' } });
  schema = moduleWith.default;
} catch (error) {
  const err = error;
  if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_IMPORT_ATTRIBUTE_MISSING') {
    const moduleAssert = await import(schemaSpecifier, { assert: { type: 'json' } });
    schema = moduleAssert.default;
  } else {
    throw error;
  }
}

test('schema export is resolvable via package exports', () => {
  assert.strictEqual(schema.$id, 'https://schema.argv-flags.dev/parse-result.schema.json');
});
