import { defineSchema, parseArgs } from 'argv-flags';

const schema = defineSchema({
  value: { type: 'string', flags: ['--value'], required: true }
});
const result = parseArgs(schema, { argv: ['--value', 'runtime-smoke'] });

if (!result.ok || result.values.value !== 'runtime-smoke') {
  throw new Error('Runtime smoke test failed');
}
