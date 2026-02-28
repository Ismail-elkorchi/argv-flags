import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const pullRequestTargetPattern = /(^|\n)\s*pull_request_target\s*:/m;
const topLevelPermissionsPattern = /^permissions:\s*$/m;

function readTopLevelPermissionsBlock(source) {
  const lines = source.split('\n');
  const startIndex = lines.findIndex((line) => line === 'permissions:');
  if (startIndex === -1) {
    return null;
  }
  const collected = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.length === 0) {
      if (collected.length > 0) {
        break;
      }
      continue;
    }
    if (!line.startsWith('  ')) {
      break;
    }
    collected.push(line);
  }
  return collected.join('\n');
}

const run = async () => {
  const workflowFiles = (await readdir(WORKFLOWS_DIR))
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort((left, right) => left.localeCompare(right));

  const violations = [];

  for (const fileName of workflowFiles) {
    const workflowPath = path.join(WORKFLOWS_DIR, fileName);
    const source = (await readFile(workflowPath, 'utf8')).replace(/\r\n/g, '\n');

    const mutableRefs = findMutableRefs(source);
    if (mutableRefs.length > 0) {
      violations.push(`${fileName}: mutable action ref(s): ${mutableRefs.join(', ')}`);
    }

    if (!topLevelPermissionsPattern.test(source)) {
      violations.push(`${fileName}: missing top-level permissions block`);
    }

    if (pullRequestTargetPattern.test(source)) {
      violations.push(`${fileName}: forbidden pull_request_target trigger`);
    }

    const permissionsBlock = readTopLevelPermissionsBlock(source);
    if (!permissionsBlock) {
      continue;
    }
    const writeLines = permissionsBlock
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith(': write'));
    if (writeLines.length > 0) {
      violations.push(`${fileName}: top-level permissions must stay read-only (found ${writeLines.join(', ')})`);
    }
  }

  if (violations.length > 0) {
    process.stderr.write('[workflow-policy] violations detected:\n');
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`);
    }
    process.exitCode = 1;
  }
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

function findMutableRefs(source) {
  const refs = [];
  const lines = source.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('uses:') || !trimmed.includes('@')) {
      continue;
    }
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex === -1) {
      continue;
    }
    const refCandidate = trimmed.slice(atIndex + 1).split('#')[0]?.trim() ?? '';
    if (refCandidate === 'main' || refCandidate === 'master' || isVersionTag(refCandidate)) {
      refs.push(refCandidate);
    }
  }
  return refs;
}

function isVersionTag(value) {
  if (!value.startsWith('v')) {
    return false;
  }
  const body = value.slice(1);
  if (body.length === 0) {
    return false;
  }
  const parts = body.split('.');
  return parts.every((part) => isDigits(part));
}

function isDigits(value) {
  if (value.length === 0) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    if (charCode < 48 || charCode > 57) {
      return false;
    }
  }
  return true;
}
