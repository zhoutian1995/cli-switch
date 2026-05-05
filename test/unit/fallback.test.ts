import { describe, it, expect } from 'vitest';
import { getFallbackChain, suggestFallback } from '../../src/core/aggregator/fallback.js';

describe('Fallback', () => {
  it('returns fallback chain for known agents', () => {
    const chain = getFallbackChain('claude-code');
    expect(chain.primary).toBe('claude-code');
    expect(chain.fallbacks).toEqual(['codex', 'gemini']);
  });

  it('returns empty fallbacks for unknown agent', () => {
    const chain = getFallbackChain('unknown' as any);
    expect(chain.primary).toBe('unknown');
    expect(chain.fallbacks).toEqual([]);
  });

  it('suggests first fallback', () => {
    expect(suggestFallback('claude-code', 'error')).toBe('codex');
  });

  it('suggests codex fallback for gemini', () => {
    expect(suggestFallback('gemini', 'error')).toBe('claude-code');
  });

  it('returns null when no fallbacks', () => {
    expect(suggestFallback('unknown' as any, 'error')).toBeNull();
  });
});
