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

const isNumericValue = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length === 0) return false;
	const parsed = Number(value);
	return Number.isFinite(parsed);
};

const cloneDefault = <T extends FlagType>(value: FlagValue<T> | undefined, type: T): FlagValue<T> | undefined => {
	if (type === 'array' && Array.isArray(value)) {
		return [ ...value ] as FlagValue<T>;
	}
	return value;
};

const splitInlineValue = (token: string): { flag: string; value?: string } => {
	const eqIndex = token.indexOf('=');
	if (eqIndex <= 0) return { flag: token };
	return { flag: token.slice(0, eqIndex), value: token.slice(eqIndex + 1) };
};

const validateSchema = <S extends Schema>(schema: S) => {
	if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
		throw new TypeError('Schema must be an object.');
	}

	const flagToKey = new Map<string, keyof S>();
	const normalized = new Map<keyof S, NormalizedSpec>();

	for (const [rawKey, rawSpec] of Object.entries(schema)) {
		const key = rawKey as keyof S;
		const spec = rawSpec as FlagSpec;
		if (!spec || typeof spec !== 'object') {
			throw new TypeError(`Schema entry for "${String(key)}" must be an object.`);
		}
		const type = spec.type;
		if (!['string', 'boolean', 'number', 'array'].includes(type)) {
			throw new TypeError(`Schema entry "${String(key)}" has invalid type "${String(type)}".`);
		}
		const flagsInput = spec.flags;
		if (!Array.isArray(flagsInput) || flagsInput.length === 0) {
			throw new TypeError(`Schema entry "${String(key)}" must define at least one flag.`);
		}
		const flags: string[] = [];
		for (const flag of flagsInput) {
			if (typeof flag !== 'string' || flag.length < 2 || !flag.startsWith('-')) {
				throw new TypeError(`Schema entry "${String(key)}" has invalid flag "${String(flag)}".`);
			}
			if (flagToKey.has(flag)) {
				const existing = flagToKey.get(flag);
				throw new TypeError(`Flag "${flag}" is already assigned to "${String(existing)}".`);
			}
			flagToKey.set(flag, key);
			flags.push(flag);
		}
		const longFlag = flags.find((flag) => flag.startsWith('--'));
		const normalizedSpec: NormalizedSpec = {
			...spec,
			type,
			flags,
			...(longFlag ? { longFlag } : {})
		};
		normalized.set(key, normalizedSpec);
	}

	return { flagToKey, normalized };
};

export const defineSchema = <T extends Schema>(schema: T): T => schema;

