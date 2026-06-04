/**
 * Schema-driven CLI flag parser with stable issue codes and machine-readable results.
 *
 * Supports Node.js, Deno, and Bun environments with deterministic parsing behavior.
 */
const BOOLEAN_TRUE = new Set<string>(['true', '1', 'yes', 'y', 'on']);
const BOOLEAN_FALSE = new Set<string>(['false', '0', 'no', 'n', 'off']);

/**
 * Supported schema value kinds for a flag.
 *
 * Use these literals in `FlagSpec.type` to declare how a logical option
 * should be parsed from argv tokens.
 */
export type FlagType = 'string' | 'boolean' | 'number' | 'array';

/**
 * Runtime value type mapped from a flag category.
 *
 * This conditional type drives the inferred `values` shape returned by
 * parseArgs.
 */
export type FlagValue<T extends FlagType> = T extends 'string'
	? string
	: T extends 'boolean'
		? boolean
		: T extends 'number'
			? number
			: T extends 'array'
				? string[]
				: never;

/**
 * Single schema specification for one logical flag key.
 *
 * Constraints:
 * - `flags` must contain at least one token.
 * - Every token must start with `-`.
 * - `allowNo` is only valid for boolean flags.
 * - `allowEmpty` is only valid for string and array flags.
 * - Array defaults are cloned on each parse call.
 *
 * Defaults:
 * - `required`: `false`
 * - `allowEmpty`: `false`
 * - `allowNo`: `true` for boolean flags
 */
export interface FlagSpec<T extends FlagType = FlagType> {
	/** Controls argv coercion and default validation for this option. */
	type: T;
	/** Accepted CLI spellings (for example `-m`, `--mode`). */
	flags: readonly string[];
	/** Emits a `REQUIRED` issue when argv does not supply this flag. */
	required?: boolean;
	/** Value copied into `values` when argv does not supply this flag. */
	default?: FlagValue<T>;
	/** Allows empty values for string and array specs. */
	allowEmpty?: boolean;
	/** Enables `--no-<flag>` negation for boolean specs. */
	allowNo?: boolean;
}

/** Structured metadata for boolean negation aliases discovered during schema normalization. */
export interface BooleanNegationMetadata {
	/** Logical schema key associated with the negation alias. */
	key: string;
	/** Positive flag name used in schema. */
	positiveFlag: string;
	/** Derived negation flag that the parser accepts. */
	negativeFlag: string;
}

/**
 * Parser schema keyed by logical option names.
 *
 * Schema keys become the stable property names in parse results and issue
 * payloads.
 */
export type Schema = Record<string, FlagSpec>;

/**
 * Parser issue severity.
 */
export type IssueSeverity = 'error' | 'warning';

/**
 * Stable parser issue codes.
 *
 * Treat these codes as the machine contract. Human-readable `message` strings
 * are for logs and operator output, not programmatic branching.
 */
export type IssueCode =
	| 'UNKNOWN_FLAG'
	| 'MISSING_VALUE'
	| 'INVALID_VALUE'
	| 'REQUIRED'
	| 'DUPLICATE'
	| 'EMPTY_VALUE';

/**
 * Structured parser issue payload.
 *
 * Returned for unknown flags, missing values, invalid coercions,
 * required-field failures, and duplicate-flag warnings.
 */
export interface ParseIssue {
	/** Stable machine-readable issue code. */
	code: IssueCode;
	/** Issue severity used by `ok` computation. */
	severity: IssueSeverity;
	/** Human-readable diagnostic message. */
	message: string;
	/** Flag token associated with this issue, when available. */
	flag?: string;
	/** Schema key associated with this issue, when available. */
	key?: string;
	/** Raw value that triggered the issue, when available. */
	value?: string;
	/** Zero-based argv index for the related token, when available. */
	index?: number;
}

