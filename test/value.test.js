import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createParser, value } from '../dist/index.js';

test('validates value-factory settings and snapshots their inputs', () => {
	assert.throws(() => value.string(null), /plain object/u);
	assert.throws(() => value.string({ empty: undefined }), /empty/u);
	assert.throws(() => value.number({ minimum: undefined }), /minimum/u);
	assert.throws(() => value.number({ minimum: 2, maximum: 1 }), /must not exceed/u);
	assert.throws(() => value.number({ minimum: Number.NaN }), /finite/u);
	assert.throws(() => value.integer({ minimum: 0.5 }), /safe integers/u);
	assert.throws(() => value.choice([]), /non-empty/u);
	assert.throws(() => value.choice(['same', 'same']), /unique/u);
	assert.throws(() => value.choice(['valid', 1]), /string array/u);
	assert.throws(() => value.number({ typo: true }), /unsupported property/u);

	const accessor = {};
	Object.defineProperty(accessor, 'minimum', { get: () => 0 });
	assert.throws(() => value.number(accessor), /data property/u);

	const settings = { minimum: 0 };
	const number = value.number(settings);
	settings.minimum = 10;
	const parser = createParser({ number: { type: number, flags: ['--number'] } });
	assert.strictEqual(parser.parse({ argv: ['--number=5'] }).success, true);

	const choices = ['one', 'two'];
	const choice = value.choice(choices);
	choices[0] = 'changed';
	const choiceParser = createParser({ choice: { type: choice, flags: ['--choice'] } });
	assert.strictEqual(
		choiceParser.parse({ argv: ['--choice=one'] }).success,
		true
	);
});

test('uses exact one-edit choice suggestions without prefix or normalization guesses', () => {
	const parser = createParser({
		mode: {
			type: value.choice(['always', 'café']),
			flags: ['--mode']
		}
	});
	for (const input of ['alway', 'alwayss', 'alwayx', 'alwyas']) {
		const result = parser.parse({ argv: [`--mode=${input}`] });
		assert.strictEqual(result.success, false);
		assert.deepStrictEqual(result.issues[0]?.suggestions, ['always']);
	}
	const unicode = parser.parse({ argv: ['--mode=cafe'] });
	assert.strictEqual(unicode.success, false);
	assert.deepStrictEqual(unicode.issues[0]?.suggestions, ['café']);
	const prefix = parser.parse({ argv: ['--mode=alw'] });
	assert.strictEqual(prefix.success, false);
	assert.strictEqual(prefix.issues[0]?.suggestions, undefined);
	const decomposed = parser.parse({ argv: ['--mode=café'] });
	assert.strictEqual(decomposed.success, false);
	assert.strictEqual(decomposed.issues[0]?.suggestions, undefined);

	const emptyChoice = createParser({
		mode: { type: value.choice(['']), flags: ['--mode'] }
	}).parse({ argv: ['--mode=a'] });
	assert.strictEqual(emptyChoice.success, false);
	assert.strictEqual(emptyChoice.issues[0]?.suggestions, undefined);
});

test('captures custom callbacks and exposes a structural value parser', () => {
	const callbacks = {
		parse(raw) {
			return { success: true, value: raw };
		},
		accepts(candidate) {
			return typeof candidate === 'string';
		}
	};
	const custom = value.custom(callbacks);
	callbacks.parse = () => ({ success: false, message: 'Changed.' });
	const parser = createParser({ custom: { type: custom, flags: ['--custom'] } });
	const result = parser.parse({ argv: ['--custom=original'] });
	assert.strictEqual(result.success, true);
	assert.strictEqual(result.values.custom, 'original');
	assert.strictEqual(Object.isFrozen(custom), true);
	assert.deepStrictEqual(Reflect.ownKeys(custom), [
		'parse',
		'accepts',
		'snapshot'
	]);

	assert.throws(
		() => value.custom({ ...callbacks, snapshot: undefined }),
		/snapshot must be a function/u
	);
	assert.throws(
		() => value.custom({ ...callbacks, extra: true }),
		/unsupported property/u
	);
});

