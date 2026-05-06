import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { join } from 'node:path';

const CLI = join(__dirname, '../../dist/cmd/root.js');

function runCli(...args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    execFile('node', [CLI, ...args], { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: err?.code ?? 0 });
    });
  });
}

describe('run command E2E (--dry-run)', () => {
  it('dry-run output contains Agent, Intent, and Confidence', async () => {
    const { stdout, code } = await runCli('run', 'fix bug', '--dry-run');
    expect(code).toBe(0);
    expect(stdout).toContain('Intent');
    expect(stdout).toContain('Agent');
    expect(stdout).toContain('Confidence');
  });

  it('--dry-run --json outputs valid JSON', async () => {
    const { stdout, code } = await runCli('run', 'refactor', '--dry-run', '--json');
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toBeDefined();
    expect(parsed.data.intent).toBeDefined();
    expect(parsed.data.decision).toBeDefined();
  });

  it('--agent codex --dry-run --json uses specified agent', async () => {
    const { stdout, code } = await runCli('run', 'debug', '--agent', 'codex', '--dry-run', '--json');
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.data.decision.agent).toBe('codex');
  });

  it('--dry-run shows model selection info', async () => {
    const { stdout, code } = await runCli('run', 'write tests', '--dry-run');
    expect(code).toBe(0);
    expect(stdout).toContain('Model');
  });

  it('--no-stream --dry-run does not error', async () => {
    const { stdout, code } = await runCli('run', 'hello', '--dry-run', '--no-stream');
    expect(code).toBe(0);
  });
});
