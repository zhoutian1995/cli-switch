import { describe, it, expect } from 'vitest';
import { resolveCapability } from '../../src/core/capability/resolver.js';
import type { TaskIntent } from '../../src/types/agent.js';

describe('Capability Resolver', () => {
  function makeIntent(type: string, rawInput: string): TaskIntent {
    return { type, complexity: '单文件', needsLongContext: false, techStack: [], rawInput };
  }

  describe('base mapping', () => {
    it('maps 代码生成 → write_code', () => {
      expect(resolveCapability(makeIntent('代码生成', 'add a hello function'))).toBe('write_code');
    });

    it('maps 代码审查 → review_code', () => {
      expect(resolveCapability(makeIntent('代码审查', 'review the PR'))).toBe('review_code');
    });

    it('maps 重构 → refactor', () => {
      expect(resolveCapability(makeIntent('重构', 'refactor the auth module'))).toBe('refactor');
    });

    it('maps 调试 → fix_error', () => {
      expect(resolveCapability(makeIntent('调试', 'fix the login bug'))).toBe('fix_error');
    });

    it('maps 测试 → write_tests', () => {
      expect(resolveCapability(makeIntent('测试', 'write unit tests for parser'))).toBe('write_tests');
    });

    it('maps 解释 → explain', () => {
      expect(resolveCapability(makeIntent('解释', 'explain how the router works'))).toBe('explain');
    });

    it('maps unknown type → write_code (default)', () => {
      expect(resolveCapability(makeIntent('未知类型', 'do something'))).toBe('write_code');
    });
  });

  describe('sub-classification', () => {
    it('maps 调试 + analyze hint → analyze', () => {
      expect(resolveCapability(makeIntent('调试', '分析一下这个错误'))).toBe('analyze');
    });

    it('maps 调试 + inspect hint → analyze', () => {
      expect(resolveCapability(makeIntent('调试', 'inspect the memory leak'))).toBe('analyze');
    });

    it('maps 调试 + no analyze hint → fix_error', () => {
      expect(resolveCapability(makeIntent('调试', 'fix the null pointer error'))).toBe('fix_error');
    });

    it('maps 测试 + run hint → run_tests', () => {
      expect(resolveCapability(makeIntent('测试', 'run the test suite'))).toBe('run_tests');
    });

    it('maps 测试 + 跑 hint → run_tests', () => {
      expect(resolveCapability(makeIntent('测试', '跑一下测试'))).toBe('run_tests');
    });

    it('maps 测试 + no run hint → write_tests', () => {
      expect(resolveCapability(makeIntent('测试', 'add test cases for login'))).toBe('write_tests');
    });
  });

  describe('Chinese analysis requests', () => {
    it('maps 解释 + 分析 → analyze', () => {
      expect(resolveCapability(makeIntent('解释', '分析一下这个错误'))).toBe('analyze');
    });

    it('maps 解释 + 为什么 → analyze', () => {
      expect(resolveCapability(makeIntent('解释', '为什么登录失败'))).toBe('analyze');
    });

    it('maps 解释 + 看看 → analyze', () => {
      expect(resolveCapability(makeIntent('解释', '看看这个函数的逻辑'))).toBe('analyze');
    });

    it('maps 解释 + 怎么回事 → analyze', () => {
      expect(resolveCapability(makeIntent('解释', '这个bug怎么回事'))).toBe('analyze');
    });

    it('maps 解释 without analyze hints → explain', () => {
      expect(resolveCapability(makeIntent('解释', 'explain this code'))).toBe('explain');
    });
  });
});
