import { DefinitionError } from './definition-error.ts';
import type { DefinitionIssue, RepeatPolicy } from './public-types.ts';
import { getRuntimeValueParser, value, type RuntimeValueParser } from './value.ts';
import {
	assertOwnDataProperties,
	hasOwn,
	isPlainRecord,
	type PlainRecord
} from './value-guards.ts';

interface CompiledOptionBase {
	readonly option: string;
	readonly flags: readonly string[];
	readonly required: boolean;
}

export interface CompiledValueOption extends CompiledOptionBase {
	readonly kind: 'value';
	readonly parser: RuntimeValueParser;
	readonly multiple: boolean;
	readonly repeat: RepeatPolicy;
	readonly valueMode: 'required' | 'optional-inline';
	readonly implicitValue: unknown;
	readonly hasDefault: boolean;
	readonly defaultValue: unknown;
}

export interface CompiledBooleanOption extends CompiledOptionBase {
	readonly kind: 'boolean';
	readonly falseFlags: readonly string[];
	readonly repeat: RepeatPolicy;
	readonly hasDefault: boolean;
	readonly defaultValue: boolean | undefined;
}

export interface CompiledCountOption extends CompiledOptionBase {
	readonly kind: 'count';
}

export type CompiledOption =
	| CompiledValueOption
	| CompiledBooleanOption
	| CompiledCountOption;

interface ValueFlagBinding {
	readonly kind: 'value';
	readonly option: CompiledValueOption;
}

interface BooleanFlagBinding {
	readonly kind: 'boolean';
	readonly option: CompiledBooleanOption;
	readonly booleanValue: boolean;
}

interface CountFlagBinding {
	readonly kind: 'count';
	readonly option: CompiledCountOption;
}

export type FlagBinding =
	| ValueFlagBinding
	| BooleanFlagBinding
	| CountFlagBinding;

export interface CompiledDefinitions {
	readonly options: readonly CompiledOption[];
	readonly longBindings: Readonly<Record<string, FlagBinding>>;
	readonly shortBindings: Readonly<Record<string, FlagBinding>>;
	readonly longFlags: readonly string[];
}

interface RegisteredFlag {
	readonly option: string;
	readonly property: 'flags' | 'falseFlags';
}

const SHORT_FLAG_PATTERN = /^-[A-Za-z0-9]$/u;
const LONG_FLAG_PATTERN = /^--[A-Za-z0-9][A-Za-z0-9_-]*$/u;

const STRING_PARSER = getRuntimeValueParser(value.string());
const NUMBER_PARSER = getRuntimeValueParser(value.number());
const INTEGER_PARSER = getRuntimeValueParser(value.integer());

const VALUE_SCALAR_PROPERTIES = [
	'flags',
	'type',
	'multiple',
	'repeat',
	'required',
	'default',
	'valueMode',
	'implicitValue'
] as const;
const VALUE_MULTIPLE_PROPERTIES = [
	'flags',
	'type',
	'multiple',
	'required',
	'default',
	'valueMode',
	'implicitValue'
] as const;
const BOOLEAN_PROPERTIES = [
	'flags',
	'type',
	'falseFlags',
	'repeat',
	'required',
	'default'
] as const;
const COUNT_PROPERTIES = ['flags', 'type'] as const;
const ALL_PROPERTIES = [
	...VALUE_SCALAR_PROPERTIES,
	'falseFlags'
] as const;

const invalidProperty = (
	issues: DefinitionIssue[],
	option: string,
	property: string,
	message: string
): void => {
	issues.push({ code: 'INVALID_OPTION_PROPERTY', message, option, property });
};

const validateProperties = (
	option: string,
	definition: PlainRecord,
	allowed: readonly string[],
	issues: DefinitionIssue[]
): void => {
	for (const property of Reflect.ownKeys(definition)) {
		if (typeof property !== 'string' || !allowed.includes(property)) {
			issues.push({
				code: 'UNSUPPORTED_OPTION_PROPERTY',
				message: `Option "${option}" has unsupported property "${String(property)}".`,
				option,
				property
			});
		}
	}
};

