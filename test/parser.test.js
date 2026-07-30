import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createParser } from '../dist/index.js';

test('supports long flags with separate and inline values', () => {
	const parser = createParser({
		first: { type: 'string', flags: ['--first'] },
		second: { type: 'string', flags: ['--second'] }
	});
	const result = parser.parse({
		args: ['--first', 'separate', '--second=inline']
	});

	assert.strictEqual(result.success, true);
	assert.deepStrictEqual(result.values, {
		first: 'separate',
		second: 'inline'
	});
});

test('supports short flags with separate values and rejects attached values', () => {
	const parser = createParser({
		source: { type: 'string', flags: ['-s'] }
	});
	const separate = parser.parse({ args: ['-s', 'input.txt'] });
	assert.strictEqual(separate.success, true);
	assert.strictEqual(separate.values.source, 'input.txt');

	const attached = parser.parse({ args: ['-s=input.txt'] });
	assert.strictEqual(attached.success, false);
	assert.strictEqual(attached.issues[0]?.code, 'INVALID_FLAG_SYNTAX');
	assert.strictEqual(attached.issues[0]?.syntax, 'SHORT_ATTACHED_VALUE');
	assert.strictEqual(Object.hasOwn(attached, 'values'), false);
});

test('expands boolean short clusters from left to right', () => {
	const parser = createParser({
		all: { type: 'boolean', flags: ['-a'] },
		brief: { type: 'boolean', flags: ['-b'] },
		color: { type: 'boolean', flags: ['-c'] }
	});
	const result = parser.parse({ args: ['-abc'] });

	assert.strictEqual(result.success, true);
	assert.deepStrictEqual(result.values, {
		all: true,
		brief: true,
		color: true
	});
	assert.deepStrictEqual(result.specified, {
		all: true,
		brief: true,
		color: true
	});
});

test('rejects value-taking flags inside short clusters', () => {
	const parser = createParser({
		all: { type: 'boolean', flags: ['-a'] },
		name: { type: 'string', flags: ['-n'] }
	});
	const result = parser.parse({ args: ['-an', 'value'] });

	assert.strictEqual(result.success, false);
	assert.deepStrictEqual(result.positionals, ['value']);
	assert.deepStrictEqual(result.issues, [
		{
			code: 'INVALID_FLAG_SYNTAX',
			message: 'Value-taking flag "-n" cannot appear in short cluster "-an".',
			option: 'name',
			flag: '-n',
			argument: '-an',
			index: 0,
			syntax: 'NON_BOOLEAN_SHORT_CLUSTER'
		}
	]);
});

test('boolean options consume no value and reject long inline values', () => {
	const parser = createParser({
		verbose: { type: 'boolean', flags: ['--verbose'] }
	});
	const bare = parser.parse({ args: ['--verbose', 'false'] });
	assert.strictEqual(bare.success, true);
	assert.strictEqual(bare.values.verbose, true);
	assert.deepStrictEqual(bare.positionals, ['false']);

	const inline = parser.parse({ args: ['--verbose=false'] });
	assert.strictEqual(inline.success, false);
	assert.deepStrictEqual(inline.issues[0], {
		code: 'UNEXPECTED_FLAG_VALUE',
		message: 'Boolean flag "--verbose" does not accept a value.',
		option: 'verbose',
		flag: '--verbose',
		argument: '--verbose=false',
		value: 'false',
		index: 0
	});
});

test('uses only explicitly declared negated flags', () => {
	const parser = createParser({
		color: {
			type: 'boolean',
			flags: ['--color'],
			negatedFlag: '--without-color'
		}
	});
	const negated = parser.parse({ args: ['--without-color'] });
	assert.strictEqual(negated.success, true);
	assert.strictEqual(negated.values.color, false);

	const derivedName = parser.parse({ args: ['--no-color'] });
	assert.strictEqual(derivedName.success, false);
	assert.strictEqual(derivedName.issues[0]?.code, 'UNKNOWN_FLAG');
});

