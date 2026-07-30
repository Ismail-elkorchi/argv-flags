/**
 * Typed cross-runtime CLI option parser.
 *
 * Terminology:
 * - An argument is one raw string in the input array.
 * - A flag is a literal CLI name such as `-v` or `--verbose`.
 * - An option is one logical configured value selected by one or more flags.
 */
import { compileDefinitions } from './definitions.ts';
export { DefinitionError } from './definition-error.ts';
import { parseCompiled } from './parser.ts';
import type {
	DefinitionIssue,
	DefinitionIssueCode,
	ExactOptionDefinitions,
	FlagName,
	OptionDefinition,
	OptionDefinitions,
	ParseIssue,
	ParseIssueCode,
	ParseResult,
	ParseSettings,
	Parser,
	UnknownArgument
} from './public-types.ts';

export type {
	DefinitionIssue,
	DefinitionIssueCode,
	FlagName,
	OptionDefinition,
	OptionDefinitions,
	ParseIssue,
	ParseIssueCode,
	ParseResult,
	ParseSettings,
	Parser,
	UnknownArgument
};

/**
 * Validates option definitions once and returns a reusable parser.
 *
 * @throws DefinitionError
 *
 * Thrown when definitions contain an invalid flag, conflicting flag, invalid
 * default, unsupported property, or another structural error.
 *
 * @example
 * ```ts
 * import { createParser } from "./index.ts";
 *
 * const parser = createParser({
 *   src: { type: "string", flags: ["--src"], required: true },
 *   verbose: {
 *     type: "boolean",
 *     flags: ["--verbose"],
 *     negatedFlag: "--no-verbose",
 *     default: false,
 *   },
 * });
 *
 * const result = parser.parse({
 *   args: ["--src", "input.txt", "--verbose"],
 * });
 *
 * if (result.success) {
 *   console.log(result.values.src);
 *   console.log(result.values.verbose);
 * }
 * ```
 *
 * @example
 * ```ts
 * import { createParser } from "./index.ts";
 *
 * const parser = createParser({
 *   include: {
 *     type: "string",
 *     flags: ["--include"],
 *     multiple: true,
 *   },
 * });
 *
 * const result = parser.parse({
 *   args: ["--include", "src", "--include=tests", "--", "--watch"],
 * });
 *
 * if (result.success) {
 *   console.log(result.values.include);
 *   console.log(result.argumentsAfterDoubleDash);
 * }
 * ```
 */
export const createParser = <const Definitions extends OptionDefinitions>(
	definitions: Definitions & ExactOptionDefinitions<Definitions>
): Parser<Definitions> => {
	const compiled = compileDefinitions(definitions);
	const parser: Parser<Definitions> = {
		parse(settings) {
			return parseCompiled(compiled, settings) as ParseResult<Definitions>;
		}
	};
	return Object.freeze(parser);
};
