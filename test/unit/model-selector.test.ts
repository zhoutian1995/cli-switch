import { describe, it, expect } from 'vitest';
import { selectModel, buildModelArgs } from '../../src/core/router/model-selector.js';

describe('ModelSelector', () => {
  it('selects strong reasoning model for complex refactoring', () => {
    const sel = selectModel('claude-code' as any, {
      type: '重构',
      complexity: '多文件',
      needsLongContext: false,
      techStack: [],
      rawInput: 'refactor entire app',
    });
    expect(sel.model).toContain('opus');
  });

  it('selects fast model for simple tasks', () => {
    const sel = selectModel('claude-code' as any, {
      type: 'debugging',
      complexity: '单文件',
      needsLongContext: false,
      techStack: [],
      rawInput: 'fix typo',
    });
    expect(sel.model).toContain('haiku');
  });

  it('selects default model for codex agent', () => {
    const sel = selectModel('codex' as any, {
      type: 'code-generation',
      complexity: 'medium',
      needsLongContext: false,
      techStack: [],
      rawInput: 'write code',
    });
    expect(sel.model).toBeTruthy();
  });

  it('buildModelArgs returns correct CLI args for anthropic', () => {
    const args = buildModelArgs({
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      reason: 'balanced',
    });
    expect(args).toEqual(['--model', 'claude-sonnet-4']);
  });

  it('buildModelArgs returns correct CLI args for openai', () => {
    const args = buildModelArgs({
      model: 'gpt-4.1',
      provider: 'openai',
      reason: 'fast',
    });
    expect(args).toEqual(['-m', 'gpt-4.1']);
  });

  it('defaults to first model for unknown complexity', () => {
    const sel = selectModel('claude-code' as any, {
      type: 'code-generation',
      complexity: 'medium',
      needsLongContext: false,
      techStack: [],
      rawInput: 'write code',
    });
    expect(sel.model).toBe('claude-sonnet-4');
  });
});
