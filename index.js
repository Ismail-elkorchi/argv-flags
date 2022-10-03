function parseArgs ( targetArgument, argumentType ) {
	const processArguments = process.argv;
	let argsIndex = [];

	for ( const key in processArguments ) {
		if ( processArguments[key].charAt( 0 ) === '-' && processArguments[key].charAt( 0 ) === '-' ) {
			argsIndex.push( [ processArguments[key], key ] );
		}
	}

	for ( const key in processArguments ) {
		if ( argumentType === 'string' && processArguments[key] === targetArgument ) {
			return processArguments[Number( key ) + 1];
		}

		if ( argumentType === 'array' && processArguments[key] === targetArgument ) {
			for ( const key in argsIndex ) {
				if ( argsIndex[key][0] === targetArgument ) {
					if ( argsIndex[key][1] > argsIndex[argsIndex.length - 1][1] ) {
						return processArguments.slice( Number( argsIndex[key][1] ) + 1, argsIndex[Number( key ) + 1][1] );
					} else {
						return processArguments.slice( Number( argsIndex[key][1] ) + 1 );
					}
				}
			}
		}

		if ( argumentType === 'boolean' ) {
			if ( processArguments.indexOf( targetArgument ) !== -1 ) {
				return true;
			}
			return false;
		}

		if ( argumentType === 'number' && processArguments[key] === targetArgument ) {
			return Number( processArguments[Number( key ) + 1] );
		}
	}
}

export { parseArgs };
