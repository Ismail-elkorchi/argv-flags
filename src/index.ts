import { copyArrayData } from './value-guards.ts';
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
import { compileDefinitions, composeDefinitions, type CompiledDefinitions } from './definitions.ts';
export { DefinitionError } from './definition-error.ts';
import { decodeCompiled, parseCompiled } from './parser.ts';
import { createArgvCursor as createCursor, scanCompiled, scanNextCompiled } from './scanner.ts';
import type {
	ArgvCursor,
	ArgvSpan,
	DecodeSettings,
	ArgvScan,
	BooleanOptionDefinition,
	CountOptionDefinition,
	CustomValueParserCallbacks,
	DefinitionIssue,
	ExactOptionDefinitions,
	ExactScanSettings,
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
	ScanIssue,
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
	ArgvCursor,
	ArgvSpan,
	DecodeSettings,
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
	ScanIssue,
	ScanSettings,
	ScalarValueOptionDefinition,
	UnknownFlag,
	ValueOf,
	ValueParseContext,
	ValueParseResult,
	ValueParser,
	ValueType
};

const parserDefinitions = new WeakMap<object, CompiledDefinitions>();

function parserFromCompiled<Definitions extends OptionDefinitions>(compiled: CompiledDefinitions): Parser<Definitions> {
	const scan = ((settings?: ScanSettings) => scanCompiled(compiled, settings)) as Parser<Definitions>['scan'];
	const parse = ((settings?: ParseSettings) => parseCompiled(compiled, settings)) as Parser<Definitions>['parse'];
	const decode = ((cursor: ArgvCursor, settings?: DecodeSettings) => decodeCompiled(compiled, cursor, settings)) as Parser<Definitions>['decode'];
	const parser = Object.freeze({ scan, parse, decode, scanNext: (cursor: ArgvCursor) => scanNextCompiled(compiled, cursor) });
	parserDefinitions.set(parser, compiled);
	return parser;
}

/** Adopts an argv vector once for scope-aware classification. */
export const createArgvCursor = <const Settings extends ScanSettings = ScanSettings>(
	settings?: ExactScanSettings<Settings>
): ArgvCursor => createCursor(settings);

/** Combines owned declarations without repeating value-parser or default compilation. */
export const composeParsers = (parsers: readonly Parser<OptionDefinitionMap>[]): Parser<OptionDefinitionMap> => {
	if (!Array.isArray(parsers)) throw new TypeError('Parser composition requires an array.');
	const owned = copyArrayData(parsers, 'Parser composition');
	const compiled: CompiledDefinitions[] = [];
	for (const parser of owned) {
		if (parser === null || typeof parser !== 'object') throw new TypeError('Composition requires owned parser handles.');
		const definitions = parserDefinitions.get(parser);
		if (definitions === undefined) throw new TypeError('Composition requires owned parser handles.');
		compiled.push(definitions);
	}
	return parserFromCompiled(composeDefinitions(compiled));
};

/** Validates inferred definitions once and returns a reusable immutable parser. */
export const createParser = <const Definitions extends OptionDefinitions>(
	definitions: Definitions & ExactOptionDefinitions<Definitions>
): Parser<Definitions> => parserFromCompiled<Definitions>(compileDefinitions(definitions));
