import { createParser } from "../dist/index.js";

const parser = createParser({
  src: { type: "string", flags: ["--src"], required: true },
  dest: { type: "string", flags: ["--dest"], required: true },
  verbose: {
    type: "boolean",
    flags: ["--verbose"],
    negatedFlag: "--no-verbose",
    default: false,
  },
});

const result = parser.parse({ args: process.argv.slice(2) });

if (!result.success) {
  process.stderr.write(
    `${JSON.stringify(
      {
        success: false,
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
      success: true,
      values: result.values,
      positionals: result.positionals,
      argumentsAfterDoubleDash: result.argumentsAfterDoubleDash,
      unknownArguments: result.unknownArguments,
    },
    null,
    2,
  )}\n`,
);
