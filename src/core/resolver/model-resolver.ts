import { createRegistryService } from '../../registry/index.js';
import type {
  EffectiveRegistry,
  ModelDefinition,
  NormalizedResolveRequest,
  ProfileDefinition,
  ResolvedModel,
} from '../../types/index.js';

function createResolverError(code: string, message: string, details?: Record<string, unknown>): Error & { code: string; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & { code: string; details?: Record<string, unknown> };
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

function toResolvedModel(alias: string, definition: ModelDefinition): ResolvedModel {
  return {
    input: alias,
    resolvedName: definition.resolvedName,
    family: definition.family,
    vendor: definition.vendor,
    provider: definition.provider,
    transport: definition.transports?.[0],
    capabilities: definition.capabilities,
  };
}

export function resolveModel(
  request: NormalizedResolveRequest,
  profile: ProfileDefinition,
  registry: EffectiveRegistry,
): { model: ResolvedModel; warnings: string[] } {
  const requestedModel = request.model ?? profile.defaultModel;

  if (!requestedModel) {
    throw createResolverError('MODEL_NOT_FOUND', 'No model was provided and the profile has no default model.', {
      tool: request.tool,
      profile: profile.name,
    });
  }

  const registryService = createRegistryService(registry);
  const definition = registryService.getModel(requestedModel);

  if (!definition) {
    throw createResolverError('MODEL_NOT_FOUND', `Model not found: ${requestedModel}`, {
      tool: request.tool,
      profile: profile.name,
      model: requestedModel,
    });
  }

  return {
    model: toResolvedModel(requestedModel, definition),
    warnings: definition.deprecated
      ? [`Model alias "${requestedModel}" is deprecated.`]
      : [],
  };
}
