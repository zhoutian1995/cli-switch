import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const DIST = resolve(PROJECT_ROOT, 'dist/cmd/root.js');

function run(args: string[]) {
  try {
    const stdout = execFileSync('node', [DIST, ...args], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      env: process.env,
    });
    return { code: 0, body: JSON.parse(stdout) };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string };
    return {
      code: failed.status ?? 1,
      body: JSON.parse(failed.stdout ?? ''),
    };
  }
}

describe('command consistency', () => {
  it('codex auth status and doctor agree on missing auth', () => {
    const auth = run(['auth', 'status', '--tool', 'codex', '--json']);
    const doctor = run(['doctor', '--tool', 'codex', '--json']);

    expect(auth.body.data.auth.status).toBe('missing');
    expect(doctor.body.data.tool).toBe('codex');
    expect(doctor.body.data.checks.find((item: { name: string }) => item.name === 'auth_ready')?.status).toBe('fail');
    expect(
      doctor.body.data.diagnostics.some((item: { code: string }) => item.code === 'DOCTOR_AUTH_MISSING'),
    ).toBe(true);
  });

  it('resolve unknown model and doctor default model checks are both strict', () => {
    const resolveUnknown = run(['resolve', '--tool', 'claude-code', '--model', 'unknown-model', '--json']);
    const doctorClaude = run(['doctor', '--tool', 'claude-code', '--json']);

    expect(resolveUnknown.code).toBe(4);
    expect(resolveUnknown.body.error.code).toBe('MODEL_NOT_FOUND');
    expect(doctorClaude.body.data.checks.find((item: { name: string }) => item.name === 'model_valid')?.status).toBe('pass');
  });
});
