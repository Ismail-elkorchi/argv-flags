/** Stable structural protocol implemented by value parsers. */
export interface ValueParser<out Output> {
	/** Identifies the interoperable value-parser protocol. */
	readonly protocol: 'argv-flags/value-parser/v1';
	/** Decodes one raw value synchronously. */
	readonly parse: (
		raw: string,
		context: ValueParseContext
	) => ValueParseResult<Output>;
	/** Checks decoded values, defaults, and implicit values. */
	readonly accepts: (value: unknown) => boolean;
	/** Copies a value when ownership passes through the parser. */
	readonly snapshot: (value: unknown) => Output;
	/** Finite raw values when the parser has a closed choice set. */
	readonly choices?: readonly string[];
}

/** Context supplied to a custom value parser. */
export interface ValueParseContext {
	/** Logical option selected by the recognized flag. */
	readonly option: string;
	/** Configured flag spelling that selected the option. */
	readonly flag: string;
	/** Complete argv element containing the flag. */
	readonly argvElement: string;
	/** Index of `argvElement` in the argv vector. */
	readonly argvIndex: number;
	/** Index of the argv element containing the raw value. */
	readonly valueArgvIndex: number;
	/** Whether the raw value was attached to its flag. */
	readonly inline: boolean;
}

/** Result returned by a custom value parser. */
export type ValueParseResult<Output> =
	| {
			/** Marks a successful custom parse. */
			readonly success: true;
			/** Decoded value. */
			readonly value: Output;
	  }
	| {
			/** Marks a rejected custom parse. */
			readonly success: false;
			/** Human-readable explanation. */
			readonly message: string;
			/** Optional machine-readable reason chosen by the custom parser. */
			readonly reason?: string;
			/** Optional structured context chosen by the custom parser. */
			readonly details?: Readonly<Record<string, unknown>>;
			/** Optional replacement candidates in preferred order. */
			readonly suggestions?: readonly string[];
	  };

/** Protocol used by {@link value.custom}. */
export interface CustomValueParserProtocol<Output> {
	/** Decodes one raw value synchronously. */
	readonly parse: (
		raw: string,
		context: ValueParseContext
	) => ValueParseResult<Output>;
	/** Checks values used as decoded output, defaults, or implicit values. */
	readonly accepts: (value: unknown) => value is Output;
	/** Copies a value when ownership must pass to the parser or a result. */
	readonly snapshot?: (value: Output) => Output;
}

/** Settings for one parse operation. */
export interface ParseSettings {
	/** Explicit argv vector; runtime argv is used when omitted. */
	readonly argv?: readonly string[];
	/** Whether unknown flags fail or are only collected. */
	readonly unknownFlagPolicy?: 'error' | 'collect';
	/** Whether flags remain active after a positional argument. */
	readonly flagPlacement?: 'interspersed' | 'before-positionals';
}

/** Settings for argv classification without decoding option values. */
export interface ScanSettings {
	/** Explicit argv vector; runtime argv is used when omitted. */
	readonly argv?: readonly string[];
	/** Whether flags remain active after a positional argument. */
	readonly flagPlacement?: 'interspersed' | 'before-positionals';
}

/** @internal Rejects parse-setting properties outside the public contract. */
export type ExactParseSettings<Settings extends ParseSettings> = Settings &
	Record<Exclude<keyof Settings, keyof ParseSettings>, never>;

/** @internal Rejects scan-setting properties outside the public contract. */
export type ExactScanSettings<Settings extends ScanSettings> = Settings &
	Record<Exclude<keyof Settings, keyof ScanSettings>, never>;

/** One non-option argv element with its original index. */
export interface ScannedArgument {
	/** Argument text. */
	readonly value: string;
	/** Original argv index. */
	readonly argvIndex: number;
}

/** One recognized option occurrence without decoded value state. */
export interface ScannedOption {
	/** Logical option name. */
	readonly option: string;
	/** Configured flag spelling selected by this occurrence. */
	readonly flag: string;
	/** Complete argv element containing the flag. */
	readonly argvElement: string;
	/** Original index of the flag element. */
	readonly argvIndex: number;
	/** UTF-16 offset for a short-cluster member. */
	readonly offset?: number;
	/** Explicit raw value, when present. */
	readonly rawValue?: string;
	/** Original index of the explicit value. */
	readonly valueArgvIndex?: number;
	/** Whether the explicit value shares the flag's argv element. */
	readonly inline?: boolean;
}

