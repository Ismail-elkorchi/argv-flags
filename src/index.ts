const BOOLEAN_TRUE = new Set<string>(['true', '1', 'yes', 'y', 'on']);
const BOOLEAN_FALSE = new Set<string>(['false', '0', 'no', 'n', 'off']);

export type FlagType = 'string' | 'boolean' | 'number' | 'array';

export type FlagValue<T extends FlagType> = T extends 'string'
	? string
	: T extends 'boolean'
		? boolean
		: T extends 'number'
			? number
			: T extends 'array'
				? string[]
				: never;

export interface FlagSpec<T extends FlagType = FlagType> {
	type: T;
	flags: readonly string[];
	required?: boolean;
	default?: FlagValue<T>;
	allowEmpty?: boolean;
	allowNo?: boolean;
}

export type Schema = Record<string, FlagSpec>;

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
	| 'UNKNOWN_FLAG'
	| 'MISSING_VALUE'
	| 'INVALID_VALUE'
	| 'REQUIRED'
	| 'DUPLICATE'
	| 'EMPTY_VALUE';

export interface ParseIssue {
	code: IssueCode;
	severity: IssueSeverity;
	message: string;
	flag?: string;
	key?: string;
	value?: string;
	index?: number;
}

export interface ParseOptions {
	argv?: readonly string[];
	allowUnknown?: boolean;
	stopAtDoubleDash?: boolean;
}

export type ParsedValues<S extends Schema> = {
	[K in keyof S]: FlagValue<S[K]['type']> | undefined;
};

export type ParsedPresent<S extends Schema> = {
	[K in keyof S]: boolean;
};

export interface ParseResult<S extends Schema> {
	values: ParsedValues<S>;
	present: ParsedPresent<S>;
	rest: string[];
	unknown: string[];
	issues: ParseIssue[];
	ok: boolean;
}

export type JsonFlagValue = string | number | boolean | string[] | null;

export interface ParseResultJson {
	values: Record<string, JsonFlagValue>;
	present: Record<string, boolean>;
	rest: string[];
	unknown: string[];
	issues: ParseIssue[];
	ok: boolean;
}

interface NormalizedSpec extends FlagSpec {
	flags: string[];
	longFlag?: string;
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
	if (typeof value !== 'string' || value.length === 0) return false;
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

const normalizeDefaultValue = (
	key: string,
	value: unknown,
	type: FlagType
): FlagValue<FlagType> | undefined => {
	if (value === undefined) {
		return undefined;
	}
	switch (type) {
		case 'string':
			if (typeof value !== 'string') {
				throw new TypeError(`Schema entry "${key}" default must be a string.`);
			}
			return value;
		case 'boolean':
			if (typeof value !== 'boolean') {
				throw new TypeError(`Schema entry "${key}" default must be a boolean.`);
			}
			return value;
		case 'number':
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				throw new TypeError(`Schema entry "${key}" default must be a finite number.`);
			}
			return value;
		case 'array':
			if (!isStringArray(value)) {
				throw new TypeError(`Schema entry "${key}" default must be a string array.`);
			}
			return value;
		default: {
			const exhaustive: never = type;
			throw new TypeError(`Schema entry "${key}" has invalid type "${String(exhaustive)}".`);
		}
	}
};

