/**
 * Goal: Show pass-through handling when `stopAtDoubleDash` is enabled.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/pass-through-double-dash.mjs --profile agent -- --trace --limit=2`
 * Expected output:
 * - JSON object with `{ ok: true, profile, rest }` where `rest` contains tokens after `--`.
 * Safety notes:
 * - Offline example; no network access.
 */
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
