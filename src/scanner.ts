import type {
	CompiledDefinitions,
	FlagBinding
} from './definitions.ts';
import type {
	ArgvScan,
	ParseIssue,
	ScannedArgument,
	ScannedOption,
	ScanSettings,
	UnknownFlag
} from './public-types.ts';
import { resolveRuntimeArgv } from './runtime.ts';
import { createSuggestions } from './suggestions.ts';
import {
	assertOwnDataProperties,
	hasOwn,
	isDenseStringArray,
	isPlainRecord
} from './value-guards.ts';

export type ScannedOptionState =
	| 'switch'
	| 'explicit-value'
	| 'implicit-value'
	| 'missing-value'
	| 'unexpected-value';

interface InternalScannedOptionBase extends ScannedOption {
	readonly binding: FlagBinding;
}

export type InternalScannedOption =
	| (InternalScannedOptionBase & {
			readonly state: 'switch' | 'implicit-value' | 'missing-value';
	  })
	| (InternalScannedOptionBase & {
			readonly state: 'explicit-value';
			readonly rawValue: string;
			readonly valueArgvIndex: number;
			readonly inline: boolean;
	  })
	| (InternalScannedOptionBase & {
			readonly state: 'unexpected-value';
			readonly rawValue: string;
			readonly valueArgvIndex: number;
			readonly inline: boolean;
	  });

export interface InternalArgvScan {
	readonly options: readonly InternalScannedOption[];
	readonly arguments: readonly ScannedArgument[];
	readonly afterDoubleDash: readonly ScannedArgument[];
	readonly doubleDashIndex?: number;
	readonly unknownFlags: readonly UnknownFlag[];
	readonly issues: readonly ParseIssue[];
}

interface ScanContext {
	readonly compiled: CompiledDefinitions;
	readonly argv: readonly string[];
	readonly options: InternalScannedOption[];
	readonly arguments: ScannedArgument[];
	readonly afterDoubleDash: ScannedArgument[];
	doubleDashIndex?: number;
	readonly unknownFlags: UnknownFlag[];
	readonly issues: ParseIssue[];
}

const SHORT_MEMBER_PATTERN = /^[A-Za-z0-9]$/u;
const LONG_FLAG_PATTERN = /^--[A-Za-z0-9][A-Za-z0-9_-]*$/u;

const normalizeScanSettings = (
	settings: ScanSettings | undefined
): { readonly argv: readonly string[]; readonly flagPlacement: 'interspersed' | 'before-positionals' } => {
	if (settings === undefined) {
		return {
			argv: Object.freeze(resolveRuntimeArgv()),
			flagPlacement: 'interspersed'
		};
	}
	if (!isPlainRecord(settings)) {
		throw new TypeError('Scan settings must be an ordinary or null-prototype object.');
	}
	assertOwnDataProperties(settings, 'Scan settings');
	for (const property of Reflect.ownKeys(settings)) {
		if (
			typeof property !== 'string' ||
			(property !== 'argv' && property !== 'flagPlacement')
		) {
			throw new TypeError(
				`Scan settings have unsupported property "${String(property)}".`
			);
		}
	}
	const argv = hasOwn(settings, 'argv')
		? settings['argv']
		: resolveRuntimeArgv();
	if (!isDenseStringArray(argv)) {
		throw new TypeError('Scan setting "argv" must be a dense string array.');
	}
	const flagPlacement = hasOwn(settings, 'flagPlacement')
		? settings['flagPlacement']
		: 'interspersed';
	if (flagPlacement !== 'interspersed' && flagPlacement !== 'before-positionals') {
		throw new TypeError(
			'Scan setting "flagPlacement" must be "interspersed" or "before-positionals".'
		);
	}
	return { argv: Object.freeze([...argv]), flagPlacement };
};

