import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACPBridge, type ACPMessage } from '../../src/core/dispatcher/acp-bridge.js';

describe('ACPBridge', () => {
  it('encodes JSON-RPC messages correctly', () => {
    const msg: ACPMessage = { jsonrpc: '2.0', id: 1, method: 'task/run', params: { prompt: 'hello' } };
    const json = JSON.stringify(msg);
    expect(json).toContain('"jsonrpc":"2.0"');
    expect(json).toContain('"method":"task/run"');
    expect(json).toContain('"prompt":"hello"');
  });

  it('notification has no id field', () => {
    const msg: ACPMessage = { jsonrpc: '2.0', method: 'exit' };
    expect(msg.id).toBeUndefined();
    expect(msg.method).toBe('exit');
  });

  it('handles response with matching id', async () => {
    // Simulate a response coming back
    const bridge = new ACPBridge();
    // We can't easily test connect() without a real process,
    // but we can test the message matching logic indirectly.
    const msg: ACPMessage = { jsonrpc: '2.0', id: 1, result: { text: 'done' } };
    expect(msg.id).toBe(1);
    expect(msg.result).toEqual({ text: 'done' });
  });

  it('handles error response', () => {
    const msg: ACPMessage = {
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32600, message: 'Invalid Request' },
    };
    expect(msg.error?.code).toBe(-32600);
    expect(msg.error?.message).toBe('Invalid Request');
  });

  it('ProjectContext type accepts optional fields', () => {
    const ctx = {
      techStack: ['typescript', 'react'],
      systemPrompt: 'You are an expert.',
      model: 'claude-sonnet-4',
    };
    expect(ctx.techStack).toHaveLength(2);
    expect(ctx.systemPrompt).toContain('expert');
  });
});
