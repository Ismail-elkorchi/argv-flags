import { createParser } from "../dist/index.js";

const parser = createParser({
  source: { type: "string", flags: ["-s", "--source"], required: true },
  output: { type: "string", flags: ["-o", "--output"], required: true },
  verbose: {
    type: "boolean",
    flags: ["-v", "--verbose"],
    falseFlags: ["--no-verbose"],
    default: false,
  },
});

const result = parser.parse({ argv: process.argv.slice(2) });

if (!result.success) {
  process.stderr.write(
    `${JSON.stringify({ success: false, issues: result.issues }, null, 2)}\n`,
  );
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      success: true,
      values: result.values,
      positionals: result.positionals,
      afterDoubleDash: result.afterDoubleDash,
      unknownFlags: result.unknownFlags,
    },
    null,
    2,
  )}\n`,
);
