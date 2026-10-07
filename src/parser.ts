import type {
	CompiledBooleanOption,
	CompiledDefinitions,
	CompiledOption,
	CompiledValueOption
} from './definitions.ts';
import type {
	ArgvCursor,
	DecodeSettings,
	ParseIssue,
	ParseSettings,
	UnknownFlag,
	ValueParseContext
} from './public-types.ts';
import {
	completedScan,
	createArgvCursorFromOwnedSettings,
	advanceCompiled,
	type InternalArgvScan,
	type InternalScannedOption
} from './scanner.ts';
import { addSuggestionToMessage, createSuggestions } from './suggestions.ts';
import {
	copyClosedRecord,
	hasOwn
} from './value-guards.ts';

interface NormalizedParseSettings {
	readonly cursor: ArgvCursor;
	readonly unknownFlagPolicy: 'error' | 'collect';
}

interface OptionAccumulator {
	successfulOccurrences: number;
	selectedValue: unknown;
	readonly multipleValues: unknown[];
	count: number;
}

interface ParseContext {
	readonly compiled: CompiledDefinitions;
	readonly specified: Record<string, boolean>;
	readonly accumulators: Map<CompiledOption, OptionAccumulator>;
	readonly issues: ParseIssue[];
}

interface RuntimeParseSuccess {
	readonly success: true;
	readonly specified: Readonly<Record<string, boolean>>;
	readonly positionals: readonly string[];
	readonly afterDoubleDash: readonly string[];
	readonly unknownFlags: readonly UnknownFlag[];
	readonly values: Readonly<Record<string, unknown>>;
}

interface RuntimeParseFailure {
	readonly success: false;
	readonly specified: Readonly<Record<string, boolean>>;
	readonly positionals: readonly string[];
	readonly afterDoubleDash: readonly string[];
	readonly unknownFlags: readonly UnknownFlag[];
	readonly issues: readonly ParseIssue[];
}

export type RuntimeParseResult = RuntimeParseSuccess | RuntimeParseFailure;

const readUnknownFlagPolicy = (settings: Readonly<Record<PropertyKey, unknown>>): 'error' | 'collect' => {
	const policy = hasOwn(settings, 'unknownFlagPolicy') ? settings['unknownFlagPolicy'] : 'error';
	if (policy !== 'error' && policy !== 'collect') {
		throw new TypeError('Parse setting "unknownFlagPolicy" must be "error" or "collect".');
	}
	return policy;
};

const readSettings = (settings: unknown, allowed: readonly string[], label: string): Readonly<Record<PropertyKey, unknown>> => {
	if (settings === undefined) return Object.freeze(Object.create(null) as Record<PropertyKey, unknown>);
	return copyClosedRecord(settings, allowed, `${label} settings`);
};

const normalizeParseSettings = (settings: ParseSettings | undefined): NormalizedParseSettings => {
	const owned = readSettings(settings, ['argv', 'unknownFlagPolicy', 'flagPlacement'], 'Parse');
	const cursor = createArgvCursorFromOwnedSettings(owned);
	return { cursor, unknownFlagPolicy: readUnknownFlagPolicy(owned) };
};

const location = (
	occurrence: InternalScannedOption
): {
	readonly flag: string;
	readonly argvElement: string;
	readonly argvIndex: number;
	readonly offset?: number;
} => ({
	flag: occurrence.flag,
	argvElement: occurrence.argvElement,
	argvIndex: occurrence.argvIndex,
	...(occurrence.offset === undefined ? {} : { offset: occurrence.offset })
});

const accumulatorFor = (
	context: ParseContext,
	option: CompiledOption
): OptionAccumulator => {
	const accumulator = context.accumulators.get(option);
	if (accumulator === undefined) {
		throw new TypeError(`Missing accumulator for option "${option.option}".`);
	}
	return accumulator;
};

const applyScalarValue = (
	context: ParseContext,
	option: CompiledValueOption | CompiledBooleanOption,
	value: unknown,
	occurrence: InternalScannedOption
): void => {
	const accumulator = accumulatorFor(context, option);
	if (accumulator.successfulOccurrences > 0) {
		if (option.repeat === 'error') {
			context.issues.push({
				code: 'REPEATED_OPTION',
				message: `Option "${option.option}" was specified more than once.`,
				option: option.option,
				...location(occurrence)
			});
		} else if (option.repeat === 'last') {
			accumulator.selectedValue = value;
		}
	} else {
		accumulator.selectedValue = value;
	}
	accumulator.successfulOccurrences += 1;
};

