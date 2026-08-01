import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createParser, value } from '../dist/index.js';

const assertSuccess = (result) => {
	assert.strictEqual(result.success, true);
	return result;
};

const assertFailure = (result) => {
	assert.strictEqual(result.success, false);
	assert.strictEqual(Object.hasOwn(result, 'values'), false);
	return result;
};

test('supports long separate, inline, and explicit empty values', () => {
	const parser = createParser({
		first: { type: 'string', flags: ['--first'] },
		second: { type: 'string', flags: ['--second'] },
		empty: { type: value.string({ empty: 'allow' }), flags: ['--empty'] }
	});
	const result = assertSuccess(
		parser.parse({
			argv: ['--first', 'separate', '--second=inline=rest', '--empty=']
		})
	);
	assert.deepStrictEqual({ ...result.values }, {
		first: 'separate',
		second: 'inline=rest',
		empty: ''
	});

	const rejected = assertFailure(
		createParser({ name: { type: 'string', flags: ['--name'] } }).parse({
			argv: ['--name=']
		})
	);
	assert.strictEqual(rejected.issues[0]?.code, 'INVALID_OPTION_VALUE');
});

test('supports attached short values and value-taking cluster members', () => {
	const parser = createParser({
		all: { type: 'boolean', flags: ['-a'] },
		brief: { type: 'boolean', flags: ['-b'] },
		output: { type: 'string', flags: ['-o'] }
	});
	for (const [argvElement, expected] of [
		['-ovalue', 'value'],
		['-o=value', 'value'],
		['-o=', ''],
		['-o?!', '?!'],
		['-aboarchive.tar', 'archive.tar'],
		['-abo=archive.tar', 'archive.tar']
	]) {
		const result = parser.parse({ argv: [argvElement] });
		if (expected === '') {
			assert.strictEqual(assertFailure(result).issues[0]?.code, 'INVALID_OPTION_VALUE');
		} else {
			assert.strictEqual(assertSuccess(result).values.output, expected);
		}
	}
	const separate = assertSuccess(parser.parse({ argv: ['-o', '--literal'] }));
	assert.strictEqual(separate.values.output, '--literal');
});

test('scans unknown short members before configured value members', () => {
	const parser = createParser({
		output: { type: 'string', flags: ['-o'] }
	});
	const collected = assertSuccess(
		parser.parse({ argv: ['-xofile'], unknownFlagPolicy: 'collect' })
	);
	assert.strictEqual(collected.values.output, 'file');
	assert.deepStrictEqual(collected.unknownFlags, [
		{ argvElement: '-xofile', flag: '-x', argvIndex: 0, offset: 1 }
	]);

	const failed = assertFailure(parser.parse({ argv: ['-xofile'] }));
	assert.deepStrictEqual(
		failed.issues.map((issue) => issue.code),
		['UNKNOWN_FLAG']
	);
});

test('supports explicit false flags, count clusters, and zero-value rules', () => {
	const parser = createParser({
		verbose: {
			type: 'boolean',
			flags: ['-v', '--verbose'],
			falseFlags: ['--no-verbose'],
			repeat: 'last'
		},
		quiet: { type: 'count', flags: ['-q'] }
	});
	const result = assertSuccess(
		parser.parse({ argv: ['-qqq', '--verbose', '--no-verbose'] })
	);
	assert.strictEqual(result.values.verbose, false);
	assert.strictEqual(result.values.quiet, 3);

	const positional = assertSuccess(parser.parse({ argv: ['--verbose', 'false'] }));
	assert.deepStrictEqual(positional.positionals, ['false']);
	const longInline = assertFailure(parser.parse({ argv: ['--verbose=false'] }));
	assert.strictEqual(longInline.issues[0]?.code, 'UNEXPECTED_OPTION_VALUE');
	assert.strictEqual(longInline.issues[0]?.rawValue, 'false');
	const shortInline = assertFailure(parser.parse({ argv: ['-q=3'] }));
	assert.strictEqual(shortInline.issues[0]?.code, 'UNEXPECTED_OPTION_VALUE');
});

