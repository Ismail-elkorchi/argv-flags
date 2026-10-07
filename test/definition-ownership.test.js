import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileDefinitions, composeDefinitions } from '../dist/definitions.js';
import { DefinitionError } from '../dist/definition-error.js';
import { getRuntimeValueParser, value } from '../dist/value.js';

const definitionIssues = (action) => {
	try {
		action();
		assert.fail('Expected definition validation to fail.');
	} catch (error) {
		assert(error instanceof DefinitionError);
		return error.issues;
	}
};

test('one frozen prototype-safe binding map owns every spelling and polarity', () => {
	const compiled = compileDefinitions({
		constructor: { type: 'boolean', flags: ['--constructor', '-c'], falseFlags: ['--no-constructor', '-C'] },
		toString: { type: 'count', flags: ['--toString', '-t'] },
		value: { type: 'string', flags: ['--value', '-v'] }
	});
	assert.equal(Object.getPrototypeOf(compiled.bindings), null);
	assert(Object.isFrozen(compiled.bindings));
	assert.deepEqual(Object.keys(compiled), ['options', 'bindings', 'longFlags']);
	assert.deepEqual(compiled.longFlags, ['--constructor', '--no-constructor', '--toString', '--value']);
	for (const option of compiled.options) {
		for (const flag of option.flags) {
			assert.equal(compiled.bindings[flag].option, option);
			assert(Object.isFrozen(compiled.bindings[flag]));
		}
	}
	assert.equal(compiled.bindings['-c'].booleanValue, true);
	assert.equal(compiled.bindings['-C'].booleanValue, false);
	assert.equal(compiled.bindings['--no-constructor'].booleanValue, false);
	assert.equal(compiled.bindings.constructor, undefined);
});

test('raw and composed definitions share complete duplicate diagnostics and first ownership', () => {
	const declarations = {
		first: { type: 'boolean', flags: ['--on', '-x'], falseFlags: ['--off', '-X'] },
		second: { type: 'boolean', flags: ['--off', '-x'], falseFlags: ['--on', '-X'] },
		third: { type: 'count', flags: ['--on', '-X'] }
	};
	const raw = definitionIssues(() => compileDefinitions(declarations));
	const composed = definitionIssues(() => composeDefinitions(
		Object.entries(declarations).map(([name, definition]) => compileDefinitions({ [name]: definition }))
	));
	assert.deepEqual(composed, raw);
	assert.equal(raw.length, 6);
	assert(raw.every((issue) => issue.conflictingOption === 'first'));
	assert.deepEqual(raw.map(({ property, flagIndex, conflictingProperty }) => [property, flagIndex, conflictingProperty]), [
		['flags', 0, 'falseFlags'], ['flags', 1, 'flags'],
		['falseFlags', 0, 'flags'], ['falseFlags', 1, 'falseFlags'],
		['flags', 0, 'flags'], ['flags', 1, 'falseFlags']
	]);
});

test('invalid definitions still claim their valid flags for all duplicate diagnostics', () => {
	const issues = definitionIssues(() => compileDefinitions({
		first: { type: 'boolean', flags: ['--shared', 'invalid'], falseFlags: ['-x'], default: 'invalid' },
		second: { type: 'unsupported', flags: ['--shared', '-x', '--shared'] }
	}));
	assert(issues.some((issue) => issue.code === 'INVALID_FLAG'));
	assert(issues.some((issue) => issue.code === 'INVALID_DEFAULT'));
	const duplicates = issues.filter((issue) => issue.code === 'DUPLICATE_FLAG');
	assert.deepEqual(duplicates.map(({ flag, flagIndex, conflictingOption, conflictingProperty }) =>
		[flag, flagIndex, conflictingOption, conflictingProperty]), [
		['--shared', 0, 'first', 'flags'],
		['-x', 1, 'first', 'falseFlags'],
		['--shared', 2, 'first', 'flags']
	]);
});

test('failure details keep the shallow owned frozen record boundary', () => {
	const nested = { retained: true };
	const details = Object.assign(Object.create(null), { constructor: 'original', nested });
	const parser = value.custom({
		parse: () => ({ success: false, message: 'Invalid', details }),
		accepts: () => true
	});
	const result = parser.parse('input', {});
	details.constructor = 'changed';
	assert.equal(result.details.constructor, 'original');
	assert.equal(result.details.nested, nested);
	assert.equal(Object.getPrototypeOf(result.details), null);
	assert(Object.isFrozen(result.details));
	assert.notEqual(result.details, details);
	details[Symbol('hidden')] = true;
	assert.throws(() => parser.parse('input', {}), /string keys/u);
});

test('choice factory exposes the single adopted immutable runtime choices array', () => {
	const choices = ['first', 'second'];
	const parser = value.choice(choices);
	assert.equal(parser.choices, getRuntimeValueParser(parser).choices);
	assert(Object.isFrozen(parser.choices));
	assert.notEqual(parser.choices, choices);
	choices[0] = 'changed';
	assert.deepEqual(parser.choices, ['first', 'second']);
	assert.deepEqual(parser.parse('first', {}), { success: true, value: 'first' });
});