const applyDecodedValue = (
	context: ParseContext,
	option: CompiledValueOption,
	value: unknown,
	occurrence: InternalScannedOption
): void => {
	if (option.multiple) {
		const accumulator = accumulatorFor(context, option);
		accumulator.multipleValues.push(value);
		accumulator.successfulOccurrences += 1;
		return;
	}
	applyScalarValue(context, option, value, occurrence);
};

const applyExplicitValue = (
	context: ParseContext,
	option: CompiledValueOption,
	occurrence: Extract<InternalScannedOption, { readonly state: 'explicit-value' }>
): void => {
	const parseContext: ValueParseContext = Object.freeze({
		option: option.option,
		flag: occurrence.flag,
		argvElement: occurrence.argvElement,
		argvIndex: occurrence.argvIndex,
		valueArgvIndex: occurrence.valueArgvIndex,
		inline: occurrence.inline
	});
	const result = option.parser.parse(occurrence.rawValue, parseContext);
	if (result.success) {
		applyDecodedValue(context, option, option.parser.snapshot(result.value), occurrence);
		return;
	}
	const suggestions = result.suggestions ??
		(option.parser.choices === undefined
			? Object.freeze([])
			: createSuggestions(occurrence.rawValue, option.parser.choices, false));
	context.issues.push({
		code: 'INVALID_OPTION_VALUE',
		message: addSuggestionToMessage(result.message, suggestions),
		option: option.option,
		rawValue: occurrence.rawValue,
		valueArgvIndex: occurrence.valueArgvIndex,
		inline: occurrence.inline,
		...location(occurrence),
		...(result.reason === undefined ? {} : { reason: result.reason }),
		...(result.details === undefined ? {} : { details: result.details }),
		...(suggestions.length === 0 ? {} : { suggestions })
	});
};

const applyOccurrence = (
	context: ParseContext,
	occurrence: InternalScannedOption
): void => {
	const option = occurrence.binding.option;
	context.specified[option.option] = true;
	switch (occurrence.state) {
		case 'missing-value':
		case 'unexpected-value':
			return;
		case 'count':
			accumulatorFor(context, occurrence.binding.option).count += 1;
			return;
		case 'boolean':
			applyScalarValue(
				context,
				occurrence.binding.option,
				occurrence.binding.booleanValue,
				occurrence
			);
			return;
		case 'implicit-value':
			applyDecodedValue(
				context,
				occurrence.binding.option,
				occurrence.binding.option.parser.snapshot(
					occurrence.binding.option.implicitValue
				),
				occurrence
			);
			return;
		case 'explicit-value':
			applyExplicitValue(context, occurrence.binding.option, occurrence);
			return;
		default: {
			const unreachable: never = occurrence;
			return unreachable;
		}
	}
};

const addUnknownIssues = (
	context: ParseContext,
	unknownFlags: readonly UnknownFlag[]
): void => {
	for (const unknown of unknownFlags) {
		const suggestions = unknown.suggestions ?? Object.freeze([]);
		context.issues.push({
			code: 'UNKNOWN_FLAG',
			message: addSuggestionToMessage(
				`Unknown flag "${unknown.flag}".`,
				suggestions
			),
			flag: unknown.flag,
			argvElement: unknown.argvElement,
			argvIndex: unknown.argvIndex,
			...(unknown.offset === undefined ? {} : { offset: unknown.offset }),
			...(suggestions.length === 0 ? {} : { suggestions })
		});
	}
};

const addMissingRequiredIssues = (context: ParseContext): void => {
	for (const option of context.compiled.options) {
		if (option.required && context.specified[option.option] !== true) {
			context.issues.push({
				code: 'MISSING_REQUIRED_OPTION',
				message: `Required option "${option.option}" was not specified.`,
				option: option.option
			});
		}
	}
};

