# Options, grammar, and parse settings

## Option definitions

`createParser()` accepts a plain or null-prototype object keyed by logical option
name. Every definition contains:

- `type`: `"string"`, `"number"`, or `"boolean"`;
- `flags`: a non-empty array of unique literal flag names;
- optional `required`: whether the option must occur;
- optional `default`: a value used only when the option is absent.

`required: true` and `default` cannot be combined. Definition objects are
closed: unknown fields are TypeScript errors and runtime compilation errors.

Definitions are validated and copied when the parser is created. Later changes
to the input object, its flag arrays, or its default arrays do not affect the
parser.

### String options

```ts
const parser = createParser({
  output: {
    type: "string",
    flags: ["-o", "--output"],
    allowEmpty: false,
  },
});
```

Set `multiple: true` to collect one value from each occurrence:

```ts
const parser = createParser({
  include: {
    type: "string",
    flags: ["--include"],
    multiple: true,
    default: ["src"],
  },
});
```

Explicit values replace the default rather than appending to it. An absent
multiple string option without a default produces `[]`.

### Number options

Numbers must convert to finite JavaScript numbers.

```ts
const parser = createParser({
  retries: { type: "number", flags: ["-r", "--retries"], default: 2 },
});
```

Negative values work as separate arguments: `--retries -2`.

### Boolean options

A positive flag sets the option to `true`. `negatedFlag` explicitly declares
the flag that sets it to `false`.

```ts
const parser = createParser({
  color: {
    type: "boolean",
    flags: ["-c", "--color"],
    negatedFlag: "--no-color",
    default: true,
  },
});
```

Boolean flags consume no value. `--color=false` is invalid; use the declared
negated flag.

## Flag names

- A short flag is one dash followed by one ASCII letter or digit: `-v`.
- A long flag is two dashes followed by an ASCII letter, then ASCII letters,
  digits, or hyphens: `--dry-run`.
- `--` is reserved as the parsing boundary.
- Names cannot contain whitespace or inline values.
- Positive and negated flags must be unique across all definitions.

Invalid definitions throw `DefinitionError`. Its `issues` array contains
machine-readable definition issue codes and relevant fields such as `option`,
`property`, `flag`, and `conflictingOption`.

## Argument grammar

| Form | Behavior |
| --- | --- |
| `--long value` | A value-taking long flag consumes `value`. |
| `--long=value` | A value-taking long flag consumes the inline value. |
| `-s value` | A value-taking short flag consumes `value`. |
| `-s=value` | Invalid syntax for a declared short flag. |
| `-abc` | Expands to boolean flags `-a`, `-b`, and `-c`. |
| `--boolean` | Sets a declared boolean option. |
| `--boolean=value` | Invalid because booleans take no value. |
| `--` | Ends parsing and is not returned. |

A recognized string or number flag without an inline value consumes the next
argument verbatim, even when that argument begins with `-`. It reports
`MISSING_FLAG_VALUE` only at the end of the input or immediately before `--`.

Value-taking flags are invalid inside short clusters. Multiple string options
consume one value per occurrence. Repeated scalar strings, numbers, booleans,
and negated booleans produce `DUPLICATE_OPTION`.

Unknown flags never consume the next argument.

## Parse settings

```ts
interface ParseSettings {
  args?: readonly string[];
  allowUnknownFlags?: boolean;
}
```

- `args`: explicit arguments. When omitted, the parser uses
  `process.argv.slice(2)` on Node and Bun, then `Deno.args`, then `[]`.
- `allowUnknownFlags`: collects unrecognized flags in `unknownArguments`
  instead of producing `UNKNOWN_FLAG`.

Settings must be a plain or null-prototype object, and unknown settings are
rejected. `--` always ends parsing and is not configurable.
