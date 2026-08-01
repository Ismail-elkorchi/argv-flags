import { createParser } from "../dist/index.js";

const parser = createParser({
  profile: { type: "string", flags: ["--profile"], default: "strict" },
});

const result = parser.parse({
  argv: process.argv.slice(2),
});

if (!result.success) {
  process.stderr.write(`${JSON.stringify({ success: false, issues: result.issues }, null, 2)}\n`);
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      success: true,
      profile: result.values.profile,
      afterDoubleDash: result.afterDoubleDash,
    },
    null,
    2,
  )}\n`,
);
