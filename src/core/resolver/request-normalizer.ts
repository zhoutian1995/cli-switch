import { createRegistryService } from '../../registry/index.js';
import type {
  EffectiveRegistry,
  NormalizedResolveRequest,
  ResolveRequest,
} from '../../types/index.js';

function createResolverError(code: string, message: string, details?: Record<string, unknown>): Error & { code: string; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & { code: string; details?: Record<string, unknown> };
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

export function normalize(
  request: ResolveRequest,
  registry: EffectiveRegistry,
): NormalizedResolveRequest {
  const registryService = createRegistryService(registry);
  const tool = registryService.getTool(request.tool);

  if (!tool) {
    throw createResolverError('TOOL_NOT_FOUND', `Tool not found: ${request.tool}`, {
      tool: request.tool,
    });
  }

  const normalized: NormalizedResolveRequest = {
    tool: request.tool,
    profile: request.profile ?? tool.defaultProfile,
    model: request.model,
    provider: request.provider,
    vendor: request.vendor,
    transport: request.transport,
    capabilities: request.capabilities ?? [],
  };

  if (request.cwd) {
    normalized.cwd = request.cwd;
  }

  return normalized;
}
