# Breaking changes

This document records migrations between incompatible public releases.

## Version 3

Version 3 expands value parsing and conventional short-flag grammar, makes
value parsers interoperable, and exposes the scanner used by parsing. Version 2
names are removed rather than aliased.

- `ValueParser` is now a public structural interface. Code that fabricated or
  inspected the previous opaque value must implement `parse`, `accepts`, and
  `snapshot` instead. Parsers produced by `value` and `value.custom()` already
  conform.
- Compatible duplicate installations and npm/JSR editions can exchange value
  parsers; module identity is no longer part of the contract.
- Compiled parsers expose `scan()` with indexed recognized occurrences,
  arguments, unknown flags, post-`--` tokens, issues, and the terminator index.
- Collected unknown long flags can now include `suggestions`.

### Definitions

```ts
import { createParser, value } from "argv-flags";

const parser = createParser({
  output: { type: "string", flags: ["-o", "--output"], required: true },
  jobs: {
    type: value.integer({ minimum: 1 }),
    flags: ["-j", "--jobs"],
    default: 1,
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
  quiet: { type: "count", flags: ["-q"] },
});
```

- Replace boolean `negatedFlag: "--no-name"` with
  `falseFlags: ["--no-name"]`.
- Empty strings are rejected by `"string"`; use
  `value.string({ empty: "allow" })` when they are valid.
- `"number"` now accepts only finite decimal syntax. Use `"integer"` or
  `value.integer()` for safe integers.
- `multiple: true` works with every value parser and produces a readonly array.
- Scalar and boolean repetition uses `repeat: "error" | "first" | "last"`.
- `type: "count"` produces a number starting at zero.

### Parse settings and results

| Version 2 | Version 3 |
| --- | --- |
| `args` | `argv` |
| `allowUnknownFlags: false` | `unknownFlagPolicy: "error"` |
| `allowUnknownFlags: true` | `unknownFlagPolicy: "collect"` |
| `argumentsAfterDoubleDash` | `afterDoubleDash` |
| `unknownArguments` | `unknownFlags` |
| unknown `argument` | `argvElement` |
| unknown `index` | `argvIndex` |

`flagPlacement: "before-positionals"` stops recognizing flags after the
first positional argument. The default, `"interspersed"`, continues to parse
flags until `--`.

### Grammar and diagnostics

Short value flags now accept attached values (`-ofile` and `-o=file`) and can
end a cluster (`-abofile`). Boolean-only cluster restrictions are removed.
Optional-inline options use an `implicitValue` for bare flags and never consume
the next argv element.

| Version 2 | Version 3 |
| --- | --- |
| `MISSING_FLAG_VALUE` | `MISSING_OPTION_VALUE` |
| `INVALID_FLAG_VALUE` / `EMPTY_FLAG_VALUE` | `INVALID_OPTION_VALUE` |
| `UNEXPECTED_FLAG_VALUE` | `UNEXPECTED_OPTION_VALUE` |
| `DUPLICATE_OPTION` | `REPEATED_OPTION` |
| `UNSUPPORTED_DEFINITION_PROPERTY` | `UNSUPPORTED_OPTION_PROPERTY` |
| `INVALID_DEFINITION_PROPERTY` | `INVALID_OPTION_PROPERTY` |
| `CONFLICTING_DEFINITION_PROPERTIES` | `CONFLICTING_OPTION_PROPERTIES` |

Unknown long flags and rejected `value.choice()` inputs may include advisory
`suggestions`. Suggestions do not change whether parsing succeeds.

## Version 2

Version 2 replaces the schema-oriented procedural API with a compiled parser
and a smaller, stricter grammar.

### Create and reuse a parser

Before:

```ts
const schema = defineSchema(definitions);
const result = parseArgs(schema, { argv });
```

After:

```ts
const parser = createParser(definitions);
const result = parser.parse({ args });
```

`defineSchema`, `parseArgs`, the default export, and the public normalization
API were removed. There are no aliases.

### Result contract

| Version 1 | Version 2 |
| --- | --- |
| `ok` | `success` |
| `present` | `specified` |
| `rest` | `positionals` before `--` |
| post-`--` values in `rest` | `argumentsAfterDoubleDash` |
| `unknown: string[]` | indexed `unknownArguments` records |

Branch on `success` before reading the branch-specific data:

```ts
if (result.success) {
  use(result.values);
} else {
  report(result.issues);
}
```

Successful results contain `values` and no `issues`. Failed results contain
`issues` and no `values`; partial values and applied defaults are no longer
exposed.

Each allowed unknown flag is now:

```ts
{
  argument: "--other=value",
  flag: "--other",
  index: 3,
}
```

### Parse settings

| Version 1 | Version 2 |
| --- | --- |
| `argv` | `args` |
| `allowUnknown` | `allowUnknownFlags` |
| `stopAtDoubleDash` | removed |

`--` always ends parsing. Arguments after it are returned separately from
positionals.

### Option definitions

- The old `array` type is `{ type: "string", multiple: true }`.
- Multiple strings consume one value per flag occurrence.
- Explicit multiple values replace a default instead of appending to it.
- `allowNo` and derived `--no-*` flags were removed. Declare `negatedFlag`.
- `required: true` cannot be combined with `default`.
- Unknown and type-inappropriate definition fields are rejected.
- Definitions, flags, defaults, and lookup bindings are copied and frozen
  during compilation.
- Invalid definitions throw `DefinitionError` with structured `issues`.

The JSON Schema export, `toJsonResult`, `ParseResultJson`, and `JsonFlagValue`
were removed.

### Grammar

- Value-taking long flags accept `--name value` and `--name=value`.
- Value-taking short flags accept `-n value`; `-n=value` is invalid.
- Short clusters contain boolean flags only.
- Boolean flags consume no following value and reject inline values.
- A separate value may begin with `-`; only `--` interrupts consumption.
- Scalar duplicates are errors instead of successful warnings.
- Unknown flags never consume the following argument.
- Defaults are applied only after an error-free parse and only when absent.

### Parse issue codes

| Version 1 | Version 2 |
| --- | --- |
| `MISSING_VALUE` | `MISSING_FLAG_VALUE` |
| `INVALID_VALUE` | `INVALID_FLAG_VALUE` |
| boolean value rejection | `UNEXPECTED_FLAG_VALUE` |
| invalid short syntax | `INVALID_FLAG_SYNTAX` |
| `REQUIRED` | `MISSING_REQUIRED_OPTION` |
| `DUPLICATE` | `DUPLICATE_OPTION` |
| `EMPTY_VALUE` | `EMPTY_FLAG_VALUE` |

`UNKNOWN_FLAG` is unchanged. Severity was removed because every parse issue is
an error. Argument-related issues distinguish the parsed `flag` from the
complete raw `argument` and retain its index.
