import { readFile } from 'node:fs/promises';

const run = async () => {
  const tagInput = process.env.GITHUB_REF_NAME ?? process.argv[2] ?? '';
  const tagName = normalizeTag(tagInput);
  if (!tagName.startsWith('v')) {
    throw new Error(`changelog-section: expected v-prefixed tag, received "${tagName}"`);
  }
  const version = tagName.slice(1);

  const source = (await readFile('CHANGELOG.md', 'utf8')).replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const startMatch = findSectionStart(lines, version);
  if (!startMatch) {
    throw new Error(`changelog-section: could not find section for ${version}`);
  }

  const sectionLines = [];
  for (let index = startMatch.index; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (index > startMatch.index && isHeadingAtLevel(line, startMatch.level)) {
      break;
    }
    sectionLines.push(line);
  }

  const section = trimTrailingBlankLines(sectionLines).join('\n').trimEnd();
  if (section.length === 0) {
    throw new Error(`changelog-section: extracted section for ${version} is empty`);
  }

  process.stdout.write(`${section}\n`);
};

function normalizeTag(value) {
  if (!value) return '';
  if (value.startsWith('refs/tags/')) {
    return value.slice('refs/tags/'.length);
  }
  return value;
}

function findSectionStart(lines, version) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const headingInfo = parseHeading(line);
    if (!headingInfo) continue;
    if (matchesVersionHeading(headingInfo.body, version)) {
      return { index, level: headingInfo.level };
    }
  }
  return null;
}

function isHeadingAtLevel(line, level) {
  const headingInfo = parseHeading(line);
  if (!headingInfo) return false;
  return headingInfo.level === level;
}

function trimTrailingBlankLines(lines) {
  let end = lines.length;
  while (end > 0 && (lines[end - 1] ?? '').trim().length === 0) {
    end -= 1;
  }
  return lines.slice(0, end);
}

function parseHeading(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('## ')) {
    return { level: 2, body: trimmed.slice(3) };
  }
  if (trimmed.startsWith('### ')) {
    return { level: 3, body: trimmed.slice(4) };
  }
  return null;
}

function matchesVersionHeading(headingBody, version) {
  const normalized = headingBody.startsWith('v') ? headingBody.slice(1) : headingBody;
  return normalized === version
    || normalized.startsWith(`${version} `)
    || normalized.startsWith(`${version}(`)
    || normalized.startsWith(`${version}-`);
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
