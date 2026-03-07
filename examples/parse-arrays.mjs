/**
 * Goal: Show repeated array flags appending values in encounter order.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/parse-arrays.mjs --include src test --include docs`
 * Expected output:
 * - JSON object with `{ ok: true, include: ["src", "test", "docs"] }`.
 * Safety notes:
 * - Array defaults are cloned per parse call before new values append.
 */
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
