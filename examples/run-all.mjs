import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));

function runExample(fileName, argv = []) {
  const scriptPath = path.join(examplesDir, fileName);
  return spawnSync(process.execPath, [scriptPath, ...argv], {
    encoding: "utf8",
  });
}

function parseJson(streamText) {
  return JSON.parse(streamText.trim());
}

{
  const result = runExample("first-cli.mjs", ["--source", "input.txt", "--output", "output.txt"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.success, true);
  assert.equal(payload.values.source, "input.txt");
  assert.equal(payload.values.output, "output.txt");
}

{
  const result = runExample("first-cli.mjs", ["--source", "input.txt"]);
  assert.equal(result.status, 2);
  const payload = parseJson(result.stderr);
  assert.equal(payload.success, false);
}

{
  const result = runExample("config-file-merge.mjs", ["--mode", "strict", "--retries", "7", "--verbose"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.merged.mode, "strict");
  assert.equal(payload.merged.retries, 7);
  assert.equal(payload.merged.verbose, true);
}

{
  const result = runExample("pass-through-double-dash.mjs", [
    "--profile",
    "strict",
    "--",
    "--trace",
    "--limit=2",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.deepEqual(payload.afterDoubleDash, ["--trace", "--limit=2"]);
}

{
  const result = runExample("handle-unknown-flags.mjs", ["--mode", "safe", "--extra=1", "file.txt"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.unknownFlags, [
    { argvElement: "--extra=1", flag: "--extra", argvIndex: 2, inlineValue: "1" },
  ]);
  assert.deepEqual(payload.positionals, ["file.txt"]);
}

{
  const result = runExample("collect-multiple-values.mjs", [
    "-Isrc",
    "-Itest",
    "--include=docs",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.include, ["src", "test", "docs"]);
}

{
  const result = runExample("structured-errors.mjs", ["--retries", "not-a-number"]);
  assert.equal(result.status, 1);
  const payload = parseJson(result.stderr);
  assert.equal(payload.success, false);
  assert.equal(payload.issues[0]?.code, "INVALID_OPTION_VALUE");
}

process.stdout.write("examples:run argv-flags PASS\n");
