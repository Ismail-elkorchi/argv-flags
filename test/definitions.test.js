import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DefinitionError, createParser, value } from '../dist/index.js';

const readDefinitionError = (callback) => {
	try {
		callback();
		assert.fail('Expected DefinitionError.');
	} catch (error) {
		assert(error instanceof DefinitionError);
		return error;
	}
};

test('rejects invalid definition containers, option names, and accessors', () => {
	assert.strictEqual(
		readDefinitionError(() => createParser(null)).issues[0]?.code,
		'INVALID_DEFINITIONS'
	);
	const symbol = Symbol('option');
	const error = readDefinitionError(() =>
		createParser({
			'': { type: 'string', flags: ['--empty'] },
			[symbol]: { type: 'string', flags: ['--symbol'] },
			invalid: null
		})
	);
	assert.deepStrictEqual(
		error.issues.map((issue) => issue.code),
		['INVALID_OPTION_NAME', 'INVALID_OPTION_DEFINITION', 'INVALID_OPTION_NAME']
	);

	const accessor = {};
	Object.defineProperty(accessor, 'type', { get: () => 'string' });
	assert.throws(
		() => createParser({ accessor }),
		/option "accessor".*data property/iu
	);
});

test('rejects closed-property, type, and property-value violations', () => {
	const symbol = Symbol('extra');
	const error = readDefinitionError(() =>
		createParser({
			unknownType: { type: 'array', flags: ['--array'], typo: true },
			forgedParser: { type: Object.freeze({}), flags: ['--forged'] },
			string: {
				type: 'string',
				flags: ['--string'],
				repeat: 'sometimes',
				required: 'yes',
				multiple: 'yes',
				extra: true,
				[symbol]: true
			},
			multiple: {
				type: 'string',
				flags: ['--multiple'],
				multiple: true,
				repeat: 'last'
			},
			count: { type: 'count', flags: ['--count'], default: 1 }
		})
	);
	assert(error.issues.some((issue) => issue.code === 'INVALID_OPTION_PROPERTY'));
	assert(error.issues.some((issue) => issue.code === 'INVALID_VALUE_PARSER'));
	assert(error.issues.some((issue) => issue.code === 'UNSUPPORTED_OPTION_PROPERTY'));
	assert(
		error.issues.some(
			(issue) =>
				issue.code === 'UNSUPPORTED_OPTION_PROPERTY' && issue.property === symbol
		)
	);
	assert(
		error.issues.some(
			(issue) =>
				issue.code === 'UNSUPPORTED_OPTION_PROPERTY' &&
				issue.option === 'unknownType' &&
				issue.property === 'typo'
		)
	);
});

test('validates all flag lists and global ownership', () => {
	const sparse = ['--sparse'];
	sparse.length = 2;
	const error = readDefinitionError(() =>
		createParser({
			missing: { type: 'string' },
			empty: { type: 'string', flags: [] },
			sparse: { type: 'string', flags: sparse },
			invalid: { type: 'string', flags: ['name', '--bad!', '-?'] },
			first: { type: 'boolean', flags: ['--same'] },
			second: {
				type: 'boolean',
				flags: ['--second'],
				falseFlags: ['--same', '--second']
			}
		})
	);
	assert(error.issues.some((issue) => issue.code === 'INVALID_FLAG'));
	const duplicates = error.issues.filter((issue) => issue.code === 'DUPLICATE_FLAG');
	assert.deepStrictEqual(
		duplicates.map((issue) => [
			issue.flag,
			issue.property,
			issue.conflictingOption,
			issue.conflictingProperty
		]),
		[
			['--same', 'falseFlags', 'first', 'flags'],
			['--second', 'falseFlags', 'second', 'flags']
		]
	);
});

test('rejects presence, default, and optional-inline conflicts', () => {
	const sparseDefault = ['value'];
	sparseDefault.length = 2;
	const error = readDefinitionError(() =>
		createParser({
			requiredDefault: {
				type: 'integer',
				flags: ['--required-default'],
				required: true,
				default: 1
			},
			requiredMultipleDefault: {
				type: 'string',
				flags: ['--required-multiple-default'],
				multiple: true,
				required: true,
				default: ['fallback']
			},
			badDefault: {
				type: value.integer({ minimum: 0 }),
				flags: ['--bad-default'],
				default: -1
			},
			badMultipleDefault: {
				type: 'number',
				flags: ['--bad-multiple-default'],
				multiple: true,
				default: [1, 'two']
			},
			sparseMultipleDefault: {
				type: 'string',
				flags: ['--sparse-default'],
				multiple: true,
				default: sparseDefault
			},
			missingImplicit: {
				type: 'string',
				flags: ['--missing-implicit'],
				valueMode: 'optional-inline'
			},
			conflictingImplicit: {
				type: 'string',
				flags: ['--conflicting-implicit'],
				implicitValue: 'value'
			},
			badImplicit: {
				type: 'integer',
				flags: ['--bad-implicit'],
				valueMode: 'optional-inline',
				implicitValue: 'one'
			}
		})
	);
	assert.deepStrictEqual(
		error.issues.map((issue) => issue.code),
			[
				'CONFLICTING_OPTION_PROPERTIES',
				'CONFLICTING_OPTION_PROPERTIES',
				'INVALID_DEFAULT',
			'INVALID_DEFAULT',
			'INVALID_DEFAULT',
			'INVALID_OPTION_PROPERTY',
			'CONFLICTING_OPTION_PROPERTIES',
			'INVALID_OPTION_PROPERTY'
		]
	);
});

