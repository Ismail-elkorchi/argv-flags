import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DefinitionError, createParser } from '../dist/index.js';
import { compileDefinitions } from '../dist/definitions.js';

const readDefinitionError = (callback) => {
	try {
		callback();
		assert.fail('Expected DefinitionError');
	} catch (error) {
		assert.ok(error instanceof DefinitionError);
		return error;
	}
};

test('reports structured issues for invalid definition containers and entries', () => {
	const containerError = readDefinitionError(() => createParser(null));
	assert.deepStrictEqual(containerError.issues, [
		{
			code: 'INVALID_DEFINITIONS',
			message: 'Option definitions must be a plain object.'
		}
	]);
	const collectionError = readDefinitionError(() => createParser(new Map()));
	assert.strictEqual(collectionError.issues[0]?.code, 'INVALID_DEFINITIONS');

	const entryError = readDefinitionError(() =>
		createParser({
			source: null,
			count: { type: 'object', flags: ['--count'] }
		})
	);
	assert.deepStrictEqual(
		entryError.issues.map((issue) => issue.code),
		['INVALID_OPTION_DEFINITION', 'INVALID_OPTION_TYPE']
	);
});

test('rejects invalid, repeated, and conflicting flags', () => {
	const error = readDefinitionError(() =>
		createParser({
			invalid: { type: 'string', flags: ['source'] },
			repeated: { type: 'string', flags: ['--same', '--same'] },
			first: { type: 'string', flags: ['--value'] },
			second: { type: 'string', flags: ['--value'] },
			enabled: {
				type: 'boolean',
				flags: ['--enabled'],
				negatedFlag: '--enabled'
			}
		})
	);

	assert.deepStrictEqual(
		error.issues.map((issue) => issue.code),
		['INVALID_FLAG', 'DUPLICATE_FLAG', 'DUPLICATE_FLAG', 'DUPLICATE_FLAG']
	);
	assert.deepStrictEqual(error.issues[2], {
		code: 'DUPLICATE_FLAG',
		message:
			'Flag "--value" for option "second" is already assigned to option "first".',
		option: 'second',
		flag: '--value',
		conflictingOption: 'first'
	});
});

test('rejects missing, non-string, and malformed negated flags', () => {
	const error = readDefinitionError(() =>
		createParser({
			missing: { type: 'string', flags: [] },
			nonString: { type: 'string', flags: [1] },
			negated: {
				type: 'boolean',
				flags: ['--enabled'],
				negatedFlag: '--'
			}
		})
	);

	assert.deepStrictEqual(
		error.issues.map((issue) => issue.code),
		['INVALID_DEFINITION_PROPERTY', 'INVALID_FLAG', 'INVALID_FLAG']
	);
});

test('rejects empty and symbol option names', () => {
	const symbolName = Symbol('option');
	const definitions = {
		'': { type: 'string', flags: ['--empty'] },
		[symbolName]: { type: 'string', flags: ['--symbol'] }
	};
	const error = readDefinitionError(() => createParser(definitions));

	assert.deepStrictEqual(
		error.issues.map((issue) => issue.code),
		['INVALID_OPTION_NAME', 'INVALID_OPTION_NAME']
	);
});

test('rejects invalid defaults and contradictory presence rules', () => {
	const error = readDefinitionError(() =>
		createParser({
			count: { type: 'number', flags: ['--count'], default: 'many' },
			source: {
				type: 'string',
				flags: ['--source'],
				required: true,
				default: 'input.txt'
			}
		})
	);

	assert.deepStrictEqual(error.issues[0], {
		code: 'INVALID_DEFINITION_PROPERTY',
		message: 'Option "count" default must be a finite number.',
		option: 'count',
		property: 'default'
	});
	assert.deepStrictEqual(error.issues[1], {
		code: 'CONFLICTING_DEFINITION_PROPERTIES',
		message: 'Option "source" cannot combine "required" with "default".',
		option: 'source',
		properties: ['required', 'default']
	});

	const sparseDefault = new Array(1);
	const sparseError = readDefinitionError(() =>
		createParser({
			items: {
				type: 'string',
				flags: ['--item'],
				multiple: true,
				default: sparseDefault
			}
		})
	);
	assert.strictEqual(
		sparseError.issues[0]?.code,
		'INVALID_DEFINITION_PROPERTY'
	);
});

