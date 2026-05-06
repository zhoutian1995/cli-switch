import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from '@iarna/toml';

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

let _cache: Record<string, AgentDefinition> | null = null;

function loadToml(): Record<string, AgentDefinition> {
  if (_cache) return _cache;

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const tomlPath = resolve(__dirname, '../../registry/builtins/agents.toml');
  const raw = parseToml(readFileSync(tomlPath, 'utf8')) as Record<string, unknown>;

  const agents: Record<string, AgentDefinition> = {};
  for (const [key, val] of Object.entries(raw)) {
    const d = val as Record<string, unknown>;
    const argsRaw = d.args as string;
    agents[key] = {
      id: (d.id as AgentId) ?? (key as AgentId),
      command: d.command as string,
      args: argsRaw ?? '',
      supportedModes: (d.supportedModes as string[]) ?? [],
      capabilities: (d.capabilities as string[]) ?? [],
      maxMemoryMb: (d.maxMemoryMb as number) ?? 512,
      timeoutMs: (d.timeoutMs as number) ?? 120_000,
    };
  }

  _cache = agents;
  return agents;
}

export function loadAgents(): Record<string, AgentDefinition> {
  return loadToml();
}

export function getAgent(id: AgentId): AgentDefinition | null {
  return loadToml()[id] ?? null;
}

export function resolveAgentCommand(id: AgentId, prompt: string): { program: string; args: string[] } {
  const agent = getAgent(id);
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

/** Reset the agent definition cache (for testing). */
export function resetCache(): void {
  _cache = null;
}
