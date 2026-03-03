# Options reference

This page lists all public option fields for schema entries and parsing.

## `FlagSpec` fields

```ts
interface FlagSpec<T extends FlagType = FlagType> {
  type: T;
  flags: readonly string[];
  required?: boolean;
  default?: FlagValue<T>;
  allowEmpty?: boolean;
  allowNo?: boolean;
}
```

- `type` (required): one of `string`, `boolean`, `number`, `array`.
- `flags` (required): one or more flag tokens; each token must start with `-` and have length `>= 2`.
- `required` (default: `false`): missing key reports `REQUIRED`.
- `default` (default: none): fallback value when the flag is not present.
- `allowEmpty` (default: `false`): allows empty values for string/array specs.
- `allowNo` (default: `true`): allows `--no-<flag>` for boolean specs.

## `ParseOptions` fields

```ts
interface ParseOptions {
  argv?: readonly string[];
  allowUnknown?: boolean;
  stopAtDoubleDash?: boolean;
}
```

- `argv` (default: runtime argv): uses `process.argv.slice(2)` when available (Node/Bun), otherwise `Deno.args`, otherwise `[]`.
- `allowUnknown` (default: `false`): unknown flags are captured in `result.unknown` instead of generating errors.
- `stopAtDoubleDash` (default: `true`): when enabled, `--` stops parsing and remaining tokens are emitted in `result.rest`.

## Example

```ts
import { defineSchema, parseArgs } from "argv-flags";

const schema = defineSchema({
  mode: { type: "string", flags: ["--mode"], required: true },
  verbose: { type: "boolean", flags: ["--verbose"], default: false },
});

const result = parseArgs(schema, {
  argv: ["--mode", "safe", "--extra", "1"],
  allowUnknown: true,
  stopAtDoubleDash: true,
});

console.log(result.values.mode); // "safe"
console.log(result.unknown); // ["--extra"]
console.log(result.rest); // ["1"]
```
