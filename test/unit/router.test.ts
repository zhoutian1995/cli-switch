import { describe, it, expect } from 'vitest';
import { route, routeWithFallback } from '../../src/core/router/engine.js';
import type { TaskIntent } from '../../src/types/agent.js';

describe('router', () => {
  const base = (overrides: Partial<TaskIntent> = {}): TaskIntent => ({
    type: '代码生成',
    complexity: '单文件',
    needsLongContext: false,
    techStack: [],
    rawInput: 'test',
    ...overrides,
  });

  it('routes long context to claude-code', () => {
    const decision = route(base({ needsLongContext: true }));
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.9);
  });

  it('routes debug tasks to claude-code', () => {
    const decision = route(base({ type: '调试' }));
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.9);
  });

  it('routes test tasks to codex', () => {
    const decision = route(base({ type: '测试' }));
    expect(decision.agent).toBe('codex');
    expect(decision.confidence).toBe(0.9);
  });

  it('routes cross-repo tasks to claude-code', () => {
    const decision = route(base({ complexity: '跨仓库' }));
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.9);
  });

  it('defaults to claude-code with low confidence', () => {
    const decision = route(base());
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.5);
  });

  it('refactor defaults to claude-code', () => {
    const decision = route(base({ type: '重构' }));
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.5);
  });
});

describe('routeWithFallback — priority chain', () => {
  const base = (overrides: Partial<TaskIntent> = {}): TaskIntent => ({
    type: '代码生成',
    complexity: '单文件',
    needsLongContext: false,
    techStack: [],
    rawInput: 'test',
    ...overrides,
  });

  it('capability routing wins over legacy rules', async () => {
    // Legacy: 测试 → codex. But capability write_code → claude-code.
    const intent = base({ type: '测试' });
    const decision = await routeWithFallback(intent, null, 'write_code');
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.95);
  });

  it('capability routing wins over legacy even without LLM', async () => {
    const intent = base({ type: '解释' });
    const decision = await routeWithFallback(intent, null, 'fix_error');
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.95);
  });

  it('backward compat: no capability → falls to legacy rules', async () => {
    const intent = base({ type: '测试' });
    const decision = await routeWithFallback(intent, null);
    expect(decision.agent).toBe('codex');
    expect(decision.confidence).toBe(0.9);
  });

  it('backward compat: no capability + default intent → legacy fallback', async () => {
    const intent = base({ type: '代码生成' });
    const decision = await routeWithFallback(intent, null);
    expect(decision.agent).toBe('claude-code');
    expect(decision.confidence).toBe(0.5); // legacy default
  });

  it('analyze capability → codex (not claude-code)', async () => {
    const intent = base({ type: '调试' }); // legacy would route to claude-code
    const decision = await routeWithFallback(intent, null, 'analyze');
    expect(decision.agent).toBe('codex');
    expect(decision.confidence).toBe(0.95);
  });
});
