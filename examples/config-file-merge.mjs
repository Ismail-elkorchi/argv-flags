/**
 * Goal: Show merging defaults + config file + CLI overrides with deterministic precedence.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/config-file-merge.mjs --mode strict --retries 7 --verbose`
 * Expected output:
 * - JSON object with `{ ok: true, merged }` where CLI values override config/defaults.
 * Safety notes:
 * - Offline example; no filesystem or network access.
 */
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