const isFlagName = (flag: string): boolean =>
	SHORT_FLAG_PATTERN.test(flag) || LONG_FLAG_PATTERN.test(flag);

const readFlagList = (
	option: string,
	definition: PlainRecord,
	property: 'flags' | 'falseFlags',
	required: boolean,
	issues: DefinitionIssue[]
): readonly string[] | undefined => {
	if (!hasOwn(definition, property)) {
		if (required) {
			invalidProperty(
				issues,
				option,
				property,
				`Option "${option}" must define a non-empty "${property}" array.`
			);
		}
		return required ? undefined : Object.freeze([]);
	}
	const candidate = definition[property];
	if (!Array.isArray(candidate) || candidate.length === 0) {
		invalidProperty(
			issues,
			option,
			property,
			`Option "${option}" property "${property}" must be a non-empty array.`
		);
		return undefined;
	}
	const issueCount = issues.length;
	const flags: string[] = [];
	for (let flagIndex = 0; flagIndex < candidate.length; flagIndex += 1) {
		const flag: unknown = hasOwn(candidate, flagIndex)
			? candidate[flagIndex]
			: undefined;
		if (typeof flag !== 'string' || !isFlagName(flag)) {
			issues.push({
				code: 'INVALID_FLAG',
				message:
					typeof flag === 'string'
						? `Option "${option}" has invalid flag "${flag}".`
						: `Option "${option}" has a non-string flag at index ${String(flagIndex)}.`,
				option,
				property,
				flagIndex,
				...(typeof flag === 'string' ? { flag } : {})
			});
			continue;
		}
		flags.push(flag);
	}
	return issues.length === issueCount ? Object.freeze(flags) : undefined;
};

const readRequired = (
	option: string,
	definition: PlainRecord,
	issues: DefinitionIssue[]
): boolean => {
	if (!hasOwn(definition, 'required')) {
		return false;
	}
	const required = definition['required'];
	if (typeof required !== 'boolean') {
		invalidProperty(
			issues,
			option,
			'required',
			`Option "${option}" property "required" must be boolean.`
		);
		return false;
	}
	return required;
};

const readRepeat = (
	option: string,
	definition: PlainRecord,
	issues: DefinitionIssue[]
): RepeatPolicy => {
	if (!hasOwn(definition, 'repeat')) {
		return 'error';
	}
	const repeat = definition['repeat'];
	if (repeat !== 'error' && repeat !== 'first' && repeat !== 'last') {
		invalidProperty(
			issues,
			option,
			'repeat',
			`Option "${option}" property "repeat" must be "error", "first", or "last".`
		);
		return 'error';
	}
	return repeat;
};

const reportPresenceConflict = (
	option: string,
	definition: PlainRecord,
	required: boolean,
	issues: DefinitionIssue[]
): void => {
	if (required && hasOwn(definition, 'default')) {
		issues.push({
			code: 'CONFLICTING_OPTION_PROPERTIES',
			message: `Option "${option}" cannot combine "required" with "default".`,
			option,
			properties: ['required', 'default']
		});
	}
};

const resolveValueParser = (
	option: string,
	type: unknown,
	issues: DefinitionIssue[]
): RuntimeValueParser | undefined => {
	if (type === 'string') {
		return STRING_PARSER;
	}
	if (type === 'number') {
		return NUMBER_PARSER;
	}
	if (type === 'integer') {
		return INTEGER_PARSER;
	}
	const parser = getRuntimeValueParser(type);
	if (parser !== undefined) {
		return parser;
	}
	if (type !== null && typeof type === 'object') {
		issues.push({
			code: 'INVALID_VALUE_PARSER',
			message: `Option "${option}" type does not implement the ValueParser interface.`,
			option,
			property: 'type'
		});
	} else {
		invalidProperty(
			issues,
			option,
			'type',
			`Option "${option}" has an unsupported type.`
		);
	}
	return undefined;
};

const snapshotAccepted = (
	parser: RuntimeValueParser,
	candidate: unknown
): { readonly accepted: false } | { readonly accepted: true; readonly value: unknown } =>
	parser.accepts(candidate)
		? { accepted: true, value: parser.snapshot(candidate) }
		: { accepted: false };

