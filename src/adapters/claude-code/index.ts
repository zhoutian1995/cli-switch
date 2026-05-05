import type { AuthResult } from '../../types/auth.js';
import type { Diagnostic } from '../../types/diagnostics.js';
import type {
  CapabilityFlags,
  EffectiveRegistry,
  ProfileDefinition,
  ToolDefinition,
} from '../../types/registry.js';
import type {
  CommandSpec,
  NormalizedResolveRequest,
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
  'sonnet': {
    resolvedName: 'claude-3-7-sonnet',
    vendor: 'anthropic',
    family: 'claude',
    capabilities: ['code', 'chat', 'function_calling'],
  },
  'glm-5.1': {
    resolvedName: 'glm-5.1',
    vendor: 'zhipu',
    family: 'glm',
    capabilities: ['code', 'chat'],
  },
  'glm-5': {
    resolvedName: 'glm-5',
    vendor: 'zhipu',
    family: 'glm',
    capabilities: ['code', 'chat'],
  },
};

function checkAuth(input: ResolveAuthInput): AuthResult {
  const mode = input.profile.authMode;

  if (mode === 'login') {
    return {
      mode: 'login',
      status: 'ready',
      required: ['claude_login_session'],
      detected: ['claude_login_session'],
      source: 'native',
      hint: 'Claude Code login session detected.',
    };
  }

  if (mode === 'api_key') {
    const apiKey = input.platform.readEnv('ANTHROPIC_API_KEY');
    if (apiKey) {
      return {
        mode: 'api_key',
        status: 'ready',
        required: ['ANTHROPIC_API_KEY'],
        detected: ['ANTHROPIC_API_KEY'],
        source: 'env',
        hint: 'ANTHROPIC_API_KEY is set.',
      };
    }
    return {
      mode: 'api_key',
      status: 'missing',
      required: ['ANTHROPIC_API_KEY'],
      detected: [],
      source: null,
      hint: 'Set ANTHROPIC_API_KEY environment variable.',
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

export const claudeCodeAdapter: CliAdapter = {
  id(): string {
    return 'claude-code';
  },

  resolve_model(input: ResolveModelInput): ResolvedModel {
    const modelName = input.request.model ?? input.profile.defaultModel ?? 'sonnet';
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
    const program = 'claude';
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
    return {
      capabilities: {
        mcp: true,
        skills: false,
      },
    };
  },

  apply_mcp(_input: ApplyMcpInput): CapabilityPatch {
    return {
      capabilities: {
        mcp: true,
      },
    };
  },

  apply_tool_policy(_input: ApplyToolPolicyInput): CapabilityPatch {
    return {
      capabilities: {
        toolPolicy: true,
      },
    };
  },

  doctor(input: AdapterDoctorInput): DoctorCheck[] {
    const checks: DoctorCheck[] = [];

    // Check binary
    const binaryPath = input.platform.findExecutable(input.tool.binaryNames);
    checks.push({
      name: 'binary',
      status: binaryPath ? 'pass' : 'fail',
      message: binaryPath
        ? `Found at ${binaryPath}`
        : `Binary not found. Searched: ${input.tool.binaryNames.join(', ')}`,
      ...(binaryPath ? { details: { path: binaryPath } } : {}),
    });

    // Check auth
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
