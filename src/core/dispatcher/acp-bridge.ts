/**
 * ACP (Agent Communication Protocol) Bridge
 * JSON-RPC 2.0 over stdio for agent communication.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ACPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ProjectContext {
  files?: string[];
  techStack?: string[];
  systemPrompt?: string;
  model?: string;
}

type PendingEntry = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// ── ACPBridge ──────────────────────────────────────────────────────────────

export class ACPBridge {
  private proc: ChildProcess | null = null;
  private messageId = 0;
  private pending = new Map<string, PendingEntry>();
  private buffer = '';
  private chunkCallbacks: Array<(chunk: string) => void> = [];
  private notificationCallbacks: Array<(method: string, params?: Record<string, unknown>) => void> = [];
  private closed = false;
  private defaultTimeout = 120_000;

  /** Spawn a child process and establish JSON-RPC over stdio. */
  async connect(
    command: string,
    args: string[],
    options?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
  ): Promise<void> {
    if (this.proc) throw new Error('Already connected');

    this.defaultTimeout = options?.timeoutMs ?? 120_000;

    this.proc = spawn(command, args, {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: this.proc.stdout! });

    rl.on('line', (line) => {
      this.handleLine(line);
    });

    this.proc.stderr?.on('data', (data: Buffer) => {
      // Non-RPC stderr: forward as chunk for visibility
      const text = data.toString();
      for (const cb of this.chunkCallbacks) cb(text);
    });

    this.proc.on('close', (code) => {
      this.closed = true;
      // Reject all pending requests
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error(`Process exited with code ${code}`));
        this.pending.delete(id);
      }
    });

    this.proc.on('error', (err) => {
      this.closed = true;
      for (const [, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(err);
      }
      this.pending.clear();
    });
  }

  /** Send a JSON-RPC request and wait for the response. */
  async request(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<unknown> {
    const id = ++this.messageId;
    const msg: ACPMessage = { jsonrpc: '2.0', id, method, params };
    this.write(msg);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(id));
        reject(new Error(`Request timeout: ${method} (id=${id})`));
      }, timeoutMs ?? this.defaultTimeout);

      this.pending.set(String(id), { resolve, reject, timer });
    });
  }

  /** Send a JSON-RPC notification (no id, no response expected). */
  notify(method: string, params?: Record<string, unknown>): void {
    const msg: ACPMessage = { jsonrpc: '2.0', method, params };
    this.write(msg);
  }

  /** Convenience: send a task prompt to the agent. */
  async sendTask(prompt: string, context?: ProjectContext): Promise<ACPMessage> {
    const result = await this.request('task/run', {
      prompt,
      ...context,
    });
    return { jsonrpc: '2.0', id: this.messageId, result };
  }

  /** Register a callback for streaming text chunks. */
  onChunk(callback: (chunk: string) => void): void {
    this.chunkCallbacks.push(callback);
  }

  /** Register a callback for JSON-RPC notifications from the agent. */
  onNotification(
    callback: (method: string, params?: Record<string, unknown>) => void,
  ): void {
    this.notificationCallbacks.push(callback);
  }

  /** Gracefully close the connection. */
  async close(): Promise<void> {
    if (!this.proc || this.closed) return;

    // Try sending a clean exit notification
    try {
      this.notify('exit');
    } catch {
      // ignore write errors
    }

    // If process already exited, skip waiting
    if (this.proc.exitCode !== null) {
      this.closed = true;
      return;
    }

    this.proc.kill('SIGTERM');

    // Wait for close with a force-kill fallback
    await new Promise<void>((resolve) => {
 const forceTimer = setTimeout(() => {
        if (this.proc && this.proc.exitCode === null) {
          this.proc.kill('SIGKILL');
        }
        resolve();
      }, 3000);

      this.proc!.once('close', () => {
        clearTimeout(forceTimer);
        resolve();
      });
    });

    this.closed = true;
  }

  /** Whether the underlying process has exited. */
  get isClosed(): boolean {
    return this.closed;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private write(msg: ACPMessage): void {
    if (!this.proc?.stdin?.writable) {
      throw new Error('Cannot write: process stdin not available');
    }
    const line = JSON.stringify(msg) + '\n';
    this.proc.stdin.write(line);
  }

  private handleLine(line: string): void {
    // Agent may output non-JSON lines (e.g. progress); treat as raw chunk
    let msg: ACPMessage;
    try {
      msg = JSON.parse(line) as ACPMessage;
    } catch {
      // Not JSON — forward as a text chunk
      for (const cb of this.chunkCallbacks) cb(line + '\n');
      return;
    }

    // Handle response
    if (msg.id !== undefined) {
      const key = String(msg.id);
      const entry = this.pending.get(key);
      if (entry) {
        clearTimeout(entry.timer);
        this.pending.delete(key);
        if (msg.error) {
          entry.reject(
            new Error(`ACP error ${msg.error.code}: ${msg.error.message}`),
          );
        } else {
          entry.resolve(msg.result);
        }
      }
    }

    // Handle notification (no id)
    if (msg.id === undefined && msg.method) {
      // Stream notifications forward text chunks
      if (msg.method === 'notifications/stream' && typeof msg.params?.['text'] === 'string') {
        for (const cb of this.chunkCallbacks) cb(msg.params['text'] as string);
      }
      for (const cb of this.notificationCallbacks) {
        cb(msg.method!, msg.params);
      }
    }
  }
}
