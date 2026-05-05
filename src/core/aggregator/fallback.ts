import type { AgentId } from '../../types/agent.js';

export interface FallbackChain {
  primary: AgentId;
  fallbacks: AgentId[];
}

const DEFAULT_CHAINS: Record<string, FallbackChain> = {
  'claude-code': { primary: 'claude-code', fallbacks: ['codex', 'gemini'] },
  codex: { primary: 'codex', fallbacks: ['claude-code'] },
  gemini: { primary: 'gemini', fallbacks: ['claude-code'] },
};

export function getFallbackChain(agentId: AgentId): FallbackChain {
  return DEFAULT_CHAINS[agentId] ?? { primary: agentId, fallbacks: [] };
}

export function suggestFallback(failedAgent: AgentId, _error: string): AgentId | null {
  const chain = getFallbackChain(failedAgent);
  return chain.fallbacks[0] ?? null;
}