test('implements optional-inline values without consuming following elements', () => {
	const parser = createParser({
		verbose: { type: 'boolean', flags: ['-v'] },
		color: {
			type: value.choice(['auto', 'always', 'never']),
			flags: ['-c', '--color'],
			valueMode: 'optional-inline',
			implicitValue: 'auto',
			required: true
		},
		modes: {
			type: 'string',
			flags: ['--mode'],
			multiple: true,
			valueMode: 'optional-inline',
			implicitValue: 'auto'
		}
	});
	const bareLong = assertSuccess(parser.parse({ argv: ['--color', 'always'] }));
	assert.strictEqual(bareLong.values.color, 'auto');
	assert.deepStrictEqual(bareLong.positionals, ['always']);
	assert.strictEqual(
		assertSuccess(parser.parse({ argv: ['--color=always'] })).values.color,
		'always'
	);
	assert.strictEqual(
		assertSuccess(parser.parse({ argv: ['-cnever'] })).values.color,
		'never'
	);
	assert.strictEqual(
		assertSuccess(parser.parse({ argv: ['-c=always'] })).values.color,
		'always'
	);
	const cluster = assertSuccess(parser.parse({ argv: ['-vc'] }));
	assert.strictEqual(cluster.values.verbose, true);
	assert.strictEqual(cluster.values.color, 'auto');
	const multiple = assertSuccess(
		parser.parse({ argv: ['--color', '--mode', '--mode=manual', '--mode'] })
	);
	assert.deepStrictEqual(multiple.values.modes, ['auto', 'manual', 'auto']);
});

test('applies scalar repetition policies and preserves multiple order', () => {
	const parser = createParser({
		error: { type: 'string', flags: ['--error'] },
		first: { type: 'string', flags: ['--first'], repeat: 'first' },
		last: { type: 'integer', flags: ['--last'], repeat: 'last' },
		values: { type: 'number', flags: ['--value'], multiple: true }
	});
	const failure = assertFailure(
		parser.parse({
			argv: [
				'--error=a',
				'--error=b',
				'--first=a',
				'--first=b',
				'--last=1',
				'--last=2'
			]
		})
	);
	assert.strictEqual(failure.issues[0]?.code, 'REPEATED_OPTION');
	const success = assertSuccess(
		parser.parse({
			argv: [
				'--first=a',
				'--first=b',
				'--last=1',
				'--last=2',
				'--value=1.5',
				'--value',
				'-2'
			]
		})
	);
	assert.strictEqual(success.values.first, 'a');
	assert.strictEqual(success.values.last, 2);
	assert.deepStrictEqual(success.values.values, [1.5, -2]);
});

test('returns indexed unknown flags and deterministic suggestions', () => {
	const parser = createParser({
		version: { type: 'boolean', flags: ['--version'] },
		verbose: { type: 'boolean', flags: ['--verbose'] },
		verify: {
			type: 'boolean',
			flags: ['--verify'],
			falseFlags: ['--no-verify']
		}
	});
	const typo = assertFailure(parser.parse({ argv: ['--verison'] }));
	assert.deepStrictEqual(typo.unknownFlags, [
		{
			argvElement: '--verison',
			flag: '--verison',
			argvIndex: 0,
			suggestions: ['--version']
		}
	]);
	assert.deepStrictEqual(typo.issues[0]?.suggestions, ['--version']);
	assert.match(typo.issues[0]?.message, /Did you mean "--version"/u);

	const prefix = assertFailure(parser.parse({ argv: ['--ver'] }));
	assert.deepStrictEqual(prefix.issues[0]?.suggestions, [
		'--version',
		'--verbose',
		'--verify'
	]);
	const falseFlagPrefix = assertFailure(parser.parse({ argv: ['--no-ver'] }));
	assert.deepStrictEqual(falseFlagPrefix.issues[0]?.suggestions, ['--no-verify']);
	const collected = assertSuccess(
		parser.parse({
			argv: ['-xyz', '--other=value'],
			unknownFlagPolicy: 'collect'
		})
	);
	assert.deepStrictEqual(collected.unknownFlags, [
		{ argvElement: '-xyz', flag: '-x', argvIndex: 0, offset: 1 },
		{ argvElement: '-xyz', flag: '-y', argvIndex: 0, offset: 2 },
		{ argvElement: '-xyz', flag: '-z', argvIndex: 0, offset: 3 },
		{
			argvElement: '--other=value',
			flag: '--other',
			argvIndex: 1,
			inlineValue: 'value'
		}
	]);
});

