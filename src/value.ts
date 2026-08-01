import type {
	CustomValueParserCallbacks,
	ValueParseContext,
	ValueParseResult,
	ValueParser
} from './public-types.ts';
import {
	assertOwnDataProperties,
	hasOwn,
	isDenseStringArray,
	isPlainRecord,
	isPromiseLike,
	readOwnDataProperty,
	type PlainRecord
} from './value-guards.ts';

/** @internal Settings accepted by `value.string()`; not a root export. */
export interface StringValueSettings {
	/** Whether an empty raw string is allowed. */
	readonly empty?: 'allow' | 'reject';
}

/** @internal Inclusive bounds accepted by numeric value factories. */
export interface NumericValueSettings {
	/** Inclusive lower bound. */
	readonly minimum?: number;
	/** Inclusive upper bound. */
	readonly maximum?: number;
}

/** @internal Custom callback shape that preserves output inference. */
export interface InferredCustomCallbacks<Output> {
	/** Decodes one raw string synchronously. */
	readonly parse: (
		raw: string,
		context: ValueParseContext
	) => ValueParseResult<Output>;
	/** Validates the inferred output without becoming an inference source. */
	readonly accepts: (value: unknown) => value is NoInfer<Output>;
	/** Copies an inferred output at an ownership boundary. */
	readonly snapshot?: (value: NoInfer<Output>) => NoInfer<Output>;
}

/** @internal Rejects settings outside a value factory's property set. */
export type ExactValueSettings<Settings, Shape> = Settings &
	Record<Exclude<keyof Settings, keyof Shape>, never>;

/** @internal Frozen value-parser factory namespace; exported at the root as `value`. */
export interface ValueNamespace {
	/** Creates a string parser. */
	readonly string: <const Settings extends StringValueSettings = StringValueSettings>(
		settings?: ExactValueSettings<Settings, StringValueSettings>
	) => ValueParser<string>;
	/** Creates a finite decimal-number parser. */
	readonly number: <const Settings extends NumericValueSettings = NumericValueSettings>(
		settings?: ExactValueSettings<Settings, NumericValueSettings>
	) => ValueParser<number>;
	/** Creates a safe-integer parser. */
	readonly integer: <const Settings extends NumericValueSettings = NumericValueSettings>(
		settings?: ExactValueSettings<Settings, NumericValueSettings>
	) => ValueParser<number>;
	/** Creates a parser for a non-empty list of unique string literals. */
	readonly choice: <const Values extends readonly [string, ...string[]]>(
		values: Values
	) => ValueParser<Values[number]>;
	/** Creates a parser from synchronous custom callbacks. */
	readonly custom: <
		Output,
		const Callbacks extends object = CustomValueParserCallbacks<Output>
	>(
		callbacks: InferredCustomCallbacks<Output> &
			Callbacks &
			Record<
				Exclude<keyof Callbacks, keyof CustomValueParserCallbacks<Output>>,
				never
			>
	) => ValueParser<Output>;
}

interface RuntimeValueSuccess {
	readonly success: true;
	readonly value: unknown;
}

interface RuntimeValueFailure {
	readonly success: false;
	readonly message: string;
	readonly reason?: string;
	readonly details?: Readonly<Record<string, unknown>>;
	readonly suggestions?: readonly string[];
}

export type RuntimeValueResult = RuntimeValueSuccess | RuntimeValueFailure;

/** Validated runtime behavior read from a public value parser. */
export interface RuntimeValueParser {
	readonly parse: (
		raw: string,
		context: ValueParseContext
	) => RuntimeValueResult;
	readonly accepts: (value: unknown) => boolean;
	readonly snapshot: (value: unknown) => unknown;
	readonly choices?: readonly string[];
}

