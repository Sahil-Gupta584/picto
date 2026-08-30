#!/usr/bin/env node
/**
 * patch-trueforge.js
 * Patches the TrueForge standalone server's ensureVenv function so that
 * pip install inside the sandbox clears all proxy env vars first.
 *
 * The sandbox-runtime sets HTTP_PROXY inside bwrap, but there is no
 * upstream proxy on this machine - pip always fails with ProxyError.
 * Running `unset` before pip fixes it.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

// Find the npx cache path for trueforge
const npxDir = join(homedir(), '.npm', '_npx');
const entries = execSync(`ls -d ${npxDir}/*/node_modules/@truefoundry/trueforge/dist/main.js 2>/dev/null`, { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

if (entries.length === 0) {
  console.error('❌ Could not find TrueForge main.js in npx cache. Is it installed?');
  process.exit(1);
}

for (const mainJsPath of entries) {
  if (!existsSync(mainJsPath)) continue;

  console.log(`🔍 Patching: ${mainJsPath}`);
  let src = readFileSync(mainJsPath, 'utf8');

  // The ensureVenv pip install command (without proxy cleanup):
  const target = '${shellEscape(relPip)} install --trusted-host pypi.org --trusted-host files.pythonhosted.org ${shellEscape(VENV_PYDANTIC_PIN)}';

  // With proxy cleanup prepended:
  const replacement = 'unset HTTP_PROXY https_proxy http_proxy https_proxy ALL_PROXY all_proxy; ${shellEscape(relPip)} install --trusted-host pypi.org --trusted-host files.pythonhosted.org ${shellEscape(VENV_PYDANTIC_PIN)}';

  if (!src.includes(target)) {
    console.log(`  ⏭️  Target pattern not found - already patched or version mismatch.`);
    continue;
  }

  const patched = src.replace(target, replacement);

  if (patched === src) {
    console.log(`  ⏭️  No changes made - already patched.`);
    continue;
  }

  writeFileSync(mainJsPath, patched, 'utf8');
  console.log(`  ✅ Patched! pip will now bypass proxy vars in sandbox.`);
}

// Also write a pip.conf that forces no-proxy as a belt-and-suspenders measure
const pipConfDir = join(homedir(), '.config', 'pip');
const { mkdirSync } = await import('fs');
mkdirSync(pipConfDir, { recursive: true });
writeFileSync(join(pipConfDir, 'pip.conf'), '[global]\nproxy =\n', 'utf8');
console.log(`📄 Wrote ~/.config/pip/pip.conf (empty proxy)`);

console.log('\n🎉 Done! Restart TrueForge with: bash start-trueforge.sh');
