// Enforces the initial-JS budget from requirements §7:
// gzipped entry JS (scripts + modulepreload chunks referenced by index.html,
// i.e. everything loaded before interaction) must be <= 350 KB.
// Lazy chunks (KaTeX, Mermaid, CM languages) are excluded by construction:
// they are dynamic imports and never appear in index.html.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_BYTES = 350 * 1024;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

let html;
try {
  html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

const refs = new Set();
for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) refs.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g))
  refs.add(m[1]);

if (refs.size === 0) {
  console.error('No JS references found in dist/index.html — build output unexpected.');
  process.exit(1);
}

let total = 0;
const rows = [];
for (const ref of refs) {
  const file = path.join(distDir, ref.replace(/^\//, ''));
  const gz = gzipSync(readFileSync(file), { level: 9 }).length;
  total += gz;
  rows.push({ ref, gz });
}

rows.sort((a, b) => b.gz - a.gz);
for (const { ref, gz } of rows) {
  console.log(`${(gz / 1024).toFixed(1).padStart(8)} KB gz  ${ref}`);
}
console.log('-'.repeat(48));
console.log(
  `${(total / 1024).toFixed(1).padStart(8)} KB gz  total initial JS (budget ${(BUDGET_BYTES / 1024).toFixed(0)} KB)`,
);

if (total > BUDGET_BYTES) {
  console.error(`\nFAIL: initial JS exceeds the ${(BUDGET_BYTES / 1024).toFixed(0)} KB gz budget.`);
  process.exit(1);
}
console.log('\nOK: within budget.');
