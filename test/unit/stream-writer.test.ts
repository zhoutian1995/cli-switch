import { describe, it, expect } from 'vitest';
import { StreamWriter } from '../../src/core/dispatcher/stream-writer.js';

describe('StreamWriter', () => {
  it('creates instance with TTY flag', () => {
    const writer = StreamWriter.create(false);
    expect(writer).toBeDefined();
  });

  it('startAgent does not throw in non-TTY mode', () => {
    const writer = StreamWriter.create(false);
    expect(() => writer.startAgent('claude-code' as any)).not.toThrow();
  });

  it('complete does not throw in non-TTY mode', () => {
    const writer = StreamWriter.create(false);
    writer.startAgent('claude-code' as any);
    expect(() => writer.complete(true, 'done')).not.toThrow();
  });

  it('writeChunk does not throw in non-TTY mode', () => {
    const writer = StreamWriter.create(false);
    writer.startAgent('claude-code' as any);
    expect(() => writer.writeChunk('hello ')).not.toThrow();
    expect(() => writer.writeChunk('world')).not.toThrow();
    writer.complete(true);
  });
});