test('reports malformed flag-like elements without classifying them as unknown', () => {
	const parser = createParser({});
	for (const argvElement of ['---name', '--=value', '-?', '-=value']) {
		const result = assertFailure(parser.parse({ argv: [argvElement] }));
		assert.strictEqual(result.issues[0]?.code, 'INVALID_FLAG_SYNTAX');
		assert.deepStrictEqual(result.unknownFlags, []);
	}
	const dash = assertSuccess(parser.parse({ argv: ['-'] }));
	assert.deepStrictEqual(dash.positionals, ['-']);
});

test('supports both positional modes and always honors double dash', () => {
	const parser = createParser({
		verbose: { type: 'boolean', flags: ['--verbose'] }
	});
	const interspersed = assertSuccess(
		parser.parse({ argv: ['first', '--verbose', 'second'] })
	);
	assert.strictEqual(interspersed.values.verbose, true);
	assert.deepStrictEqual(interspersed.positionals, ['first', 'second']);

	const beforePositionals = assertSuccess(
		parser.parse({
			argv: ['first', '--verbose', '--', '--after'],
			flagPlacement: 'before-positionals'
		})
	);
	assert.strictEqual(beforePositionals.values.verbose, undefined);
	assert.deepStrictEqual(beforePositionals.positionals, ['first', '--verbose']);
	assert.deepStrictEqual(beforePositionals.afterDoubleDash, ['--after']);
});

test('scan classifies option spans without decoding values', () => {
	let decodeCount = 0;
	const parser = createParser({
		verbose: { type: 'boolean', flags: ['-v'] },
		config: {
			type: value.custom({
				parse(raw) {
					decodeCount += 1;
					return { success: true, value: raw };
				},
				accepts(candidate) {
					return typeof candidate === 'string';
				}
			}),
			flags: ['-c', '--config']
		}
	});
	const scan = parser.scan({
		argv: ['-vc', 'file.json', 'deploy', '--unknown=x', '--', '--watch']
	});

	assert.strictEqual(decodeCount, 0);
	assert.deepStrictEqual(scan.options, [
		{
			option: 'verbose',
			flag: '-v',
			argvElement: '-vc',
			argvIndex: 0,
			offset: 1
		},
		{
			option: 'config',
			flag: '-c',
			argvElement: '-vc',
			argvIndex: 0,
			offset: 2,
			rawValue: 'file.json',
			valueArgvIndex: 1,
			inline: false
		}
	]);
	assert.deepStrictEqual(scan.arguments, [{ value: 'deploy', argvIndex: 2 }]);
	assert.deepStrictEqual(scan.unknownFlags, [{
		argvElement: '--unknown=x',
		flag: '--unknown',
		argvIndex: 3,
		inlineValue: 'x'
	}]);
	assert.deepStrictEqual(scan.afterDoubleDash, [{ value: '--watch', argvIndex: 5 }]);
	assert.strictEqual(scan.doubleDashIndex, 4);
	assert.deepStrictEqual(scan.issues, []);
});

test('double dash interrupts a waiting required value', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'] }
	});
	const result = assertFailure(
		parser.parse({ argv: ['before', '--name', '--', '--literal', 'after'] })
	);
	assert.strictEqual(result.issues[0]?.code, 'MISSING_OPTION_VALUE');
	assert.deepStrictEqual(result.positionals, ['before']);
	assert.deepStrictEqual(result.afterDoubleDash, ['--literal', 'after']);
});

