# How-to: stop parsing after `--`

## Goal
Use `--` as a delimiter so remaining tokens are forwarded unchanged.

## Prereqs
- Schema for your local flags
- `stopAtDoubleDash: true` (default)

## Copy/paste
```ts
import { defineSchema, parseArgs } from "argv-flags";

const schema = defineSchema({
  mode: { type: "string", flags: ["--mode"], required: true },
});

const result = parseArgs(schema, {
  argv: ["--mode", "safe", "--", "--literal", "value"],
  stopAtDoubleDash: true,
});

console.log(result.rest);
```

## What you should see
- `result.rest` equals `["--literal", "value"]`.
- Tokens after `--` are not interpreted as flags.

## Safety notes
> [!NOTE]
> Forward `result.rest` only to trusted command paths and explicit argument
> positions.
