/**
 * Skill Loader — loads Skill YAML files from project and global directories.
 *
 * Search order: project dir (.cli-switch/skills/) → global dir (<configDir>/skills/).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { resolvePaths } from '../../platform/paths.js';
import { skillSchema } from './schema.js';
import type { SkillDefinition, SkillInfo, SkillLoadError } from './schema.js';

// ─── Public API ──────────────────────────────────────────────

/**
 * Load a skill by name from project dir (priority) or global dir.
 */
export async function loadSkill(
  name: string,
  projectDir?: string,
): Promise<{ skill: SkillDefinition | null; source: 'global' | 'project' | null; errors: SkillLoadError[] }> {
  const dirs = getSkillDirs(projectDir);
  const fileName = `${name}.yaml`;

  // Try project dir first, then global
  const candidates: { filePath: string; source: 'global' | 'project' }[] = [];
  if (projectDir) {
    candidates.push({ filePath: path.join(dirs.project, fileName), source: 'project' });
  }
  candidates.push({ filePath: path.join(dirs.global, fileName), source: 'global' });

  for (const { filePath, source } of candidates) {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      continue;
    }

    // Read file
    let text: string;
    try {
      text = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      return {
        skill: null,
        source: null,
        errors: [{
          code: 'SKILL_LOAD_FAILED',
          message: `Failed to read skill file: ${filePath}`,
          path: filePath,
        }],
      };
    }

    // Parse YAML
    let data: unknown;
    try {
      data = yaml.load(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        skill: null,
        source: null,
        errors: [{
          code: 'SKILL_LOAD_FAILED',
          message: `Invalid YAML in skill file: ${msg}`,
          path: filePath,
        }],
      };
    }

    // Validate schema
    const result = skillSchema.safeParse(data);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join('; ');
      return {
        skill: null,
        source: null,
        errors: [{
          code: 'SKILL_INVALID',
          message: `Skill validation failed: ${messages}`,
          path: filePath,
        }],
      };
    }

    return {
      skill: result.data as SkillDefinition,
      source,
      errors: [],
    };
  }

  // Not found in any directory
  return {
    skill: null,
    source: null,
    errors: [{
      code: 'SKILL_NOT_FOUND',
      message: `Skill "${name}" not found`,
    }],
  };
}

/**
 * List all available skills from both project and global directories.
 */
export async function listSkills(projectDir?: string): Promise<SkillInfo[]> {
  const dirs = getSkillDirs(projectDir);
  const skills: SkillInfo[] = [];

  // Scan project dir
  if (projectDir) {
    skills.push(...scanDir(dirs.project, 'project'));
  }

  // Scan global dir
  skills.push(...scanDir(dirs.global, 'global'));

  // Sort by name
  skills.sort((a, b) => a.name.localeCompare(b.name));

  return skills;
}

/**
 * Get the project and global skill directories.
 */
export function getSkillDirs(projectDir?: string): { project: string; global: string } {
  const { configDir } = resolvePaths();
  return {
    project: projectDir ? path.join(projectDir, '.cli-switch', 'skills') : '',
    global: path.join(configDir, 'skills'),
  };
}

// ─── Internal ────────────────────────────────────────────────

/**
 * Scan a directory for .yaml skill files and extract name + description.
 * Handles missing directories gracefully.
 */
function scanDir(dir: string, source: 'global' | 'project'): SkillInfo[] {
  const skills: SkillInfo[] = [];

  if (!dir || !fs.existsSync(dir)) {
    return skills;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.yaml')) {
      continue;
    }

    const filePath = path.join(dir, entry.name);
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      const data = yaml.load(text) as Record<string, unknown> | null;
      if (data && typeof data === 'object' && typeof data.name === 'string') {
        skills.push({
          name: data.name,
          description: typeof data.description === 'string' ? data.description : '',
          source,
        });
      }
    } catch {
      // Skip files that can't be read or parsed
    }
  }

  return skills;
}
