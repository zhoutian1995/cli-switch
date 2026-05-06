import type { AgentId, RunResult } from '../../types/agent.js';
import { ProcessManager } from '../dispatcher/process-manager.js';
import { resolveAgentCommand } from '../dispatcher/agent-loader.js';
import { buildResult } from '../aggregator/result-builder.js';

const SPLIT_PATTERNS = /并且|然后|以及|还有|;\s*|\band\b|\bthen\b/gi;

export async function orchestrate(
  input: string,
  agents: AgentId[],
  options?: { timeoutMs?: number; command?: string },
): Promise<RunResult[]> {
  const tasks = splitTasks(input);
  const pm = new ProcessManager(Math.min(3, agents.length));
  const results: RunResult[] = [];

  const promises = tasks.map(async (task, i) => {
    const agentId = agents[i % agents.length];
    const startTime = Date.now();
    const cmd = options?.command
      ? { program: options.command, args: [task] }
      : resolveAgentCommand(agentId, task);

    const proc = await pm.spawnAgent(agentId, cmd.args, {
      timeoutMs: options?.timeoutMs,
      command: cmd.program,
    });

    return buildResult(proc, startTime);
  });

  const settled = await Promise.all(promises);
  results.push(...settled);
  return results;
}

export function splitTasks(input: string): string[] {
  const parts = input.split(SPLIT_PATTERNS).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [input];
}
