import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArgvCursor, createParser, value } from '../src/index.ts';
import { completedScan } from '../src/scanner.ts';

const parser = createParser({
	verbose: { type: 'count', flags: ['-v', '--verbose'] },
	name: { type: 'string', flags: ['-n', '--name'], multiple: true },
	mode: { type: 'string', flags: ['-m', '--mode'], valueMode: 'optional-inline', implicitValue: 'auto' }
});

test('whole-argv operations do not materialize discarded public spans', () => {
	const freeze = Object.freeze;
	let spans = 0;
	Object.freeze = (input) => {
		if (input !== null && typeof input === 'object' && Object.hasOwn(input, 'startIndex')) spans += 1;
		return freeze(input);
	};
	try {
		const argv = Array(1000).fill('-v');
		assert.equal(parser.parse({ argv }).values.verbose, 1000);
		assert.equal(parser.scan({ argv }).options.length, 1000);
		assert.equal(spans, 0);
		parser.scanNext(createArgvCursor({ argv: ['-v'] }));
		assert.equal(spans, 1);
	} finally {
		Object.freeze = freeze;
	}
});

test('parse adopts settings and caller argv once without intermediate settings copies', () => {
	const descriptor = Object.getOwnPropertyDescriptor;
	const argv = ['-v'];
	let settingsReads = 0;
	let argvReads = 0;
	Object.getOwnPropertyDescriptor = (input, key) => {
		if (key === 'flagPlacement' || key === 'unknownFlagPolicy') settingsReads += 1;
		if (input === argv && key === '0') argvReads += 1;
		return descriptor(input, key);
	};
	try {
		assert.equal(parser.parse({ argv, flagPlacement: 'interspersed', unknownFlagPolicy: 'collect' }).success, true);
		assert.equal(settingsReads, 2);
		assert.equal(argvReads, 1);
	} finally {
		Object.getOwnPropertyDescriptor = descriptor;
	}
});

test('retained public spans and completed scans stay frozen and completion is cached', () => {
	const cursor = createArgvCursor({ argv: ['-vnfirst', 'positional', '--unknown', '--', 'tail'] });
	const first = parser.scanNext(cursor);
	assert(Object.isFrozen(first));
	assert(Object.isFrozen(first.options));
	assert(Object.isFrozen(first.options[0]));
	assert.equal(Object.hasOwn(first.options[0], 'binding'), false);
	while (!cursor.done) parser.scanNext(cursor);
	const completed = completedScan(cursor);
	assert.strictEqual(completedScan(cursor), completed);
	for (const entries of [completed.options, completed.arguments, completed.afterDoubleDash, completed.unknownFlags, completed.issues]) {
		assert(Object.isFrozen(entries));
		for (const entry of entries) assert(Object.isFrozen(entry));
	}
	const result = parser.decode(cursor, { unknownFlagPolicy: 'collect' });
	assert.equal(result.success, true);
	assert(Object.isFrozen(result.values.name));
	assert.deepEqual(result.values.name, ['first']);
	assert.equal(first.options.length, 2);
	assert.equal(first.endIndex, 1);
	assert.deepEqual(first.arguments, []);
	assert.throws(() => first.options.push({}), TypeError);
	assert.throws(() => parser.scanNext(cursor), /already complete/u);
	assert.strictEqual(completedScan(cursor), completed);
});

test('short and long unattached values preserve syntax and parse/decode parity', () => {
	for (const argv of [
		['--name', '-v'], ['-n', '-v'], ['--name', '--'], ['-n', '--'],
		['--name'], ['-n'], ['--mode', 'tail'], ['-m', 'tail'],
		['--mode='], ['-m='], ['-mattached'], ['-vnmulti'], ['--name=']
	]) {
		for (const flagPlacement of ['interspersed', 'before-positionals']) {
			const cursor = createArgvCursor({ argv, flagPlacement });
			while (!cursor.done) parser.scanNext(cursor);
			assert.deepEqual(parser.decode(cursor), parser.parse({ argv, flagPlacement }));
		}
	}
	assert.equal(parser.scan({ argv: ['-n', '-v'] }).options[0].inline, false);
	assert.equal(parser.scan({ argv: ['--name', '-v'] }).options[0].rawValue, '-v');
	assert.equal(parser.scan({ argv: ['-m', 'tail'] }).arguments[0].value, 'tail');
});

test('large repeated values and terminator tails avoid spread-argument limits', () => {
	const argv = Array(150000).fill('--name=x');
	const parsed = parser.parse({ argv });
	assert.equal(parsed.values.name.length, argv.length);
	assert(Object.isFrozen(parsed.values.name));
	const cursor = createArgvCursor({ argv: ['--', ...Array(150000).fill('tail')] });
	const span = parser.scanNext(cursor);
	assert.equal(span.afterDoubleDash.length, 150000);
	assert.equal(parser.decode(cursor).afterDoubleDash.length, 150000);
});

test('cached classification does not cache mutable custom decoded values', () => {
	let snapshots = 0;
	const custom = createParser({ item: { flags: ['--item'], multiple: true, type: value.custom({
		parse: (raw) => ({ success: true, value: { raw } }),
		accepts: (candidate) => typeof candidate?.raw === 'string',
		snapshot(candidate) { snapshots += 1; return { ...candidate }; }
	}) } });
	const cursor = createArgvCursor({ argv: ['--item=a'] });
	custom.scanNext(cursor);
	const first = custom.decode(cursor);
	const second = custom.decode(cursor);
	assert.equal(snapshots, 2);
	assert.notStrictEqual(first.values.item, second.values.item);
	assert.notStrictEqual(first.values.item[0], second.values.item[0]);
	first.values.item[0].raw = 'changed';
	assert.equal(second.values.item[0].raw, 'a');
});

test('all external settings entry points retain strict validation', () => {
	for (const settings of [null, [], { argv: undefined }, { argv: [1] }, { argv: Array(1) }, { argv: [], flagPlacement: undefined }, { argv: [], extra: true }]) {
		assert.throws(() => parser.parse(settings), TypeError);
		assert.throws(() => parser.scan(settings), TypeError);
		assert.throws(() => createArgvCursor(settings), TypeError);
	}
	assert.throws(() => parser.parse({ argv: [], unknownFlagPolicy: undefined }), TypeError);
	const cursor = createArgvCursor({ argv: [] });
	assert.throws(() => parser.decode(cursor, { unknownFlagPolicy: undefined }), TypeError);
	assert.throws(() => parser.decode(cursor, { argv: [] }), TypeError);
	let reads = 0;
	const settings = { get argv() { reads += 1; return []; } };
	assert.throws(() => parser.parse(settings), /data property/u);
	assert.equal(reads, 0);
});

test('default runtime argv is adopted once with and without an explicit settings record', () => {
	const argv = process.argv;
	const descriptor = Object.getOwnPropertyDescriptor;
	process.argv = ['node', 'script', '-v'];
	try {
		for (const operation of [() => parser.parse(), () => parser.parse({}), () => parser.scan(), () => parser.scan({})]) {
			let arrayElementReads = 0;
			Object.getOwnPropertyDescriptor = (input, key) => {
				if (Array.isArray(input) && key !== 'length') arrayElementReads += 1;
				return descriptor(input, key);
			};
			try {
				operation();
				assert.equal(arrayElementReads, 3);
			} finally {
				Object.getOwnPropertyDescriptor = descriptor;
			}
		}
	} finally {
		process.argv = argv;
	}
});
