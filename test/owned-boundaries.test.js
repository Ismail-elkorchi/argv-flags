import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createParser, value } from '../dist/index.js';

test('structural value methods retain their receiver for every operation', () => {
	class Identifier {
		prefix = 'id:';
		parse(raw) { return { success: true, value: this.prefix + raw }; }
		accepts(candidate) { return typeof candidate === 'string' && candidate.startsWith(this.prefix); }
		snapshot(candidate) { assert(this.accepts(candidate)); return candidate; }
	}
	const parser = createParser({ id: { type: new Identifier(), flags: ['--id'], default: 'id:default' } });
	assert.equal(parser.parse({ argv: ['--id=x'] }).values.id, 'id:x');
	assert.equal(parser.parse({ argv: [] }).values.id, 'id:default');
});

test('factory and structural values use the same result validation and snapshot boundary', () => {
	for (const result of [
		null,
		{ success: true },
		{ success: true, value: 'x', extra: true },
		{ success: false, message: '' },
		{ success: false, message: 'No', reason: undefined },
		{ success: false, message: 'No', suggestions: [''] }
	]) {
		const callbacks = { parse: () => result, accepts: () => true, snapshot: (input) => input };
		for (const type of [callbacks, value.custom(callbacks)]) {
			assert.throws(() => createParser({ x: { type, flags: ['--x'] } }).parse({ argv: ['--x=a'] }), TypeError);
		}
	}
	let checks = 0;
	let snapshots = 0;
	const custom = value.custom({
		parse: (raw) => ({ success: true, value: { raw } }),
		accepts(candidate) { checks += 1; return typeof candidate?.raw === 'string'; },
		snapshot(candidate) { snapshots += 1; return { ...candidate }; }
	});
	const parsed = createParser({ x: { type: custom, flags: ['--x'] } }).parse({ argv: ['--x=a'] });
	assert.equal(parsed.success, true);
	assert.equal(checks, 2);
	assert.equal(snapshots, 1);
});

test('array accessors cannot alter flag ownership or bypass argv validation', () => {
	let reads = 0;
	const flags = [];
	Object.defineProperty(flags, '0', { get() { reads += 1; return reads === 1 ? '--shared' : '--other'; } });
	assert.throws(() => createParser({ first: { type: 'boolean', flags }, second: { type: 'boolean', flags: ['--shared'] } }), /data property/u);
	const parser = createParser({ x: { type: 'boolean', flags: ['--x'] } });
	assert.throws(() => parser.parse({ argv: flags }), /data property/u);
	assert.throws(() => parser.scan({ argv: flags }), /data property/u);
	assert.throws(() => value.choice(flags), /data property/u);
	assert.equal(reads, 0);
});

test('adoption ignores caller iterators and does not reread data through get traps', () => {
	const array = ['--x'];
	array[Symbol.iterator] = () => { throw new Error('Caller iterator ran'); };
	let reads = 0;
	const flags = new Proxy(array, { get() { reads += 1; throw new Error('Caller get ran'); } });
	const definition = new Proxy({ type: 'boolean', flags }, { get() { reads += 1; throw new Error('Definition get ran'); } });
	const parser = createParser({ x: definition });
	assert.equal(parser.parse({ argv: array }).values.x, true);
	assert.equal(reads, 0);
});

test('value result accessors are rejected before any value is read', () => {
	let reads = 0;
	const result = { value: 'x' };
	Object.defineProperty(result, 'success', { get() { reads += 1; return true; } });
	const custom = value.custom({ parse: () => result, accepts: () => true });
	assert.throws(() => createParser({ x: { type: custom, flags: ['--x'] } }).parse({ argv: ['--x=a'] }), /data property/u);
	assert.equal(reads, 0);
});


test('promise detection never executes then accessors on custom results or snapshots', () => {
	let reads = 0;
	const thenable = { success: true, value: 'x' };
	Object.defineProperty(thenable, 'then', { get() { reads += 1; return undefined; } });
	for (const callbacks of [
		{ parse: () => thenable, accepts: () => true },
		{ parse: () => ({ success: true, value: 'x' }), accepts: () => true, snapshot: () => thenable }
	]) {
		const parser = createParser({ x: { type: value.custom(callbacks), flags: ['--x'] } });
		assert.throws(() => parser.parse({ argv: ['--x=x'] }), /data property/u);
	}
	assert.equal(reads, 0);
});


test('custom scalar array values retain their own snapshot semantics', () => {
	class Labels extends Array {}
	const defaultValue = new Labels('default');
	const implicitValue = new Labels('implicit');
	const custom = value.custom({
		parse: (raw) => ({ success: true, value: new Labels(raw) }),
		accepts: (candidate) => candidate instanceof Labels,
		snapshot: (candidate) => new Labels(...candidate)
	});
	const parser = createParser({
		x: { type: custom, flags: ['--x'], default: defaultValue },
		y: { type: custom, flags: ['--y'], valueMode: 'optional-inline', implicitValue },
		many: { type: custom, flags: ['--many'], multiple: true, default: [defaultValue] }
	});
	defaultValue[0] = 'changed';
	implicitValue[0] = 'changed';
	const parsed = parser.parse({ argv: ['--y'] });
	assert.equal(parsed.values.x instanceof Labels, true);
	assert.equal(parsed.values.y instanceof Labels, true);
	assert.equal(parsed.values.many[0] instanceof Labels, true);
	assert.equal(parsed.values.x[0], 'default');
	assert.equal(parsed.values.y[0], 'implicit');
	assert.equal(parsed.values.many[0][0], 'default');
});
