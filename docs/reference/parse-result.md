# Parse result reference

## Result shape

```ts
interface ParseResult<S extends Schema> {
  values: { [K in keyof S]: FlagValue<S[K]["type"]> | undefined };
  present: { [K in keyof S]: boolean };
  rest: string[];
  unknown: string[];
  issues: ParseIssue[];
  ok: boolean;
}
```

`ok` is `true` only when no `error` issues exist.

## Issues

```ts
type IssueCode =
  | "UNKNOWN_FLAG"
  | "MISSING_VALUE"
  | "INVALID_VALUE"
  | "REQUIRED"
  | "DUPLICATE"
  | "EMPTY_VALUE";

interface ParseIssue {
  code: IssueCode;
  severity: "error" | "warning";
  message: string;
  flag?: string;
  key?: string;
  value?: string;
  index?: number;
}
```

## JSON shape

`schema/parse-result.schema.json` defines the JSON-serializable shape.
Use `toJsonResult()` to turn `undefined` into `null` before validation.

```ts
import { defineSchema, parseArgs, toJsonResult } from "argv-flags";
import { readFileSync } from "node:fs";
import Ajv from "ajv";

const schemaDef = defineSchema({
  mode: { type: "string", flags: ["--mode"], required: true },
});

const result = parseArgs(schemaDef, { argv: ["--mode", "safe"] });
const jsonResult = toJsonResult(result);
const schema = JSON.parse(
  readFileSync(new URL("../../schema/parse-result.schema.json", import.meta.url), "utf8"),
);

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
console.log(validate(jsonResult));
```
