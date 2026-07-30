import { createParser } from "../dist/index.js";

const parser = createParser({
  include: { type: "string", flags: ["--include"], multiple: true },
});

const result = parser.parse({
  args: process.argv.slice(2),
});

if (!result.success) {
  process.stderr.write(`${JSON.stringify({ success: false, issues: result.issues }, null, 2)}\n`);
  process.exit(2);
}

process.stdout.write(
  `${JSON.stringify(
    {
      success: true,
      include: result.values.include,
    },
    null,
    2,
  )}\n`,
);
