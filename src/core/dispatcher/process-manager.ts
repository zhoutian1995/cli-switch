import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import type { AgentId, AgentProcess } from '../../types/agent.js';

/** Command override map: agentId → executable name */
const AGENT_COMMAND_MAP: Record<string, string> = {
  'claude-code': 'claude',
  codex: 'codex',
  gemini: 'gemini',
};

export class ProcessManager {
  private processes = new Map<
    string,
    { proc: ChildProcess; info: AgentProcess; timer?: ReturnType<typeof setTimeout> }
  >();

  /**
   * Spawn an agent subprocess.
   *
   * For testability, if `options.command` is provided it overrides the
   * resolved executable (useful with `echo`, `sleep`, etc.).
   */
  async spawnAgent(
    agentId: AgentId,
    args: string[],
    options?: {
      cwd?: string;
      timeoutMs?: number;
      maxMemoryMb?: number;
      env?: Record<string, string>;
      /** Override the executable binary (for testing). */
      command?: string;
    },
  ): Promise<AgentProcess> {
    const id = randomUUID();
    const command =
      options?.command ?? AGENT_COMMAND_MAP[agentId] ?? agentId;
    const info: AgentProcess = {
      id,
      agent: agentId,
      status: 'starting',
      stdout: '',
      stderr: '',
    };

    return new Promise<AgentProcess>((resolve) => {
      const proc = spawn(command, args, {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        // Resource limits — rssBytes is soft limit on macOS (Node ≥22)
        ...(options?.maxMemoryMb
          ? { resourceLimits: { maxOldGenerationSizeMb: options.maxMemoryMb } }
          : {}),
      });

      info.pid = proc.pid ?? undefined;
      info.status = 'running';

      const timeout = options?.timeoutMs;
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (timeout) {
        timer = setTimeout(() => {
          proc.kill('SIGKILL');
          info.status = 'failed';
          info.stderr += '\n[timeout] process killed';
        }, timeout);
      }

      proc.stdout?.on('data', (data: Buffer) => {
        info.stdout += data.toString();
      });
      proc.stderr?.on('data', (data: Buffer) => {
        info.stderr += data.toString();
      });

      proc.on('error', (err) => {
        info.status = 'failed';
        info.stderr += err.message;
        this.processes.delete(id);
        resolve(info);
      });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        info.exitCode = code ?? undefined;
        info.status = code === 0 ? 'completed' : 'failed';
        this.processes.delete(id);
        resolve(info);
      });

      this.processes.set(id, { proc, info, timer });
    });
  }

  listProcesses(): AgentProcess[] {
    return Array.from(this.processes.values()).map((e) => ({ ...e.info }));
  }

  killProcess(id: string): boolean {
    const entry = this.processes.get(id);
    if (!entry) return false;
    entry.proc.kill('SIGKILL');
    if (entry.timer) clearTimeout(entry.timer);
    entry.info.status = 'failed';
    this.processes.delete(id);
    return true;
  }

  killAll(): void {
    for (const [id] of this.processes) {
      this.killProcess(id);
    }
  }
}
