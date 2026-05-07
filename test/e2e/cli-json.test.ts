import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const DIST = resolve(PROJECT_ROOT, 'dist/cmd/root.js');

function runJson(args: string[], env?: NodeJS.ProcessEnv) {
  try {
    const output = execFileSync('node', [DIST, ...args], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });

    return { exitCode: 0, body: JSON.parse(output) };
  } catch (error) {
    const failed = error as { stdout?: string; status?: number };
    return {
      exitCode: failed.status ?? 1,
      body: JSON.parse(failed.stdout ?? ''),
    };
  }
}

describe('CLI JSON golden', () => {
  const runCliJson = (args: string[], env?: NodeJS.ProcessEnv) => {
    execFileSync('npm', ['run', 'build'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return runJson(args, env);
  };
  it('resolve --json returns schema envelope and runtime', () => {
    const result = runCliJson(['resolve', '--tool', 'claude-code', '--model', 'sonnet', '--json']);
    expect(result.exitCode).toBe(0);
    expect(result.body.schema_version).toBe('v1alpha1');
    expect(result.body.ok).toBe(true);
    expect(result.body.data.request.tool).toBe('claude-code');
    expect(result.body.data.runtime.tool).toBe('claude-code');
    expect(result.body.data.runtime.model.resolvedName).toBe('claude-3-7-sonnet');
  });

  it('auth status --json returns schema envelope and auth payload', () => {
    const result = runCliJson(['auth', 'status', '--tool', 'codex', '--json']);
    expect(result.exitCode).toBe(0);
    expect(result.body.schema_version).toBe('v1alpha1');
    expect(result.body.data.tool).toBe('codex');
    expect(result.body.data.auth.mode).toBe('api_key');
  });

  it('doctor --json returns items and schema envelope with environment exit code', () => {
    const result = runCliJson(['doctor', '--json']);
    expect(result.exitCode).toBe(3);
    expect(result.body.schema_version).toBe('v1alpha1');
    expect(Array.isArray(result.body.data.items)).toBe(true);
    expect(result.body.data.items.length).toBeGreaterThan(0);
  });

  it('resolve unknown model returns structured MODEL_NOT_FOUND error', () => {
    const result = runCliJson(['resolve', '--tool', 'claude-code', '--model', 'unknown-model', '--json']);
    expect(result.exitCode).toBe(4);
    expect(result.body.schema_version).toBe('v1alpha1');
    expect(result.body.ok).toBe(false);
    expect(result.body.error.code).toBe('MODEL_NOT_FOUND');
  });

  it('resolve conflicting provider/vendor returns structured RESOLVE_CONFLICT error', () => {
    const result = runCliJson(['resolve', '--tool', 'claude-code', '--model', 'sonnet', '--provider', 'anthropic', '--vendor', 'openai', '--json']);
    expect(result.exitCode).toBe(4);
    expect(result.body.schema_version).toBe('v1alpha1');
    expect(result.body.ok).toBe(false);
    expect(result.body.error.code).toBe('RESOLVE_CONFLICT');
  });

  it('run --acp --json with gateway env returns GATEWAY_ACP_CONFLICT error', () => {
    const result = runCliJson(
      ['run', 'hello', '--agent', 'claude-code', '--acp', '--json'],
      { SWITCH_API_KEY: 'test-key' },
    );
    expect(result.exitCode).toBe(2);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.code).toBe('GATEWAY_ACP_CONFLICT');
  });
});
