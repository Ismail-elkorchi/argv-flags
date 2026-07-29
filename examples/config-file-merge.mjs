import { defineSchema, parseArgs } from "../dist/index.js";

const defaults = {
  mode: "safe",
  retries: 2,
  verbose: false,
};

const configFile = {
  mode: "balanced",
  retries: 4,
};

const schema = defineSchema({
  mode: { type: "string", flags: ["--mode"] },
  retries: { type: "number", flags: ["--retries"] },
  verbose: { type: "boolean", flags: ["--verbose"], default: false },
});

const parsed = parseArgs(schema, { argv: process.argv.slice(2) });
if (!parsed.ok) {
  process.stderr.write(`${JSON.stringify({ ok: false, issues: parsed.issues }, null, 2)}\n`);
  process.exit(2);
}

const merged = {
  ...defaults,
  ...configFile,
  ...(parsed.present.mode ? { mode: parsed.values.mode } : {}),
  ...(parsed.present.retries ? { retries: parsed.values.retries } : {}),
  ...(parsed.present.verbose ? { verbose: parsed.values.verbose } : {}),
};

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      merged,
    },
    null,
    2,
  )}\n`,
);
