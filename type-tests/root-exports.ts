import type {
	// @ts-expect-error exactness helpers are internal
	ExactParseSettings,
	OptionDefinition,
	// @ts-expect-error namespace support types are internal
	ValueNamespace,
	// @ts-expect-error custom result variants are internal
	ValueParseSuccess
} from 'argv-flags';

type InternalTypes = [
	ExactParseSettings,
	ValueNamespace,
	ValueParseSuccess
];
declare const internalTypes: InternalTypes;
void internalTypes;

declare const optionDefinition: OptionDefinition;
void optionDefinition;
