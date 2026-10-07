import { isLongFlag, isShortFlag } from './flag-grammar.ts';
import type {
	CompiledDefinitions,
	FlagBinding
} from './definitions.ts';
import type {
	ArgvCursor,
	ArgvSpan,
	ArgvScan,
	ScannedArgument,
	ScannedOption,
	ScanIssue,
	ScanSettings,
	UnknownFlag
} from './public-types.ts';
import { resolveRuntimeArgv } from './runtime.ts';
import { createSuggestions } from './suggestions.ts';
import {
	copyClosedRecord,
	hasOwn,
	copyStringArray
} from './value-guards.ts';

type ValueFlagBinding = Extract<FlagBinding, { readonly kind: 'value' }>;
type BooleanFlagBinding = Extract<FlagBinding, { readonly kind: 'boolean' }>;
type CountFlagBinding = Extract<FlagBinding, { readonly kind: 'count' }>;
type SwitchFlagBinding = BooleanFlagBinding | CountFlagBinding;

export type InternalScannedOption =
	| (Extract<ScannedOption, { readonly state: 'boolean' }> & {
			readonly binding: BooleanFlagBinding;
	  })
	| (Extract<ScannedOption, { readonly state: 'count' }> & {
			readonly binding: CountFlagBinding;
	  })
	| (Extract<ScannedOption, { readonly state: 'explicit-value' }> & {
			readonly binding: ValueFlagBinding;
	  })
	| (Extract<ScannedOption, { readonly state: 'implicit-value' | 'missing-value' }> & {
			readonly binding: ValueFlagBinding;
	  })
	| (Extract<ScannedOption, { readonly state: 'unexpected-value' }> & {
			readonly binding: SwitchFlagBinding;
	  });

export interface InternalArgvScan {
	readonly options: readonly InternalScannedOption[];
	readonly arguments: readonly ScannedArgument[];
	readonly afterDoubleDash: readonly ScannedArgument[];
	readonly doubleDashIndex?: number;
	readonly unknownFlags: readonly UnknownFlag[];
	readonly issues: readonly ScanIssue[];
}

interface ScanContext {
	readonly compiled: CompiledDefinitions;
	readonly argv: readonly string[];
	readonly options: InternalScannedOption[];
	readonly arguments: ScannedArgument[];
	readonly afterDoubleDash: ScannedArgument[];
	doubleDashIndex?: number;
	readonly unknownFlags: UnknownFlag[];
	readonly issues: ScanIssue[];
}


