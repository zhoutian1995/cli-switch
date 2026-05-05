import { Command } from 'commander';

import { buildResult, suggestFallback } from '../src/core/aggregator/index.js';
import { ProcessManager, resolveAgentCommand, getAgent } from '../src/core/dispatcher/index.js';
import { parseIntent } from '../src/core/intent/index.js';
import { orchestrate, handoff, review } from '../src/core/orchestrator/index.js';
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
  reviewer?: string;
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
    .option('--reviewer <agent>', 'reviewer agent for review mode')
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

        // Resolve agent defaults
        const agentDef = getAgent(decision.agent);
        const timeoutMs = options.timeout
          ? parseInt(options.timeout, 10) * 1000
          : (agentDef?.timeoutMs ?? 120_000);
        const maxMemoryMb = agentDef?.maxMemoryMb ?? 512;

        if (mode === 'single') {
          await runSingle(decision.agent, input, { timeoutMs, maxMemoryMb, startTime, options });
        } else if (mode === 'orchestrator') {
          const agents = ([decision.agent, 'codex', 'gemini'] as AgentId[]).filter(
            (a, i, arr) => arr.indexOf(a) === i,
          );
          const results = await orchestrate(input, agents, { timeoutMs });
          printResults(results, options);
        } else if (mode === 'handoff') {
          const chain: AgentId[] = [decision.agent, options.reviewer as AgentId ?? 'codex'];
          const result = await handoff(input, chain, { timeoutMs });
          printSingleResult(result, options);
        } else if (mode === 'review') {
          const reviewer = (options.reviewer ?? 'codex') as AgentId;
          const reviewResult = await review(input, decision.agent, reviewer, { timeoutMs });
          if (options.json) {
            printJson({ ok: true, data: reviewResult, warnings: [], diagnostics: [] });
          } else {
            console.log('── Code ──────────────────');
            console.log(reviewResult.code.output);
            console.log('── Review ─────────────────');
            console.log(reviewResult.review.output);
          }
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

async function runSingle(
  agentId: AgentId,
  input: string,
  ctx: { timeoutMs: number; maxMemoryMb: number; startTime: number; options: RunOptions },
): Promise<void> {
  const { program, args } = resolveAgentCommand(agentId, input);
  const pm = new ProcessManager();
  const proc = await pm.spawnAgent(agentId, args, {
    timeoutMs: ctx.timeoutMs,
    maxMemoryMb: ctx.maxMemoryMb,
    command: program,
  });

  let result: RunResult = buildResult(proc, ctx.startTime);

  // Fallback: if failed, try up to 2 fallback agents
  if (!result.ok) {
    let currentAgent = agentId;
    let attempts = 0;
    while (!result.ok && attempts < 2) {
      const fb = suggestFallback(currentAgent, result.output);
      if (!fb) break;
      const fbCmd = resolveAgentCommand(fb, input);
      const fbProc = await pm.spawnAgent(fb, fbCmd.args, {
        timeoutMs: ctx.timeoutMs,
        maxMemoryMb: ctx.maxMemoryMb,
        command: fbCmd.program,
      });
      result = { ...buildResult(fbProc, ctx.startTime), fallback: true };
      currentAgent = fb;
      attempts++;
    }
  }

  printSingleResult(result, ctx.options);
}

function printSingleResult(result: RunResult, options: RunOptions): void {
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
}

function printResults(results: RunResult[], options: RunOptions): void {
  if (options.json) {
    printJson({ ok: results.every((r) => r.ok), data: results, warnings: [], diagnostics: [] });
  } else {
    for (const r of results) {
      console.log(`── ${r.agent} (${r.ok ? 'ok' : 'failed'}) ──`);
      console.log(r.output);
    }
  }
}
