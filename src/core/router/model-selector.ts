import type { AgentId, TaskIntent } from '../../types/agent.js';

export interface ModelInfo {
  id: string;
  label: string;
  costPerToken: number;
  contextWindow: number;
  reasoning: number;
  speed: number;
}

export interface ModelSelection {
  model: string;
  provider: string;
  reason: string;
  maxTokens?: number;
  temperature?: number;
}

const MODEL_MAP: Record<AgentId, ModelInfo[]> = {
  'claude-code': [
    { id: 'claude-sonnet-4', label: 'Sonnet 4', costPerToken: 5, contextWindow: 200000, reasoning: 9, speed: 7 },
    { id: 'claude-opus-4', label: 'Opus 4', costPerToken: 2, contextWindow: 200000, reasoning: 10, speed: 4 },
    { id: 'claude-haiku-3.5', label: 'Haiku 3.5', costPerToken: 8, contextWindow: 200000, reasoning: 7, speed: 10 },
  ],
  codex: [
    { id: 'gpt-4.1', label: 'GPT-4.1', costPerToken: 5, contextWindow: 128000, reasoning: 8, speed: 7 },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', costPerToken: 8, contextWindow: 128000, reasoning: 7, speed: 9 },
    { id: 'o4-mini', label: 'o4-mini', costPerToken: 6, contextWindow: 128000, reasoning: 9, speed: 6 },
  ],
  gemini: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', costPerToken: 4, contextWindow: 1000000, reasoning: 9, speed: 6 },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', costPerToken: 9, contextWindow: 1000000, reasoning: 7, speed: 10 },
  ],
  opencode: [
    { id: 'default', label: 'Default', costPerToken: 5, contextWindow: 128000, reasoning: 7, speed: 8 },
  ],
  aider: [
    { id: 'default', label: 'Default', costPerToken: 5, contextWindow: 128000, reasoning: 7, speed: 8 },
  ],
};

const PROVIDER_MAP: Record<AgentId, string> = {
  'claude-code': 'anthropic',
  codex: 'openai',
  gemini: 'google',
  opencode: 'unknown',
  aider: 'unknown',
};

const REASONING_TYPES = new Set(['调试', '重构', '跨仓库']);

export function selectModel(
  agent: AgentId,
  intent: TaskIntent,
): ModelSelection {
  const models = MODEL_MAP[agent] ?? MODEL_MAP['claude-code'];
  const provider = PROVIDER_MAP[agent] ?? 'unknown';

  // Long context → prefer large context window
  if (intent.needsLongContext) {
    const best = models.reduce((a, b) => a.contextWindow >= b.contextWindow ? a : b);
    return {
      model: best.id,
      provider,
      reason: `Long context needed → ${best.label} (${(best.contextWindow / 1000)}k context)`,
      maxTokens: Math.min(best.contextWindow, 64000),
    };
  }

  const needsReasoning = REASONING_TYPES.has(intent.type) || intent.complexity === '跨仓库';

  // High complexity + reasoning → strongest model
  if (needsReasoning && (intent.complexity === '跨仓库' || intent.complexity === '多文件')) {
    const best = models.reduce((a, b) => a.reasoning >= b.reasoning ? a : b);
    return {
      model: best.id,
      provider,
      reason: `Complex ${intent.type} task → ${best.label} (reasoning: ${best.reasoning}/10)`,
      maxTokens: 32000,
      temperature: 0.2,
    };
  }

  // Low complexity → fastest model
  if (intent.complexity === '单文件') {
    const best = models.reduce((a, b) => a.speed >= b.speed ? a : b);
    return {
      model: best.id,
      provider,
      reason: `Simple task → ${best.label} (speed: ${best.speed}/10)`,
      maxTokens: 16000,
      temperature: 0.5,
    };
  }

  // Default → middle model (highest costPerToken balance, or just pick index 0)
  const mid = models[0];
  return {
    model: mid.id,
    provider,
    reason: `Default → ${mid.label}`,
    maxTokens: 32000,
    temperature: 0.3,
  };
}

export function buildModelArgs(selection: ModelSelection): string[] {
  const model = selection.model;
  // Provider-based arg format
  switch (selection.provider) {
    case 'anthropic':
      return ['--model', model];
    case 'openai':
      return ['-m', model];
    case 'google':
      return ['-m', model];
    default:
      return ['--model', model];
  }
}
