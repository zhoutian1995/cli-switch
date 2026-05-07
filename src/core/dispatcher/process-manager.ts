import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import type { AgentId, AgentProcess } from '../../types/agent.js';
import type { GitGuard, GitCheckpoint } from '../git/guard.js';
import { createSandbox, type SandboxOptions } from '../sandbox/index.js';

/** Maximum per-stream buffer size (10 MB). */
const MAX_STREAM_SIZE = 10 * 1024 * 1024;

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
  private maxConcurrency: number;
  private queue: Array<{ resolve: (value: void) => void; reject: (reason: unknown) => void }> = [];
  private running = 0;

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

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
      /** Gateway env vars (highest priority, overrides native API keys). */
      gatewayEnv?: Record<string, string>;
      /** Child-process sandbox options. Env isolation is always applied. */
      sandbox?: SandboxOptions;
      /** Override the executable binary (for testing). */
      command?: string;
      /** Optional Git guard for branch/checkpoint management */
      gitGuard?: GitGuard;
      /** Real-time stdout chunk callback for streaming. */
      onChunk?: (chunk: string) => void;
    },
  ): Promise<AgentProcess & { checkpoint?: GitCheckpoint | null }> {
    // Concurrency control: wait if at capacity
    if (this.running >= this.maxConcurrency) {
      await new Promise<void>((resolve, reject) => {
        this.queue.push({ resolve, reject });
      });
    }
    this.running++;

    const id = randomUUID();
    const command =
      options?.command ?? AGENT_COMMAND_MAP[agentId] ?? agentId;
    const info: AgentProcess & { checkpoint?: GitCheckpoint | null } = {
      id,
      agent: agentId,
      status: 'starting',
      stdout: '',
      stderr: '',
      checkpoint: null,
    };

    // Git guard: create branch + checkpoint before spawning
    let checkpoint: GitCheckpoint | null = null;
    if (options?.gitGuard) {
      const branch = options.gitGuard.createAgentBranch(`agent-${agentId}-task`, options.cwd);
      if (branch) {
        checkpoint = options.gitGuard.checkpoint(`before agent ${agentId}`, options.cwd) ?? null;
      }
    }
    info.checkpoint = checkpoint;

    const releaseSlot = () => {
      this.running--;
      const next = this.queue.shift();
      if (next) next.resolve();
    };

    const envOverlay = { ...options?.env, ...options?.gatewayEnv };
    const sandbox = await createSandbox(envOverlay, {
      ...options?.sandbox,
      taskId: options?.sandbox?.taskId ?? id,
    }).catch((err) => {
      info.status = 'failed';
      info.stderr += err instanceof Error ? err.message : String(err);
      return null;
    });

    if (!sandbox) {
      releaseSlot();
      return info;
    }

    return new Promise<AgentProcess>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const settle = (finalInfo: AgentProcess & { checkpoint?: GitCheckpoint | null }) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        this.processes.delete(id);
        void sandbox.cleanup()
          .catch((err) => {
            finalInfo.stderr += `\n[sandbox cleanup] ${err instanceof Error ? err.message : String(err)}`;
          })
          .finally(() => {
            releaseSlot();
            resolve(finalInfo);
          });
      };

      let proc: ChildProcess;
      try {
        proc = spawn(command, args, {
          cwd: options?.cwd,
          env: sandbox.env,
          // Resource limits — rssBytes is soft limit on macOS (Node ≥22)
          ...(options?.maxMemoryMb
            ? { resourceLimits: { maxOldGenerationSizeMb: options.maxMemoryMb } }
            : {}),
        });
      } catch (err) {
        info.status = 'failed';
        info.stderr += err instanceof Error ? err.message : String(err);
        settle(info);
        return;
      }

      info.pid = proc.pid ?? undefined;
      info.status = 'running';

      const timeout = options?.timeoutMs;
      if (timeout) {
        timer = setTimeout(() => {
          proc.kill('SIGKILL');
          info.status = 'failed';
          info.stderr += '\n[timeout] process killed';
        }, timeout);
      }

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        info.stdout += text;
        if (info.stdout.length > MAX_STREAM_SIZE) {
          info.stdout = info.stdout.slice(-MAX_STREAM_SIZE) + '\n[truncated]';
        }
        options?.onChunk?.(text);
      });
      proc.stderr?.on('data', (data: Buffer) => {
        info.stderr += data.toString();
        if (info.stderr.length > MAX_STREAM_SIZE) {
          info.stderr = info.stderr.slice(-MAX_STREAM_SIZE) + '\n[truncated]';
        }
      });

      proc.on('error', (err) => {
        info.status = 'failed';
        info.stderr += err.message;
        settle(info);
      });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        info.exitCode = code ?? undefined;
        info.status = code === 0 ? 'completed' : 'failed';

        // Git guard: commit changes after agent completes
        if (checkpoint && options?.gitGuard) {
          options.gitGuard.commitAgentChanges(checkpoint, options?.cwd);
        }

        settle(info);
      });

      this.processes.set(id, { proc, info, timer });
    });
  }

  getStats(): { running: number; queued: number; maxConcurrency: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    };
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
    // close will run sandbox cleanup and release the concurrency slot.
    return true;
  }

  killAll(): void {
    for (const [id] of this.processes) {
      this.killProcess(id);
    }
  }
}
