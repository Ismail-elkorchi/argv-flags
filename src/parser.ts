import type {
	CompiledDefinitions,
	CompiledMultipleStringOption,
	CompiledOption,
	FlagBinding,
	RuntimeOptionValue
} from './definitions.ts';
import type {
	ParseIssue,
	ParseSettings,
	UnknownArgument
} from './public-types.ts';
import { resolveRuntimeArguments } from './runtime.ts';
import { hasOwn, isPlainRecord, isStringArray } from './value-guards.ts';

interface InternalParseResultBase {
	specified: Record<string, boolean>;
	positionals: string[];
	argumentsAfterDoubleDash: string[];
	unknownArguments: UnknownArgument[];
}

interface InternalParseSuccess extends InternalParseResultBase {
	success: true;
	values: Record<string, RuntimeOptionValue>;
}

interface InternalParseFailure extends InternalParseResultBase {
	success: false;
	issues: ParseIssue[];
}

type InternalParseResult = InternalParseSuccess | InternalParseFailure;

interface NormalizedParseSettings {
	args: string[];
	allowUnknownFlags: boolean;
}

interface ParseContext {
	readonly compiled: CompiledDefinitions;
	readonly args: readonly string[];
	readonly allowUnknownFlags: boolean;
	readonly parsedValues: Map<string, RuntimeOptionValue>;
	readonly specified: Map<string, boolean>;
	readonly positionals: string[];
	readonly argumentsAfterDoubleDash: string[];
	readonly unknownArguments: UnknownArgument[];
	readonly issues: ParseIssue[];
}

type ArgumentClassification =
	| { kind: 'boundary' }
	| { kind: 'positional' }
	| { kind: 'long'; flag: string; attachedValue?: string }
	| { kind: 'short'; flag: string }
	| { kind: 'shortAttached'; flag: string }
	| { kind: 'shortCluster'; flags: string[] };

const normalizeParseSettings = (settings: ParseSettings | undefined): NormalizedParseSettings => {
	if (settings === undefined) {
		return {
			args: resolveRuntimeArguments(),
			allowUnknownFlags: false
		};
	}
	if (!isPlainRecord(settings)) {
		throw new TypeError('Parse settings must be a plain object.');
	}

	for (const property of Reflect.ownKeys(settings)) {
		if (
			typeof property !== 'string' ||
			(property !== 'args' && property !== 'allowUnknownFlags')
		) {
			throw new TypeError(`Parse settings have unsupported property "${String(property)}".`);
		}
	}

	const argsValue = settings['args'];
	const hasExplicitArguments = hasOwn(settings, 'args');
	let args: string[];
	if (hasExplicitArguments) {
		if (!isStringArray(argsValue)) {
			throw new TypeError('Parse setting "args" must be a string array.');
		}
		args = [...argsValue];
	} else {
		args = resolveRuntimeArguments();
	}
	const allowUnknownFlagsValue = settings['allowUnknownFlags'];
	if (
		hasOwn(settings, 'allowUnknownFlags') &&
		typeof allowUnknownFlagsValue !== 'boolean'
	) {
		throw new TypeError('Parse setting "allowUnknownFlags" must be a boolean.');
	}

	return {
		args,
		allowUnknownFlags: allowUnknownFlagsValue === true
	};
};

const classifyArgument = (argument: string): ArgumentClassification => {
	if (argument === '--') {
		return { kind: 'boundary' };
	}
	if (!argument.startsWith('-') || argument === '-') {
		return { kind: 'positional' };
	}
	if (argument.startsWith('--')) {
		const separatorIndex = argument.indexOf('=');
		if (separatorIndex === -1) {
			return { kind: 'long', flag: argument };
		}
		return {
			kind: 'long',
			flag: argument.slice(0, separatorIndex),
			attachedValue: argument.slice(separatorIndex + 1)
		};
	}
	if (argument.length === 2) {
		return { kind: 'short', flag: argument };
	}
	if (argument.includes('=')) {
		return { kind: 'shortAttached', flag: argument.slice(0, 2) };
	}
	return {
		kind: 'shortCluster',
		flags: Array.from(argument.slice(1), (character) => `-${character}`)
	};
};

const isFiniteNumberArgument = (argument: string): boolean =>
	argument.length > 0 &&
	argument.trim().length > 0 &&
	Number.isFinite(Number(argument));

const cloneDefault = (option: CompiledOption): RuntimeOptionValue | undefined => {
	if (option.defaultValue === undefined) {
		return undefined;
	}
	return option.type === 'string' && option.multiple
		? [...option.defaultValue]
		: option.defaultValue;
};

