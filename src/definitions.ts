import { DefinitionError } from './definition-error.ts';
import type { DefinitionIssue } from './public-types.ts';
import { hasOwn, isPlainRecord, isStringArray } from './value-guards.ts';

export type RuntimeOptionValue = string | boolean | number | string[];

interface CompiledOptionBase {
	readonly option: string;
	readonly flags: readonly string[];
	readonly required: boolean;
}

interface CompiledStringOption extends CompiledOptionBase {
	readonly type: 'string';
	readonly multiple: false;
	readonly allowEmpty: boolean;
	readonly defaultValue?: string;
}

export interface CompiledMultipleStringOption extends CompiledOptionBase {
	readonly type: 'string';
	readonly multiple: true;
	readonly allowEmpty: boolean;
	readonly defaultValue?: readonly string[];
}

interface CompiledBooleanOption extends CompiledOptionBase {
	readonly type: 'boolean';
	readonly defaultValue?: boolean;
}

interface CompiledNumberOption extends CompiledOptionBase {
	readonly type: 'number';
	readonly defaultValue?: number;
}

export type CompiledOption =
	| CompiledStringOption
	| CompiledMultipleStringOption
	| CompiledBooleanOption
	| CompiledNumberOption;

export type FlagBinding =
	| {
			readonly kind: 'boolean';
			readonly option: CompiledBooleanOption;
			readonly value: boolean;
	  }
	| {
			readonly kind: 'value';
			readonly option:
				| CompiledStringOption
				| CompiledMultipleStringOption
				| CompiledNumberOption;
	  };

export interface CompiledDefinitions {
	readonly options: readonly CompiledOption[];
	readonly flagBindings: Readonly<Record<string, FlagBinding>>;
}

interface BooleanOptionCompilation {
	readonly option: CompiledBooleanOption;
	readonly negatedFlag?: string;
}

const COMMON_PROPERTIES = ['type', 'flags', 'required', 'default'] as const;
const STRING_PROPERTIES = [
	...COMMON_PROPERTIES,
	'multiple',
	'allowEmpty'
] as const;
const BOOLEAN_PROPERTIES = [...COMMON_PROPERTIES, 'negatedFlag'] as const;
const NUMBER_PROPERTIES = COMMON_PROPERTIES;

const isFlagName = (flag: string): boolean =>
	/^-[A-Za-z0-9]$/u.test(flag) || /^--[A-Za-z][A-Za-z0-9-]*$/u.test(flag);

const invalidProperty = (
	issues: DefinitionIssue[],
	option: string,
	property: string,
	message: string
): void => {
	issues.push({
		code: 'INVALID_DEFINITION_PROPERTY',
		message,
		option,
		property
	});
};

const readFlags = (
	option: string,
	value: unknown,
	issues: DefinitionIssue[]
): readonly string[] | undefined => {
	if (!Array.isArray(value) || value.length === 0) {
		invalidProperty(
			issues,
			option,
			'flags',
			`Option "${option}" must define at least one flag.`
		);
		return undefined;
	}

	const issueCount = issues.length;
	const flags: string[] = [];
	const seen = new Set<string>();
	for (const [flagIndex, candidate] of value.entries()) {
		if (typeof candidate !== 'string') {
			issues.push({
				code: 'INVALID_FLAG',
				message: `Option "${option}" has a non-string flag at index ${String(flagIndex)}.`,
				option,
				property: 'flags',
				flagIndex
			});
			continue;
		}
		if (!isFlagName(candidate)) {
			issues.push({
				code: 'INVALID_FLAG',
				message: `Option "${option}" has invalid flag "${candidate}". Use one dash with one alphanumeric character or two dashes with a long name.`,
				option,
				property: 'flags',
				flag: candidate,
				flagIndex
			});
			continue;
		}
		if (seen.has(candidate)) {
			issues.push({
				code: 'DUPLICATE_FLAG',
				message: `Option "${option}" repeats flag "${candidate}".`,
				option,
				flag: candidate,
				conflictingOption: option
			});
			continue;
		}
		seen.add(candidate);
		flags.push(candidate);
	}

	return issues.length === issueCount ? Object.freeze(flags) : undefined;
};

