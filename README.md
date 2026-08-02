# argv-flags

Turn argv into trustworthy typed options on Node, Deno, and Bun.

`argv-flags` compiles a small option definition into a reusable parser. It
handles flags, decoded values, short clusters, positional arguments, and `--`
with immutable results and structured diagnostics. Its focused parser API fits
CLI applications, reusable libraries, and command routers.

## Install

```sh
npm install argv-flags
bun add argv-flags
deno add jsr:@ismail-elkorchi/argv-flags
```

## Use

```ts
import { createParser, value } from "argv-flags";

const parser = createParser({
  source: { type: "string", flags: ["-s", "--source"], required: true },
  retries: {
    type: value.integer({ minimum: 0 }),
    flags: ["-r", "--retries"],
    default: 2,
  },
  color: {
    type: value.choice(["auto", "always", "never"]),
    flags: ["--color"],
    valueMode: "optional-inline",
    implicitValue: "auto",
  },
  verbose: {
    type: "boolean",
    flags: ["-v", "--verbose"],
    falseFlags: ["--no-verbose"],
  },
  include: { type: "string", flags: ["-I", "--include"], multiple: true },
  quiet: { type: "count", flags: ["-q"] },
});

const result = parser.parse();

if (result.success) {
  console.log(result.values);
  console.log(result.positionals);
  console.log(result.afterDoubleDash);
} else {
  console.error(result.issues);
  process.exitCode = 2;
}
```

`parse()` reads the current runtime's argv. Use
`parser.parse({ argv: ["--source", "input.txt"] })` for an explicit vector.
Definitions and parse settings are closed objects: misspelled or unsupported
properties fail in TypeScript and at runtime.

Libraries that compose definitions dynamically can type their assembled record
as `OptionDefinitionMap` and compile it with `createParserFromMap()`. Direct
callers should prefer `createParser()` because it preserves option-specific
value inference and rejects extra fields through variables. Composition
libraries can extend the exported scalar, multiple, boolean, and count
definition types with their own presentation metadata instead of reproducing
the option grammar.

Composition libraries can call `parser.scan()` to classify recognized option
spans, ordinary arguments, unknown flags, and the exact `--` location without
decoding values or applying defaults. `parse()` and `scan()` use the same
grammar implementation. Each occurrence has a `state` discriminant for
boolean, count, explicit, implicit, missing, or unexpected values.

`ValueParser` is a public structural interface. A value parser created by a
compatible second installation, bundle, or npm/JSR copy can be used in a
definition compiled by another copy. Implementations must remain synchronous
and expose their operations as data properties, not accessors. They must
validate and snapshot values according to that interface. Advertised raw
`choices` must be unique and must parse successfully.

## Grammar

- Long values use `--name value`, `--name=value`, or `--name=`.
- Short values use `-n value`, `-nvalue`, or `-n=value`.
- Boolean and count flags can be clustered: `-vvq`.
- A value-taking short flag owns the rest of its cluster: `-abofile` gives
  `file` to `-o` after processing `-a` and `-b`.
- A required separate value may begin with `-`; only the exact element `--`
  interrupts it.
- Optional-inline flags consume no following argv element.
- Unknown flags consume no following argv element.
- `--` always ends option parsing and later elements are returned in
  `afterDoubleDash`.

Scalar and boolean repetition defaults to an error. Choose `repeat: "first"`
or `repeat: "last"` when repetition is intentional. Set `multiple: true` to
collect every successfully decoded occurrence. Count options increment once
per occurrence.

## Values and errors

Built-in definitions accept `"string"`, `"number"`, and `"integer"`. The
`value` namespace adds configured strings, bounded numbers and safe integers,
literal choices, and synchronous custom parsers.

Successful results alone expose `values`; failed results expose structured
`issues` and never expose partial values or defaults. Unknown flags can either
produce issues or be collected with their original argv location.

## Runtime support

- ESM only
- Node.js 24 or later
- Deno 2.6 or later
- Bun 1.3 or later
- Zero runtime dependencies

## Documentation

- [Options, values, grammar, and parse settings](docs/reference/options.md)
- [Results and diagnostics](docs/reference/parse-result.md)
- [First CLI tutorial](docs/tutorial/first-cli.md)
- [Breaking changes across versions](BREAKING_CHANGES.md)

## License

MIT
