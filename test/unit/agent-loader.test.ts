import { describe, it, expect } from 'vitest';
import { loadAgents, getAgent, resolveAgentCommand } from '../../src/core/dispatcher/agent-loader.js';

describe('agent-loader', () => {
  it('loads all agents from agents.toml', () => {
    const agents = loadAgents();
    expect(Object.keys(agents)).toContain('claude-code');
    expect(Object.keys(agents)).toContain('codex');
  });

  it('gets specific agent', () => {
    const agent = getAgent('claude-code');
    expect(agent).not.toBeNull();
    expect(agent!.command).toBe('claude');
    expect(agent!.timeoutMs).toBe(300_000);
  });

  it('returns null for unknown agent', () => {
    expect(getAgent('unknown' as any)).toBeNull();
  });

  it('resolves claude-code command', () => {
    const cmd = resolveAgentCommand('claude-code', 'hello');
    expect(cmd.program).toBe('claude');
    expect(cmd.args).toEqual(['--print', 'hello']);
  });

  it('resolves codex command', () => {
    const cmd = resolveAgentCommand('codex', 'hello');
    expect(cmd.program).toBe('codex');
    expect(cmd.args).toEqual(['exec', 'hello']);
  });

  it('resolves unknown agent with default', () => {
    const cmd = resolveAgentCommand('unknown' as any, 'hello');
    expect(cmd.args).toEqual(['hello']);
  });
});