test('known value-taking flags consume one following argument verbatim', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'] },
		verbose: { type: 'boolean', flags: ['--verbose'] },
		count: { type: 'number', flags: ['--count'] }
	});
	const stringResult = parser.parse({ args: ['--name', '--verbose'] });
	assert.strictEqual(stringResult.success, true);
	assert.strictEqual(stringResult.values.name, '--verbose');
	assert.strictEqual(stringResult.values.verbose, undefined);

	const numberResult = parser.parse({ args: ['--count', '-5'] });
	assert.strictEqual(numberResult.success, true);
	assert.strictEqual(numberResult.values.count, -5);
});

test('repeated values require repeated option occurrences', () => {
	const parser = createParser({
		include: { type: 'string', flags: ['--include'], multiple: true }
	});
	const result = parser.parse({
		args: ['--include', 'src', 'position.txt', '--include=tests']
	});

	assert.strictEqual(result.success, true);
	assert.deepStrictEqual(result.values.include, ['src', 'tests']);
	assert.deepStrictEqual(result.positionals, ['position.txt']);
});

test('scalar duplicates are errors and values are absent on failure', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'] }
	});
	const result = parser.parse({
		args: ['--name', 'first', '--name', 'second']
	});

	assert.strictEqual(result.success, false);
	assert.strictEqual(Object.hasOwn(result, 'values'), false);
	assert.deepStrictEqual(result.issues, [
		{
			code: 'DUPLICATE_OPTION',
			message: 'Option "name" was specified more than once.',
			option: 'name',
			flag: '--name',
			argument: '--name',
			index: 2
		}
	]);
});

test('double dash always ends parsing and separates later arguments', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'] }
	});
	const result = parser.parse({
		args: ['before.txt', '--name', '--', '--literal', 'after.txt']
	});

	assert.strictEqual(result.success, false);
	assert.deepStrictEqual(result.positionals, ['before.txt']);
	assert.deepStrictEqual(result.argumentsAfterDoubleDash, [
		'--literal',
		'after.txt'
	]);
	assert.strictEqual(result.issues[0]?.code, 'MISSING_FLAG_VALUE');
});

test('allowed unknown flags retain their argument, flag, and original index', () => {
	const parser = createParser({
		all: { type: 'boolean', flags: ['-a'] },
		color: { type: 'boolean', flags: ['-c'] }
	});
	const result = parser.parse({
		args: ['file.txt', '-axc', '--other=value'],
		allowUnknownFlags: true
	});

	assert.strictEqual(result.success, true);
	assert.deepStrictEqual(result.values, { all: true, color: true });
	assert.deepStrictEqual(result.unknownArguments, [
		{ argument: '-axc', flag: '-x', index: 1 },
		{ argument: '--other=value', flag: '--other', index: 2 }
	]);
});

test('unknown flags never consume the following argument', () => {
	const parser = createParser({});
	const result = parser.parse({ args: ['--other', 'value'] });

	assert.strictEqual(result.success, false);
	assert.deepStrictEqual(result.positionals, ['value']);
	assert.deepStrictEqual(result.issues[0], {
		code: 'UNKNOWN_FLAG',
		message: 'Unknown flag "--other".',
		flag: '--other',
		argument: '--other',
		index: 0
	});
});

test('defaults apply only when an option is absent', () => {
	const defaultItems = ['base'];
	const parser = createParser({
		count: { type: 'number', flags: ['--count'], default: 2 },
		items: {
			type: 'string',
			flags: ['--item'],
			multiple: true,
			default: defaultItems
		},
		optionalItems: {
			type: 'string',
			flags: ['--optional-item'],
			multiple: true
		}
	});

	const absent = parser.parse({ args: [] });
	assert.strictEqual(absent.success, true);
	assert.deepStrictEqual(absent.values, {
		count: 2,
		items: ['base'],
		optionalItems: []
	});
	assert.notStrictEqual(absent.values.items, defaultItems);

	const specified = parser.parse({
		args: ['--count', '3', '--item', 'explicit']
	});
	assert.strictEqual(specified.success, true);
	assert.deepStrictEqual(specified.values, {
		count: 3,
		items: ['explicit'],
		optionalItems: []
	});
});

