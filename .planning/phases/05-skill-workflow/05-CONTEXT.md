# Phase 5: Skill Workflow Foundation - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Let users define reusable local skill workflows that map to capability, strategy, tier, and prompt templates. This phase adds the `skill` command namespace and `skill run <name>` command. It must not add a skill marketplace, complex DSL, or remote skill registry (all v2.0).

Current state: The project already has a strategy engine (`src/core/strategy/`) with `StrategyDefinition` types and registry. There is no concept of "skill" as a user-defined template that maps to strategy + capability + prompt. The PRD defines Skill as the top-level abstraction: "Skill（技能）= 可复用模板（登录功能开发、Bug 修复流程）".

</domain>

<decisions>
## Implementation Decisions

### Skill definition format
- **D-01:** Skills are YAML files stored in a local directory: `~/.cli-switch/skills/` (global) and `.cli-switch/skills/` (project-local). Project skills override global skills with the same name.
- **D-02:** Skill YAML schema is simple and flat — no nested DSL, no conditionals, no loops in the definition itself:
  ```yaml
  name: bug-fix           # Skill name (must match filename)
  description: Fix a bug in existing code
  capability: fix_error   # Primary capability
  strategy: write_test_fix  # Strategy to use (optional, auto-select if omitted)
  tier: standard          # Default tier (optional)
  prompt_template: |
    Fix the following bug:
    {input}
    Focus on the minimal change needed.
  ```
- **D-03:** Skill filename becomes the skill ID: `bug-fix.yaml` → skill ID `bug-fix`.
- **D-04:** Required fields: `name`, `description`, `capability`. Optional: `strategy`, `tier`, `prompt_template`, `execution_mode`, `env`.

### Skill loading
- **D-05:** `loadSkill(name: string, projectDir?: string): SkillDefinition | null` — searches project skills first, then global skills.
- **D-06:** Skill YAML is validated with Zod schema on load. Invalid skill files produce structured `SKILL_INVALID` diagnostics.
- **D-07:** `listSkills(projectDir?: string): SkillInfo[]` — returns name + description + source (global/project) for all discoverable skills.

### Skill execution
- **D-08:** `cli-switch skill run <name> <input>` resolves the skill into an execution strategy and delegates to the existing `run` command logic.
- **D-09:** Skill execution reuses the strategy engine — skill's `strategy` maps to `StrategyName`, `capability` maps to `CapabilityId`, `tier` maps to `Tier`.
- **D-10:** `prompt_template` is rendered by replacing `{input}` with the user's input text. No other template variables in this phase.
- **D-11:** `cli-switch skill list [--json]` lists all discoverable skills with metadata.
- **D-12:** `cli-switch skill show <name> [--json]` shows full skill definition.

### Config integration
- **D-13:** Add `skills` section to config schema: `skills.default_strategy`, `skills.default_tier`, `skills.prompt_suffix`.
- **D-14:** Skill-level settings override config defaults when executing a skill.

### Error codes
- **D-15:** New error codes: `SKILL_NOT_FOUND`, `SKILL_INVALID`, `SKILL_LOAD_FAILED`.

### the agent's Discretion
- Exact file organization under `src/core/skill/`.
- Whether to add skill creation command (`skill create`) — not required for this phase.
- Template rendering beyond `{input}` substitution.

</decisions>

<specifics>
## Specific Ideas

- The PRD says "YAML 够用" (YAML is sufficient) — keep the schema flat and simple.
- `src/core/strategy/registry.ts` already defines strategy templates — skill execution maps to these.
- `src/core/config/loader.ts` already handles YAML loading with js-yaml — reuse for skill files.
- The `cli-switch skill run` command should internally reuse the same execution path as `cli-switch run`, just with pre-resolved capability/strategy/tier from the skill definition.
- Global skills directory: `~/.cli-switch/skills/` (same XDG-aware base as config).
- Project skills: `.cli-switch/skills/` in the project root.
- The Zod schema for skills should be strict (no unknown top-level keys) to catch typos.

</specifics>

<canonical_refs>
## Canonical References

### PRD
- `docs/PRD.md` §3.3 — Three-layer abstraction: Capability → Strategy → Skill.
- `docs/PRD.md` §5.1 — v0.4 features including `cli-switch skill run login_dev`.
- `docs/PRD.md` §4 — Core features: Skill as reusable template.

### Specs
- `docs/specs/routing-spec.md` §2.3 — Strategy selection rules.
- `docs/specs/runtime-spec.md` §1.2 — Execution state.

### Source code
- `src/types/strategy.ts` — StrategyName, StrategyDefinition, StrategyStep.
- `src/types/capability.ts` — CapabilityId, CAPABILITIES registry.
- `src/types/config.ts` — config schema (needs skills section).
- `src/core/strategy/registry.ts` — strategy definitions and selection.
- `src/core/config/loader.ts` — YAML loading utilities.
- `src/platform/paths.ts` — XDG-aware path resolution.
- `cmd/run.ts` — existing run command (to be reused by skill run).
- `cmd/root.ts` — command registration.

### Planning
- `.planning/ROADMAP.md` — Phase 5 goals, requirements, success criteria.
- `.planning/REQUIREMENTS.md` — SKL-01, SKL-02 definitions.

</canonical_refs>
