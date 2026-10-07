import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeParsers, createArgvCursor, createParser, DefinitionError, value } from '../dist/index.js';

test('scope changes retain exact spans and decode without touching argv again', () => {
	let parses = 0;
	const root = createParser({ config: { type: 'string', flags: ['-c', '--config'] } });
	const command = createParser({ item: { type: value.custom({
		parse(raw) { parses += 1; return { success: true, value: raw }; },
		accepts: (candidate) => typeof candidate === 'string'
	}), flags: ['--item'], required: true } });
	const final = composeParsers([root, command]);
	const argv = ['-c', 'deploy', 'deploy', '--item=x', '--', '--literal'];
	const cursor = createArgvCursor({ argv });
	argv.fill('changed');
	const first = root.scanNext(cursor);
	assert.equal(first.startIndex, 0);
	assert.equal(first.endIndex, 2);
	assert.equal(first.options[0].rawValue, 'deploy');
	assert.equal(root.scanNext(cursor).arguments[0].value, 'deploy');
	const item = final.scanNext(cursor);
	assert.equal(item.options[0].argvIndex, 3);
	assert.equal(parses, 0);
	const terminator = final.scanNext(cursor);
	assert.equal(terminator.doubleDashIndex, 4);
	assert.equal(terminator.endIndex, 6);
	assert.equal(cursor.done, true);
	assert(Object.isFrozen(first.options[0]));
	const result = final.decode(cursor);
	assert.equal(parses, 1);
	assert.equal(result.success, true);
	assert.deepEqual({ ...result.values }, { config: 'deploy', item: 'x' });
	assert.deepEqual(result.positionals, ['deploy']);
	assert.deepEqual(result.afterDoubleDash, ['--literal']);
	assert.equal(first.endIndex, 2);
});

test('cursors reject forgery, incomplete decode, exhausted scans and unrelated declarations', () => {
	const parser = createParser({ x: { type: 'string', flags: ['--x'] } });
	const cursor = createArgvCursor({ argv: ['--x=a', 'tail'] });
	assert.throws(() => parser.decode(cursor), /complete/u);
	parser.scanNext(cursor);
	assert.throws(() => parser.decode(cursor), /complete/u);
	assert.throws(() => parser.scanNext({ argv: [], index: 0, done: true }), /owned/u);
	assert.throws(() => parser.decode({ argv: [], index: 0, done: true }), /owned/u);
	parser.scanNext(cursor);
	assert.throws(() => parser.scanNext(cursor), /already complete/u);
	const other = createParser({ x: { type: 'string', flags: ['--x'] } });
	assert.throws(() => other.decode(cursor), /different option declaration/u);
	assert.equal(composeParsers([parser]).decode(cursor).values.x, 'a');
});

test('retained classification preserves errors, repeated values and final defaults', () => {
	const parser = createParser({
		verbose: { type: 'boolean', flags: ['-v', '--verbose'] },
		mode: { type: 'string', flags: ['--mode'], valueMode: 'optional-inline', implicitValue: 'auto' },
		name: { type: 'string', flags: ['--name'] },
		defaulted: { type: 'integer', flags: ['--defaulted'], default: 3 }
	});
	for (const argv of [
		['--mode'], ['--mode', '--mode=x'], ['--name', '--'],
		['--verbose=x'], ['-v?'], ['--unknown'], ['one', '--verbose', '--', 'tail']
	]) {
		for (const flagPlacement of ['interspersed', 'before-positionals']) {
			const cursor = createArgvCursor({ argv, flagPlacement });
			while (!cursor.done) parser.scanNext(cursor);
			assert.deepEqual(parser.decode(cursor), parser.parse({ argv, flagPlacement }));
			assert.deepEqual(parser.decode(cursor, { unknownFlagPolicy: 'collect' }), parser.parse({ argv, flagPlacement, unknownFlagPolicy: 'collect' }));
		}
	}
});

test('composition keeps declaration snapshots and rejects overlapping ownership', () => {
	let snapshots = 0;
	const custom = value.custom({ parse: (raw) => ({ success: true, value: { raw } }),
		accepts: (candidate) => typeof candidate?.raw === 'string',
		snapshot(candidate) { snapshots += 1; return { ...candidate }; }
	});
	const parent = createParser({ x: { type: custom, flags: ['--x'], default: { raw: 'default' } } });
	assert.equal(snapshots, 1);
	const child = createParser({ y: { type: 'boolean', flags: ['--y'] } });
	for (let index = 0; index < 5; index += 1) composeParsers([parent, child]);
	assert.equal(snapshots, 1);
	const result = composeParsers([parent, child]).parse({ argv: [] });
	assert.equal(result.values.x.raw, 'default');
	assert.equal(snapshots, 2);
	assert.throws(() => composeParsers([parent, parent]), (error) => error instanceof DefinitionError && error.issues.some((issue) => issue.code === 'DUPLICATE_OPTION'));
	assert.throws(() => composeParsers([parent, createParser({ y: { type: 'boolean', flags: ['--x'] } })]), (error) => error instanceof DefinitionError && error.issues.some((issue) => issue.code === 'DUPLICATE_FLAG'));
	assert.throws(() => composeParsers([{}]), /owned parser/u);
});
