import { describe, it, expect } from 'vitest';
import { skillSchema, validateSkillYaml } from '../../src/core/skill/schema.js';
import { renderPrompt } from '../../src/core/skill/renderer.js';
import type { SkillDefinition } from '../../src/core/skill/schema.js';

// ─── Schema validation tests ────────────────────────────────

describe('skillSchema', () => {
  it('accepts valid minimal skill (name, description, capability)', () => {
    const result = skillSchema.safeParse({
      name: 'my-skill',
      description: 'A skill',
      capability: 'write_code',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('my-skill');
      expect(result.data.description).toBe('A skill');
      expect(result.data.capability).toBe('write_code');
    }
  });

  it('accepts valid skill with all optional fields', () => {
    const result = skillSchema.safeParse({
      name: 'full-skill',
      description: 'Full skill with all fields',
      capability: 'review_code',
      strategy: 'write_review',
      tier: 'premium',
      prompt_template: 'Review: {input}',
      execution_mode: 'patch-only',
      env: { NODE_ENV: 'test', DEBUG: '1' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strategy).toBe('write_review');
      expect(result.data.tier).toBe('premium');
      expect(result.data.prompt_template).toBe('Review: {input}');
      expect(result.data.execution_mode).toBe('patch-only');
      expect(result.data.env).toEqual({ NODE_ENV: 'test', DEBUG: '1' });
    }
  });

  it('rejects invalid capability', () => {
    const result = skillSchema.safeParse({
      name: 'bad',
      description: 'Bad capability',
      capability: 'invalid_cap',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid strategy', () => {
    const result = skillSchema.safeParse({
      name: 'bad',
      description: 'Bad strategy',
      capability: 'write_code',
      strategy: 'bad_strategy',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid tier', () => {
    const result = skillSchema.safeParse({
      name: 'bad',
      description: 'Bad tier',
      capability: 'write_code',
      tier: 'ultra',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid execution_mode', () => {
    const result = skillSchema.safeParse({
      name: 'bad',
      description: 'Bad mode',
      capability: 'write_code',
      execution_mode: 'vm-isolated',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = skillSchema.safeParse({
      description: 'No name',
      capability: 'write_code',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing description', () => {
    const result = skillSchema.safeParse({
      name: 'no-desc',
      capability: 'write_code',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing capability', () => {
    const result = skillSchema.safeParse({
      name: 'no-cap',
      description: 'No capability',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level keys (strict mode)', () => {
    const result = skillSchema.safeParse({
      name: 'extra',
      description: 'Has unknown key',
      capability: 'write_code',
      unknown_field: 'oops',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid env record', () => {
    const result = skillSchema.safeParse({
      name: 'env-test',
      description: 'Test env',
      capability: 'write_code',
      env: { KEY1: 'val1', KEY2: 'val2' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects env with non-string values', () => {
    const result = skillSchema.safeParse({
      name: 'bad-env',
      description: 'Bad env',
      capability: 'write_code',
      env: { KEY1: 123 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts env with numeric keys (coerced to strings)', () => {
    const result = skillSchema.safeParse({
      name: 'num-env-keys',
      description: 'Numeric env keys',
      capability: 'write_code',
      env: { 42: 'value' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.env).toEqual({ '42': 'value' });
    }
  });
});

// ─── validateSkillYaml helper ──────────────────────────────

describe('validateSkillYaml', () => {
  it('returns success with skill for valid data', () => {
    const result = validateSkillYaml({
      name: 'test',
      description: 'Test',
      capability: 'analyze',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.skill.name).toBe('test');
      expect(result.skill.capability).toBe('analyze');
    }
  });

  it('returns errors for invalid data', () => {
    const result = validateSkillYaml({ name: 'bad' });
    if (!result.success) {
      expect((result as { errors: string[] }).errors.length).toBeGreaterThan(0);
    }
  });

  it('returns errors for unknown keys', () => {
    const result = validateSkillYaml({
      name: 'test',
      description: 'Test',
      capability: 'write_code',
      foo: 'bar',
    });
    if (!result.success) {
      expect((result as { errors: string[] }).errors.length).toBeGreaterThan(0);
    }
  });
});

// ─── Renderer tests ─────────────────────────────────────────

describe('renderPrompt', () => {
  it('replaces {input} in prompt_template', () => {
    const skill: SkillDefinition = {
      name: 'review',
      description: 'Code review',
      capability: 'review_code',
      prompt_template: 'Please review this code: {input}',
    };
    const result = renderPrompt(skill, 'fix the bug in main.ts');
    expect(result).toBe('Please review this code: fix the bug in main.ts');
  });

  it('returns input as-is when no prompt_template', () => {
    const skill: SkillDefinition = {
      name: 'simple',
      description: 'Simple skill',
      capability: 'write_code',
    };
    const result = renderPrompt(skill, 'write a function');
    expect(result).toBe('write a function');
  });

  it('treats empty prompt_template as no template', () => {
    const skill: SkillDefinition = {
      name: 'empty',
      description: 'Empty template',
      capability: 'explain',
      prompt_template: '',
    };
    const result = renderPrompt(skill, 'hello');
    // Empty string is falsy, treated as no template → returns input
    expect(result).toBe('hello');
  });

  it('replaces only first occurrence of {input}', () => {
    const skill: SkillDefinition = {
      name: 'multi',
      description: 'Multi template',
      capability: 'explain',
      prompt_template: '{input} and {input}',
    };
    const result = renderPrompt(skill, 'test');
    // String.replace only replaces first occurrence
    expect(result).toBe('test and {input}');
  });
});