const createValueParser = <Output>(
	runtime: RuntimeValueParser
): ValueParser<Output> => {
	const parser = Object.assign(Object.create(null) as Record<string, unknown>, {
		parse: runtime.parse,
		accepts: runtime.accepts,
		snapshot: runtime.snapshot,
		...(runtime.choices === undefined
			? {}
			: { choices: Object.freeze([...runtime.choices]) })
	});
	return Object.freeze(parser) as ValueParser<Output>;
};

const readSettings = (
	settings: unknown,
	allowed: readonly string[],
	label: string
): PlainRecord => {
	if (!isPlainRecord(settings)) {
		throw new TypeError(`${label} settings must be a plain object.`);
	}
	assertOwnDataProperties(settings, `${label} settings`);
	for (const property of Reflect.ownKeys(settings)) {
		if (typeof property !== 'string' || !allowed.includes(property)) {
			throw new TypeError(
				`${label} settings have unsupported property "${String(property)}".`
			);
		}
	}
	return settings;
};

const readNumericSettings = (
	settings: unknown,
	label: string
): { readonly minimum?: number; readonly maximum?: number } => {
	const record = readSettings(settings, ['minimum', 'maximum'], label);
	const minimum = hasOwn(record, 'minimum') ? record['minimum'] : undefined;
	const maximum = hasOwn(record, 'maximum') ? record['maximum'] : undefined;
	if (
		hasOwn(record, 'minimum') &&
		(typeof minimum !== 'number' || !Number.isFinite(minimum))
	) {
		throw new TypeError(`${label} minimum must be a finite number.`);
	}
	if (
		hasOwn(record, 'maximum') &&
		(typeof maximum !== 'number' || !Number.isFinite(maximum))
	) {
		throw new TypeError(`${label} maximum must be a finite number.`);
	}
	if (
		typeof minimum === 'number' &&
		typeof maximum === 'number' &&
		minimum > maximum
	) {
		throw new TypeError(`${label} minimum must not exceed maximum.`);
	}
	return {
		...(typeof minimum === 'number' ? { minimum } : {}),
		...(typeof maximum === 'number' ? { maximum } : {})
	};
};

const inBounds = (
	value: number,
	settings: { readonly minimum?: number; readonly maximum?: number }
): boolean =>
	(settings.minimum === undefined || value >= settings.minimum) &&
	(settings.maximum === undefined || value <= settings.maximum);

const boundMessage = (
	label: string,
	settings: { readonly minimum?: number; readonly maximum?: number }
): string => {
	if (settings.minimum !== undefined && settings.maximum !== undefined) {
		return `${label} must be between ${String(settings.minimum)} and ${String(settings.maximum)}.`;
	}
	if (settings.minimum !== undefined) {
		return `${label} must be at least ${String(settings.minimum)}.`;
	}
	if (settings.maximum !== undefined) {
		return `${label} must be at most ${String(settings.maximum)}.`;
	}
	return `${label} is invalid.`;
};

const stringFactory = <const Settings extends StringValueSettings = StringValueSettings>(
	settings?: ExactValueSettings<Settings, StringValueSettings>
): ValueParser<string> => {
	let allowEmpty = false;
	if (settings !== undefined) {
		const record = readSettings(settings, ['empty'], 'String value parser');
		const hasEmpty = hasOwn(record, 'empty');
		const empty = hasEmpty ? record['empty'] : undefined;
		if (hasEmpty && empty !== 'allow' && empty !== 'reject') {
			throw new TypeError(
				'String value parser setting "empty" must be "allow" or "reject".'
			);
		}
		allowEmpty = empty === 'allow';
	}
	return createValueParser<string>({
		parse(raw) {
			return raw.length > 0 || allowEmpty
				? { success: true, value: raw }
				: { success: false, message: 'Value must not be empty.' };
		},
		accepts(value) {
			return typeof value === 'string' && (value.length > 0 || allowEmpty);
		},
		snapshot(value) {
			return value;
		}
	});
};

const isAsciiDigit = (character: string | undefined): boolean =>
	character !== undefined && character >= '0' && character <= '9';

