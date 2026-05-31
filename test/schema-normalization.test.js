import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineSchema, normalizeSchema, parseArgs } from '../dist/index.js';

test('normalizeSchema is non-throwing and returns issues', () => {
	const report = normalizeSchema({
		name: { type: 'string', flags: ['--src='] }
	});
	assert.strictEqual(report.ok, false);
	assert.ok(report.issues.some((issue) => issue.includes('must not contain "="')));
});

test('normalizeSchema rejects "--" and reserved negation schema flags', () => {
	const report = normalizeSchema({
		name: { type: 'string', flags: ['--'] },
		mode: { type: 'boolean', flags: ['--no-mode'] },
		enable: { type: 'boolean', flags: ['--enable'] }
	});
	assert.strictEqual(report.ok, false);
	assert.ok(report.issues.some((issue) => issue.includes('reserved for argument boundary')));
	assert.ok(report.issues.some((issue) => issue.includes('cannot start with "--no-"')));
});

test('normalizeSchema captures effective boolean negation metadata', () => {
	const schema = defineSchema({
		enabled: { type: 'boolean', flags: ['-e', '--enabled'] },
		name: { type: 'string', flags: ['--name'] }
	});
	const report = normalizeSchema(schema);
	assert.strictEqual(report.ok, true);
	assert.deepStrictEqual(report.booleanNegations, [
		{
			key: 'enabled',
			positiveFlag: '--enabled',
			negativeFlag: '--no-enabled'
		}
	]);
	assert.strictEqual(report.booleanNegations[0].negativeFlag, '--no-enabled');
	assert.strictEqual(report.flagToKey['--enabled'], 'enabled');
	assert.strictEqual(report.flagToKey['-e'], 'enabled');
});

test('parseArgs still accepts derived boolean negation flags', () => {
	const schema = defineSchema({
		enabled: { type: 'boolean', flags: ['-e', '--enabled'] }
	});
	const report = normalizeSchema(schema);
	assert.strictEqual(report.ok, true);
	const result = parseArgs(schema, { argv: ['--no-enabled'] });
	assert.strictEqual(result.ok, true);
	assert.strictEqual(result.values.enabled, false);
	assert.strictEqual(result.present.enabled, true);
});
