/**
 * A literal CLI flag name, such as `-v` or `--verbose`.
 *
 * Runtime validation applies the complete short- and long-flag grammar.
 */
export type FlagName = `-${string}`;

/** @internal Presence and default rules shared by option definitions. */
export type PresenceDefinition<DefaultValue> =
	| {
			readonly required: true;
			readonly default?: never;
	  }
	| {
			readonly required?: false;
			readonly default?: DefaultValue;
	  };

/** @internal Definition for a scalar string option. */
export type StringOptionDefinition = {
	readonly flags: readonly [FlagName, ...FlagName[]];
	readonly type: 'string';
	readonly multiple?: false;
	readonly allowEmpty?: boolean;
} & PresenceDefinition<string>;

/** @internal Definition for a multiple string option. */
export type MultipleStringOptionDefinition = {
	readonly flags: readonly [FlagName, ...FlagName[]];
	readonly type: 'string';
	readonly multiple: true;
	readonly allowEmpty?: boolean;
} & PresenceDefinition<readonly string[]>;

/** @internal Definition for a boolean option. */
export type BooleanOptionDefinition = {
	readonly flags: readonly [FlagName, ...FlagName[]];
	readonly type: 'boolean';
	readonly negatedFlag?: FlagName;
} & PresenceDefinition<boolean>;

/** @internal Definition for a number option. */
export type NumberOptionDefinition = {
	readonly flags: readonly [FlagName, ...FlagName[]];
	readonly type: 'number';
} & PresenceDefinition<number>;

/**
 * Definition for one logical CLI option.
 *
 * An option is the configured value keyed in an option-definition object. A
 * flag is one literal CLI spelling that selects that option.
 */
export type OptionDefinition =
	| StringOptionDefinition
	| MultipleStringOptionDefinition
	| BooleanOptionDefinition
	| NumberOptionDefinition;

/** Option definitions keyed by the logical names used in parsed values. */
export type OptionDefinitions = Readonly<Record<string, OptionDefinition>>;

/** @internal Properties supported by the selected option variant. */
export type AllowedDefinitionKeys<Definition extends OptionDefinition> =
	Definition extends MultipleStringOptionDefinition
		? keyof MultipleStringOptionDefinition
		: Definition extends StringOptionDefinition
			? keyof StringOptionDefinition
			: Definition extends BooleanOptionDefinition
				? keyof BooleanOptionDefinition
				: keyof NumberOptionDefinition;

/**
 * Rejects properties that do not belong to the selected option variant.
 *
 * This type supports the public factory signature but is not re-exported by
 * the package facade.
 */
export type ExactOptionDefinitions<Definitions extends OptionDefinitions> = {
	readonly [Name in keyof Definitions]: Definitions[Name] &
		Record<
			Exclude<keyof Definitions[Name], AllowedDefinitionKeys<Definitions[Name]>>,
			never
		>;
};

/** @internal Parsed runtime value for an option definition. */
export type OptionValue<Definition extends OptionDefinition> =
	Definition extends MultipleStringOptionDefinition
		? string[]
		: Definition extends StringOptionDefinition
			? string
			: Definition extends BooleanOptionDefinition
				? boolean
				: number;

/** @internal Whether a successful parse guarantees an option value. */
export type HasGuaranteedValue<Definition extends OptionDefinition> =
	Definition extends MultipleStringOptionDefinition
		? true
		: Definition extends { required: true }
			? true
			: Definition extends { default: unknown }
				? true
				: false;

/** @internal Option names guaranteed to have successful values. */
export type GuaranteedOptionNames<Definitions extends OptionDefinitions> = {
	[Name in keyof Definitions]-?: HasGuaranteedValue<Definitions[Name]> extends true
		? Name
		: never;
}[keyof Definitions];

/** @internal Option names whose successful values remain optional. */
export type OptionalOptionNames<Definitions extends OptionDefinitions> = Exclude<
	keyof Definitions,
	GuaranteedOptionNames<Definitions>
>;

/**
 * @internal
 *
 * Values from a successful parse.
 *
 * Required options, defaulted options, and multiple string options are
 * guaranteed. Other option properties are absent when no value was parsed.
 */
export type ParsedValues<Definitions extends OptionDefinitions> = {
	[Name in GuaranteedOptionNames<Definitions>]-?: OptionValue<Definitions[Name]>;
} & {
	[Name in OptionalOptionNames<Definitions>]?: OptionValue<Definitions[Name]>;
};

/** @internal Whether each logical option appeared through a recognized flag. */
export type SpecifiedOptions<Definitions extends OptionDefinitions> = {
	[Name in keyof Definitions]: boolean;
};

/** An unrecognized flag retained from its original argument. */
export interface UnknownArgument {
	/** Complete raw argument. */
	argument: string;
	/** Unrecognized literal flag parsed from the argument. */
	flag: string;
	/** Zero-based index of the argument in `args`. */
	index: number;
}