const validateProperties = (
	option: string,
	definition: Record<string, unknown>,
	allowed: readonly string[],
	issues: DefinitionIssue[]
): void => {
	for (const property of Reflect.ownKeys(definition)) {
		if (typeof property !== 'string' || !allowed.includes(property)) {
			const propertyName = String(property);
			issues.push({
				code: 'UNSUPPORTED_DEFINITION_PROPERTY',
				message: `Option "${option}" has unsupported property "${propertyName}".`,
				option,
				property: propertyName
			});
		}
	}
};

const readRequired = (
	option: string,
	definition: Record<string, unknown>,
	issues: DefinitionIssue[]
): boolean | undefined => {
	if (!hasOwn(definition, 'required')) {
		return false;
	}
	const required = definition['required'];
	if (typeof required !== 'boolean') {
		invalidProperty(
			issues,
			option,
			'required',
			`Option "${option}" property "required" must be a boolean.`
		);
		return undefined;
	}
	if (required && hasOwn(definition, 'default')) {
		issues.push({
			code: 'CONFLICTING_DEFINITION_PROPERTIES',
			message: `Option "${option}" cannot combine "required" with "default".`,
			option,
			properties: ['required', 'default']
		});
		return undefined;
	}
	return required;
};

const compileStringOption = (
	option: string,
	definition: Record<string, unknown>,
	flags: readonly string[],
	required: boolean,
	issues: DefinitionIssue[]
): CompiledStringOption | CompiledMultipleStringOption | undefined => {
	const hasMultiple = hasOwn(definition, 'multiple');
	const multipleValue = hasMultiple ? definition['multiple'] : undefined;
	const validMultiple = !hasMultiple || typeof multipleValue === 'boolean';
	if (!validMultiple) {
		invalidProperty(
			issues,
			option,
			'multiple',
			`Option "${option}" property "multiple" must be a boolean.`
		);
	}
	const hasAllowEmpty = hasOwn(definition, 'allowEmpty');
	const allowEmptyValue = hasAllowEmpty ? definition['allowEmpty'] : undefined;
	const validAllowEmpty =
		!hasAllowEmpty || typeof allowEmptyValue === 'boolean';
	if (!validAllowEmpty) {
		invalidProperty(
			issues,
			option,
			'allowEmpty',
			`Option "${option}" property "allowEmpty" must be a boolean.`
		);
	}
	if (!validMultiple || !validAllowEmpty) {
		return undefined;
	}

	const multiple = multipleValue === true;
	const hasDefault = hasOwn(definition, 'default');
	const defaultValue = hasDefault ? definition['default'] : undefined;

	if (multiple) {
		let immutableDefault: readonly string[] | undefined;
		if (hasDefault) {
			if (!isStringArray(defaultValue)) {
				invalidProperty(
					issues,
					option,
					'default',
					`Option "${option}" default must be a string array.`
				);
				return undefined;
			}
			immutableDefault = Object.freeze([...defaultValue]);
		}
		return Object.freeze({
			option,
			type: 'string',
			flags,
			required,
			multiple: true,
			allowEmpty: allowEmptyValue === true,
			...(immutableDefault === undefined ? {} : { defaultValue: immutableDefault })
		});
	}

	let stringDefault: string | undefined;
	if (hasDefault) {
		if (typeof defaultValue !== 'string') {
			invalidProperty(
				issues,
				option,
				'default',
				`Option "${option}" default must be a string.`
			);
			return undefined;
		}
		stringDefault = defaultValue;
	}

	return Object.freeze({
		option,
		type: 'string',
		flags,
		required,
		multiple: false,
		allowEmpty: allowEmptyValue === true,
		...(stringDefault === undefined ? {} : { defaultValue: stringDefault })
	});
};

