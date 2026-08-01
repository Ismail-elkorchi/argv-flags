/**
 * Typed cross-runtime argv parsing.
 *
 * @example Parse reusable definitions
 * ```ts
 * import { createParser, value } from "./index.ts";
 *
 * const parser = createParser({
 *   source: { type: "string", flags: ["-s", "--source"], required: true },
 *   retries: { type: value.integer({ minimum: 0 }), flags: ["--retries"], default: 2 },
 *   verbose: {
 *     type: "boolean",
 *     flags: ["-v", "--verbose"],
 *     falseFlags: ["--no-verbose"],
 *   },
 * });
 *
 * const result = parser.parse({ argv: ["-sinput.txt", "--retries=3", "-v"] });
 * if (result.success) console.log(result.values.source);
 * ```
 */
import { compileDefinitions } from './definitions.ts';
export { DefinitionError } from './definition-error.ts';
import { parseCompiled } from './parser.ts';
import { scanCompiled } from './scanner.ts';
import type {
	ArgvScan,
	BooleanOptionDefinition,
	CountOptionDefinition,
	CustomValueParserCallbacks,
	DefinitionIssue,
	ExactOptionDefinitions,
	InferValues,
	MultipleValueOptionDefinition,
	OptionDefinition,
	OptionDefinitionMap,
	OptionDefinitions,
	ParseFailure,
	ParseIssue,
	ParseResult,
	ParseSettings,
	ParseSuccess,
	ParsedValues,
	Parser,
	ParserResult,
	RepeatPolicy,
	ScannedArgument,
	ScannedOption,
	ScanSettings,
	ScalarValueOptionDefinition,
	UnknownFlag,
	ValueOf,
	ValueParseContext,
	ValueParseResult,
	ValueParser,
	ValueType
} from './public-types.ts';
export { value } from './value.ts';

export type {
	ArgvScan,
	BooleanOptionDefinition,
	CountOptionDefinition,
	CustomValueParserCallbacks,
	DefinitionIssue,
	InferValues,
	MultipleValueOptionDefinition,
	OptionDefinition,
	OptionDefinitionMap,
	ParseFailure,
	ParseIssue,
	ParseResult,
	ParseSettings,
	ParseSuccess,
	ParsedValues,
	Parser,
	ParserResult,
	RepeatPolicy,
	ScannedArgument,
	ScannedOption,
	ScanSettings,
	ScalarValueOptionDefinition,
	UnknownFlag,
	ValueOf,
	ValueParseContext,
	ValueParseResult,
	ValueParser,
	ValueType
};

function compileParser<Definitions extends OptionDefinitions>(definitions: Definitions): Parser<Definitions> {
	const compiled = compileDefinitions(definitions);
	const scan = ((settings?: ScanSettings) =>
		scanCompiled(compiled, settings)) as Parser<Definitions>['scan'];
	const parse = ((settings?: ParseSettings) =>
		parseCompiled(compiled, settings) as ParseResult<Definitions>) as Parser<Definitions>['parse'];
	return Object.freeze({ scan, parse });
}

/** Validates inferred definitions once and returns a reusable immutable parser. */
export const createParser = <const Definitions extends OptionDefinitions>(
	definitions: Definitions & ExactOptionDefinitions<Definitions>
): Parser<Definitions> => compileParser(definitions);

/** Validates a definition map assembled dynamically by an integration. */
export const createParserFromMap = (definitions: OptionDefinitionMap): Parser<OptionDefinitionMap> =>
	compileParser(definitions);
