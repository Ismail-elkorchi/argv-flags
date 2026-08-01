import { createParser } from "../dist/index.js";

const parser = createParser({
  mode: { type: "string", flags: ["--mode"], required: true },
});

const result = parser.parse({
  argv: process.argv.slice(2),
  unknownFlagPolicy: "collect",
});

if (!result.success) {
  process.stderr.write(`${JSON.stringify({ success: false, issues: result.issues }, null, 2)}\n`);
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      success: true,
      mode: result.values.mode,
      unknownFlags: result.unknownFlags,
      positionals: result.positionals,
    },
    null,
    2,
  )}\n`,
);