const compileBooleanOption = (
	option: string,
	definition: Record<string, unknown>,
	flags: readonly string[],
	required: boolean,
	issues: DefinitionIssue[]
): BooleanOptionCompilation | undefined => {
	const issueCount = issues.length;
	const hasDefault = hasOwn(definition, 'default');
	const defaultValue = hasDefault ? definition['default'] : undefined;
	let booleanDefault: boolean | undefined;
	if (hasDefault) {
		if (typeof defaultValue !== 'boolean') {
			invalidProperty(
				issues,
				option,
				'default',
				`Option "${option}" default must be a boolean.`
			);
		} else {
			booleanDefault = defaultValue;
		}
	}

	const hasNegatedFlag = hasOwn(definition, 'negatedFlag');
	const negatedFlagValue = hasNegatedFlag ? definition['negatedFlag'] : undefined;
	let negatedFlag: string | undefined;
	if (hasNegatedFlag) {
		if (typeof negatedFlagValue !== 'string') {
			invalidProperty(
				issues,
				option,
				'negatedFlag',
				`Option "${option}" property "negatedFlag" must be a string.`
			);
		} else if (!isFlagName(negatedFlagValue)) {
			issues.push({
				code: 'INVALID_FLAG',
				message: `Option "${option}" has invalid flag "${negatedFlagValue}". Use one dash with one alphanumeric character or two dashes with a long name.`,
				option,
				property: 'negatedFlag',
				flag: negatedFlagValue
			});
		} else if (flags.includes(negatedFlagValue)) {
			issues.push({
				code: 'DUPLICATE_FLAG',
				message: `Option "${option}" cannot use flag "${negatedFlagValue}" as both a positive and negated flag.`,
				option,
				flag: negatedFlagValue,
				conflictingOption: option
			});
		} else {
			negatedFlag = negatedFlagValue;
		}
	}
	if (issues.length !== issueCount) {
		return undefined;
	}

	return {
		option: Object.freeze({
			option,
			type: 'boolean',
			flags,
			required,
			...(booleanDefault === undefined
				? {}
				: { defaultValue: booleanDefault })
		}),
		...(negatedFlag === undefined ? {} : { negatedFlag })
	};
};

const compileNumberOption = (
	option: string,
	definition: Record<string, unknown>,
	flags: readonly string[],
	required: boolean,
	issues: DefinitionIssue[]
): CompiledNumberOption | undefined => {
	const hasDefault = hasOwn(definition, 'default');
	const defaultValue = hasDefault ? definition['default'] : undefined;
	let numberDefault: number | undefined;
	if (hasDefault) {
		if (typeof defaultValue !== 'number' || !Number.isFinite(defaultValue)) {
			invalidProperty(
				issues,
				option,
				'default',
				`Option "${option}" default must be a finite number.`
			);
			return undefined;
		}
		numberDefault = defaultValue;
	}

	return Object.freeze({
		option,
		type: 'number',
		flags,
		required,
		...(numberDefault === undefined ? {} : { defaultValue: numberDefault })
	});
};

const registerFlags = (
	compiled: CompiledOption,
	negatedFlag: string | undefined,
	flagBindings: Record<string, FlagBinding>,
	issues: DefinitionIssue[]
): boolean => {
	const candidates = [
		...compiled.flags,
		...(negatedFlag === undefined ? [] : [negatedFlag])
	];
	let hasConflict = false;
	for (const flag of candidates) {
		const existing = flagBindings[flag];
		if (existing !== undefined) {
			hasConflict = true;
			issues.push({
				code: 'DUPLICATE_FLAG',
				message: `Flag "${flag}" for option "${compiled.option}" is already assigned to option "${existing.option.option}".`,
				option: compiled.option,
				flag,
				conflictingOption: existing.option.option
			});
		}
	}
	if (hasConflict) {
		return false;
	}

	if (compiled.type === 'boolean') {
		for (const flag of compiled.flags) {
			flagBindings[flag] = Object.freeze({
				kind: 'boolean',
				option: compiled,
				value: true
			});
		}
		if (negatedFlag !== undefined) {
			flagBindings[negatedFlag] = Object.freeze({
				kind: 'boolean',
				option: compiled,
				value: false
			});
		}
		return true;
	}

	for (const flag of compiled.flags) {
		flagBindings[flag] = Object.freeze({ kind: 'value', option: compiled });
	}
	return true;
};