test('rejects every unknown own field, including symbol fields', () => {
	const hidden = Symbol('hidden');
	const source = {
		type: 'string',
		flags: ['--source'],
		require: true,
		[hidden]: true
	};
	const error = readDefinitionError(() => createParser({ source }));

	assert.deepStrictEqual(
		error.issues.map((issue) => ({
			code: issue.code,
			property: issue.property
		})),
		[
			{ code: 'UNSUPPORTED_DEFINITION_PROPERTY', property: 'require' },
			{ code: 'UNSUPPORTED_DEFINITION_PROPERTY', property: 'Symbol(hidden)' }
		]
	);
});

test('rejects custom prototypes and accepts null-prototype definitions', () => {
	const inheritedDefinition = Object.create({
		type: 'string',
		flags: ['--inherited']
	});
	const inheritedError = readDefinitionError(() =>
		createParser({ inherited: inheritedDefinition })
	);
	assert.deepStrictEqual(
		inheritedError.issues.map((issue) => issue.code),
		['INVALID_OPTION_DEFINITION']
	);

	const definition = Object.assign(Object.create(null), {
		type: 'string',
		flags: ['--value']
	});
	const parser = createParser({ value: definition });
	const result = parser.parse({ args: ['--value', 'safe'] });
	assert.strictEqual(result.success, true);
	assert.strictEqual(result.values.value, 'safe');
});

test('rejects malformed values for every supported definition field', () => {
	const error = readDefinitionError(() =>
		createParser({
			source: {
				type: 'string',
				flags: ['--source'],
				required: 'yes',
				multiple: 'yes',
				allowEmpty: 1
			},
			enabled: {
				type: 'boolean',
				flags: ['--enabled'],
				negatedFlag: 1,
				default: 'yes'
			}
		})
	);

	assert.deepStrictEqual(
		error.issues.map((issue) => [issue.code, issue.property]),
		[
			['INVALID_DEFINITION_PROPERTY', 'required'],
			['INVALID_DEFINITION_PROPERTY', 'multiple'],
			['INVALID_DEFINITION_PROPERTY', 'allowEmpty'],
			['INVALID_DEFINITION_PROPERTY', 'default'],
			['INVALID_DEFINITION_PROPERTY', 'negatedFlag']
		]
	);
});

test('compilation creates a deeply immutable lookup snapshot', () => {
	const flags = ['--item'];
	const defaults = ['base'];
	const definitions = {
		items: {
			type: 'string',
			flags,
			multiple: true,
			default: defaults
		}
	};
	const compiled = compileDefinitions(definitions);
	const parser = createParser(definitions);

	assert.strictEqual(Object.isFrozen(compiled), true);
	assert.strictEqual(Object.isFrozen(compiled.options), true);
	assert.strictEqual(Object.isFrozen(compiled.flagBindings), true);
	assert.strictEqual(Object.isFrozen(compiled.options[0]), true);
	assert.strictEqual(Object.isFrozen(compiled.options[0].flags), true);
	assert.strictEqual(Object.isFrozen(compiled.options[0].defaultValue), true);
	assert.strictEqual(Object.isFrozen(compiled.flagBindings['--item']), true);

	flags[0] = '--changed';
	defaults[0] = 'changed';
	assert.strictEqual(compiled.flagBindings['--changed'], undefined);
	assert.deepStrictEqual(compiled.options[0].defaultValue, ['base']);

	assert.strictEqual(Object.isFrozen(parser), true);
	const result = parser.parse({ args: [] });
	assert.strictEqual(result.success, true);
	assert.deepStrictEqual(result.values.items, ['base']);
	const explicit = parser.parse({ args: ['--item', 'value'] });
	assert.strictEqual(explicit.success, true);
	assert.deepStrictEqual(explicit.values.items, ['value']);
});

test('DefinitionError and its diagnostics are immutable', () => {
	const error = readDefinitionError(() =>
		createParser({
			source: {
				type: 'string',
				flags: ['--source'],
				required: true,
				default: 'fallback'
			}
		})
	);

	assert.strictEqual(Object.isFrozen(error.issues), true);
	assert.strictEqual(Object.isFrozen(error.issues[0]), true);
	assert.strictEqual(Object.isFrozen(error.issues[0].properties), true);
	assert.throws(() => error.issues.push({}), TypeError);
});

test('handles special option names without changing object prototypes', () => {
	const definitions = JSON.parse(
		'{"__proto__":{"type":"string","flags":["--prototype"],"required":true}}'
	);
	const parser = createParser(definitions);
	const result = parser.parse({ args: ['--prototype', 'safe'] });

	assert.strictEqual(result.success, true);
	assert.strictEqual(Object.hasOwn(result.values, '__proto__'), true);
	assert.strictEqual(result.values.__proto__, 'safe');
	assert.strictEqual(Object.getPrototypeOf(result.values), Object.prototype);
});