const containsOnlyDigits = (
	value: string,
	start: number,
	end: number
): boolean => {
	if (start >= end) {
		return false;
	}
	for (let index = start; index < end; index += 1) {
		if (!isAsciiDigit(value[index])) {
			return false;
		}
	}
	return true;
};

const isDecimalSyntax = (raw: string): boolean => {
	const hasSign = raw.startsWith('+') || raw.startsWith('-');
	let start = hasSign ? 1 : 0;
	if (start === raw.length) {
		return false;
	}
	let exponentIndex = -1;
	for (let index = start; index < raw.length; index += 1) {
		if ('eE'.includes(raw[index] ?? '')) {
			if (exponentIndex !== -1) {
				return false;
			}
			exponentIndex = index;
		}
	}
	const mantissaEnd = exponentIndex === -1 ? raw.length : exponentIndex;
	if (exponentIndex !== -1) {
		start = exponentIndex + 1;
		if (raw.slice(start).startsWith('+') || raw.slice(start).startsWith('-')) {
			start += 1;
		}
		if (!containsOnlyDigits(raw, start, raw.length)) {
			return false;
		}
	}
	const mantissaStart = hasSign ? 1 : 0;
	const dotIndex = raw.indexOf('.', mantissaStart);
	if (dotIndex === -1 || dotIndex >= mantissaEnd) {
		return containsOnlyDigits(raw, mantissaStart, mantissaEnd);
	}
	if (raw.slice(dotIndex + 1, mantissaEnd).includes('.')) {
		return false;
	}
	const hasLeftDigits = dotIndex > mantissaStart;
	const hasRightDigits = dotIndex + 1 < mantissaEnd;
	return (
		(hasLeftDigits || hasRightDigits) &&
		(!hasLeftDigits || containsOnlyDigits(raw, mantissaStart, dotIndex)) &&
		(!hasRightDigits || containsOnlyDigits(raw, dotIndex + 1, mantissaEnd))
	);
};

const isIntegerSyntax = (raw: string): boolean => {
	const start = raw.startsWith('+') || raw.startsWith('-') ? 1 : 0;
	return containsOnlyDigits(raw, start, raw.length);
};

const numberFactory = <const Settings extends NumericValueSettings = NumericValueSettings>(
	settings?: ExactValueSettings<Settings, NumericValueSettings>
): ValueParser<number> => {
	const bounds: Readonly<NumericValueSettings> = settings === undefined
		? Object.freeze({})
		: Object.freeze(readNumericSettings(settings, 'Number value parser'));
	return createValueParser<number>({
		parse(raw) {
			if (!isDecimalSyntax(raw)) {
				return { success: false, message: 'Value must be a decimal number.' };
			}
			const parsed = Number(raw);
			if (!Number.isFinite(parsed)) {
				return { success: false, message: 'Value must be finite.' };
			}
			return inBounds(parsed, bounds)
				? { success: true, value: parsed }
				: { success: false, message: boundMessage('Value', bounds) };
		},
		accepts(value) {
			return typeof value === 'number' && Number.isFinite(value) && inBounds(value, bounds);
		},
		snapshot(value) {
			return value;
		}
	});
};

const integerFactory = <const Settings extends NumericValueSettings = NumericValueSettings>(
	settings?: ExactValueSettings<Settings, NumericValueSettings>
): ValueParser<number> => {
	const bounds: Readonly<NumericValueSettings> = settings === undefined
		? Object.freeze({})
		: Object.freeze(readNumericSettings(settings, 'Integer value parser'));
	if (
		(bounds.minimum !== undefined && !Number.isSafeInteger(bounds.minimum)) ||
		(bounds.maximum !== undefined && !Number.isSafeInteger(bounds.maximum))
	) {
		throw new TypeError('Integer value parser bounds must be safe integers.');
	}
	return createValueParser<number>({
		parse(raw) {
			if (!isIntegerSyntax(raw)) {
				return { success: false, message: 'Value must be an integer.' };
			}
			const parsed = Number(raw);
			if (!Number.isSafeInteger(parsed)) {
				return { success: false, message: 'Value must be a safe integer.' };
			}
			return inBounds(parsed, bounds)
				? { success: true, value: parsed }
				: { success: false, message: boundMessage('Value', bounds) };
		},
		accepts(value) {
			return typeof value === 'number' && Number.isSafeInteger(value) && inBounds(value, bounds);
		},
		snapshot(value) {
			return value;
		}
	});
};

