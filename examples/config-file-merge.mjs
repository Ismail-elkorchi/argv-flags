import { createParser } from "../dist/index.js";

const defaults = {
  mode: "safe",
  retries: 2,
  verbose: false,
};

const configFile = {
  mode: "balanced",
  retries: 4,
};

const parser = createParser({
  mode: { type: "string", flags: ["--mode"] },
  retries: { type: "number", flags: ["--retries"] },
  verbose: { type: "boolean", flags: ["--verbose"], default: false },
});

const parsed = parser.parse({ args: process.argv.slice(2) });
if (!parsed.success) {
  process.stderr.write(`${JSON.stringify({ success: false, issues: parsed.issues }, null, 2)}\n`);
  process.exit(2);
}

const merged = {
  ...defaults,
  ...configFile,
  ...(parsed.specified.mode ? { mode: parsed.values.mode } : {}),
  ...(parsed.specified.retries ? { retries: parsed.values.retries } : {}),
  ...(parsed.specified.verbose ? { verbose: parsed.values.verbose } : {}),
};

process.stdout.write(
  `${JSON.stringify(
    {
      success: true,
      merged,
    },
    null,
    2,
  )}\n`,
);