/** Non-throwing schema normalization result. */
export interface SchemaNormalizationResult {
	/** Parsed flag map keyed by token (`--flag`, `-f`) to schema key. */
	flagToKey: Record<string, string>;
	/** Normalized schema specs keyed by schema key. */
	normalized: Record<string, NormalizedSpec>;
	/** Effective negation aliases for boolean long flags. */
	booleanNegations: readonly BooleanNegationMetadata[];
	/** Schema validation issues that would make parseArgs throw. */
	issues: readonly string[];
	/** `true` when the normalized schema can be used for parsing. */
	ok: boolean;
}

/**
 * Parse behavior toggles.
 *
 * Defaults:
 * - `argv`: runtime argv when available, otherwise `[]`
 * - `allowUnknown`: `false`
 * - `stopAtDoubleDash`: `true`
 */
export interface ParseOptions {
	/** Explicit argv input; defaults to runtime arguments when omitted. */
	argv?: readonly string[];
	/** Keeps unknown flags in `unknown` instead of emitting errors. */
	allowUnknown?: boolean;
	/** Treats `--` as a stop token for flag parsing (default: `true`). */
	stopAtDoubleDash?: boolean;
}

/**
 * Typed parsed values for a schema.
 *
 * Values stay `undefined` until a schema default or argv token supplies them.
 */
export type ParsedValues<S extends Schema> = {
	[K in keyof S]: FlagValue<S[K]['type']> | undefined;
};

/**
 * Presence map for explicitly supplied flags.
 *
 * A key is `true` only when argv explicitly contained the flag. Defaults do not
 * flip presence on.
 */
export type ParsedPresent<S extends Schema> = {
	[K in keyof S]: boolean;
};

/**
 * Full parse result payload.
 *
 * Semantics:
 * - `values` contains typed parsed output plus any schema defaults.
 * - `present` tracks whether a caller explicitly supplied a flag.
 * - `rest` preserves free positional tokens and tokens after `--`.
 * - `unknown` captures unknown flag tokens only when `allowUnknown` is enabled.
 * - `ok` is `false` only when at least one issue has severity `"error"`.
 */
export interface ParseResult<S extends Schema> {
	/** Parsed values keyed by schema key. */
	values: ParsedValues<S>;
	/** Presence map indicating which schema keys were explicitly provided. */
	present: ParsedPresent<S>;
	/** Non-flag argv tokens preserved in encounter order. */
	rest: string[];
	/** Unknown flag tokens collected when `allowUnknown` is enabled. */
	unknown: string[];
	/** Structured parse diagnostics. */
	issues: ParseIssue[];
	/** `true` when no issue with severity `error` exists. */
	ok: boolean;
}

/**
 * JSON-serializable value variant for parse results.
 *
 * This is the value domain produced by toJsonResult.
 */
export type JsonFlagValue = string | number | boolean | string[] | null;

/**
 * JSON-safe parse result payload.
 *
 * This shape is designed for validation against
 * `schema/parse-result.schema.json`, where missing typed values are encoded as
 * `null` instead of `undefined`.
 */
export interface ParseResultJson {
	/** JSON-safe parsed values keyed by schema key (`undefined` becomes `null`). */
	values: Record<string, JsonFlagValue>;
	/** JSON-safe presence map keyed by schema key. */
	present: Record<string, boolean>;
	/** JSON-safe copy of free argv values. */
	rest: string[];
	/** JSON-safe copy of unknown flag tokens. */
	unknown: string[];
	/** JSON-safe copy of parse diagnostics. */
	issues: ParseIssue[];
	/** `true` when no issue with severity `error` exists. */
	ok: boolean;
}

/**
 * Internalized flag specification used only by parser internals and schema normalization output.
 */
export interface NormalizedSpec extends FlagSpec {
	/** Normalized flag tokens with validated flag syntax. */
	flags: string[];
	/** Primary long flag token, if one was declared. */
	longFlag?: string;
	/** Effective negation alias derived from `--<flag>` for boolean options. */
	effectiveNegation?: string;
}

interface RuntimeProcessLike {
	argv?: unknown;
}

interface RuntimeDenoLike {
	args?: unknown;
}

const isFlagToken = (value: unknown): value is string =>
	typeof value === 'string' && value.startsWith('-') && value.length > 1;

