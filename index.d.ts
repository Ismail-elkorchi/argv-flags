declare function parseFlag(
	flag: string,
	type?: 'string' | 'boolean' | 'array' | 'number',
	argv?: string[]
): string | boolean | string[] | number | false;

export = parseFlag;
