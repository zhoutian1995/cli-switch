import { createRegistryService } from '../../registry/index.js';
import type {
  EffectiveRegistry,
  ProfileDefinition,
  ProfileName,
  ToolId,
} from '../../types/index.js';
import { createResolverError } from './utils.js';

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