const normalizeBoolean = (value: unknown): boolean | undefined => {
	if (typeof value !== 'string') return undefined;
	const normalized = value.toLowerCase();
	if (BOOLEAN_TRUE.has(normalized)) return true;
	if (BOOLEAN_FALSE.has(normalized)) return false;
	return undefined;
};

const isNumericValue = (value: unknown): boolean => {
	if (typeof value !== 'string' || value.length === 0 || value.trim().length === 0) return false;
	const parsed = Number(value);
	return Number.isFinite(parsed);
};

const cloneDefault = (
	value: FlagValue<FlagType> | undefined,
	type: FlagType
): FlagValue<FlagType> | undefined => {
	if (type === 'array' && Array.isArray(value)) {
		return value.slice();
	}
	return value;
};

const splitInlineValue = (token: string): { flag: string; value?: string } => {
	const eqIndex = token.indexOf('=');
	if (eqIndex <= 0) return { flag: token };
	return { flag: token.slice(0, eqIndex), value: token.slice(eqIndex + 1) };
};

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const addIssue = (issues: string[], message: string) => {
	issues.push(message);
};

const isValidFlagToken = (key: string, flag: string): string | undefined => {
	if (flag.length < 2 || !flag.startsWith('-')) {
		return `Schema entry "${key}" has invalid flag "${flag}".`;
	}
	if (flag === '--') {
		return `Schema entry "${key}" flag "${flag}" is reserved for argument boundary.`;
	}
	if (flag.includes('=')) {
		return `Schema entry "${key}" flag "${flag}" must not contain "=".`;
	}
	if (flag.includes(' ')) {
		return `Schema entry "${key}" flag "${flag}" must not contain whitespace.`;
	}
	if (flag.startsWith('--no-')) {
		return `Schema entry "${key}" flag "${flag}" cannot start with "--no-". Use allowNo metadata instead.`;
	}
	if (flag.startsWith('--')) {
		if (!/^--[a-zA-Z][A-Za-z0-9-]*$/.test(flag)) {
			return `Schema entry "${key}" has invalid flag "${flag}".`;
		}
	} else if (flag.startsWith('-')) {
		if (!/^-[a-zA-Z0-9]$/.test(flag) && !/^-{1}[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(flag)) {
			return `Schema entry "${key}" has invalid flag "${flag}".`;
		}
	}
	return undefined;
};


/** Validates and normalizes schema without throwing. */
export const normalizeSchema = (schema: unknown): SchemaNormalizationResult => {
	const issues: string[] = [];
	if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
		return {
			ok: false,
			flagToKey: {},
			normalized: {},
			booleanNegations: [],
			issues: ['Schema must be an object.']
		};
	}

	const flagToKey = new Map<string, string>();
	const negationToKey = new Map<string, string>();
	const normalized = new Map<string, NormalizedSpec>();
	const typedSchema = schema as Record<string, unknown>;
	const booleanNegations: BooleanNegationMetadata[] = [];

	for (const key of Object.keys(typedSchema)) {
		const rawSpec = typedSchema[key];
		if (rawSpec === null || typeof rawSpec !== 'object' || Array.isArray(rawSpec)) {
			addIssue(issues, `Schema entry for "${key}" must be an object.`);
			continue;
		}
		const specRecord = rawSpec as Record<string, unknown>;
		const type = specRecord['type'];
		if (type !== 'string' && type !== 'boolean' && type !== 'number' && type !== 'array') {
			addIssue(issues, `Schema entry "${key}" has invalid type.`);
			continue;
		}
		const flagsInput = specRecord['flags'];
		if (!Array.isArray(flagsInput) || flagsInput.length === 0) {
			addIssue(issues, `Schema entry "${key}" must define at least one flag.`);
			continue;
		}
			const flags: string[] = [];
		for (const flag of flagsInput) {
			if (typeof flag !== 'string') {
				addIssue(issues, `Schema entry "${key}" has invalid flag "${typeof flag === 'string' ? flag : JSON.stringify(flag)}".`);
				continue;
			}
			const flagIssue = isValidFlagToken(key, flag);
			if (flagIssue !== undefined) {
				addIssue(issues, flagIssue);
				continue;
			}
			if (flagToKey.has(flag)) {
				const existing = flagToKey.get(flag) ?? '(existing flag)';
				addIssue(issues, `Flag "${flag}" is already assigned to "${existing}".`);
				continue;
			}
			flagToKey.set(flag, key);
			flags.push(flag);
		}
		if (flags.length === 0) {
			continue;
		}
		const requiredValue = specRecord['required'];
		if (requiredValue !== undefined && typeof requiredValue !== 'boolean') {
			addIssue(issues, `Schema entry "${key}" required must be a boolean.`);
			continue;
		}
		const allowNoValue = specRecord['allowNo'];
		if (allowNoValue !== undefined && typeof allowNoValue !== 'boolean') {
			addIssue(issues, `Schema entry "${key}" allowNo must be a boolean.`);
			continue;
		}
		if (allowNoValue !== undefined && type !== 'boolean') {
			addIssue(issues, `Schema entry "${key}" allowNo is only valid for boolean types.`);
			continue;
		}
		const allowEmptyValue = specRecord['allowEmpty'];
		if (allowEmptyValue !== undefined && typeof allowEmptyValue !== 'boolean') {
			addIssue(issues, `Schema entry "${key}" allowEmpty must be a boolean.`);
			continue;
		}
		if (allowEmptyValue !== undefined && type !== 'string' && type !== 'array') {
			addIssue(issues, `Schema entry "${key}" allowEmpty is only valid for string or array types.`);
			continue;
		}
		const defaultValue = normalizeDefaultValue(key, specRecord['default'], type);
		if (defaultValue instanceof Error) {
			addIssue(issues, defaultValue.message);
			continue;
		}
		const spec: FlagSpec = {
			type,
			flags,
			...(requiredValue === true ? { required: true } : {}),
			...(allowEmptyValue === true ? { allowEmpty: true } : {}),
			...(allowNoValue === false ? { allowNo: false } : {}),
			...(defaultValue !== undefined ? { default: defaultValue } : {})
		};
		const longFlag = flags.find((flag) => flag.startsWith('--'));
		const normalizedSpec: NormalizedSpec = {
			...spec,
			type,
			flags,
			...(typeof longFlag === 'string' ? { longFlag } : {})
		};
		if (type === 'boolean' && spec.allowNo !== false && typeof longFlag === 'string') {
			const noFlag = `--no-${longFlag.slice(2)}`;
			if (negationToKey.has(noFlag) || flagToKey.has(noFlag)) {
				addIssue(issues, `Negation alias "${noFlag}" for "${key}" conflicts with existing flag.`);
			} else {
				normalizedSpec.effectiveNegation = noFlag;
				negationToKey.set(noFlag, key);
				booleanNegations.push({
					key,
					positiveFlag: longFlag,
					negativeFlag: noFlag
				});
			}
		}
		normalized.set(key, normalizedSpec);
	}

	return {
		ok: issues.length === 0,
		flagToKey: Object.fromEntries(flagToKey),
		normalized: Object.fromEntries(normalized),
		booleanNegations,
		issues
	};
};

