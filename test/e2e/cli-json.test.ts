import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

function createRegistryOverride(platforms: string[], binaryNames: string[] = ['definitely-missing-cli-switch-binary']): NodeJS.ProcessEnv {
  const configHome = mkdtempSync(join(tmpdir(), 'cli-switch-e2e-'));
  const configDir = join(configHome, 'cli-switch');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'registry.override.toml'), `
[tools.claude-code]
id = "claude-code"
displayName = "Claude Code"
adapter = "claude-code"
command = "claude"
defaultProfile = "default"
binaryNames = ${JSON.stringify(binaryNames)}
supportedPlatforms = ${JSON.stringify(platforms)}

[profiles.claude-code.default]
tool = "claude-code"
name = "default"
description = "Test override profile"
defaultModel = "sonnet"
defaultVendor = "anthropic"
defaultProvider = "anthropic"
defaultTransport = "native"
authMode = "oauth"

[profiles.claude-code.default.capabilities]
mcp = false
skills = false
toolPolicy = false
structuredOutput = false

[profiles.claude-code.default.constraints]
requiresBinary = true
`);

  return {
    XDG_CONFIG_HOME: configHome,
    OPENROUTER_API_KEY: '',
    SWITCH_API_KEY: '',
  };
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

  it('run invalid execution --json returns INPUT_ERROR', () => {
    const result = runCliJson(
      ['run', 'hello', '--execution', 'not-a-strategy', '--json', '--dry-run'],
      { OPENROUTER_API_KEY: '', SWITCH_API_KEY: '' },
    );

    expect(result.exitCode).toBe(2);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.code).toBe('INPUT_ERROR');
    expect(Array.isArray(result.body.warnings)).toBe(true);
    expect(Array.isArray(result.body.diagnostics)).toBe(true);
  });

  it('doctor --json reports BINARY_NOT_FOUND from runtime preflight', () => {
    const currentPlatform = process.platform === 'darwin' ? 'darwin' : 'linux';
    const result = runCliJson(
      ['doctor', '--tool', 'claude-code', '--json'],
      createRegistryOverride([currentPlatform]),
    );

    expect(result.exitCode).toBe(3);
    expect(result.body.ok).toBe(false);
    expect(result.body.diagnostics.some((diagnostic: { code?: string }) => diagnostic.code === 'BINARY_NOT_FOUND')).toBe(true);
  });

  it('run --json stops before spawning when the selected platform is unsupported', () => {
    const result = runCliJson(
      ['run', 'hello', '--agent', 'claude-code', '--json', '--no-stream'],
      createRegistryOverride(['definitely-unsupported-platform']),
    );

    expect(result.exitCode).toBe(3);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.code).toBe('PLATFORM_UNSUPPORTED');
  });
});
