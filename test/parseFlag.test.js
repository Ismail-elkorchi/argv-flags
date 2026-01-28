'use strict';

const assert = require( 'assert' );
const { test } = require( 'node:test' );
const parseFlag = require( '../index' );

const withArgv = ( argv ) => [ 'node', 'script.js', ...argv ];

test( 'string flag returns next value', () => {
	const result = parseFlag( '--name', 'string', withArgv( [ '--name', 'dir-archiver' ] ) );
	assert.strictEqual( result, 'dir-archiver' );
} );

test( 'string flag returns false when missing', () => {
	const result = parseFlag( '--missing', 'string', withArgv( [] ) );
	assert.strictEqual( result, false );
} );

test( 'string flag returns false when next is another flag', () => {
	const result = parseFlag( '--name', 'string', withArgv( [ '--name', '--other' ] ) );
	assert.strictEqual( result, false );
} );

test( 'array flag collects values until next flag', () => {
	const result = parseFlag( '--items', 'array', withArgv( [ '--items', 'a', 'b', '--other', 'c' ] ) );
	assert.deepStrictEqual( result, [ 'a', 'b' ] );
} );

test( 'array flag returns empty array when no values follow', () => {
	const result = parseFlag( '--items', 'array', withArgv( [ '--items', '--other' ] ) );
	assert.deepStrictEqual( result, [] );
} );

test( 'boolean flag returns true when present without value', () => {
	const result = parseFlag( '--flag', 'boolean', withArgv( [ '--flag' ] ) );
	assert.strictEqual( result, true );
} );

test( 'boolean flag respects true/false values', () => {
	const trueResult = parseFlag( '--flag', 'boolean', withArgv( [ '--flag', 'true' ] ) );
	const falseResult = parseFlag( '--flag', 'boolean', withArgv( [ '--flag', 'false' ] ) );
	assert.strictEqual( trueResult, true );
	assert.strictEqual( falseResult, false );
} );

test( 'number flag parses numeric values', () => {
	const result = parseFlag( '--count', 'number', withArgv( [ '--count', '42' ] ) );
	assert.strictEqual( result, 42 );
} );

test( 'number flag returns false when invalid', () => {
	const result = parseFlag( '--count', 'number', withArgv( [ '--count', 'NaN' ] ) );
	assert.strictEqual( result, false );
} );
