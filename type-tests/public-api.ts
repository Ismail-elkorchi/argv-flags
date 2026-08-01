import {
	DefinitionError,
	createParser,
	createParserFromMap,
	value,
	type CustomValueParserCallbacks,
	type DefinitionIssue,
	type InferValues,
	type MultipleValueOptionDefinition,
	type OptionDefinitionMap,
	type ParseIssue,
	type ParserResult,
	type ScalarValueOptionDefinition,
	type UnknownFlag,
	type ValueParseContext,
	type ValueParser
} from 'argv-flags';

interface Identifier {
	readonly text: string;
}

const identifierCallbacks: CustomValueParserCallbacks<Identifier> = {
	parse(raw) {
		return raw.startsWith('id:')
			? { success: true, value: { text: raw.slice(3) } }
			: { success: false, message: 'Expected an id: prefix.' };
	},
	accepts(candidate): candidate is Identifier {
		return (
			typeof candidate === 'object' &&
			candidate !== null &&
			'text' in candidate &&
			typeof candidate.text === 'string'
		);
	},
	snapshot(candidate) {
		return { text: candidate.text };
	}
};
const identifier = value.custom(identifierCallbacks);

const parser = createParser({
	source: { type: 'string', flags: ['-s', '--source'], required: true },
	mode: {
		type: value.choice(['auto', 'always', 'off']),
		flags: ['--mode'],
		default: 'auto'
	},
	label: { type: value.string({ empty: 'allow' }), flags: ['--label'] },
	retries: {
		type: value.integer({ minimum: 0 }),
		flags: ['--retries'],
		default: 2
	},
	ratio: { type: value.number(), flags: ['--ratio'] },
	verbose: {
		type: 'boolean',
		flags: ['-v', '--verbose'],
		falseFlags: ['--no-verbose']
	},
	include: {
		type: identifier,
		flags: ['--include'],
		multiple: true
	},
	color: {
		type: value.choice(['auto', 'always', 'never']),
		flags: ['--color'],
		valueMode: 'optional-inline',
		implicitValue: 'auto'
	},
	verbosity: { type: 'count', flags: ['-q'] }
});

const result = parser.parse({ argv: [] });
if (result.success) {
	const source: string = result.values.source;
	const mode: 'auto' | 'always' | 'off' = result.values.mode;
	const label: string | undefined = result.values.label;
	const retries: number = result.values.retries;
	const ratio: number | undefined = result.values.ratio;
	const verbose: boolean | undefined = result.values.verbose;
	const include: readonly Identifier[] = result.values.include;
	const color: 'auto' | 'always' | 'never' | undefined = result.values.color;
	const verbosity: number = result.values.verbosity;
	void source;
	void mode;
	void label;
	void retries;
	void ratio;
	void verbose;
	void include;
	void color;
	void verbosity;
	// @ts-expect-error issues exist only on failure
	void result.issues;
} else {
	const issues: readonly ParseIssue[] = result.issues;
	void issues;
	// @ts-expect-error values exist only on success
	void result.values;
}

type Values = InferValues<typeof parser>;
type Result = ParserResult<typeof parser>;
const values: Values | undefined = result.success ? result.values : undefined;
const completeResult: Result = result;
void values;
void completeResult;

const unknownFlag: UnknownFlag = {
	argvElement: '--other=value',
	flag: '--other',
	argvIndex: 3,
	inlineValue: 'value'
};
void unknownFlag;

const unknownIssue: ParseIssue = {
	code: 'UNKNOWN_FLAG',
	message: 'Unknown flag.',
	flag: '--other',
	argvElement: '--other',
	argvIndex: 0,
	suggestions: ['--other-name']
};
void unknownIssue;

const invalidValueIssue: ParseIssue = {
	code: 'INVALID_OPTION_VALUE',
	message: 'Invalid value.',
	option: 'mode',
	flag: '--mode',
	argvElement: '--mode=bad',
	argvIndex: 0,
	rawValue: 'bad',
	valueArgvIndex: 0,
	inline: true
};
void invalidValueIssue;

const definitionIssue: DefinitionIssue = {
	code: 'UNSUPPORTED_OPTION_PROPERTY',
	message: 'Unsupported property.',
	option: 'source',
	property: 'typo'
};
const definitionError: DefinitionError = new DefinitionError([definitionIssue]);
void definitionError;

const callbacks: CustomValueParserCallbacks<Identifier> = {
	parse(raw, context: ValueParseContext) {
		void context;
		return { success: true, value: { text: raw } };
	},
	accepts(candidate): candidate is Identifier {
		return typeof candidate === 'object' && candidate !== null && 'text' in candidate;
	}
};
value.custom(callbacks);

const structuralParser: ValueParser<Identifier> = {
	parse(raw) {
		return { success: true, value: { text: raw } };
	},
	accepts(candidate) {
		return typeof candidate === 'object' && candidate !== null && 'text' in candidate;
	},
	snapshot(candidate) {
		if (typeof candidate !== 'object' || candidate === null || !('text' in candidate)) {
			throw new TypeError('Expected an identifier.');
		}
		return { text: String(candidate.text) };
	}
};
createParser({ identifier: { type: structuralParser, flags: ['--identifier'] } });

