import {
	DefinitionError,
	createParser,
	type DefinitionIssue,
	type ParseIssue,
	type ParseResult,
	type UnknownArgument
} from 'argv-flags';

const parser = createParser({
	source: { type: 'string', flags: ['--source'], required: true },
	mode: { type: 'string', flags: ['--mode'], default: 'safe' },
	label: { type: 'string', flags: ['--label'] },
	verbose: {
		type: 'boolean',
		flags: ['--verbose'],
		negatedFlag: '--no-verbose'
	},
	include: {
		type: 'string',
		flags: ['--include'],
		multiple: true
	}
});

const result: ParseResult<{
	readonly source: {
		readonly type: 'string';
		readonly flags: readonly ['--source'];
		readonly required: true;
	};
	readonly mode: {
		readonly type: 'string';
		readonly flags: readonly ['--mode'];
		readonly default: 'safe';
	};
	readonly label: {
		readonly type: 'string';
		readonly flags: readonly ['--label'];
	};
	readonly verbose: {
		readonly type: 'boolean';
		readonly flags: readonly ['--verbose'];
		readonly negatedFlag: '--no-verbose';
	};
	readonly include: {
		readonly type: 'string';
		readonly flags: readonly ['--include'];
		readonly multiple: true;
	};
}> = parser.parse({ args: [] });

if (result.success) {
	const source: string = result.values.source;
	const mode: string = result.values.mode;
	const include: string[] = result.values.include;
	const label: string | undefined = result.values.label;
	const verbose: boolean | undefined = result.values.verbose;
	void source;
	void mode;
	void include;
	void label;
	void verbose;
} else {
	const issues: ParseIssue[] = result.issues;
	void issues;
}

type SuccessResult = Extract<typeof result, { success: true }>;
type FailureResult = Extract<typeof result, { success: false }>;
type AssertTrue<Value extends true> = Value;
type _SuccessHasNoIssues = AssertTrue<
	'issues' extends keyof SuccessResult ? false : true
>;
type _FailureHasNoValues = AssertTrue<
	'values' extends keyof FailureResult ? false : true
>;
const successHasNoIssues: _SuccessHasNoIssues = true;
const failureHasNoValues: _FailureHasNoValues = true;
void successHasNoIssues;
void failureHasNoValues;

const unknownArgument: UnknownArgument = {
	argument: '--other=1',
	flag: '--other',
	index: 0
};
void unknownArgument;

const parseIssue: ParseIssue = {
	code: 'UNKNOWN_FLAG',
	message: 'Unknown flag "--other".',
	flag: '--other',
	argument: '--other=1',
	index: 0
};
void parseIssue;

const definitionIssue: DefinitionIssue = {
	code: 'UNSUPPORTED_DEFINITION_PROPERTY',
	message: 'Unsupported.',
	option: 'source',
	property: 'require'
};
void definitionIssue;

const definitionError: DefinitionError = new DefinitionError([definitionIssue]);
void definitionError;

createParser({
	// @ts-expect-error string options require string defaults
	invalid: {
		type: 'string',
		flags: ['--invalid'],
		default: 1
	}
});

createParser({
	invalid: {
		type: 'boolean',
		flags: ['--invalid'],
		// @ts-expect-error allowEmpty belongs only to string options
		allowEmpty: true
	}
});

createParser({
	invalid: {
		type: 'string',
		flags: ['--invalid'],
		// @ts-expect-error unsupported properties are rejected
		require: true
	}
});

const definitionsWithAnUnknownField = {
	source: {
		type: 'string',
		flags: ['--source'],
		require: true
	}
} as const;
// @ts-expect-error closed definitions reject unknown fields through variables
createParser(definitionsWithAnUnknownField);

createParser({
	invalid: {
		type: 'string',
		// @ts-expect-error every option needs at least one flag
		flags: []
	}
});

createParser({
	// @ts-expect-error required options cannot define a default
	invalid: {
		type: 'string',
		flags: ['--invalid'],
		required: true,
		default: 'fallback'
	}
});

createParser({
	invalid: {
		// @ts-expect-error array is not an option type
		type: 'array',
		flags: ['--invalid']
	}
});

// @ts-expect-error parse settings use args, not argv
parser.parse({ argv: [] });

const settingsWithAnUnknownField = {
	args: [],
	unknown: true
} as const;
// @ts-expect-error parse settings are closed through variables
parser.parse(settingsWithAnUnknownField);