const choiceFactory = <const Values extends readonly [string, ...string[]]>(
	values: Values
): ValueParser<Values[number]> => {
	if (!isDenseStringArray(values) || values.length === 0) {
		throw new TypeError('Choice values must be a non-empty dense string array.');
	}
	const choices = Object.freeze([...values]);
	if (new Set(choices).size !== choices.length) {
		throw new TypeError('Choice values must be unique.');
	}
	const choiceSet = new Set(choices);
	return createValueParser<Values[number]>({
		parse(raw) {
			return choiceSet.has(raw)
				? { success: true, value: raw }
				: {
						success: false,
						message: `Value must be one of: ${choices.join(', ')}.`
					};
		},
		accepts(value) {
			return typeof value === 'string' && choiceSet.has(value);
		},
		snapshot(value) {
			return value;
		},
		choices
	});
};

const copyDetails = (
	details: unknown
): Readonly<Record<string, unknown>> => {
	if (!isPlainRecord(details)) {
		throw new TypeError('Custom value failure details must be a plain object.');
	}
	assertOwnDataProperties(details, 'Custom value failure details');
	const copy = Object.create(null) as Record<string, unknown>;
	for (const property of Reflect.ownKeys(details)) {
		if (typeof property !== 'string') {
			throw new TypeError('Custom value failure details must use string keys.');
		}
		copy[property] = details[property];
	}
	return Object.freeze(copy);
};

const copySuggestions = (suggestions: unknown): readonly string[] => {
	if (!isDenseStringArray(suggestions)) {
		throw new TypeError('Custom value suggestions must be a dense string array.');
	}
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const suggestion of suggestions) {
		if (suggestion.length === 0) {
			throw new TypeError('Custom value suggestions must not be empty.');
		}
		if (!seen.has(suggestion)) {
			seen.add(suggestion);
			if (unique.length < 3) {
				unique.push(suggestion);
			}
		}
	}
	return Object.freeze(unique);
};

const assertResultProperties = (
	result: PlainRecord,
	allowed: readonly string[]
): void => {
	assertOwnDataProperties(result, 'Custom value result');
	for (const property of Reflect.ownKeys(result)) {
		if (typeof property !== 'string' || !allowed.includes(property)) {
			throw new TypeError(
				`Custom value result has unsupported property "${String(property)}".`
			);
		}
	}
};

const normalizeValueResult = (candidate: unknown): RuntimeValueResult => {
	if (!isPlainRecord(candidate) || !hasOwn(candidate, 'success')) {
		throw new TypeError('Value parser returned a malformed result.');
	}
	if (candidate['success'] === true) {
		assertResultProperties(candidate, ['success', 'value']);
		if (!hasOwn(candidate, 'value')) {
			throw new TypeError('Value parser success must contain a value.');
		}
		return { success: true, value: candidate['value'] };
	}
	if (candidate['success'] !== false) {
		throw new TypeError('Value parser result success must be boolean.');
	}
	assertResultProperties(candidate, [
		'success',
		'message',
		'reason',
		'details',
		'suggestions'
	]);
	const message = candidate['message'];
	const reason = hasOwn(candidate, 'reason') ? candidate['reason'] : undefined;
	if (typeof message !== 'string' || message.length === 0) {
		throw new TypeError('Value parser failure message must be a non-empty string.');
	}
	if (reason !== undefined && (typeof reason !== 'string' || reason.length === 0)) {
		throw new TypeError('Value parser failure reason must be a non-empty string.');
	}
	const details = hasOwn(candidate, 'details')
		? copyDetails(candidate['details'])
		: undefined;
	const suggestions = hasOwn(candidate, 'suggestions')
		? copySuggestions(candidate['suggestions'])
		: undefined;
	return {
		success: false,
		message,
		...(typeof reason === 'string' ? { reason } : {}),
		...(details === undefined ? {} : { details }),
		...(suggestions === undefined ? {} : { suggestions })
	};
};

