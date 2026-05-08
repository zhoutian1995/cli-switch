import type { CliAdapter, DoctorCheck, PlatformService } from '../../adapters/types.js';
import { inspectAuth } from '../auth/auth-inspector.js';
import { validateRuntimePreflight } from '../resolver/service.js';
import type { Diagnostic, EffectiveRegistry, ProfileDefinition, ToolDefinition } from '../../types/index.js';

export interface DoctorSummary {
  status: 'pass' | 'warn' | 'fail';
  checksTotal: number;
  checksPassed: number;
  checksWarn: number;
  checksFailed: number;
}

export interface DoctorResult {
  summary: DoctorSummary;
  checks: DoctorCheck[];
  warnings: string[];
  diagnostics: Diagnostic[];
}

export interface DoctorService {
  run(tool: ToolDefinition, profile: ProfileDefinition): DoctorResult;
}

function createDiagnostic(
  level: Diagnostic['level'],
  code: string,
  message: string,
  hint?: string,
  details?: Record<string, unknown>,
): Diagnostic {
  return {
    level,
    code,
    message,
    ...(hint ? { hint } : {}),
    ...(details ? { details } : {}),
  };
}

function summarizeChecks(checks: DoctorCheck[]): DoctorSummary {
  const checksPassed = checks.filter((check) => check.status === 'pass').length;
  const checksWarn = checks.filter((check) => check.status === 'warn').length;
  const checksFailed = checks.filter((check) => check.status === 'fail').length;

  let status: DoctorSummary['status'] = 'pass';
  if (checksFailed > 0) {
    status = 'fail';
  } else if (checksWarn > 0) {
    status = 'warn';
  }

  return {
    status,
    checksTotal: checks.length,
    checksPassed,
    checksWarn,
    checksFailed,
  };
}

type RuntimePreflightError = Error & { code?: string; details?: Record<string, unknown> };

function createRuntimePreflightCheck(tool: ToolDefinition, profile: ProfileDefinition, platform: PlatformService): {
  check: DoctorCheck;
  diagnostics: Diagnostic[];
} {
  try {
    validateRuntimePreflight({ tool: tool.id, profile: profile.name }, tool, profile, platform);

    return {
      check: {
        name: 'runtime_preflight',
        status: 'pass',
        message: 'Runtime platform and binary preflight passed.',
        details: {
          platform: platform.getPlatform(),
          binaryNames: tool.binaryNames,
        },
      },
      diagnostics: [
        createDiagnostic('info', 'DOCTOR_RUNTIME_PREFLIGHT_OK', `${tool.displayName} 运行环境前置检查通过。`, undefined, {
          tool: tool.id,
          profile: profile.name,
        }),
      ],
    };
  } catch (error) {
    const resolved = error as RuntimePreflightError;
    const code = resolved.code ?? 'RUNTIME_PREFLIGHT_FAILED';
    const message = resolved.message || `${tool.displayName} runtime preflight failed.`;

    return {
      check: {
        name: 'runtime_preflight',
        status: 'fail',
        message,
        details: resolved.details ?? {
          tool: tool.id,
          profile: profile.name,
          platform: platform.getPlatform(),
          binaryNames: tool.binaryNames,
        },
      },
      diagnostics: [
        createDiagnostic(
          'error',
          code,
          message,
          code === 'BINARY_NOT_FOUND'
            ? '请先安装对应 CLI，或确认 PATH 已包含目标可执行文件。'
            : '请切换到受支持的平台或调整 registry profile/tool 配置。',
          resolved.details,
        ),
      ],
    };
  }
}

function createProfileCheck(tool: ToolDefinition, profile: ProfileDefinition, registryProfiles: Record<string, ProfileDefinition>): {
  check: DoctorCheck;
  diagnostics: Diagnostic[];
} {
  const profileKey = `${tool.id}:${profile.name}`;
  const registeredProfile = registryProfiles[profileKey];

  if (registeredProfile) {
    return {
      check: {
        name: 'profile_exists',
        status: 'pass',
        message: `Profile ${profileKey} exists in registry.`,
        details: {
          profileKey,
        },
      },
      diagnostics: [
        createDiagnostic('info', 'DOCTOR_PROFILE_FOUND', `已找到 profile ${profileKey}。`, undefined, {
          profileKey,
        }),
      ],
    };
  }

  return {
    check: {
      name: 'profile_exists',
      status: 'fail',
      message: `Profile ${profileKey} does not exist in registry.`,
      details: {
        profileKey,
      },
    },
    diagnostics: [
      createDiagnostic(
        'error',
        'DOCTOR_PROFILE_MISSING',
        `Registry 中不存在 profile ${profileKey}。`,
        '请确认 profile 名称与 tool 绑定关系正确。',
        { profileKey },
      ),
    ],
  };
}

