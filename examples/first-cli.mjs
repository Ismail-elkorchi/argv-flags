/**
 * Goal: Demonstrate a minimal schema-driven CLI with stable success/error JSON.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/first-cli.mjs --src input.txt --dest output.txt`
 * Expected output:
 * - Success JSON on stdout with `{ ok: true, values, rest, unknown }`.
 * - On invalid input, error JSON on stderr and exit code `2`.
 * Safety notes:
 * - Offline example; does not touch the network.
 */
import { defineSchema, parseArgs } from "../dist/index.js";

const schema = defineSchema({
  src: { type: "string", flags: ["--src"], required: true },
  dest: { type: "string", flags: ["--dest"], required: true },
  verbose: { type: "boolean", flags: ["--verbose"], default: false },
});

const result = parseArgs(schema, { argv: process.argv.slice(2) });

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
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      values: result.values,
      rest: result.rest,
      unknown: result.unknown,
    },
    null,
    2,
  )}\n`,
);