export const parseArgs = <T extends Schema>(schema: T, options: ParseOptions = {}): ParseResult<T> => {
	const { flagToKey, normalized } = validateSchema(schema);
	const argv = Array.isArray(options.argv) ? options.argv : process.argv.slice(2);
	const allowUnknown = options.allowUnknown === true;
	const stopAtDoubleDash = options.stopAtDoubleDash !== false;

	const values = {} as ParsedValues<T>;
	const present = {} as ParsedPresent<T>;
	const issues: ParseIssue[] = [];
	const unknown: string[] = [];
	const rest: string[] = [];

	for (const [key, spec] of normalized.entries()) {
		present[key as keyof T] = false as ParsedPresent<T>[keyof T];
		values[key as keyof T] = cloneDefault(spec.default as FlagValue<FlagType> | undefined, spec.type) as ParsedValues<T>[keyof T];
	}

	const pushIssue = (issue: ParseIssue) => {
		issues.push(issue);
	};

	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
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
			if (baseKey) {
				const baseSpec = normalized.get(baseKey);
				if (baseSpec?.type === 'boolean' && baseSpec.allowNo !== false) {
					if (present[baseKey as keyof T]) {
						pushIssue({
							code: 'DUPLICATE',
							severity: 'warning',
							message: `Duplicate flag ${base}.`,
							flag: base,
							key: String(baseKey),
							index: i
						});
					}
					present[baseKey as keyof T] = true as ParsedPresent<T>[keyof T];
					values[baseKey as keyof T] = false as ParsedValues<T>[keyof T];
					continue;
				}
			}
		}

		const key = flagToKey.get(flag);
		if (!key) {
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
		if (!spec) {
			continue;
		}

		const wasPresent = present[key as keyof T];
		if (wasPresent && spec.type !== 'array') {
			pushIssue({
				code: 'DUPLICATE',
				severity: 'warning',
				message: `Duplicate flag ${flag}.`,
				flag,
				key: String(key),
				index: i
			});
		}
		present[key as keyof T] = true as ParsedPresent<T>[keyof T];

		if (spec.type === 'boolean') {
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
						key: String(key),
						value: raw,
						index: i
					});
				} else {
					values[key as keyof T] = normalizedValue as ParsedValues<T>[keyof T];
					if (consumedNext) {
						i += 1;
					}
				}
			} else {
				values[key as keyof T] = true as ParsedValues<T>[keyof T];
			}
			continue;
		}

		if (spec.type === 'string') {
			let raw = inlineValue;
			if (raw === undefined) {
				const nextValue = argv[i + 1];
				if (typeof nextValue !== 'string' || isFlagToken(nextValue)) {
					pushIssue({
						code: 'MISSING_VALUE',
						severity: 'error',
						message: `Missing value for ${flag}.`,
						flag,
						key: String(key),
						index: i
					});
					continue;
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
					key: String(key),
					index: i
				});
				continue;
			}
			values[key as keyof T] = raw as ParsedValues<T>[keyof T];
			continue;
		}

		if (spec.type === 'number') {
			let raw = inlineValue;
			if (raw === undefined) {
				const nextValue = argv[i + 1];
				if (typeof nextValue !== 'string' || (!isNumericValue(nextValue) && isFlagToken(nextValue))) {
					pushIssue({
						code: 'MISSING_VALUE',
						severity: 'error',
						message: `Missing value for ${flag}.`,
						flag,
						key: String(key),
						index: i
					});
					continue;
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
					key: String(key),
					value: raw,
					index: i
				});
				continue;
			}
			values[key as keyof T] = Number(raw) as ParsedValues<T>[keyof T];
			continue;
		}

		if (spec.type === 'array') {
			const collected: string[] = [];
			if (inlineValue !== undefined && inlineValue.length > 0) {
				collected.push(inlineValue);
			}
			let cursor = i + 1;
			while (cursor < argv.length) {
				const nextValue = argv[cursor];
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
					key: String(key),
					index: i
				});
				continue;
			}
			const existing = Array.isArray(values[key as keyof T]) ? (values[key as keyof T] as string[]) : [];
			values[key as keyof T] = [ ...existing, ...collected ] as ParsedValues<T>[keyof T];
			continue;
		}
	}

	for (const [key, spec] of normalized.entries()) {
		if (spec.required && !present[key as keyof T]) {
			const primaryFlag = spec.flags[0];
			pushIssue({
				code: 'REQUIRED',
				severity: 'error',
				message: `Missing required flag ${primaryFlag ?? ''}.`,
				...(primaryFlag ? { flag: primaryFlag } : {}),
				key: String(key)
			});
		}
	}

	const ok = issues.every((issue) => issue.severity !== 'error');

	return {
		values,
		present,
		rest,
		unknown,
		issues,
		ok
	};
};

export default parseArgs;

export const toJsonResult = <T extends Schema>(result: ParseResult<T>): ParseResultJson => {
	const values: Record<string, JsonFlagValue> = {};
	for (const [key, value] of Object.entries(result.values as Record<string, unknown>)) {
		if (value === undefined) {
			values[key] = null;
			continue;
		}
		values[key] = value as JsonFlagValue;
	}
	return {
		values,
		present: result.present as Record<string, boolean>,
		rest: [ ...result.rest ],
		unknown: [ ...result.unknown ],
		issues: [ ...result.issues ],
		ok: result.ok
	};
};