/** Reads the structural value-parser interface implemented by compatible copies. */
export function getRuntimeValueParser(
	candidate: ValueParser<unknown>
): RuntimeValueParser;
/** Reads compatible runtime behavior from an unknown value. */
export function getRuntimeValueParser(
	candidate: unknown
): RuntimeValueParser | undefined;
export function getRuntimeValueParser(
	candidate: unknown
): RuntimeValueParser | undefined {
	if (candidate === null || typeof candidate !== 'object') return undefined;
	const parser = candidate as Readonly<Record<string, unknown>>;
	const parseCandidate = parser['parse'];
	const acceptsCandidate = parser['accepts'];
	const snapshotCandidate = parser['snapshot'];
	const choicesCandidate = parser['choices'];
	if (
		typeof parseCandidate !== 'function' ||
		typeof acceptsCandidate !== 'function' ||
		typeof snapshotCandidate !== 'function' ||
		(choicesCandidate !== undefined && !isDenseStringArray(choicesCandidate))
	) {
		return undefined;
	}
	const parse = parseCandidate as (
		raw: string,
		context: ValueParseContext
	) => unknown;
	const check = acceptsCandidate as (value: unknown) => unknown;
	const copy = snapshotCandidate as (value: unknown) => unknown;
	const choices = choicesCandidate === undefined
		? undefined
		: Object.freeze([...choicesCandidate]);
	const accepts = (value: unknown): boolean => {
		const accepted: unknown = check(value);
		if (typeof accepted !== 'boolean') {
			throw new TypeError('Value parser accepts callback must return a boolean.');
		}
		return accepted;
	};
	const snapshot = (value: unknown): unknown => {
		const captured: unknown = copy(value);
		if (isPromiseLike(captured)) {
			throw new TypeError('Value parser snapshot must be synchronous.');
		}
		if (!accepts(captured)) {
			throw new TypeError('Value parser snapshot returned an unacceptable value.');
		}
		return captured;
	};
	return Object.freeze({
		parse(raw: string, context: ValueParseContext): RuntimeValueResult {
			const result: unknown = parse(raw, context);
			if (isPromiseLike(result)) {
				throw new TypeError('Value parser parse callback must be synchronous.');
			}
			const normalized = normalizeValueResult(result);
			if (!normalized.success) return normalized;
			if (!accepts(normalized.value)) {
				throw new TypeError('Value parser returned an unacceptable value.');
			}
			return { success: true, value: snapshot(normalized.value) };
		},
		accepts,
		snapshot,
		...(choices === undefined ? {} : { choices })
	});
}

const customFactory = <
	Output,
	const Callbacks extends object = CustomValueParserCallbacks<Output>
