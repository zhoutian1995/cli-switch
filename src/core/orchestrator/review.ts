import type { AgentId, RunResult } from '../../types/agent.js';
import { ProcessManager } from '../dispatcher/process-manager.js';
import { resolveAgentCommand } from '../dispatcher/agent-loader.js';
import { buildResult } from '../aggregator/result-builder.js';

export interface ReviewResult {
  code: RunResult;
  review: RunResult;
}

export async function review(
  input: string,
  coder: AgentId,
  reviewer: AgentId,
  options?: { timeoutMs?: number; command?: string },
): Promise<ReviewResult> {
  const pm = new ProcessManager(2);

  // Step 1: Coder generates code
  const codeStart = Date.now();
  const codeCmd = options?.command
    ? { program: options.command, args: [input] }
    : resolveAgentCommand(coder, input);
  const codeProc = await pm.spawnAgent(coder, codeCmd.args, {
    timeoutMs: options?.timeoutMs,
    command: codeCmd.program,
  });
  const codeResult = buildResult(codeProc, codeStart);

  // Step 2: Reviewer reviews the code
  const reviewInput = codeResult.ok
    ? `Review this code:\n${codeResult.output}`
    : `Code generation failed: ${codeResult.output}`;
  const reviewStart = Date.now();
  const reviewCmd = options?.command
    ? { program: options.command, args: [reviewInput] }
    : resolveAgentCommand(reviewer, reviewInput);
  const reviewProc = await pm.spawnAgent(reviewer, reviewCmd.args, {
    timeoutMs: options?.timeoutMs,
    command: reviewCmd.program,
  });
  const reviewResult = buildResult(reviewProc, reviewStart);

  return { code: codeResult, review: reviewResult };
}
