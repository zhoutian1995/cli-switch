import { describe, it, expect } from 'vitest';
import { configSchema, skillsSectionSchema } from '../../src/types/config.js';
import type { SkillsSection } from '../../src/types/config.js';

describe('skills config section', () => {
  it('accepts valid skills section', () => {
    const result = configSchema.safeParse({
      skills: {
        default_strategy: 'single',
        default_tier: 'premium',
        prompt_suffix: '\n\nBe concise.',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skills?.default_strategy).toBe('single');
      expect(result.data.skills?.default_tier).toBe('premium');
      expect(result.data.skills?.prompt_suffix).toBe('\n\nBe concise.');
    }
  });

  it('accepts skills section with only some fields', () => {
    const result = configSchema.safeParse({
      skills: {
        default_strategy: 'write_review',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skills?.default_strategy).toBe('write_review');
      expect(result.data.skills?.default_tier).toBeUndefined();
      expect(result.data.skills?.prompt_suffix).toBeUndefined();
    }
  });

  it('accepts empty skills section', () => {
    const result = configSchema.safeParse({
      skills: {},
    });
    expect(result.success).toBe(true);
  });

  it('config without skills section still works', () => {
    const result = configSchema.safeParse({
      gateway: { api_key: 'test' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skills).toBeUndefined();
    }
  });

  it('rejects invalid default_strategy', () => {
    const result = configSchema.safeParse({
      skills: {
        default_strategy: 'invalid_strategy',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid default_tier', () => {
    const result = configSchema.safeParse({
      skills: {
        default_tier: 'ultra',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string prompt_suffix', () => {
    const result = configSchema.safeParse({
      skills: {
        prompt_suffix: 123,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra top-level fields via strict()', () => {
    const result = configSchema.safeParse({
      unknown_top_level: true,
    });
    expect(result.success).toBe(false);
  });

  it('skills section coexists with other sections', () => {
    const result = configSchema.safeParse({
      gateway: { api_key: 'sk-test' },
      routing: { tier_default: 'economy' },
      skills: {
        default_strategy: 'high_quality',
        default_tier: 'premium',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gateway?.api_key).toBe('sk-test');
      expect(result.data.routing?.tier_default).toBe('economy');
      expect(result.data.skills?.default_strategy).toBe('high_quality');
      expect(result.data.skills?.default_tier).toBe('premium');
    }
  });

  it('skillsSectionSchema validates standalone', () => {
    const valid = skillsSectionSchema.safeParse({
      default_strategy: 'write_test_fix',
      default_tier: 'standard',
      prompt_suffix: ' suffix',
    });
    expect(valid.success).toBe(true);
  });
});
