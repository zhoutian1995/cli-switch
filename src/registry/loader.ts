import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@iarna/toml';

import type {
  CapabilityFlags,
  EffectiveRegistry,
  ModelDefinition,
  ProfileDefinition,
  ProviderDefinition,
  ToolDefinition,
} from '../types/registry.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
// Walk up until we find the project root (the directory containing package.json).
// This works for both 'dist/src/registry/loader.js' and 'dist/cmd/root.js'.
let PROJECT_ROOT = MODULE_DIR;
while (PROJECT_ROOT !== '/' && !existsSync(resolve(PROJECT_ROOT, 'package.json'))) {
  PROJECT_ROOT = resolve(PROJECT_ROOT, '..');
}
const BUILTINS_DIR = resolve(PROJECT_ROOT, 'src/registry/builtins');

const BUILTIN_FILES = {
  models: resolve(BUILTINS_DIR, 'models.toml'),
  tools: resolve(BUILTINS_DIR, 'tools.toml'),
  profiles: resolve(BUILTINS_DIR, 'profiles.toml'),
  providers: resolve(BUILTINS_DIR, 'providers.toml'),
} as const;

const DEFAULT_PROFILE_CAPABILITIES: CapabilityFlags = {
  mcp: false,
  skills: false,
  toolPolicy: false,
  structuredOutput: false,
};

type TomlRecord = Record<string, unknown>;

type ParsedRegistryToml<T> = Record<string, T>;

function readTomlFile<T>(path: string): ParsedRegistryToml<T> {
  let raw = '';

  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to read built-in registry file at ${path}: ${getErrorMessage(error)}`,
    );
  }

  try {
    const parsed = parse(raw);

    if (!isTomlRecord(parsed)) {
      throw new Error('Top-level TOML value must be an object');
    }

    return parsed as ParsedRegistryToml<T>;
  } catch (error) {
    throw new Error(
      `Failed to parse built-in registry TOML at ${path}: ${getErrorMessage(error)}`,
    );
  }
}

function isTomlRecord(value: unknown): value is TomlRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeProfiles(
  profiles: ParsedRegistryToml<ProfileDefinition>,
): Record<string, ProfileDefinition> {
  const flat: Record<string, ProfileDefinition> = {};
  for (const [toolKey, toolProfiles] of Object.entries(profiles)) {
    const value = toolProfiles as unknown;
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      'name' in value
    ) {
      // Already flat: { "claude-code:default": { tool: "claude-code", name: "default", ... } }
      flat[toolKey] = {
        ...(value as ProfileDefinition),
        capabilities: (value as ProfileDefinition).capabilities ?? DEFAULT_PROFILE_CAPABILITIES,
      };
    } else {
      // Nested: { "claude-code": { "default": { tool: "claude-code", name: "default", ... } } }
      const nested = value as Record<string, unknown>;
      for (const [profileKey, profile] of Object.entries(nested)) {
        const flatKey = `${toolKey}:${profileKey}`;
        const def = profile as unknown as ProfileDefinition;
        flat[flatKey] = {
          ...def,
          capabilities: def.capabilities ?? DEFAULT_PROFILE_CAPABILITIES,
        };
      }
    }
  }
  return flat;
}

export function loadBuiltins(): EffectiveRegistry {
  const models = readTomlFile<ModelDefinition>(BUILTIN_FILES.models);
  const tools = readTomlFile<ToolDefinition>(BUILTIN_FILES.tools);
  const profiles = normalizeProfiles(
    readTomlFile<ProfileDefinition>(BUILTIN_FILES.profiles),
  );
  const providers = readTomlFile<ProviderDefinition>(BUILTIN_FILES.providers);

  return {
    tools,
    profiles,
    models,
    providers,
    transports: {},
  };
}
