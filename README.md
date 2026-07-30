# argv-flags

Typed CLI option parsing for Node, Deno, and Bun.

## Install

```sh
npm install argv-flags
deno add jsr:@ismail-elkorchi/argv-flags
```

## Quickstart

```ts
import { createParser } from "argv-flags";

const parser = createParser({
  source: { type: "string", flags: ["-s", "--source"], required: true },
  retries: { type: "number", flags: ["--retries"], default: 2 },
  verbose: {
    type: "boolean",
    flags: ["-v", "--verbose"],
    negatedFlag: "--no-verbose",
    default: false,
  },
  include: {
    type: "string",
    flags: ["--include"],
    multiple: true,
  },
});

const result = parser.parse({
  args: ["--source", "input.txt", "--include=src", "-v"],
});

if (result.success) {
  console.log(result.values.source);
  console.log(result.values.include);
} else {
  console.error(result.issues);
  process.exitCode = 2;
}
```

`createParser()` validates and snapshots the definitions once. The returned
parser can parse any number of argument arrays without rebuilding its immutable
flag lookup.

## Grammar

- Long value flags accept `--name value` and `--name=value`.
- Short value flags accept `-n value`; `-n=value` is invalid.
- Short clusters such as `-abc` contain boolean flags only.
- Boolean flags never consume the following argument and reject inline values.
- Negation uses an explicitly declared `negatedFlag`.
- Every recognized value-taking occurrence consumes exactly one value.
- A separate value may begin with `-`; only `--` interrupts value consumption.
- Multiple strings require one flag occurrence per value.
- Repeating a scalar option is an error.
- `--` always ends parsing. Earlier positionals and later arguments are returned
  separately.
- Defaults apply only when an option is absent.
- Failed results contain diagnostics and never expose values or defaults.

Unknown flags are errors unless `allowUnknownFlags` is enabled. Collected
unknown flags retain the complete argument, parsed flag, and original index.

## Terminology

- An **argument** is one raw string in the input `args` array.
- A **flag** is a literal CLI name such as `-v` or `--verbose`.
- An **option** is one logical configured value selected by one or more flags.
- A **value** is the parsed string, number, boolean, or string array belonging
  to an option.
- A **positional** is an argument encountered before `--` that was not consumed.

## Compatibility

- ESM only.
- Node `>=24`, current Deno, and current Bun.
- No runtime dependencies.

## Documentation

- [Options, grammar, and parse settings](docs/reference/options.md)
- [Results and diagnostics](docs/reference/parse-result.md)
- [First CLI tutorial](docs/tutorial/first-cli.md)
- [Breaking changes](BREAKING_CHANGES.md)

## License

MIT
