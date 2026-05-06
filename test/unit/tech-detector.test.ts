import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TechDetector } from '../../src/core/context/tech-detector.js';

describe('TechDetector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tech-det-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects TypeScript + React from package.json', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-app',
      dependencies: { react: '^19.0.0' },
      devDependencies: { typescript: '^5.6.0', vitest: '^3.0.0' },
    }));
    writeFileSync(join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022' } }));

    const detector = new TechDetector(tempDir);
    const stack = detector.detect();

    expect(stack.languages).toContain('typescript');
    expect(stack.frameworks).toContain('react');
    expect(stack.testFramework).toBe('vitest');
  });

  it('detects Python project from requirements.txt', () => {
    writeFileSync(join(tempDir, 'requirements.txt'), 'fastapi>=0.100.0\npytest\n');

    const detector = new TechDetector(tempDir);
    const stack = detector.detect();

    expect(stack.languages).toContain('python');
    expect(stack.frameworks).toContain('fastapi');
    expect(stack.testFramework).toBe('pytest');
  });

  it('handles empty directory gracefully', () => {
    const detector = new TechDetector(tempDir);
    const stack = detector.detect();

    expect(stack.languages).toEqual([]);
    expect(stack.frameworks).toEqual([]);
  });

  it('static helper detectFrom works', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
      dependencies: { vue: '^3.0.0' },
    }));

    const stack = TechDetector.detectFrom(tempDir);
    expect(stack.frameworks).toContain('vue');
  });
});
