import type { AuthResult } from '../../types/auth.js';
import type {
  EffectiveRegistry,
  ProfileDefinition,
  ToolDefinition,
} from '../../types/registry.js';
import type {
  CommandSpec,
  ResolvedModel,
} from '../../types/runtime.js';
import type {
  AdapterDoctorInput,
  ApplyMcpInput,
  ApplySkillsInput,
  ApplyToolPolicyInput,
  BuildCommandInput,
  CapabilityPatch,
  CliAdapter,
  DoctorCheck,
  PlatformService,
  ResolveAuthInput,
  ResolveModelInput,
} from '../types.js';

const MODEL_ALIASES: Record<string, { resolvedName: string; vendor: string; family: string; capabilities: string[] }> = {
  'gemini-3.1-pro': {
    resolvedName: 'gemini-3.1-pro-preview',
    vendor: 'google',
    family: 'gemini',
    capabilities: ['code', 'chat', 'function_calling', 'image_input'],
  },
};

function checkAuth(input: ResolveAuthInput): AuthResult {
  const mode = input.profile.authMode;

  if (mode === 'api_key') {
    const apiKey = input.platform.readEnv('GOOGLE_API_KEY');
    if (apiKey) {
      return {
        mode: 'api_key',
        status: 'ready',
        required: ['GOOGLE_API_KEY'],
        detected: ['GOOGLE_API_KEY'],
        source: 'env',
        hint: 'GOOGLE_API_KEY is set.',
      };
    }
    return {
      mode: 'api_key',
      status: 'missing',
      required: ['GOOGLE_API_KEY'],
      detected: [],
      source: null,
      hint: 'Set GOOGLE_API_KEY environment variable.',
    };
  }

  return {
    mode: mode,
    status: 'unknown',
    required: [],
    detected: [],
    source: null,
    hint: `Unsupported auth mode: ${mode}`,
  };
}

export const geminiAdapter: CliAdapter = {
  id(): string {
    return 'gemini';
  },

  resolve_model(input: ResolveModelInput): ResolvedModel {
    const modelName = input.request.model ?? input.profile.defaultModel ?? 'gemini-3.1-pro';
    const mapping = MODEL_ALIASES[modelName];

    if (mapping) {
      return {
        input: modelName,
        resolvedName: mapping.resolvedName,
        family: mapping.family,
        vendor: mapping.vendor,
        capabilities: mapping.capabilities,
      };
    }

    return {
      input: modelName,
      resolvedName: modelName,
      family: 'unknown',
      vendor: 'unknown',
      capabilities: [],
    };
  },

  resolve_auth(input: ResolveAuthInput): AuthResult {
    return checkAuth(input);
  },

  build_command(input: BuildCommandInput): CommandSpec {
    const program = 'gemini';
    const args = ['--model', input.model.resolvedName];
    const preview = `${program} --model ${input.model.resolvedName}`;

    return {
      program,
      args,
      env: {},
      preview,
    };
  },

  apply_skills(_input: ApplySkillsInput): CapabilityPatch {
    return {};
  },

  apply_mcp(_input: ApplyMcpInput): CapabilityPatch {
    return {};
  },

  apply_tool_policy(_input: ApplyToolPolicyInput): CapabilityPatch {
    return {};
  },

  doctor(input: AdapterDoctorInput): DoctorCheck[] {
    const checks: DoctorCheck[] = [];

    const binaryPath = input.platform.findExecutable(input.tool.binaryNames);
    checks.push({
      name: 'binary',
      status: binaryPath ? 'pass' : 'fail',
      message: binaryPath
        ? `Found at ${binaryPath}`
        : `Binary not found. Searched: ${input.tool.binaryNames.join(', ')}`,
      ...(binaryPath ? { details: { path: binaryPath } } : {}),
    });

    const authResult = checkAuth(input);
    const authStatus: 'pass' | 'warn' | 'fail' =
      authResult.status === 'ready' ? 'pass' : authResult.status === 'missing' ? 'fail' : 'warn';
    checks.push({
      name: 'auth',
      status: authStatus,
      message: authResult.hint,
    });

    return checks;
  },
};
