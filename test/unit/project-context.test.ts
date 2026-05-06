import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectContextBuilder } from '../../src/core/context/project-context.js';

describe('ProjectContextBuilder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ctx-test-'));
    // Minimal package.json
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'my-project',
      dependencies: { react: '^19.0.0' },
      devDependencies: { typescript: '^5.6.0' },
    }));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('build returns project info', () => {
    const builder = new ProjectContextBuilder(tempDir);
    const ctx = builder.build();

    expect(ctx.projectRoot).toBe(tempDir);
    expect(ctx.projectName).toBe('my-project');
    expect(ctx.techStack.languages).toContain('typescript');
  });

  it('buildSystemPrompt contains tech stack info', () => {
    const builder = new ProjectContextBuilder(tempDir);
    const prompt = builder.buildSystemPrompt(
      { type: 'refactoring', complexity: 'medium', needsLongContext: false, techStack: ['typescript'], rawInput: 'refactor types' },
      builder.build().techStack,
    );

    expect(prompt).toContain('typescript');
    expect(prompt).toContain('refactoring');
  });

  it('handles non-git directory gracefully', () => {
    const builder = new ProjectContextBuilder(tempDir);
    const ctx = builder.build();
    // gitBranch may be empty string, that's fine
    expect(ctx).toBeDefined();
  });
});
