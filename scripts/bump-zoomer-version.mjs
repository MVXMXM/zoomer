import { readFileSync, writeFileSync } from 'node:fs';

// Patch counts pushes to master. Major and minor stay as written.
const versionPath = new URL('../zoomer-version.json', import.meta.url);
const zoomer = JSON.parse(readFileSync(versionPath, 'utf8'));
const parts = String(zoomer.version).split('.').map(Number);

if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
  throw new Error(`zoomer version must be major.minor.patch, got ${zoomer.version}`);
}

const [major, minor, patch] = parts;
const current = zoomer.version;
const next = `${major}.${minor}.${patch + 1}`;
zoomer.version = next;

writeFileSync(versionPath, `${JSON.stringify(zoomer, null, 2)}\n`);
writePackageVersion(next);
writeLockfileVersion(current, next);
writeReadmeVersion(next);

function writePackageVersion(version) {
  const file = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = version;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

function writeLockfileVersion(current, next) {
  const file = new URL('../package-lock.json', import.meta.url);
  const lines = readFileSync(file, 'utf8').split('\n');
  const needle = `"version": "${current}"`;
  const replacement = `"version": "${next}"`;
  let hits = 0;

  // The root package and packages[""] sit at the top. Later "version" fields belong to dependencies.
  for (let i = 0; i < lines.length && i < 30; i += 1) {
    if (!lines[i].includes(needle)) continue;
    lines[i] = lines[i].replace(needle, replacement);
    hits += 1;
    if (hits === 2) break;
  }

  if (hits !== 2) {
    throw new Error(`expected 2 lockfile version fields, updated ${hits}`);
  }

  writeFileSync(file, lines.join('\n'));
}

function writeReadmeVersion(version) {
  const file = new URL('../README.md', import.meta.url);
  const text = readFileSync(file, 'utf8');
  const updated = text.replace(/^# Zoomer v\d+\.\d+\.\d+/m, `# Zoomer v${version}`);
  if (updated === text) {
    throw new Error('README version heading not found');
  }
  writeFileSync(file, updated);
}