const normalizeOwnedScanSettings = (
	owned: Readonly<Record<PropertyKey, unknown>>
): { readonly argv: readonly string[]; readonly flagPlacement: 'interspersed' | 'before-positionals' } => {
	const argv = hasOwn(owned, 'argv')
		? copyStringArray(owned['argv'], 'Scan argv')
		: resolveRuntimeArgv();
	if (argv === undefined) {
		throw new TypeError('Scan setting "argv" must be a dense string array.');
	}
	const flagPlacement = hasOwn(owned, 'flagPlacement')
		? owned['flagPlacement']
		: 'interspersed';
	if (flagPlacement !== 'interspersed' && flagPlacement !== 'before-positionals') {
		throw new TypeError(
			'Scan setting "flagPlacement" must be "interspersed" or "before-positionals".'
		);
	}
	return { argv, flagPlacement };
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

const optionBase = <Binding extends FlagBinding>(
	binding: Binding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): {
	readonly binding: Binding;
	readonly option: string;
	readonly flag: string;
	readonly argvElement: string;
	readonly argvIndex: number;
	readonly offset?: number;
} => ({
	binding,
	option: binding.option.option,
	...source(flag, argvElement, argvIndex, offset)
});

const addSwitch = (
	context: ScanContext,
	binding: SwitchFlagBinding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	if (binding.kind === 'boolean') {
		context.options.push({
			...optionBase(binding, flag, argvElement, argvIndex, offset),
			state: 'boolean'
		});
		return;
	}
	context.options.push({
		...optionBase(binding, flag, argvElement, argvIndex, offset),
		state: 'count'
	});
};

const addExplicitValue = (
	context: ScanContext,
	binding: ValueFlagBinding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset: number | undefined,
	rawValue: string,
	valueArgvIndex: number,
	inline: boolean
): void => {
	context.options.push({
		...optionBase(binding, flag, argvElement, argvIndex, offset),
		state: 'explicit-value',
		rawValue,
		valueArgvIndex,
		inline
	});
};

const addImplicitValue = (
	context: ScanContext,
	binding: ValueFlagBinding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	context.options.push({
		...optionBase(binding, flag, argvElement, argvIndex, offset),
		state: 'implicit-value'
	});
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
	binding: ValueFlagBinding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): void => {
	context.options.push({
		...optionBase(binding, flag, argvElement, argvIndex, offset),
		state: 'missing-value'
	});
	context.issues.push({
		code: 'MISSING_OPTION_VALUE',
		message: `Flag "${flag}" requires a value.`,
		option: binding.option.option,
		...source(flag, argvElement, argvIndex, offset)
	});
};

const addUnexpectedValue = (
	context: ScanContext,
	binding: SwitchFlagBinding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	rawValue: string,
	offset?: number
): void => {
	context.options.push({
		...optionBase(binding, flag, argvElement, argvIndex, offset),
		state: 'unexpected-value',
		rawValue,
		valueArgvIndex: argvIndex,
		inline: true
	});
	context.issues.push({
		code: 'UNEXPECTED_OPTION_VALUE',
		message: `Flag "${flag}" does not accept a value.`,
		option: binding.option.option,
		rawValue,
		...source(flag, argvElement, argvIndex, offset)
	});
};

/** Handles value flags without a syntactically attached value. */
const scanUnattachedValue = (
	context: ScanContext,
	binding: ValueFlagBinding,
	flag: string,
	argvElement: string,
	argvIndex: number,
	offset?: number
): boolean => {
	if (binding.option.valueMode === 'optional-inline') {
		addImplicitValue(context, binding, flag, argvElement, argvIndex, offset);
		return false;
	}
	const next = context.argv[argvIndex + 1];
	if (next === undefined || next === '--') {
		addMissingValue(context, binding, flag, argvElement, argvIndex, offset);
		return false;
	}
	addExplicitValue(context, binding, flag, argvElement, argvIndex, offset, next, argvIndex + 1, false);
	return true;
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
	if (!isLongFlag(flag)) {
		context.issues.push({
			code: 'INVALID_FLAG_SYNTAX',
			message: `Invalid long flag syntax in "${argvElement}".`,
			argvElement,
			argvIndex
		});
		return false;
	}
	const binding = context.compiled.bindings[flag];
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
			addSwitch(context, binding, flag, argvElement, argvIndex);
		}
		return false;
	}
	if (hasInlineValue) {
		addExplicitValue(
			context,
			binding,
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
	return scanUnattachedValue(context, binding, flag, argvElement, argvIndex);
};

const scanShort = (
	context: ScanContext,
	argvIndex: number,
	argvElement: string
): boolean => {
	for (let offset = 1; offset < argvElement.length; offset += 1) {
		const member = argvElement[offset];
		if (member === undefined || !isShortFlag(`-${member}`)) {
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
		const binding = context.compiled.bindings[flag];
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
			addSwitch(context, binding, flag, argvElement, argvIndex, offset);
			continue;
		}
		if (suffix.length > 0) {
			const rawValue = suffix.startsWith('=') ? suffix.slice(1) : suffix;
			addExplicitValue(
				context,
				binding,
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
		return scanUnattachedValue(context, binding, flag, argvElement, argvIndex, offset);
	}
	return false;
};

interface CursorState {
	completed?: InternalArgvScan;
	readonly argv: readonly string[];
	readonly flagPlacement: 'interspersed' | 'before-positionals';
	index: number;
	positionalOnly: boolean;
	readonly options: InternalScannedOption[];
	readonly arguments: ScannedArgument[];
	readonly afterDoubleDash: ScannedArgument[];
	doubleDashIndex?: number;
	readonly unknownFlags: UnknownFlag[];
	readonly issues: ScanIssue[];
}

const cursors = new WeakMap<ArgvCursor, CursorState>();

/** Adopts argv once for a scope-aware traversal. */
export const createArgvCursor = (settings?: ScanSettings): ArgvCursor =>
	createArgvCursorFromOwnedSettings(settings === undefined
		? {}
		: copyClosedRecord(settings, ['argv', 'flagPlacement'], 'Scan settings'));

/** Internal entry point after the calling API has adopted its settings record. */
export const createArgvCursorFromOwnedSettings = (
	owned: Readonly<Record<PropertyKey, unknown>>
): ArgvCursor => {
	const normalized = normalizeOwnedScanSettings(owned);
	const state: CursorState = {
		...normalized, index: 0, positionalOnly: false,
		options: [], arguments: [], afterDoubleDash: [], unknownFlags: [], issues: []
	};
	const cursor = Object.freeze({
		ownership: Symbol('ArgvCursor'),
		argv: state.argv,
		get index() { return state.index; },
		get done() { return state.index === state.argv.length; }
	}) as ArgvCursor;
	cursors.set(cursor, state);
	return cursor;
};

const cursorState = (cursor: ArgvCursor): CursorState => {
	const state = cursors.get(cursor);
	if (state === undefined) throw new TypeError('Expected an owned argv cursor.');
	return state;
};

const freezeEntries = <Entry extends object>(entries: Entry[]): readonly Entry[] => {
	for (const entry of entries) Object.freeze(entry);
	return Object.freeze(entries);
};

const freezeScan = (context: Pick<ScanContext,
	'options' | 'arguments' | 'afterDoubleDash' | 'doubleDashIndex' | 'unknownFlags' | 'issues'
>): InternalArgvScan => Object.freeze({
	options: freezeEntries(context.options),
	arguments: freezeEntries(context.arguments),
	afterDoubleDash: freezeEntries(context.afterDoubleDash),
	...(context.doubleDashIndex === undefined ? {} : { doubleDashIndex: context.doubleDashIndex }),
	unknownFlags: freezeEntries(context.unknownFlags),
	issues: freezeEntries(context.issues)
});

const projectScan = (result: InternalArgvScan): ArgvScan => Object.freeze({
	...result,
	options: Object.freeze(result.options.map(({ binding: _binding, ...option }) => Object.freeze(option)))
});

/** Advances owned classification without materializing a public span. */
export const advanceCompiled = (compiled: CompiledDefinitions, cursor: ArgvCursor): void => {
	const state = cursorState(cursor);
	if (state.index === state.argv.length) throw new TypeError('Argv cursor is already complete.');
	const startIndex = state.index;
	const argvElement = state.argv[startIndex];
	if (argvElement === undefined) throw new TypeError('Owned argv unexpectedly contains a hole.');
	const context: ScanContext = {
		...state, compiled
	};
	let consumedNext = false;
	if (argvElement === '--') {
		context.doubleDashIndex = startIndex;
		state.doubleDashIndex = startIndex;
		for (let index = startIndex + 1; index < state.argv.length; index += 1) {
			const value = state.argv[index];
			if (value !== undefined) context.afterDoubleDash.push({ value, argvIndex: index });
		}
		state.index = state.argv.length;
	} else {
		if (state.positionalOnly) {
			context.arguments.push({ value: argvElement, argvIndex: startIndex });
		} else if (argvElement.startsWith('--')) {
			consumedNext = scanLong(context, startIndex, argvElement);
		} else if (argvElement.startsWith('-') && argvElement !== '-') {
			consumedNext = scanShort(context, startIndex, argvElement);
		} else {
			context.arguments.push({ value: argvElement, argvIndex: startIndex });
			if (state.flagPlacement === 'before-positionals') state.positionalOnly = true;
		}
		state.index += consumedNext ? 2 : 1;
	}
};

/** Advances exactly one argv span with the current option scope. */
export const scanNextCompiled = (compiled: CompiledDefinitions, cursor: ArgvCursor): ArgvSpan => {
	const state = cursorState(cursor);
	const startIndex = state.index;
	const optionsStart = state.options.length;
	const argumentsStart = state.arguments.length;
	const afterDoubleDashStart = state.afterDoubleDash.length;
	const unknownFlagsStart = state.unknownFlags.length;
	const issuesStart = state.issues.length;
	advanceCompiled(compiled, cursor);
	const result = freezeScan({
		options: state.options.slice(optionsStart),
		arguments: state.arguments.slice(argumentsStart),
		afterDoubleDash: state.afterDoubleDash.slice(afterDoubleDashStart),
		unknownFlags: state.unknownFlags.slice(unknownFlagsStart),
		issues: state.issues.slice(issuesStart),
		...(state.doubleDashIndex === startIndex ? { doubleDashIndex: startIndex } : {})
	});
	return Object.freeze({ ...projectScan(result), startIndex, endIndex: state.index });
};

/** Reads completed owned classification; never rereads argv text. */
export const completedScan = (cursor: ArgvCursor): InternalArgvScan => {
	const state = cursorState(cursor);
	if (state.index !== state.argv.length) throw new TypeError('Argv cursor must be complete before decoding.');
	state.completed ??= freezeScan(state);
	return state.completed;
};

/** Classifies argv using the same cursor traversal as parsing and routing. */
export const scanCompiled = (compiled: CompiledDefinitions, settings?: ScanSettings): ArgvScan => {
	const cursor = createArgvCursor(settings);
	while (!cursor.done) advanceCompiled(compiled, cursor);
	return projectScan(completedScan(cursor));
};
