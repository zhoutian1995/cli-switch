import { accessSync, constants, existsSync } from 'node:fs';
import path from 'node:path';
import { createRegistryService } from '../../registry/index.js';
import { readEnv } from '../../platform/env.js';
import type { CliAdapter, PlatformService } from '../../adapters/types.js';
import type {
  CapabilityFlags,
  Diagnostic,
  EffectiveRegistry,
  NormalizedResolveRequest,
  ResolveRequest,
  ResolveResult,
} from '../../types/index.js';
import { resolvePaths } from '../../platform/index.js';
import { normalize } from './request-normalizer.js';
import { selectProfile } from './profile-selector.js';
import { resolveModel } from './model-resolver.js';
import { buildRuntimeSpec } from './runtime-builder.js';

export interface ResolverService {
  resolve(request: ResolveRequest): ResolveResult;
}

type ResolverError = Error & { code?: string; details?: Record<string, unknown> };

function createDiagnosticFromError(error: unknown): Diagnostic {
  const resolved = error as ResolverError;
  return {
    level: 'error',
    code: resolved.code ?? 'RESOLVE_FAILED',
    message: resolved.message || 'Resolver failed.',
    details: resolved.details,
  };
}

function mergeCapabilities(base: CapabilityFlags, patch?: Partial<CapabilityFlags>): CapabilityFlags {
  return patch ? { ...base, ...patch } : { ...base };
}

function collectPatch(
  patch: { warnings?: string[]; diagnostics?: Diagnostic[]; capabilities?: Partial<CapabilityFlags> },
  warnings: string[],
  diagnostics: Diagnostic[],
  capabilities: CapabilityFlags,
): CapabilityFlags {
  if (patch.warnings?.length) {
    warnings.push(...patch.warnings);
  }
  if (patch.diagnostics?.length) {
    diagnostics.push(...patch.diagnostics);
  }
  return mergeCapabilities(capabilities, patch.capabilities);
}

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

function createPlatformService(): PlatformService {
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

function normalizeFailureRequest(request: ResolveRequest, registry: EffectiveRegistry): NormalizedResolveRequest {
  const tool = registry.tools[request.tool];
  return {
    tool: request.tool,
    profile: request.profile ?? tool?.defaultProfile ?? 'unknown',
    model: request.model,
    provider: request.provider,
    vendor: request.vendor,
    transport: request.transport,
    capabilities: request.capabilities ?? [],
    ...(request.cwd ? { cwd: request.cwd } : {}),
  };
}

export function createResolverService(
  registry: EffectiveRegistry,
  adapters: Record<string, CliAdapter>,
): ResolverService {
  const registryService = createRegistryService(registry);
  const platform = createPlatformService();

  return {
    resolve(request: ResolveRequest): ResolveResult {
      const warnings: string[] = [];
      const diagnostics: Diagnostic[] = [];
      let normalizedRequest: NormalizedResolveRequest = normalizeFailureRequest(request, registry);

      try {
        normalizedRequest = normalize(request, registry);

        const tool = registryService.getTool(normalizedRequest.tool);
        if (!tool) {
          throw Object.assign(new Error(`Tool not found: ${normalizedRequest.tool}`), {
            code: 'TOOL_NOT_FOUND',
            details: { tool: normalizedRequest.tool },
          });
        }

        const profile = selectProfile(normalizedRequest.tool, normalizedRequest.profile, registry);
        const { model, warnings: modelWarnings } = resolveModel(normalizedRequest, profile, registry);
        warnings.push(...modelWarnings);

        const adapter = adapters[tool.adapter];
        if (!adapter) {
          throw Object.assign(new Error(`Adapter not found: ${tool.adapter}`), {
            code: 'ADAPTER_NOT_FOUND',
            details: { adapter: tool.adapter, tool: tool.id },
          });
        }

        const adapterModel = adapter.resolve_model({
          request: normalizedRequest,
          tool,
          profile,
          registry,
        });

        const finalModel = {
          ...model,
          ...adapterModel,
          input: adapterModel.input ?? model.input,
          provider: normalizedRequest.provider ?? adapterModel.provider ?? model.provider,
          transport: normalizedRequest.transport ?? adapterModel.transport ?? model.transport,
          capabilities: adapterModel.capabilities.length > 0 ? adapterModel.capabilities : model.capabilities,
        };

        const auth = adapter.resolve_auth({
          tool,
          profile,
          registry,
          platform,
        });

        const command = adapter.build_command({
          request: normalizedRequest,
          tool,
          profile,
          model: finalModel,
          auth,
          registry,
        });

        let capabilities = { ...profile.capabilities };
        capabilities = collectPatch(adapter.apply_skills({ profile, registry }), warnings, diagnostics, capabilities);
        capabilities = collectPatch(adapter.apply_mcp({ profile, registry }), warnings, diagnostics, capabilities);
        capabilities = collectPatch(adapter.apply_tool_policy({ profile, registry }), warnings, diagnostics, capabilities);

        const runtime = buildRuntimeSpec({
          request: normalizedRequest,
          tool,
          profile,
          registry,
          adapterName: adapter.id(),
          model: finalModel,
          auth,
          command,
          capabilities,
        });

        return {
          ok: true,
          request: normalizedRequest,
          runtime,
          warnings,
          diagnostics,
        };
      } catch (error) {
        diagnostics.push(createDiagnosticFromError(error));

        return {
          ok: false,
          request: normalizedRequest,
          warnings,
          diagnostics,
        };
      }
    },
  };
}