test('invalid explicit values cannot expose defaults or partial values', () => {
	const parser = createParser({
		count: { type: 'number', flags: ['--count'], default: 2 },
		mode: { type: 'string', flags: ['--mode'], default: 'safe' }
	});
	const result = parser.parse({ args: ['--count', 'many'] });

	assert.strictEqual(result.success, false);
	assert.strictEqual(Object.hasOwn(result, 'values'), false);
	assert.strictEqual(result.specified.count, true);
	assert.strictEqual(result.specified.mode, false);
	assert.strictEqual(result.issues[0]?.code, 'INVALID_FLAG_VALUE');
});

test('validates empty strings according to the definition', () => {
	const parser = createParser({
		label: {
			type: 'string',
			flags: ['--label'],
			allowEmpty: true
		},
		name: {
			type: 'string',
			flags: ['--name']
		}
	});
	const allowed = parser.parse({ args: ['--label='] });
	assert.strictEqual(allowed.success, true);
	assert.strictEqual(allowed.values.label, '');

	const rejected = parser.parse({ args: ['--name='] });
	assert.strictEqual(rejected.success, false);
	assert.strictEqual(rejected.issues[0]?.code, 'EMPTY_FLAG_VALUE');
});

test('successful results contain values and no diagnostics', () => {
	const parser = createParser({
		required: { type: 'string', flags: ['--required'], required: true }
	});
	const result = parser.parse({ args: ['--required', 'value'] });

	assert.strictEqual(result.success, true);
	assert.strictEqual(Object.hasOwn(result, 'issues'), false);
	assert.deepStrictEqual(result.argumentsAfterDoubleDash, []);
});

test('does not mutate explicit arguments and remains deterministic', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'] }
	});
	const args = ['--name', 'value'];
	const snapshot = [...args];
	const first = parser.parse({ args });
	const second = parser.parse({ args });

	assert.deepStrictEqual(args, snapshot);
	assert.deepStrictEqual(first, second);
});

test('rejects invalid parse settings', () => {
	const parser = createParser({});
	const sparseArguments = new Array(1);
	assert.throws(
		() => parser.parse(new Date()),
		/Parse settings must be a plain object/u
	);
	assert.throws(
		() => parser.parse({ args: sparseArguments }),
		/setting "args" must be a string array/u
	);
	assert.throws(
		() => parser.parse({ argv: [] }),
		/unsupported property "argv"/u
	);
	assert.throws(
		() => parser.parse({ args: [1] }),
		/setting "args" must be a string array/u
	);
	assert.throws(
		() => parser.parse({ args: undefined }),
		/setting "args" must be a string array/u
	);
});

test('uses process arguments when explicit arguments are omitted', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'], required: true }
	});
	const originalArguments = process.argv;
	process.argv = ['node', 'script', '--name', 'runtime'];
	try {
		const result = parser.parse();
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.values.name, 'runtime');
	} finally {
		process.argv = originalArguments;
	}
});

test('falls back to Deno arguments when process arguments are unavailable or malformed', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'], required: true }
	});
	const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
	const denoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Deno');
	try {
		Object.defineProperty(globalThis, 'process', {
			configurable: true,
			writable: true,
			value: undefined
		});
		Object.defineProperty(globalThis, 'Deno', {
			configurable: true,
			writable: true,
			value: { args: ['--name', 'deno'] }
		});
		const result = parser.parse();
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.values.name, 'deno');

		const sparseArguments = ['node', 'script'];
		sparseArguments.length = 3;
		Object.defineProperty(globalThis, 'process', {
			configurable: true,
			writable: true,
			value: { argv: sparseArguments }
		});
		const malformedProcessResult = parser.parse();
		assert.strictEqual(malformedProcessResult.success, true);
		assert.strictEqual(malformedProcessResult.values.name, 'deno');
	} finally {
		if (processDescriptor === undefined) {
			delete globalThis.process;
		} else {
			Object.defineProperty(globalThis, 'process', processDescriptor);
		}
		if (denoDescriptor === undefined) {
			delete globalThis.Deno;
		} else {
			Object.defineProperty(globalThis, 'Deno', denoDescriptor);
		}
	}
});
