#!/usr/bin/env node
// Manifest checker - validates feature/SEO/admin/checks counts
import { readFileSync, existsSync } from 'fs';

const THRESHOLDS = {
  'docs/FEATURES_MANIFEST.md': { 'POST-': 100, 'MSG-': 100 },
  'docs/SEO_MANIFEST.md': { 'SEO-': 1000 },
  'docs/ADMIN_MANIFEST.md': { 'ADM-': 1000 },
  'docs/CHECKS_MANIFEST.md': { 'CHK-': 100 },
};

const part5Exists = existsSync('docs/PART5_COMPLETE.md');
let hasError = false;

for (const [file, checks] of Object.entries(THRESHOLDS)) {
  if (!existsSync(file)) {
    console.warn(`⚠ ${file} not found`);
    if (part5Exists) {
      console.error(`✗ FAIL: ${file} required when PART5_COMPLETE.md exists`);
      hasError = true;
    }
    continue;
  }

  const content = readFileSync(file, 'utf-8');
  
  for (const [prefix, threshold] of Object.entries(checks)) {
    const matches = content.match(new RegExp(`${prefix}\\d{3,4}`, 'g')) || [];
    const unique = new Set(matches);
    const count = unique.size;
    
    if (count >= threshold) {
      console.log(`✓ ${file}: ${prefix} = ${count}/${threshold}`);
    } else if (part5Exists) {
      console.error(`✗ FAIL: ${file}: ${prefix} = ${count}/${threshold} (below threshold)`);
      hasError = true;
    } else {
      console.warn(`⚠ ${file}: ${prefix} = ${count}/${threshold} (below threshold, but PART5 not complete)`);
    }
  }
}

if (hasError) {
  console.error('\n✗ Manifest check FAILED');
  process.exit(1);
}

console.log('\n✓ Manifest check passed');
