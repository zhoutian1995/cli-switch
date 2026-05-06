import { Command } from 'commander';
import { DEFAULT_CAPABILITIES, rankAgents } from '../src/core/router/capability-matrix.js';
import type { AgentId } from '../src/types/agent.js';
import { printJson } from './_shared.js';

const BENCHMARK_TASKS = [
  { id: 'hello', description: 'echo "Hello World"', expectedOutput: 'Hello World', type: '代码生成' },
  { id: 'fibonacci', description: 'Write a fibonacci function in TypeScript', type: '代码生成' },
  { id: 'sort', description: 'Implement quicksort algorithm', type: '代码生成' },
  { id: 'debug', description: 'Find the bug: function add(a, b) { return a - b; }', type: '调试' },
  { id: 'test', description: 'Write a unit test for a function that reverses a string', type: '测试' },
] as const;

export function createBenchmarkCommand(): Command {
  return new Command('benchmark')
    .description('Run capability simulation (not real benchmarks) across agents')
    .option('--agent <agent>', 'benchmark specific agent')
    .option('--iterations <n>', 'number of iterations per task', '3')
    .option('--json', 'output JSON')
    .action(async (options: { agent?: string; iterations?: string; json?: boolean }) => {
      const iterations = parseInt(options.iterations ?? '3', 10);
      const allAgents = Object.keys(DEFAULT_CAPABILITIES) as AgentId[];
      const agents = options.agent ? [options.agent as AgentId] : allAgents;

      console.log(`cli-switch capability simulation — ${iterations} iterations × ${agents.length} agent(s) × ${BENCHMARK_TASKS.length} tasks`);
      console.log('⚠ NOTE: This is a capability simulation, not a real performance benchmark.\n');

      const results: BenchmarkResult[] = [];

      for (const agentId of agents) {
        for (const task of BENCHMARK_TASKS) {
          for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            // Simulated benchmark — in production this would spawn real agent
            const success = true;
            const durationMs = Date.now() - start;
            results.push({
              agent: agentId,
              taskId: task.id,
              taskType: task.type,
              iteration: i + 1,
              success,
              durationMs,
              outputLength: 0,
            });
          }
        }
      }

      if (options.json) {
        printJson({ ok: true, data: results, warnings: [], diagnostics: [] });
        return;
      }

      // Summary
      console.log('── Summary ──────────────────');
      const agentScores = agents.map((a) => {
        const agentResults = results.filter((r) => r.agent === a);
        const successCount = agentResults.filter((r) => r.success).length;
        const avgDuration = agentResults.reduce((s, r) => s + r.durationMs, 0) / (agentResults.length || 1);
        return { agent: a, successRate: successCount / agentResults.length, avgDuration, total: agentResults.length };
      }).sort((a, b) => b.successRate - a.successRate || a.avgDuration - b.avgDuration);

      for (const s of agentScores) {
        console.log(`  ${s.agent.padEnd(14)} ${(s.successRate * 100).toFixed(0)}% success  avg ${s.avgDuration.toFixed(0)}ms  (${s.total} runs)`);
      }

      // Capability ranking for reference
      console.log('\n── Capability Rankings ──────────────────');
      for (const task of BENCHMARK_TASKS) {
        const ranked = rankAgents(task.type, '中等');
        console.log(`  [${task.id}] → ${ranked[0]?.agent} (${ranked[0]?.score})`);
      }
    });
}

interface BenchmarkResult {
  agent: AgentId;
  taskId: string;
  taskType: string;
  iteration: number;
  success: boolean;
  durationMs: number;
  outputLength: number;
}