const composedDefinitions: OptionDefinitionMap = {
	input: { type: 'string', flags: ['--input'] },
	verbose: { type: 'boolean', flags: ['--verbose'] }
};
const composedParser = createParserFromMap(composedDefinitions);
const composedScan = composedParser.scan({ argv: ['--input', 'file', 'tail'] });
const scannedOption: string | undefined = composedScan.options[0]?.option;
const scannedArgument: string | undefined = composedScan.arguments[0]?.value;
void scannedOption;
void scannedArgument;
void composedParser;

const scalarDefinition: ScalarValueOptionDefinition<'integer'> = {
	type: 'integer',
	flags: ['--retries'],
	default: 2
};
const multipleDefinition: MultipleValueOptionDefinition<typeof identifier> = {
	type: identifier,
	flags: ['--include'],
	multiple: true
};
void scalarDefinition;
void multipleDefinition;

const inlineCustom = value.custom({
	parse(raw) {
		return { success: true, value: { length: raw.length } };
	},
	accepts(candidate): candidate is { readonly length: number } {
		return (
			typeof candidate === 'object' &&
			candidate !== null &&
			'length' in candidate &&
			typeof candidate.length === 'number'
		);
	}
});
const inlineCustomParser = createParser({
	item: { type: inlineCustom, flags: ['--item'], required: true }
});
const inlineCustomResult = inlineCustomParser.parse({ argv: ['--item=value'] });
if (inlineCustomResult.success) {
	const length: number = inlineCustomResult.values.item.length;
	void length;
}

const invalidStringDefault = {
	invalid: { type: 'string', flags: ['--invalid'], default: 1 }
} as const;
// @ts-expect-error string defaults must be strings
createParser(invalidStringDefault);

createParser({
	invalid: {
		type: 'boolean',
		flags: ['--invalid'],
		// @ts-expect-error falseFlags belong to booleans but valueMode does not
		valueMode: 'required'
	}
});

const invalidRequiredDefault = {
	invalid: {
		type: 'integer',
		flags: ['--invalid'],
		required: true,
		default: 1
	}
} as const;
// @ts-expect-error required options cannot define defaults
createParser(invalidRequiredDefault);

const invalidRequiredMultipleDefault = {
	invalid: {
		type: 'string',
		flags: ['--invalid'],
		multiple: true,
		required: true,
		default: ['fallback']
	}
} as const;
// @ts-expect-error required multiple options cannot define defaults
createParser(invalidRequiredMultipleDefault);

createParser({
	invalid: {
		type: 'number',
		flags: ['--invalid'],
		multiple: true,
		// @ts-expect-error multiple options do not support repeat policies
		repeat: 'last'
	}
});

const missingImplicitValue = {
	invalid: {
		type: 'string',
		flags: ['--invalid'],
		valueMode: 'optional-inline'
	}
} as const;
// @ts-expect-error optional-inline mode requires an implicit value
createParser(missingImplicitValue);

const invalidImplicitValue = {
	invalid: {
		type: 'integer',
		flags: ['--invalid'],
		valueMode: 'optional-inline',
		implicitValue: 'one'
	}
} as const;
// @ts-expect-error implicit value must match the parser output
createParser(invalidImplicitValue);

const implicitValueInRequiredMode = {
	invalid: {
		type: 'string',
		flags: ['--invalid'],
		implicitValue: 'value'
	}
} as const;
// @ts-expect-error required mode cannot define an implicit value
createParser(implicitValueInRequiredMode);

createParser({
	invalid: {
		type: 'count',
		// @ts-expect-error flags require a dash-prefixed spelling
		flags: ['invalid']
	}
});

const definitionsWithUnknownProperty = {
	source: { type: 'string', flags: ['--source'], typo: true }
} as const;
// @ts-expect-error closed definitions reject extras through variables
createParser(definitionsWithUnknownProperty);

// @ts-expect-error parse settings are closed inline
parser.parse({ argv: [], typo: true });

const settingsWithUnknownProperty = { argv: [], typo: true } as const;
// @ts-expect-error parse settings are closed through variables
parser.parse(settingsWithUnknownProperty);

// @ts-expect-error the unknown-flag policy has an explicit policy name
parser.parse({ unknownFlags: 'collect' });

// @ts-expect-error flag placement does not use option terminology
parser.parse({ optionPlacement: 'before-positionals' });

// @ts-expect-error exact optional properties reject explicit undefined
parser.parse({ argv: undefined });

// @ts-expect-error value settings are closed inline
value.string({ empty: 'allow', typo: true });

const valueSettingsWithUnknownProperty = { minimum: 0, typo: true } as const;
// @ts-expect-error value settings are closed through variables
value.integer(valueSettingsWithUnknownProperty);

const callbacksWithUnknownProperty = {
	parse(raw: string) {
		return { success: true, value: raw } as const;
	},
	accepts(candidate: unknown): candidate is string {
		return typeof candidate === 'string';
	},
	typo: true
};
// @ts-expect-error custom callback objects are closed through variables
value.custom(callbacksWithUnknownProperty);

value.custom({
	parse(raw) {
		return { success: true, value: raw };
	},
	accepts(candidate): candidate is string {
		return typeof candidate === 'string';
	},
	// @ts-expect-error custom callback objects are closed inline
	typo: true
});

// @ts-expect-error diagnostic codes are closed
const openIssueCode: ParseIssue = { code: 'OTHER', message: 'Other.' };
void openIssueCode;
