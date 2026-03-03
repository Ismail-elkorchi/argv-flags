# argv-flags

Schema-based CLI flag parsing with deterministic, machine-readable results.

## What it is

`argv-flags` parses command-line tokens against an explicit schema and returns typed values plus stable issue codes.

## Install

```sh
npm install argv-flags
deno add jsr:@ismail-elkorchi/argv-flags
```

## Quickstart

```ts
import { defineSchema, parseArgs } from "argv-flags";

const schema = defineSchema({
  src: { type: "string", flags: ["--src"], required: true },
  dest: { type: "string", flags: ["--dest"], required: true },
  verbose: { type: "boolean", flags: ["--verbose"], default: false },
});

const result = parseArgs(schema, { argv: ["--src", "a.txt", "--dest", "b.txt"] });

if (!result.ok) {
  console.error(result.issues);
  process.exitCode = 1;
}

console.log(result.values.src, result.values.dest);
```

## Options reference

- [Options reference](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/reference/options.md)
- [10-minute tutorial: first CLI](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/tutorial/first-cli.md)

## When not to use

- You only need ad-hoc parsing for a one-off script.
- You need subcommand routing or interactive prompts.
- You target CommonJS or Node < 24.

## When to use

- You need deterministic parsing with stable issue codes.
- You want the same schema on Node, Deno, and Bun.
- You need machine-readable results for automation.

## Compatibility

- Module system: ESM-only.
- Runtimes: Node `>=24`, current Deno, current Bun.
- JSON schema workflows use `readFileSync(...); JSON.parse(...)` (no JSON import attributes required).

## Links

- [Docs index](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/index.md)
- Reference:
  - [Reference index](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/reference/index.md)
  - [Parse-result JSON schema](https://github.com/Ismail-elkorchi/argv-flags/blob/main/schema/parse-result.schema.json)
  - [Security policy](https://github.com/Ismail-elkorchi/argv-flags/blob/main/SECURITY.md)
- How-to:
  - [First CLI tutorial](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/tutorial/first-cli.md)
  - [How-to index](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/how-to/index.md)
  - [Contributing](https://github.com/Ismail-elkorchi/argv-flags/blob/main/CONTRIBUTING.md)
- Explanation: [explanation index](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/explanation/index.md)

## Verification

```sh
npm run examples:run
npm run check:fast
npm run check
```

## License

MIT
