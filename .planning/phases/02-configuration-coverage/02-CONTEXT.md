# Phase 2: Configuration Coverage - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the user-facing configuration layer for cli-switch runtime defaults: global config, project config, safe merge/precedence, and config commands for inspection and mutation. This phase wires config into gateway, routing, tier, strategy, and loop defaults, but does not implement output validation, patch-only execution, temp project copies, worktree isolation, or Skill DSL.

</domain>

<decisions>
## Implementation Decisions

### Config file format and locations
- **D-01:** Use YAML for the new main config files because the PRD and specs consistently name `~/.cli-switch/config.yaml` and project `.cli-switch.yaml`.
- **D-02:** Keep existing `registry.override.toml` behavior separate. Do not migrate registry overrides into `config.yaml` in this phase.
- **D-03:** Global config lives at the existing platform config dir, resolved through `resolvePaths().configDir`, as `config.yaml`.
- **D-04:** Project config is `.cli-switch.yaml` at the current project root / command cwd. Do not recursively search parent directories in v0.3 unless planning finds an existing local pattern that already supports it.

### Precedence and merge behavior
- **D-05:** Precedence is `CLI flags > task/runtime options > project config > global config > environment aliases > built-in defaults`.
- **D-06:** Use deep merge for nested objects such as `gateway.models`, `gateway.agentKeys`, and `routing.capability_tier_override`; replace arrays if arrays are introduced later.
- **D-07:** Treat explicit `null` or empty string in config as invalid for required scalar fields instead of as a delete operator.
- **D-08:** Keep environment variable aliases as fallback compatibility. Config may override env for runtime defaults, but CLI flags still win.

### Config schema scope
- **D-09:** Phase 2 config should cover only gateway, routing/tier, execution/strategy, loop defaults, and output preference fields needed by current commands.
- **D-10:** Use stable internal types for `Config`, `GatewayConfig`, and routing config rather than letting commands read raw YAML directly.
- **D-11:** Add validation with structured errors for invalid tier, strategy, execution mode, base URL, malformed YAML, and wrong object shapes.
- **D-12:** Initial schema should be strict enough to catch typos in known top-level sections, while leaving a small `metadata` or future-extension path only if needed.

### Command behavior
- **D-13:** Add a `config` command group with `show`, `set`, and `reset`, all supporting `--json`.
- **D-14:** `config show --json` should expose the effective merged config plus source metadata, redacting secrets.
- **D-15:** `config set` should write to global config by default and support a project-target flag if the planner finds a clean commander pattern.
- **D-16:** `config reset` should be conservative: reset a single key/path by default; whole-file reset should require an explicit flag.

### Runtime integration
- **D-17:** Wire config into `run` before gateway and tier resolution so `loadGatewayConfig()` can receive config-derived overrides.
- **D-18:** Wire config into `resolveTier(capability, config.routing, options.tier)` instead of the current placeholder `undefined`.
- **D-19:** Use config to set default execution strategy only when the CLI did not pass `--execution`.
- **D-20:** Preserve dry-run JSON shape while adding config source information only under additive fields.

### Error handling and safety
- **D-21:** Config failures should use structured JSON envelope errors. Recommended public codes: `CONFIG_NOT_FOUND`, `CONFIG_INVALID`, `CONFIG_WRITE_FAILED`, and `CONFIG_KEY_NOT_FOUND`.
- **D-22:** Missing config is not an error for normal commands; invalid config is an error when a command attempts to load it.
- **D-23:** Never print API keys, relay keys, OpenRouter keys, or agent-specific keys in text or JSON output.

### the agent's Discretion
- Exact module names and helper boundaries.
- Whether to use an existing dependency or a small parser wrapper, as long as YAML config is supported and build/test stay stable.
- Exact dot-path grammar for `config set/reset`, if documented and tested.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and requirements
- `docs/PRD.md` — Product target for v2.0 config and CLI behavior.
- `.planning/REQUIREMENTS.md` — CFG-01 through CFG-04 are the locked requirements for this phase.
- `.planning/ROADMAP.md` — Phase 2 scope and success criteria.
- `docs/IMPLEMENTATION_GAP_REPORT.md` — Current gap status after Phase 1.

### Runtime and routing specs
- `docs/specs/routing-spec.md` — Gateway/tier/routing config examples and precedence model.
- `docs/specs/sandbox-spec.md` — Config file paths and sandbox interaction notes.
- `docs/specs/runtime-spec.md` — JSON envelope and error-code expectations.

### Current implementation
- `src/platform/paths.ts` — Existing XDG-aware config/data/cache path resolution.
- `src/core/gateway/index.ts` — Current env/override gateway loader to extend with config input.
- `src/types/gateway.ts` — Existing gateway config types and env aliases.
- `src/core/router/tier-resolver.ts` — Already accepts routing config but `cmd/run.ts` does not pass it yet.
- `cmd/run.ts` — Runtime integration point for gateway, tier, strategy, execution, and dry-run JSON.
- `cmd/env.ts` — Existing configuration-source inspection pattern.
- `cmd/_shared.ts` — JSON envelope helpers and command context creation.
- `src/registry/loader.ts` — Existing TOML loader pattern for registry overrides; keep separate from main YAML config.
- `test/unit/tier-resolver.test.ts` — Existing precedence tests for routing config.
- `test/e2e/cli-json.test.ts` — JSON envelope golden coverage to extend.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolvePaths()` already gives an XDG-aware `configDir`; reuse it for global `config.yaml`.
- `loadGatewayConfig(overrides?)` already supports a `Partial<GatewayConfig>` override object, so config can be integrated without rewriting gateway resolution.
- `resolveTier(capability, config, cliOverride)` already encodes the desired CLI-over-config-over-default precedence.
- `printJson()`, `toErrorEnvelope()`, and `createError()` already provide the JSON envelope surface for new config command failures.

### Established Patterns
- Commands use commander factories under `cmd/` and return stable JSON envelopes for `--json`.
- Tests are split between unit contract tests and e2e command JSON tests.
- Registry override TOML is loaded from the platform config dir and merged with builtins; do not conflate this with user runtime config.
- Gateway env aliases currently include `SWITCH_*`, `SWITCH_RELAY_*`, and `OPENROUTER_*`; Phase 2 should preserve that behavior.

### Integration Points
- Add a config loader module under `src/core/config/` or equivalent and export stable types via `src/types/config.ts`.
- Register a new `config` command group in `cmd/root.ts`.
- Update `cmd/run.ts` where it currently has `TODO: PR4 — wire RoutingConfig from ~/.cli-switch/config.yaml loading`.
- Extend tests around `test/unit/tier-resolver.test.ts`, gateway config loading, and `test/e2e/cli-json.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- Use `config show --json` as the primary debugging surface for users and upper-level agents.
- Include source metadata such as `global.loaded`, `project.loaded`, and `effective.redacted` so scripts can explain where a decision came from.
- Keep secret redaction centralized so future commands cannot accidentally leak keys.
- Treat this phase as the config substrate for later output validation, isolation, and Skill workflow phases.

</specifics>

<deferred>
## Deferred Ideas

- Output schema validation and diff repair belong to Phase 3.
- Patch-only, temp-copy, and worktree execution belong to Phase 4.
- Skill definitions and `skill run` belong to Phase 5.
- Recursive project config discovery can be added later if users need monorepo parent config behavior.

</deferred>

---

*Phase: 02-configuration-coverage*
*Context gathered: 2026-05-08*