const ensureMultipleValue = (
	context: ParseContext,
	option: CompiledMultipleStringOption
): string[] => {
	const existing = context.parsedValues.get(option.option);
	if (Array.isArray(existing)) {
		return existing;
	}
	const created: string[] = [];
	context.parsedValues.set(option.option, created);
	return created;
};

const recordUnknownFlag = (
	context: ParseContext,
	argument: string,
	flag: string,
	index: number
): void => {
	const unknownArgument = { argument, flag, index };
	if (context.allowUnknownFlags) {
		context.unknownArguments.push(unknownArgument);
		return;
	}
	context.issues.push({
		code: 'UNKNOWN_FLAG',
		message: `Unknown flag "${flag}".`,
		...unknownArgument
	});
};

const markSpecified = (
	context: ParseContext,
	option: CompiledOption,
	flag: string,
	argument: string,
	index: number
): void => {
	if (
		context.specified.get(option.option) === true &&
		!(option.type === 'string' && option.multiple)
	) {
		context.issues.push({
			code: 'DUPLICATE_OPTION',
			message: `Option "${option.option}" was specified more than once.`,
			option: option.option,
			flag,
			argument,
			index
		});
	}
	context.specified.set(option.option, true);
};

const applyBooleanBinding = (
	context: ParseContext,
	binding: Extract<FlagBinding, { kind: 'boolean' }>,
	argument: string,
	flag: string,
	index: number
): void => {
	markSpecified(context, binding.option, flag, argument, index);
	context.parsedValues.set(binding.option.option, binding.value);
};

const readSeparateValue = (
	args: readonly string[],
	index: number
): { value?: string; consumedNext: boolean } => {
	const nextArgument = args[index + 1];
	if (nextArgument === undefined || nextArgument === '--') {
		return { consumedNext: false };
	}
	return { value: nextArgument, consumedNext: true };
};

const applyValueBinding = (
	context: ParseContext,
	binding: Extract<FlagBinding, { kind: 'value' }>,
	index: number,
	argument: string,
	flag: string,
	attachedValue: string | undefined
): boolean => {
	const option = binding.option;
	markSpecified(context, option, flag, argument, index);
	const valueResult =
		attachedValue === undefined
			? readSeparateValue(context.args, index)
			: { value: attachedValue, consumedNext: false };
	const value = valueResult.value;

	if (value === undefined) {
		context.issues.push({
			code: 'MISSING_FLAG_VALUE',
			message: `Flag "${flag}" requires a ${option.type} value.`,
			option: option.option,
			flag,
			argument,
			index
		});
		return false;
	}

	if (option.type === 'number') {
		if (!isFiniteNumberArgument(value)) {
			context.issues.push({
				code: 'INVALID_FLAG_VALUE',
				message: `Flag "${flag}" received invalid number value "${value}".`,
				option: option.option,
				flag,
				argument,
				value,
				index
			});
		} else {
			context.parsedValues.set(option.option, Number(value));
		}
		return valueResult.consumedNext;
	}

	if (value.length === 0 && !option.allowEmpty) {
		context.issues.push({
			code: 'EMPTY_FLAG_VALUE',
			message: `Flag "${flag}" does not allow an empty value.`,
			option: option.option,
			flag,
			argument,
			value: '',
			index
		});
	} else if (option.multiple) {
		ensureMultipleValue(context, option).push(value);
	} else {
		context.parsedValues.set(option.option, value);
	}
	return valueResult.consumedNext;
};

const parseSingleFlag = (
	context: ParseContext,
	index: number,
	argument: string,
	flag: string,
	attachedValue: string | undefined
): boolean => {
	const binding = context.compiled.flagBindings[flag];
	if (binding === undefined) {
		recordUnknownFlag(context, argument, flag, index);
		return false;
	}

	if (binding.kind === 'boolean') {
		markSpecified(context, binding.option, flag, argument, index);
		if (attachedValue !== undefined) {
			context.issues.push({
				code: 'UNEXPECTED_FLAG_VALUE',
				message: `Boolean flag "${flag}" does not accept a value.`,
				option: binding.option.option,
				flag,
				argument,
				value: attachedValue,
				index
			});
		} else {
			context.parsedValues.set(binding.option.option, binding.value);
		}
		return false;
	}

	return applyValueBinding(
		context,
		binding,
		index,
		argument,
		flag,
		attachedValue
	);
};

