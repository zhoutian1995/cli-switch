# 02-01 Summary: Config Schema, Loader, Merge, and Redaction

**Status**: ✅ Complete
**Date**: 2026-05-08
**Commits**: 3 (f304467, <loader-merge-barrel>, a0202ce)

## Delivered

### Task 1: Config Types (CFG-01)
- `src/types/config.ts` — Zod v4 schemas for full config:
  - `gatewayConfigSchema` (base_url, api_key, models, default_tier)
  - `routingConfigSchema` (tier_default, capability_tier_override)
  - `loggingConfigSchema` (level, format)
  - `cliSwitchConfigSchema` (top-level strict object)
  - Exported `CliSwitchConfig` TypeScript type
- Zod v4 quirk: `z.record()` requires both key+value schemas; used `z.partialRecord()` for optional-key records

### Task 2: Config Loader (CFG-01, CFG-02)
- `src/core/config/loader.ts` — `loadConfig(cwd)` and `loadConfigRaw(cwd)`:
  - Searches: global `~/.config/cli-switch/config.yaml` + project `.cli-switch.yaml`
  - Parses YAML (js-yaml), validates via Zod, deep-merges (project wins)
  - Returns `{ config: EffectiveConfig | null, errors: ConfigError[] }`
  - `loadConfig` redacts secrets; `loadConfigRaw` returns raw values
- `src/core/config/index.ts` — barrel export

### Task 3: Merge and Secret Redaction (CFG-01)
- `src/core/config/merge.ts`:
  - `deepMerge(base, override)` — recursive object merge, arrays replaced, undefined skipped
  - `isSecretField(name)` — matches key/token/secret/password
  - `redactSecrets(obj)` — recursive, replaces non-empty secret strings with `***`

### Task 4: Unit Tests (27 tests)
- `test/unit/config.test.ts`:
  - 7 deepMerge tests (nested merge, array replace, immutable, 3-level)
  - 5 isSecretField tests (key/token/secret/password/non-secret)
  - 7 redactSecrets tests (recursive, arrays, primitives, immutable)
  - 8 loader integration tests (null, load, raw, merge, invalid YAML, empty YAML, strict schema, invalid values)

### Bug Fix
- **readSource error-path bug**: `readYamlFile` returns `{ data: null, error: '...' }` for broken/empty YAML, but `readSource` checked `data !== null` before accessing `error`, silently swallowing parse errors. Fixed by checking `error` independently.

## Verification
- **tsc --noEmit**: 0 `src/` errors
- **lint**: pass
- **build**: pass
- **vitest**: 35 files, 349 passed, 1 failed (Hermes env pollution — pre-existing), 1 skipped
- **New tests**: 25 added (27 total in config.test.ts, 2 are within-file load)

## Dependencies Added
- `js-yaml` + `@types/js-yaml` (devDependencies)

## Deferred (to 02-02)
- Wiring config into `cmd/run.ts` (TODO: PR4 sections)
- TOML support (YAML-only for now, TOML easy to add later)
- Config path override via CLI flag