const normalizeDefaultValue = (
	key: string,
	value: unknown,
	type: FlagType
): FlagValue<FlagType> | Error | undefined => {
	if (value === undefined) {
		return undefined;
	}
	switch (type) {
		case 'string':
			if (typeof value !== 'string') {
				return new TypeError(`Schema entry "${key}" default must be a string.`);
			}
			return value;
		case 'boolean':
			if (typeof value !== 'boolean') {
				return new TypeError(`Schema entry "${key}" default must be a boolean.`);
			}
			return value;
		case 'number':
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				return new TypeError(`Schema entry "${key}" default must be a finite number.`);
			}
			return value;
		case 'array':
			if (!isStringArray(value)) {
				return new TypeError(`Schema entry "${key}" default must be a string array.`);
			}
			return value;
		default: {
			const exhaustive: never = type;
			return new TypeError(`Schema entry "${key}" has invalid type "${String(exhaustive)}".`);
		}
	}
};

const coerceStringArgs = (value: unknown): string[] | undefined => {
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
		return undefined;
	}
	return value;
};

const resolveRuntimeArgv = (): string[] => {
	const processArgv = coerceStringArgs(( globalThis as { process?: RuntimeProcessLike } ).process?.argv);
	if ( processArgv !== undefined ) {
		return processArgv.slice( 2 );
	}

	const denoArgs = coerceStringArgs(( globalThis as { Deno?: RuntimeDenoLike } ).Deno?.args);
	if ( denoArgs !== undefined ) {
		return [ ...denoArgs ];
	}

	return [];
};

