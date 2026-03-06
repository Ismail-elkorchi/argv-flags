import { execFileSync } from 'node:child_process';

const REQUIRED_SURFACES = [
  'FlagSpec',
  'ParseOptions',
  'ParseIssue',
  'ParseResult',
  'ParseResultJson',
  'defineSchema',
  'parseArgs',
  'toJsonResult'
];

const run = async () => {
  const payload = JSON.parse(
    execFileSync('deno', ['doc', '--json', 'src/index.ts'], {
      encoding: 'utf8'
    })
  );
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  const issues = [];

  for (const surface of REQUIRED_SURFACES) {
    const node = nodes.find((entry) => entry?.name === surface);
    if (!node) {
      issues.push(`missing exported surface in deno doc output: ${surface}`);
      continue;
    }

    const doc = String(node?.jsDoc?.doc ?? '').trim();
    if (doc.length === 0) {
      issues.push(`missing JSDoc summary for ${surface}`);
    }
  }

  if (issues.length > 0) {
    process.stderr.write('docs-quality-jsr: selected public JSR surfaces are under-documented\n');
    for (const issue of issues) {
      process.stderr.write(`- ${issue}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `docs-quality-jsr: verified ${REQUIRED_SURFACES.length} selected public surfaces\n`
  );
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
