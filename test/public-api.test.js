import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as publicApi from 'argv-flags';

test('exports only the parser factory and structured definition error at runtime', () => {
	assert.deepStrictEqual(Object.keys(publicApi), ['DefinitionError', 'createParser']);
});
