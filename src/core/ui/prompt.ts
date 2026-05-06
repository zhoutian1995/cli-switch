/**
 * InteractivePrompt — terminal prompts for agent selection / confirmation.
 *
 * Uses only Node.js built-in readline. Falls back to defaults when not a TTY.
 */

import * as readline from 'node:readline';
import { isatty } from 'node:tty';
import type { AgentId, OrchestrationMode } from '../../types/agent.js';

export interface PromptChoice {
  name: string;
  value: string;
  description?: string;
  score?: number;
}

export class InteractivePrompt {
  private static isTty(): boolean {
    return process.stdout.isTTY ?? false;
  }

  /**
   * Let the user interactively select an agent.
   * Returns `defaultAgent` if not a TTY.
   */
  static async selectAgent(
    ranked: Array<{ agent: AgentId; score: number; reason: string }>,
    defaultAgent: AgentId,
  ): Promise<AgentId> {
    if (!InteractivePrompt.isTty()) return defaultAgent;

    console.log('\n── Select Agent ──────────────────');
    ranked.forEach((r, i) => {
      const marker = r.agent === defaultAgent ? ' (default)' : '';
      console.log(`  ${i + 1}. ${r.agent.padEnd(14)} score=${r.score}  (${r.reason})${marker}`);
    });
    console.log(`  Enter. Use default (${defaultAgent})`);

    const answer = await InteractivePrompt.readLine(
      `Select [1-${ranked.length}] or agent name: `,
    );

    if (!answer.trim()) return defaultAgent;

    // Try numeric
    const num = parseInt(answer.trim(), 10);
    if (num >= 1 && num <= ranked.length) {
      return ranked[num - 1].agent;
    }

    // Try name match
    const match = ranked.find(
      (r) => r.agent.toLowerCase() === answer.trim().toLowerCase(),
    );
    if (match) return match.agent;

    return defaultAgent;
  }

  /** Confirm a routing decision. Returns true if not a TTY. */
  static async confirmRouting(
    agent: AgentId,
    reason: string,
    confidence: number,
  ): Promise<boolean> {
    if (!InteractivePrompt.isTty()) return true;

    console.log(
      `  Agent: ${agent}  Reason: ${reason}  Confidence: ${(confidence * 100).toFixed(0)}%`,
    );
    const answer = await InteractivePrompt.readLine('Proceed? [Y/n] ');
    const trimmed = answer.trim().toLowerCase();
    return trimmed === '' || trimmed === 'y' || trimmed === 'yes';
  }

  /** Let the user pick an orchestration mode. Returns 'single' if not a TTY. */
  static async selectMode(): Promise<OrchestrationMode> {
    if (!InteractivePrompt.isTty()) return 'single';

    const modes: Array<{ value: OrchestrationMode; label: string }> = [
      { value: 'single', label: 'Single agent' },
      { value: 'orchestrator', label: 'Orchestrator (multi-agent)' },
      { value: 'handoff', label: 'Handoff (chain)' },
      { value: 'review', label: 'Review (code + review)' },
    ];

    console.log('\n── Select Mode ──────────────────');
    modes.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.label}`);
    });

    const answer = await InteractivePrompt.readLine('Select [1-4]: ');
    const num = parseInt(answer.trim(), 10);
    if (num >= 1 && num <= modes.length) return modes[num - 1].value;
    return 'single';
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private static readLine(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}
