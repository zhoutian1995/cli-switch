import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from '@iarna/toml';
import { z } from 'zod';

import type { AgentId } from '../../types/agent.js';

export interface AgentDefinition {
  id: AgentId;
  command: string;
  args: string;
  supportedModes: string[];
  capabilities: string[];
  maxMemoryMb: number;
  timeoutMs: number;
}

const AgentSchema = z.object({
  id: z.string().optional(),
  command: z.string(),
  args: z.string().optional().default(''),
  supportedModes: z.array(z.string()).optional().default([]),
  capabilities: z.array(z.string()).optional().default([]),
  maxMemoryMb: z.number().optional().default(512),
  timeoutMs: z.number().optional().default(120_000),
});

export class AgentLoader {
  private cache: Record<string, AgentDefinition> | null = null;

  load(): Record<string, AgentDefinition> {
    if (this.cache) return this.cache;

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const tomlPath = resolve(__dirname, '../../registry/builtins/agents.toml');
    const raw = parseToml(readFileSync(tomlPath, 'utf8')) as Record<string, unknown>;

    const agents: Record<string, AgentDefinition> = {};
    for (const [key, val] of Object.entries(raw)) {
      const parsed = AgentSchema.safeParse(val);
      if (!parsed.success) {
        console.warn(`[agent-loader] Skipping invalid agent definition '${key}': ${parsed.error.message}`);
        continue;
      }
      const d = parsed.data;
      agents[key] = {
        id: (d.id as AgentId) ?? (key as AgentId),
        command: d.command,
        args: d.args,
        supportedModes: d.supportedModes,
        capabilities: d.capabilities,
        maxMemoryMb: d.maxMemoryMb,
        timeoutMs: d.timeoutMs,
      };
    }

    this.cache = agents;
    return agents;
  }

  get(id: AgentId): AgentDefinition | null {
    return this.load()[id] ?? null;
  }

  resolveCommand(id: AgentId, prompt: string): { program: string; args: string[] } {
    const agent = this.get(id);
    if (!agent) {
      return { program: id, args: [prompt] };
    }

    switch (id) {
      case 'claude-code':
        return { program: agent.command, args: ['--print', prompt] };
      case 'codex':
        return { program: agent.command, args: [prompt] };
      case 'gemini':
        return { program: agent.command, args: [prompt] };
      default:
        return { program: agent.command, args: [prompt] };
    }
  }

  /** Reset the cache (for testing). */
  resetCache(): void {
    this.cache = null;
  }
}

/** Default singleton instance for backward compatibility. */
export const defaultAgentLoader = new AgentLoader();

/** @deprecated Use defaultAgentLoader.load() instead. */
export function loadAgents(): Record<string, AgentDefinition> {
  return defaultAgentLoader.load();
}

/** @deprecated Use defaultAgentLoader.get(id) instead. */
export function getAgent(id: AgentId): AgentDefinition | null {
  return defaultAgentLoader.get(id);
}

/** @deprecated Use defaultAgentLoader.resolveCommand(id, prompt) instead. */
export function resolveAgentCommand(id: AgentId, prompt: string): { program: string; args: string[] } {
  return defaultAgentLoader.resolveCommand(id, prompt);
}

/** @deprecated Use defaultAgentLoader.resetCache() instead. */
export function resetCache(): void {
  defaultAgentLoader.resetCache();
}
