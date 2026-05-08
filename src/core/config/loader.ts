/**
 * Config loader — reads, parses, validates, merges, and redacts config.
 *
 * Precedence: CLI flags > task options > project config > global config > env > defaults.
 * This module handles only: project config + global config. CLI flags and env are
 * applied by the consuming command (cmd/run.ts in 02-02).
 *
 * @see .planning/phases/02-configuration-coverage/02-CONTEXT.md D-01 through D-08
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as yaml from 'js-yaml';

import { resolvePaths } from '../../platform/paths.js';
import { configSchema } from '../../types/config.js';
import type {
  CliSwitchConfig,
  ConfigError,
  ConfigLoadResult,
  ConfigSource,
  EffectiveConfig,
} from '../../types/config.js';
import { deepMerge, redactSecrets } from './merge.js';

// ─── Internal helpers ──────────────────────────────────────

/** Parse a YAML file and return the raw object, or null/ConfigError. */
function readYamlFile(filePath: string): { data: unknown; error?: string } {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(raw);
    if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
      return { data: null, error: 'YAML file is empty or not an object' };
    }
    return { data: parsed as Record<string, unknown> };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { data: null };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Invalid YAML: ${msg}` };
  }
}

/** Validate parsed data against the Zod config schema. */
function validateConfig(
  data: unknown,
  source: string,
): { config: CliSwitchConfig; errors: ConfigError[] } {
  const errors: ConfigError[] = [];
  const result = configSchema.safeParse(data);

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        code: 'CONFIG_INVALID',
        message: issue.message,
        path: `${source}:${issue.path.join('.')}`,
      });
    }
    return { config: {}, errors };
  }

  return { config: result.data as CliSwitchConfig, errors };
}

/** Shared logic for reading a single config source. */
function readSource(
  filePath: string,
  sourceLabel: string,
): { config: CliSwitchConfig; source: ConfigSource; errors: ConfigError[] } {
  const errors: ConfigError[] = [];
  const source: ConfigSource = { path: filePath, loaded: false };
  let config: CliSwitchConfig = {};

  const raw = readYamlFile(filePath);
  if (raw.data !== null) {
    source.loaded = true;
    if (raw.error) {
      source.invalid = raw.error;
      errors.push({ code: 'CONFIG_INVALID', message: raw.error, path: filePath });
    } else {
      const validated = validateConfig(raw.data, sourceLabel);
      config = validated.config;
      errors.push(...validated.errors);
    }
  }

  return { config, source, errors };
}

/** Core load logic, shared by loadConfig and loadConfigRaw. */
function loadConfigCore(cwd: string, redact: boolean): ConfigLoadResult {
  const errors: ConfigError[] = [];
  const paths = resolvePaths();

  const globalPath = join(paths.configDir, 'config.yaml');
  const projectPath = join(cwd, '.cli-switch.yaml');

  const globalResult = readSource(globalPath, 'global');
  const projectResult = readSource(projectPath, 'project');

  errors.push(...globalResult.errors, ...projectResult.errors);

  const merged = deepMerge(
    globalResult.config as Record<string, unknown>,
    projectResult.config as Partial<Record<string, unknown>>,
  ) as CliSwitchConfig;

  const effectiveConfig: EffectiveConfig = {
    config: redact ? redactSecrets(merged) : merged,
    sources: { global: globalResult.source, project: projectResult.source },
  };

  return {
    config: (globalResult.source.loaded || projectResult.source.loaded)
      ? effectiveConfig
      : null,
    errors,
  };
}

// ─── Public API ────────────────────────────────────────────

/**
 * Load config from global + project YAML files, merge, validate, and redact.
 *
 * - Global: resolvePaths().configDir / 'config.yaml'
 * - Project: (cwd ?? process.cwd()) / '.cli-switch.yaml'
 * - Missing files are not errors.
 * - Invalid YAML or schema produces CONFIG_INVALID errors.
 * - Secret values are redacted in the returned config.
 */
export function loadConfig(cwd?: string): ConfigLoadResult {
  return loadConfigCore(cwd ?? process.cwd(), true);
}

/**
 * Load raw (unredacted) config. For internal use only (e.g., gateway injection).
 * Consumers that display config to users MUST use loadConfig() instead.
 */
export function loadConfigRaw(cwd?: string): ConfigLoadResult {
  return loadConfigCore(cwd ?? process.cwd(), false);
}
