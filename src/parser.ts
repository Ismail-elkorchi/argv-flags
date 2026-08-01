import type {
	CompiledBooleanOption,
	CompiledDefinitions,
	CompiledOption,
	CompiledValueOption
} from './definitions.ts';
import type {
	ParseIssue,
	ParseSettings,
	UnknownFlag,
	ValueParseContext
} from './public-types.ts';
import { resolveRuntimeArgv } from './runtime.ts';
import {
	scanCompiledInternal,
	type InternalArgvScan,
	type InternalScannedOption
} from './scanner.ts';
import { addSuggestionToMessage, createSuggestions } from './suggestions.ts';
import {
	assertOwnDataProperties,
	hasOwn,
	isDenseStringArray,
	isPlainRecord
} from './value-guards.ts';

interface NormalizedParseSettings {
	readonly argv: readonly string[];
	readonly unknownFlagPolicy: 'error' | 'collect';
	readonly flagPlacement: 'interspersed' | 'before-positionals';
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

const normalizeParseSettings = (
	settings: ParseSettings | undefined
): NormalizedParseSettings => {
	if (settings === undefined) {
		return {
			argv: Object.freeze(resolveRuntimeArgv()),
			unknownFlagPolicy: 'error',
			flagPlacement: 'interspersed'
		};
	}
	if (!isPlainRecord(settings)) {
		throw new TypeError('Parse settings must be an ordinary or null-prototype object.');
	}
	assertOwnDataProperties(settings, 'Parse settings');
	for (const property of Reflect.ownKeys(settings)) {
		if (
			typeof property !== 'string' ||
			(property !== 'argv' &&
				property !== 'unknownFlagPolicy' &&
				property !== 'flagPlacement')
		) {
			throw new TypeError(
				`Parse settings have unsupported property "${String(property)}".`
			);
		}
	}
	const argv = hasOwn(settings, 'argv')
		? settings['argv']
		: resolveRuntimeArgv();
	if (!isDenseStringArray(argv)) {
		throw new TypeError('Parse setting "argv" must be a dense string array.');
	}
	const unknownFlagPolicy = hasOwn(settings, 'unknownFlagPolicy')
		? settings['unknownFlagPolicy']
		: 'error';
	if (unknownFlagPolicy !== 'error' && unknownFlagPolicy !== 'collect') {
		throw new TypeError(
			'Parse setting "unknownFlagPolicy" must be "error" or "collect".'
		);
	}
	const flagPlacement = hasOwn(settings, 'flagPlacement')
		? settings['flagPlacement']
		: 'interspersed';
	if (flagPlacement !== 'interspersed' && flagPlacement !== 'before-positionals') {
		throw new TypeError(
			'Parse setting "flagPlacement" must be "interspersed" or "before-positionals".'
		);
	}
	return {
		argv: Object.freeze([...argv]),
		unknownFlagPolicy,
		flagPlacement
	};
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
		applyDecodedValue(context, option, result.value, occurrence);
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
	if (
		occurrence.state === 'missing-value' ||
		occurrence.state === 'unexpected-value'
	) {
		return;
	}
	if (occurrence.binding.kind === 'count') {
		accumulatorFor(context, option).count += 1;
		return;
	}
	if (occurrence.binding.kind === 'boolean') {
		applyScalarValue(
			context,
			occurrence.binding.option,
			occurrence.binding.booleanValue,
			occurrence
		);
		return;
	}
	if (occurrence.state === 'implicit-value') {
		applyDecodedValue(
			context,
			occurrence.binding.option,
			occurrence.binding.option.parser.snapshot(
				occurrence.binding.option.implicitValue
			),
			occurrence
		);
		return;
	}
	if (occurrence.state === 'explicit-value') {
		applyExplicitValue(context, occurrence.binding.option, occurrence);
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
				values[option.option] = Object.freeze([...accumulator.multipleValues]);
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

/** Parses one argv vector with already-compiled definitions. */
export const parseCompiled = (
	compiled: CompiledDefinitions,
	settings?: ParseSettings
): RuntimeParseResult => {
	const normalized = normalizeParseSettings(settings);
	const scan = scanCompiledInternal(
		compiled,
		normalized.argv,
		normalized.flagPlacement
	);
	const context = createContext(compiled, scan);
	for (const occurrence of scan.options) applyOccurrence(context, occurrence);
	if (normalized.unknownFlagPolicy === 'error') {
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
