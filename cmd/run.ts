import { Command } from 'commander';

import { buildResult } from '../src/core/aggregator/index.js';
import { ProcessManager } from '../src/core/dispatcher/index.js';
import { parseIntent } from '../src/core/intent/index.js';
import { loadBuiltins, createRegistryService } from '../src/registry/index.js';
import { route } from '../src/core/router/index.js';
import type { AgentId, OrchestrationMode, RunResult } from '../src/types/agent.js';
import { printJson, EXIT_CODES } from './_shared.js';

interface RunOptions {
  mode?: string;
  agent?: string;
  json?: boolean;
  dryRun?: boolean;
  timeout?: string;
}

function resolveAgentArgs(agentId: AgentId, prompt: string): string[] {
  switch (agentId) {
    case 'claude-code':
      return ['--print', prompt];
    case 'codex':
      return [prompt];
    case 'gemini':
      return ['--model', 'gemini-2.5-pro', prompt];
    default:
      return [prompt];
  }
}

export function createRunCommand(): Command {
  return new Command('run')
    .description('Run an AI agent with smart routing')
    .argument('<input>', 'task description')
    .option('--mode <mode>', 'orchestration mode: single|orchestrator|handoff|review')
    .option('--agent <agent>', 'override agent: claude-code|codex|gemini|opencode|aider')
    .option('--json', 'output JSON')
    .option('--dry-run', 'show routing decision without executing')
    .option('--timeout <seconds>', 'agent timeout in seconds (default 120)')
    .action(async (input: string, options: RunOptions) => {
      const startTime = Date.now();

      try {
        // Phase 1: Intent parsing (rule-based, no LLM cost)
        const intent = await parseIntent(input);

        // Phase 2: Routing
        let decision;
        if (options.agent) {
          decision = {
            agent: options.agent as AgentId,
            reason: '手动指定',
            confidence: 1.0,
          };
        } else {
          decision = route(intent);
        }

        const mode: OrchestrationMode = (options.mode as OrchestrationMode) ?? 'single';

        // --dry-run: only show routing decision
        if (options.dryRun) {
          const output = { intent, decision, mode };
          if (options.json) {
            printJson({ ok: true, data: output, warnings: [], diagnostics: [] });
          } else {
            console.log('── Routing Decision ──────────────────');
            console.log(`  Intent:      ${intent.type} (${intent.complexity})`);
            console.log(`  Agent:       ${decision.agent}`);
            console.log(`  Reason:      ${decision.reason}`);
            console.log(`  Confidence:  ${(decision.confidence * 100).toFixed(0)}%`);
            console.log(`  Mode:        ${mode}`);
            if (intent.techStack.length > 0) {
              console.log(`  Tech Stack:  ${intent.techStack.join(', ')}`);
            }
          }
          return;
        }

        // Phase 3: Spawn agent
        const timeoutMs = options.timeout ? parseInt(options.timeout, 10) * 1000 : 120_000;
        const agentArgs = resolveAgentArgs(decision.agent, input);
        const pm = new ProcessManager();
        const proc = await pm.spawnAgent(decision.agent, agentArgs, {
          timeoutMs,
          maxMemoryMb: 512,
        });

        // Phase 4: Result aggregation
        const result: RunResult = buildResult(proc, startTime);

        if (options.json) {
          printJson({
            ok: result.ok,
            data: result,
            warnings: result.ok ? [] : [`Agent ${result.agent} exited with code ${result.exitCode}`],
            diagnostics: [],
          });
        } else if (result.ok) {
          console.log(result.output);
        } else {
          console.error(`✗ Agent ${result.agent} failed (exit ${result.exitCode})`);
          if (result.output) console.error(result.output);
          process.exitCode = EXIT_CODES.resolve;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (options.json) {
          printJson({
            ok: false,
            error: { code: 'RUN_FAILED', message, hint: '检查 Agent 是否已安装并可用' },
            warnings: [],
            diagnostics: [],
          });
        } else {
          console.error(`Error: ${message}`);
        }
        process.exitCode = EXIT_CODES.input;
      }
    });
}