/** Immutable classification produced by a compiled parser's grammar. */
export interface ArgvScan {
	/** Recognized option occurrences in scan order. */
	readonly options: readonly ScannedOption[];
	/** Ordinary arguments before `--`. */
	readonly arguments: readonly ScannedArgument[];
	/** Arguments after `--`. */
	readonly afterDoubleDash: readonly ScannedArgument[];
	/** Original index of the `--` terminator, when present. */
	readonly doubleDashIndex?: number;
	/** Unknown flags with original locations. */
	readonly unknownFlags: readonly UnknownFlag[];
	/** Syntax and value-span issues; decoding, defaults, and requiredness are not evaluated. */
	readonly issues: readonly ParseIssue[];
}

/** One unknown flag retained with its original argv location. */
export interface UnknownFlag {
	/** Complete argv element containing the unknown flag. */
	readonly argvElement: string;
	/** Parsed unknown flag spelling. */
	readonly flag: string;
	/** Index of `argvElement` in the argv vector. */
	readonly argvIndex: number;
	/** UTF-16 offset of an unknown short-cluster member. */
	readonly offset?: number;
	/** Text after the first `=` on an unknown long flag. */
	readonly inlineValue?: string;
	/** Nearby configured long flags, when available. */
	readonly suggestions?: readonly string[];
}

/** @internal Fields shared by issues associated with a configured flag. */
interface FlagLocation {
	readonly flag: string;
	readonly argvElement: string;
	readonly argvIndex: number;
	readonly offset?: number;
}

/** A structured parse issue with fields determined by its code. */
export type ParseIssue =
	| (FlagLocation & {
			readonly code: 'UNKNOWN_FLAG';
			readonly message: string;
			readonly suggestions?: readonly string[];
	  })
	| {
			readonly code: 'INVALID_FLAG_SYNTAX';
			readonly message: string;
			readonly argvElement: string;
			readonly argvIndex: number;
			readonly offset?: number;
	  }
	| (FlagLocation & {
			readonly code: 'MISSING_OPTION_VALUE';
			readonly message: string;
			readonly option: string;
	  })
	| (FlagLocation & {
			readonly code: 'INVALID_OPTION_VALUE';
			readonly message: string;
			readonly option: string;
			readonly rawValue: string;
			readonly valueArgvIndex: number;
			readonly inline: boolean;
			readonly reason?: string;
			readonly details?: Readonly<Record<string, unknown>>;
			readonly suggestions?: readonly string[];
	  })
	| (FlagLocation & {
			readonly code: 'UNEXPECTED_OPTION_VALUE';
			readonly message: string;
			readonly option: string;
			readonly rawValue: string;
	  })
	| (FlagLocation & {
			readonly code: 'REPEATED_OPTION';
			readonly message: string;
			readonly option: string;
	  })
	| {
			readonly code: 'MISSING_REQUIRED_OPTION';
			readonly message: string;
			readonly option: string;
	  };

/** A structured definition issue with fields determined by its code. */
export type DefinitionIssue =
	| {
			readonly code: 'INVALID_DEFINITIONS';
			readonly message: string;
	  }
	| {
			readonly code: 'INVALID_OPTION_NAME';
			readonly message: string;
			readonly option: string | symbol;
	  }
	| {
			readonly code: 'INVALID_OPTION_DEFINITION';
			readonly message: string;
			readonly option: string;
	  }
	| {
			readonly code: 'UNSUPPORTED_OPTION_PROPERTY';
			readonly message: string;
			readonly option: string;
			readonly property: string | symbol;
	  }
	| {
			readonly code: 'INVALID_OPTION_PROPERTY';
			readonly message: string;
			readonly option: string;
			readonly property: string;
	  }
	| {
			readonly code: 'CONFLICTING_OPTION_PROPERTIES';
			readonly message: string;
			readonly option: string;
			readonly properties: readonly [string, string, ...string[]];
	  }
	| {
			readonly code: 'INVALID_FLAG';
			readonly message: string;
			readonly option: string;
			readonly property: 'flags' | 'falseFlags';
			readonly flagIndex: number;
			readonly flag?: string;
	  }
	| {
			readonly code: 'DUPLICATE_FLAG';
			readonly message: string;
			readonly option: string;
			readonly property: 'flags' | 'falseFlags';
			readonly flag: string;
			readonly flagIndex: number;
			readonly conflictingOption: string;
			readonly conflictingProperty: 'flags' | 'falseFlags';
	  }
	| {
			readonly code: 'INVALID_VALUE_PARSER';
			readonly message: string;
			readonly option: string;
			readonly property: 'type';
	  }
	| {
			readonly code: 'INVALID_DEFAULT';
			readonly message: string;
			readonly option: string;
			readonly property: 'default';
	  };