/**
 * Identity helper that preserves schema typing for object literals.
 *
 * `defineSchema()` does not validate the schema eagerly. Structural validation
 * happens when parseArgs normalizes the schema before parsing.
 *
 * @example
 * ```ts
 * import { defineSchema } from "./index.ts";
 *
 * const schema = defineSchema({
 *   src: { type: "string", flags: ["--src"], required: true },
 *   verbose: { type: "boolean", flags: ["--verbose"], default: false },
 * });
 *
 * console.log(schema.src.flags[0]);
 * ```
 */
export const defineSchema = <T extends Schema>(schema: T): T => schema;

/**
 * Parses argv tokens against a declared schema and returns deterministic typed
 * output plus structured diagnostics.
 *
 * Defaults:
 * - `options.argv`: runtime argv (`process.argv.slice(2)` on Node/Bun,
 *   `Deno.args` on Deno, otherwise `[]`)
 * - `options.allowUnknown`: `false`
 * - `options.stopAtDoubleDash`: `true`
 *
 * Result semantics:
 * - `values` contains typed values plus defaults.
 * - `present` only marks explicitly supplied flags.
 * - `rest` contains free positional tokens and tokens after `--`.
 * - `unknown` only contains unknown flag tokens when `allowUnknown` is `true`.
 * - `issues` contains warnings and errors with stable issue codes.
 * - `ok` is `true` only when no `"error"` issue exists.
 *
 * @throws TypeError
 *
 * Thrown when the schema is structurally invalid.
 *
 * @example
 * ```ts
 * import { defineSchema, parseArgs } from "./index.ts";
 *
 * const schema = defineSchema({
 *   src: { type: "string", flags: ["--src"], required: true },
 *   retries: { type: "number", flags: ["--retries"] },
 *   verbose: { type: "boolean", flags: ["--verbose"], default: false },
 * });
 *
 * const result = parseArgs(schema, {
 *   argv: ["--src", "input.txt", "--retries", "3", "--verbose"],
 * });
 *
 * console.log(result.ok);
 * console.log(result.values.src);
 * console.log(result.values.retries);
 * console.log(result.present.verbose);
 * ```
 *
 * @example
 * ```ts
 * import { defineSchema, parseArgs } from "./index.ts";
 *
 * const schema = defineSchema({
 *   mode: { type: "string", flags: ["--mode"], required: true },
 * });
 *
 * const result = parseArgs(schema, {
 *   argv: ["--mode", "safe", "--", "--trace", "--limit=2"],
 * });
 *
 * console.log(result.rest);
 * ```
 */
