import type {
	CompiledBooleanOption,
	CompiledDefinitions,
	CompiledOption,
	CompiledValueOption,
	FlagBinding
} from './definitions.ts';
import type {
	ParseIssue,
	ParseSettings,
	UnknownFlag,
	ValueParseContext
} from './public-types.ts';
import { resolveRuntimeArgv } from './runtime.ts';
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
	readonly argv: readonly string[];
	readonly unknownFlagPolicy: 'error' | 'collect';
	readonly specified: Record<string, boolean>;
	readonly accumulators: Map<CompiledOption, OptionAccumulator>;
	readonly positionals: string[];
	readonly afterDoubleDash: string[];
	readonly unknownFlags: UnknownFlag[];
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

const SHORT_MEMBER_PATTERN = /^[A-Za-z0-9]$/u;
const LONG_FLAG_PATTERN = /^--[A-Za-z0-9][A-Za-z0-9_-]*$/u;

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
	const argvValue = hasOwn(settings, 'argv')
		? settings['argv']
		: resolveRuntimeArgv();
	if (!isDenseStringArray(argvValue)) {
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
	if (
		flagPlacement !== 'interspersed' &&
		flagPlacement !== 'before-positionals'
	) {
		throw new TypeError(
			'Parse setting "flagPlacement" must be "interspersed" or "before-positionals".'
		);
	}
	return {
		argv: Object.freeze([...argvValue]),
		unknownFlagPolicy,
		flagPlacement
	};
};

const location = (
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): {
	readonly flag: string;
	readonly argvElement: string;
	readonly argvIndex: number;
	readonly offset?: number;
} => ({
	flag,
	argvElement,
	argvIndex,
	...(offset === undefined ? {} : { offset })
});

const recordUnknownFlag = (
	context: ParseContext,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset: number | undefined,
	inlineValue: string | undefined,
	hasInlineValue: boolean
): void => {
	const source = location(flag, argvElement, argvIndex, offset);
	context.unknownFlags.push({
		...source,
		...(hasInlineValue ? { inlineValue: inlineValue ?? '' } : {})
	});
	if (context.unknownFlagPolicy === 'collect') {
		return;
	}
	const suggestions = flag.startsWith('--')
		? createSuggestions(flag, context.compiled.longFlags, true)
		: Object.freeze([]);
	context.issues.push({
		code: 'UNKNOWN_FLAG',
		message: addSuggestionToMessage(`Unknown flag "${flag}".`, suggestions),
		...source,
		...(suggestions.length === 0 ? {} : { suggestions })
	});
};

