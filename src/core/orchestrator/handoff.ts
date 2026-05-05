import type { AgentId, RunResult } from '../../types/agent.js';
import { ProcessManager } from '../dispatcher/process-manager.js';
import { resolveAgentCommand } from '../dispatcher/agent-loader.js';
import { buildResult } from '../aggregator/result-builder.js';

export async function handoff(
  input: string,
  agentChain: AgentId[],
  options?: { timeoutMs?: number; command?: string },
): Promise<RunResult> {
  let currentInput = input;
  let lastResult: RunResult | null = null;

  for (const agentId of agentChain) {
    const startTime = Date.now();
    const cmd = options?.command
      ? { program: options.command, args: [currentInput] }
      : resolveAgentCommand(agentId, currentInput);

    const pm = new ProcessManager();
    const proc = await pm.spawnAgent(agentId, cmd.args, {
      timeoutMs: options?.timeoutMs,
      command: cmd.program,
    });

    lastResult = buildResult(proc, startTime);

    if (!lastResult.ok) {
      return lastResult;
    }

    // Feed output to next agent
    currentInput = lastResult.output;
  }

  return lastResult!;
}
