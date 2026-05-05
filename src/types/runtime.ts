import type { AuthResult } from './auth.js';
import type {
  ProfileName,
  ProviderId,
  SupportedPlatform,
  ToolId,
  TransportId,
  VendorId,
} from './common.js';
import type { Diagnostic } from './diagnostics.js';
import type {
  CapabilityFlags,
  EffectiveRegistry,
  ProfileDefinition,
  ToolDefinition,
} from './registry.js';

/** Resolved platform information supplied to adapters. */
export interface PlatformContext {
  /** Current operating system platform. */
  platform: SupportedPlatform;
  /** Resolved standard paths for cli-switch data. */
  paths: {
    /** Directory containing user configuration files. */
    configDir: string;
    /** Directory containing persistent application data. */
    dataDir: string;
    /** Directory containing cache data. */
    cacheDir: string;
  };
}

/** Context object passed to an adapter. */
export interface AdapterContext {
  /** Tool currently being resolved. */
  tool: ToolDefinition;
  /** Profile currently being resolved. */
  profile: ProfileDefinition;
  /** Effective registry used for lookup. */
  registry: EffectiveRegistry;
  /** Platform context for path and OS decisions. */
  platform: PlatformContext;
}

/** Raw resolver input from CLI arguments or callers. */
export interface ResolveRequest {
  /** Requested tool id. */
  tool: ToolId;
  /** Optional requested profile name. */
  profile?: ProfileName;
  /** Optional requested model alias or name. */
  model?: string;
  /** Optional requested provider id. */
  provider?: ProviderId;
  /** Optional requested vendor id. */
  vendor?: VendorId;
  /** Optional requested transport id. */
  transport?: TransportId;
  /** Optional requested capability names. */
  capabilities?: string[];
  /** Optional working directory for the final command. */
  cwd?: string;
}

/** Normalized resolver input after defaults are applied. */
export interface NormalizedResolveRequest {
  /** Requested tool id. */
  tool: ToolId;
  /** Selected profile name. */
  profile: ProfileName;
  /** Optional requested model alias or name. */
  model?: string;
  /** Optional requested provider id. */
  provider?: ProviderId;
  /** Optional requested vendor id. */
  vendor?: VendorId;
  /** Optional requested transport id. */
  transport?: TransportId;
  /** Requested capability names after normalization. */
  capabilities: string[];
  /** Optional working directory for the final command. */
  cwd?: string;
}

/** Final resolver output. */
export interface ResolveResult {
  /** Whether resolution completed successfully. */
  ok: boolean;
  /** Normalized request used to build the runtime spec. */
  request: NormalizedResolveRequest;
  /** Runtime specification ready for rendering. */
  runtime?: RuntimeSpec;
  /** Non-fatal warnings collected during resolution. */
  warnings: string[];
  /** Structured diagnostics collected during resolution. */
  diagnostics: Diagnostic[];
}

/** Runtime specification returned by resolve. */
export interface RuntimeSpec {
  /** Tool selected for execution. */
  tool: ToolId;
  /** Profile selected for execution. */
  profile: ProfileName;
  /** Adapter responsible for this runtime. */
  adapter: string;
  /** Resolved model information. */
  model: ResolvedModel;
  /** Resolved provider information. */
  provider: ResolvedProvider;
  /** Authentication evaluation result. */
  auth: AuthResult;
  /** Command specification to execute. */
  command: CommandSpec;
  /** Effective capability flags after adapter patches. */
  capabilities: CapabilityFlags;
}

/** Final model chosen for runtime execution. */
export interface ResolvedModel {
  /** Original model input from the caller, if provided. */
  input?: string;
  /** Canonical model name used for execution. */
  resolvedName: string;
  /** Model family name. */
  family: string;
  /** Final vendor for the resolved model. */
  vendor: VendorId;
  /** Final provider for the resolved model, if any. */
  provider?: ProviderId;
  /** Final transport for the resolved model, if any. */
  transport?: TransportId;
  /** Capability names supported by the resolved model. */
  capabilities: string[];
}

/** Final provider chosen for runtime execution. */
export interface ResolvedProvider {
  /** Provider identifier. */
  name: ProviderId;
  /** Vendor owning the provider. */
  vendor: VendorId;
  /** Transport chosen for the provider. */
  transport: TransportId;
}

/** Fully built command invocation. */
export interface CommandSpec {
  /** Executable program name or path. */
  program: string;
  /** Argument vector passed to the program. */
  args: string[];
  /** Environment variables injected into the command. */
  env: Record<string, string>;
  /** Working directory used when launching the command. */
  cwd?: string;
  /** Human-readable preview of the final command. */
  preview: string;
}