/** @internal A CLI flag spelling accepted at the type boundary. */
export type FlagName = `-${string}`;

/** @internal A non-empty list of flag spellings. */
export type FlagList = readonly [FlagName, ...FlagName[]];

/** Repetition behavior for scalar and boolean options. */
export type RepeatPolicy = 'error' | 'first' | 'last';

/** @internal Whether a value is required or available only inline. */
export type ValueMode = 'required' | 'optional-inline';

/** Value parsers supported by value-taking option definitions. */
export type ValueType =
	| 'string'
	| 'number'
	| 'integer'
	| ValueParser<unknown>;

/** Decoded output selected by an option value parser. */
export type ValueOf<Type extends ValueType> = Type extends 'string'
	? string
	: Type extends 'number' | 'integer'
		? number
		: Type extends ValueParser<infer Output>
			? Output
			: never;

/** @internal Presence and default rules. */
type PresenceDefinition<DefaultValue> =
	| {
			readonly required?: boolean;
			readonly default?: never;
	  }
	| {
			readonly required?: false;
			readonly default: DefaultValue;
	  };

/** @internal Required or optional-inline value input. */
type ValueInputDefinition<Type extends ValueType> =
	| {
			readonly valueMode?: 'required';
			readonly implicitValue?: never;
	  }
	| {
			readonly valueMode: 'optional-inline';
			readonly implicitValue: ValueOf<Type>;
	  };

/** One scalar value-taking option definition. */
export type ScalarValueOptionDefinition<Type extends ValueType> = {
	readonly flags: FlagList;
	readonly type: Type;
	readonly multiple?: false;
	readonly repeat?: RepeatPolicy;
} & PresenceDefinition<ValueOf<Type>> &
	ValueInputDefinition<Type>;

/** One accumulating value-taking option definition. */
export type MultipleValueOptionDefinition<Type extends ValueType> = {
	readonly flags: FlagList;
	readonly type: Type;
	readonly multiple: true;
} & PresenceDefinition<readonly ValueOf<Type>[]> &
	ValueInputDefinition<Type>;

/** One boolean option definition. */
export type BooleanOptionDefinition = {
	readonly flags: FlagList;
	readonly type: 'boolean';
	readonly falseFlags?: FlagList;
	readonly repeat?: RepeatPolicy;
} & PresenceDefinition<boolean>;

/** One occurrence-counting option definition. */
export interface CountOptionDefinition {
	/** Concrete flag spellings that increment the count. */
	readonly flags: FlagList;
	/** Selects occurrence-counting behavior. */
	readonly type: 'count';
}

/** @internal Distributes value definitions so built-in defaults stay correlated. */
type ValueOptionDefinition<Type extends ValueType> = Type extends ValueType
	? ScalarValueOptionDefinition<Type> | MultipleValueOptionDefinition<Type>
	: never;

/** Definition for one logical option. */
export type OptionDefinition =
	| ValueOptionDefinition<ValueType>
	| BooleanOptionDefinition
	| CountOptionDefinition;

/** A runtime-composed map whose entries are already valid option definitions. */
export type OptionDefinitionMap = Readonly<Record<string, OptionDefinition>>;

/** @internal Definitions keyed by their logical option names. */
export type OptionDefinitions = Readonly<Record<string, unknown>>;

/** @internal Adds a closed property set to an inferred definition. */
type ExactDefinition<Definition> = Definition extends {
	readonly type: infer Type;
}
	? Type extends ValueType
		? Definition extends { readonly multiple: true }
			? MultipleValueOptionDefinition<Type> &
					Record<
						Exclude<
							keyof Definition,
							keyof MultipleValueOptionDefinition<Type>
						>,
						never
					>
			: ScalarValueOptionDefinition<Type> &
					Record<
						Exclude<
							keyof Definition,
							keyof ScalarValueOptionDefinition<Type>
						>,
						never
					>
		: Type extends 'boolean'
			? BooleanOptionDefinition &
					Record<
						Exclude<keyof Definition, keyof BooleanOptionDefinition>,
						never
					>
			: Type extends 'count'
				? CountOptionDefinition &
						Record<
							Exclude<keyof Definition, keyof CountOptionDefinition>,
							never
						>
				: never
	: never;

