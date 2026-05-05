import type { PlatformService } from '../../adapters/types.js';
import { readEnv } from '../../platform/env.js';
import type { AuthResult, ProfileDefinition, ToolDefinition } from '../../types/index.js';

function createBaseResult(mode: ProfileDefinition['authMode']): AuthResult {
  return {
    mode,
    status: 'unknown',
    required: [],
    detected: [],
    source: null,
    expiresAt: null,
    hint: '认证状态未知，请检查当前 profile 配置。',
  };
}

function readCredential(platform: PlatformService, name: string): string | undefined {
  return platform.readEnv(name) ?? readEnv(name);
}

function getEnvState(platform: PlatformService, name: string): {
  exists: boolean;
  value: string | undefined;
} {
  const value = readCredential(platform, name);
  return {
    exists: value !== undefined,
    value,
  };
}

export function inspectAuth(
  tool: ToolDefinition,
  profile: ProfileDefinition,
  platform: PlatformService,
): AuthResult {
  const result = createBaseResult(profile.authMode);

  switch (profile.authMode) {
    case 'login':
      return {
        ...result,
        status: 'ready',
        source: 'native',
        hint: `${tool.displayName} 使用登录态认证，MVP 默认视为已就绪。`,
      };

    case 'api_key': {
      const required = profile.constraints?.requiresEnv ?? [];
      const envStates = required.map((name) => ({
        name,
        ...getEnvState(platform, name),
      }));
      const detected = envStates.filter((entry) => entry.exists && entry.value !== '').map((entry) => entry.name);
      const expired = envStates.filter((entry) => entry.exists && entry.value === '').map((entry) => entry.name);

      if (required.length === 0) {
        return {
          ...result,
          status: 'unknown',
          source: 'env',
          hint: `${tool.displayName}/${profile.name} 缺少 requiresEnv 配置，无法判断 API Key 状态。`,
        };
      }

      const anthropicApiKey = getEnvState(platform, 'ANTHROPIC_API_KEY');
      const anthropicAuthToken = getEnvState(platform, 'ANTHROPIC_AUTH_TOKEN');
      const hasAnthropicConflict =
        anthropicApiKey.exists &&
        anthropicAuthToken.exists &&
        anthropicApiKey.value !== anthropicAuthToken.value;

      if (hasAnthropicConflict) {
        const conflictingSources = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
        return {
          ...result,
          status: 'conflict',
          required,
          detected: [...new Set([...detected, ...conflictingSources])],
          source: 'env',
          hint: '检测到冲突的认证来源，请仅保留一个有效的 Anthropic 凭据。',
          details: { conflictingSources },
        };
      }

      if (expired.length > 0) {
        return {
          ...result,
          status: 'expired',
          required,
          detected,
          source: 'env',
          hint: 'API Key 已过期或无效，请重新配置',
          details: { expired },
        };
      }

      if (detected.length === required.length) {
        return {
          ...result,
          status: 'ready',
          required,
          detected,
          source: 'env',
          hint: `已检测到 ${detected.join(', ')}。`,
        };
      }

      const missing = required.filter((name) => !detected.includes(name) && !expired.includes(name));
      return {
        ...result,
        status: 'missing',
        required,
        detected,
        source: detected.length > 0 ? 'env' : null,
        hint: `请配置 ${missing.join(', ')}`,
        details: missing.length > 0 ? { missing } : undefined,
      };
    }

    case 'oauth':
      return {
        ...result,
        status: 'unsupported',
        hint: `${tool.displayName}/${profile.name} 需要 OAuth，MVP 暂不支持完整 OAuth 检查。`,
      };

    case 'none':
      return {
        ...result,
        status: 'ready',
        hint: `${tool.displayName}/${profile.name} 无需额外认证。`,
      };

    default:
      return {
        ...result,
        status: 'unknown',
        hint: `${tool.displayName}/${profile.name} 使用了未知认证模式。`,
      };
  }
}
