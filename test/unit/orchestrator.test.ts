import { describe, it, expect } from 'vitest';
import { splitTasks, orchestrate } from '../../src/core/orchestrator/orchestrator.js';
import { handoff } from '../../src/core/orchestrator/handoff.js';
import { review } from '../../src/core/orchestrator/review.js';

describe('orchestrator', () => {
  describe('splitTasks', () => {
    it('splits on Chinese connectors', () => {
      expect(splitTasks('写代码并且测试')).toEqual(['写代码', '测试']);
    });

    it('splits on English connectors', () => {
      expect(splitTasks('write code and test it')).toEqual(['write code', 'test it']);
    });

    it('returns single task when no connectors', () => {
      expect(splitTasks('simple task')).toEqual(['simple task']);
    });

    it('splits on then', () => {
      expect(splitTasks('step1 then step2')).toEqual(['step1', 'step2']);
    });

    it('splits on semicolons', () => {
      expect(splitTasks('a; b; c')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('orchestrate', () => {
    it('runs multiple tasks in parallel with echo', async () => {
      const results = await orchestrate('task1 then task2', ['claude-code', 'codex'], {
        timeoutMs: 5000,
        command: 'echo',
      });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.ok)).toBe(true);
    });

    it('handles single task', async () => {
      const results = await orchestrate('single task', ['claude-code'], {
        timeoutMs: 5000,
        command: 'echo',
      });
      expect(results).toHaveLength(1);
      expect(results[0].ok).toBe(true);
    });
  });

  describe('handoff', () => {
    it('chains two agents', async () => {
      const result = await handoff('hello', ['claude-code', 'codex'], {
        timeoutMs: 5000,
        command: 'echo',
      });
      expect(result.ok).toBe(true);
      // Second agent receives output of first
      expect(result.output).toContain('hello');
    });

    it('stops on failure', async () => {
      const result = await handoff('test', ['claude-code', 'codex'], {
        timeoutMs: 5000,
        command: 'false', // always fails
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('review', () => {
    it('runs coder then reviewer', async () => {
      const result = await review('write hello world', 'claude-code', 'codex', {
        timeoutMs: 5000,
        command: 'echo',
      });
      expect(result.code.ok).toBe(true);
      expect(result.review.ok).toBe(true);
    });
  });
});