>(
	callbacks: InferredCustomCallbacks<Output> &
		Callbacks &
		Record<
			Exclude<
				keyof Callbacks,
				keyof CustomValueParserCallbacks<Output>
			>,
			never
		>
): ValueParser<Output> => {
	if (!isPlainRecord(callbacks)) {
		throw new TypeError('Custom value parser callbacks must be a plain object.');
	}
	assertOwnDataProperties(callbacks, 'Custom value parser callbacks');
	for (const property of Reflect.ownKeys(callbacks)) {
		if (
			typeof property !== 'string' ||
			(property !== 'parse' && property !== 'accepts' && property !== 'snapshot')
		) {
			throw new TypeError(
				`Custom value parser callbacks have unsupported property "${String(property)}".`
			);
		}
	}
	const parseCandidate = readOwnDataProperty(callbacks, 'parse');
	const acceptsCandidate = readOwnDataProperty(callbacks, 'accepts');
	const snapshotCallback: unknown = hasOwn(callbacks, 'snapshot')
		? readOwnDataProperty(callbacks, 'snapshot')
		: undefined;
	if (typeof parseCandidate !== 'function' || typeof acceptsCandidate !== 'function') {
		throw new TypeError('Custom value parser requires parse and accepts callbacks.');
	}
	if (hasOwn(callbacks, 'snapshot') && typeof snapshotCallback !== 'function') {
		throw new TypeError('Custom value parser snapshot must be a function.');
	}
	const parseCallback = parseCandidate as (
		raw: string,
		context: ValueParseContext
	) => unknown;
	const acceptsCallback = acceptsCandidate as (value: unknown) => unknown;
	const callSnapshot = snapshotCallback as
		| ((value: unknown) => unknown)
		| undefined;

	const accepts = (candidate: unknown): boolean => {
		const accepted: unknown = acceptsCallback(candidate);
		if (typeof accepted !== 'boolean') {
			throw new TypeError('Custom value parser accepts callback must return a boolean.');
		}
		return accepted;
	};

	const snapshot = (candidate: unknown): unknown => {
		const captured = callSnapshot === undefined
			? candidate
			: callSnapshot(candidate);
		if (isPromiseLike(captured)) {
			throw new TypeError('Custom value parser snapshot must be synchronous.');
		}
		if (!accepts(captured)) {
			throw new TypeError('Custom value parser snapshot returned an unacceptable value.');
		}
		return captured;
	};

	return createValueParser<Output>({
		parse(raw, context) {
			const callbackResult: unknown = parseCallback(raw, context);
			if (isPromiseLike(callbackResult)) {
				throw new TypeError('Custom value parser parse callback must be synchronous.');
			}
			if (!isPlainRecord(callbackResult) || !hasOwn(callbackResult, 'success')) {
				throw new TypeError('Custom value parser returned a malformed result.');
			}
			if (callbackResult['success'] === true) {
				assertResultProperties(callbackResult, ['success', 'value']);
				if (!hasOwn(callbackResult, 'value') || !accepts(callbackResult['value'])) {
					throw new TypeError('Custom value parser returned an unacceptable value.');
				}
				return { success: true, value: callbackResult['value'] };
			}
			if (callbackResult['success'] !== false) {
				throw new TypeError('Custom value parser result success must be boolean.');
			}
			assertResultProperties(callbackResult, [
				'success',
				'message',
				'reason',
				'details',
				'suggestions'
			]);
			const message = callbackResult['message'];
			const hasReason = hasOwn(callbackResult, 'reason');
			const reason = hasReason
				? callbackResult['reason']
				: undefined;
			if (typeof message !== 'string' || message.length === 0) {
				throw new TypeError('Custom value failure message must be a non-empty string.');
			}
			if (hasReason && (typeof reason !== 'string' || reason.length === 0)) {
				throw new TypeError('Custom value failure reason must be a non-empty string.');
			}
			const details = hasOwn(callbackResult, 'details')
				? copyDetails(callbackResult['details'])
				: undefined;
			const suggestions = hasOwn(callbackResult, 'suggestions')
				? copySuggestions(callbackResult['suggestions'])
				: undefined;
			return {
				success: false,
				message,
				...(typeof reason === 'string' ? { reason } : {}),
				...(details === undefined ? {} : { details }),
				...(suggestions === undefined ? {} : { suggestions })
			};
		},
		accepts,
		snapshot
	});
};

/** Frozen namespace containing all value-parser factories. */
export const value: Readonly<ValueNamespace> = Object.freeze({
	string: stringFactory,
	number: numberFactory,
	integer: integerFactory,
	choice: choiceFactory,
	custom: customFactory
});
