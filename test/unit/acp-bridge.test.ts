import { describe, it, expect, afterEach } from 'vitest';
import { ACPBridge } from '../../src/core/dispatcher/acp-bridge.js';

/**
 * Real ACP Bridge tests using mock node processes.
 */

function makeEchoScript(): string {
  // Use require() to avoid esbuild parsing import in string
  return [
    'const { createInterface } = require("readline");',
    'const rl = createInterface({ input: process.stdin });',
    'rl.on("line", (line) => {',
    '  try {',
    '    const msg = JSON.parse(line);',
    '    if (msg.id !== undefined) {',
    '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { echoed: msg.method, params: msg.params } }) + "\\n");',
    '    }',
    '    if (msg.method === "exit") { process.exit(0); }',
    '  } catch {}',
    '});',
  ].join('\n');
}

function makeSilentScript(): string {
  return [
    'const { createInterface } = require("readline");',
    'const rl = createInterface({ input: process.stdin });',
    'rl.on("line", () => {});',
  ].join('\n');
}

function makeStreamingScript(): string {
  return [
    'process.stdout.write("hello from agent\\n");',
    'const { createInterface } = require("readline");',
    'const rl = createInterface({ input: process.stdin });',
    'rl.on("line", (line) => {',
    '  try {',
    '    const msg = JSON.parse(line);',
    '    if (msg.method === "exit") process.exit(0);',
    '    if (msg.id !== undefined) {',
    '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: "ok" }) + "\\n");',
    '    }',
    '  } catch {}',
    '});',
  ].join('\n');
}

describe('ACPBridge', () => {
  let bridge: ACPBridge | null = null;

  afterEach(async () => {
    if (bridge && !bridge.isClosed) {
      await bridge.close();
    }
    bridge = null;
  });

  it('connects and receives response via JSON-RPC', async () => {
    bridge = new ACPBridge();
    await bridge.connect('node', ['-e', makeEchoScript()], { timeoutMs: 5000 });

    const result = await bridge.request('test/method', { key: 'value' }, 3000);
    expect(result).toEqual({ echoed: 'test/method', params: { key: 'value' } });
  });

  it('sendTask sends task/run method and gets response', async () => {
    bridge = new ACPBridge();
    await bridge.connect('node', ['-e', makeEchoScript()], { timeoutMs: 5000 });

    const result = await bridge.sendTask('hello world', { techStack: ['typescript'] });
    expect(result.result).toBeDefined();
  });

  it('receives streaming chunks from non-JSON output', async () => {
    bridge = new ACPBridge();
    const chunks: string[] = [];
    bridge.onChunk((chunk) => chunks.push(chunk));

    await bridge.connect('node', ['-e', makeStreamingScript()], { timeoutMs: 5000 });

    // Give time for initial output
    await new Promise((r) => setTimeout(r, 300));

    expect(chunks.some((c) => c.includes('hello from agent'))).toBe(true);
  });

  it('handles timeout on pending request', async () => {
    bridge = new ACPBridge();
    await bridge.connect('node', ['-e', makeSilentScript()], { timeoutMs: 5000 });

    await expect(bridge.request('test/timeout', {}, 500)).rejects.toThrow('Request timeout');
  });

  it('close terminates the process', async () => {
    bridge = new ACPBridge();
    await bridge.connect('node', ['-e', makeEchoScript()], { timeoutMs: 5000 });
    expect(bridge.isClosed).toBe(false);

    await bridge.close();
    expect(bridge.isClosed).toBe(true);
  });
});
