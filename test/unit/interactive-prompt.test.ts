import { describe, it, expect } from 'vitest';
import { InteractivePrompt } from '../../src/core/ui/prompt.js';
import type { AgentId } from '../../src/types/agent.js';

describe('InteractivePrompt', () => {
  it('selectAgent returns default in non-TTY', async () => {
    // In test env, process.stdout.isTTY is undefined → non-TTY
    const ranked = [
      { agent: 'claude-code' as AgentId, score: 90, reason: 'best' },
      { agent: 'codex' as AgentId, score: 70, reason: 'fast' },
    ];
    const result = await InteractivePrompt.selectAgent(ranked, 'codex' as AgentId);
    expect(result).toBe('codex');
  });

  it('confirmRouting returns true in non-TTY', async () => {
    const result = await InteractivePrompt.confirmRouting('claude-code' as AgentId, 'test', 0.9);
    expect(result).toBe(true);
  });

  it('selectMode returns single in non-TTY', async () => {
    const result = await InteractivePrompt.selectMode();
    expect(result).toBe('single');
  });
});
