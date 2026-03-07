# argv-flags

Schema-driven CLI flag parser with stable issue codes and machine-readable results.

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

## Documentation

- [Docs index](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/index.md)
- [Tutorial: first CLI with exit codes](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/tutorial/first-cli.md)
- [Reference: options](https://github.com/Ismail-elkorchi/argv-flags/blob/main/docs/reference/options.md)

## Verification

```sh
npm run examples:run
npm run check:fast
npm run check
```

## License

MIT
