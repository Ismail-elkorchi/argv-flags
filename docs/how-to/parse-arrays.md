# How-to: parse repeated array values

## Goal
Collect repeated values for one flag key into a single ordered array.

## Prereqs
- `argv-flags` installed
- Schema includes an `array` field

## Copy/paste
```ts
import { defineSchema, parseArgs } from "argv-flags";

const schema = defineSchema({
  include: { type: "array", flags: ["--include"], default: [] },
});

const result = parseArgs(schema, {
  argv: ["--include", "src", "test", "--include", "docs"],
});

console.log(result.values.include);
```

## What you should see
- Output array preserves encounter order: `["src", "test", "docs"]`.

## Safety notes
> [!NOTE]
> Array defaults are cloned internally, so one parse call does not mutate
> defaults used by later calls.