/** @internal Validates every inferred definition without widening it. */
export type ExactOptionDefinitions<Definitions extends OptionDefinitions> = {
	readonly [Name in keyof Definitions]: Name extends string
		? ExactDefinition<Definitions[Name]>
		: never;
};

/** @internal Runtime value inferred for one definition. */
type OptionValue<Definition> = Definition extends { readonly type: 'boolean' }
	? boolean
	: Definition extends { readonly type: 'count' }
		? number
		: Definition extends { readonly type: 'number' | 'integer' }
			? Definition extends { readonly multiple: true }
				? readonly number[]
				: number
			: Definition extends { readonly type: 'string' }
				? Definition extends { readonly multiple: true }
					? readonly string[]
					: string
				: Definition extends { readonly type: ValueParser<infer Output> }
					? Definition extends { readonly multiple: true }
						? readonly Output[]
						: Output
					: never;

/** @internal Whether a successful parse always contains an option value. */
type HasGuaranteedValue<Definition> = Definition extends {
	readonly type: 'count';
}
	? true
	: Definition extends { readonly multiple: true }
		? true
		: Definition extends { readonly required: true }
			? true
			: Definition extends { readonly default: unknown }
				? true
				: false;

/** @internal Names guaranteed on a successful result. */
type GuaranteedOptionNames<Definitions extends OptionDefinitions> = {
	[Name in keyof Definitions]-?: HasGuaranteedValue<
		Definitions[Name]
	> extends true
		? Name
		: never;
}[keyof Definitions];

/** Values exposed only after a successful parse. */
export type ParsedValues<Definitions extends OptionDefinitions> = {
	readonly [Name in GuaranteedOptionNames<Definitions>]-?: OptionValue<
		Definitions[Name]
	>;
} & {
	readonly [Name in Exclude<
		keyof Definitions,
		GuaranteedOptionNames<Definitions>
	>]?: OptionValue<Definitions[Name]>;
};

/** @internal Whether each option appeared through a recognized flag. */
type SpecifiedOptions<Definitions extends OptionDefinitions> = {
	readonly [Name in keyof Definitions]: boolean;
};

/** @internal Fields shared by successful and failed parse results. */
interface ParseResultBase<Definitions extends OptionDefinitions> {
	readonly specified: SpecifiedOptions<Definitions>;
	readonly positionals: readonly string[];
	readonly afterDoubleDash: readonly string[];
	readonly unknownFlags: readonly UnknownFlag[];
}

/** A successful parse result. */
export type ParseSuccess<Definitions extends OptionDefinitions> =
	ParseResultBase<Definitions> & {
		readonly success: true;
		readonly values: ParsedValues<Definitions>;
	};

/** A failed parse result. */
export type ParseFailure<Definitions extends OptionDefinitions> =
	ParseResultBase<Definitions> & {
		readonly success: false;
		readonly issues: readonly ParseIssue[];
	};

/** Parse result discriminated by `success`. */
export type ParseResult<Definitions extends OptionDefinitions> =
	| ParseSuccess<Definitions>
	| ParseFailure<Definitions>;

/** A reusable parser compiled from one definition snapshot. */
export interface Parser<Definitions extends OptionDefinitions> {
	/** Classifies the current runtime's argv without decoding values. */
	scan(): ArgvScan;
	/** Classifies explicit argv with closed settings. */
	scan<const Settings extends ScanSettings>(
		settings: ExactScanSettings<Settings>
	): ArgvScan;
	/** Parses the current runtime's argv. */
	parse(): ParseResult<Definitions>;
	/** Parses with explicit closed settings. */
	parse<const Settings extends ParseSettings>(
		settings: ExactParseSettings<Settings>
	): ParseResult<Definitions>;
}

/** Successful values inferred from a parser. */
export type InferValues<ParserType> =
	ParserType extends Parser<infer Definitions>
		? ParsedValues<Definitions>
		: never;

/** Complete result inferred from a parser. */
export type ParserResult<ParserType> =
	ParserType extends Parser<infer Definitions>
		? ParseResult<Definitions>
		: never;
