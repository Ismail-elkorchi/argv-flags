import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const policyPath = path.join(ROOT, 'tools', 'docs-policy.json');

const run = async () => {
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  const entrypoints = Array.isArray(policy.entrypoints) ? policy.entrypoints : [];
  const symbolFiles = Array.isArray(policy.symbolFiles) ? policy.symbolFiles : [];
  const minDocumentedSymbols = Number(policy.minDocumentedSymbols ?? 0);
  const baselineMinDocumentedSymbols = Number(policy.baselineMinDocumentedSymbols ?? 0);

  for (const relativePath of entrypoints) {
    const source = await readFile(path.join(ROOT, relativePath), 'utf8');
    if (!hasModuleDoc(source)) {
      throw new Error(`entrypoint missing module docs: ${relativePath}`);
    }
  }

  let documented = 0;
  let total = 0;
  for (const relativePath of symbolFiles) {
    const source = await readFile(path.join(ROOT, relativePath), 'utf8');
    const entries = collectExportedSymbols(source);
    documented += entries.documented;
    total += entries.total;
  }

  const ratio = total === 0 ? 1 : documented / total;
  const threshold = Math.max(minDocumentedSymbols, baselineMinDocumentedSymbols);
  process.stdout.write(`docs-policy: documented=${documented} total=${total} ratio=${ratio.toFixed(4)} threshold=${threshold}\n`);

  if (ratio < threshold) {
    throw new Error(`documented symbol ratio ${ratio.toFixed(4)} is below required ${threshold}`);
  }
};

function hasModuleDoc(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    return trimmed.startsWith('/**');
  }
  return false;
}

function collectExportedSymbols(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let documented = 0;
  let total = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!isExportedSymbolLine(line)) continue;
    total += 1;
    if (hasDocCommentBefore(lines, index)) {
      documented += 1;
    }
  }

  return { documented, total };
}

function isExportedSymbolLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('export ')) {
    return false;
  }
  const tokens = tokenize(trimmed);
  if (tokens.length < 3) {
    return false;
  }
  let index = 1;
  if (tokens[index] === 'declare') {
    index += 1;
  }
  const keyword = tokens[index];
  const symbol = tokens[index + 1];
  if (!keyword || !symbol) {
    return false;
  }
  if (!isExportKeyword(keyword)) {
    return false;
  }
  return isIdentifier(symbol);
}

function tokenize(value) {
  const parts = [];
  let current = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!char) continue;
    if (char === ' ' || char === '\t') {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts;
}

function isExportKeyword(value) {
  return value === 'const'
    || value === 'function'
    || value === 'class'
    || value === 'interface'
    || value === 'type'
    || value === 'enum';
}

function isIdentifier(value) {
  if (value.length === 0) return false;
  const first = value.charCodeAt(0);
  const firstIsLetter = (first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 95;
  if (!firstIsLetter) return false;
  for (let index = 1; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    const isDigit = code >= 48 && code <= 57;
    if (!(isLetter || isDigit || code === 95)) {
      return false;
    }
  }
  return true;
}

function hasDocCommentBefore(lines, index) {
  for (let cursor = index - 1; cursor >= 0 && cursor >= index - 8; cursor -= 1) {
    const line = (lines[cursor] ?? '').trim();
    if (line.length === 0) continue;
    if (line.startsWith('/**') || line === '*/' || line.startsWith('* ')) {
      return true;
    }
    if (!line.startsWith('//')) {
      return false;
    }
  }
  return false;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
