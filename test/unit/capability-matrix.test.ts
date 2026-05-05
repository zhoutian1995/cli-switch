import { describe, it, expect } from 'vitest';
import { scoreAgent, rankAgents, DEFAULT_CAPABILITIES } from '../../src/core/router/capability-matrix.js';

describe('scoreAgent', () => {
  it('scores refactoring tasks with correct weights', () => {
    const claude = DEFAULT_CAPABILITIES['claude-code'];
    const score = scoreAgent('重构', '中等', claude);
    // reasoning*2 + codeGen*1 + refactoring*3 + longContext*1 = 9*2+9*1+9*3+10*1 = 64
    expect(score).toBe(64);
  });

  it('scores debugging tasks with correct weights', () => {
    const claude = DEFAULT_CAPABILITIES['claude-code'];
    const score = scoreAgent('调试', '中等', claude);
    // debugging*3 + reasoning*2 + speed*1 = 9*3+9*2+6*1 = 51
    expect(score).toBe(51);
  });

  it('scores testing tasks with correct weights', () => {
    const codex = DEFAULT_CAPABILITIES['codex'];
    const score = scoreAgent('测试', '中等', codex);
    // testing*3 + codeGen*1 + speed*1 = 9*3+8*1+9*1 = 44
    expect(score).toBe(44);
  });

  it('uses default weights for unknown task types', () => {
    const claude = DEFAULT_CAPABILITIES['claude-code'];
    const score = scoreAgent('未知', '中等', claude);
    // all dims * 1 = 9+9+9+9+7+10+6+7 = 66
    expect(score).toBe(66);
  });

  it('scores code generation correctly', () => {
    const codex = DEFAULT_CAPABILITIES['codex'];
    const score = scoreAgent('代码生成', '中等', codex);
    // codeGen*3 + speed*2 = 8*3+9*2 = 42
    expect(score).toBe(42);
  });
});

describe('rankAgents', () => {
  it('ranks agents for refactoring — claude-code should be first', () => {
    const ranked = rankAgents('重构', '中等');
    expect(ranked[0].agent).toBe('claude-code');
    expect(ranked.length).toBe(5);
  });

  it('ranks agents for testing — codex should be first', () => {
    const ranked = rankAgents('测试', '中等');
    expect(ranked[0].agent).toBe('codex');
  });

  it('returns results sorted by score descending', () => {
    const ranked = rankAgents('代码生成', '中等');
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});
