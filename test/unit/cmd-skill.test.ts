import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Command } from 'commander';

// Mock platform/paths before importing skill command
let __tmpDir: string;

vi.mock('../../src/platform/paths.js', () => ({
  resolvePaths: () => ({
    configDir: __tmpDir,
    dataDir: path.join(__tmpDir, 'data'),
  }),
}));

import { createSkillCommand } from '../../cmd/skill.js';
import { getSkillDirs } from '../../src/core/skill/loader.js';

// ─── Helpers ────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cs-skill-cmd-'));
}

function writeProjectSkill(projectDir: string, name: string, content: string): void {
  const skillDir = path.join(projectDir, '.cli-switch', 'skills');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, `${name}.yaml`), content, 'utf-8');
}

function writeGlobalSkillFile(name: string, content: string): void {
  const dirs = getSkillDirs(__tmpDir);
  fs.mkdirSync(dirs.global, { recursive: true });
  fs.writeFileSync(path.join(dirs.global, `${name}.yaml`), content, 'utf-8');
}

function writeProjectConfig(cwd: string, content: string): void {
  fs.writeFileSync(path.join(cwd, '.cli-switch.yaml'), content, 'utf-8');
}

const VALID_SKILL = `name: my-skill
description: A test skill
capability: write_code
`;

const FULL_SKILL = `name: full-skill
description: Full skill with all options
capability: review_code
strategy: write_review
tier: premium
prompt_template: "Review this code: {input}"
execution_mode: patch-only
env:
  NODE_ENV: test
`;

const WRITE_TESTS_SKILL = `name: test-writer
description: Write tests for given code
capability: write_tests
strategy: write_test_fix
tier: economy
prompt_template: "Write tests for: {input}"
`;

/** Run a skill subcommand and capture output. */
async function runSkill(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const program = new Command();
  program.exitOverride();
  program.allowUnknownOption();
  program.addCommand(createSkillCommand());

  let stdout = '';
  let stderr = '';
  const origLog = console.log;
  const origError = console.error;
  console.log = (...a) => { stdout += a.join(' ') + '\n'; };
  console.error = (...a) => { stderr += a.join(' ') + '\n'; };

  let exitCode = 0;
  const origCwd = process.cwd();
  const origExitCode = process.exitCode;
  process.exitCode = 0;
  if (cwd) process.chdir(cwd);
  try {
    await program.parseAsync(['skill', ...args], { from: 'user' });
  } catch (err: any) {
    if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
      exitCode = 0;
    } else {
      exitCode = err.exitCode ?? 1;
    }
  } finally {
    if (cwd) process.chdir(origCwd);
    exitCode = process.exitCode ?? exitCode;
    process.exitCode = origExitCode;
    console.log = origLog;
    console.error = origError;
  }
  return { stdout, stderr, exitCode };
}

// ─── Tests ──────────────────────────────────────────────────

