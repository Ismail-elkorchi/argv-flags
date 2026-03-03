/**
 * Goal: Demonstrate stable issue-code output on parse failures.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/structured-errors.mjs --retries not-a-number`
 * Expected output:
 * - Error JSON on stderr with `{ ok: false, issues }` and issue code such as `INVALID_VALUE`.
 * Safety notes:
 * - Offline example; no filesystem writes or network access.
 */
import { defineSchema, parseArgs } from "../dist/index.js";

const schema = defineSchema({
  retries: { type: "number", flags: ["--retries"], required: true },
});

const result = parseArgs(schema, {
  argv: process.argv.slice(2),
});

if (!result.ok) {
  process.stderr.write(
    `${JSON.stringify(
      {
        ok: false,
        issues: result.issues,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      retries: result.values.retries,
    },
    null,
    2,
  )}\n`,
);
