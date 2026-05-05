import type { AuthResult } from '../types/auth.js';
import type { Diagnostic } from '../types/diagnostics.js';
import type { EffectiveRegistry, ProfileDefinition, ToolDefinition, CapabilityFlags } from '../types/registry.js';
import type {
  CommandSpec,
  NormalizedResolveRequest,
  PlatformContext,
  ResolvedModel,
} from '../types/runtime.js';
import type { CheckStatus } from '../types/common.js';

export interface PlatformService {
  getPlatform(): 'darwin' | 'linux';
  resolvePaths(): {
    configDir: string;
    dataDir: string;
    cacheDir: string;
  };
  findExecutable(names: string[]): string | null;
  readEnv(name: string): string | undefined;
  fileExists(path: string): boolean;
  canRead(path: string): boolean;
}

export interface AdapterContext {
  tool: ToolDefinition;
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
  platform: PlatformContext;
}

export interface ResolveModelInput {
  request: NormalizedResolveRequest;
  tool: ToolDefinition;
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
}

export interface ResolveAuthInput {
  tool: ToolDefinition;
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
  platform: PlatformService;
}

export interface BuildCommandInput {
  request: NormalizedResolveRequest;
  tool: ToolDefinition;
  profile: ProfileDefinition;
  model: ResolvedModel;
  auth: AuthResult;
  registry: EffectiveRegistry;
}

export interface ApplySkillsInput {
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
}

export interface ApplyMcpInput {
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
}

export interface ApplyToolPolicyInput {
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
}

export interface AdapterDoctorInput {
  tool: ToolDefinition;
  profile: ProfileDefinition;
  registry: EffectiveRegistry;
  platform: PlatformService;
}

export interface CapabilityPatch {
  warnings?: string[];
  diagnostics?: Diagnostic[];
  capabilities?: Partial<CapabilityFlags>;
}

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface CliAdapter {
  /** adapter 唯一标识 */
  id(): string;

  /** 解析模型别名为标准模型定义 */
  resolve_model(input: ResolveModelInput): ResolvedModel;

  /** 检查认证状态 */
  resolve_auth(input: ResolveAuthInput): AuthResult;

  /** 构建启动命令 */
  build_command(input: BuildCommandInput): CommandSpec;

  /** 应用 skills 能力补丁 */
  apply_skills(input: ApplySkillsInput): CapabilityPatch;

  /** 应用 MCP 能力补丁 */
  apply_mcp(input: ApplyMcpInput): CapabilityPatch;

  /** 应用 tool policy 能力补丁 */
  apply_tool_policy(input: ApplyToolPolicyInput): CapabilityPatch;

  /** 工具特定 doctor 检查 */
  doctor(input: AdapterDoctorInput): DoctorCheck[];
}
