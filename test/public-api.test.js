import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as publicApi from 'argv-flags';

test('exports only the public facade at runtime', () => {
	assert.deepStrictEqual(Object.keys(publicApi), [
		'DefinitionError',
		'createParser',
		'createParserFromMap',
		'value'
	]);
	assert.strictEqual(Object.isFrozen(publicApi.value), true);
	assert.deepStrictEqual(Object.keys(publicApi.value), [
		'string',
		'number',
		'integer',
		'choice',
		'custom'
	]);
});
