import { describe, it, expect, vi } from 'vitest';
import { routeWithLLM } from '../../src/core/router/llm-router.js';
import { LLMService } from '../../src/core/llm/service.js';
import type { TaskIntent } from '../../src/types/agent.js';

const mockIntent: TaskIntent = {
  type: '代码生成',
  complexity: '单文件',
  needsLongContext: false,
  techStack: ['typescript'],
  rawInput: 'create a hello world function',
};

describe('routeWithLLM', () => {
  it('should return valid RoutingDecision', async () => {
    const llm = new LLMService({ baseUrl: 'http://test', apiKey: 'k', model: 'm' });
    vi.spyOn(llm, 'chatJSON').mockResolvedValue({
      agent: 'codex',
      reason: 'simple generation task',
      confidence: 0.85,
    } as never);

    const decision = await routeWithLLM(mockIntent, llm);
    expect(decision.agent).toBe('codex');
    expect(decision.confidence).toBe(0.85);
    expect(decision.reason).toBe('simple generation task');
  });
});
