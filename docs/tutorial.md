# Tutorial: build a small schema

This tutorial shows a minimal schema and a deterministic parse flow.

## 1) Define the schema

```ts
import { defineSchema, parseArgs } from "argv-flags";

const schema = defineSchema({
  src: { type: "string", flags: ["--src"], required: true },
  dest: { type: "string", flags: ["--dest"], required: true },
  verbose: { type: "boolean", flags: ["--verbose"], default: false },
});
```

## 2) Parse argv

```ts
const result = parseArgs(schema, { argv: ["--src", "a.txt", "--dest", "b.txt"] });

if (!result.ok) {
  console.error(result.issues);
  process.exitCode = 1;
}

console.log(result.values.src, result.values.dest);
```

## 3) Interpret output

- `result.ok` is `true` only when there are no error-severity issues.
- `result.issues` is stable and machine readable.
- `result.unknown` and `result.rest` are populated when enabled or when `--` is used.
