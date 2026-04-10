import type {
  AuthResult,
  CapabilityFlags,
  CommandSpec,
  EffectiveRegistry,
  NormalizedResolveRequest,
  ProfileDefinition,
  ResolvedModel,
  ResolvedProvider,
  RuntimeSpec,
  ToolDefinition,
} from '../../types/index.js';

export interface BuildInput {
  request: NormalizedResolveRequest;
  tool: ToolDefinition;
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
  adapterName: string;
  model: ResolvedModel;
  auth: AuthResult;
  command: CommandSpec;
  capabilities: CapabilityFlags;
}

function buildProvider(input: BuildInput): ResolvedProvider {
  const providerName = input.request.provider ?? input.profile.defaultProvider ?? input.model.provider ?? input.model.vendor;
  const providerDefinition = input.registry.providers[providerName];
  const transport = input.request.transport
    ?? input.model.transport
    ?? input.profile.defaultTransport
    ?? providerDefinition?.transports[0]
    ?? 'unknown';

  return {
    name: providerName,
    vendor: providerDefinition?.vendor ?? input.request.vendor ?? input.profile.defaultVendor ?? input.model.vendor,
    transport,
  };
}

export function buildRuntimeSpec(input: BuildInput): RuntimeSpec {
  return {
    tool: input.request.tool,
    profile: input.request.profile,
    adapter: input.adapterName,
    model: {
      ...input.model,
      provider: input.model.provider ?? input.request.provider ?? input.profile.defaultProvider,
      transport: input.model.transport ?? input.request.transport ?? input.profile.defaultTransport,
    },
    provider: buildProvider(input),
    auth: input.auth,
    command: input.command,
    capabilities: input.capabilities,
  };
}