const parseShortCluster = (
	context: ParseContext,
	index: number,
	argument: string,
	flags: readonly string[]
): void => {
	for (const flag of flags) {
		const binding = context.compiled.flagBindings[flag];
		if (binding === undefined) {
			recordUnknownFlag(context, argument, flag, index);
			continue;
		}
		if (binding.kind === 'value') {
			markSpecified(context, binding.option, flag, argument, index);
			context.issues.push({
				code: 'INVALID_FLAG_SYNTAX',
				message: `Value-taking flag "${flag}" cannot appear in short cluster "${argument}".`,
				option: binding.option.option,
				flag,
				argument,
				index,
				syntax: 'NON_BOOLEAN_SHORT_CLUSTER'
			});
			continue;
		}
		applyBooleanBinding(context, binding, argument, flag, index);
	}
};

const addMissingRequiredIssues = (context: ParseContext): void => {
	for (const option of context.compiled.options) {
		if (context.specified.get(option.option) === true || !option.required) {
			continue;
		}
		const primaryFlag = option.flags[0];
		if (primaryFlag !== undefined) {
			context.issues.push({
				code: 'MISSING_REQUIRED_OPTION',
				message: `Required option "${option.option}" was not specified.`,
				option: option.option,
				flag: primaryFlag
			});
		}
	}
};

const materializeSuccessfulValues = (
	context: ParseContext
): Record<string, RuntimeOptionValue> => {
	const values = new Map(context.parsedValues);
	for (const option of context.compiled.options) {
		if (context.specified.get(option.option) !== true) {
			const defaultValue = cloneDefault(option);
			if (defaultValue !== undefined) {
				values.set(option.option, defaultValue);
			}
		}
		if (option.type === 'string' && option.multiple && !values.has(option.option)) {
			values.set(option.option, []);
		}
	}
	return Object.fromEntries(values);
};

/** Parses arguments with already-validated, compiled definitions. */
export const parseCompiled = (
	compiled: CompiledDefinitions,
	settings?: ParseSettings
): InternalParseResult => {
	const { args, allowUnknownFlags } = normalizeParseSettings(settings);
	const context: ParseContext = {
		compiled,
		args,
		allowUnknownFlags,
		parsedValues: new Map<string, RuntimeOptionValue>(),
		specified: new Map<string, boolean>(
			compiled.options.map((option) => [option.option, false])
		),
		positionals: [],
		argumentsAfterDoubleDash: [],
		unknownArguments: [],
		issues: []
	};

	let skipArgument = false;
	for (const [index, argument] of args.entries()) {
		if (skipArgument) {
			skipArgument = false;
			continue;
		}
		const classification = classifyArgument(argument);
		if (classification.kind === 'boundary') {
			context.argumentsAfterDoubleDash.push(...args.slice(index + 1));
			break;
		}

		switch (classification.kind) {
			case 'positional': {
				context.positionals.push(argument);
				break;
			}
			case 'long': {
				const consumedNext = parseSingleFlag(
					context,
					index,
					argument,
					classification.flag,
					classification.attachedValue
				);
				if (consumedNext) {
					skipArgument = true;
				}
				break;
			}
			case 'short': {
				const consumedNext = parseSingleFlag(
					context,
					index,
					argument,
					classification.flag,
					undefined
				);
				if (consumedNext) {
					skipArgument = true;
				}
				break;
			}
			case 'shortAttached': {
				const binding = context.compiled.flagBindings[classification.flag];
				if (binding === undefined) {
					recordUnknownFlag(
						context,
						argument,
						classification.flag,
						index
					);
					break;
				}
				markSpecified(
					context,
					binding.option,
					classification.flag,
					argument,
					index
				);
				context.issues.push({
					code: 'INVALID_FLAG_SYNTAX',
					message: `Short flag "${classification.flag}" does not support an attached value.`,
					option: binding.option.option,
					flag: classification.flag,
					argument,
					index,
					syntax: 'SHORT_ATTACHED_VALUE'
				});
				break;
			}
			case 'shortCluster': {
				parseShortCluster(
					context,
					index,
					argument,
					classification.flags
				);
				break;
			}
		}
	}

	addMissingRequiredIssues(context);
	const common = {
		specified: Object.fromEntries(context.specified),
		positionals: context.positionals,
		argumentsAfterDoubleDash: context.argumentsAfterDoubleDash,
		unknownArguments: context.unknownArguments
	};
	if (context.issues.length > 0) {
		return {
			success: false,
			...common,
			issues: context.issues
		};
	}

	return {
		success: true,
		...common,
		values: materializeSuccessfulValues(context)
	};
};
