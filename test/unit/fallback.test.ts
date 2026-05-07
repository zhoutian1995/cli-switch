import { describe, it, expect } from 'vitest';
import { getFallbackChain, suggestFallback } from '../../src/core/aggregator/fallback.js';

describe('Fallback', () => {
  it('returns fallback chain for claude-code', () => {
    const chain = getFallbackChain('claude-code');
    expect(chain.primary).toBe('claude-code');
    expect(chain.fallbacks).toEqual(['codex']);
  });

  it('returns fallback chain for codex', () => {
    const chain = getFallbackChain('codex');
    expect(chain.primary).toBe('codex');
    expect(chain.fallbacks).toEqual(['claude-code']);
  });

  it('returns empty fallbacks for unknown agent', () => {
    const chain = getFallbackChain('unknown' as any);
    expect(chain.primary).toBe('unknown');
    expect(chain.fallbacks).toEqual([]);
  });

  it('suggests first fallback', () => {
    expect(suggestFallback('claude-code', 'error')).toBe('codex');
  });

  it('suggests claude-code fallback for codex', () => {
    expect(suggestFallback('codex', 'error')).toBe('claude-code');
  });

  it('returns null when no fallbacks', () => {
    expect(suggestFallback('unknown' as any, 'error')).toBeNull();
  });
});
