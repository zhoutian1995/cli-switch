/**
 * StreamWriter — real-time output display for agent responses.
 *
 * Uses only Node.js built-ins (no ora/inquirer).
 */

import { isatty } from 'node:tty';

export class StreamWriter {
  private startTime = 0;
  private active = false;
  private agentId = '';
  private isTty: boolean;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private spinnerIndex = 0;
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private lastLine = '';

  private constructor(isTty?: boolean) {
    this.isTty = isTty ?? (process.stdout.isTTY ?? false);
  }

  static create(isTty?: boolean): StreamWriter {
    return new StreamWriter(isTty);
  }

  /** Start displaying output for an agent. */
  startAgent(agentId: string): void {
    this.agentId = agentId;
    this.startTime = Date.now();
    this.active = true;

    if (this.isTty) {
      this.startSpinner();
    } else {
      process.stdout.write(`[${agentId}] Running...\n`);
    }
  }

  /** Write a chunk of text from the agent response. */
  writeChunk(text: string): void {
    if (!this.active) return;

    if (this.isTty) {
      // Clear spinner line and write chunk
      this.clearSpinnerLine();
      process.stdout.write(text);
      this.lastLine = text;
    } else {
      process.stdout.write(text);
    }
  }

  /** Finish output. */
  complete(success: boolean, summary?: string): void {
    if (!this.active) return;
    this.active = false;

    this.stopSpinner();

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);

    if (this.isTty) {
      // Ensure we're on a new line
      process.stdout.write('\n');
    }

    if (success) {
      const msg = summary
        ? `[${this.agentId}] Done (${elapsed}s) — ${summary}`
        : `[${this.agentId}] Done (${elapsed}s)`;
      process.stdout.write(`${msg}\n`);
    } else {
      const msg = summary
        ? `[${this.agentId}] Failed — ${summary}`
        : `[${this.agentId}] Failed (${elapsed}s)`;
      process.stderr.write(`${msg}\n`);
    }
  }

  // ── Spinner helpers (TTY only) ──────────────────────────────────────────

  private startSpinner(): void {
    this.spinnerTimer = setInterval(() => {
      const frame = this.spinnerFrames[this.spinnerIndex % this.spinnerFrames.length];
      this.spinnerIndex++;
      process.stdout.write(`\r${frame} [${this.agentId}] Running...`);
    }, 80);
  }

  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
    this.clearSpinnerLine();
  }

  private clearSpinnerLine(): void {
    if (this.isTty) {
      process.stdout.write('\r\x1b[K'); // carriage return + clear line
    }
  }
}
