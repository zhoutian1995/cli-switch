import type { LLMService } from '../llm/service.js';
import type { RoutingDecision, TaskIntent } from '../../types/agent.js';
import { DEFAULT_CAPABILITIES, scoreAgent } from './capability-matrix.js';

const ROUTER_SYSTEM_PROMPT = `你是 Agent 路由专家。根据任务意图选择最合适的 Agent。

可选 Agent：
- claude-code：擅长推理、长上下文、重构
- codex：擅长快速生成、测试

返回 JSON: {"agent":"claude-code|codex","model":"可选","reason":"原因","confidence":0.0到1.0}
只返回 JSON，不要其他内容。`;

export async function routeWithLLM(
  intent: TaskIntent,
  llm: LLMService,
): Promise<RoutingDecision> {
  // Build capability summary for system prompt
  const capSummary = Object.entries(DEFAULT_CAPABILITIES)
    .map(([id, cap]) => {
      const s = scoreAgent(intent.type, intent.complexity, cap);
      return `${id}: score=${s}, ctx=${cap.contextWindow}`;
    })
    .join('\n');

  const systemPrompt = ROUTER_SYSTEM_PROMPT + '\n\nCapability scores for this task type:\n' + capSummary;

  const userPrompt = JSON.stringify({
    type: intent.type,
    complexity: intent.complexity,
    needsLongContext: intent.needsLongContext,
    techStack: intent.techStack,
    rawInput: intent.rawInput,
  });

  return llm.chatJSON<RoutingDecision>(systemPrompt, userPrompt);
}