test('accepts value parsers by their public method shape', () => {
	class UppercaseParser {
		parse(raw) {
			return { success: true, value: raw.toUpperCase() };
		}

		accepts(candidate) {
			return typeof candidate === 'string';
		}

		snapshot(candidate) {
			return candidate;
		}
	}

	const result = createParser({
		name: { type: new UppercaseParser(), flags: ['--name'] }
	}).parse({ argv: ['--name=casey'] });
	assert.strictEqual(result.success, true);
	assert.strictEqual(result.values.name, 'CASEY');
});

test('value parsers interoperate across independent module instances', async () => {
	const root = await mkdtemp(join(tmpdir(), 'argv-flags-instances-'));
	try {
		await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
		await cp(new URL('../dist/', import.meta.url), join(root, 'first'), { recursive: true });
		await cp(new URL('../dist/', import.meta.url), join(root, 'second'), { recursive: true });
		const first = await import(pathToFileURL(join(root, 'first', 'index.js')).href);
		const second = await import(pathToFileURL(join(root, 'second', 'index.js')).href);
		const externalChoice = first.value.choice(['eu', 'us']);
		const parser = second.createParser({
			region: {
				type: externalChoice,
				flags: ['--region'],
				required: true
			}
		});

		const result = parser.parse({ argv: ['--region=eu'] });
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.values.region, 'eu');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('snapshots each successfully decoded custom value once', () => {
	let decoded;
	let snapshotCount = 0;
	const custom = value.custom({
		parse(raw) {
			decoded = { text: raw };
			return { success: true, value: decoded };
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
	const result = createParser({
		item: { type: custom, flags: ['--item'] }
	}).parse({ argv: ['--item=value'] });
	assert.strictEqual(result.success, true);
	assert.strictEqual(snapshotCount, 1);
	assert.deepStrictEqual(result.values.item, { text: 'value' });
	assert.notStrictEqual(result.values.item, decoded);
});

test('rejects every malformed custom callback result at the callback boundary', () => {
	const createCustomParser = (parse, accepts = () => true, snapshot) =>
		createParser({
			item: {
				type: value.custom({
					parse,
					accepts,
					...(snapshot === undefined ? {} : { snapshot })
				}),
				flags: ['--item']
			}
		});
	const run = (parser) => parser.parse({ argv: ['--item=value'] });

	assert.throws(() => run(createCustomParser(() => null)), /malformed result/u);
	assert.throws(
		() => run(createCustomParser(() => ({ success: 'yes' }))),
		/success must be boolean/u
	);
	assert.throws(
		() => run(createCustomParser(() => ({ success: true, value: 'value', extra: true }))),
		/unsupported property/u
	);
	assert.throws(
		() => run(createCustomParser(() => ({ success: true, value: 'value' }), () => false)),
		/unacceptable value/u
	);
	assert.throws(
		() => run(createCustomParser(() => ({ success: true, value: 'value' }), () => 'yes')),
		/accepts callback must return a boolean/u
	);
	assert.throws(
		() => run(createCustomParser(() => ({ success: false, message: '' }))),
		/non-empty string/u
	);
	assert.throws(
		() =>
			run(
				createCustomParser(() => ({
					success: false,
					message: 'No.',
					reason: undefined
				}))
			),
		/reason must be a non-empty string/u
	);
	assert.throws(
		() =>
			run(
				createCustomParser(() => ({
					success: false,
					message: 'No.',
					suggestions: ['']
				}))
			),
		/suggestions must not be empty/u
	);
	assert.throws(
		() =>
			run(
				createCustomParser(() => ({
					success: false,
					message: 'No.',
					suggestions: ['one', 'two', 'three', '']
				}))
			),
		/suggestions must not be empty/u
	);
	assert.throws(
		() =>
			run(
				createCustomParser(
					() => ({ success: true, value: 'value' }),
					() => true,
					() => Promise.resolve('value')
				)
			),
		/snapshot must be synchronous/u
	);
	assert.throws(
		() =>
			run(
				createCustomParser(
					() => ({ success: true, value: 'value' }),
					(candidate) => typeof candidate === 'string',
					() => 1
				)
			),
		/snapshot returned an unacceptable value/u
	);
});

test('propagates custom callback exceptions unchanged', () => {
	const expected = new Error('callback failed');
	const custom = value.custom({
		parse() {
			throw expected;
		},
		accepts() {
			return true;
		}
	});
	const parser = createParser({ custom: { type: custom, flags: ['--custom'] } });
	assert.throws(
		() => parser.parse({ argv: ['--custom=value'] }),
		(error) => error === expected
	);
});
