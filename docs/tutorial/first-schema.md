# Tutorial: first schema parse

## Goal
Define a schema and parse one explicit argv array with deterministic output.

## Prereqs
- Node `>=24`
- `npm install`
- `npm run build`

## Copy/paste
```ts
import { defineSchema, parseArgs } from "argv-flags";

const schema = defineSchema({
  src: { type: "string", flags: ["--src"], required: true },
  dest: { type: "string", flags: ["--dest"], required: true },
  verbose: { type: "boolean", flags: ["--verbose"], default: false },
});

const result = parseArgs(schema, {
  argv: ["--src", "a.txt", "--dest", "b.txt"],
});

console.log(result.ok, result.values);
```

## What you should see
- `result.ok` is `true`.
- `result.values.src` is `"a.txt"`.
- `result.values.dest` is `"b.txt"`.

## Safety notes
> [!NOTE]
> Keep `required: true` for flags that control output destinations or external
> side effects.
