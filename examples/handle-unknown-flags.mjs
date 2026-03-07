/**
 * Goal: Show how unknown flags are captured for inspection in wrapper CLIs.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/handle-unknown-flags.mjs --mode safe --extra=1 file.txt`
 * Expected output:
 * - JSON object with `{ ok: true, mode, unknown, rest }`.
 * Safety notes:
 * - `unknown` preserves unknown flag tokens, but not exact downstream argv
 *   ordering. Use `--` plus `rest` when you need exact pass-through ordering.
 */
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