/** A structured definition issue reported by {@link DefinitionError}. */
export type DefinitionIssue =
	| {
			code: 'INVALID_DEFINITIONS';
			message: string;
	  }
	| {
			code: 'INVALID_OPTION_NAME';
			message: string;
			option: string;
	  }
	| {
			code: 'INVALID_OPTION_DEFINITION';
			message: string;
			option: string;
	  }
	| {
			code: 'INVALID_OPTION_TYPE';
			message: string;
			option: string;
	  }
	| {
			code: 'UNSUPPORTED_DEFINITION_PROPERTY';
			message: string;
			option: string;
			property: string;
	  }
	| {
			code: 'INVALID_DEFINITION_PROPERTY';
			message: string;
			option: string;
			property: string;
	  }
	| {
			code: 'CONFLICTING_DEFINITION_PROPERTIES';
			message: string;
			option: string;
			properties: readonly string[];
	  }
	| {
			code: 'INVALID_FLAG';
			message: string;
			option: string;
			property: 'flags' | 'negatedFlag';
			flag?: string;
			flagIndex?: number;
	  }
	| {
			code: 'DUPLICATE_FLAG';
			message: string;
			option: string;
			flag: string;
			conflictingOption: string;
	  };

/** Stable machine-readable definition issue codes. */
export type DefinitionIssueCode = DefinitionIssue['code'];

/** @internal Fields shared by issues associated with one argument. */
export interface ArgumentIssueBase {
	/** Human-readable explanation intended for people. */
	message: string;
	/** Literal flag name parsed from the argument. */
	flag: string;
	/** Complete raw argument that contained the flag. */
	argument: string;
	/** Zero-based index of the flag argument. */
	index: number;
}

/** A structured parse issue with fields determined by its code. */
export type ParseIssue =
	| (ArgumentIssueBase & {
			code: 'UNKNOWN_FLAG';
	  })
	| (ArgumentIssueBase & {
			code: 'MISSING_FLAG_VALUE';
			option: string;
	  })
	| (ArgumentIssueBase & {
			code: 'INVALID_FLAG_VALUE';
			option: string;
			value: string;
	  })
	| (ArgumentIssueBase & {
			code: 'UNEXPECTED_FLAG_VALUE';
			option: string;
			value: string;
	  })
	| (ArgumentIssueBase & {
			code: 'EMPTY_FLAG_VALUE';
			option: string;
			value: '';
	  })
	| (ArgumentIssueBase & {
			code: 'INVALID_FLAG_SYNTAX';
			option: string;
			syntax: 'SHORT_ATTACHED_VALUE' | 'NON_BOOLEAN_SHORT_CLUSTER';
	  })
	| (ArgumentIssueBase & {
			code: 'DUPLICATE_OPTION';
			option: string;
	  })
	| {
			code: 'MISSING_REQUIRED_OPTION';
			message: string;
			option: string;
			flag: string;
	  };

/** Stable machine-readable parse issue codes. */
export type ParseIssueCode = ParseIssue['code'];

/**
 * Settings for one parse operation.
 *
 * When `args` is omitted, the parser reads `process.argv.slice(2)` on Node and
 * Bun, then falls back to `Deno.args`, then to an empty array.
 */
export interface ParseSettings {
	/** Raw arguments to parse. */
	args?: readonly string[];
	/** Collects unrecognized flags instead of reporting issues. */
	allowUnknownFlags?: boolean;
}

/** @internal Rejects parse-setting properties outside the public contract. */
export type ExactParseSettings<Settings extends ParseSettings> = Settings &
	Record<Exclude<keyof Settings, keyof ParseSettings>, never>;

/** @internal Fields shared by successful and failed parse results. */
export interface ParseResultBase<Definitions extends OptionDefinitions> {
	/** Whether each option appeared through a recognized flag. */
	specified: SpecifiedOptions<Definitions>;
	/** Arguments encountered before `--` that were not consumed. */
	positionals: string[];
	/** Arguments after `--`, without the boundary itself. */
	argumentsAfterDoubleDash: string[];
	/** Unrecognized flags collected when `allowUnknownFlags` is enabled. */
	unknownArguments: UnknownArgument[];
}

/** @internal Result returned after an error-free parse. */
export type ParseSuccess<Definitions extends OptionDefinitions> =
	ParseResultBase<Definitions> & {
		success: true;
		values: ParsedValues<Definitions>;
	};

/** @internal Result returned when parsing produced one or more issues. */
export type ParseFailure<Definitions extends OptionDefinitions> =
	ParseResultBase<Definitions> & {
		success: false;
		issues: ParseIssue[];
	};

/** Parse result discriminated by `success`. Values exist only on success. */
export type ParseResult<Definitions extends OptionDefinitions> =
	| ParseSuccess<Definitions>
	| ParseFailure<Definitions>;

/** Parser compiled from one immutable snapshot of option definitions. */
export interface Parser<Definitions extends OptionDefinitions> {
	/** Parses explicit or runtime arguments without mutating the input. */
	parse<const Settings extends ParseSettings = ParseSettings>(
		settings?: ExactParseSettings<Settings>
	): ParseResult<Definitions>;
}