const snapshotDefault = (option: CompiledValueOption): unknown => {
	if (option.multiple) {
		const compiledDefault = option.defaultValue;
		if (!Array.isArray(compiledDefault)) {
			throw new TypeError(`Invalid compiled default for option "${option.option}".`);
		}
		return Object.freeze(
			compiledDefault.map((entry) => option.parser.snapshot(entry))
		);
	}
	return option.parser.snapshot(option.defaultValue);
};

const materializeValues = (
	context: ParseContext
): Readonly<Record<string, unknown>> => {
	const values = Object.create(null) as Record<string, unknown>;
	for (const option of context.compiled.options) {
		const accumulator = accumulatorFor(context, option);
		if (option.kind === 'count') {
			values[option.option] = accumulator.count;
			continue;
		}
		if (option.kind === 'value' && option.multiple) {
			if (accumulator.successfulOccurrences > 0) {
				values[option.option] = Object.freeze(accumulator.multipleValues);
			} else if (option.hasDefault) {
				values[option.option] = snapshotDefault(option);
			} else {
				values[option.option] = Object.freeze([]);
			}
			continue;
		}
		if (accumulator.successfulOccurrences > 0) {
			values[option.option] = accumulator.selectedValue;
			continue;
		}
		if (option.hasDefault) {
			values[option.option] = option.kind === 'value'
				? snapshotDefault(option)
				: option.defaultValue;
		}
	}
	return Object.freeze(values);
};

const createContext = (
	compiled: CompiledDefinitions,
	scan: InternalArgvScan
): ParseContext => {
	const specified = Object.create(null) as Record<string, boolean>;
	const accumulators = new Map<CompiledOption, OptionAccumulator>();
	for (const option of compiled.options) {
		specified[option.option] = false;
		accumulators.set(option, {
			successfulOccurrences: 0,
			selectedValue: undefined,
			multipleValues: [],
			count: 0
		});
	}
	return {
		compiled,
		specified,
		accumulators,
		issues: [...scan.issues]
	};
};

/** Decodes completed owned occurrences against their final composed scope. */
export const decodeCompiled = (
	compiled: CompiledDefinitions,
	cursor: ArgvCursor,
	settings?: DecodeSettings
): RuntimeParseResult => {
	const owned = readSettings(settings, ['unknownFlagPolicy'], 'Decode');
	const unknownFlagPolicy = readUnknownFlagPolicy(owned);
	return decodeNormalized(compiled, cursor, unknownFlagPolicy);
};

const decodeNormalized = (
	compiled: CompiledDefinitions,
	cursor: ArgvCursor,
	unknownFlagPolicy: 'error' | 'collect'
): RuntimeParseResult => {
	const scan = completedScan(cursor);
	for (const occurrence of scan.options) {
		const binding = compiled.bindings[occurrence.flag];
		if (binding?.option !== occurrence.binding.option) {
			throw new TypeError(`Classification for flag "${occurrence.flag}" belongs to a different option declaration.`);
		}
	}
	const context = createContext(compiled, scan);
	for (const occurrence of scan.options) applyOccurrence(context, occurrence);
	if (unknownFlagPolicy === 'error') {
		addUnknownIssues(context, scan.unknownFlags);
	}
	addMissingRequiredIssues(context);
	const common = {
		specified: Object.freeze(context.specified),
		positionals: Object.freeze(scan.arguments.map((argument) => argument.value)),
		afterDoubleDash: Object.freeze(
			scan.afterDoubleDash.map((argument) => argument.value)
		),
		unknownFlags: scan.unknownFlags
	};
	if (context.issues.length > 0) {
		return Object.freeze({
			success: false,
			...common,
			issues: Object.freeze(
				context.issues.map((issue) => Object.freeze({ ...issue }))
			)
		});
	}
	return Object.freeze({
		success: true,
		...common,
		values: materializeValues(context)
	});
};

/** Parses by driving the same owned classification and decoding operations. */
export const parseCompiled = (compiled: CompiledDefinitions, settings?: ParseSettings): RuntimeParseResult => {
	const normalized = normalizeParseSettings(settings);
	while (!normalized.cursor.done) advanceCompiled(compiled, normalized.cursor);
	return decodeNormalized(compiled, normalized.cursor, normalized.unknownFlagPolicy);
};