test('implements decimal, safe-integer, and literal-choice parsers', () => {
	const parser = createParser({
		numbers: { type: 'number', flags: ['--number'], multiple: true },
		integer: {
			type: value.integer({ minimum: -2, maximum: 2 }),
			flags: ['--integer']
		},
		mode: {
			type: value.choice(['auto', 'always', 'off']),
			flags: ['--mode']
		}
	});
	const valid = assertSuccess(
		parser.parse({
			argv: [
				'--number=1',
				'--number=1.',
				'--number=.5',
				'--number=-2.5e2',
				'--integer=2',
				'--mode=auto'
			]
		})
	);
	assert.deepStrictEqual(valid.values.numbers, [1, 1, 0.5, -250]);
	assert.strictEqual(valid.values.integer, 2);

	for (const raw of ['Infinity', ' 1', '1_000', '1e', '.', '+']) {
		const invalid = assertFailure(parser.parse({ argv: [`--number=${raw}`] }));
		assert.strictEqual(invalid.issues[0]?.code, 'INVALID_OPTION_VALUE');
	}
	assert.strictEqual(
		assertFailure(parser.parse({ argv: ['--integer=3'] })).issues[0]?.code,
		'INVALID_OPTION_VALUE'
	);
	const choice = assertFailure(parser.parse({ argv: ['--mode=alwyas'] }));
	assert.deepStrictEqual(choice.issues[0]?.suggestions, ['always']);
});

test('applies defaults only after successful absence and never exposes fallback state on failure', () => {
	const defaults = ['base'];
	const parser = createParser({
		name: { type: 'string', flags: ['--name'], required: true },
		count: { type: 'integer', flags: ['--count'], default: 2 },
		items: { type: 'string', flags: ['--item'], multiple: true, default: defaults },
		empty: { type: 'string', flags: ['--empty'], multiple: true },
		verbosity: { type: 'count', flags: ['-v'] }
	});
	defaults[0] = 'changed';
	const missing = assertFailure(parser.parse({ argv: [] }));
	assert.strictEqual(missing.issues[0]?.code, 'MISSING_REQUIRED_OPTION');
	assert.strictEqual(Object.hasOwn(missing, 'values'), false);

	const success = assertSuccess(parser.parse({ argv: ['--name=value'] }));
	assert.deepStrictEqual({ ...success.values }, {
		name: 'value',
		count: 2,
		items: ['base'],
		empty: [],
		verbosity: 0
	});
	const invalid = assertFailure(
		parser.parse({ argv: ['--name=value', '--count=many'] })
	);
	assert.strictEqual(invalid.specified.count, true);
	assert.strictEqual(Object.hasOwn(invalid, 'values'), false);
});

test('marks rejected recognized occurrences as specified without adding missing-required issues', () => {
	const parser = createParser({
		jobs: { type: 'integer', flags: ['--jobs'], required: true }
	});
	const result = assertFailure(parser.parse({ argv: ['--jobs=many'] }));
	assert.strictEqual(result.specified.jobs, true);
	assert.deepStrictEqual(
		result.issues.map((issue) => issue.code),
		['INVALID_OPTION_VALUE']
	);
});

test('validates custom results and preserves structured custom diagnostics', () => {
	let receivedContext;
	const custom = value.custom({
		parse(raw, context) {
			receivedContext = context;
			return raw === 'accepted'
				? { success: true, value: raw }
				: {
						success: false,
						message: 'Custom value rejected.',
						reason: 'FORMAT',
						details: { expected: 'accepted' },
						suggestions: ['accepted', 'accepted']
					};
		},
		accepts(candidate) {
			return typeof candidate === 'string';
		}
	});
	const parser = createParser({ item: { type: custom, flags: ['--item'] } });
	const failure = assertFailure(parser.parse({ argv: ['--item=no'] }));
	const issue = failure.issues[0];
	assert.strictEqual(issue.reason, 'FORMAT');
	assert.deepStrictEqual({ ...issue.details }, { expected: 'accepted' });
	assert.deepStrictEqual(issue.suggestions, ['accepted']);
	assert.strictEqual(Object.isFrozen(issue.details), true);
	assert.strictEqual(Object.isFrozen(issue.suggestions), true);
	assert.deepStrictEqual(receivedContext, {
		option: 'item',
		flag: '--item',
		argvElement: '--item=no',
		argvIndex: 0,
		valueArgvIndex: 0,
		inline: true
	});
	assert.strictEqual(Object.isFrozen(receivedContext), true);

	const asyncValue = value.custom({
		async parse(raw) {
			return { success: true, value: raw };
		},
		accepts(candidate) {
			return typeof candidate === 'string';
		}
	});
	const asyncParser = createParser({ item: { type: asyncValue, flags: ['--item'] } });
	assert.throws(
		() => asyncParser.parse({ argv: ['--item=value'] }),
		/must be synchronous/u
	);
});

