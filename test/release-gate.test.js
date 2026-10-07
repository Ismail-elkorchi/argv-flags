import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const gate = fileURLToPath(new URL('../scripts/release-gate.mjs', import.meta.url));

async function runGate(t, { tag = 'v4.0.0', packageVersion = '4.0.0', lockVersion = '4.0.0',
  rootVersion = '4.0.0', jsrVersion = '4.0.0', changelog = '## 4.0.0 - Unreleased\n' } = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'argv-release-gate-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await Promise.all([
    writeFile(join(cwd, 'package.json'), JSON.stringify({ version: packageVersion })),
    writeFile(join(cwd, 'package-lock.json'), JSON.stringify({ version: lockVersion, packages: { '': { version: rootVersion } } })),
    writeFile(join(cwd, 'jsr.json'), JSON.stringify({ version: jsrVersion })),
    writeFile(join(cwd, 'CHANGELOG.md'), changelog)
  ]);
  const env = { ...process.env };
  delete env.GITHUB_REF_NAME;
  return spawnSync(process.execPath, [gate, tag], { cwd, env, encoding: 'utf8' });
}

test('release gate accepts matching package, lock roots, JSR and tag versions', async (t) => {
  const result = await runGate(t);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS tag=v4\.0\.0 package=4\.0\.0 lock=4\.0\.0 lock-root=4\.0\.0 jsr=4\.0\.0 changelog=found/u);
});

test('release gate accepts a full tag reference', async (t) => {
  const result = await runGate(t, { tag: 'refs/tags/v4.0.0' });
  assert.equal(result.status, 0, result.stderr);
});

for (const [field, source] of [
  ['packageVersion', 'package.json'],
  ['lockVersion', 'package-lock.json'],
  ['rootVersion', 'package-lock.json packages[""]'],
  ['jsrVersion', 'jsr.json']
]) {
  test(`release gate rejects a mismatched ${source} version`, async (t) => {
    const result = await runGate(t, { [field]: '3.0.0' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`tag/version mismatch (tag=4.0.0, ${source}=3.0.0)`), result.stderr);
  });
}

test('release gate rejects a tag that differs from every manifest', async (t) => {
  const result = await runGate(t, { tag: 'v3.0.0' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /tag\/version mismatch/u);
});

test('release gate rejects an invalid lock root version', async (t) => {
  const result = await runGate(t, { rootVersion: null });
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('package-lock.json packages[""]=null'), result.stderr);
});

test('release gate requires a v-prefixed tag', async (t) => {
  const result = await runGate(t, { tag: '4.0.0' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected v-prefixed tag/u);
});

test('release gate requires release notes for the selected version', async (t) => {
  const result = await runGate(t, { changelog: '## 3.0.0\n' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing CHANGELOG section for version 4\.0\.0/u);
});
