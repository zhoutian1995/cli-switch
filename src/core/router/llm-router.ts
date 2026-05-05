import type { LLMService } from '../llm/service.js';
import type { RoutingDecision, TaskIntent } from '../../types/agent.js';

const ROUTER_SYSTEM_PROMPT = `你是 Agent 路由专家。根据任务意图选择最合适的 Agent。

可选 Agent：
- claude-code：擅长推理、长上下文、重构
- codex：擅长快速生成、测试
- gemini：擅长多模态

返回 JSON: {"agent":"claude-code|codex|gemini","model":"可选","reason":"原因","confidence":0.0到1.0}
只返回 JSON，不要其他内容。`;

export async function routeWithLLM(
  intent: TaskIntent,
  llm: LLMService,
): Promise<RoutingDecision> {
  const userPrompt = JSON.stringify({
    type: intent.type,
    complexity: intent.complexity,
    needsLongContext: intent.needsLongContext,
    techStack: intent.techStack,
    rawInput: intent.rawInput,
  });

  return llm.chatJSON<RoutingDecision>(ROUTER_SYSTEM_PROMPT, userPrompt);
}
