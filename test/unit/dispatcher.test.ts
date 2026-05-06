import { existsSync } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { ProcessManager } from '../../src/core/dispatcher/process-manager.js';

describe('ProcessManager', () => {
  let pm: ProcessManager;

  afterEach(() => {
    pm?.killAll();
  });

  it('spawns a command and captures stdout', async () => {
    pm = new ProcessManager();
    const result = await pm.spawnAgent('claude-code', ['hello from agent'], {
      timeoutMs: 5000,
      command: 'echo',
    });
    expect(result.agent).toBe('claude-code');
    expect(result.status).toBe('completed');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello from agent');
  });

  it('handles non-zero exit code', async () => {
    pm = new ProcessManager();
    const result = await pm.spawnAgent('codex', ['-c', 'exit 1'], {
      timeoutMs: 5000,
      command: 'bash',
    });
    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(1);
  });

  it('kills a process on timeout', async () => {
    pm = new ProcessManager();
    const result = await pm.spawnAgent('claude-code', ['60'], {
      timeoutMs: 500,
      command: 'sleep',
    });
    expect(result.status).toBe('failed');
    expect(result.stderr).toContain('timeout');
  }, 10_000);

  it('killProcess returns false for unknown id', () => {
    pm = new ProcessManager();
    expect(pm.killProcess('nonexistent')).toBe(false);
  });

  it('killAll clears all processes', () => {
    pm = new ProcessManager();
    pm.killAll();
    expect(pm.listProcesses()).toHaveLength(0);
  });

  it('listProcesses returns running processes', async () => {
    pm = new ProcessManager();
    // Start a long sleep but don't await
    const promise = pm.spawnAgent('claude-code', ['10'], {
      timeoutMs: 5000,
      command: 'sleep',
    });
    // Give it a moment to start
    await new Promise((r) => setTimeout(r, 100));
    const running = pm.listProcesses();
    expect(running.length).toBeGreaterThanOrEqual(1);
    // Wait for it to finish
    await promise;
  }, 10_000);

  it('handles missing command gracefully', async () => {
    pm = new ProcessManager();
    const result = await pm.spawnAgent('claude-code', [], {
      timeoutMs: 5000,
      command: 'nonexistent_command_xyz_12345',
    });
    expect(result.status).toBe('failed');
    expect(result.stderr).toBeTruthy();
  });

  it('isolates child env with overlay precedence and parent session scrubbing', async () => {
    const originalClaudeCode = process.env.CLAUDECODE;
    const originalCodexSessionId = process.env.CODEX_SESSION_ID;
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.CLAUDECODE = 'host-session';
    process.env.CODEX_SESSION_ID = 'host-codex-session';
    process.env.ANTHROPIC_API_KEY = 'host-key';

    try {
      pm = new ProcessManager();
      const script = [
        'process.stdout.write(JSON.stringify({',
        '  leaked: process.env.CLAUDECODE ?? null,',
        '  codexSessionId: process.env.CODEX_SESSION_ID ?? null,',
        '  apiKey: process.env.ANTHROPIC_API_KEY ?? null',
        '}));',
      ].join('\n');
      const result = await pm.spawnAgent('claude-code', ['-e', script], {
        timeoutMs: 5000,
        command: 'node',
        env: { ANTHROPIC_API_KEY: 'sandbox-key' },
      });

      expect(JSON.parse(result.stdout)).toEqual({
        leaked: null,
        codexSessionId: null,
        apiKey: 'sandbox-key',
      });
    } finally {
      if (originalClaudeCode === undefined) {
        delete process.env.CLAUDECODE;
      } else {
        process.env.CLAUDECODE = originalClaudeCode;
      }
      if (originalCodexSessionId === undefined) {
        delete process.env.CODEX_SESSION_ID;
      } else {
        process.env.CODEX_SESSION_ID = originalCodexSessionId;
      }
      if (originalApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = originalApiKey;
      }
    }
  });

  it('gives gateway env higher priority than host and regular env overlays', async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'host-key';

    try {
      pm = new ProcessManager();
      const script = 'process.stdout.write(process.env.OPENAI_API_KEY ?? "");';
      const result = await pm.spawnAgent('codex', ['-e', script], {
        timeoutMs: 5000,
        command: 'node',
        env: { OPENAI_API_KEY: 'regular-overlay-key' },
        gatewayEnv: { OPENAI_API_KEY: 'gateway-key' },
      });

      expect(result.stdout).toBe('gateway-key');
    } finally {
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
    }
  });

  it('uses an isolated HOME and cleans it up after exit', async () => {
    pm = new ProcessManager();
    const script = [
      'const { existsSync } = require("node:fs");',
      'const { join } = require("node:path");',
      'const home = process.env.HOME ?? "";',
      'process.stdout.write(JSON.stringify({',
      '  home,',
      '  claudeConfig: existsSync(join(home, ".claude")),',
      '  codexConfig: existsSync(join(home, ".codex")),',
      '  config: existsSync(join(home, ".config"))',
      '}));',
    ].join('\n');
    const result = await pm.spawnAgent('codex', ['-e', script], {
      timeoutMs: 5000,
      command: 'node',
      sandbox: { homeIsolation: true, taskId: 'unit-home' },
    });

    const parsed = JSON.parse(result.stdout);
    const home = parsed.home;
    expect(home).toContain('cli-switch-unit-home-');
    expect(home.endsWith('/home')).toBe(true);
    expect(parsed.claudeConfig).toBe(false);
    expect(parsed.codexConfig).toBe(false);
    expect(parsed.config).toBe(false);
    expect(existsSync(home)).toBe(false);
  });
});
