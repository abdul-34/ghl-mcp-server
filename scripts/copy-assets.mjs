/**
 * Copy non-TS runtime assets into dist/ after `tsc` (which only emits compiled
 * JS). Currently: the native workflow catalog JSON that
 * src/catalog/native-workflow-catalog.ts loads at runtime.
 */
import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src', 'catalog', 'data');
const outDir = join(root, 'dist', 'catalog', 'data');

if (!existsSync(srcDir)) {
  console.warn(`[copy-assets] Source dir missing, nothing to copy: ${srcDir}`);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

let count = 0;
for (const file of readdirSync(srcDir)) {
  if (!file.endsWith('.json')) continue;
  copyFileSync(join(srcDir, file), join(outDir, file));
  count++;
  console.log(`[copy-assets] ${file} → dist/catalog/data/`);
}

console.log(`[copy-assets] Copied ${count} asset(s).`);
