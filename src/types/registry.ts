import type {
  AuthMode,
  ModelAlias,
  ProfileName,
  ProviderId,
  SupportedPlatform,
  ToolId,
  TransportId,
  VendorId,
} from './common.js';

/** Model metadata stored in the registry. */
export interface ModelDefinition {
  /** User-facing alias, for example sonnet. */
  alias: ModelAlias;
  /** Canonical model name resolved for execution. */
  resolvedName: string;
  /** Model family name. */
  family: string;
  /** Default vendor serving this model. */
  vendor: VendorId;
  /** Optional default provider for this model. */
  provider?: ProviderId;
  /** Optional transports supported by this model. */
  transports?: TransportId[];
  /** Declared capability names supported by the model. */
  capabilities: string[];
  /** Whether the model is deprecated. */
  deprecated?: boolean;
  /** Free-form metadata for future extension. */
  metadata?: Record<string, unknown>;
}

/** Provider metadata stored in the registry. */
export interface ProviderDefinition {
  /** Unique provider identifier. */
  id: ProviderId;
  /** Vendor that owns this provider. */
  vendor: VendorId;
  /** Transports supported by this provider. */
  transports: TransportId[];
  /** Authentication modes accepted by this provider. */
  authModes: AuthMode[];
  /** Tools that can use this provider. */
  supportedTools: ToolId[];
  /** Free-form metadata for future extension. */
  metadata?: Record<string, unknown>;
}

/** Transport metadata stored in the registry. */
export interface TransportDefinition {
  /** Unique transport identifier. */
  id: TransportId;
  /** Human-readable transport description. */
  description: string;
  /** Authentication modes accepted by this transport. */
  authModes: AuthMode[];
  /** Environment variable keys required or commonly used by this transport. */
  envKeys?: string[];
  /** Free-form metadata for future extension. */
  metadata?: Record<string, unknown>;
}

/** Capability switches declared by a profile. */
export interface CapabilityFlags {
  /** Whether MCP support is enabled. */
  mcp: boolean;
  /** Whether skills support is enabled. */
  skills: boolean;
  /** Whether tool policy support is enabled. */
  toolPolicy: boolean;
  /** Whether structured output is enabled. */
  structuredOutput: boolean;
  /** Whether image input is supported. */
  imageInput?: boolean;
  /** Whether streaming is supported. */
  streaming?: boolean;
  /** Whether the tool can run non-interactively. */
  nonInteractive?: boolean;
}

/** Constraints limiting when a profile may be used. */
export interface ProfileConstraints {
  /** Platforms supported by this profile. */
  supportedPlatforms?: SupportedPlatform[];
  /** Whether the target binary must be installed. */
  requiresBinary?: boolean;
  /** Environment variables required by this profile. */
  requiresEnv?: string[];
  /** Capability names that must not be requested together with this profile. */
  disallowCapabilities?: string[];
}

/** Profile metadata stored in the registry. */
export interface ProfileDefinition {
  /** Tool this profile belongs to. */
  tool: ToolId;
  /** Profile name within the tool namespace. */
  name: ProfileName;
  /** Human-readable profile description. */
  description: string;
  /** Optional default model alias or name. */
  defaultModel?: string;
  /** Optional default vendor. */
  defaultVendor?: VendorId;
  /** Optional default provider. */
  defaultProvider?: ProviderId;
  /** Optional default transport. */
  defaultTransport?: TransportId;
  /** Authentication mode required by this profile. */
  authMode: AuthMode;
  /** Optional command template fragments for the adapter to expand. */
  commandTemplate?: string[];
  /** Capabilities that must be available when selecting this profile. */
  requiredCapabilities?: string[];
  /** Capability flags declared by the profile. */
  capabilities: CapabilityFlags;
  /** Optional profile constraints. */
  constraints?: ProfileConstraints;
  /** Free-form metadata for future extension. */
  metadata?: Record<string, unknown>;
}

/** Tool metadata stored in the registry. */
export interface ToolDefinition {
  /** Unique tool identifier. */
  id: ToolId;
  /** Human-readable tool name. */
  displayName: string;
  /** Adapter name used to handle this tool. */
  adapter: string;
  /** Primary command used to launch the tool. */
  command: string;
  /** Default profile name for this tool. */
  defaultProfile: ProfileName;
  /** Binary names used when locating the executable. */
  binaryNames: string[];
  /** Platforms supported by this tool. */
  supportedPlatforms: SupportedPlatform[];
  /** Free-form metadata for future extension. */
  metadata?: Record<string, unknown>;
}

/** Fully merged registry used by runtime resolution. */
export interface EffectiveRegistry {
  /** Tool definitions keyed by tool id. */
  tools: Record<ToolId, ToolDefinition>;
  /** Profile definitions keyed by tool:profile. */
  profiles: Record<string, ProfileDefinition>;
  /** Model definitions keyed by model alias. */
  models: Record<string, ModelDefinition>;
  /** Provider definitions keyed by provider id. */
  providers: Record<ProviderId, ProviderDefinition>;
  /** Transport definitions keyed by transport id. */
  transports: Record<TransportId, TransportDefinition>;
}
