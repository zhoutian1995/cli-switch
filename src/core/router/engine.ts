import type { AgentId, RoutingDecision, TaskIntent } from '../../types/agent.js';
import type { LLMService } from '../llm/service.js';
import { routeWithLLM } from './llm-router.js';

export function route(intent: TaskIntent): RoutingDecision {
  if (intent.needsLongContext) {
    return { agent: 'claude-code', reason: '长上下文需求', confidence: 0.9 };
  }
  if (intent.type === '调试') {
    return { agent: 'claude-code', reason: '调试任务', confidence: 0.9 };
  }
  if (intent.type === '测试') {
    return { agent: 'codex', reason: '测试任务', confidence: 0.9 };
  }
  if (intent.complexity === '跨仓库') {
    return { agent: 'claude-code', reason: '跨仓库复杂度', confidence: 0.9 };
  }
  return { agent: 'claude-code' as AgentId, reason: '默认路由', confidence: 0.5 };
}

export async function routeWithFallback(
  intent: TaskIntent,
  llm?: LLMService | null,
): Promise<RoutingDecision> {
  if (llm) {
    try {
      return await routeWithLLM(intent, llm);
    } catch {
      // Fall through to rules
    }
  }
  return route(intent);
}
