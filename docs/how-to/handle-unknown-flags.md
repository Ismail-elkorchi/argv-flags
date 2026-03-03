# How-to: capture unknown flags without failing

## Goal
Accept additional flags while still parsing known schema keys.

## Prereqs
- Schema for known flags
- `allowUnknown: true` parse option

## Copy/paste
```ts
import { defineSchema, parseArgs } from "argv-flags";

const schema = defineSchema({
  mode: { type: "string", flags: ["--mode"], required: true },
});

const result = parseArgs(schema, {
  argv: ["--mode", "safe", "--extra", "1", "--other"],
  allowUnknown: true,
});

console.log(result.unknown);
console.log(result.rest);
```

## What you should see
- `result.unknown` contains unknown flag tokens.
- `result.ok` stays `true` when no schema validation errors occur.

## Safety notes
> [!WARNING]
> Treat `unknown` as untrusted input. Validate or sanitize before forwarding to
> subprocesses.
