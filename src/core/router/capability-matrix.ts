import type { AgentId } from '../../types/agent.js';

export interface AgentCapabilities {
  agentId: AgentId;
  reasoning: number;
  codeGen: number;
  refactoring: number;
  debugging: number;
  testing: number;
  longContext: number;
  speed: number;
  multimodal: number;
  costPerToken: number;
  contextWindow: number;
}

export const DEFAULT_CAPABILITIES: Record<AgentId, AgentCapabilities> = {
  'claude-code': {
    agentId: 'claude-code',
    reasoning: 9,
    codeGen: 9,
    refactoring: 9,
    debugging: 9,
    testing: 7,
    longContext: 10,
    speed: 6,
    multimodal: 7,
    costPerToken: 5,
    contextWindow: 200_000,
  },
  codex: {
    agentId: 'codex',
    reasoning: 8,
    codeGen: 8,
    refactoring: 7,
    debugging: 7,
    testing: 9,
    longContext: 5,
    speed: 9,
    multimodal: 3,
    costPerToken: 7,
    contextWindow: 128_000,
  },
  gemini: {
    agentId: 'gemini',
    reasoning: 8,
    codeGen: 8,
    refactoring: 7,
    debugging: 7,
    testing: 7,
    longContext: 8,
    speed: 8,
    multimodal: 10,
    costPerToken: 8,
    contextWindow: 1_000_000,
  },
  opencode: {
    agentId: 'opencode',
    reasoning: 7,
    codeGen: 7,
    refactoring: 6,
    debugging: 6,
    testing: 6,
    longContext: 5,
    speed: 8,
    multimodal: 3,
    costPerToken: 9,
    contextWindow: 128_000,
  },
  aider: {
    agentId: 'aider',
    reasoning: 7,
    codeGen: 8,
    refactoring: 8,
    debugging: 7,
    testing: 7,
    longContext: 5,
    speed: 7,
    multimodal: 2,
    costPerToken: 8,
    contextWindow: 128_000,
  },
};

const TASK_WEIGHTS: Record<string, Record<keyof Omit<AgentCapabilities, 'agentId' | 'contextWindow' | 'costPerToken'>, number>> = {
  重构: { reasoning: 2, codeGen: 1, refactoring: 3, debugging: 0, testing: 0, longContext: 1, speed: 0, multimodal: 0 },
  调试: { reasoning: 2, codeGen: 0, refactoring: 0, debugging: 3, testing: 0, longContext: 0, speed: 1, multimodal: 0 },
  测试: { reasoning: 0, codeGen: 1, refactoring: 0, debugging: 0, testing: 3, longContext: 0, speed: 1, multimodal: 0 },
  解释: { reasoning: 2, codeGen: 0, refactoring: 0, debugging: 0, testing: 0, longContext: 0, speed: 2, multimodal: 0 },
  代码生成: { reasoning: 0, codeGen: 3, refactoring: 0, debugging: 0, testing: 0, longContext: 0, speed: 2, multimodal: 0 },
};

const DEFAULT_WEIGHTS: Record<string, number> = { reasoning: 1, codeGen: 1, refactoring: 1, debugging: 1, testing: 1, longContext: 1, speed: 1, multimodal: 1 };

export function scoreAgent(taskType: string, _complexity: string, agent: AgentCapabilities): number {
  const weights = TASK_WEIGHTS[taskType] ?? DEFAULT_WEIGHTS;
  let score = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    score += (agent[dim as keyof AgentCapabilities] as number) * weight;
  }
  return score;
}

export interface RankedAgent {
  agent: AgentId;
  score: number;
  reason: string;
}

export function rankAgents(taskType: string, complexity: string): RankedAgent[] {
  const results = (Object.values(DEFAULT_CAPABILITIES) as AgentCapabilities[])
    .map((cap): RankedAgent => {
      const score = scoreAgent(taskType, complexity, cap);
      const topDim = getTopDimension(taskType);
      return {
        agent: cap.agentId,
        score,
        reason: `${topDim}=${(cap as unknown as Record<string, number>)[topDim]}`,
      };
    })
    .sort((a, b) => b.score - a.score);
  return results;
}

function getTopDimension(taskType: string): string {
  const weights = TASK_WEIGHTS[taskType];
  if (!weights) return 'reasoning';
  let best = 'reasoning';
  let bestVal = 0;
  for (const [k, v] of Object.entries(weights)) {
    if (v > bestVal) { bestVal = v; best = k; }
  }
  return best;
}
