import { defineSchema, parseArgs } from "../dist/index.js";

const schema = defineSchema({
  mode: { type: "string", flags: ["--mode"], required: true },
});

const result = parseArgs(schema, {
  argv: process.argv.slice(2),
  allowUnknown: true,
});

if (!result.ok) {
  process.stderr.write(`${JSON.stringify({ ok: false, issues: result.issues }, null, 2)}\n`);
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      mode: result.values.mode,
      unknown: result.unknown,
      rest: result.rest,
    },
    null,
    2,
  )}\n`,
);
