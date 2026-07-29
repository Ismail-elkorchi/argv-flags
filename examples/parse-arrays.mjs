import { defineSchema, parseArgs } from "../dist/index.js";

const schema = defineSchema({
  include: { type: "array", flags: ["--include"], default: [] },
});

const result = parseArgs(schema, {
  argv: process.argv.slice(2),
});

if (!result.ok) {
  process.stderr.write(`${JSON.stringify({ ok: false, issues: result.issues }, null, 2)}\n`);
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      include: result.values.include,
    },
    null,
    2,
  )}\n`,
);