describe('skill list', () => {
  let projectDir: string;

  beforeEach(() => {
    __tmpDir = makeTempDir();
    projectDir = makeTempDir();
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(__tmpDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('prints "No skills found." when no skills exist', async () => {
    const { stdout, exitCode } = await runSkill(['list'], projectDir);
    expect(stdout).toContain('No skills found.');
    expect(exitCode).toBe(0);
  });

  it('lists skills in table format', async () => {
    writeProjectSkill(projectDir, 'code-review', VALID_SKILL.replace('my-skill', 'code-review').replace('A test skill', 'Review code'));
    const { stdout, exitCode } = await runSkill(['list'], projectDir);
    expect(stdout).toContain('code-review');
    expect(stdout).toContain('project');
    expect(stdout).toContain('Description');
    expect(exitCode).toBe(0);
  });

  it('lists skills as JSON with --json', async () => {
    writeProjectSkill(projectDir, 'my-skill', VALID_SKILL);
    const { stdout, exitCode } = await runSkill(['list', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('my-skill');
    expect(parsed.data[0].source).toBe('project');
    expect(exitCode).toBe(0);
  });

  it('--json with no skills returns empty array', async () => {
    const { stdout, exitCode } = await runSkill(['list', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toEqual([]);
    expect(exitCode).toBe(0);
  });

  it('lists multiple skills sorted by name', async () => {
    writeProjectSkill(projectDir, 'z-skill', VALID_SKILL.replace('my-skill', 'z-skill').replace('A test skill', 'Z skill'));
    writeProjectSkill(projectDir, 'a-skill', VALID_SKILL.replace('my-skill', 'a-skill').replace('A test skill', 'A skill'));
    const { stdout, exitCode } = await runSkill(['list'], projectDir);
    const aIdx = stdout.indexOf('a-skill');
    const zIdx = stdout.indexOf('z-skill');
    expect(aIdx).toBeLessThan(zIdx);
    expect(exitCode).toBe(0);
  });
});

describe('skill show', () => {
  let projectDir: string;

  beforeEach(() => {
    __tmpDir = makeTempDir();
    projectDir = makeTempDir();
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(__tmpDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('shows skill details in formatted output', async () => {
    writeProjectSkill(projectDir, 'full-skill', FULL_SKILL);
    const { stdout, exitCode } = await runSkill(['show', 'full-skill'], projectDir);
    expect(stdout).toContain('full-skill');
    expect(stdout).toContain('review_code');
    expect(stdout).toContain('write_review');
    expect(stdout).toContain('premium');
    expect(stdout).toContain('patch-only');
    expect(stdout).toContain('project');
    expect(exitCode).toBe(0);
  });

  it('shows skill as JSON with --json', async () => {
    writeProjectSkill(projectDir, 'my-skill', VALID_SKILL);
    const { stdout, exitCode } = await runSkill(['show', 'my-skill', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.name).toBe('my-skill');
    expect(parsed.data.capability).toBe('write_code');
    expect(exitCode).toBe(0);
  });

  it('shows (auto) for missing strategy and tier', async () => {
    writeProjectSkill(projectDir, 'my-skill', VALID_SKILL);
    const { stdout, exitCode } = await runSkill(['show', 'my-skill'], projectDir);
    expect(stdout).toContain('(auto)');
    expect(exitCode).toBe(0);
  });

  it('errors for nonexistent skill', async () => {
    const { stdout, stderr, exitCode } = await runSkill(['show', 'nonexistent'], projectDir);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain('nonexistent');
    expect(stdout + stderr).toContain('SKILL_NOT_FOUND');
  });

  it('shows prompt_template when present', async () => {
    writeProjectSkill(projectDir, 'full-skill', FULL_SKILL);
    const { stdout, exitCode } = await runSkill(['show', 'full-skill'], projectDir);
    expect(stdout).toContain('prompt_template');
    expect(stdout).toContain('Review this code:');
    expect(exitCode).toBe(0);
  });
});

describe('skill run', () => {
  let projectDir: string;

  beforeEach(() => {
    __tmpDir = makeTempDir();
    projectDir = makeTempDir();
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(__tmpDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('errors for nonexistent skill', async () => {
    const { stdout, stderr, exitCode } = await runSkill(['run', 'nonexistent'], projectDir);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain('SKILL_NOT_FOUND');
  });

  it('dry-run shows resolved parameters', async () => {
    writeProjectSkill(projectDir, 'test-writer', WRITE_TESTS_SKILL);
    const { stdout, exitCode } = await runSkill(['run', 'test-writer', 'some input', '--dry-run'], projectDir);
    expect(stdout).toContain('test-writer');
    expect(stdout).toContain('write_tests');
    expect(stdout).toContain('write_test_fix');
    expect(stdout).toContain('economy');
    expect(stdout).toContain('Agent:');
    expect(exitCode).toBe(0);
  });

  it('dry-run --json outputs structured JSON', async () => {
    writeProjectSkill(projectDir, 'test-writer', WRITE_TESTS_SKILL);
    const { stdout, exitCode } = await runSkill(['run', 'test-writer', 'some code', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.skill).toBe('test-writer');
    expect(parsed.data.capability).toBe('write_tests');
    expect(parsed.data.strategy).toBe('write_test_fix');
    expect(parsed.data.tier).toBe('economy');
    expect(parsed.data.prompt).toContain('Write tests for: some code');
    expect(exitCode).toBe(0);
  });

  it('renders prompt from template', async () => {
    writeProjectSkill(projectDir, 'full-skill', FULL_SKILL);
    const { stdout, exitCode } = await runSkill(['run', 'full-skill', 'my code here', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.data.prompt).toBe('Review this code: my code here');
    expect(exitCode).toBe(0);
  });

  it('uses input as-is when no prompt_template', async () => {
    writeProjectSkill(projectDir, 'my-skill', VALID_SKILL);
    const { stdout, exitCode } = await runSkill(['run', 'my-skill', 'hello world', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.data.prompt).toBe('hello world');
    expect(exitCode).toBe(0);
  });

  it('CLI --strategy overrides skill strategy in dry-run', async () => {
    writeProjectSkill(projectDir, 'test-writer', WRITE_TESTS_SKILL);
    const { stdout, exitCode } = await runSkill(['run', 'test-writer', 'x', '--strategy', 'single', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.data.strategy).toBe('single');
    expect(exitCode).toBe(0);
  });

  it('CLI --tier overrides skill tier in dry-run', async () => {
    writeProjectSkill(projectDir, 'test-writer', WRITE_TESTS_SKILL);
    const { stdout, exitCode } = await runSkill(['run', 'test-writer', 'x', '--tier', 'premium', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.data.tier).toBe('premium');
    expect(exitCode).toBe(0);
  });

  it('rejects invalid --strategy', async () => {
    writeProjectSkill(projectDir, 'my-skill', VALID_SKILL);
    const { stdout, stderr, exitCode } = await runSkill(['run', 'my-skill', 'x', '--strategy', 'invalid'], projectDir);
    expect(exitCode).not.toBe(0);
    expect(stdout + stderr).toContain('--strategy must be one of');
  });

  it('uses config.skills.defaults when no skill overrides', async () => {
    writeProjectSkill(projectDir, 'my-skill', VALID_SKILL);
    writeProjectConfig(projectDir, `skills:\n  default_strategy: high_quality\n  default_tier: economy\n  prompt_suffix: "\\n\\nExtra instructions."\n`);
    const { stdout, exitCode } = await runSkill(['run', 'my-skill', 'fix this', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    // write_code auto-selects 'single' from capability, but config.skills.default_strategy
    // only applies when skill has no strategy; skill VALID_SKILL has no strategy.
    // The priority is: CLI > skill > config.skills > auto-select.
    // Since skill has no strategy, config.skills.default_strategy should apply.
    expect(parsed.data.strategy).toBe('high_quality');
    expect(parsed.data.tier).toBe('economy');
    expect(parsed.data.prompt).toContain('Extra instructions.');
    expect(exitCode).toBe(0);
  });

  it('skill strategy takes precedence over config.skills', async () => {
    writeProjectSkill(projectDir, 'test-writer', WRITE_TESTS_SKILL);
    writeProjectConfig(projectDir, `skills:\n  default_strategy: single\n`);
    const { stdout, exitCode } = await runSkill(['run', 'test-writer', 'x', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    // skill has strategy: write_test_fix, should win over config's single
    expect(parsed.data.strategy).toBe('write_test_fix');
    expect(exitCode).toBe(0);
  });

  it('CLI --execution-mode overrides skill execution_mode in dry-run', async () => {
    writeProjectSkill(projectDir, 'full-skill', FULL_SKILL);
    const { stdout, exitCode } = await runSkill(['run', 'full-skill', 'x', '--execution-mode', 'worktree', '--dry-run', '--json'], projectDir);
    const parsed = JSON.parse(stdout);
    expect(parsed.data.execution_mode).toBe('worktree');
    expect(exitCode).toBe(0);
  });
});
