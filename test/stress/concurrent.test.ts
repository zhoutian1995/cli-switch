import { describe, it, expect, afterEach } from 'vitest';
import { ProcessManager } from '../../src/core/dispatcher/process-manager.js';

describe('ProcessManager concurrency', () => {
  let pm: ProcessManager;

  afterEach(() => {
    pm?.killAll();
  });

  it('runs up to maxConcurrency processes in parallel', async () => {
    pm = new ProcessManager(3);
    const start = Date.now();
    const promises = [
      pm.spawnAgent('claude-code', ['task1'], { timeoutMs: 5000, command: 'echo' }),
      pm.spawnAgent('codex', ['task2'], { timeoutMs: 5000, command: 'echo' }),
      pm.spawnAgent('claude-code', ['task3'], { timeoutMs: 5000, command: 'echo' }),
    ];
    const results = await Promise.all(promises);
    const elapsed = Date.now() - start;
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'completed')).toBe(true);
    // All 3 should run concurrently (< 1s total for echo)
    expect(elapsed).toBeLessThan(2000);
  });

  it('queues processes beyond maxConcurrency', async () => {
    pm = new ProcessManager(3);
    const stats = pm.getStats();
    expect(stats.maxConcurrency).toBe(3);

    // Start 5 processes with maxConcurrency=3
    const promises = Array.from({ length: 5 }, (_, i) =>
      pm.spawnAgent('claude-code', [`task${i}`], { timeoutMs: 5000, command: 'echo' }),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.status === 'completed')).toBe(true);
  });

  it('completes all 10 short-lived processes', async () => {
    pm = new ProcessManager(3);
    const promises = Array.from({ length: 10 }, (_, i) =>
      pm.spawnAgent('claude-code', [`p${i}`], { timeoutMs: 5000, command: 'echo' }),
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    expect(results.every((r) => r.status === 'completed')).toBe(true);
    expect(results.every((r) => r.stdout.includes('p'))).toBe(true);
  });

  it('getStats returns correct values', async () => {
    pm = new ProcessManager(2);
    expect(pm.getStats()).toEqual({ running: 0, queued: 0, maxConcurrency: 2 });
  });
});
