import { readFile } from 'node:fs/promises';

const run = async () => {
  const tagInput = process.env.GITHUB_REF_NAME ?? process.argv[2] ?? '';
  const tagName = normalizeTag(tagInput);
  if (!tagName.startsWith('v')) {
    throw new Error(`release-gate: expected v-prefixed tag, received "${tagName}"`);
  }

  const version = tagName.slice(1);
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  if (packageJson.version !== version) {
    throw new Error(
      `release-gate: tag/version mismatch (tag=${version}, package.json=${packageJson.version})`
    );
  }

  const changelog = await readFile('CHANGELOG.md', 'utf8');
  if (!hasVersionSection(changelog, version)) {
    throw new Error(`release-gate: missing CHANGELOG section for version ${version}`);
  }

  process.stdout.write(
    `release-gate: ok tag=${tagName} package=${packageJson.version} changelog=present\n`
  );
};

function normalizeTag(value) {
  if (!value) {
    return '';
  }
  if (value.startsWith('refs/tags/')) {
    return value.slice('refs/tags/'.length);
  }
  return value;
}

function hasVersionSection(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    if (matchesVersionHeading(line, version)) {
      return true;
    }
  }
  return false;
}

function matchesVersionHeading(line, version) {
  const trimmed = line.trim();
  if (!(trimmed.startsWith('## ') || trimmed.startsWith('### '))) {
    return false;
  }

  const headingBody = trimmed.replace(/^#{2,3}\s+/, '');
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