const markSpecified = (context: ParseContext, option: CompiledOption): void => {
	context.specified[option.option] = true;
};

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
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	const accumulator = accumulatorFor(context, option);
	if (accumulator.successfulOccurrences > 0) {
		if (option.repeat === 'error') {
			context.issues.push({
				code: 'REPEATED_OPTION',
				message: `Option "${option.option}" was specified more than once.`,
				option: option.option,
				...location(flag, argvElement, argvIndex, offset)
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
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	if (option.multiple) {
		const accumulator = accumulatorFor(context, option);
		accumulator.multipleValues.push(value);
		accumulator.successfulOccurrences += 1;
		return;
	}
	applyScalarValue(
		context,
		option,
		value,
		flag,
		argvElement,
		argvIndex,
		offset
	);
};

const applyExplicitValue = (
	context: ParseContext,
	option: CompiledValueOption,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset: number | undefined,
	rawValue: string,
	valueArgvIndex: number,
	inline: boolean
): void => {
	const parseContext: ValueParseContext = Object.freeze({
		option: option.option,
		flag,
		argvElement,
		argvIndex,
		valueArgvIndex,
		inline
	});
	const result = option.parser.parse(rawValue, parseContext);
	if (result.success) {
		applyDecodedValue(
			context,
			option,
			result.value,
			flag,
			argvElement,
			argvIndex,
			offset
		);
		return;
	}
	const suggestions = result.suggestions ??
		(option.parser.choices === undefined
			? Object.freeze([])
			: createSuggestions(rawValue, option.parser.choices, false));
	context.issues.push({
		code: 'INVALID_OPTION_VALUE',
		message: addSuggestionToMessage(result.message, suggestions),
		option: option.option,
		rawValue,
		valueArgvIndex,
		inline,
		...location(flag, argvElement, argvIndex, offset),
		...(result.reason === undefined ? {} : { reason: result.reason }),
		...(result.details === undefined ? {} : { details: result.details }),
		...(suggestions.length === 0 ? {} : { suggestions })
	});
};

const applyImplicitValue = (
	context: ParseContext,
	option: CompiledValueOption,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	const value = option.parser.snapshot(option.implicitValue);
	applyDecodedValue(
		context,
		option,
		value,
		flag,
		argvElement,
		argvIndex,
		offset
	);
};

const addMissingValueIssue = (
	context: ParseContext,
	option: CompiledValueOption,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	context.issues.push({
		code: 'MISSING_OPTION_VALUE',
		message: `Flag "${flag}" requires a value.`,
		option: option.option,
		...location(flag, argvElement, argvIndex, offset)
	});
};

const applyBooleanOrCount = (
	context: ParseContext,
	binding: Exclude<FlagBinding, { readonly kind: 'value' }>,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	markSpecified(context, binding.option);
	if (binding.kind === 'count') {
		accumulatorFor(context, binding.option).count += 1;
		return;
	}
	applyScalarValue(
		context,
		binding.option,
		binding.booleanValue,
		flag,
		argvElement,
		argvIndex,
		offset
	);
};

const addUnexpectedValueIssue = (
	context: ParseContext,
	binding: FlagBinding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	rawValue: string,
	offset?: number
): void => {
	markSpecified(context, binding.option);
	context.issues.push({
		code: 'UNEXPECTED_OPTION_VALUE',
		message: `Flag "${flag}" does not accept a value.`,
		option: binding.option.option,
		rawValue,
		...location(flag, argvElement, argvIndex, offset)
	});
};

const parseLong = (
	context: ParseContext,
	argvIndex: number,
	argvElement: string
): boolean => {
	const separatorIndex = argvElement.indexOf('=');
	const hasInlineValue = separatorIndex !== -1;
	const flag = hasInlineValue
		? argvElement.slice(0, separatorIndex)
		: argvElement;
	const inlineValue = hasInlineValue
		? argvElement.slice(separatorIndex + 1)
		: undefined;
	if (!LONG_FLAG_PATTERN.test(flag)) {
		context.issues.push({
			code: 'INVALID_FLAG_SYNTAX',
			message: `Invalid long flag syntax in "${argvElement}".`,
			argvElement,
			argvIndex
		});
		return false;
	}
	const binding = context.compiled.longBindings[flag];
	if (binding === undefined) {
		recordUnknownFlag(
			context,
			flag,
			argvElement,
			argvIndex,
			undefined,
			inlineValue,
			hasInlineValue
		);
		return false;
	}
	if (binding.kind !== 'value') {
		if (hasInlineValue) {
			addUnexpectedValueIssue(
				context,
				binding,
				flag,
				argvElement,
				argvIndex,
				inlineValue ?? ''
			);
		} else {
			applyBooleanOrCount(context, binding, flag, argvElement, argvIndex);
		}
		return false;
	}
	const option = binding.option;
	markSpecified(context, option);
	if (hasInlineValue) {
		applyExplicitValue(
			context,
			option,
			flag,
			argvElement,
			argvIndex,
			undefined,
			inlineValue ?? '',
			argvIndex,
			true
		);
		return false;
	}
	if (option.valueMode === 'optional-inline') {
		applyImplicitValue(context, option, flag, argvElement, argvIndex);
		return false;
	}
	const next = context.argv[argvIndex + 1];
	if (next === undefined || next === '--') {
		addMissingValueIssue(context, option, flag, argvElement, argvIndex);
		return false;
	}
	applyExplicitValue(
		context,
		option,
		flag,
		argvElement,
		argvIndex,
		undefined,
		next,
		argvIndex + 1,
		false
	);
	return true;
};

const parseShort = (
	context: ParseContext,
	argvIndex: number,
	argvElement: string
): boolean => {
	for (let offset = 1; offset < argvElement.length; offset += 1) {
		const member = argvElement[offset];
		if (member === undefined || !SHORT_MEMBER_PATTERN.test(member)) {
			context.issues.push({
				code: 'INVALID_FLAG_SYNTAX',
				message: `Invalid short flag syntax in "${argvElement}" at offset ${String(offset)}.`,
				argvElement,
				argvIndex,
				offset
			});
			return false;
		}
		const flag = `-${member}`;
		const binding = context.compiled.shortBindings[flag];
		if (binding === undefined) {
			recordUnknownFlag(
				context,
				flag,
				argvElement,
				argvIndex,
				offset,
				undefined,
				false
			);
			continue;
		}
		const suffix = argvElement.slice(offset + 1);
		if (binding.kind !== 'value') {
			if (suffix.startsWith('=')) {
				addUnexpectedValueIssue(
					context,
					binding,
					flag,
					argvElement,
					argvIndex,
					suffix.slice(1),
					offset
				);
				return false;
			}
			applyBooleanOrCount(
				context,
				binding,
				flag,
				argvElement,
				argvIndex,
				offset
			);
			continue;
		}
		const option = binding.option;
		markSpecified(context, option);
		if (suffix.length > 0) {
			const rawValue = suffix.startsWith('=') ? suffix.slice(1) : suffix;
			applyExplicitValue(
				context,
				option,
				flag,
				argvElement,
				argvIndex,
				offset,
				rawValue,
				argvIndex,
				true
			);
			return false;
		}
		if (option.valueMode === 'optional-inline') {
			applyImplicitValue(
				context,
				option,
				flag,
				argvElement,
				argvIndex,
				offset
			);
			return false;
		}
		const next = context.argv[argvIndex + 1];
		if (next === undefined || next === '--') {
			addMissingValueIssue(
				context,
				option,
				flag,
				argvElement,
				argvIndex,
				offset
			);
			return false;
		}
		applyExplicitValue(
			context,
			option,
			flag,
			argvElement,
			argvIndex,
			offset,
			next,
			argvIndex + 1,
			false
		);
		return true;
	}
	return false;
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
			values[option.option] =
				option.kind === 'value'
					? snapshotDefault(option)
					: option.defaultValue;
		}
	}
	return Object.freeze(values);
};

const freezeUnknownFlags = (
	unknownFlags: readonly UnknownFlag[]
): readonly UnknownFlag[] =>
	Object.freeze(unknownFlags.map((unknown) => Object.freeze({ ...unknown })));

const freezeIssues = (issues: readonly ParseIssue[]): readonly ParseIssue[] =>
	Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));

