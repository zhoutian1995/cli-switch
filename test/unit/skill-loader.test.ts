import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkill, listSkills, getSkillDirs } from '../../src/core/skill/loader.js';

// ─── Helpers ────────────────────────────────────────────────

let tmpDir: string;
let globalSkillsDir: string;

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));
}

function writeProjectSkill(projectDir: string, name: string, content: string): void {
  const skillDir = path.join(projectDir, '.cli-switch', 'skills');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, `${name}.yaml`), content, 'utf-8');
}

function writeGlobalSkillFile(name: string, content: string): void {
  fs.mkdirSync(globalSkillsDir, { recursive: true });
  fs.writeFileSync(path.join(globalSkillsDir, `${name}.yaml`), content, 'utf-8');
}

const VALID_SKILL = `name: my-skill
description: A test skill
capability: write_code
`;

const FULL_SKILL = `name: full-skill
description: Full skill
capability: review_code
strategy: write_review
tier: premium
prompt_template: "Review: {input}"
execution_mode: patch-only
env:
  NODE_ENV: test
`;

const INVALID_YAML = `name: [invalid yaml
  broken: stuff
`;

const INVALID_SCHEMA = `name: bad-skill
description: Missing capability
wrong_field: true
`;

// ─── Tests ──────────────────────────────────────────────────

describe('skill-loader', () => {
  beforeEach(() => {
    tmpDir = makeTempDir();
    const dirs = getSkillDirs(tmpDir);
    globalSkillsDir = dirs.global;
    // Clean up any leftover files in global skills dir from previous test runs
    fs.rmSync(globalSkillsDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    // Clean up global skills dir
    fs.rmSync(globalSkillsDir, { recursive: true, force: true });
  });

  describe('loadSkill', () => {
    it('loads skill from project dir', async () => {
      writeProjectSkill(tmpDir, 'my-skill', VALID_SKILL);
      const result = await loadSkill('my-skill', tmpDir);
      expect(result.skill).not.toBeNull();
      expect(result.skill!.name).toBe('my-skill');
      expect(result.source).toBe('project');
      expect(result.errors).toHaveLength(0);
    });

    it('loads skill from global dir when project dir does not have it', async () => {
      writeGlobalSkillFile('global-skill', `name: global-skill
description: A global skill
capability: analyze
`);

      const result = await loadSkill('global-skill', tmpDir);
      expect(result.skill).not.toBeNull();
      expect(result.skill!.name).toBe('global-skill');
      expect(result.source).toBe('global');
      expect(result.errors).toHaveLength(0);
    });

    it('project overrides global (same name in both)', async () => {
      const projectContent = `name: override
description: Project version
capability: refactor
`;
      const globalContent = `name: override
description: Global version
capability: analyze
`;

      writeProjectSkill(tmpDir, 'override', projectContent);
      writeGlobalSkillFile('override', globalContent);

      const result = await loadSkill('override', tmpDir);
      expect(result.skill).not.toBeNull();
      expect(result.skill!.description).toBe('Project version');
      expect(result.skill!.capability).toBe('refactor');
      expect(result.source).toBe('project');
    });

    it('returns SKILL_NOT_FOUND when skill does not exist', async () => {
      const result = await loadSkill('nonexistent', tmpDir);
      expect(result.skill).toBeNull();
      expect(result.source).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SKILL_NOT_FOUND');
    });

    it('returns SKILL_LOAD_FAILED for invalid YAML', async () => {
      writeProjectSkill(tmpDir, 'broken', INVALID_YAML);
      const result = await loadSkill('broken', tmpDir);
      expect(result.skill).toBeNull();
      expect(result.source).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SKILL_LOAD_FAILED');
      expect(result.errors[0].path).toContain('broken.yaml');
    });

    it('returns SKILL_INVALID for invalid schema', async () => {
      writeProjectSkill(tmpDir, 'bad-schema', INVALID_SCHEMA);
      const result = await loadSkill('bad-schema', tmpDir);
      expect(result.skill).toBeNull();
      expect(result.source).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SKILL_INVALID');
      expect(result.errors[0].path).toContain('bad-schema.yaml');
    });
  });

  describe('listSkills', () => {
    it('lists skills from both project and global dirs', async () => {
      writeProjectSkill(tmpDir, 'proj-skill', VALID_SKILL);
      writeGlobalSkillFile('glob-skill', FULL_SKILL);

      const skills = await listSkills(tmpDir);
      expect(skills.length).toBe(2);

      const names = skills.map((s) => s.name);
      expect(names).toContain('my-skill');
      expect(names).toContain('full-skill');

      // Check sources
      const projSkill = skills.find((s) => s.name === 'my-skill');
      expect(projSkill?.source).toBe('project');

      const globSkill = skills.find((s) => s.name === 'full-skill');
      expect(globSkill?.source).toBe('global');
    });

    it('returns empty array for non-existent dirs', async () => {
      const skills = await listSkills(tmpDir);
      expect(skills).toEqual([]);
    });
  });

  describe('getSkillDirs', () => {
    it('returns correct paths with projectDir', () => {
      const dirs = getSkillDirs('/my/project');
      expect(dirs.project).toBe(path.join('/my/project', '.cli-switch', 'skills'));
      expect(dirs.global).toContain('cli-switch');
      expect(dirs.global).toContain('skills');
    });

    it('returns empty project path without projectDir', () => {
      const dirs = getSkillDirs();
      expect(dirs.project).toBe('');
      expect(dirs.global).toContain('cli-switch');
      expect(dirs.global).toContain('skills');
    });
  });
});
