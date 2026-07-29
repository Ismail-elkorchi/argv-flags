import { defineSchema, parseArgs } from "../dist/index.js";

const schema = defineSchema({
  profile: { type: "string", flags: ["--profile"], default: "strict" },
});

const result = parseArgs(schema, {
  argv: process.argv.slice(2),
  stopAtDoubleDash: true,
});

if (!result.ok) {
  process.stderr.write(`${JSON.stringify({ ok: false, issues: result.issues }, null, 2)}\n`);
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      profile: result.values.profile,
      rest: result.rest,
    },
    null,
    2,
  )}\n`,
);
