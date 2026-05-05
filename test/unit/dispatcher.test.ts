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
});