export const parseArgs = <T extends Schema>(schema: T, options: ParseOptions = {}): ParseResult<T> => {
	const { flagToKey, booleanNegations, normalized, ok: schemaOk, issues: schemaIssues } = normalizeSchema(schema);
	if (!schemaOk) {
		throw new TypeError(schemaIssues.join('\n'));
	}
	const negationToKey = new Map<string, string>(booleanNegations.map((entry) => [entry.negativeFlag, entry.key]));
	const normalizedMap = new Map<string, NormalizedSpec>(Object.entries(normalized));
	const flagToKeyMap = new Map<string, string>(Object.entries(flagToKey));
	const argv = options.argv !== undefined ? [ ...options.argv ] : resolveRuntimeArgv();
	const allowUnknown = options.allowUnknown === true;
	const stopAtDoubleDash = options.stopAtDoubleDash !== false;

	const values: Record<string, FlagValue<FlagType> | undefined> = {};
	const present: Record<string, boolean> = {};
	const issues: ParseIssue[] = [];
	const unknown: string[] = [];
	const rest: string[] = [];

	for (const [key, spec] of normalizedMap.entries()) {
		present[key] = false;
		values[key] = cloneDefault(spec.default, spec.type);
	}

	const pushIssue = (issue: ParseIssue) => {
		issues.push(issue);
	};

	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === undefined) {
			continue;
		}
		if (stopAtDoubleDash && token === '--') {
			rest.push(...argv.slice(i + 1));
			break;
		}
		if (!isFlagToken(token)) {
			rest.push(token);
			continue;
		}

		const rawToken = token;
		const { flag, value: inlineValue } = splitInlineValue(token);

		if (flag.startsWith('--no-') && !flagToKeyMap.has(flag)) {
			const noAliasKey = negationToKey.get(flag);
			if (noAliasKey !== undefined) {
				const baseSpec = normalizedMap.get(noAliasKey);
				if (baseSpec?.type === 'boolean' && baseSpec.allowNo !== false) {
					if (present[noAliasKey] === true) {
						pushIssue({
							code: 'DUPLICATE',
							severity: 'warning',
							message: `Duplicate flag ${flag}.`,
							flag,
							key: noAliasKey,
							index: i
						});
					}
					present[noAliasKey] = true;
					values[noAliasKey] = false;
					continue;
				}
			}
		}

		const key = flagToKeyMap.get(flag);
		if (key === undefined) {
			if (!allowUnknown) {
				pushIssue({
					code: 'UNKNOWN_FLAG',
					severity: 'error',
					message: `Unknown flag ${flag}.`,
					flag,
					index: i
				});
			} else {
				unknown.push(rawToken);
			}
			continue;
		}

		const spec = normalizedMap.get(key);
		if (spec === undefined) {
			continue;
		}

		const wasPresent = present[key] === true;
		if (wasPresent && spec.type !== 'array') {
			pushIssue({
				code: 'DUPLICATE',
				severity: 'warning',
				message: `Duplicate flag ${flag}.`,
				flag,
				key,
				index: i
			});
		}
		present[key] = true;

		switch (spec.type) {
			case 'boolean': {
				let raw = inlineValue;
				let consumedNext = false;
				if (raw === undefined) {
					const nextValue = argv[i + 1];
					const normalizedValue = normalizeBoolean(nextValue);
					if (normalizedValue !== undefined) {
						raw = nextValue;
						consumedNext = true;
					}
				}
				if (raw !== undefined) {
					const normalizedValue = normalizeBoolean(raw);
					if (normalizedValue === undefined) {
						pushIssue({
							code: 'INVALID_VALUE',
							severity: 'error',
							message: `Invalid boolean value for ${flag}: ${raw}.`,
							flag,
							key,
							value: raw,
							index: i
						});
					} else {
						values[key] = normalizedValue;
						if (consumedNext) {
							i += 1;
						}
					}
				} else {
					values[key] = true;
				}
				break;
			}
			case 'string': {
				let raw = inlineValue;
				if (raw === undefined) {
					const nextValue = argv[i + 1];
					if (typeof nextValue !== 'string' || isFlagToken(nextValue)) {
						pushIssue({
							code: 'MISSING_VALUE',
							severity: 'error',
							message: `Missing value for ${flag}.`,
							flag,
							key,
							index: i
						});
						break;
					}
					raw = nextValue;
					i += 1;
				}
				if (raw.length === 0 && spec.allowEmpty !== true) {
					pushIssue({
						code: 'EMPTY_VALUE',
						severity: 'error',
						message: `Empty value not allowed for ${flag}.`,
						flag,
						key,
						index: i
					});
					break;
				}
				values[key] = raw;
				break;
			}
			case 'number': {
				let raw = inlineValue;
				if (raw === undefined) {
					const nextValue = argv[i + 1];
					if (typeof nextValue !== 'string' || (!isNumericValue(nextValue) && isFlagToken(nextValue))) {
						pushIssue({
							code: 'MISSING_VALUE',
							severity: 'error',
							message: `Missing value for ${flag}.`,
							flag,
							key,
							index: i
						});
						break;
					}
					raw = nextValue;
					i += 1;
				}
				if (!isNumericValue(raw)) {
					pushIssue({
						code: 'INVALID_VALUE',
						severity: 'error',
						message: `Invalid number value for ${flag}: ${raw}.`,
						flag,
						key,
						value: raw,
						index: i
					});
					break;
				}
				values[key] = Number(raw);
				break;
			}
			case 'array': {
				const collected: string[] = [];
				if (inlineValue !== undefined && inlineValue.length > 0) {
					collected.push(inlineValue);
				}
				let cursor = i + 1;
				while (cursor < argv.length) {
					const nextValue = argv[cursor];
					if (nextValue === undefined) {
						cursor += 1;
						continue;
					}
					if (stopAtDoubleDash && nextValue === '--') {
						break;
					}
					if (isFlagToken(nextValue)) {
						break;
					}
					collected.push(nextValue);
					cursor += 1;
				}
				if (cursor > i + 1) {
					i = cursor - 1;
				}
				if (collected.length === 0 && spec.allowEmpty !== true) {
					pushIssue({
						code: 'MISSING_VALUE',
						severity: 'error',
						message: `Missing value for ${flag}.`,
						flag,
						key,
						index: i
					});
					break;
				}
				const existing = Array.isArray(values[key]) ? values[key] : [];
				values[key] = [ ...existing, ...collected ];
				break;
			}
			default:
				break;
		}
	}

	for (const [key, spec] of normalizedMap.entries()) {
		if (spec.required === true && present[key] !== true) {
			const primaryFlag = spec.flags[0];
			pushIssue({
				code: 'REQUIRED',
				severity: 'error',
				message: `Missing required flag ${primaryFlag ?? ''}.`,
				...(typeof primaryFlag === 'string' ? { flag: primaryFlag } : {}),
				key
			});
		}
	}

	const parseOk = issues.every((issue) => issue.severity !== 'error');

	return {
		values: values as ParsedValues<T>,
		present: present as ParsedPresent<T>,
		rest,
		unknown,
		issues,
		ok: parseOk
	};
};

