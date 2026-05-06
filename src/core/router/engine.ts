import type { AgentId, RoutingDecision, TaskIntent } from '../../types/agent.js';
import type { CapabilityId } from '../../types/capability.js';
import type { LLMService } from '../llm/service.js';
import { routeByCapability } from './capability-router.js';
import { routeWithLLM } from './llm-router.js';

/**
 * Legacy rule-based routing (intent type → agent).
 * Kept as fallback when capability routing is unavailable.
 */
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

/**
 * Route with fallback chain:
 *
 * 1. Capability-based rules (highest priority, routing-spec §2.2)
 * 2. LLM-assisted routing (if LLM service available)
 * 3. Legacy intent-based rules (final fallback)
 */
export async function routeWithFallback(
  intent: TaskIntent,
  llm?: LLMService | null,
  capability?: CapabilityId,
): Promise<RoutingDecision> {
  // 1. Capability-based routing (v0.2 Auto mode)
  if (capability) {
    const capRoute = routeByCapability(capability);
    if (capRoute) {
      return {
        agent: capRoute.agent,
        reason: capRoute.reason,
        confidence: 0.95,
      };
    }
  }

  // 2. LLM-assisted routing
  if (llm) {
    try {
      return await routeWithLLM(intent, llm);
    } catch {
      // Fall through to rules
    }
  }

  // 3. Legacy intent-based rules
  return route(intent);
}
