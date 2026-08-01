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
 * if (result.success) {
 *   console.log(result.values.source);
 * }
 * ```
 *
 * @example Keep post-boundary input separate
 * ```ts
 * import { createParser } from "./index.ts";
 *
 * const parser = createParser({
 *   include: { type: "string", flags: ["--include"], multiple: true },
 * });
 * const result = parser.parse({
 *   argv: ["--include=src", "--", "--watch"],
 * });
 * if (result.success) {
 *   console.log(result.values.include);
 *   console.log(result.afterDoubleDash);
 * }
 * ```
 */
import { compileDefinitions } from './definitions.ts';
export { DefinitionError } from './definition-error.ts';
import { parseCompiled } from './parser.ts';
import type {
	CustomValueParserProtocol,
	DefinitionIssue,
	ExactOptionDefinitions,
	InferValues,
	OptionDefinitions,
	ParseFailure,
	ParseIssue,
	ParseResult,
	ParseSettings,
	ParseSuccess,
	ParsedValues,
	Parser,
	ParserResult,
	UnknownFlag,
	ValueParseContext,
	ValueParseResult,
	ValueParser
} from './public-types.ts';
export { value } from './value.ts';

export type {
	CustomValueParserProtocol,
	DefinitionIssue,
	InferValues,
	ParseFailure,
	ParseIssue,
	ParseResult,
	ParseSettings,
	ParseSuccess,
	ParsedValues,
	Parser,
	ParserResult,
	UnknownFlag,
	ValueParseContext,
	ValueParseResult,
	ValueParser
};

/** Validates definitions once and returns a reusable immutable parser. */
export const createParser = <const Definitions extends OptionDefinitions>(
	definitions: Definitions & ExactOptionDefinitions<Definitions>
): Parser<Definitions> => {
	const compiled = compileDefinitions(definitions);
	const parse = ((settings?: ParseSettings) =>
		parseCompiled(compiled, settings) as ParseResult<Definitions>) as Parser<Definitions>['parse'];
	return Object.freeze({ parse });
};
