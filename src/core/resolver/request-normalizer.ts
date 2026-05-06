import { createRegistryService } from '../../registry/index.js';
import { createResolverError } from './utils.js';
import type {
  EffectiveRegistry,
  NormalizedResolveRequest,
  ResolveRequest,
} from '../../types/index.js';

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
