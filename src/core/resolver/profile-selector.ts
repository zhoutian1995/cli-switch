import { createRegistryService } from '../../registry/index.js';
import type {
  EffectiveRegistry,
  ProfileDefinition,
  ProfileName,
  ToolId,
} from '../../types/index.js';

function createResolverError(code: string, message: string, details?: Record<string, unknown>): Error & { code: string; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & { code: string; details?: Record<string, unknown> };
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

export function selectProfile(
  tool: ToolId,
  profileName: ProfileName,
  registry: EffectiveRegistry,
): ProfileDefinition {
  const registryService = createRegistryService(registry);
  const profileKey = `${tool}:${profileName}`;
  const profile = registryService.getProfile(profileKey);

  if (!profile) {
    throw createResolverError('PROFILE_NOT_FOUND', `Profile not found: ${profileKey}`, {
      tool,
      profile: profileName,
      profileKey,
    });
  }

  return profile;
}