/**
 * Default export alias for parseArgs.
 */
export default parseArgs;

/**
 * Converts a typed parse result into a JSON-safe payload.
 *
 * Conversion rules:
 * - `undefined` values become `null`
 * - arrays are copied
 * - `present`, `rest`, `unknown`, and `issues` are copied into plain JSON-safe
 *   containers
 *
 * Use this before validating results against
 * `schema/parse-result.schema.json` or emitting machine-readable JSON from a
 * CLI wrapper.
 *
 * @example
 * ```ts
 * import { defineSchema, parseArgs, toJsonResult } from "./index.ts";
 *
 * const schema = defineSchema({
 *   count: { type: "number", flags: ["--count"] },
 * });
 *
 * const result = parseArgs(schema, { argv: [] });
 * const json = toJsonResult(result);
 *
 * console.log(json.values.count);
 * ```
 */
export const toJsonResult = <T extends Schema>(result: ParseResult<T>): ParseResultJson => {
	const values: Record<string, JsonFlagValue> = {};
	const valueEntries = result.values as Record<string, FlagValue<FlagType> | undefined>;
	for (const [key, value] of Object.entries(valueEntries)) {
		if (value === undefined) {
			values[key] = null;
			continue;
		}
		values[key] = value;
	}
	const presentEntries = result.present as Record<string, boolean>;
	const present: Record<string, boolean> = {};
	for (const [key, value] of Object.entries(presentEntries)) {
		present[key] = value;
	}
	return {
		values,
		present,
		rest: [ ...result.rest ],
		unknown: [ ...result.unknown ],
		issues: [ ...result.issues ],
		ok: result.ok
	};
};
