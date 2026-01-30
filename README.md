# argv-flags

Schema-driven CLI flag parsing for Node.js 24+. Deterministic rules, typed output, and a machine-consumable result model.

## Install

```sh
npm install argv-flags
```

## Quick start

```js
import { defineSchema, parseArgs } from 'argv-flags';

const schema = defineSchema({
  src: { type: 'string', flags: ['--src'], required: true },
  dest: { type: 'string', flags: ['--dest'], required: true },
  exclude: { type: 'array', flags: ['--exclude'], default: [] },
  verbose: { type: 'boolean', flags: ['--verbose'], default: false }
});

const result = parseArgs(schema);

if (!result.ok) {
  console.error(result.issues);
  process.exitCode = 1;
}

console.log(result.values.src, result.values.dest);
```

## API

```ts
defineSchema<T extends Schema>(schema: T): T
parseArgs<T extends Schema>(schema: T, options?: ParseOptions): ParseResult<T>
```

### Schema

```ts
type FlagType = 'string' | 'boolean' | 'number' | 'array';

interface FlagSpec<T extends FlagType = FlagType> {
  type: T;
  flags: readonly string[];
  required?: boolean;
  default?: FlagValue<T>;
  allowEmpty?: boolean;
  allowNo?: boolean;
}
```

Notes:
- `flags` must include at least one flag token (`-x` or `--long`).
- `default` is cloned for arrays to avoid shared references.
- `allowNo` enables `--no-<flag>` for boolean specs (default: `true`).
- `allowEmpty` allows empty string/array values (default: `false`).

### Parse options

```ts
interface ParseOptions {
  argv?: readonly string[];
  allowUnknown?: boolean;
  stopAtDoubleDash?: boolean;
}
```

- `argv`: defaults to `process.argv.slice(2)`.
- `allowUnknown`: when `true`, unknown flags are collected instead of erroring.
- `stopAtDoubleDash`: when `true` (default), `--` stops flag parsing and the rest is returned as `rest`.

## Output contract (machine-readable)

```ts
interface ParseResult<S extends Schema> {
  values: { [K in keyof S]: FlagValue<S[K]['type']> | undefined };
  present: { [K in keyof S]: boolean };
  rest: string[];
  unknown: string[];
  issues: ParseIssue[];
  ok: boolean;
}
```

### `issues`

Each issue is explicit and stable:

```ts
type IssueCode =
  | 'UNKNOWN_FLAG'
  | 'MISSING_VALUE'
  | 'INVALID_VALUE'
  | 'REQUIRED'
  | 'DUPLICATE'
  | 'EMPTY_VALUE';

interface ParseIssue {
  code: IssueCode;
  severity: 'error' | 'warning';
  message: string;
  flag?: string;
  key?: string;
  value?: string;
  index?: number;
}
```

`ok` is `true` only when no `error`-severity issues exist.

## Parsing rules (deterministic)

Rules are applied in order:
1. `--` stops flag parsing (when enabled) and the rest becomes `rest`.
2. Non-flag tokens (`-` or plain values) become `rest`.
3. `--no-<flag>` maps to the matching boolean spec if present and `allowNo !== false`.
4. Inline values (`--flag=value`) are parsed before consuming the next argv token.
5. Arrays collect values until the next flag token or `--`.
6. Duplicate non-array flags are warnings; duplicate arrays append.
7. Required flags missing at the end produce `REQUIRED` errors.

## Value parsing

- `boolean`: `true|false|1|0|yes|no|on|off` (case-insensitive).  
  When no explicit value is provided, presence means `true`.
- `number`: `Number(value)` must be finite. Negative numbers are accepted.
- `string`: values are taken as-is; empty strings are rejected unless `allowEmpty`.
- `array`: collects tokens until the next flag token; empty arrays are rejected unless `allowEmpty`.

## Examples

```sh
--flag
--flag=true
--count=-3
--items a b c --other
-- --literal --values
--no-verbose
```

## Versioning and migration

### 1.0.0

This release is intentionally strict and schema-driven:

- ESM-only (Node.js >=24).
- Typed schema is the single source of truth.
- Parsing returns a structured result object rather than sentinel `false` values.

Migration from 0.x:

```diff
- const parseFlag = require('argv-flags');
- const name = parseFlag('--name', 'string');
+ import { defineSchema, parseArgs } from 'argv-flags';
+ const schema = defineSchema({ name: { type: 'string', flags: ['--name'] } });
+ const result = parseArgs(schema);
+ const name = result.values.name;
```

## Guarantees

- Deterministic output for a given `argv`.
- No mutation of the input `argv`.
- Stable issue codes for programmatic handling.

## License

MIT
