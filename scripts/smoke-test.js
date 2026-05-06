#!/usr/bin/env node
/**
 * cli-switch smoke test — verifies the CLI works after install.
 *
 * Usage: node scripts/smoke-test.js
 * Exit code 0 = all passed, 1 = failure.
 */

import { execFile } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CLI = join(ROOT, 'dist/cmd/root.js');

let passed = 0;
let failed = 0;

function run(...args) {
  return new Promise((resolve) => {
    execFile('node', [CLI, ...args], { cwd: ROOT, timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ code: err?.code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function main() {
  console.log('cli-switch smoke test\n');

  // 1. CLI starts and shows help
  await test('cli --help works', async () => {
    const { code, stdout } = await run('--help');
    assert(code === 0, `exit code ${code}`);
    assert(stdout.includes('cli-switch'), 'missing cli-switch in help');
  });

  // 2. resolve --json returns valid JSON
  await test('resolve --json returns valid JSON', async () => {
    const { code, stdout } = await run('resolve', '--tool', 'claude-code', '--model', 'sonnet', '--json');
    assert(code === 0, `exit code ${code}`);
    const json = JSON.parse(stdout);
    assert(json.ok === true, `not ok: ${json.ok}`);
    assert(json.data?.runtime?.model?.resolvedName, 'missing model resolvedName');
  });

  // 3. auth status --json returns valid JSON
  await test('auth status --json returns valid JSON', async () => {
    const { code, stdout } = await run('auth', 'status', '--tool', 'claude-code', '--json');
    assert(code === 0, `exit code ${code}`);
    const json = JSON.parse(stdout);
    assert(json.ok === true, `not ok: ${json.ok}`);
    assert(json.data?.auth?.status, 'missing auth status');
  });

  // 4. doctor --json returns valid JSON
  await test('doctor --json returns valid JSON', async () => {
    const { code, stdout } = await run('doctor', '--tool', 'claude-code', '--json');
    assert(code === 0, `exit code ${code}`);
    const json = JSON.parse(stdout);
    assert(json.ok === true, `not ok: ${json.ok}`);
    assert(json.data?.summary?.checksTotal > 0, 'no checks run');
  });

  // 5. list models --json
  await test('list models --json returns valid JSON', async () => {
    const { code, stdout } = await run('list', 'models', '--json');
    assert(code === 0, `exit code ${code}`);
    const json = JSON.parse(stdout);
    assert(json.ok === true, `not ok: ${json.ok}`);
    assert(Array.isArray(json.data?.items), 'data.items should be array');
  });

  // 6. run --dry-run --json
  await test('run --dry-run --json returns valid JSON', async () => {
    const { code, stdout } = await run('run', 'fix bug', '--dry-run', '--json');
    assert(code === 0, `exit code ${code}`);
    const json = JSON.parse(stdout);
    assert(json.ok === true, `not ok: ${json.ok}`);
    assert(json.data?.decision?.agent, 'missing decision.agent');
  });

  // 7. run --dry-run shows model selection
  await test('run --dry-run shows Model info', async () => {
    const { code, stdout } = await run('run', 'write tests', '--dry-run');
    assert(code === 0, `exit code ${code}`);
    assert(stdout.includes('Model'), 'missing Model in output');
  });

  // 8. schema_version present in all JSON outputs
  await test('JSON outputs include schema_version', async () => {
    const { stdout } = await run('resolve', '--tool', 'claude-code', '--model', 'sonnet', '--json');
    const json = JSON.parse(stdout);
    assert(json.schema_version, 'missing schema_version');
  });

  // 9. error handling — unknown model returns structured error
  await test('unknown model returns structured error', async () => {
    const { code, stdout } = await run('resolve', '--tool', 'claude-code', '--model', 'nonexistent-model-xyz', '--json');
    const json = JSON.parse(stdout);
    assert(json.ok === false, 'should be not ok');
    assert(json.error?.code, 'missing error code');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});