const isDenseArray = (candidate: unknown): candidate is readonly unknown[] => {
	if (!Array.isArray(candidate)) {
		return false;
	}
	for (let index = 0; index < candidate.length; index += 1) {
		if (!hasOwn(candidate, index)) {
			return false;
		}
	}
	return true;
};

const readDefault = (
	option: string,
	definition: PlainRecord,
	parser: RuntimeValueParser,
	multiple: boolean,
	issues: DefinitionIssue[]
): { readonly hasDefault: boolean; readonly value: unknown } => {
	if (!hasOwn(definition, 'default')) {
		return { hasDefault: false, value: undefined };
	}
	const candidate = definition['default'];
	if (multiple) {
		if (!isDenseArray(candidate)) {
			issues.push({
				code: 'INVALID_DEFAULT',
				message: `Option "${option}" default must be a dense array.`,
				option,
				property: 'default'
			});
			return { hasDefault: true, value: undefined };
		}
		const snapshot: unknown[] = [];
		for (const element of candidate) {
			const accepted = snapshotAccepted(parser, element);
			if (!accepted.accepted) {
				issues.push({
					code: 'INVALID_DEFAULT',
					message: `Option "${option}" default contains an invalid value.`,
					option,
					property: 'default'
				});
				return { hasDefault: true, value: undefined };
			}
			snapshot.push(accepted.value);
		}
		return { hasDefault: true, value: Object.freeze(snapshot) };
	}
	const accepted = snapshotAccepted(parser, candidate);
	if (!accepted.accepted) {
		issues.push({
			code: 'INVALID_DEFAULT',
			message: `Option "${option}" default is invalid for its value parser.`,
			option,
			property: 'default'
		});
		return { hasDefault: true, value: undefined };
	}
	return { hasDefault: true, value: accepted.value };
};

const readValueInput = (
	option: string,
	definition: PlainRecord,
	parser: RuntimeValueParser,
	issues: DefinitionIssue[]
): {
	readonly mode: 'required' | 'optional-inline';
	readonly implicitValue: unknown;
} => {
	const hasMode = hasOwn(definition, 'valueMode');
	const mode = hasMode ? definition['valueMode'] : 'required';
	if (mode !== 'required' && mode !== 'optional-inline') {
		invalidProperty(
			issues,
			option,
			'valueMode',
			`Option "${option}" property "valueMode" must be "required" or "optional-inline".`
		);
	}
	const hasImplicit = hasOwn(definition, 'implicitValue');
	if (mode !== 'optional-inline') {
		if (hasImplicit) {
			issues.push({
				code: 'CONFLICTING_OPTION_PROPERTIES',
				message: `Option "${option}" cannot define "implicitValue" in required value mode.`,
				option,
				properties: ['valueMode', 'implicitValue']
			});
		}
		return { mode: 'required', implicitValue: undefined };
	}
	if (!hasImplicit) {
		invalidProperty(
			issues,
			option,
			'implicitValue',
			`Option "${option}" requires "implicitValue" in optional-inline mode.`
		);
		return { mode, implicitValue: undefined };
	}
	const accepted = snapshotAccepted(parser, definition['implicitValue']);
	if (!accepted.accepted) {
		invalidProperty(
			issues,
			option,
			'implicitValue',
			`Option "${option}" implicit value is invalid for its value parser.`
		);
		return { mode, implicitValue: undefined };
	}
	return { mode, implicitValue: accepted.value };
};

