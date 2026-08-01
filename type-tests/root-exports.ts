import type {
	// @ts-expect-error exactness helpers are internal
	ExactParseSettings,
	// @ts-expect-error definition helpers are internal
	OptionDefinition,
	// @ts-expect-error namespace support types are internal
	ValueNamespace,
	// @ts-expect-error custom result variants are internal
	ValueParseSuccess
} from 'argv-flags';

type InternalTypes = [
	ExactParseSettings,
	OptionDefinition,
	ValueNamespace,
	ValueParseSuccess
];
declare const internalTypes: InternalTypes;
void internalTypes;
