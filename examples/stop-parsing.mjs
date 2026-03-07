/**
 * Goal: Show `--` stopping local flag parsing while preserving the remaining argv.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/stop-parsing.mjs --mode safe -- --literal value`
 * Expected output:
 * - JSON object with `{ ok: true, mode, rest }` where `rest` contains the
 *   tokens after `--`.
 * Safety notes:
 * - Forward `rest` only to known child-command positions and trusted command
 *   paths.
 */
import { defineSchema, parseArgs } from "../dist/index.js";

const schema = defineSchema({
  mode: { type: "string", flags: ["--mode"], required: true },
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
      mode: result.values.mode,
      rest: result.rest,
    },
    null,
    2,
  )}\n`,
);