function createAuthCheck(tool: ToolDefinition, profile: ProfileDefinition, platform: PlatformService): {
  check: DoctorCheck;
  warnings: string[];
  diagnostics: Diagnostic[];
} {
  const auth = inspectAuth(tool, profile, platform);

  let status: DoctorCheck['status'];
  switch (auth.status) {
    case 'ready':
      status = 'pass';
      break;
    case 'missing':
      status = 'fail';
      break;
    default:
      status = 'warn';
      break;
  }

  const warnings: string[] = [];
  if (auth.mode === 'oauth') {
    warnings.push(`${tool.displayName}/${profile.name} 需要 OAuth，doctor 仅做非交互式占位检查。`);
  }
  if (auth.status === 'unsupported' || auth.status === 'unknown') {
    warnings.push(auth.hint);
  }

  const diagnosticLevel: Diagnostic['level'] =
    status === 'fail' ? 'error' : status === 'warn' ? 'warn' : 'info';

  return {
    check: {
      name: 'auth_ready',
      status,
      message: auth.hint,
      details: {
        authMode: auth.mode,
        authStatus: auth.status,
        required: auth.required,
        detected: auth.detected,
        source: auth.source,
        ...(auth.details ? { authDetails: auth.details } : {}),
      },
    },
    warnings,
    diagnostics: [
      createDiagnostic(
        diagnosticLevel,
        `DOCTOR_AUTH_${auth.status.toUpperCase()}`,
        auth.hint,
        status === 'fail' ? '补齐或修复认证配置后再执行命令。' : undefined,
        {
          tool: tool.id,
          profile: profile.name,
          mode: auth.mode,
          status: auth.status,
          required: auth.required,
          detected: auth.detected,
          ...(auth.details ? { authDetails: auth.details } : {}),
        },
      ),
    ],
  };
}

function createModelCheck(profile: ProfileDefinition, registryModels: Record<string, { resolvedName: string }>): {
  check: DoctorCheck;
  warnings: string[];
  diagnostics: Diagnostic[];
} {
  const modelAlias = profile.defaultModel;

  if (!modelAlias) {
    return {
      check: {
        name: 'model_valid',
        status: 'warn',
        message: 'Profile has no defaultModel configured.',
      },
      warnings: [`${profile.tool}:${profile.name} 未配置 defaultModel。`],
      diagnostics: [
        createDiagnostic(
          'warn',
          'DOCTOR_MODEL_UNSET',
          `Profile ${profile.tool}:${profile.name} 未配置 defaultModel。`,
          '建议为 profile 配置默认模型，以便 doctor 与 resolve 行为更稳定。',
          { profile: `${profile.tool}:${profile.name}` },
        ),
      ],
    };
  }

  const model = registryModels[modelAlias];
  if (model) {
    return {
      check: {
        name: 'model_valid',
        status: 'pass',
        message: `Model ${modelAlias} exists in registry.`,
        details: {
          alias: modelAlias,
          resolvedName: model.resolvedName,
        },
      },
      warnings: [],
      diagnostics: [
        createDiagnostic('info', 'DOCTOR_MODEL_FOUND', `已找到模型 ${modelAlias}。`, undefined, {
          alias: modelAlias,
          resolvedName: model.resolvedName,
        }),
      ],
    };
  }

  return {
    check: {
      name: 'model_valid',
      status: 'fail',
      message: `Model ${modelAlias} does not exist in registry.`,
      details: {
        alias: modelAlias,
      },
    },
    warnings: [],
    diagnostics: [
      createDiagnostic(
        'error',
        'DOCTOR_MODEL_MISSING',
        `Registry 中不存在模型 ${modelAlias}。`,
        '请修正 profile.defaultModel，或在 registry 中补充模型定义。',
        { alias: modelAlias },
      ),
    ],
  };
}

export function createDoctorService(
  platform: PlatformService,
  registry: EffectiveRegistry,
  adapters: Record<string, CliAdapter> = {},
): DoctorService {
  return {
    run(tool: ToolDefinition, profile: ProfileDefinition): DoctorResult {
      const warnings: string[] = [];
      const diagnostics: Diagnostic[] = [];

      const runtimePreflight = createRuntimePreflightCheck(tool, profile, platform);
      const profileCheck = createProfileCheck(tool, profile, registry.profiles);
      const auth = createAuthCheck(tool, profile, platform);
      const model = createModelCheck(profile, registry.models);

      const checks = [runtimePreflight.check, profileCheck.check, auth.check, model.check];

      diagnostics.push(...runtimePreflight.diagnostics, ...profileCheck.diagnostics, ...auth.diagnostics, ...model.diagnostics);
      warnings.push(...auth.warnings, ...model.warnings);

      const adapter = adapters[tool.adapter];
      if (adapter) {
        const adapterChecks = adapter.doctor({ tool, profile, registry, platform });
        checks.push(...adapterChecks);
      }

      return {
        summary: summarizeChecks(checks),
        checks,
        warnings,
        diagnostics,
      };
    },
  };
}