const compileValueOption = (
	option: string,
	definition: PlainRecord,
	parser: RuntimeValueParser,
	flags: readonly string[],
	issues: DefinitionIssue[]
): CompiledValueOption | undefined => {
	const multipleCandidate = hasOwn(definition, 'multiple')
		? definition['multiple']
		: false;
	if (multipleCandidate !== true && multipleCandidate !== false) {
		invalidProperty(
			issues,
			option,
			'multiple',
			`Option "${option}" property "multiple" must be boolean when present.`
		);
	}
	const multiple = multipleCandidate === true;
	validateProperties(
		option,
		definition,
		multiple ? VALUE_MULTIPLE_PROPERTIES : VALUE_SCALAR_PROPERTIES,
		issues
	);
	const issueCount = issues.length;
	const required = readRequired(option, definition, issues);
	reportPresenceConflict(option, definition, required, issues);
	const repeat = multiple ? 'error' : readRepeat(option, definition, issues);
	const input = readValueInput(option, definition, parser, issues);
	const defaultResult = readDefault(option, definition, parser, multiple, issues);
	if (issues.length !== issueCount) {
		return undefined;
	}
	return Object.freeze({
		kind: 'value',
		option,
		flags,
		required,
		parser,
		multiple,
		repeat,
		valueMode: input.mode,
		implicitValue: input.implicitValue,
		hasDefault: defaultResult.hasDefault,
		defaultValue: defaultResult.value
	});
};

const compileBooleanOption = (
	option: string,
	definition: PlainRecord,
	flags: readonly string[],
	issues: DefinitionIssue[]
): CompiledBooleanOption | undefined => {
	validateProperties(option, definition, BOOLEAN_PROPERTIES, issues);
	const issueCount = issues.length;
	const falseFlags = readFlagList(option, definition, 'falseFlags', false, issues);
	const required = readRequired(option, definition, issues);
	reportPresenceConflict(option, definition, required, issues);
	const repeat = readRepeat(option, definition, issues);
	const hasDefault = hasOwn(definition, 'default');
	const candidate = hasDefault ? definition['default'] : undefined;
	if (hasDefault && typeof candidate !== 'boolean') {
		issues.push({
			code: 'INVALID_DEFAULT',
			message: `Option "${option}" default must be boolean.`,
			option,
			property: 'default'
		});
	}
	if (issues.length !== issueCount || falseFlags === undefined) {
		return undefined;
	}
	return Object.freeze({
		kind: 'boolean',
		option,
		flags,
		falseFlags,
		required,
		repeat,
		hasDefault,
		defaultValue: typeof candidate === 'boolean' ? candidate : undefined
	});
};

const compileCountOption = (
	option: string,
	definition: PlainRecord,
	flags: readonly string[],
	issues: DefinitionIssue[]
): CompiledCountOption | undefined => {
	const issueCount = issues.length;
	validateProperties(option, definition, COUNT_PROPERTIES, issues);
	return issues.length === issueCount
		? Object.freeze({ kind: 'count', option, flags, required: false })
		: undefined;
};

const collectDuplicateFlags = (
	input: PlainRecord,
	issues: DefinitionIssue[]
): void => {
	const owners = new Map<string, RegisteredFlag>();
	for (const optionKey of Reflect.ownKeys(input)) {
		if (typeof optionKey !== 'string' || optionKey.length === 0) {
			continue;
		}
		const definition = input[optionKey];
		if (!isPlainRecord(definition)) {
			continue;
		}
		const properties: readonly ('flags' | 'falseFlags')[] =
			definition['type'] === 'boolean'
				? ['flags', 'falseFlags']
				: ['flags'];
		for (const property of properties) {
			const candidates = definition[property];
			if (!Array.isArray(candidates)) {
				continue;
			}
			for (let flagIndex = 0; flagIndex < candidates.length; flagIndex += 1) {
				const flag: unknown = hasOwn(candidates, flagIndex)
					? candidates[flagIndex]
					: undefined;
				if (typeof flag !== 'string' || !isFlagName(flag)) {
					continue;
				}
				const existing = owners.get(flag);
				if (existing === undefined) {
					owners.set(flag, { option: optionKey, property });
					continue;
				}
				issues.push({
					code: 'DUPLICATE_FLAG',
					message: `Flag "${flag}" for option "${optionKey}" is already assigned to option "${existing.option}".`,
					option: optionKey,
					property,
					flag,
					flagIndex,
					conflictingOption: existing.option,
					conflictingProperty: existing.property
				});
			}
		}
	}
};