/** Validates and compiles option definitions into immutable parser-only data. */
export const compileDefinitions = (input: unknown): CompiledDefinitions => {
	if (!isPlainRecord(input)) {
		throw new DefinitionError([
			{
				code: 'INVALID_DEFINITIONS',
				message: 'Option definitions must be a plain object.'
			}
		]);
	}

	const issues: DefinitionIssue[] = [];
	const options: CompiledOption[] = [];
	const flagBindings: Record<string, FlagBinding> = Object.create(null) as Record<
		string,
		FlagBinding
	>;

	for (const optionKey of Reflect.ownKeys(input)) {
		if (typeof optionKey !== 'string') {
			issues.push({
				code: 'INVALID_OPTION_NAME',
				message: `Option name "${String(optionKey)}" must be a string.`,
				option: String(optionKey)
			});
			continue;
		}
		const option = optionKey;
		const issueCountBeforeOption = issues.length;
		if (option.length === 0) {
			issues.push({
				code: 'INVALID_OPTION_NAME',
				message: 'Option names must not be empty.',
				option
			});
			continue;
		}

		const rawDefinition = input[option];
		if (!isPlainRecord(rawDefinition)) {
			issues.push({
				code: 'INVALID_OPTION_DEFINITION',
				message: `Definition for option "${option}" must be a plain object.`,
				option
			});
			continue;
		}

		const type = hasOwn(rawDefinition, 'type') ? rawDefinition['type'] : undefined;
		if (type !== 'string' && type !== 'boolean' && type !== 'number') {
			issues.push({
				code: 'INVALID_OPTION_TYPE',
				message: `Option "${option}" has invalid type.`,
				option
			});
			continue;
		}

		const allowedProperties =
			type === 'string'
				? STRING_PROPERTIES
				: type === 'boolean'
					? BOOLEAN_PROPERTIES
					: NUMBER_PROPERTIES;
		validateProperties(option, rawDefinition, allowedProperties, issues);

		const flags = readFlags(
			option,
			hasOwn(rawDefinition, 'flags') ? rawDefinition['flags'] : undefined,
			issues
		);
		const required = readRequired(option, rawDefinition, issues);
		let compiled: CompiledOption | undefined;
		let negatedFlag: string | undefined;
		if (type === 'string') {
			compiled = compileStringOption(
				option,
				rawDefinition,
				flags ?? [],
				required ?? false,
				issues
			);
		} else if (type === 'boolean') {
			const booleanCompilation = compileBooleanOption(
				option,
				rawDefinition,
				flags ?? [],
				required ?? false,
				issues
			);
			compiled = booleanCompilation?.option;
			negatedFlag = booleanCompilation?.negatedFlag;
		} else {
			compiled = compileNumberOption(
				option,
				rawDefinition,
				flags ?? [],
				required ?? false,
				issues
			);
		}
		if (
			compiled === undefined ||
			flags === undefined ||
			required === undefined ||
			issues.length !== issueCountBeforeOption
		) {
			continue;
		}

		if (registerFlags(compiled, negatedFlag, flagBindings, issues)) {
			options.push(compiled);
		}
	}

	if (issues.length > 0) {
		throw new DefinitionError(issues);
	}

	return Object.freeze({
		options: Object.freeze(options),
		flagBindings: Object.freeze(flagBindings)
	});
};