test('rejects malformed parse settings and keeps runtime resolution cross-runtime', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'], required: true }
	});
	const sparse = new Array(1);
	assert.throws(() => parser.parse(null), /Parse settings/u);
	assert.throws(() => parser.parse({ argv: sparse }), /dense string array/u);
	assert.throws(() => parser.parse({ argv: [1] }), /dense string array/u);
	assert.throws(() => parser.parse({ argv: [], typo: true }), /unsupported property/u);
	assert.throws(
		() => parser.parse({ unknownFlagPolicy: true }),
		/unknownFlagPolicy/u
	);
	assert.throws(() => parser.parse({ flagPlacement: 'after' }), /flagPlacement/u);
	assert.throws(
		() => parser.parse({ unknownFlags: 'collect' }),
		/unsupported property/u
	);
	assert.throws(
		() => parser.parse({ optionPlacement: 'before-positionals' }),
		/unsupported property/u
	);
	const accessor = {};
	Object.defineProperty(accessor, 'argv', { get: () => [] });
	assert.throws(() => parser.parse(accessor), /data property/u);

	const originalArgv = process.argv;
	process.argv = ['node', 'script', '--name', 'runtime'];
	try {
		assert.strictEqual(assertSuccess(parser.parse()).values.name, 'runtime');
	} finally {
		process.argv = originalArgv;
	}
});

test('falls back to Deno argv and then an empty vector when process argv is unusable', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'] }
	});
	const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
	const denoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Deno');
	try {
		Object.defineProperty(globalThis, 'process', {
			configurable: true,
			value: { argv: ['node', 1] }
		});
		Object.defineProperty(globalThis, 'Deno', {
			configurable: true,
			value: { args: ['--name=deno'] }
		});
		assert.strictEqual(assertSuccess(parser.parse()).values.name, 'deno');

		Object.defineProperty(globalThis, 'Deno', {
			configurable: true,
			value: { args: [1] }
		});
		assert.strictEqual(assertSuccess(parser.parse()).values.name, undefined);
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

test('returns fresh immutable package-owned results without mutating argv', () => {
	const parser = createParser({
		name: { type: 'string', flags: ['--name'] },
		items: { type: 'string', flags: ['--item'], multiple: true }
	});
	const argv = ['--name=value', '--item=a'];
	const snapshot = [...argv];
	const first = assertSuccess(parser.parse({ argv }));
	const second = assertSuccess(parser.parse({ argv }));
	assert.deepStrictEqual(argv, snapshot);
	assert.deepStrictEqual(first, second);
	assert.notStrictEqual(first, second);
	assert.notStrictEqual(first.values, second.values);
	assert.notStrictEqual(first.values.items, second.values.items);
	assert.strictEqual(Object.getPrototypeOf(first.values), null);
	assert.strictEqual(Object.getPrototypeOf(first.specified), null);
	assert.strictEqual(Object.isFrozen(first), true);
	assert.strictEqual(Object.isFrozen(first.values), true);
	assert.strictEqual(Object.isFrozen(first.values.items), true);
	assert.strictEqual(Object.isFrozen(first.positionals), true);
	assert.strictEqual(Object.isFrozen(first.unknownFlags), true);
});
