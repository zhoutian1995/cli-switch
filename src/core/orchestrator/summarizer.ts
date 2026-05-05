import type { LLMService } from '../llm/service.js';

const SUMMARIZER_SYSTEM_PROMPT = `你是代码上下文总结专家。将前一个 Agent 的输出总结为简短的上下文信息，用于传递给下一个 Agent。

要求：
- 保留关键代码片段和决策
- 移除冗余信息
- 添加下一个任务的具体要求
- 输出纯文本，不要 JSON`;

export async function summarizeContext(
  previousOutput: string,
  nextTask: string,
  llm: LLMService,
): Promise<string> {
  const userPrompt = `前一个 Agent 的输出:\n${previousOutput}\n\n下一个任务:\n${nextTask}`;

  return llm.chat(SUMMARIZER_SYSTEM_PROMPT, userPrompt);
}