const source = (
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

const addOption = (
	context: ScanContext,
	binding: FlagBinding,
	state: ScannedOptionState,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number,
	rawValue?: string,
	valueArgvIndex?: number,
	inline?: boolean
): void => {
	const common = {
		binding,
		option: binding.option.option,
		...source(flag, argvElement, argvIndex, offset)
	};
	if (state === 'explicit-value' || state === 'unexpected-value') {
		if (rawValue === undefined || valueArgvIndex === undefined || inline === undefined) {
			throw new TypeError('A scanned explicit value must retain its complete location.');
		}
		context.options.push({
			...common,
			state,
			rawValue,
			valueArgvIndex,
			inline
		});
		return;
	}
	context.options.push({ ...common, state });
};

const addUnknown = (
	context: ScanContext,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset: number | undefined,
	inlineValue: string | undefined,
	hasInlineValue: boolean
): void => {
	const suggestions = flag.startsWith('--')
		? createSuggestions(flag, context.compiled.longFlags, true)
		: Object.freeze([]);
	context.unknownFlags.push({
		...source(flag, argvElement, argvIndex, offset),
		...(hasInlineValue ? { inlineValue: inlineValue ?? '' } : {}),
		...(suggestions.length === 0 ? {} : { suggestions })
	});
};

const addMissingValue = (
	context: ScanContext,
	binding: Extract<FlagBinding, { readonly kind: 'value' }>,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	addOption(
		context,
		binding,
		'missing-value',
		flag,
		argvElement,
		argvIndex,
		offset
	);
	context.issues.push({
		code: 'MISSING_OPTION_VALUE',
		message: `Flag "${flag}" requires a value.`,
		option: binding.option.option,
		...source(flag, argvElement, argvIndex, offset)
	});
};

const addUnexpectedValue = (
	context: ScanContext,
	binding: Exclude<FlagBinding, { readonly kind: 'value' }>,
	flag: string,
	argvElement: string,
	argvIndex: number,
	rawValue: string,
	offset?: number
): void => {
	addOption(
		context,
		binding,
		'unexpected-value',
		flag,
		argvElement,
		argvIndex,
		offset,
		rawValue,
		argvIndex,
		true
	);
	context.issues.push({
		code: 'UNEXPECTED_OPTION_VALUE',
		message: `Flag "${flag}" does not accept a value.`,
		option: binding.option.option,
		rawValue,
		...source(flag, argvElement, argvIndex, offset)
	});
};

const scanLong = (
	context: ScanContext,
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
		addUnknown(
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
			addUnexpectedValue(
				context,
				binding,
				flag,
				argvElement,
				argvIndex,
				inlineValue ?? ''
			);
		} else {
			addOption(context, binding, 'switch', flag, argvElement, argvIndex);
		}
		return false;
	}
	if (hasInlineValue) {
		addOption(
			context,
			binding,
			'explicit-value',
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
	if (binding.option.valueMode === 'optional-inline') {
		addOption(context, binding, 'implicit-value', flag, argvElement, argvIndex);
		return false;
	}
	const next = context.argv[argvIndex + 1];
	if (next === undefined || next === '--') {
		addMissingValue(context, binding, flag, argvElement, argvIndex);
		return false;
	}
	addOption(
		context,
		binding,
		'explicit-value',
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

const scanShort = (
	context: ScanContext,
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
			addUnknown(context, flag, argvElement, argvIndex, offset, undefined, false);
			continue;
		}
		const suffix = argvElement.slice(offset + 1);
		if (binding.kind !== 'value') {
			if (suffix.startsWith('=')) {
				addUnexpectedValue(
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
			addOption(context, binding, 'switch', flag, argvElement, argvIndex, offset);
			continue;
		}
		if (suffix.length > 0) {
			const rawValue = suffix.startsWith('=') ? suffix.slice(1) : suffix;
			addOption(
				context,
				binding,
				'explicit-value',
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
		if (binding.option.valueMode === 'optional-inline') {
			addOption(
				context,
				binding,
				'implicit-value',
				flag,
				argvElement,
				argvIndex,
				offset
			);
			return false;
		}
		const next = context.argv[argvIndex + 1];
		if (next === undefined || next === '--') {
			addMissingValue(
				context,
				binding,
				flag,
				argvElement,
				argvIndex,
				offset
			);
			return false;
		}
		addOption(
			context,
			binding,
			'explicit-value',
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

const scan = (
	compiled: CompiledDefinitions,
	argv: readonly string[],
	flagPlacement: 'interspersed' | 'before-positionals'
): InternalArgvScan => {
	const context: ScanContext = {
		compiled,
		argv,
		options: [],
		arguments: [],
		afterDoubleDash: [],
		unknownFlags: [],
		issues: []
	};
	let positionalOnly = false;
	for (let argvIndex = 0; argvIndex < argv.length; argvIndex += 1) {
		const argvElement = argv[argvIndex];
		if (argvElement === undefined) {
			throw new TypeError('Compiled argv unexpectedly contains a hole.');
		}
		if (argvElement === '--') {
			context.doubleDashIndex = argvIndex;
			for (let index = argvIndex + 1; index < argv.length; index += 1) {
				const value = argv[index];
				if (value !== undefined) context.afterDoubleDash.push({ value, argvIndex: index });
			}
			break;
		}
		if (positionalOnly) {
			context.arguments.push({ value: argvElement, argvIndex });
			continue;
		}
		let consumedNext = false;
		if (argvElement.startsWith('--')) {
			consumedNext = scanLong(context, argvIndex, argvElement);
		} else if (argvElement.startsWith('-') && argvElement !== '-') {
			consumedNext = scanShort(context, argvIndex, argvElement);
		} else {
			context.arguments.push({ value: argvElement, argvIndex });
			if (flagPlacement === 'before-positionals') positionalOnly = true;
		}
		if (consumedNext) argvIndex += 1;
	}
	return Object.freeze({
		options: Object.freeze(context.options.map((option) => Object.freeze(option))),
		arguments: Object.freeze(context.arguments.map((argument) => Object.freeze(argument))),
		afterDoubleDash: Object.freeze(context.afterDoubleDash.map((argument) => Object.freeze(argument))),
		...(context.doubleDashIndex === undefined
			? {}
			: { doubleDashIndex: context.doubleDashIndex }),
		unknownFlags: Object.freeze(context.unknownFlags.map((flag) => Object.freeze(flag))),
		issues: Object.freeze(context.issues.map((issue) => Object.freeze(issue)))
	});
};

export const scanCompiledInternal = (
	compiled: CompiledDefinitions,
	argv: readonly string[],
	flagPlacement: 'interspersed' | 'before-positionals'
): InternalArgvScan => scan(compiled, argv, flagPlacement);

/** Classifies argv with the compiled option grammar without decoding values. */
export const scanCompiled = (
	compiled: CompiledDefinitions,
	settings?: ScanSettings
): ArgvScan => {
	const normalized = normalizeScanSettings(settings);
	const result = scan(compiled, normalized.argv, normalized.flagPlacement);
	return Object.freeze({
		options: Object.freeze(result.options.map(({ binding: _binding, state: _state, ...option }) => Object.freeze(option))),
		arguments: result.arguments,
		afterDoubleDash: result.afterDoubleDash,
		...(result.doubleDashIndex === undefined
			? {}
			: { doubleDashIndex: result.doubleDashIndex }),
		unknownFlags: result.unknownFlags,
		issues: result.issues
	});
};
