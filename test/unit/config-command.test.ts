import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Command } from 'commander';

// Mock platform/paths before importing config command
vi.mock('../../src/platform/paths.js', () => ({
  resolvePaths: () => ({
    configDir: __tmpDir,
    dataDir: path.join(__tmpDir, 'data'),
  }),
}));

import { createConfigCommand } from '../../cmd/config.js';

let __tmpDir: string;

beforeEach(() => {
  __tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cfg-test-'));
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(__tmpDir, { recursive: true, force: true });
});

function writeGlobalConfig(content: string): string {
  const filePath = path.join(__tmpDir, 'config.yaml');
  fs.mkdirSync(__tmpDir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function writeProjectConfig(cwd: string, content: string): string {
  const filePath = path.join(cwd, '.cli-switch.yaml');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/** Run a config subcommand and capture output. */
async function runConfig(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const program = new Command();
  program.exitOverride(); // throw instead of process.exit
  program.allowUnknownOption();
  program.addCommand(createConfigCommand());

  let stdout = '';
  let stderr = '';
  const origLog = console.log;
  const origError = console.error;
  console.log = (...a) => { stdout += a.join(' ') + '\n'; };
  console.error = (...a) => { stderr += a.join(' ') + '\n'; };

  let exitCode = 0;
  const origCwd = process.cwd();
  const origExitCode = process.exitCode;
  process.exitCode = 0;
  if (cwd) process.chdir(cwd);
  try {
    await program.parseAsync(args, { from: 'user' });
  } catch (err: any) {
    if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
      exitCode = 0;
    } else {
      exitCode = err.exitCode ?? 1;
    }
  } finally {
    if (cwd) process.chdir(origCwd);
    exitCode = process.exitCode ?? exitCode;
    process.exitCode = origExitCode;
    console.log = origLog;
    console.error = origError;
  }
  return { stdout, stderr, exitCode };
}

// ─── config show ──────────────────────────────────────────

describe('config show', () => {
  it('shows helpful message when no config files exist', async () => {
    const { stdout } = await runConfig(['config', 'show']);
    expect(stdout).toContain('No configuration found');
    expect(stdout).toContain('config set');
  });

  it('displays merged config with secret redaction', async () => {
    writeGlobalConfig(`
gateway:
  api_key: sk-secret-123
  base_url: https://api.example.com/v1
  default_tier: economy
`);
    const { stdout } = await runConfig(['config', 'show']);
    expect(stdout).toContain('api_key: ***');
    expect(stdout).toContain('base_url: https://api.example.com/v1');
    expect(stdout).toContain('default_tier: economy');
    expect(stdout).toContain('global:');  // source info
    expect(stdout).toContain('loaded');
  });

  it('supports --json output', async () => {
    writeGlobalConfig(`
gateway:
  api_key: sk-secret
  default_tier: premium
`);
    const { stdout } = await runConfig(['config', 'show', '--json']);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.config.gateway.api_key).toBe('***');
    expect(parsed.data.config.gateway.default_tier).toBe('premium');
    expect(parsed.data.sources.global.loaded).toBe(true);
    expect(parsed.schema_version).toBe('v1alpha1');
  });

  it('merges global + project config', async () => {
    writeGlobalConfig(`
gateway:
  default_tier: economy
`);
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-proj-'));
    writeProjectConfig(cwd, `
gateway:
  default_tier: premium
`);
    const { stdout } = await runConfig(['config', 'show'], cwd);
    expect(stdout).toContain('default_tier: premium');
    expect(stdout).toContain('project:');
    expect(stdout).toContain('loaded');
    fs.rmSync(cwd, { recursive: true, force: true });
  });
});

// ─── config set ───────────────────────────────────────────

describe('config set', () => {
  it('writes a value to global config', async () => {
    const { stdout } = await runConfig(['config', 'set', 'gateway.base_url', 'https://api.test.com']);
    expect(stdout).toContain('Set gateway.base_url');
    expect(stdout).toContain('global config');

    // Verify file on disk
    const raw = fs.readFileSync(path.join(__tmpDir, 'config.yaml'), 'utf-8');
    expect(raw).toContain('base_url: https://api.test.com');
  });

  it('parses boolean and numeric values', async () => {
    await runConfig(['config', 'set', 'loop.max_iterations', '10']);
    await runConfig(['config', 'set', 'gateway.enabled', 'true']);

    const raw = fs.readFileSync(path.join(__tmpDir, 'config.yaml'), 'utf-8');
    // YAML will output them correctly
    expect(raw).toContain('max_iterations: 10');
    expect(raw).toContain('enabled: true');
  });

  it('writes to project config with --project', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-proj-'));
    const { stdout } = await runConfig(['config', 'set', 'gateway.default_tier', 'economy', '--project'], cwd);
    expect(stdout).toContain('project config');

    const raw = fs.readFileSync(path.join(cwd, '.cli-switch.yaml'), 'utf-8');
    expect(raw).toContain('default_tier: economy');
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('rejects unknown top-level key', async () => {
    const { stderr, exitCode } = await runConfig(['config', 'set', 'foo.bar', 'baz']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('CONFIG_KEY_NOT_FOUND');
    expect(stderr).toContain('foo');
  });

  it('rejects invalid value via schema validation', async () => {
    const { stderr, exitCode } = await runConfig(['config', 'set', 'gateway.default_tier', 'invalid_tier']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('CONFIG_INVALID');
  });

  it('supports --json output', async () => {
    const { stdout } = await runConfig(['config', 'set', 'gateway.base_url', 'https://test.com', '--json']);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.key).toBe('gateway.base_url');
    expect(parsed.data.value).toBe('https://test.com');
    expect(parsed.data.target).toBe('global');
  });
});

// ─── config reset ─────────────────────────────────────────

describe('config reset', () => {
  it('removes a single key from global config', async () => {
    writeGlobalConfig(`
gateway:
  api_key: sk-test
  base_url: https://api.test.com
`);
    const { stdout } = await runConfig(['config', 'reset', 'gateway.api_key']);
    expect(stdout).toContain('Reset gateway.api_key');

    const raw = fs.readFileSync(path.join(__tmpDir, 'config.yaml'), 'utf-8');
    expect(raw).not.toContain('api_key');
    expect(raw).toContain('base_url');
  });

  it('warns on missing key (no error)', async () => {
    writeGlobalConfig(`
gateway:
  base_url: https://api.test.com
`);
    const { stdout, exitCode } = await runConfig(['config', 'reset', 'gateway.nonexistent']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('not found');
  });

  it('warns when config file does not exist', async () => {
    const { stdout, exitCode } = await runConfig(['config', 'reset', 'gateway.base_url']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('not found');
    expect(stdout).toContain('does not exist');
  });

  it('resets entire config with --all', async () => {
    writeGlobalConfig(`
gateway:
  api_key: sk-test
  base_url: https://api.test.com
`);
    const { stdout } = await runConfig(['config', 'reset', '--all']);
    expect(stdout).toContain('Reset all global configuration');
    expect(fs.existsSync(path.join(__tmpDir, 'config.yaml'))).toBe(false);
  });

  it('resets project config with --project', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-proj-'));
    writeProjectConfig(cwd, `
gateway:
  base_url: https://api.test.com
`);
    const { stdout } = await runConfig(['config', 'reset', '--all', '--project'], cwd);
    expect(stdout).toContain('project configuration');
    expect(fs.existsSync(path.join(cwd, '.cli-switch.yaml'))).toBe(false);
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('errors when neither key nor --all provided', async () => {
    const { stderr, exitCode } = await runConfig(['config', 'reset']);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('INPUT_ERROR');
  });

  it('supports --json output', async () => {
    writeGlobalConfig(`
gateway:
  api_key: sk-test
`);
    const { stdout } = await runConfig(['config', 'reset', 'gateway.api_key', '--json']);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.key).toBe('gateway.api_key');
    expect(parsed.data.found).toBe(true);
  });

  it('--json with missing key returns found: false', async () => {
    const { stdout, exitCode } = await runConfig(['config', 'reset', 'gateway.nonexistent', '--json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.found).toBe(false);
    expect(parsed.warnings.length).toBeGreaterThan(0);
  });

  it('deletes file when last key is removed', async () => {
    writeGlobalConfig(`
gateway:
  base_url: https://api.test.com
`);
    await runConfig(['config', 'reset', 'gateway.base_url']);
    expect(fs.existsSync(path.join(__tmpDir, 'config.yaml'))).toBe(false);
  });
});
