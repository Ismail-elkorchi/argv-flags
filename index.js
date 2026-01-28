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

const findFlagMatch = ( argv, targetArgument ) => {
	const directIndex = argv.indexOf( targetArgument );
	if ( directIndex !== -1 ) {
		return { index: directIndex };
	}

	const prefix = `${targetArgument}=`;
	const inlineIndex = argv.findIndex( ( value ) => typeof value === 'string' && value.startsWith( prefix ) );
	if ( inlineIndex === -1 ) {
		return null;
	}

	return {
		index: inlineIndex,
		inlineValue: argv[ inlineIndex ].slice( prefix.length )
	};
};

function parseFlag( targetArgument, argumentType, argv = process.argv ) {
	const processArguments = Array.isArray( argv ) ? argv : process.argv;
	const match = findFlagMatch( processArguments, targetArgument );

	if ( ! match ) {
		return false;
	}

	const inlineValue = Object.prototype.hasOwnProperty.call( match, 'inlineValue' )
		? match.inlineValue
		: undefined;
	const nextValue = processArguments[ match.index + 1 ];

	if ( argumentType === 'string' ) {
		if ( typeof inlineValue === 'string' ) {
			return inlineValue;
		}
		if ( typeof nextValue !== 'string' || isLongFlag( nextValue ) ) {
			return false;
		}
		return nextValue;
	}

	if ( argumentType === 'array' ) {
		const values = [];
		if ( typeof inlineValue === 'string' && inlineValue.length > 0 ) {
			values.push( inlineValue );
		}
		for ( let i = match.index + 1; i < processArguments.length; i++ ) {
			const value = processArguments[ i ];
			if ( isLongFlag( value ) ) {
				break;
			}
			values.push( value );
		}
		return values;
	}

	if ( argumentType === 'boolean' ) {
		const normalizedValue = normalizeBooleanValue( typeof inlineValue === 'string' ? inlineValue : nextValue );
		if ( typeof normalizedValue === 'boolean' ) {
			return normalizedValue;
		}
		return true;
	}

	if ( argumentType === 'number' ) {
		const candidate = typeof inlineValue === 'string' ? inlineValue : nextValue;
		if ( typeof candidate !== 'string' || isLongFlag( candidate ) ) {
			return false;
		}
		const parsed = Number( candidate );
		return Number.isNaN( parsed ) ? false : parsed;
	}

	return false;
}

module.exports = parseFlag;
