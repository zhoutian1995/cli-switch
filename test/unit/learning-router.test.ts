import { describe, it, expect, afterEach } from 'vitest';
import { LearningRouter } from '../../src/core/router/learning-router.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentId } from '../../src/types/agent.js';

function tempPath(): string {
  return join(tmpdir(), `cli-switch-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

describe('LearningRouter', () => {
  const files: string[] = [];

  afterEach(() => {
    for (const f of files) {
      try { if (existsSync(f)) unlinkSync(f); } catch {}
    }
    files.length = 0;
  });

  function createRouter(): { router: LearningRouter; path: string } {
    const p = tempPath();
    files.push(p);
    return { router: new LearningRouter(p), path: p };
  }

  it('records and reads routing history', () => {
    const { router, path } = createRouter();
    router.recordRouting({
      agent: 'claude-code',
      taskType: '调试',
      complexity: '中等',
      success: true,
      durationMs: 1000,
      timestamp: new Date().toISOString(),
    });
    expect(existsSync(path)).toBe(true);
  });

  it('computes stats correctly', () => {
    const { router } = createRouter();
    router.recordRouting({ agent: 'codex', taskType: '测试', complexity: '简单', success: true, durationMs: 500, timestamp: '' });
    router.recordRouting({ agent: 'codex', taskType: '测试', complexity: '简单', success: false, durationMs: 800, timestamp: '' });
    router.recordRouting({ agent: 'codex', taskType: '测试', complexity: '简单', success: true, durationMs: 600, qualityScore: 8, timestamp: '' });

    const stats = router.getStats('codex', '测试');
    expect(stats.totalRuns).toBe(3);
    expect(stats.successRate).toBeCloseTo(2 / 3);
    expect(stats.avgDuration).toBeCloseTo((500 + 800 + 600) / 3);
    expect(stats.avgQuality).toBeCloseTo(8);
  });

  it('suggests agent when success rate > 0.8 with enough samples', () => {
    const { router } = createRouter();
    // 6 successful runs for codex on testing
    for (let i = 0; i < 6; i++) {
      router.recordRouting({ agent: 'codex', taskType: '测试', complexity: '中等', success: true, durationMs: 500, timestamp: '' });
    }
    // 1 failure
    router.recordRouting({ agent: 'codex', taskType: '测试', complexity: '中等', success: false, durationMs: 500, timestamp: '' });

    const suggestion = router.suggestAgent('测试', '中等');
    expect(suggestion).toBe('codex');
  });

  it('returns null when not enough samples', () => {
    const { router } = createRouter();
    router.recordRouting({ agent: 'claude-code', taskType: '调试', complexity: '中等', success: true, durationMs: 1000, timestamp: '' });
    const suggestion = router.suggestAgent('调试', '中等');
    expect(suggestion).toBeNull();
  });
});