const validateSchema = (schema: unknown) => {
	if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
		throw new TypeError('Schema must be an object.');
	}

	const flagToKey = new Map<string, string>();
	const normalized = new Map<string, NormalizedSpec>();
	const typedSchema = schema as Record<string, unknown>;

	for (const key of Object.keys(typedSchema)) {
		const rawSpec = typedSchema[key];
		if (rawSpec === null || typeof rawSpec !== 'object' || Array.isArray(rawSpec)) {
			throw new TypeError(`Schema entry for "${key}" must be an object.`);
		}
		const specRecord = rawSpec as Record<string, unknown>;
		const type = specRecord['type'];
		if (type !== 'string' && type !== 'boolean' && type !== 'number' && type !== 'array') {
			throw new TypeError(`Schema entry "${key}" has invalid type.`);
		}
		const flagsInput = specRecord['flags'];
		if (!Array.isArray(flagsInput) || flagsInput.length === 0) {
			throw new TypeError(`Schema entry "${key}" must define at least one flag.`);
		}
		const flags: string[] = [];
		for (const flag of flagsInput) {
			if (typeof flag !== 'string' || flag.length < 2 || !flag.startsWith('-')) {
				throw new TypeError(`Schema entry "${key}" has invalid flag "${String(flag)}".`);
			}
			if (flagToKey.has(flag)) {
				const existing = flagToKey.get(flag);
				throw new TypeError(`Flag "${flag}" is already assigned to "${existing ?? ''}".`);
			}
			flagToKey.set(flag, key);
			flags.push(flag);
		}
		const defaultValue = normalizeDefaultValue(key, specRecord['default'], type);
		const spec: FlagSpec = {
			type,
			flags,
			...(specRecord['required'] === true ? { required: true } : {}),
			...(specRecord['allowEmpty'] === true ? { allowEmpty: true } : {}),
			...(specRecord['allowNo'] === false ? { allowNo: false } : {}),
			...(defaultValue !== undefined ? { default: defaultValue } : {})
		};
		const longFlag = flags.find((flag) => flag.startsWith('--'));
		const normalizedSpec: NormalizedSpec = {
			...spec,
			type,
			flags,
			...(typeof longFlag === 'string' ? { longFlag } : {})
		};
		normalized.set(key, normalizedSpec);
	}

	return { flagToKey, normalized };
};

export const defineSchema = <T extends Schema>(schema: T): T => schema;

export const parseArgs = <T extends Schema>(schema: T, options: ParseOptions = {}): ParseResult<T> => {
	const { flagToKey, normalized } = validateSchema(schema);
	const argv = options.argv !== undefined ? [ ...options.argv ] : process.argv.slice(2);
	const allowUnknown = options.allowUnknown === true;
	const stopAtDoubleDash = options.stopAtDoubleDash !== false;

	const values: Record<string, FlagValue<FlagType> | undefined> = {};
	const present: Record<string, boolean> = {};
	const issues: ParseIssue[] = [];
	const unknown: string[] = [];
	const rest: string[] = [];

	for (const [key, spec] of normalized.entries()) {
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

		if (flag.startsWith('--no-') && !flagToKey.has(flag)) {
			const base = `--${flag.slice(5)}`;
		const baseKey = flagToKey.get(base);
		if (baseKey !== undefined) {
			const baseSpec = normalized.get(baseKey);
			if (baseSpec?.type === 'boolean' && baseSpec.allowNo !== false) {
				if (present[baseKey] === true) {
					pushIssue({
						code: 'DUPLICATE',
						severity: 'warning',
						message: `Duplicate flag ${base}.`,
						flag: base,
						key: baseKey,
						index: i
					});
				}
				present[baseKey] = true;
				values[baseKey] = false;
				continue;
			}
		}
	}

		const key = flagToKey.get(flag);
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

		const spec = normalized.get(key);
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

	for (const [key, spec] of normalized.entries()) {
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

	const ok = issues.every((issue) => issue.severity !== 'error');

	return {
		values: values as ParsedValues<T>,
		present: present as ParsedPresent<T>,
		rest,
		unknown,
		issues,
		ok
	};
};

export default parseArgs;

export const toJsonResult = <T extends Schema>(result: ParseResult<T>): ParseResultJson => {
	const values: Record<string, JsonFlagValue> = {};
	const valueEntries = result.values as Record<string, FlagValue<FlagType> | undefined>;
	for (const [key, value] of Object.entries(valueEntries)) {
		if (value === undefined) {
			values[key] = null;
			continue;
		}
		values[key] = value as JsonFlagValue;
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
