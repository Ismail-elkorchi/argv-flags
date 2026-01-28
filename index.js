'use strict';

const isLongFlag = ( value ) => typeof value === 'string' && value.startsWith( '--' );

const normalizeBooleanValue = ( value ) => {
	if ( typeof value !== 'string' ) {
		return undefined;
	}
	const normalized = value.toLowerCase();
	if ( normalized === 'true' ) {
		return true;
	}
	if ( normalized === 'false' ) {
		return false;
	}
	return undefined;
};

function parseFlag( targetArgument, argumentType, argv = process.argv ) {
	const processArguments = Array.isArray( argv ) ? argv : process.argv;
	const targetIndex = processArguments.indexOf( targetArgument );

	if ( targetIndex === -1 ) {
		return false;
	}

	const nextValue = processArguments[ targetIndex + 1 ];

	if ( argumentType === 'string' ) {
		if ( typeof nextValue !== 'string' || isLongFlag( nextValue ) ) {
			return false;
		}
		return nextValue;
	}

	if ( argumentType === 'array' ) {
		const values = [];
		for ( let i = targetIndex + 1; i < processArguments.length; i++ ) {
			const value = processArguments[ i ];
			if ( isLongFlag( value ) ) {
				break;
			}
			values.push( value );
		}
		return values;
	}

	if ( argumentType === 'boolean' ) {
		const normalizedValue = normalizeBooleanValue( nextValue );
		if ( typeof normalizedValue === 'boolean' ) {
			return normalizedValue;
		}
		return true;
	}

	if ( argumentType === 'number' ) {
		if ( typeof nextValue !== 'string' || isLongFlag( nextValue ) ) {
			return false;
		}
		const parsed = Number( nextValue );
		return Number.isNaN( parsed ) ? false : parsed;
	}

	return false;
}

module.exports = parseFlag;