const registerFlag = (
	flag: string,
	binding: FlagBinding,
	longBindings: Record<string, FlagBinding>,
	shortBindings: Record<string, FlagBinding>,
	longFlags: string[]
): void => {
	const frozenBinding = Object.freeze(binding);
	if (flag.startsWith('--')) {
		longBindings[flag] = frozenBinding;
		longFlags.push(flag);
	} else {
		shortBindings[flag] = frozenBinding;
	}
};

const registerOptionFlags = (
	option: CompiledOption,
	longBindings: Record<string, FlagBinding>,
	shortBindings: Record<string, FlagBinding>,
	longFlags: string[]
): void => {
	for (const flag of option.flags) {
		const binding: FlagBinding = option.kind === 'boolean'
			? { kind: 'boolean', option, booleanValue: true }
			: option.kind === 'count'
				? { kind: 'count', option }
				: { kind: 'value', option };
		registerFlag(
			flag,
			binding,
			longBindings,
			shortBindings,
			longFlags
		);
	}
	if (option.kind === 'boolean') {
		for (const flag of option.falseFlags) {
			registerFlag(
				flag,
				{ kind: 'boolean', option, booleanValue: false },
				longBindings,
				shortBindings,
				longFlags
			);
		}
	}
};

/** Validates and compiles definitions into immutable parser data. */
export const compileDefinitions = (input: unknown): CompiledDefinitions => {
	if (!isPlainRecord(input)) {
		throw new DefinitionError([
			{
				code: 'INVALID_DEFINITIONS',
				message: 'Option definitions must be an ordinary or null-prototype object.'
			}
		]);
	}
	assertOwnDataProperties(input, 'Option definitions');

	const issues: DefinitionIssue[] = [];
	const options: CompiledOption[] = [];
	for (const optionKey of Reflect.ownKeys(input)) {
		if (typeof optionKey !== 'string') {
			issues.push({
				code: 'INVALID_OPTION_NAME',
				message: `Option name "${String(optionKey)}" must be a non-empty string.`,
				option: optionKey
			});
			continue;
		}
		const option = optionKey;
		if (option.length === 0) {
			issues.push({
				code: 'INVALID_OPTION_NAME',
				message: 'Option names must not be empty.',
				option
			});
			continue;
		}
		const definition = input[option];
		if (!isPlainRecord(definition)) {
			issues.push({
				code: 'INVALID_OPTION_DEFINITION',
				message: `Definition for option "${option}" must be an ordinary or null-prototype object.`,
				option
			});
			continue;
		}
		assertOwnDataProperties(definition, `Definition for option "${option}"`);
		const issueCount = issues.length;
		const flags = readFlagList(option, definition, 'flags', true, issues);
		const type = hasOwn(definition, 'type') ? definition['type'] : undefined;
		let compiled: CompiledOption | undefined;
		if (type === 'boolean') {
			compiled = compileBooleanOption(option, definition, flags ?? [], issues);
		} else if (type === 'count') {
			compiled = compileCountOption(option, definition, flags ?? [], issues);
		} else {
			const parser = resolveValueParser(option, type, issues);
			if (parser !== undefined) {
				compiled = compileValueOption(option, definition, parser, flags ?? [], issues);
			} else {
				validateProperties(option, definition, ALL_PROPERTIES, issues);
			}
		}
		if (
			compiled !== undefined &&
			flags !== undefined &&
			issues.length === issueCount
		) {
			options.push(compiled);
		}
	}

	collectDuplicateFlags(input, issues);
	if (issues.length > 0) {
		throw new DefinitionError(issues);
	}

	const longBindings = Object.create(null) as Record<string, FlagBinding>;
	const shortBindings = Object.create(null) as Record<string, FlagBinding>;
	const longFlags: string[] = [];
	for (const option of options) {
		registerOptionFlags(
			option,
			longBindings,
			shortBindings,
			longFlags
		);
	}

	return Object.freeze({
		options: Object.freeze(options),
		longBindings: Object.freeze(longBindings),
		shortBindings: Object.freeze(shortBindings),
		longFlags: Object.freeze(longFlags)
	});
};
