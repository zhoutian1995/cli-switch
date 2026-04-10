import os from 'node:os';
import path from 'node:path';

export interface PlatformPaths {
  configDir: string;
  dataDir: string;
  cacheDir: string;
}

const APP_NAME = 'cli-switch';

function resolveHomePath(...segments: string[]): string {
  return path.join(os.homedir(), ...segments);
}

function resolveXdgDir(envName: 'XDG_CONFIG_HOME' | 'XDG_DATA_HOME' | 'XDG_CACHE_HOME'): string {
  const value = process.env[envName]?.trim();

  if (value) {
    return path.join(value, APP_NAME);
  }

  switch (envName) {
    case 'XDG_CONFIG_HOME':
      return resolveHomePath('.config', APP_NAME);
    case 'XDG_DATA_HOME':
      return resolveHomePath('.local', 'share', APP_NAME);
    case 'XDG_CACHE_HOME':
      return resolveHomePath('.cache', APP_NAME);
  }
}

export function resolvePaths(configDir?: string): PlatformPaths {
  return {
    configDir: configDir ?? resolveXdgDir('XDG_CONFIG_HOME'),
    dataDir: resolveXdgDir('XDG_DATA_HOME'),
    cacheDir: resolveXdgDir('XDG_CACHE_HOME'),
  };
}