/** Parses one argv vector with already-compiled definitions. */
export const parseCompiled = (
	compiled: CompiledDefinitions,
	settings?: ParseSettings
): RuntimeParseResult => {
	const normalized = normalizeParseSettings(settings);
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
	const context: ParseContext = {
		compiled,
		argv: normalized.argv,
		unknownFlagPolicy: normalized.unknownFlagPolicy,
		specified,
		accumulators,
		positionals: [],
		afterDoubleDash: [],
		unknownFlags: [],
		issues: []
	};

	let positionalOnly = false;
	for (let argvIndex = 0; argvIndex < context.argv.length; argvIndex += 1) {
		const argvElement = context.argv[argvIndex];
		if (argvElement === undefined) {
			throw new TypeError('Compiled argv unexpectedly contains a hole.');
		}
		if (argvElement === '--') {
			context.afterDoubleDash.push(...context.argv.slice(argvIndex + 1));
			break;
		}
		if (positionalOnly) {
			context.positionals.push(argvElement);
			continue;
		}
		let consumedNext = false;
		if (argvElement.startsWith('--')) {
			consumedNext = parseLong(context, argvIndex, argvElement);
		} else if (argvElement.startsWith('-') && argvElement !== '-') {
			consumedNext = parseShort(context, argvIndex, argvElement);
		} else {
			context.positionals.push(argvElement);
			if (normalized.flagPlacement === 'before-positionals') {
				positionalOnly = true;
			}
		}
		if (consumedNext) {
			argvIndex += 1;
		}
	}

	addMissingRequiredIssues(context);
	const common = {
		specified: Object.freeze(specified),
		positionals: Object.freeze([...context.positionals]),
		afterDoubleDash: Object.freeze([...context.afterDoubleDash]),
		unknownFlags: freezeUnknownFlags(context.unknownFlags)
	};
	if (context.issues.length > 0) {
		return Object.freeze({
			success: false,
			...common,
			issues: freezeIssues(context.issues)
		});
	}
	return Object.freeze({
		success: true,
		...common,
		values: materializeValues(context)
	});
};
