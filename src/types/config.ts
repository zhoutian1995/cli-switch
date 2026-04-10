import type { ToolId } from './common.js';

/** CLI output modes supported by the main config file. */
export type DefaultOutput = 'text' | 'json';

/** Paths block from the main config schema. */
export interface ConfigPaths {
  /** Directory containing configuration files. */
  configDir?: string;
  /** Directory containing persistent application data. */
  dataDir?: string;
  /** Directory containing cache data. */
  cacheDir?: string;
}

/** Feature flags from the main config schema. */
export interface ConfigFeatures {
  /** Whether MCP support is enabled globally. */
  enableMcp?: boolean;
  /** Whether skills support is enabled globally. */
  enableSkills?: boolean;
  /** Whether strict profile matching is enabled. */
  strictProfile?: boolean;
}

/** Top-level configuration file schema. */
export interface ConfigFile {
  /** Config schema version. */
  schemaVersion: 'v1alpha1';
  /** Default tool id used when the user does not specify one. */
  defaultTool?: ToolId;
  /** Default output renderer mode. */
  defaultOutput?: DefaultOutput;
  /** Optional path overrides. */
  paths?: ConfigPaths;
  /** Optional feature flag overrides. */
  features?: ConfigFeatures;
}
