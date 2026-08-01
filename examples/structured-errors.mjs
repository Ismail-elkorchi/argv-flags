import { createParser, value } from "../dist/index.js";

const parser = createParser({
  retries: {
    type: value.integer({ minimum: 0 }),
    flags: ["--retries"],
    required: true,
  },
});

const result = parser.parse({
  argv: process.argv.slice(2),
});

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
  process.exit(1);
}

process.stdout.write(
  `${JSON.stringify(
    {
      success: true,
      retries: result.values.retries,
    },
    null,
    2,
  )}\n`,
);
