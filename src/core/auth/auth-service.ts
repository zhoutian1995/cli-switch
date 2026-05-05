import { isSensitiveKey, maskValue, readEnv } from '../../platform/env.js';
import type { PlatformService } from '../../adapters/types.js';
import type {
  AuthMode,
  AuthResult,
  Diagnostic,
  ProfileDefinition,
  ToolDefinition,
} from '../../types/index.js';
import { inspectAuth } from './auth-inspector.js';

export interface AuthResultEnvelope {
  tool: ToolDefinition['id'];
  profile: ProfileDefinition['name'];
  auth: AuthResult;
  warnings: string[];
  diagnostics: Diagnostic[];
}

export interface AuthService {
  getStatus(tool: ToolDefinition, profile: ProfileDefinition): AuthResultEnvelope;
}

function maskSensitiveDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (typeof value === 'string' && isSensitiveKey(key)) {
        return [key, maskValue(value)];
      }
      return [key, value];
    }),
  );
}

function createStatusDiagnostic(auth: AuthResult): Diagnostic {
  switch (auth.status) {
    case 'ready':
      return {
        level: 'info',
        code: 'AUTH_READY',
        message: auth.hint,
        details: { mode: auth.mode, detected: auth.detected },
      };
    case 'missing':
      return {
        level: 'warn',
        code: 'AUTH_MISSING',
        message: auth.hint,
        hint: '补齐缺失凭据后再执行命令。',
        details: { required: auth.required, detected: auth.detected },
      };
    case 'expired':
      return {
        level: 'warn',
        code: 'AUTH_EXPIRED',
        message: auth.hint,
        hint: '请刷新或重新登录凭据。',
        details: {
          expiresAt: auth.expiresAt ?? null,
          ...(auth.details ?? {}),
        },
      };
    case 'conflict':
      return {
        level: 'warn',
        code: 'AUTH_CONFLICT',
        message: auth.hint,
        hint: '移除冲突凭据，仅保留一个有效来源。',
        details: auth.details,
      };
    case 'unsupported':
      return {
        level: 'warn',
        code: 'AUTH_UNSUPPORTED',
        message: auth.hint,
        hint: '请切换到支持的 profile 或认证模式。',
      };
    case 'unknown':
    default:
      return {
        level: 'warn',
        code: 'AUTH_UNKNOWN',
        message: auth.hint,
        hint: '请检查 profile 配置与本地环境。',
      };
  }
}

function createModeWarning(mode: AuthMode, tool: ToolDefinition, profile: ProfileDefinition): string | null {
  switch (mode) {
    case 'login':
      return null;
    case 'api_key':
      return null;
    case 'oauth':
      return `${tool.displayName}/${profile.name} 目前只提供 OAuth 占位检查。`;
    case 'none':
      return null;
    default:
      return `${tool.displayName}/${profile.name} 使用了未识别的认证模式。`;
  }
}

function enrichAuth(auth: AuthResult, profile: ProfileDefinition): AuthResult {
  const required = auth.required.length > 0 ? auth.required : profile.constraints?.requiresEnv ?? [];
  const detected = auth.detected.filter((name, index, list) => list.indexOf(name) === index);

  const details = maskSensitiveDetails(auth.details);
  const normalizedHint = auth.hint.trim() || '请检查认证配置。';

  return {
    ...auth,
    required,
    detected,
    source: auth.source ?? (detected.length > 0 ? 'env' : null),
    hint: normalizedHint,
    details,
  };
}

export function createAuthService(platform: PlatformService): AuthService {
  return {
    getStatus(tool: ToolDefinition, profile: ProfileDefinition): AuthResultEnvelope {
      const auth = enrichAuth(inspectAuth(tool, profile, platform), profile);
      const warnings: string[] = [];
      const diagnostics: Diagnostic[] = [];

      const modeWarning = createModeWarning(auth.mode, tool, profile);
      if (modeWarning) {
        warnings.push(modeWarning);
      }

      if (auth.mode === 'api_key') {
        const detectedValues = auth.detected
          .map((name) => {
            const value = platform.readEnv(name) ?? readEnv(name);
            if (!value) {
              return null;
            }
            return {
              name,
              value: isSensitiveKey(name) ? maskValue(value) : value,
            };
          })
          .filter((item): item is { name: string; value: string } => item !== null);

        if (detectedValues.length > 0) {
          diagnostics.push({
            level: 'info',
            code: 'AUTH_ENV_DETECTED',
            message: `已检测到 ${detectedValues.map((item) => item.name).join(', ')}。`,
            details: { detectedValues },
          });
        }
      }

      diagnostics.push(createStatusDiagnostic(auth));

      return {
        tool: tool.id,
        profile: profile.name,
        auth,
        warnings,
        diagnostics,
      };
    },
  };
}
