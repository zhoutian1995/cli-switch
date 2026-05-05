import { accessSync, constants, existsSync } from 'node:fs';
import path from 'node:path';

import {
  claudeCodeAdapter,
  codexAdapter,
  geminiAdapter,
  type CliAdapter,
  type PlatformService,
} from '../src/adapters/index.js';
import { createAuthService } from '../src/core/auth/index.js';
import { createDoctorService, type DoctorResult as CoreDoctorResult } from '../src/core/doctor/index.js';
import { createResolverService, type ResolverService } from '../src/core/resolver/index.js';
import { readEnv, resolvePaths } from '../src/platform/index.js';
import { createRegistryService, loadBuiltins, loadUserOverrides, mergeRegistry, type RegistryService } from '../src/registry/index.js';
import { renderJson } from '../src/renderers/index.js';
import type {
  Diagnostic,
  EffectiveRegistry,
  ProfileDefinition,
  ToolDefinition,
} from '../src/types/index.js';

export const SCHEMA_VERSION = 'v1alpha1';

export const EXIT_CODES = {
  success: 0,
  input: 2,
  environment: 3,
  resolve: 4,
} as const;

export interface JsonEnvelope<T> {
  schema_version: typeof SCHEMA_VERSION;
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    hint?: string;
    details?: Record<string, unknown>;
  };
  warnings: string[];
  diagnostics: Diagnostic[];
}

export interface CommandContext {
  registry: EffectiveRegistry;
  registryService: RegistryService;
  adapters: Record<string, CliAdapter>;
  platform: PlatformService;
  resolver: ResolverService;
  authService: ReturnType<typeof createAuthService>;
  doctorService: ReturnType<typeof createDoctorService>;
}

type StructuredError = Error & {
  code?: string;
  hint?: string;
  details?: Record<string, unknown>;
};

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findExecutableSync(names: string[]): string | null {
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return null;
  }

  for (const name of names) {
    if (!name) {
      continue;
    }

    if (path.isAbsolute(name) || name.includes(path.sep)) {
      if (isExecutable(name)) {
        return name;
      }
      continue;
    }

    for (const directory of pathValue.split(path.delimiter)) {
      if (!directory) {
        continue;
      }

      const candidate = path.join(directory, name);
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function createPlatformService(): PlatformService {
  return {
    getPlatform() {
      return process.platform === 'darwin' ? 'darwin' : 'linux';
    },
    resolvePaths() {
      return resolvePaths();
    },
    findExecutable(names: string[]) {
      return findExecutableSync(names);
    },
    readEnv(name: string) {
      return readEnv(name);
    },
    fileExists(filePath: string) {
      return existsSync(filePath);
    },
    canRead(filePath: string) {
      try {
        accessSync(filePath, constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function createCommandContext(): CommandContext {
  const builtins = loadBuiltins();
  const platform = createPlatformService();
  const overrides = loadUserOverrides(platform.resolvePaths().configDir);
  const registry = mergeRegistry(builtins, overrides);
  const registryService = createRegistryService(registry);
  const adapters = {
    [claudeCodeAdapter.id()]: claudeCodeAdapter,
    [codexAdapter.id()]: codexAdapter,
    [geminiAdapter.id()]: geminiAdapter,
  } satisfies Record<string, CliAdapter>;

  return {
    registry,
    registryService,
    adapters,
    platform,
    resolver: createResolverService(registry, adapters),
    authService: createAuthService(platform),
    doctorService: createDoctorService(platform, registry, adapters),
  };
}

export function findToolOrThrow(registryService: RegistryService, toolId: string): ToolDefinition {
  const tool = registryService.getTool(toolId);
  if (!tool) {
    throw createError('TOOL_NOT_SUPPORTED', `Tool not supported: ${toolId}`, '请使用 list 命令查看支持的 tool。', {
      tool: toolId,
    });
  }
  return tool;
}

export function findProfileOrThrow(
  registryService: RegistryService,
  tool: ToolDefinition,
  profileName?: string,
): ProfileDefinition {
  const resolvedProfile = profileName ?? tool.defaultProfile;
  const profile = registryService.getProfile(`${tool.id}:${resolvedProfile}`);
  if (!profile) {
    throw createError(
      'PROFILE_NOT_FOUND',
      `Profile not found: ${tool.id}:${resolvedProfile}`,
      '请使用 list profiles 检查可用 profile。',
      { tool: tool.id, profile: resolvedProfile },
    );
  }
  return profile;
}

export function createJsonEnvelope<T>(payload: Omit<JsonEnvelope<T>, 'schema_version'>): JsonEnvelope<T> {
  return {
    ...payload,
    schema_version: SCHEMA_VERSION,
    warnings: payload.warnings ?? [],
    diagnostics: payload.diagnostics ?? [],
  };
}

export { renderJson };

export function printJson<T>(payload: Omit<JsonEnvelope<T>, 'schema_version'>): void {
  console.log(renderJson(createJsonEnvelope(payload)));
}

export function createError(
  code: string,
  message: string,
  hint?: string,
  details?: Record<string, unknown>,
): StructuredError {
  return Object.assign(new Error(message), {
    code,
    hint,
    details,
  });
}

export function toErrorEnvelope(error: unknown, diagnostics: Diagnostic[] = []): JsonEnvelope<never> {
  const resolved = error as StructuredError;
  return createJsonEnvelope({
    ok: false,
    error: {
      code: resolved.code ?? 'UNKNOWN_ERROR',
      message: resolved.message || 'Unknown error',
      ...(resolved.hint ? { hint: resolved.hint } : {}),
      ...(resolved.details ? { details: resolved.details } : {}),
    },
    warnings: [],
    diagnostics,
  });
}

export function printTextError(error: unknown): void {
  const resolved = error as StructuredError;
  const lines = [resolved.message || 'Unknown error'];
  if (resolved.code) {
    lines.push(`code: ${resolved.code}`);
  }
  if (resolved.hint) {
    lines.push(`hint: ${resolved.hint}`);
  }
  console.error(lines.join('\n'));
}

export interface CommandDoctorResult extends CoreDoctorResult {
  tool: string;
  profile: string;
}
