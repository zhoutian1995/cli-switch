/**
 * Skill Renderer — renders prompt templates from skill definitions.
 */

import type { SkillDefinition } from './schema.js';

/**
 * Render a prompt using the skill's template.
 * If the skill has a prompt_template, replaces {input} with the input text.
 * If no template, returns the input as-is.
 */
export function renderPrompt(skill: SkillDefinition, input: string): string {
  if (skill.prompt_template) {
    return skill.prompt_template.replace('{input}', input);
  }
  return input;
}
