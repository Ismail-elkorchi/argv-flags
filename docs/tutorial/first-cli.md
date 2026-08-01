# Build a CLI with exit codes

Create and reuse a parser:

```ts
import { createParser } from "argv-flags";

const parser = createParser({
  source: { type: "string", flags: ["-s", "--source"], required: true },
  output: {
    type: "string",
    flags: ["-o", "--output"],
    required: true,
  },
});

const result = parser.parse();

if (!result.success) {
  process.stderr.write(`${JSON.stringify(result.issues, null, 2)}\n`);
  process.exitCode = 2;
} else {
  process.stdout.write(
    `${JSON.stringify({ values: result.values }, null, 2)}\n`,
  );
}
```

Run the repository example:

```sh
node examples/first-cli.mjs --source input.txt --output output.txt
```

The example uses `-s`/`--source` and `-o`/`--output`; the command above uses
their long forms. Omitting `--output` produces `MISSING_REQUIRED_OPTION` and
exit status `2`. Branch on issue codes rather than human-readable messages.
