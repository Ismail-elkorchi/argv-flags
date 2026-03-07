/**
 * Goal: Run all repository examples and assert expected machine-readable behavior.
 * Prereqs:
 * - Run from repo root after `npm run build`.
 * Run:
 * - `node examples/run-all.mjs`
 * Expected output:
 * - Final line `examples:run argv-flags PASS` on stdout and process exit code `0`.
 * Safety notes:
 * - Offline test harness; spawns local Node processes only.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));

function runExample(fileName, args = []) {
  const scriptPath = path.join(examplesDir, fileName);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
  });
}

function parseJson(streamText) {
  return JSON.parse(streamText.trim());
}

{
  const result = runExample("first-cli.mjs", ["--src", "input.txt", "--dest", "output.txt"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.values.src, "input.txt");
  assert.equal(payload.values.dest, "output.txt");
}

{
  const result = runExample("first-cli.mjs", ["--src", "input.txt"]);
  assert.equal(result.status, 2);
  const payload = parseJson(result.stderr);
  assert.equal(payload.ok, false);
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
    "agent",
    "--",
    "--trace",
    "--limit=2",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.deepEqual(payload.rest, ["--trace", "--limit=2"]);
}

{
  const result = runExample("handle-unknown-flags.mjs", ["--mode", "safe", "--extra=1", "file.txt"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.unknown, ["--extra=1"]);
  assert.deepEqual(payload.rest, ["file.txt"]);
}

{
  const result = runExample("stop-parsing.mjs", ["--mode", "safe", "--", "--literal", "value"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.rest, ["--literal", "value"]);
}

{
  const result = runExample("parse-arrays.mjs", ["--include", "src", "test", "--include", "docs"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = parseJson(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.include, ["src", "test", "docs"]);
}

{
  const result = runExample("structured-errors.mjs", ["--retries", "not-a-number"]);
  assert.equal(result.status, 1);
  const payload = parseJson(result.stderr);
  assert.equal(payload.ok, false);
  assert.equal(payload.issues[0]?.code, "INVALID_VALUE");
}

process.stdout.write("examples:run argv-flags PASS\n");