test('snapshots definitions, defaults, implicit values, and custom values', () => {
	let snapshotCount = 0;
	const objectValue = value.custom({
		parse(raw) {
			return { success: true, value: { text: raw } };
		},
		accepts(candidate) {
			return (
				typeof candidate === 'object' &&
				candidate !== null &&
				typeof candidate.text === 'string'
			);
		},
		snapshot(candidate) {
			snapshotCount += 1;
			return { text: candidate.text };
		}
	});
	const flags = ['--item'];
	const defaultValue = { text: 'default' };
	const implicitValue = { text: 'implicit' };
	const definitions = {
		item: { type: objectValue, flags, default: defaultValue },
		mode: {
			type: objectValue,
			flags: ['--mode'],
			valueMode: 'optional-inline',
			implicitValue
		}
	};
	const parser = createParser(definitions);
	flags[0] = '--changed';
	defaultValue.text = 'changed';
	implicitValue.text = 'changed';

	const first = parser.parse({ argv: ['--mode'] });
	const second = parser.parse({ argv: ['--mode'] });
	assert.strictEqual(first.success, true);
	assert.strictEqual(second.success, true);
	assert.deepStrictEqual(first.values.item, { text: 'default' });
	assert.deepStrictEqual(first.values.mode, { text: 'implicit' });
	assert.notStrictEqual(first.values.item, second.values.item);
	assert.notStrictEqual(first.values.mode, second.values.mode);
	assert.strictEqual(snapshotCount, 6);
	assert.strictEqual(Object.isFrozen(parser), true);
});

test('snapshots every custom multiple-default element for each parse', () => {
	let snapshotCount = 0;
	const objectValue = value.custom({
		parse(raw) {
			return { success: true, value: { text: raw } };
		},
		accepts(candidate) {
			return (
				typeof candidate === 'object' &&
				candidate !== null &&
				typeof candidate.text === 'string'
			);
		},
		snapshot(candidate) {
			snapshotCount += 1;
			return { text: candidate.text };
		}
	});
	const parser = createParser({
		items: {
			type: objectValue,
			flags: ['--item'],
			multiple: true,
			default: [{ text: 'one' }, { text: 'two' }]
		}
	});
	assert.strictEqual(snapshotCount, 2);
	const first = parser.parse({ argv: [] });
	const second = parser.parse({ argv: [] });
	assert.strictEqual(first.success, true);
	assert.strictEqual(second.success, true);
	assert.strictEqual(snapshotCount, 6);
	assert.deepStrictEqual(first.values.items, [{ text: 'one' }, { text: 'two' }]);
	assert.notStrictEqual(first.values.items, second.values.items);
	assert.notStrictEqual(first.values.items[0], second.values.items[0]);
});

test('DefinitionError diagnostics and conflict arrays are immutable', () => {
	const error = readDefinitionError(() =>
		createParser({
			value: {
				type: 'string',
				flags: ['--value'],
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

test('supports null-prototype definitions and special option names safely', () => {
	const prototypeOption = Object.assign(Object.create(null), {
		type: 'string',
		flags: ['--prototype'],
		required: true
	});
	const definitions = Object.create(null);
	definitions.__proto__ = prototypeOption;
	definitions.constructor = {
		type: 'boolean',
		flags: ['--constructor']
	};
	definitions.toString = {
		type: 'count',
		flags: ['-t']
	};
	const result = createParser(definitions).parse({
		argv: ['--prototype', 'safe', '--constructor', '-tt']
	});
	assert.strictEqual(result.success, true);
	assert.strictEqual(Object.getPrototypeOf(result.values), null);
	assert.strictEqual(result.values.__proto__, 'safe');
	assert.strictEqual(result.values.constructor, true);
	assert.strictEqual(result.values.toString, 2);
	assert.strictEqual(result.specified.constructor, true);
});
